const { z } = require('zod');

const createServiceSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().optional(),
    price: z.number().positive('Price must be a positive number'),
    durationMinutes: z.number().int().positive('Duration must be a positive integer'),
});

const updateServiceSchema = z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    price: z.number().positive('Price must be a positive number').optional(),
    durationMinutes: z.number().int().positive('Duration must be a positive integer').optional(),
});