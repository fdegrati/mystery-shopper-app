const express = require('express');
const clientCtrl = require('../controllers/clientCtrl');

const router = express.Router();

router.get('/:slug', clientCtrl.getClientDashboard);
router.get('/:slug/pdf', clientCtrl.generatePDF);
router.get('/:slug/data', clientCtrl.getClientData);

module.exports = router;
