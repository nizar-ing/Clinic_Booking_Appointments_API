const { Router } = require('express');
const appointmentController = require('./appointments.controller');
const validate = require('../../middlewares/validate.middleware');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const { createAppointmentSchema, cancelAppointmentSchema } = require('./appointments.validation');
const { bookingLimiter } = require('../../middlewares/rateLimiter.middleware');

const router = Router();

router.post(
    '/',
    [authenticate, authorize('PATIENT'), bookingLimiter, validate(createAppointmentSchema)],
    appointmentController.createAppointment
);

// GET /summary must be declared before GET /:id to prevent "summary" being captured as an id param.
router.get('/summary', [authenticate, authorize('ADMIN')], appointmentController.getSummaryReport);

// Role-aware: admins get all appointments (paginated), patients get their own.
router.get('/', authenticate, (req, res, next) => {
    if (req.user.role === 'ADMIN') {
        return appointmentController.getAllAppointments(req, res, next);
    }
    return appointmentController.getMyAppointments(req, res, next);
});

router.get('/my', [authenticate, authorize('PATIENT')], appointmentController.getMyAppointments);

router.get('/:id', authenticate, appointmentController.getAppointmentById);

router.patch(
    '/:id/cancel',
    [authenticate, authorize('PATIENT'), validate(cancelAppointmentSchema)],
    appointmentController.cancelAppointment
);

router.patch('/:id/complete', [authenticate, authorize('ADMIN')], appointmentController.completeAppointment);

module.exports = router;
