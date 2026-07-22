const { Router } = require('express');

const servicesController = require('./services.controller');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { createServiceSchema, updateServiceSchema } = require('./services.validation');

const router = Router();

/**
 * @openapi
 * /api/clinic-services:
 *   get:
 *     tags: [Clinic Services]
 *     summary: List all clinic services
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
 *         description: Case-insensitive search on service name
 *     responses:
 *       200:
 *         description: Paginated list of clinic services
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
 *                   example: 8
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ClinicService'
 */
router.get('/', servicesController.getAllServices);

/**
 * @openapi
 * /api/clinic-services/{id}:
 *   get:
 *     tags: [Clinic Services]
 *     summary: Get a clinic service by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Service UUID
 *     responses:
 *       200:
 *         description: Clinic service details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ClinicService'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', servicesController.getServiceById);

/**
 * @openapi
 * /api/clinic-services:
 *   post:
 *     tags: [Clinic Services]
 *     summary: Create a new clinic service (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price, durationMinutes]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: General Consultation
 *               description:
 *                 type: string
 *                 example: Standard 30-minute medical consultation.
 *               price:
 *                 type: number
 *                 format: float
 *                 minimum: 0.01
 *                 example: 75.00
 *               durationMinutes:
 *                 type: integer
 *                 minimum: 1
 *                 example: 30
 *     responses:
 *       201:
 *         description: Service created
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
 *                   example: Service created successfully.
 *                 data:
 *                   $ref: '#/components/schemas/ClinicService'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
    '/',
    [authenticate, authorize('ADMIN'), validate(createServiceSchema)],
    servicesController.createService
);

/**
 * @openapi
 * /api/clinic-services/{id}:
 *   patch:
 *     tags: [Clinic Services]
 *     summary: Update a clinic service (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Service UUID
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
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *                 format: float
 *                 minimum: 0.01
 *               durationMinutes:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Service updated
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
 *                   example: Service updated successfully.
 *                 data:
 *                   $ref: '#/components/schemas/ClinicService'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch(
    '/:id',
    [authenticate, authorize('ADMIN'), validate(updateServiceSchema)],
    servicesController.updateService
);

/**
 * @openapi
 * /api/clinic-services/{id}:
 *   delete:
 *     tags: [Clinic Services]
 *     summary: Delete a clinic service (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Service UUID
 *     responses:
 *       200:
 *         description: Service deleted
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
 *                   example: Service deleted successfully.
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', [authenticate, authorize('ADMIN')], servicesController.deleteService);

module.exports = router;
