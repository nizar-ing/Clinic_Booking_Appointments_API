const { Router } = require('express');

const appointmentController = require('./appointments.controller');
const validate = require('../../middlewares/validate.middleware');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const { createAppointmentSchema, cancelAppointmentSchema } = require('./appointments.validation');
const { bookingLimiter } = require('../../middlewares/rateLimiter.middleware');

const router = Router();

/**
 * @openapi
 * /api/appointments:
 *   post:
 *     tags: [Appointments]
 *     summary: Book a new appointment (Patient only)
 *     description: |
 *       Validates slot availability, guards against double-booking, and atomically
 *       marks the slot as taken. A confirmation email is sent after a successful booking.
 *       This endpoint is rate-limited.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [doctorId, serviceId, slotId]
 *             properties:
 *               doctorId:
 *                 type: string
 *                 format: uuid
 *               serviceId:
 *                 type: string
 *                 format: uuid
 *               slotId:
 *                 type: string
 *                 format: uuid
 *               notes:
 *                 type: string
 *                 example: I have a nut allergy.
 *     responses:
 *       201:
 *         description: Appointment booked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Appointment booked successfully.
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         description: Too many booking requests — rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
    '/',
    [authenticate, authorize('PATIENT'), bookingLimiter, validate(createAppointmentSchema)],
    appointmentController.createAppointment
);

/**
 * @openapi
 * /api/appointments/summary:
 *   get:
 *     tags: [Admin]
 *     summary: Get clinic-wide appointment statistics (Admin only)
 *     description: |
 *       Returns aggregated counts, today's bookings, total revenue from non-cancelled
 *       appointments, and cancellation rate.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Clinic summary report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/SummaryReport'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
// Must be declared before /:id to prevent "summary" being captured as an id param.
router.get('/summary', [authenticate, authorize('ADMIN')], appointmentController.getSummaryReport);

/**
 * @openapi
 * /api/appointments:
 *   get:
 *     tags: [Appointments]
 *     summary: List appointments (role-aware)
 *     description: |
 *       - **Patient** — returns only the caller's own appointments, filterable by `status`.
 *       - **Admin** — returns all appointments across every patient with full pagination and
 *         date-range / doctor filters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [BOOKED, CANCELLED, COMPLETED] }
 *         description: Filter by appointment status
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: "(Admin) Earliest slot date — ISO 8601 (e.g. 2026-08-01)"
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: "(Admin) Latest slot date — ISO 8601 (e.g. 2026-08-31)"
 *       - in: query
 *         name: doctorId
 *         schema: { type: string, format: uuid }
 *         description: "(Admin) Filter by doctor"
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: "(Admin) Page number"
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *         description: "(Admin) Items per page"
 *     responses:
 *       200:
 *         description: Appointments list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Appointment'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', authenticate, (req, res, next) => {
    if (req.user.role === 'ADMIN') {
        return appointmentController.getAllAppointments(req, res, next);
    }
    return appointmentController.getMyAppointments(req, res, next);
});

/**
 * @openapi
 * /api/appointments/my:
 *   get:
 *     tags: [Appointments]
 *     summary: List the authenticated patient's own appointments (Patient only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [BOOKED, CANCELLED, COMPLETED] }
 *         description: Filter by appointment status
 *     responses:
 *       200:
 *         description: Patient's appointments ordered by creation date descending
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Appointment'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/my', [authenticate, authorize('PATIENT')], appointmentController.getMyAppointments);

/**
 * @openapi
 * /api/appointments/{id}:
 *   get:
 *     tags: [Appointments]
 *     summary: Get an appointment by ID
 *     description: Patients can only access their own appointments; admins can access any.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Appointment UUID
 *     responses:
 *       200:
 *         description: Appointment details with doctor, service, slot, and patient info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', authenticate, appointmentController.getAppointmentById);

/**
 * @openapi
 * /api/appointments/{id}/cancel:
 *   patch:
 *     tags: [Appointments]
 *     summary: Cancel an appointment (Patient only)
 *     description: |
 *       Only the owning patient may cancel. The associated time slot is atomically
 *       released back to the available pool.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Appointment UUID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: Change of plans.
 *     responses:
 *       200:
 *         description: Appointment cancelled and slot released
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Appointment cancelled successfully.
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Appointment is already cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch(
    '/:id/cancel',
    [authenticate, authorize('PATIENT'), validate(cancelAppointmentSchema)],
    appointmentController.cancelAppointment
);

/**
 * @openapi
 * /api/appointments/{id}/complete:
 *   patch:
 *     tags: [Admin]
 *     summary: Mark an appointment as completed (Admin only)
 *     description: Only appointments with status `BOOKED` can be transitioned to `COMPLETED`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Appointment UUID
 *     responses:
 *       200:
 *         description: Appointment marked as completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Appointment marked as completed.
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Appointment is not in BOOKED status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/complete', [authenticate, authorize('ADMIN')], appointmentController.completeAppointment);

module.exports = router;
