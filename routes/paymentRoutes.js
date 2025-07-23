const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
    createPaymentIntent,
    confirmPayment,
    getPaymentReceipt
} = require('../controllers/paymentController');

// Protected routes
router.post('/create-intent', auth, createPaymentIntent);
router.post('/confirm', auth, confirmPayment);
router.get('/receipt', auth, getPaymentReceipt);

module.exports = router;