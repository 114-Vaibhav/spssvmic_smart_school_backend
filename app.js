const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./config/db');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const adStudentRoutes = require('./routes/adStudent');
const facultyRoutes = require('./routes/faculty');
const admissionRoutes = require('./routes/admissionRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
// const studentRoutes = require('./routes/student');
require('dotenv').config();


// Mount webhook BEFORE express.json()
const app = express();
app.post('/api/student/webhook', express.raw({ type: 'application/json' }), studentRoutes);


// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api/auth', authRoutes);

app.use('/api/student', studentRoutes);
app.use('/api/adStudent', adStudentRoutes);
app.use('/api/faculty', facultyRoutes);


// Routes
// app.use('/api/auth', authRoutes);
app.use('/api/admission', admissionRoutes);
// app.use('/api/faculty', facultyRoutes);
// app.use('/api/academic', academicRoutes);


// app.use('/api/admission', admissionRoutes);
app.use('/api/payment', paymentRoutes);


// Test DB connection
app.get('/test-db', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1 + 1 AS solution');
        console.log("Database connection successful")
        res.json({ message: 'Database connection successful', solution: rows[0].solution });
    } catch (err) {
        console.log(err.message)
        res.status(500).json({ error: err.message });
    }
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});