// module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');



// const bcrypt = require('bcrypt');

// const hash = '$2b$10$qP4NuwPx4.FmgiLfh3lR0u9c/u10fIZv/RlAA.Cu6SZe6gX2k6YPG';
// const password = 'password';

// bcrypt.hash(password, 10, (err, hash) => {
//     if (err) throw err;
//     console.log('Hash:', hash);
// });

// bcrypt.compare(password, hash, (err, result) => {
//     if (err) throw err;
//     console.log('Password match:', result);  // true if matches
// });



// Student Login
router.post('/student-login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Extract roll_no from username (rollno@spssvmic)
        const roll_no = username.split('@')[0];

        // Validate roll_no format (7 digits)
        if (!/^\d{7}$/.test(roll_no)) {
            return res.status(400).json({ success: false, message: 'Invalid roll number format' });
        }

        const [students] = await db.query(
            'SELECT roll_no, name, class, email, mobile, photo, password FROM students WHERE roll_no = ?',
            [roll_no]
        );

        if (students.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const student = students[0];
        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            {
                id: student.roll_no,
                email: student.email,
                role: 'student',
                class: student.class
            },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '8h' }
        );

        // Remove password before sending response
        delete student.password;

        res.json({
            success: true,
            token,
            user: {
                ...student,
                role: 'student'
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// Faculty Login
router.post('/faculty-login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log("username: ", username);
        console.log("pass: ", password);
        const [faculty] = await db.query(
            'SELECT id, email, first_name, last_name, mobile, subject, qualification, joining_date, photo, password, is_admin FROM faculty WHERE email = ?',
            [username]
        );
        if (faculty.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const facultyMember = faculty[0];
        // console.log(facultyMember.password)
        const isMatch = await bcrypt.compare(password, facultyMember.password);
        console.log(isMatch);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            {
                id: facultyMember.id,
                email: facultyMember.email,
                role: 'faculty',
                isAdmin: facultyMember.is_admin,
                subject: facultyMember.subject
            },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '8h' }
        );

        // Remove password before sending response
        delete facultyMember.password;

        res.json({
            success: true,
            token,
            user: {
                ...facultyMember,
                name: `${facultyMember.first_name} ${facultyMember.last_name}`,
                role: 'faculty'
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});


// Registration
router.post('/register', async (req, res) => {
    try {
        const { name, email, mobile, password } = req.body;

        // Check if user already exists
        const [existingUser] = await pool.query(
            'SELECT * FROM admission_login WHERE email = ? OR mobile = ?',
            [email, mobile]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'User already exists with this email or mobile' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const [result] = await pool.query(
            'INSERT INTO admission_login (name, email, mobile, password) VALUES (?, ?, ?, ?)',
            [name, email, mobile, hashedPassword]
        );

        res.status(201).json({
            success: true, message: 'User registered successfully', userId: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        // console.log("looking for user")
        // Find user
        const [users] = await pool.query(
            'SELECT * FROM admission_login WHERE email = ?',
            [email]
        );
        // console.log(" user found ", users[0]);

        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = users[0];

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        // console.log(" pass matched ", users[0]);
        // Create JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            // process.env.JWT_SECRET,
            // { expiresIn: '1h' }
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '8h' }
        );
        // console.log(" create jwt ", users[0]);
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                mobile: user.mobile
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;