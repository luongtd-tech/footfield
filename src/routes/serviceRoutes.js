const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

router.get('/tenant/:tenantId', serviceController.getAllServices);
router.post('/', serviceController.createService);
router.put('/:id', serviceController.updateService);
router.delete('/:id', serviceController.deleteService);

router.get('/booking/:bookingId', serviceController.getBookingServices);
router.post('/booking', serviceController.addBookingService);

module.exports = router;
