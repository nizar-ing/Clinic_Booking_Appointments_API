const {Router} = require('express');

const servicesController = require('./services.controller');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const {createServiceSchema, updateServiceSchema} = require('./services.validation');

const router = Router();

router.get('/', servicesController.getAllServices);

router.get('/:id', servicesController.getServiceById);

router.post(
    '/',
    [authenticate, authorize('ADMIN'), validate(createServiceSchema)],
    servicesController.createService
);

router.patch(
    '/:id',
    [authenticate, authorize('ADMIN'), validate(updateServiceSchema)],
    servicesController.updateService
);



router.delete('/:id', [authenticate, authorize('ADMIN')], servicesController.deleteService);

module.exports = router;