const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');

router.get('/', ticketController.getAllTickets);
router.post('/', ticketController.createTicket);
router.get('/tenant/:tenantId', ticketController.getTenantTickets);
router.put('/:id/status', ticketController.updateTicketStatus);

module.exports = router;
