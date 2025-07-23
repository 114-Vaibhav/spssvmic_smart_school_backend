require('dotenv').config();

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create Stripe Checkout session and handle payment confirmation
// router.post('/pay-fees', auth('student'), async (req, res) => {
//     console.log('[pay-fees] Request received:', {
//         userId: req.user.id,
//         fee_id: req.body.fee_id,
//         amount: req.body.amount,
//     });


//     try {
//         const { fee_id, amount } = req.body;

//         if (!fee_id || !amount) {
//             console.warn('[pay-fees] Missing fee_id or amount');
//             return res.status(400).json({ success: false, message: 'fee_id and amount are required' });
//         }

//         // Validate fee exists and belongs to user
//         const [fees] = await db.query(
//             'SELECT * FROM fees WHERE id = ? AND roll_no = ?',
//             [fee_id, req.user.id]
//         );

//         if (fees.length === 0) {
//             console.warn(`[pay-fees] Fee not found or does not belong to user. fee_id: ${fee_id}, userId: ${req.user.id}`);
//             return res.status(404).json({ success: false, message: 'Fee record not found' });
//         }

//         // Create Stripe Checkout session
//         console.log('[pay-fees] Creating Stripe checkout session...');
//         const session = await stripe.checkout.sessions.create({
//             payment_method_types: ['card'],
//             line_items: [
//                 {
//                     price_data: {
//                         currency: 'inr',
//                         product_data: { name: 'Fee payment' },
//                         unit_amount: Math.round(amount * 100), // amount in paise
//                     },
//                     quantity: 1,
//                 },
//             ],
//             mode: 'payment',
//             success_url: `${process.env.success_url}?session_id={CHECKOUT_SESSION_ID}&fee_id=${fee_id}`,
//             cancel_url: `${process.env.cancel_url}`,
//             metadata: {
//                 fee_id: fee_id.toString(),
//                 student_id: req.user.id.toString(),
//                 amount: amount.toString(),
//             },
//             client_reference_id: `${req.user.id}_${fee_id}`,
//         });

//         console.log('[pay-fees] Stripe session created successfully:', session.id);
//         return res.json({ id: session.id });

