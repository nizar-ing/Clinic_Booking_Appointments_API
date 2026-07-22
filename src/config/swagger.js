const swaggerJsdoc = require('swagger-jsdoc');
const env = require('./env');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Clinic Booking API',
            version: '1.0.0',
            description: 'REST API for the Clinic Booking & Appointment System',
        },
        servers: [
            {
                url: `http://localhost:${env.PORT}`,
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id:        { type: 'string', format: 'uuid' },
                        name:      { type: 'string', example: 'Jane Smith' },
                        email:     { type: 'string', format: 'email', example: 'jane@example.com' },
                        role:      { type: 'string', enum: ['PATIENT', 'ADMIN'] },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                Doctor: {
                    type: 'object',
                    properties: {
                        id:             { type: 'string', format: 'uuid' },
                        name:           { type: 'string', example: 'Dr. Alice Johnson' },
                        specialization: { type: 'string', example: 'Cardiology' },
                        bio:            { type: 'string', nullable: true, example: 'Experienced cardiologist.' },
                        email:          { type: 'string', format: 'email', example: 'alice@clinic.com' },
                        phone:          { type: 'string', nullable: true, example: '+1-555-0100' },
                        imageUrl:       { type: 'string', nullable: true },
                        createdAt:      { type: 'string', format: 'date-time' },
                        updatedAt:      { type: 'string', format: 'date-time' },
                    },
                },
                ClinicService: {
                    type: 'object',
                    properties: {
                        id:              { type: 'string', format: 'uuid' },
                        name:            { type: 'string', example: 'General Consultation' },
                        description:     { type: 'string', nullable: true, example: 'Standard 30-minute consultation.' },
                        price:           { type: 'number', format: 'float', example: 75.00 },
                        durationMinutes: { type: 'integer', example: 30 },
                        createdAt:       { type: 'string', format: 'date-time' },
                        updatedAt:       { type: 'string', format: 'date-time' },
                    },
                },
                DoctorSlot: {
                    type: 'object',
                    properties: {
                        id:        { type: 'string', format: 'uuid' },
                        doctorId:  { type: 'string', format: 'uuid' },
                        date:      { type: 'string', format: 'date-time', example: '2026-08-15T00:00:00.000Z' },
                        startTime: { type: 'string', example: '09:00' },
                        endTime:   { type: 'string', example: '09:30' },
                        isBooked:  { type: 'boolean', example: false },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                Appointment: {
                    type: 'object',
                    properties: {
                        id:           { type: 'string', format: 'uuid' },
                        patientId:    { type: 'string', format: 'uuid' },
                        doctorId:     { type: 'string', format: 'uuid' },
                        serviceId:    { type: 'string', format: 'uuid' },
                        slotId:       { type: 'string', format: 'uuid' },
                        status:       { type: 'string', enum: ['BOOKED', 'CANCELLED', 'COMPLETED'] },
                        notes:        { type: 'string', nullable: true, example: 'Patient has a nut allergy.' },
                        reminderSent: { type: 'boolean' },
                        createdAt:    { type: 'string', format: 'date-time' },
                        updatedAt:    { type: 'string', format: 'date-time' },
                    },
                },
                Pagination: {
                    type: 'object',
                    properties: {
                        page:       { type: 'integer', example: 1 },
                        limit:      { type: 'integer', example: 20 },
                        total:      { type: 'integer', example: 100 },
                        totalPages: { type: 'integer', example: 5 },
                    },
                },
                SummaryReport: {
                    type: 'object',
                    properties: {
                        totalAppointments: { type: 'integer', example: 320 },
                        bookedCount:       { type: 'integer', example: 150 },
                        cancelledCount:    { type: 'integer', example: 40 },
                        completedCount:    { type: 'integer', example: 130 },
                        todayAppointments: { type: 'integer', example: 12 },
                        cancellationRate:  { type: 'string', example: '12.5%' },
                        totalRevenue:      { type: 'number', example: 24000.00 },
                        totalDoctors:      { type: 'integer', example: 8 },
                        totalPatients:     { type: 'integer', example: 200 },
                        totalServices:     { type: 'integer', example: 15 },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string', example: 'An error occurred.' },
                        errors: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    field:   { type: 'string' },
                                    message: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                ValidationError: {
                    description: 'Validation failed',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                success: false,
                                message: 'Validation failed',
                                errors: [{ field: 'email', message: 'Invalid email address' }],
                            },
                        },
                    },
                },
                Unauthorized: {
                    description: 'Missing or invalid JWT token',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: { success: false, message: 'No token provided.' },
                        },
                    },
                },
                Forbidden: {
                    description: 'Insufficient role permissions',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: { success: false, message: 'Access denied.' },
                        },
                    },
                },
                NotFound: {
                    description: 'Resource not found',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: { success: false, message: 'Resource not found.' },
                        },
                    },
                },
                Conflict: {
                    description: 'Unique constraint violation',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: { success: false, message: 'A record with this value already exists.' },
                        },
                    },
                },
            },
        },
        tags: [
            { name: 'Health',          description: 'API health check' },
            { name: 'Auth',            description: 'Authentication & profile management' },
            { name: 'Doctors',         description: 'Doctor management' },
            { name: 'Clinic Services', description: 'Clinic services & pricing' },
            { name: 'Slots',           description: 'Doctor time slot management' },
            { name: 'Appointments',    description: 'Appointment booking & management' },
            { name: 'Admin',           description: 'Admin-only operations' },
        ],
    },
    apis: ['./src/modules/**/*.routes.js', './src/app.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
