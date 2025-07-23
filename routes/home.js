const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Get student profile
router.get('/faculty', '', async (req, res) => {
    try {
        console.log(req.user.id)
        const [student] = await db.query(
            'SELECT * FROM faculty WHERE roll_no = ?',
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
router.get('/Organization', async (req, res) => {
    try {
        const [results] = await db.query(
            'SELECT * FROM results WHERE roll_no = ? ORDER BY academic_year DESC, exam_type',
            [req.user.id]
        );
        res.json({ success: true, results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


module.exports = router;