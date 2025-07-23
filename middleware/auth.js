const jwt = require('jsonwebtoken');

const auth = (role) => {
    return (req, res, next) => {
        try {
            const token = req.header('Authorization')?.replace('Bearer ', '');

            if (!token) {
                return res.status(401).json({ success: false, message: 'No token, authorization denied' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');

            if (role && decoded.role !== role) {
                return res.status(403).json({ success: false, message: 'Unauthorized access' });
            }

            req.user = decoded;
            next();
        } catch (err) {
            console.error(err);
            res.status(401).json({ success: false, message: 'Token is not valid' });
        }
    };
};

module.exports = auth;
