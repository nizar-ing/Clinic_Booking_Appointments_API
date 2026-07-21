const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');


const authRoutes = require('./modules/auth/auth.routes');
const doctorsRoutes = require('./modules/doctors/doctors.routes');
const servicesRoutes = require('./modules/clinic-services/services.routes');
const slotsRoutes = require('./modules/time-slots/slots.routes');
const appointmentsRoutes = require('./modules/appointments/appointments.routes');

const notFoundMiddleware = require('./middlewares/notFound.middleware');
const errorMiddleware = require('./middlewares/error.middleware');
const { generalLimiter, authLimiter } = require('./middlewares/rateLimiter.middleware');

const app = express();

// Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Routes Middlewares
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/clinic-services', servicesRoutes);
app.use('/api/doctors/:doctorId/time-slots', slotsRoutes);
app.use('/api/appointments', appointmentsRoutes);

// --- General Rate Limiting ---
app.use('/api/', generalLimiter);

// Routes
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: "API is healthy"
    });
})

// Error Handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;