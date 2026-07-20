// Router is Express's mini-application for grouping related routes. It lets us
// define route handlers in isolation and then mount them in app.js under a
// common path prefix (/api/doctors/:doctorId/time-slots).
const { Router } = require('express');

// Import the three controller functions that handle the HTTP request/response cycle.
const slotController = require('./slots.controller');

// Middleware: validates Zod schema against req.body and replaces it with the
// parsed output (or calls next(AppError) on failure).
const validate = require('../../middlewares/validate.middleware');

// Middleware: verifies the JWT Bearer token and attaches { id, name, email, role }
// to req.user. Returns 401 if the token is missing, invalid, or expired.
const authenticate = require('../../middlewares/auth.middleware');

// Middleware factory: call authorize('ADMIN') to produce a middleware that returns
// 403 if req.user.role is not 'ADMIN'. Must be used after authenticate.
const authorize = require('../../middlewares/role.middleware');

// The Zod schema that defines and validates the shape of the POST request body
// (date, startTime, endTime — with working-hours and no-past-date rules).
const { createSlotSchema } = require('./slots.validation');

// mergeParams: true — critical option for nested routers.
// Without it, params defined in the parent route (:doctorId from
// /api/doctors/:doctorId/time-slots) would be invisible inside this router.
// With mergeParams, req.params.doctorId is accessible in every handler below.
const router = Router({ mergeParams: true });


// POST /api/doctors/:doctorId/time-slots
// Middleware chain runs left-to-right before the controller:
//   1. authenticate — ensures the caller is a logged-in user (401 if not)
//   2. authorize('ADMIN') — ensures that user is an admin (403 if not)
//   3. validate(createSlotSchema) — validates & coerces req.body against the
//      Zod schema; short-circuits with 400 if validation fails
// The array syntax is equivalent to listing the middleware as separate arguments;
// Express processes all entries in order.
router.post(
    '/',
    [authenticate, authorize('ADMIN'), validate(createSlotSchema)],
    slotController.createSlot
);

// GET /api/doctors/:doctorId/time-slots
// Public route — no authentication required. Returns all slots (booked + unbooked)
// for the specified doctor, ordered by date then startTime.
router.get('/', slotController.getDoctorSlots);

// GET /api/doctors/:doctorId/time-slots/available
// Public route — no authentication required. Returns only future, unbooked slots
// so patients can see what they can actually book.
// NOTE: This route must be declared before any parameterised GET (e.g. /:id)
// to prevent Express from treating the literal string "available" as a param value.
router.get('/available', slotController.getAvailableSlots);

// Export the configured router so app.js can mount it:
//   app.use('/api/doctors/:doctorId/time-slots', slotsRouter)
module.exports = router;
