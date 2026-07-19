const { Prisma } = require('@prisma/client');

// Transform Prisma errors into user-friendly messages
const handlePrismaError = (err) => {
    switch (err.code) {
        case 'P2002':
            // Unique constraint violation
            const field = err.meta?.target?.join(', ') || 'field';
            return { statusCode: 409, message: `A record with this ${field} already exists.` };

        case 'P2025':
            // Record not found
            return { statusCode: 404, message: 'Record not found.' };

        case 'P2003':
            // Foreign key constraint failed
            return { statusCode: 400, message: 'Related record not found. Check your references.' };

        case 'P2014':
            // Required relation violation
            return { statusCode: 400, message: 'This action violates a required relation.' };

        default:
            return { statusCode: 500, message: 'A database error occurred.' };
    }
};

// Centralized error handling middleware
const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Handle Prisma known request errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        const prismaError = handlePrismaError(err);
        statusCode = prismaError.statusCode;
        message = prismaError.message;
    }

    // Handle Prisma validation errors
    if (err instanceof Prisma.PrismaClientValidationError) {
        statusCode = 400;
        message = 'Invalid data provided. Please check your input.';
    }

    const response = {
        success: false,
        message,
    };

    // Include validation errors if present
    if (err.errors) {
        response.errors = err.errors;
    }

    // Include request ID for tracing
    if (req.id) {
        response.requestId = req.id;
    }

    // Show stack trace only in development
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    console.error(`❌ [${req.id || 'no-id'}] Error: ${message}`);

    res.status(statusCode).json(response);
};

module.exports = errorHandler;
