const { Router } = require('express');

const doctorController = require('./doctors.controller');
const validate = require('../../middlewares/validate.middleware');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const { createDoctorSchema, updateDoctorSchema } = require('./doctors.validation');

const router = Router();

/**
 * @openapi
 * /api/doctors:
 *   get:
 *     tags: [Doctors]
 *     summary: List all doctors
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Case-insensitive search on doctor name
 *       - in: query
 *         name: specialization
 *         schema: { type: string }
 *         description: Case-insensitive filter by specialization
 *     responses:
 *       200:
 *         description: Paginated list of doctors
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
 *                   example: 5
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Doctor'
 */
router.get('/', doctorController.getAllDoctors);

/**
 * @openapi
 * /api/doctors/{id}:
 *   get:
 *     tags: [Doctors]
 *     summary: Get a doctor by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Doctor UUID
 *     responses:
 *       200:
 *         description: Doctor details including slot and appointment counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Doctor'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', doctorController.getDoctorById);

/**
 * @openapi
 * /api/doctors:
 *   post:
 *     tags: [Doctors]
 *     summary: Create a new doctor (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, specialization, email]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: Dr. Bob Carter
 *               specialization:
 *                 type: string
 *                 minLength: 2
 *                 example: Orthopedics
 *               bio:
 *                 type: string
 *                 example: Specialist in bone and joint disorders.
 *               email:
 *                 type: string
 *                 format: email
 *                 example: bob.carter@clinic.com
 *               phone:
 *                 type: string
 *                 example: '+1-555-0200'
 *     responses:
 *       201:
 *         description: Doctor created
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
 *                   example: Doctor created successfully.
 *                 data:
 *                   $ref: '#/components/schemas/Doctor'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post(
    '/',
    [authenticate, authorize('ADMIN'), validate(createDoctorSchema)],
    doctorController.createDoctor
);

/**
 * @openapi
 * /api/doctors/{id}:
 *   patch:
 *     tags: [Doctors]
 *     summary: Update a doctor (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Doctor UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *               specialization:
 *                 type: string
 *               bio:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Doctor updated
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
 *                   example: Doctor updated successfully.
 *                 data:
 *                   $ref: '#/components/schemas/Doctor'
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
router.patch(
    '/:id',
    [authenticate, authorize('ADMIN'), validate(updateDoctorSchema)],
    doctorController.updateDoctor
);

/**
 * @openapi
 * /api/doctors/{id}:
 *   delete:
 *     tags: [Doctors]
 *     summary: Delete a doctor (Admin only)
 *     description: Cascades deletion to all associated time slots.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Doctor UUID
 *     responses:
 *       200:
 *         description: Doctor deleted
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
 *                   example: Doctor deleted successfully.
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete(
    '/:id',
    [authenticate, authorize('ADMIN')],
    doctorController.deleteDoctor
);

module.exports = router;
