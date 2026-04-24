const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/vnpay/create-url', paymentController.createPaymentUrl);
router.get('/vnpay/vnpay_return', paymentController.vnpayReturn);
router.get('/vnpay/vnpay_ipn', paymentController.vnpayIpn);

module.exports = router;
