const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
    registerApplicant,
    loginApplicant,
    submitApplication,
    getApplication,
    updateApplication,
    getAdmitCard,
    getMeritList
} = require('../controllers/admissionController');

// Public routes
router.post('/register', registerApplicant);
router.post('/login', loginApplicant);

// Protected routes
router.post('/application', auth, submitApplication);
router.get('/application', auth, getApplication);
router.put('/application', auth, updateApplication);
router.get('/admit-card', auth, getAdmitCard);
router.get('/merit-list', auth, getMeritList);

module.exports = router;