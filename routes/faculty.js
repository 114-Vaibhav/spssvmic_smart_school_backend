const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// faculty profile
router.get('/profile', auth('faculty'), async (req, res) => {
    try {
        // console.log("inside profile")
        // console.log(req.user.id)
        const [student] = await db.query(
            'SELECT * FROM faculty WHERE id = ?',
            [req.user.id]
        );

        if (student.length === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        // console.log(student[0]);
        // console.log("response sent")
        res.json({ success: true, faculty: student[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});



// Get student by roll no
router.get('/student/:roll_no', auth('faculty'), async (req, res) => {
    try {
        const [student] = await db.query(
            'SELECT roll_no, name, class, photo FROM students WHERE roll_no = ?',
            [req.params.roll_no]
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

// Update student result
router.post('/update-result', auth('faculty'), async (req, res) => {
    try {
        const { roll_no, exam_type, academic_year, ...marks } = req.body;

        // console.log(req.body)
        // Check if student exists

        const [students] = await db.query(
            'SELECT 1 FROM students WHERE roll_no = ?',
            [roll_no]
        );

        if (students.length === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Check if result already exists
        const [existing] = await db.query(
            'SELECT 1 FROM results WHERE roll_no = ? AND exam_type = ? AND academic_year = ?',
            [roll_no, exam_type, academic_year]
        );

        if (existing.length > 0) {
            // Update existing result
            await db.query(
                `UPDATE results SET 
         hindi = ?, english = ?, mathematics = ?, drawing = ?, 
         science = ?, social_science = ?, computer = ?, 
         physics = ?, chemistry = ?, biology = ? 
         WHERE roll_no = ? AND exam_type = ? AND academic_year = ?`,
                [
                    marks.hindi, marks.english, marks.mathematics, marks.drawing,
                    marks.science, marks.social_science, marks.computer,
                    marks.physics, marks.chemistry, marks.biology,
                    roll_no, exam_type, academic_year
                ]
            );
        } else {
            // Insert new result
            await db.query(
                `INSERT INTO results (
          roll_no, exam_type, academic_year, 
          hindi, english, mathematics, drawing, 
          science, social_science, computer, 
          physics, chemistry, biology
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    roll_no, exam_type, academic_year,
                    marks.hindi, marks.english, marks.mathematics, marks.drawing,
                    marks.science, marks.social_science, marks.computer,
                    marks.physics, marks.chemistry, marks.biology
                ]
            );
        }

        res.json({ success: true, message: 'Result updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to update result' });
    }
});

// Update attendance
router.post('/update-attendance', auth('faculty'), async (req, res) => {
    try {
        const { date, absent_roll_nos = [] } = req.body;

        // Mark absent students
        for (const roll_no of absent_roll_nos) {
            // Check if attendance already recorded for this date
            const [existing] = await db.query(
                'SELECT 1 FROM attendance WHERE roll_no = ? AND date = ?',
                [roll_no, date]
            );

            if (existing.length === 0) {
                await db.query(
                    'INSERT INTO attendance (roll_no, date, status, recorded_by) VALUES (?, ?, ?, ?)',
                    [roll_no, date, 'absent', req.user.email]
                );
            } else {
                await db.query(
                    'UPDATE attendance SET status = ?, recorded_by = ? WHERE roll_no = ? AND date = ?',
                    ['absent', req.user.email, roll_no, date]
                );
            }
        }

        res.json({ success: true, message: 'Attendance updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to update attendance' });
    }
});

// Update fees
router.post('/update-fees', auth('faculty'), async (req, res) => {
    try {
        const { roll_no, fee_type, amount, due_date, academic_year } = req.body;

        // Check if student exists
        const [students] = await db.query(
            'SELECT 1 FROM students WHERE roll_no = ?',
            [roll_no]
        );

        if (students.length === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        await db.query(
            'INSERT INTO fees (roll_no, fee_type, amount, due_date, academic_year, recorded_by) VALUES (?, ?, ?, ?, ?, ?)',
            [roll_no, fee_type, amount, due_date, academic_year, req.user.email]
        );

        res.json({ success: true, message: 'Fee record added successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to add fee record' });
    }
});

module.exports = router;