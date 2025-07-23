const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Submit admission application
router.post('/submit', async (req, res) => {
    try {
        const {
            name, email, mobile, password,
            dob, fatherName, fatherOccupation,
            motherName, motherOccupation, lastClass,
            lastSchool, lastClassPercentage, address,
            applyFor, subjects
        } = req.body;

        // Start transaction
        await db.query('START TRANSACTION');

        // Create user
        const [userResult] = await db.query(
            'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
            [email, password, 'student']
        );

        const userId = userResult.insertId;

        // Create admission application
        await db.query(
            `INSERT INTO admissions (
        user_id, name, dob, father_name, father_occupation,
        mother_name, mother_occupation, last_class, last_school,
        last_percentage, address, applying_for, subjects
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId, name, dob, fatherName, fatherOccupation,
                motherName, motherOccupation, lastClass, lastSchool,
                lastClassPercentage, address, applyFor, JSON.stringify(subjects)
            ]
        );

        // Commit transaction
        await db.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Application submitted successfully'
        });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Failed to submit application'
        });
    }
});

// Get admission status
router.get('/status/:email', async (req, res) => {
    try {
        const { email } = req.params;

        const [results] = await db.query(
            `SELECT a.* FROM admissions a
       JOIN users u ON a.user_id = u.id
       WHERE u.email = ?`,
            [email]
        );

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No application found'
            });
        }

        res.json({
            success: true,
            application: results[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch application status'
        });
    }
});

module.exports = router;