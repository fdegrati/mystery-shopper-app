const { db } = require('./db');

function computeScores(asignacionId) {
  const asignacion = db.prepare(`
    SELECT a.*, f.id as formulario_id
    FROM asignacion a
    JOIN formulario f ON a.formulario_id = f.id
    WHERE a.id = ?
  `).get(asignacionId);

  if (!asignacion) {
    throw new Error('Asignación no encontrada');
  }

  const modulos = db.prepare(`
    SELECT id, titulo, peso
    FROM modulo
    WHERE formulario_id = ?
    ORDER BY orden
  `).all(asignacion.formulario_id);

  const moduleScores = [];
  let totalWeightUsed = 0;

  for (const modulo of modulos) {
    const preguntas = db.prepare(`
      SELECT p.id, p.max_points
      FROM pregunta p
      WHERE p.modulo_id = ?
      ORDER BY p.orden
    `).all(modulo.id);

    const respuestas = db.prepare(`
      SELECT r.pregunta_id, r.puntos_obtenidos
      FROM respuesta r
      WHERE r.asignacion_id = ?
        AND r.pregunta_id IN (${preguntas.map(p => p.id).join(',') || '0'})
    `).all(asignacionId);

    const respuestasMap = new Map(
      respuestas.map(r => [r.pregunta_id, r.puntos_obtenidos])
    );

    let puntosObtenidos = 0;
    let puntosMaximos = 0;
    let preguntasRespondidas = 0;
    let preguntasNA = 0;

    for (const pregunta of preguntas) {
      const puntos = respuestasMap.get(pregunta.id);
      
      if (puntos === undefined) {
        continue;
      }

      if (puntos === null) {
        preguntasNA++;
        continue;
      }

      puntosObtenidos += puntos;
      puntosMaximos += pregunta.max_points;
      preguntasRespondidas++;
    }

    let porcentajeModulo = 0;
    if (puntosMaximos > 0) {
      porcentajeModulo = (puntosObtenidos / puntosMaximos) * 100;
    }

    const puntajeConPeso = (porcentajeModulo / 100) * modulo.peso;

    const moduleScore = {
      moduloId: modulo.id,
      titulo: modulo.titulo,
      peso: modulo.peso,
      puntosObtenidos,
      puntosMaximos,
      preguntasRespondidas,
      preguntasNA,
      preguntasTotal: preguntas.length,
      porcentaje: Math.round(porcentajeModulo * 10) / 10,
      puntajeConPeso: Math.round(puntajeConPeso * 10) / 10
    };

    moduleScores.push(moduleScore);

    if (preguntasRespondidas > 0) {
      totalWeightUsed += modulo.peso;
    }
  }

  let puntajeTotal = 0;
  if (totalWeightUsed > 0 && totalWeightUsed < 100) {
    const factor = 100 / totalWeightUsed;
    moduleScores.forEach(ms => {
      if (ms.preguntasRespondidas > 0) {
        ms.pesoNormalizado = Math.round(ms.peso * factor * 10) / 10;
        ms.puntajeConPesoNormalizado = Math.round(ms.puntajeConPeso * factor * 10) / 10;
        puntajeTotal += ms.puntajeConPesoNormalizado;
      } else {
        ms.pesoNormalizado = 0;
        ms.puntajeConPesoNormalizado = 0;
      }
    });
  } else {
    moduleScores.forEach(ms => {
      ms.pesoNormalizado = ms.peso;
      ms.puntajeConPesoNormalizado = ms.puntajeConPeso;
      puntajeTotal += ms.puntajeConPeso;
    });
  }

  puntajeTotal = Math.min(100, Math.round(puntajeTotal * 10) / 10);

  return {
    asignacionId,
    moduleScores,
    puntajeTotal,
    totalWeightUsed,
    pesosTotales: modulos.reduce((sum, m) => sum + m.peso, 0)
  };
}

function getScoresSummary(asignacionIds) {
  if (!asignacionIds || asignacionIds.length === 0) {
    return {
      promedioTotal: 0,
      promediosPorModulo: [],
      distribucion: { excelente: 0, bueno: 0, regular: 0, malo: 0 }
    };
  }

  const allScores = asignacionIds.map(id => {
    try {
      return computeScores(id);
    } catch (e) {
      return null;
    }
  }).filter(s => s !== null);

  if (allScores.length === 0) {
    return {
      promedioTotal: 0,
      promediosPorModulo: [],
      distribucion: { excelente: 0, bueno: 0, regular: 0, malo: 0 }
    };
  }

  const promedioTotal = allScores.reduce((sum, s) => sum + s.puntajeTotal, 0) / allScores.length;

  const modulosMap = new Map();
  allScores.forEach(score => {
    score.moduleScores.forEach(ms => {
      if (!modulosMap.has(ms.moduloId)) {
        modulosMap.set(ms.moduloId, {
          moduloId: ms.moduloId,
          titulo: ms.titulo,
          puntajes: []
        });
      }
      modulosMap.get(ms.moduloId).puntajes.push(ms.porcentaje);
    });
  });

  const promediosPorModulo = Array.from(modulosMap.values()).map(m => ({
    moduloId: m.moduloId,
    titulo: m.titulo,
    promedio: Math.round((m.puntajes.reduce((a, b) => a + b, 0) / m.puntajes.length) * 10) / 10
  }));

  const distribucion = {
    excelente: allScores.filter(s => s.puntajeTotal >= 90).length,
    bueno: allScores.filter(s => s.puntajeTotal >= 70 && s.puntajeTotal < 90).length,
    regular: allScores.filter(s => s.puntajeTotal >= 50 && s.puntajeTotal < 70).length,
    malo: allScores.filter(s => s.puntajeTotal < 50).length
  };

  return {
    promedioTotal: Math.round(promedioTotal * 10) / 10,
    promediosPorModulo,
    distribucion,
    totalEvaluaciones: allScores.length
  };
}

module.exports = {
  computeScores,
  getScoresSummary
};
