const { z } = require('zod');

const createDoctorSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    specialization: z.string().min(2, 'Specialization is required'),
    bio: z.string().optional(),
    email: z.email('Invalid email address'),
    phone: z.string().optional(),
});

const updateDoctorSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    specialization: z.string().min(2).optional(),
    bio: z.string().optional(),
    email: z.email('Invalid email address').optional(),
    phone: z.string().optional(),
});

module.exports = { createDoctorSchema, updateDoctorSchema };