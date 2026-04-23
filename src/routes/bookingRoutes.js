const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

router.get('/tenant/:tenantId', bookingController.getBookingsByTenant);
router.post('/', bookingController.createBooking);
router.patch('/:id/status', bookingController.updateBookingStatus);
router.patch('/:id/payment', bookingController.updateBookingPayment);

router.get('/qr/:code', bookingController.getBookingByQR);
router.put('/:id/status', bookingController.updateBookingStatus);

module.exports = router;
