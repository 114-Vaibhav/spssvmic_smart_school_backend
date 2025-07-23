const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register new admission applicant
const registerApplicant = async (req, res) => {
    try {
        const { name, email, mobile, password } = req.body;

        // Check if email already exists
        const [existing] = await pool.query(
            'SELECT id FROM admission_login WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert into database
        const [result] = await pool.query(
            'INSERT INTO admission_login (name, email, mobile, password) VALUES (?, ?, ?, ?)',
            [name, email, mobile, hashedPassword]
        );

        // Generate JWT token
        const token = jwt.sign(
            { id: result.insertId, email, role: 'applicant' },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            token,
            user: { id: result.insertId, name, email, mobile }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
};

// Login admission applicant
const loginApplicant = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const [users] = await pool.query(
            'SELECT id, name, email, mobile, password FROM admission_login WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: 'applicant' },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '7d' }
        );

        // Remove password before sending response
        delete user.password;

        res.json({
            success: true,
            token,
            user
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
};

// Submit application form
const submitApplication = async (req, res) => {
    try {
        const {
            name, dob, father_name, father_occupation,
            mother_name, mother_occupation, last_class,
            last_school, last_percentage, address,
            applying_for, subjects, photo
        } = req.body;

        const login_id = req.user.id;

        // Check if application already exists
        const [existing] = await pool.query(
            'SELECT id FROM admission_students WHERE login_id = ?',
            [login_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Application already submitted'
            });
        }

        // Insert application
        const [result] = await pool.query(
            `INSERT INTO admission_students (
        login_id, name, dob, father_name, father_occupation,
        mother_name, mother_occupation, last_class, last_school,
        last_percentage, address, applying_for, subjects, photo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                login_id, name, dob, father_name, father_occupation,
                mother_name, mother_occupation, last_class, last_school,
                last_percentage, address, applying_for, JSON.stringify(subjects), photo
            ]
        );

        res.status(201).json({
            success: true,
            applicationId: result.insertId,
            message: 'Application submitted successfully'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to submit application' });
    }
};

// Get application details
const getApplication = async (req, res) => {
    try {
        const [applications] = await pool.query(
            `SELECT s.*, l.email, l.mobile 
       FROM admission_students s
       JOIN admission_login l ON s.login_id = l.id
       WHERE s.login_id = ?`,
            [req.user.id]
        );

        if (applications.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        const application = applications[0];
        application.subjects = JSON.parse(application.subjects);

        res.json({ success: true, application });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to get application' });
    }
};

// Update application
const updateApplication = async (req, res) => {
    try {
        const {
            name, dob, father_name, father_occupation,
            mother_name, mother_occupation, last_class,
            last_school, last_percentage, address,
            applying_for, subjects, photo
        } = req.body;

        const login_id = req.user.id;

        // Check if application exists
        const [existing] = await pool.query(
            'SELECT id FROM admission_students WHERE login_id = ?',
            [login_id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Check if payment has been made (prevent updates after payment)
        const [app] = await pool.query(
            'SELECT payment_status FROM admission_students WHERE login_id = ?',
            [login_id]
        );

        if (app[0].payment_status === 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Cannot update application after payment'
            });
        }

        // Update application
        await pool.query(
            `UPDATE admission_students SET
        name = ?, dob = ?, father_name = ?, father_occupation = ?,
        mother_name = ?, mother_occupation = ?, last_class = ?,
        last_school = ?, last_percentage = ?, address = ?,
        applying_for = ?, subjects = ?, photo = ?
       WHERE login_id = ?`,
            [
                name, dob, father_name, father_occupation,
                mother_name, mother_occupation, last_class,
                last_school, last_percentage, address,
                applying_for, JSON.stringify(subjects), photo,
                login_id
            ]
        );

        res.json({ success: true, message: 'Application updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to update application' });
    }
};

// Get admit card
const getAdmitCard = async (req, res) => {
    try {
        const [applications] = await pool.query(
            `SELECT s.name, s.dob, s.father_name, s.applying_for, s.photo,
              l.email, l.mobile
       FROM admission_students s
       JOIN admission_login l ON s.login_id = l.id
       WHERE s.login_id = ? AND s.payment_status = 'paid'`,
            [req.user.id]
        );

        if (applications.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Admit card not available yet'
            });
        }

        const application = applications[0];

        // Generate exam details
        const examDetails = {
            exam_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            exam_time: '10:00 AM',
            exam_center: 'SPSSVMIC Main Campus',
            exam_duration: '2 Hours',
            instructions: [
                'Bring this admit card to the exam center',
                'Carry original ID proof',
                'Reporting time: 9:30 AM',
                'No electronic devices allowed'
            ]
        };

        res.json({
            success: true,
            admitCard: { ...application, ...examDetails }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to get admit card' });
    }
};

// Get merit list
const getMeritList = async (req, res) => {
    try {
        const [results] = await pool.query(
            `SELECT s.name, s.applying_for, r.marks, r.rank, r.status
       FROM admission_results r
       JOIN admission_students s ON r.student_id = s.id
       ORDER BY r.rank ASC
       LIMIT 100`
        );

        res.json({ success: true, meritList: results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to get merit list' });
    }
};

module.exports = {
    registerApplicant,
    loginApplicant,
    submitApplication,
    getApplication,
    updateApplication,
    getAdmitCard,
    getMeritList
};