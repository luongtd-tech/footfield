const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');

router.get('/', tenantController.getAllTenants);
router.get('/stats', tenantController.getDashboardStats);
router.get('/:id/settings', tenantController.getTenantSettings);
router.get('/:id/dashboard', tenantController.getTenantDashboardData);
router.post('/', tenantController.createTenant);
router.put('/:id', tenantController.updateTenant);
router.patch('/:id/settings', tenantController.updateTenant);
router.put('/:id/status', tenantController.updateTenantStatus);
router.put('/:id/renew', tenantController.renewTenant);
router.delete('/:id', tenantController.deleteTenant);

module.exports = router;