//     } catch (error) {
//         console.error('[pay-fees] Error creating Stripe session:', error);
//         return res.status(500).json({ success: false, message: 'Payment failed' });
//     }
// });
router.post('/pay-fees', auth('student'), async (req, res) => {
    console.log('[pay-fees] Request received:', {
        userId: req.user.id,
        fee_id: req.body.fee_id,
        amount: req.body.amount,
    });


    try {
        const { fee_id, amount } = req.body;

        if (!fee_id || !amount) {
            console.warn('[pay-fees] Missing fee_id or amount');
            return res.status(400).json({ success: false, message: 'fee_id and amount are required' });
        }

        // Validate fee exists and belongs to user
        const [fees] = await db.query(
            'SELECT * FROM fees WHERE id = ? AND roll_no = ?',
            [fee_id, req.user.id]
        );

        if (fees.length === 0) {
            console.warn(`[pay-fees] Fee not found or does not belong to user. fee_id: ${fee_id}, userId: ${req.user.id}`);
            return res.status(404).json({ success: false, message: 'Fee record not found' });
        }

        // Create Stripe Checkout session
        console.log('[pay-fees] Creating Stripe checkout session...');
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'inr',
                        product_data: { name: 'Fee payment' },
                        unit_amount: Math.round(amount * 100), // amount in paise
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}&fee_id=${fee_id}`,
            cancel_url: `${process.env.CANCEL_URL}`,
            metadata: {
                fee_id: fee_id.toString(),
                student_id: req.user.id.toString(),
                amount: amount.toString(),
            },
            client_reference_id: `${req.user.id}_${fee_id}`,
        });

        console.log('[pay-fees] Stripe session created successfully:', session.id);
        return res.json({ id: session.id });

    } catch (error) {
        console.error('[pay-fees] Error creating Stripe session:', error);
        return res.status(500).json({ success: false, message: 'Payment failed' });
    }
});

// Endpoint to confirm payment and update database
router.get('/confirm-payment', auth('student'), async (req, res) => {
    try {
        const { session_id, fee_id } = req.query;

        if (!session_id || !fee_id) {
            return res.status(400).json({ success: false, message: 'session_id and fee_id are required' });
        }

        // Retrieve the Stripe session
        const session = await stripe.checkout.sessions.retrieve(session_id);

        // Verify the session is paid and belongs to this user
        if (session.payment_status !== 'paid' || session.metadata.student_id !== req.user.id.toString()) {
            return res.status(400).json({ success: false, message: 'Invalid payment session' });
        }

        // Verify the fee_id matches
        if (session.metadata.fee_id !== fee_id.toString()) {
            return res.status(400).json({ success: false, message: 'Fee ID mismatch' });
        }

        const amount = parseFloat(session.metadata.amount);

        // Fetch fee from DB
        const [fees] = await db.query(
            'SELECT * FROM fees WHERE id = ? AND roll_no = ?',
            [fee_id, req.user.id]
        );

        if (fees.length === 0) {
            console.warn(`[confirm-payment] Fee not found or does not belong to student. fee_id: ${fee_id}, student_id: ${req.user.id}`);
            return res.status(404).json({ success: false, message: 'Fee record not found' });
        }

        const fee = fees[0];

        // Check if session_id already exists and matches
        if (fee.session_id === session_id) {
            // Payment already processed for this session
            console.log(`[confirm-payment] Payment already confirmed for session_id: ${session_id}, fee_id: ${fee_id}`);
            return res.json({ success: true, message: 'Payment already confirmed' });
        }

        // Otherwise, update payment record and session_id
        const newPaidAmount = (Number(fee.paid_amount || 0) + Number(amount));
        const newStatus = newPaidAmount >= fee.amount ? 'paid' : 'partial';

        await db.query(
            `UPDATE fees SET 
          paid_amount = ?, 
          payment_date = CURDATE(), 
          payment_method = ?, 
          transaction_id = ?, 
          status = ?, 
          session_id = ?
      WHERE id = ?`,
            [
                newPaidAmount,
                'online',
                session.payment_intent,
                newStatus,
                session_id,
                fee_id
            ]
        );

        console.log(`[confirm-payment] Fee payment updated for fee_id: ${fee_id}, student_id: ${req.user.id}, session_id: ${session_id}`);
        return res.json({ success: true, message: 'Payment confirmed and updated' });

    } catch (error) {
        console.error('[confirm-payment] Error:', error);
        return res.status(500).json({ success: false, message: 'Payment confirmation failed' });
    }
});



router.get('/profile', auth('student'), async (req, res) => {
    try {
        console.log(req.user.id)
        const [student] = await db.query(
            'SELECT * FROM students WHERE roll_no = ?',
            [req.user.id]
        );

        if (student.length === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        res.json({ success: true, student: student[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get student results
router.get('/results', auth('student'), async (req, res) => {
    try {
        const [results] = await db.query(
            'SELECT * FROM results WHERE roll_no = ? ORDER BY academic_year DESC, exam_type',
            [req.user.id]
        );
        // console.log(results)
        console.log("data sent")

        res.json({ success: true, results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get student attendance
router.get('/attendance', auth('student'), async (req, res) => {
    try {
        const { month, year } = req.query;

        let query = 'SELECT date, status FROM attendance WHERE roll_no = ?';
        const params = [req.user.id];

        if (month && year) {
            query += ' AND MONTH(date) = ? AND YEAR(date) = ?';
            params.push(month, year);
        }

        query += ' ORDER BY date DESC';

        const [attendance] = await db.query(query, params);

        res.json({ success: true, attendance });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get student fees
router.get('/fees', auth('student'), async (req, res) => {
    try {
        const [fees] = await db.query(
            `SELECT id, fee_type, amount, due_date, paid_amount, payment_date, 
            payment_method, status, academic_year 
            FROM fees WHERE roll_no = ? ORDER BY academic_year DESC, due_date`,
            [req.user.id]
        );

        res.json({ success: true, fees });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


module.exports = router;