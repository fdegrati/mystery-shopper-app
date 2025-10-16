const { db } = require('../services/db');
const { logAudit, getRecentAudits, getAuditHistory } = require('../services/audit');
const { generateSlug } = require('../services/slug');
const { computeScores } = require('../services/scoring');

exports.getAdminPanel = (req, res) => {
  try {
    const stats = {
      totalEncuestas: db.prepare('SELECT COUNT(*) as count FROM encuesta').get().count,
      totalFormularios: db.prepare('SELECT COUNT(*) as count FROM formulario').get().count,
      totalClientes: db.prepare('SELECT COUNT(*) as count FROM cliente').get().count,
      totalAsignaciones: db.prepare('SELECT COUNT(*) as count FROM asignacion').get().count,
      asignacionesPorEstado: db.prepare('SELECT estado, COUNT(*) as count FROM asignacion GROUP BY estado').all()
    };

    const encuestas = db.prepare(`
      SELECT e.*, (SELECT COUNT(*) FROM formulario WHERE encuesta_id = e.id) as total_formularios
      FROM encuesta e ORDER BY e.created_at DESC
    `).all();

    const clientes = db.prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM asignacion WHERE cliente_id = c.id) as total_asignaciones
      FROM cliente c ORDER BY c.nombre
    `).all();

    const auditReciente = getRecentAudits(10);

    res.render('admin', { stats, encuestas, clientes, auditReciente, isAdmin: req.isAdmin, baseUrl: process.env.APP_BASE_URL });
  } catch (error) {
    console.error('Error en getAdminPanel:', error);
    res.status(500).send('Error al cargar el panel');
  }
};

exports.getEncuestas = (req, res) => {
  try {
    const encuestas = db.prepare(`
      SELECT e.*, (SELECT COUNT(*) FROM formulario WHERE encuesta_id = e.id) as total_formularios
      FROM encuesta e ORDER BY e.created_at DESC
    `).all();
    res.json(encuestas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createEncuesta = (req, res) => {
  try {
    const { nombre, rubro, descripcion } = req.body;
    const stmt = db.prepare('INSERT INTO encuesta (organizacion_id, nombre, rubro, descripcion) VALUES (?, ?, ?, ?)');
    const result = stmt.run(1, nombre, rubro, descripcion);
    const encuesta = db.prepare('SELECT * FROM encuesta WHERE id = ?').get(result.lastInsertRowid);
    logAudit('encuesta', encuesta.id, 'crear', null, encuesta);
    res.json(encuesta);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateEncuesta = (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, rubro, descripcion } = req.body;
    const antes = db.prepare('SELECT * FROM encuesta WHERE id = ?').get(id);
    db.prepare('UPDATE encuesta SET nombre = ?, rubro = ?, descripcion = ? WHERE id = ?').run(nombre, rubro, descripcion, id);
    const despues = db.prepare('SELECT * FROM encuesta WHERE id = ?').get(id);
    logAudit('encuesta', id, 'actualizar', antes, despues);
    res.json(despues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteEncuesta = (req, res) => {
  try {
    const { id } = req.params;
    const antes = db.prepare('SELECT * FROM encuesta WHERE id = ?').get(id);
    db.prepare('DELETE FROM encuesta WHERE id = ?').run(id);
    logAudit('encuesta', id, 'eliminar', antes, null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getFormularios = (req, res) => {
  try {
    const { encuestaId } = req.query;
    let query = `SELECT f.*, e.nombre as encuesta_nombre FROM formulario f JOIN encuesta e ON f.encuesta_id = e.id`;
    const params = [];
    if (encuestaId) {
      query += ' WHERE f.encuesta_id = ?';
      params.push(encuestaId);
    }
    query += ' ORDER BY f.orden, f.id DESC';
    res.json(db.prepare(query).all(...params));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getFormulario = (req, res) => {
  try {
    const { id } = req.params;
    const formulario = db.prepare('SELECT f.*, e.nombre as encuesta_nombre FROM formulario f JOIN encuesta e ON f.encuesta_id = e.id WHERE f.id = ?').get(id);
    if (!formulario) return res.status(404).json({ error: 'No encontrado' });
    
    const modulos = db.prepare('SELECT * FROM modulo WHERE formulario_id = ? ORDER BY orden').all(id);
    for (const modulo of modulos) {
      modulo.preguntas = db.prepare('SELECT * FROM pregunta WHERE modulo_id = ? ORDER BY orden').all(modulo.id);
      for (const pregunta of modulo.preguntas) {
        pregunta.opciones = db.prepare('SELECT * FROM opcion WHERE pregunta_id = ? ORDER BY id').all(pregunta.id);
      }
    }
    formulario.modulos = modulos;
    res.json(formulario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createFormulario = (req, res) => {
  try {
    const { encuestaId, nombre, descripcion } = req.body;
    const stmt = db.prepare('INSERT INTO formulario (encuesta_id, nombre, descripcion, version, activo) VALUES (?, ?, ?, 1, 1)');
    const result = stmt.run(encuestaId, nombre, descripcion);
    const formulario = db.prepare('SELECT * FROM formulario WHERE id = ?').get(result.lastInsertRowid);
    logAudit('formulario', formulario.id, 'crear', null, formulario);
    res.json(formulario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateFormulario = (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;
    const antes = db.prepare('SELECT * FROM formulario WHERE id = ?').get(id);
    db.prepare('UPDATE formulario SET nombre = ?, descripcion = ?, activo = ? WHERE id = ?').run(nombre, descripcion, activo, id);
    const despues = db.prepare('SELECT * FROM formulario WHERE id = ?').get(id);
    logAudit('formulario', id, 'actualizar', antes, despues);
    res.json(despues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteFormulario = (req, res) => {
  try {
    const { id } = req.params;
    const antes = db.prepare('SELECT * FROM formulario WHERE id = ?').get(id);
    db.prepare('DELETE FROM formulario WHERE id = ?').run(id);
    logAudit('formulario', id, 'eliminar', antes, null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.cloneFormulario = (req, res) => {
  const transaction = db.transaction(() => {
    const { id } = req.params;
    const { nuevoNombre } = req.body;
    const original = db.prepare('SELECT * FROM formulario WHERE id = ?').get(id);
    if (!original) throw new Error('Formulario no encontrado');

    const resultForm = db.prepare('INSERT INTO formulario (encuesta_id, nombre, descripcion, version, activo) VALUES (?, ?, ?, ?, ?)').run(original.encuesta_id, nuevoNombre || `${original.nombre} (Copia)`, original.descripcion, original.version + 1, 0);
    const nuevoFormId = resultForm.lastInsertRowid;

    const modulos = db.prepare('SELECT * FROM modulo WHERE formulario_id = ? ORDER BY orden').all(id);
    const modulosMap = new Map();

    for (const modulo of modulos) {
      const resultMod = db.prepare('INSERT INTO modulo (formulario_id, titulo, descripcion, orden, peso) VALUES (?, ?, ?, ?, ?)').run(nuevoFormId, modulo.titulo, modulo.descripcion, modulo.orden, modulo.peso);
      modulosMap.set(modulo.id, resultMod.lastInsertRowid);

      const preguntas = db.prepare('SELECT * FROM pregunta WHERE modulo_id = ? ORDER BY orden').all(modulo.id);
      const preguntasMap = new Map();

      for (const pregunta of preguntas) {
        const resultPreg = db.prepare('INSERT INTO pregunta (modulo_id, enunciado, tipo, orden, max_points) VALUES (?, ?, ?, ?, ?)').run(modulosMap.get(modulo.id), pregunta.enunciado, pregunta.tipo, pregunta.orden, pregunta.max_points);
        preguntasMap.set(pregunta.id, resultPreg.lastInsertRowid);

        const opciones = db.prepare('SELECT * FROM opcion WHERE pregunta_id = ?').all(pregunta.id);
        for (const opcion of opciones) {
          db.prepare('INSERT INTO opcion (pregunta_id, etiqueta, valor, puntos) VALUES (?, ?, ?, ?)').run(preguntasMap.get(pregunta.id), opcion.etiqueta, opcion.valor, opcion.puntos);
        }
      }
    }

    const nuevoFormulario = db.prepare('SELECT * FROM formulario WHERE id = ?').get(nuevoFormId);
    logAudit('formulario', nuevoFormId, 'clonar', { origen: id }, nuevoFormulario);
    return nuevoFormulario;
  });

  try {
    res.json(transaction());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getModulos = (req, res) => {
  try {
    const { formularioId } = req.query;
    let query = 'SELECT * FROM modulo';
    const params = [];
    if (formularioId) {
      query += ' WHERE formulario_id = ?';
      params.push(formularioId);
    }
    query += ' ORDER BY orden';
    res.json(db.prepare(query).all(...params));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createModulo = (req, res) => {
  try {
    const { formularioId, titulo, descripcion, peso } = req.body;
    const maxOrden = db.prepare('SELECT MAX(orden) as max FROM modulo WHERE formulario_id = ?').get(formularioId);
    const orden = (maxOrden.max || 0) + 1;
    const result = db.prepare('INSERT INTO modulo (formulario_id, titulo, descripcion, orden, peso) VALUES (?, ?, ?, ?, ?)').run(formularioId, titulo, descripcion, orden, peso || 0);
    const modulo = db.prepare('SELECT * FROM modulo WHERE id = ?').get(result.lastInsertRowid);
    logAudit('modulo', modulo.id, 'crear', null, modulo);
    res.json(modulo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateModulo = (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, peso } = req.body;
    const antes = db.prepare('SELECT * FROM modulo WHERE id = ?').get(id);
    db.prepare('UPDATE modulo SET titulo = ?, descripcion = ?, peso = ? WHERE id = ?').run(titulo, descripcion, peso, id);
    const despues = db.prepare('SELECT * FROM modulo WHERE id = ?').get(id);
    logAudit('modulo', id, 'actualizar', antes, despues);
    res.json(despues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteModulo = (req, res) => {
  try {
    const { id } = req.params;
    const antes = db.prepare('SELECT * FROM modulo WHERE id = ?').get(id);
    db.prepare('DELETE FROM modulo WHERE id = ?').run(id);
    logAudit('modulo', id, 'eliminar', antes, null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.reorderModulos = (req, res) => {
  try {
    const { ordenes } = req.body;
    const stmt = db.prepare('UPDATE modulo SET orden = ? WHERE id = ?');
    for (const item of ordenes) {
      stmt.run(item.orden, item.id);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPreguntas = (req, res) => {
  try {
    const { moduloId } = req.query;
    let query = 'SELECT * FROM pregunta';
    const params = [];
    if (moduloId) {
      query += ' WHERE modulo_id = ?';
      params.push(moduloId);
    }
    query += ' ORDER BY orden';
    res.json(db.prepare(query).all(...params));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createPregunta = (req, res) => {
  try {
    const { moduloId, enunciado, tipo, maxPoints } = req.body;
    const maxOrden = db.prepare('SELECT MAX(orden) as max FROM pregunta WHERE modulo_id = ?').get(moduloId);
    const orden = (maxOrden.max || 0) + 1;
    const result = db.prepare('INSERT INTO pregunta (modulo_id, enunciado, tipo, orden, max_points) VALUES (?, ?, ?, ?, ?)').run(moduloId, enunciado, tipo || 'single_choice', orden, maxPoints || 10);
    const pregunta = db.prepare('SELECT * FROM pregunta WHERE id = ?').get(result.lastInsertRowid);
    logAudit('pregunta', pregunta.id, 'crear', null, pregunta);
    res.json(pregunta);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updatePregunta = (req, res) => {
  try {
    const { id } = req.params;
    const { enunciado, tipo, maxPoints } = req.body;
    const antes = db.prepare('SELECT * FROM pregunta WHERE id = ?').get(id);
    db.prepare('UPDATE pregunta SET enunciado = ?, tipo = ?, max_points = ? WHERE id = ?').run(enunciado, tipo, maxPoints, id);
    const despues = db.prepare('SELECT * FROM pregunta WHERE id = ?').get(id);
    logAudit('pregunta', id, 'actualizar', antes, despues);
    res.json(despues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deletePregunta = (req, res) => {
  try {
    const { id } = req.params;
    const antes = db.prepare('SELECT * FROM pregunta WHERE id = ?').get(id);
    db.prepare('DELETE FROM pregunta WHERE id = ?').run(id);
    logAudit('pregunta', id, 'eliminar', antes, null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.reorderPreguntas = (req, res) => {
  try {
    const { ordenes } = req.body;
    const stmt = db.prepare('UPDATE pregunta SET orden = ? WHERE id = ?');
    for (const item of ordenes) {
      stmt.run(item.orden, item.id);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOpciones = (req, res) => {
  try {
    const { preguntaId } = req.query;
    let query = 'SELECT * FROM opcion';
    const params = [];
    if (preguntaId) {
      query += ' WHERE pregunta_id = ?';
      params.push(preguntaId);
    }
    query += ' ORDER BY id';
    res.json(db.prepare(query).all(...params));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createOpcion = (req, res) => {
  try {
    const { preguntaId, etiqueta, valor, puntos } = req.body;
    const result = db.prepare('INSERT INTO opcion (pregunta_id, etiqueta, valor, puntos) VALUES (?, ?, ?, ?)').run(preguntaId, etiqueta, valor, puntos);
    const opcion = db.prepare('SELECT * FROM opcion WHERE id = ?').get(result.lastInsertRowid);
    logAudit('opcion', opcion.id, 'crear', null, opcion);
    res.json(opcion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateOpcion = (req, res) => {
  try {
    const { id } = req.params;
    const { etiqueta, valor, puntos } = req.body;
    const antes = db.prepare('SELECT * FROM opcion WHERE id = ?').get(id);
    db.prepare('UPDATE opcion SET etiqueta = ?, valor = ?, puntos = ? WHERE id = ?').run(etiqueta, valor, puntos, id);
    const despues = db.prepare('SELECT * FROM opcion WHERE id = ?').get(id);
    logAudit('opcion', id, 'actualizar', antes, despues);
    res.json(despues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteOpcion = (req, res) => {
  try {
    const { id } = req.params;
    const antes = db.prepare('SELECT * FROM opcion WHERE id = ?').get(id);
    db.prepare('DELETE FROM opcion WHERE id = ?').run(id);
    logAudit('opcion', id, 'eliminar', antes, null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getClientes = (req, res) => {
  try {
    const clientes = db.prepare('SELECT c.*, (SELECT COUNT(*) FROM asignacion WHERE cliente_id = c.id) as total_asignaciones, (SELECT COUNT(*) FROM local WHERE cliente_id = c.id) as total_locales FROM cliente c ORDER BY c.nombre').all();
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createCliente = (req, res) => {
  try {
    const { nombre, email, rubro, logoUrl } = req.body;
    const result = db.prepare('INSERT INTO cliente (organizacion_id, nombre, email, rubro, logo_url) VALUES (?, ?, ?, ?, ?)').run(1, nombre, email, rubro, logoUrl);
    const cliente = db.prepare('SELECT * FROM cliente WHERE id = ?').get(result.lastInsertRowid);
    logAudit('cliente', cliente.id, 'crear', null, cliente);
    res.json(cliente);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCliente = (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, rubro, logoUrl } = req.body;
    const antes = db.prepare('SELECT * FROM cliente WHERE id = ?').get(id);
    db.prepare('UPDATE cliente SET nombre = ?, email = ?, rubro = ?, logo_url = ? WHERE id = ?').run(nombre, email, rubro, logoUrl, id);
    const despues = db.prepare('SELECT * FROM cliente WHERE id = ?').get(id);
    logAudit('cliente', id, 'actualizar', antes, despues);
    res.json(despues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCliente = (req, res) => {
  try {
    const { id } = req.params;
    const antes = db.prepare('SELECT * FROM cliente WHERE id = ?').get(id);
    db.prepare('DELETE FROM cliente WHERE id = ?').run(id);
    logAudit('cliente', id, 'eliminar', antes, null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLocales = (req, res) => {
  try {
    const { clienteId } = req.query;
    let query = 'SELECT l.*, c.nombre as cliente_nombre FROM local l JOIN cliente c ON l.cliente_id = c.id';
    const params = [];
    if (clienteId) {
      query += ' WHERE l.cliente_id = ?';
      params.push(clienteId);
    }
    query += ' ORDER BY c.nombre, l.nombre';
    res.json(db.prepare(query).all(...params));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createLocal = (req, res) => {
  try {
    const { clienteId, nombre, direccion, ciudad } = req.body;
    const result = db.prepare('INSERT INTO local (cliente_id, nombre, direccion, ciudad) VALUES (?, ?, ?, ?)').run(clienteId, nombre, direccion, ciudad);
    const local = db.prepare('SELECT * FROM local WHERE id = ?').get(result.lastInsertRowid);
    logAudit('local', local.id, 'crear', null, local);
    res.json(local);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateLocal = (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, direccion, ciudad } = req.body;
    const antes = db.prepare('SELECT * FROM local WHERE id = ?').get(id);
    db.prepare('UPDATE local SET nombre = ?, direccion = ?, ciudad = ? WHERE id = ?').run(nombre, direccion, ciudad, id);
    const despues = db.prepare('SELECT * FROM local WHERE id = ?').get(id);
    logAudit('local', id, 'actualizar', antes, despues);
    res.json(despues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteLocal = (req, res) => {
  try {
    const { id } = req.params;
    const antes = db.prepare('SELECT * FROM local WHERE id = ?').get(id);
    db.prepare('DELETE FROM local WHERE id = ?').run(id);
    logAudit('local', id, 'eliminar', antes, null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAsignaciones = (req, res) => {
  try {
    const { estado, clienteId, formularioId } = req.query;
    let query = 'SELECT a.*, f.nombre as formulario_nombre, c.nombre as cliente_nombre, l.nombre as local_nombre FROM asignacion a JOIN formulario f ON a.formulario_id = f.id JOIN cliente c ON a.cliente_id = c.id LEFT JOIN local l ON a.local_id = l.id WHERE 1=1';
    const params = [];
    if (estado) {
      query += ' AND a.estado = ?';
      params.push(estado);
    }
    if (clienteId) {
      query += ' AND a.cliente_id = ?';
      params.push(clienteId);
    }
    if (formularioId) {
      query += ' AND a.formulario_id = ?';
      params.push(formularioId);
    }
    query += ' ORDER BY a.created_at DESC';
    const asignaciones = db.prepare(query).all(...params);
    
    for (const asignacion of asignaciones) {
      if (['ENVIADO', 'EN_REVISION', 'APROBADO', 'LISTO_PARA_COMPARTIR', 'COMPARTIDO_CON_CLIENTE'].includes(asignacion.estado)) {
        try {
          const scores = computeScores(asignacion.id);
          asignacion.puntajeTotal = scores.puntajeTotal;
        } catch (e) {
          asignacion.puntajeTotal = null;
        }
      }
    }
    res.json(asignaciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAsignacion = (req, res) => {
  try {
    const { id } = req.params;
    const asignacion = db.prepare('SELECT a.*, f.nombre as formulario_nombre, c.nombre as cliente_nombre, l.nombre as local_nombre FROM asignacion a JOIN formulario f ON a.formulario_id = f.id JOIN cliente c ON a.cliente_id = c.id LEFT JOIN local l ON a.local_id = l.id WHERE a.id = ?').get(id);
    if (!asignacion) return res.status(404).json({ error: 'No encontrada' });
    res.json(asignacion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createAsignaciones = (req, res) => {
  try {
    const { formularioId, clienteId, localId, shopperEmails } = req.body;
    if (!shopperEmails || shopperEmails.length === 0) {
      return res.status(400).json({ error: 'Debe proporcionar al menos un email' });
    }
    const asignaciones = [];
    const stmt = db.prepare('INSERT INTO asignacion (formulario_id, cliente_id, local_id, shopper_email, shopper_slug, estado) VALUES (?, ?, ?, ?, ?, ?)');
    for (const email of shopperEmails) {
      const shopperSlug = generateSlug();
      const result = stmt.run(formularioId, clienteId, localId || null, email.trim(), shopperSlug, 'BORRADOR');
      const asignacion = db.prepare('SELECT * FROM asignacion WHERE id = ?').get(result.lastInsertRowid);
      asignaciones.push(asignacion);
      logAudit('asignacion', asignacion.id, 'crear', null, asignacion);
    }
    res.json({ asignaciones, count: asignaciones.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateAsignacion = (req, res) => {
  try {
    const { id } = req.params;
    const { shopperEmail, localId } = req.body;
    const antes = db.prepare('SELECT * FROM asignacion WHERE id = ?').get(id);
    db.prepare('UPDATE asignacion SET shopper_email = ?, local_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(shopperEmail, localId, id);
    const despues = db.prepare('SELECT * FROM asignacion WHERE id = ?').get(id);
    logAudit('asignacion', id, 'actualizar', antes, despues);
    res.json(despues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteAsignacion = (req, res) => {
  try {
    const { id } = req.params;
    const antes = db.prepare('SELECT * FROM asignacion WHERE id = ?').get(id);
    db.prepare('DELETE FROM asignacion WHERE id = ?').run(id);
    logAudit('asignacion', id, 'eliminar', antes, null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const ESTADOS_VALIDOS = ['BORRADOR', 'ENVIADO', 'EN_REVISION', 'NECESITA_REVISION', 'APROBADO', 'LISTO_PARA_COMPARTIR', 'COMPARTIDO_CON_CLIENTE'];

exports.cambiarEstadoAsignacion = (req, res) => {
  try {
    const { id } = req.params;
    const { nuevoEstado } = req.body;
    if (!ESTADOS_VALIDOS.includes(nuevoEstado)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }
    const antes = db.prepare('SELECT * FROM asignacion WHERE id = ?').get(id);
    if (!antes) return res.status(404).json({ error: 'No encontrada' });
    db.prepare('UPDATE asignacion SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nuevoEstado, id);
    const despues = db.prepare('SELECT * FROM asignacion WHERE id = ?').get(id);
    logAudit('asignacion', id, 'cambiar_estado', antes, despues);
    res.json(despues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.devolverAsignacion = (req, res) => {
  try {
    const { id } = req.params;
    const { comentario } = req.body;
    const antes = db.prepare('SELECT * FROM asignacion WHERE id = ?').get(id);
    if (!antes) return res.status(404).json({ error: 'No encontrada' });
    db.prepare('UPDATE asignacion SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('NECESITA_REVISION', id);
    const despues = db.prepare('SELECT * FROM asignacion WHERE id = ?').get(id);
    logAudit('asignacion', id, 'devolver', antes, { ...despues, comentario });
    res.json(despues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

function getGrupoAsignaciones(groupId) {
  const asignacion = db.prepare('SELECT * FROM asignacion WHERE id = ?').get(groupId);
  if (!asignacion) return [];
  let query = 'SELECT * FROM asignacion WHERE formulario_id = ? AND cliente_id = ?';
  const params = [asignacion.formulario_id, asignacion.cliente_id];
  if (asignacion.local_id) {
    query += ' AND local_id = ?';
    params.push(asignacion.local_id);
  } else {
    query += ' AND local_id IS NULL';
  }
  if (asignacion.visita_id) {
    query += ' AND visita_id = ?';
    params.push(asignacion.visita_id);
  } else {
    query += ' AND visita_id IS NULL';
  }
  return db.prepare(query).all(...params);
}

exports.marcarListoParaCompartir = (req, res) => {
  try {
    const { groupId } = req.params;
    const grupo = getGrupoAsignaciones(groupId);
    if (grupo.length === 0) return res.status(404).json({ error: 'Grupo no encontrado' });
    const todasAprobadas = grupo.every(a => a.estado === 'APROBADO');
    if (!todasAprobadas) {
      const aprobadas = grupo.filter(a => a.estado === 'APROBADO').length;
      return res.status(400).json({
        error: 'No todas están aprobadas',
        message: `${aprobadas}/${grupo.length} aprobadas`,
        pendientes: grupo.filter(a => a.estado !== 'APROBADO').map(a => ({ id: a.id, email: a.shopper_email, estado: a.estado }))
      });
    }
    const stmt = db.prepare('UPDATE asignacion SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    for (const asignacion of grupo) {
      stmt.run('LISTO_PARA_COMPARTIR', asignacion.id);
      logAudit('asignacion', asignacion.id, 'listo_para_compartir', asignacion, { estado: 'LISTO_PARA_COMPARTIR' });
    }
    res.json({ success: true, message: `${grupo.length} asignaciones listas`, asignaciones: grupo.map(a => a.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.compartirConCliente = (req, res) => {
  try {
    const { groupId } = req.params;
    const grupo = getGrupoAsignaciones(groupId);
    if (grupo.length === 0) return res.status(404).json({ error: 'Grupo no encontrado' });
    const todasListas = grupo.every(a => a.estado === 'LISTO_PARA_COMPARTIR');
    if (!todasListas) {
      return res.status(400).json({ error: 'No todas están listas para compartir' });
    }
    let clienteSlug = grupo[0].cliente_slug;
    if (!clienteSlug) {
      clienteSlug = generateSlug('cliente');
    }
    const stmt = db.prepare('UPDATE asignacion SET estado = ?, cliente_slug = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    for (const asignacion of grupo) {
      stmt.run('COMPARTIDO_CON_CLIENTE', clienteSlug, asignacion.id);
      logAudit('asignacion', asignacion.id, 'compartir_cliente', asignacion, { estado: 'COMPARTIDO_CON_CLIENTE', cliente_slug: clienteSlug });
    }
    res.json({ success: true, message: `${grupo.length} asignaciones compartidas`, clienteSlug, url: `${process.env.APP_BASE_URL}/c/${clienteSlug}`, asignaciones: grupo.map(a => a.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAuditoria = (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const audits = getRecentAudits(parseInt(limit));
    res.json(audits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAuditoriaEntidad = (req, res) => {
  try {
    const { entidad, id } = req.params;
    const audits = getAuditHistory(entidad, parseInt(id));
    res.json(audits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
