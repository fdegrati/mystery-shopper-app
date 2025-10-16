const { db } = require('../services/db');
const { computeScores, getScoresSummary } = require('../services/scoring');

exports.getClientDashboard = (req, res) => {
  try {
    const { slug } = req.params;

    const asignaciones = db.prepare(`
      SELECT a.*, f.nombre as formulario_nombre, c.nombre as cliente_nombre,
        c.logo_url as cliente_logo, l.nombre as local_nombre, l.ciudad as local_ciudad
      FROM asignacion a
      JOIN formulario f ON a.formulario_id = f.id
      JOIN cliente c ON a.cliente_id = c.id
      LEFT JOIN local l ON a.local_id = l.id
      WHERE a.cliente_slug = ? AND a.estado = 'COMPARTIDO_CON_CLIENTE'
      ORDER BY a.created_at DESC
    `).all(slug);

    if (asignaciones.length === 0) {
      return res.status(404).send('No se encontraron evaluaciones compartidas');
    }

    const asignacionesConPuntaje = asignaciones.map(a => {
      try {
        const scores = computeScores(a.id);
        return { ...a, scores };
      } catch (e) {
        return { ...a, scores: null };
      }
    });

    const cliente = db.prepare('SELECT * FROM cliente WHERE id = ?').get(asignaciones[0].cliente_id);
    const organizacion = db.prepare('SELECT * FROM organizacion WHERE id = ?').get(cliente.organizacion_id);

    const resumen = getScoresSummary(asignaciones.map(a => a.id));

    const locales = [...new Set(asignaciones.map(a => a.local_nombre).filter(Boolean))];
    const fechas = [...new Set(asignaciones.map(a => a.created_at))];

    res.render('client', {
      cliente,
      organizacion,
      asignaciones: asignacionesConPuntaje,
      resumen,
      locales,
      fechas,
      slug,
      baseUrl: process.env.APP_BASE_URL
    });
  } catch (error) {
    console.error('Error en getClientDashboard:', error);
    res.status(500).send('Error al cargar el dashboard');
  }
};

exports.getClientData = (req, res) => {
  try {
    const { slug } = req.params;
    const { localId, fechaDesde, fechaHasta, estado } = req.query;

    let query = `
      SELECT a.*, f.nombre as formulario_nombre, c.nombre as cliente_nombre, l.nombre as local_nombre
      FROM asignacion a
      JOIN formulario f ON a.formulario_id = f.id
      JOIN cliente c ON a.cliente_id = c.id
      LEFT JOIN local l ON a.local_id = l.id
      WHERE a.cliente_slug = ?
    `;

    const params = [slug];

    if (localId) {
      query += ' AND a.local_id = ?';
      params.push(localId);
    }

    if (fechaDesde) {
      query += ' AND DATE(a.created_at) >= ?';
      params.push(fechaDesde);
    }

    if (fechaHasta) {
      query += ' AND DATE(a.created_at) <= ?';
      params.push(fechaHasta);
    }

    if (estado) {
      query += ' AND a.estado = ?';
      params.push(estado);
    }

    query += ' ORDER BY a.created_at DESC';

    const asignaciones = db.prepare(query).all(...params);

    const asignacionesConPuntaje = asignaciones.map(a => {
      try {
        const scores = computeScores(a.id);
        return { ...a, scores };
      } catch (e) {
        return { ...a, scores: null };
      }
    });

    res.json(asignacionesConPuntaje);
  } catch (error) {
    console.error('Error en getClientData:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.generatePDF = async (req, res) => {
  try {
    const { slug } = req.params;

    res.status(501).json({ 
      error: 'Generación de PDF no disponible en esta versión',
      message: 'Esta funcionalidad requiere Puppeteer que puede no estar disponible en Railway. Use la vista web para imprimir a PDF desde el navegador.'
    });
  } catch (error) {
    console.error('Error en generatePDF:', error);
    res.status(500).send('Error al generar el PDF');
  }
};
