const asyncHandler = require('../../utils/asyncHandler');
const authService = require('../../modules/auth/auth.service');

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);

    res.status(201).json({
        success: true,
        message: 'Registration successful.',
        data: result,
    });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);

    res.status(200).json({
        success: true,
        message: 'Login successful.',
        data: result,
    });
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
    const user = await authService.getMe(req.user.id);

    res.status(200).json({
        success: true,
        data: user,
    });
});

// PATCH /api/auth/profile
const updateProfile = asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(req.user.id, req.body);

    res.status(200).json({
        success: true,
        message: 'Profile updated successfully.',
        data: user,
    });
});

// PATCH /api/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
    const result = await authService.changePassword(req.user.id, req.body);

    res.status(200).json({
        success: true,
        message: result.message,
    });
});

module.exports = { register, login, getMe, updateProfile, changePassword };
