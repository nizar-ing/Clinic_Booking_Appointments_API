const asyncHandler = require('../../utils/asyncHandler');
const serviceService = require('./services.service');

// GET /api/clinic-services?page=1&limit=10&search=dental
const getAllServices = asyncHandler(async (req, res) => {
    const result = await serviceService.getAllServices(req.query);

    res.status(200).json({
        success: true,
        count: result.services.length,
        pagination: result.pagination,
        data: result.services,
    });
});

// GET /api/clinic-services/:id
const getServiceById = asyncHandler(async (req, res) => {
    const service = await serviceService.getServiceById(req.params.id);

    res.status(200).json({
        success: true,
        data: service,
    });
});

// POST /api/clinic-services
const createService = asyncHandler(async (req, res) => {
    const service = await serviceService.createService(req.body);

    res.status(201).json({
        success: true,
        message: 'Service created successfully.',
        data: service,
    });
});

// PATCH /api/clinic-services/:id
const updateService = asyncHandler(async (req, res) => {
    const service = await serviceService.updateService(req.params.id, req.body);

    res.status(200).json({
        success: true,
        message: 'Service updated successfully.',
        data: service,
    });
});

// DELETE /api/clinic-services/:id
const deleteService = asyncHandler(async (req, res) => {
    const result = await serviceService.deleteService(req.params.id);

    res.status(200).json({
        success: true,
        message: result.message,
    });
});

module.exports = { getAllServices, getServiceById, createService, updateService, deleteService };
