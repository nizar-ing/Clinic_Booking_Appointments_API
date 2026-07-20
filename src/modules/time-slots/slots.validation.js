const { z } = require('zod');

const createSlotSchema = z.object({
    date: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid date format. Use YYYY-MM-DD.',
    }),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:MM format'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in HH:MM format'),
}).refine((data) => {
    // End time must be after start time
    return data.startTime < data.endTime;
}, {
    message: 'End time must be after start time.',
    path: ['endTime'],
}).refine((data) => {
    // Working hours: 08:00 - 18:00
    return data.startTime >= '08:00' && data.endTime <= '18:00';
}, {
    message: 'Slots must be within working hours (08:00 - 18:00).',
    path: ['startTime'],
}).refine((data) => {
    // Slot date must not be in the past
    const slotDate = new Date(data.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return slotDate >= today;
}, {
    message: 'Cannot create a slot in the past.',
    path: ['date'],
});

module.exports = { createSlotSchema };