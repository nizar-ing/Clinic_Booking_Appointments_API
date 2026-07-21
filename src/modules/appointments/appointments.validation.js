const { z } = require('zod');

const createAppointmentSchema = z.object({
    doctorId: z.uuid('Invalid doctor ID'),
    serviceId: z.uuid('Invalid service ID'),
    slotId: z.uuid('Invalid slot ID'),
    notes: z.string().optional(),
});

const cancelAppointmentSchema = z.object({
    reason: z.string().optional(),
});

module.exports = { createAppointmentSchema, cancelAppointmentSchema };