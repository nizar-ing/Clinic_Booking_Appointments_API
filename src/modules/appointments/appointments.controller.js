const asyncHandler = require('../../utils/asyncHandler');
const appointmentService = require('./appointments.service');

// POST /api/appointments
const createAppointment = asyncHandler(async (req, res) => {
    const appointment = await appointmentService.createAppointment(req.user.id, req.body);

    res.status(201).json({
        success: true,
        message: 'Appointment booked successfully.',
        data: appointment,
    });
});

// GET /api/appointments/my?status=BOOKED
const getMyAppointments = asyncHandler(async (req, res) => {
    const appointments = await appointmentService.getMyAppointments(req.user.id, req.query);

    res.status(200).json({
        success: true,
        count: appointments.length,
        data: appointments,
    });
});

// GET /api/appointments/:id
const getAppointmentById = asyncHandler(async (req, res) => {
    const appointment = await appointmentService.getAppointmentById(
        req.params.id,
        req.user.id,
        req.user.role
    );

    res.status(200).json({
        success: true,
        data: appointment,
    });
});

// PATCH /api/appointments/:id/cancel
const cancelAppointment = asyncHandler(async (req, res) => {
    const appointment = await appointmentService.cancelAppointment(req.params.id, req.user.id);

    res.status(200).json({
        success: true,
        message: 'Appointment cancelled successfully.',
        data: appointment,
    });
});

// GET /api/admin/appointments?page=1&status=BOOKED&from=2025-01-01&to=2025-12-31&doctorId=xxx
const getAllAppointments = asyncHandler(async (req, res) => {
    const result = await appointmentService.getAllAppointments(req.query);

    res.status(200).json({
        success: true,
        count: result.appointments.length,
        pagination: result.pagination,
        data: result.appointments,
    });
});

// GET /api/admin/reports/summary
const getSummaryReport = asyncHandler(async (req, res) => {
    const report = await appointmentService.getSummaryReport();

    res.status(200).json({
        success: true,
        data: report,
    });
});

// PATCH /api/admin/appointments/:id/complete
const completeAppointment = asyncHandler(async (req, res) => {
    const appointment = await appointmentService.completeAppointment(req.params.id);

    res.status(200).json({
        success: true,
        message: 'Appointment marked as completed.',
        data: appointment,
    });
});

module.exports = {
    createAppointment,
    getMyAppointments,
    getAppointmentById,
    cancelAppointment,
    completeAppointment,
    getAllAppointments,
    getSummaryReport,
};
