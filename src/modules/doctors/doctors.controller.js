const asyncHandler = require('../../utils/asyncHandler');
const doctorService = require('./doctors.service');


// GET /api/doctors?page=1&limit=10&search=ahmed&specialization=cardiology
const getAllDoctors = asyncHandler(async (req, res) => {
    const result = await doctorService.getAllDoctors(req.query);

    res.status(200).json({
        success: true,
        count: result.doctors.length,
        pagination: result.pagination,
        data: result.doctors,
    });
});

// GET /api/doctors/:id
const getDoctorById = asyncHandler(async (req, res) => {
    const doctor = await doctorService.getDoctorById(req.params.id);

    res.status(200).json({
        success: true,
        data: doctor,
    });
});

// POST /api/doctors
const createDoctor = asyncHandler(async (req, res) => {
    const doctor = await doctorService.createDoctor(req.body);

    res.status(201).json({
        success: true,
        message: 'Doctor created successfully.',
        data: doctor,
    });
});

// PATCH /api/doctors/:id
const updateDoctor = asyncHandler(async (req, res) => {
    const doctor = await doctorService.updateDoctor(req.params.id, req.body);

    res.status(200).json({
        success: true,
        message: 'Doctor updated successfully.',
        data: doctor,
    });
});

// DELETE /api/doctors/:id
const deleteDoctor = asyncHandler(async (req, res) => {
    const result = await doctorService.deleteDoctor(req.params.id);

    res.status(200).json({
        success: true,
        message: result.message,
    });
});

module.exports = { getAllDoctors, getDoctorById, createDoctor, updateDoctor, deleteDoctor };
