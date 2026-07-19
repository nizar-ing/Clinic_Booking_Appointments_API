const jwt = require('jsonwebtoken');

const AppError = require('../utils/AppError');
const env = require('../config/env');
const prisma = require('../config/prisma-client');


// Middleware to protect routes - verifies JWT token
const authenticate = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new AppError('Access denied. No token provided.', 401));
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, env.JWT_SECRET);

        // Find user in database
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, name: true, email: true, role: true },
        });

        if (!user) {
            return next(new AppError('User not found.', 401));
        }

        // Attach user to request object
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(new AppError('Invalid token.', 401));
        }
        if (error.name === 'TokenExpiredError') {
            return next(new AppError('Token expired.', 401));
        }
        next(error);
    }
};

module.exports = authenticate;