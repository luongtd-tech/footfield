const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

router.get('/', invoiceController.getAllInvoices);
router.get('/stats', invoiceController.getInvoiceStats);
router.get('/monthly-revenue', invoiceController.getMonthlyRevenue);
router.post('/send-email', invoiceController.sendEmail);
router.put('/:id/status', invoiceController.updateInvoiceStatus);

module.exports = router;
