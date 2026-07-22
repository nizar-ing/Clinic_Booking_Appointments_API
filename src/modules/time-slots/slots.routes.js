const { Router } = require('express');

const slotController = require('./slots.controller');
const validate = require('../../middlewares/validate.middleware');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const { createSlotSchema } = require('./slots.validation');

// mergeParams: true exposes :doctorId from the parent /api/doctors/:doctorId route.
const router = Router({ mergeParams: true });

/**
 * @openapi
 * /api/doctors/{doctorId}/time-slots:
 *   post:
 *     tags: [Slots]
 *     summary: Create a time slot for a doctor (Admin only)
 *     description: |
 *       Slots must fall within working hours (08:00–18:00), cannot be dated in the past,
 *       and must not overlap with an existing slot for the same doctor.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Doctor UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, startTime, endTime]
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: '2026-08-15'
 *               startTime:
 *                 type: string
 *                 pattern: '^\d{2}:\d{2}$'
 *                 example: '09:00'
 *               endTime:
 *                 type: string
 *                 pattern: '^\d{2}:\d{2}$'
 *                 example: '09:30'
 *     responses:
 *       201:
 *         description: Slot created successfully
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
 *                   example: Slot created successfully.
 *                 data:
 *                   $ref: '#/components/schemas/DoctorSlot'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post(
    '/',
    [authenticate, authorize('ADMIN'), validate(createSlotSchema)],
    slotController.createSlot
);

/**
 * @openapi
 * /api/doctors/{doctorId}/time-slots:
 *   get:
 *     tags: [Slots]
 *     summary: List all time slots for a doctor
 *     description: Returns both booked and available slots, ordered by date then start time.
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Doctor UUID
 *     responses:
 *       200:
 *         description: All slots for the doctor
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
 *                   example: 12
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DoctorSlot'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/', slotController.getDoctorSlots);

/**
 * @openapi
 * /api/doctors/{doctorId}/time-slots/available:
 *   get:
 *     tags: [Slots]
 *     summary: List available (unbooked, future) time slots for a doctor
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Doctor UUID
 *     responses:
 *       200:
 *         description: Future unbooked slots
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
 *                   example: 7
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DoctorSlot'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/available', slotController.getAvailableSlots);

module.exports = router;
