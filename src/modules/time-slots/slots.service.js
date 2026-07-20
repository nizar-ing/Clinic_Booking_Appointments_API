const prisma = require('../../config/prisma-client');
const AppError = require('../../utils/AppError');

// Create a slot for a doctor (Admin only)
const createSlot = async (doctorId, data) => {
    // Check if doctor exists
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) {
        throw new AppError('Doctor not found.', 404);
    }

    // Parse the date
    const slotDate = new Date(data.date);
    slotDate.setHours(0, 0, 0, 0);

    // Prevent duplicate: check if same doctor already has a slot at this date/time
    const duplicate = await prisma.doctorSlot.findFirst({
        where: {
            doctorId,
            date: slotDate,
            startTime: data.startTime,
        },
    });
    if (duplicate) {
        throw new AppError('A slot already exists for this doctor at the given date and time.', 400);
    }

    return prisma.doctorSlot.create({
        data: {
            doctorId,
            date: slotDate,
            startTime: data.startTime,
            endTime: data.endTime,
        },
    });
};

// Get all slots for a doctor
const getDoctorSlots = async (doctorId) => {
    // Check if doctor exists
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) {
        throw new AppError('Doctor not found.', 404);
    }

    return prisma.doctorSlot.findMany({
        where: { doctorId },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
};

// Get only available (not booked) slots for a doctor
const getAvailableSlots = async (doctorId) => {
    // Check if doctor exists
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) {
        throw new AppError('Doctor not found.', 404);
    }

    const now = new Date();

    return prisma.doctorSlot.findMany({
        where: {
            doctorId,
            isBooked: false,
            date: { gte: now },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
};

module.exports = { createSlot, getDoctorSlots, getAvailableSlots };
