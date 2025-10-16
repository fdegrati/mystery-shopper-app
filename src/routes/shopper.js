const express = require('express');
const shopperCtrl = require('../controllers/shopperCtrl');

const router = express.Router();

router.get('/:slug', shopperCtrl.getShopperForm);
router.put('/:slug/respuestas', shopperCtrl.saveRespuestas);
router.put('/:slug/modulos/:modId/justificacion', shopperCtrl.saveJustificacion);
router.post('/:slug/enviar', shopperCtrl.enviarFormulario);
router.post('/:slug/upload/:modId', shopperCtrl.uploadImage);
router.delete('/:slug/media/:mediaId', shopperCtrl.deleteImage);

module.exports = router;
