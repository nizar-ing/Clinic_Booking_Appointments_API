const prisma = require('../../config/prisma-client');
const AppError = require('../../utils/AppError');


// Get all doctors with pagination and search
const getAllDoctors = async (query) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = query.search || '';
    const specialization = query.specialization || '';

    // Build filter conditions
    const where = {};
    if (search) {
        where.name = { contains: search, mode: 'insensitive' };
    }
    if (specialization) {
        where.specialization = { contains: specialization, mode: 'insensitive' };
    }

    const [doctors, total] = await Promise.all([
        prisma.doctor.findMany({
            where,
            orderBy: { name: 'asc' },
            skip,
            take: limit,
        }),
        prisma.doctor.count({ where }),
    ]);

    return {
        doctors,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

// Get doctor by ID including slot counts
const getDoctorById = async (id) => {
    const doctor = await prisma.doctor.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    slots: true,
                    appointments: true,
                },
            },
        },
    });
    if (!doctor) {
        throw new AppError('Doctor not found.', 404);
    }
    return doctor;
};

// Create a new doctor (Admin only)
const createDoctor = async (data) => {
    // Check if email already exists
    const existing = await prisma.doctor.findUnique({ where: { email: data.email } });
    if (existing) {
        throw new AppError('A doctor with this email already exists.', 400);
    }

    return prisma.doctor.create({ data });
};

// Update a doctor (Admin only)
const updateDoctor = async (id, data) => {
    // Check if doctor exists
    const doctor = await prisma.doctor.findUnique({ where: { id } });
    if (!doctor) {
        throw new AppError('Doctor not found.', 404);
    }

    // If email is being updated, check for duplicates
    if (data.email && data.email !== doctor.email) {
        const existing = await prisma.doctor.findUnique({ where: { email: data.email } });
        if (existing) {
            throw new AppError('A doctor with this email already exists.', 400);
        }
    }

    return prisma.doctor.update({ where: { id }, data });
};

// Delete a doctor (Admin only) - protect if active appointments exist
const deleteDoctor = async (id) => {
    const doctor = await prisma.doctor.findUnique({ where: { id } });
    if (!doctor) {
        throw new AppError('Doctor not found.', 404);
    }

    // Prevent deletion if doctor has active (BOOKED) appointments
    const activeAppointments = await prisma.appointment.count({
        where: { doctorId: id, status: 'BOOKED' },
    });
    if (activeAppointments > 0) {
        throw new AppError(
            `Cannot delete doctor with ${activeAppointments} active appointment(s). Cancel them first.`,
            400
        );
    }

    await prisma.doctor.delete({ where: { id } });
    return { message: 'Doctor deleted successfully.' };
};

module.exports = { getAllDoctors, getDoctorById, createDoctor, updateDoctor, deleteDoctor };
