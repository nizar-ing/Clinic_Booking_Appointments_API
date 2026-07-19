const { Router } = require('express');

const validate = require('../../middlewares/validate.middleware');
const authenticate = require('../../middlewares/auth.middleware');
const {
    registerSchema,
    loginSchema,
    updateProfileSchema,
    changePasswordSchema
} = require('../auth/auth.validation')
const authController = require('../auth/auth.controller');

const router = Router();

router.post('/register', validate(registerSchema), authController.register);

router.post('/login', validate(loginSchema), authController.login);

router.get('/me', authenticate, authController.getMe);

router.patch('/profile', [authenticate, validate(updateProfileSchema)], authController.updateProfile);

router.patch('/change-password', [authenticate, validate(changePasswordSchema)], authController.changePassword);



module.exports = router;