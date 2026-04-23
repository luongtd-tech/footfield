const express = require('express');
const router = express.Router();
const fieldController = require('../controllers/fieldController');

// Middleware to assume tenantId for now. In a real app, this would come from auth.
const checkTenantId = (req, res, next) => {
  if (!req.params.tenantId) {
    req.params.tenantId = 'tenant1'; // Hardcoding for demonstration
  }
  next();
};

router.get('/:tenantId', checkTenantId, fieldController.getFieldsByTenant);
router.post('/', fieldController.createField);
router.patch('/:id/status', fieldController.updateFieldStatus);
router.put('/:id', fieldController.updateField);
router.delete('/:id', fieldController.deleteField);

module.exports = router;
