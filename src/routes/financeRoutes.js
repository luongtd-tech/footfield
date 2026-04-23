const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');

router.get('/tenant/:tenantId/report', financeController.getFinanceReport);

module.exports = router;
