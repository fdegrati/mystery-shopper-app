const express = require('express');
const { requireAdminCode, checkAdminCode } = require('../middleware/requireAdminCode');
const adminCtrl = require('../controllers/adminCtrl');

const router = express.Router();

router.get('/', checkAdminCode, adminCtrl.getAdminPanel);

router.get('/encuestas', adminCtrl.getEncuestas);
router.post('/encuestas', requireAdminCode, adminCtrl.createEncuesta);
router.put('/encuestas/:id', requireAdminCode, adminCtrl.updateEncuesta);
router.delete('/encuestas/:id', requireAdminCode, adminCtrl.deleteEncuesta);

router.get('/formularios', adminCtrl.getFormularios);
router.get('/formularios/:id', adminCtrl.getFormulario);
router.post('/formularios', requireAdminCode, adminCtrl.createFormulario);
router.put('/formularios/:id', requireAdminCode, adminCtrl.updateFormulario);
router.delete('/formularios/:id', requireAdminCode, adminCtrl.deleteFormulario);
router.post('/formularios/:id/clone', requireAdminCode, adminCtrl.cloneFormulario);

router.get('/modulos', adminCtrl.getModulos);
router.post('/modulos', requireAdminCode, adminCtrl.createModulo);
router.put('/modulos/:id', requireAdminCode, adminCtrl.updateModulo);
router.delete('/modulos/:id', requireAdminCode, adminCtrl.deleteModulo);
router.patch('/modulos/reorder', requireAdminCode, adminCtrl.reorderModulos);

router.get('/preguntas', adminCtrl.getPreguntas);
router.post('/preguntas', requireAdminCode, adminCtrl.createPregunta);
router.put('/preguntas/:id', requireAdminCode, adminCtrl.updatePregunta);
router.delete('/preguntas/:id', requireAdminCode, adminCtrl.deletePregunta);
router.patch('/preguntas/reorder', requireAdminCode, adminCtrl.reorderPreguntas);

router.get('/opciones', adminCtrl.getOpciones);
router.post('/opciones', requireAdminCode, adminCtrl.createOpcion);
router.put('/opciones/:id', requireAdminCode, adminCtrl.updateOpcion);
router.delete('/opciones/:id', requireAdminCode, adminCtrl.deleteOpcion);

router.get('/clientes', adminCtrl.getClientes);
router.post('/clientes', requireAdminCode, adminCtrl.createCliente);
router.put('/clientes/:id', requireAdminCode, adminCtrl.updateCliente);
router.delete('/clientes/:id', requireAdminCode, adminCtrl.deleteCliente);

router.get('/locales', adminCtrl.getLocales);
router.post('/locales', requireAdminCode, adminCtrl.createLocal);
router.put('/locales/:id', requireAdminCode, adminCtrl.updateLocal);
router.delete('/locales/:id', requireAdminCode, adminCtrl.deleteLocal);

router.get('/asignaciones', adminCtrl.getAsignaciones);
router.get('/asignaciones/:id', adminCtrl.getAsignacion);
router.post('/asignaciones', requireAdminCode, adminCtrl.createAsignaciones);
router.put('/asignaciones/:id', requireAdminCode, adminCtrl.updateAsignacion);
router.delete('/asignaciones/:id', requireAdminCode, adminCtrl.deleteAsignacion);

router.post('/asignaciones/:id/estado', requireAdminCode, adminCtrl.cambiarEstadoAsignacion);
router.post('/asignaciones/:id/devolver', requireAdminCode, adminCtrl.devolverAsignacion);

router.post('/asignaciones/grupo/:groupId/listo-para-compartir', requireAdminCode, adminCtrl.marcarListoParaCompartir);
router.post('/asignaciones/grupo/:groupId/compartir-cliente', requireAdminCode, adminCtrl.compartirConCliente);

router.get('/auditoria', adminCtrl.getAuditoria);
router.get('/auditoria/:entidad/:id', adminCtrl.getAuditoriaEntidad);

module.exports = router;
