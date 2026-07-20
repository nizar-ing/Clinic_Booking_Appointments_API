const prisma = require('../../config/prisma-client');
const AppError = require('../../utils/AppError');

// Get all clinic services with pagination and search
const getAllServices = async (query) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = query.search || '';

    const where = {};
    if (search) {
        where.name = { contains: search, mode: 'insensitive' };
    }

    const [services, total] = await Promise.all([
        prisma.clinicService.findMany({
            where,
            orderBy: { name: 'asc' },
            skip,
            take: limit,
        }),
        prisma.clinicService.count({ where }),
    ]);

    return {
        services,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

// Get service by ID
const getServiceById = async (id) => {
    const service = await prisma.clinicService.findUnique({
        where: { id },
        include: {
            _count: { select: { appointments: true } },
        },
    });
    if (!service) {
        throw new AppError('Service not found.', 404);
    }
    return service;
};

// Create a new clinic service (Admin only)
const createService = async (data) => {
    return prisma.clinicService.create({ data });
};

// Update a clinic service (Admin only)
const updateService = async (id, data) => {
    const service = await prisma.clinicService.findUnique({ where: { id } });
    if (!service) {
        throw new AppError('Service not found.', 404);
    }

    return prisma.clinicService.update({ where: { id }, data });
};

// Delete a clinic service (Admin only) - protect if active appointments exist
const deleteService = async (id) => {
    const service = await prisma.clinicService.findUnique({ where: { id } });
    if (!service) {
        throw new AppError('Service not found.', 404);
    }

    // Prevent deletion if service has active appointments
    const activeAppointments = await prisma.appointment.count({
        where: { serviceId: id, status: 'BOOKED' },
    });
    if (activeAppointments > 0) {
        throw new AppError(
            `Cannot delete service with ${activeAppointments} active appointment(s). Cancel them first.`,
            400
        );
    }

    await prisma.clinicService.delete({ where: { id } });
    return { message: 'Service deleted successfully.' };
};

module.exports = { getAllServices, getServiceById, createService, updateService, deleteService };
