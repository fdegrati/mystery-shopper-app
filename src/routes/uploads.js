const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../services/db');

const router = express.Router();

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

async function processAndSaveImage(buffer, originalMimetype) {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    let processedBuffer = await image
      .rotate()
      .jpeg({ quality: 85, progressive: true, mozjpeg: true })
      .toBuffer();

    const maxSize = 2 * 1024 * 1024;
    
    if (processedBuffer.length > maxSize) {
      const scaleFactor = Math.sqrt(maxSize / processedBuffer.length);
      const newWidth = Math.floor(metadata.width * scaleFactor);
      
      processedBuffer = await sharp(buffer)
        .rotate()
        .resize(newWidth, null, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, progressive: true, mozjpeg: true })
        .toBuffer();
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
    throw new Error('Error al procesar la imagen');
  }
}

router.post('/', upload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const { asignacionId, moduloId } = req.body;

    if (!asignacionId || !moduloId) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    const imageData = await processAndSaveImage(req.file.buffer, req.file.mimetype);

    const stmt = db.prepare(`
      INSERT INTO media (asignacion_id, modulo_id, url, mime, size_bytes, width, height)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      asignacionId,
      moduloId,
      imageData.url,
      imageData.mime,
      imageData.size,
      imageData.width,
      imageData.height
    );

    const media = db.prepare('SELECT * FROM media WHERE id = ?').get(result.lastInsertRowid);

    res.json({ success: true, media });
  } catch (error) {
    console.error('Error en upload:', error);
    res.status(500).json({
      error: 'Error al subir la imagen',
      message: error.message
    });
  }
});

module.exports = router;
