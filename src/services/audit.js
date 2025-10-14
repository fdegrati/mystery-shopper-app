const { db } = require('./db');

function logAudit(entidad, entidadId, accion, antes = null, despues = null) {
  try {
    const stmt = db.prepare(`
      INSERT INTO auditoria (entidad, entidad_id, accion, antes_json, despues_json)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      entidad,
      entidadId,
      accion,
      antes ? JSON.stringify(antes) : null,
      despues ? JSON.stringify(despues) : null
    );
  } catch (error) {
    console.error('Error al registrar auditoría:', error);
  }
}

function getAuditHistory(entidad, entidadId) {
  const stmt = db.prepare(`
    SELECT *
    FROM auditoria
    WHERE entidad = ? AND entidad_id = ?
    ORDER BY created_at DESC
  `);

  return stmt.all(entidad, entidadId);
}

function getRecentAudits(limit = 50) {
  const stmt = db.prepare(`
    SELECT *
    FROM auditoria
    ORDER BY created_at DESC
    LIMIT ?
  `);

  return stmt.all(limit);
}

module.exports = {
  logAudit,
  getAuditHistory,
  getRecentAudits
};
