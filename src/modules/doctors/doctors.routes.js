const {Router} = require('express');

const doctorController = require('./doctors.controller');
const validate = require('../../middlewares/validate.middleware');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const {createDoctorSchema, updateDoctorSchema} = require('./doctors.validation');

const router = Router();

router.get('/', doctorController.getAllDoctors);

router.get('/:id', doctorController.getDoctorById);

router.post(
    '/',
    [authenticate, authorize('ADMIN'), validate(createDoctorSchema)],
    doctorController.createDoctor
);


router.patch(
    '/:id',
    [authenticate, authorize('ADMIN'), validate(updateDoctorSchema)],
    doctorController.updateDoctor
);


router.delete(
    '/:id',
    [authenticate, authorize('ADMIN')],
    doctorController.deleteDoctor
);

module.exports = router;