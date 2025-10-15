const express = require('express');
const { db } = require('../services/db');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const result = db.prepare('SELECT 1 as ok').get();
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: result.ok === 1 ? 'connected' : 'error',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
