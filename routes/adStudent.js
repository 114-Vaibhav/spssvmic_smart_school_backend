const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const tmp = require('../middleware/tmp');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

router.get('/profile', tmp, async (req, res) => {
    console.log("inside profile route", req.user)
    try {
        console.log(req.user.userId)
        const [student] = await db.query(
            'SELECT * FROM admission_login WHERE id = ?',
            [req.user.userId]
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

// Submit/Update Application
router.post('/application', tmp, upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'aadhaar', maxCount: 1 }
]), async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            name, dob, father_name, father_occupation, mother_name, mother_occupation,
            last_class, last_school, last_percentage, address, applying_for, subjects
        } = req.body;

        const photoPath = req.files['photo'] ? req.files['photo'][0].path : null;
        const aadhaarPath = req.files['aadhaar'] ? req.files['aadhaar'][0].path : null;

        // Check if application already exists
        const [existingApps] = await pool.query(
            'SELECT * FROM admission_students WHERE user_id = ?',
            [userId]
        );

        if (existingApps.length > 0) {
            // Update existing application
            await pool.query(
                `UPDATE admission_students SET 
                name = ?, dob = ?, father_name = ?, father_occupation = ?, mother_name = ?, 
                mother_occupation = ?, last_class = ?, last_school = ?, last_percentage = ?, 
                address = ?, applying_for = ?, subjects = ?, photo_path = ?, aadhaar_path = ?, 
                status = 'submitted', updated_at = CURRENT_TIMESTAMP 
                WHERE user_id = ?`,
                [
                    name, dob, father_name, father_occupation, mother_name, mother_occupation,
                    last_class, last_school, last_percentage, address, applying_for, subjects,
                    photoPath, aadhaarPath, userId
                ]
            );
            return res.json({ message: 'Application updated successfully' });
        } else {
            // Create new application
            await pool.query(
                `INSERT INTO admission_students (
                    user_id, name, dob, father_name, father_occupation, mother_name, 
                    mother_occupation, last_class, last_school, last_percentage, address, 
                    applying_for, subjects, photo_path, aadhaar_path, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
                [
                    userId, name, dob, father_name, father_occupation, mother_name,
                    mother_occupation, last_class, last_school, last_percentage, address,
                    applying_for, subjects, photoPath, aadhaarPath
                ]
            );
            return res.status(201).json({ message: 'Application submitted successfully' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Application
router.get('/application', tmp, async (req, res) => {
    try {
        const userId = req.user.id;

        const [applications] = await pool.query(
            'SELECT * FROM admission_students WHERE user_id = ?',
            [userId]
        );

        if (applications.length === 0) {
            return res.status(404).json({ message: 'No application found' });
        }

        const application = applications[0];

        // Remove sensitive paths
        if (application.photo_path) {
            application.photo_url = `${req.protocol}://${req.get('host')}/${application.photo_path}`;
        }
        if (application.aadhaar_path) {
            application.aadhaar_url = `${req.protocol}://${req.get('host')}/${application.aadhaar_path}`;
        }

        res.json(application);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Payment
router.post('/payment', tmp, async (req, res) => {
    try {
        const userId = req.user.id;
        const { paymentMethodId } = req.body;

        // Check if application exists and is submitted
        const [applications] = await pool.query(
            'SELECT * FROM admission_students WHERE user_id = ? AND status = "submitted"',
            [userId]
        );

        if (applications.length === 0) {
            return res.status(400).json({ message: 'No submitted application found' });
        }

        const application = applications[0];

        // Create payment intent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 10000, // 100 INR in paise
            currency: 'inr',
            payment_method: paymentMethodId,
            confirm: true,
            description: `Application fee for ${application.name}`,
            metadata: {
                student_id: application.id,
                user_id: userId
            }
        });

        if (paymentIntent.status === 'succeeded') {
            // Update application status
            await pool.query(
                'UPDATE admission_students SET payment_status = "completed", payment_id = ?, payment_date = NOW() WHERE id = ?',
                [paymentIntent.id, application.id]
            );

            // Record payment
            await pool.query(
                'INSERT INTO admission_payments (user_id, student_id, amount, stripe_payment_id, status, receipt_url) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    userId,
                    application.id,
                    100,
                    paymentIntent.id,
                    paymentIntent.status,
                    paymentIntent.charges.data[0].receipt_url
                ]
            );

            return res.json({
                success: true,
                receipt_url: paymentIntent.charges.data[0].receipt_url
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Payment failed'
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Admit Card
router.get('/admit-card', tmp, async (req, res) => {
    try {
        const userId = req.user.id;

        const [applications] = await pool.query(
            `SELECT s.*, l.email, l.mobile 
             FROM admission_students s 
             JOIN admission_login l ON s.user_id = l.id 
             WHERE s.user_id = ? AND s.payment_status = 'completed'`,
            [userId]
        );

        if (applications.length === 0) {
            return res.status(404).json({ message: 'No completed application found' });
        }

        const application = applications[0];

        // Generate exam details (you can customize this)
        const examDetails = {
            exam_date: '2023-06-15',
            exam_time: '10:00 AM',
            exam_center: 'SPSSVMIC Main Campus',
            exam_center_address: '123 School Street, City, State - 123456',
            roll_number: `SPSSV${application.id.toString().padStart(4, '0')}`
        };

        res.json({
            student: application,
            exam: examDetails
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Merit List
router.get('/merit-list', tmp, async (req, res) => {
    try {
        const userId = req.user.id;

        const [meritList] = await pool.query(
            `SELECT m.*, s.name, s.applying_for 
             FROM admission_merit_list m 
             JOIN admission_students s ON m.student_id = s.id 
             WHERE s.user_id = ?`,
            [userId]
        );

        if (meritList.length === 0) {
            return res.status(404).json({ message: 'Merit list not available yet' });
        }

        res.json(meritList[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;