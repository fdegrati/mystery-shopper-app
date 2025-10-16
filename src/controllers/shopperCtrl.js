const { db } = require('../services/db');
const { logAudit } = require('../services/audit');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no soportado'));
    }
  }
}).single('image');

const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

exports.getShopperForm = (req, res) => {
  try {
    const { slug } = req.params;
    const asignacion = db.prepare(`
      SELECT a.*, f.nombre as formulario_nombre, f.descripcion as formulario_descripcion,
        c.nombre as cliente_nombre, l.nombre as local_nombre, l.direccion as local_direccion
      FROM asignacion a
      JOIN formulario f ON a.formulario_id = f.id
      JOIN cliente c ON a.cliente_id = c.id
      LEFT JOIN local l ON a.local_id = l.id
      WHERE a.shopper_slug = ?
    `).get(slug);

    if (!asignacion) {
      return res.status(404).send('Asignación no encontrada');
    }

    const puedeEditar = ['BORRADOR', 'NECESITA_REVISION'].includes(asignacion.estado);

    const modulos = db.prepare('SELECT * FROM modulo WHERE formulario_id = ? ORDER BY orden').all(asignacion.formulario_id);

    for (const modulo of modulos) {
      modulo.preguntas = db.prepare('SELECT * FROM pregunta WHERE modulo_id = ? ORDER BY orden').all(modulo.id);

      for (const pregunta of modulo.preguntas) {
        pregunta.opciones = db.prepare('SELECT * FROM opcion WHERE pregunta_id = ? ORDER BY id').all(pregunta.id);
        const respuesta = db.prepare('SELECT * FROM respuesta WHERE asignacion_id = ? AND pregunta_id = ?').get(asignacion.id, pregunta.id);
        pregunta.respuesta = respuesta;
      }

      const justificacion = db.prepare('SELECT * FROM justificacion_modulo WHERE asignacion_id = ? AND modulo_id = ?').get(asignacion.id, modulo.id);
      modulo.justificacion = justificacion;

      modulo.imagenes = db.prepare('SELECT * FROM media WHERE asignacion_id = ? AND modulo_id = ? ORDER BY created_at').all(asignacion.id, modulo.id);
    }

    res.render('shopper', { asignacion, modulos, puedeEditar, baseUrl: process.env.APP_BASE_URL });
  } catch (error) {
    console.error('Error en getShopperForm:', error);
    res.status(500).send('Error al cargar el formulario');
  }
};

