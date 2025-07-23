const pool = require('../config/db');
const stripe = require('../config/stripe');

// Create payment intent
const createPaymentIntent = async (req, res) => {
    try {
        const { applicationId } = req.body;
        const login_id = req.user.id;

        // Verify application belongs to user
        const [applications] = await pool.query(
            'SELECT id FROM admission_students WHERE id = ? AND login_id = ?',
            [applicationId, login_id]
        );

        if (applications.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Check if already paid
        const [app] = await pool.query(
            'SELECT payment_status FROM admission_students WHERE id = ?',
            [applicationId]
        );

        if (app[0].payment_status === 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Payment already completed'
            });
        }

        // Create payment intent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 10000, // 100 INR in paise
            currency: 'inr',
            metadata: { applicationId }
        });

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to create payment' });
    }
};

// Confirm payment
const confirmPayment = async (req, res) => {
    try {
        const { applicationId, paymentId } = req.body;
        const login_id = req.user.id;

        // Verify application belongs to user
        const [applications] = await pool.query(
            'SELECT id FROM admission_students WHERE id = ? AND login_id = ?',
            [applicationId, login_id]
        );

        if (applications.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Update payment status
        await pool.query(
            `UPDATE admission_students SET
        payment_status = 'paid',
        payment_id = ?,
        payment_date = CURRENT_TIMESTAMP()
       WHERE id = ?`,
            [paymentId, applicationId]
        );

        res.json({ success: true, message: 'Payment confirmed successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to confirm payment' });
    }
};

// Get payment receipt
const getPaymentReceipt = async (req, res) => {
    try {
        const [applications] = await pool.query(
            `SELECT s.id, s.name, s.applying_for, s.payment_date,
              l.email, l.mobile
       FROM admission_students s
       JOIN admission_login l ON s.login_id = l.id
       WHERE s.login_id = ? AND s.payment_status = 'paid'`,
            [req.user.id]
        );

        if (applications.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No payment found'
            });
        }

        const application = applications[0];
        const receiptDetails = {
            receipt_number: `SPSSVMIC-${application.id.toString().padStart(6, '0')}`,
            payment_date: application.payment_date,
            amount: 100,
            payment_mode: 'Online',
            purpose: 'Admission Application Fee'
        };

        res.json({
            success: true,
            receipt: { ...application, ...receiptDetails }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to get receipt' });
    }
};

module.exports = {
    createPaymentIntent,
    confirmPayment,
    getPaymentReceipt
};