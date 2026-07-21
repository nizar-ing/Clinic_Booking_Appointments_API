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

router.get('/my', authenticate, appointmentController.getMyAppointments);

router.get('/:id', authenticate, appointmentController.getAppointmentById);

router.patch(
    '/:id/cancel',
    [authenticate, validate(cancelAppointmentSchema)],
    appointmentController.cancelAppointment
);

module.exports = router;