exports.saveRespuestas = (req, res) => {
  try {
    const { slug } = req.params;
    const { respuestas } = req.body;

    const asignacion = db.prepare('SELECT * FROM asignacion WHERE shopper_slug = ?').get(slug);

    if (!asignacion) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    if (!['BORRADOR', 'NECESITA_REVISION'].includes(asignacion.estado)) {
      return res.status(403).json({ error: 'No puede editar esta asignación' });
    }

    const stmtInsert = db.prepare(`
      INSERT INTO respuesta (asignacion_id, pregunta_id, opcion_id, puntos_obtenidos, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(asignacion_id, pregunta_id) 
      DO UPDATE SET opcion_id = ?, puntos_obtenidos = ?, updated_at = CURRENT_TIMESTAMP
    `);

    for (const resp of respuestas) {
      const opcion = db.prepare('SELECT puntos FROM opcion WHERE id = ?').get(resp.opcionId);
      const puntos = opcion ? opcion.puntos : null;

      stmtInsert.run(asignacion.id, resp.preguntaId, resp.opcionId, puntos, resp.opcionId, puntos);
    }

    db.prepare('UPDATE asignacion SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(asignacion.id);

    logAudit('asignacion', asignacion.id, 'guardar_respuestas', null, { cantidad: respuestas.length });

    res.json({ success: true, message: 'Respuestas guardadas' });
  } catch (error) {
    console.error('Error en saveRespuestas:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.saveJustificacion = (req, res) => {
  try {
    const { slug, modId } = req.params;
    const { texto } = req.body;

    const asignacion = db.prepare('SELECT * FROM asignacion WHERE shopper_slug = ?').get(slug);

    if (!asignacion) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    if (!['BORRADOR', 'NECESITA_REVISION'].includes(asignacion.estado)) {
      return res.status(403).json({ error: 'No puede editar esta asignación' });
    }

    const stmt = db.prepare(`
      INSERT INTO justificacion_modulo (asignacion_id, modulo_id, texto, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(asignacion_id, modulo_id)
      DO UPDATE SET texto = ?, updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(asignacion.id, modId, texto, texto);

    res.json({ success: true, message: 'Justificación guardada' });
  } catch (error) {
    console.error('Error en saveJustificacion:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.enviarFormulario = (req, res) => {
  try {
    const { slug } = req.params;

    const asignacion = db.prepare('SELECT * FROM asignacion WHERE shopper_slug = ?').get(slug);

    if (!asignacion) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    if (!['BORRADOR', 'NECESITA_REVISION'].includes(asignacion.estado)) {
      return res.status(403).json({ error: 'No puede enviar esta asignación' });
    }

    const antes = { ...asignacion };
    db.prepare('UPDATE asignacion SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('ENVIADO', asignacion.id);

    const despues = db.prepare('SELECT * FROM asignacion WHERE id = ?').get(asignacion.id);

    logAudit('asignacion', asignacion.id, 'enviar', antes, despues);

    res.json({ success: true, message: 'Formulario enviado correctamente' });
  } catch (error) {
    console.error('Error en enviarFormulario:', error);
    res.status(500).json({ error: error.message });
  }
};

async function processImage(buffer) {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    let processedBuffer = await image.rotate().jpeg({ quality: 85, progressive: true, mozjpeg: true }).toBuffer();

    const maxSize = 2 * 1024 * 1024;
    if (processedBuffer.length > maxSize) {
      const scaleFactor = Math.sqrt(maxSize / processedBuffer.length);
      const newWidth = Math.floor(metadata.width * scaleFactor);
      
      processedBuffer = await sharp(buffer).rotate().resize(newWidth, null, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80, progressive: true, mozjpeg: true }).toBuffer();
    }

    const finalImage = sharp(processedBuffer);
    const finalMetadata = await finalImage.metadata();

    const filename = `${uuidv4()}.jpg`;
    const filepath = path.join(UPLOADS_DIR, filename);

    await fs.promises.writeFile(filepath, processedBuffer);

    return {
      filename,
      url: `/uploads/${filename}`,
      mime: 'image/jpeg',
      size: processedBuffer.length,
      width: finalMetadata.width,
      height: finalMetadata.height
    };
  } catch (error) {
    throw new Error('Error al procesar imagen');
  }
}

exports.uploadImage = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      const { slug, modId } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó imagen' });
      }

      const asignacion = db.prepare('SELECT * FROM asignacion WHERE shopper_slug = ?').get(slug);

      if (!asignacion) {
        return res.status(404).json({ error: 'Asignación no encontrada' });
      }

      if (!['BORRADOR', 'NECESITA_REVISION'].includes(asignacion.estado)) {
        return res.status(403).json({ error: 'No puede editar esta asignación' });
      }

      const imageData = await processImage(req.file.buffer);

      const stmt = db.prepare(`
        INSERT INTO media (asignacion_id, modulo_id, url, mime, size_bytes, width, height)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(asignacion.id, modId, imageData.url, imageData.mime, imageData.size, imageData.width, imageData.height);

      const media = db.prepare('SELECT * FROM media WHERE id = ?').get(result.lastInsertRowid);

      res.json({ success: true, media });
    } catch (error) {
      console.error('Error en uploadImage:', error);
      res.status(500).json({ error: error.message });
    }
  });
};

exports.deleteImage = (req, res) => {
  try {
    const { slug, mediaId } = req.params;

    const asignacion = db.prepare('SELECT * FROM asignacion WHERE shopper_slug = ?').get(slug);

    if (!asignacion) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    if (!['BORRADOR', 'NECESITA_REVISION'].includes(asignacion.estado)) {
      return res.status(403).json({ error: 'No puede editar esta asignación' });
    }

    const media = db.prepare('SELECT * FROM media WHERE id = ? AND asignacion_id = ?').get(mediaId, asignacion.id);

    if (!media) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    const filepath = path.join(__dirname, '../public', media.url);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    db.prepare('DELETE FROM media WHERE id = ?').run(mediaId);

    res.json({ success: true, message: 'Imagen eliminada' });
  } catch (error) {
    console.error('Error en deleteImage:', error);
    res.status(500).json({ error: error.message });
  }
};
