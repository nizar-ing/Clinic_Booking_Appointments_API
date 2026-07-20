// asyncHandler wraps every async function so that any thrown error or rejected
// promise is automatically forwarded to Express's global error middleware via
// next(err). Express 5 does this natively, but we keep asyncHandler for
// explicitness and consistency across the codebase.
const asyncHandler = require('../../utils/asyncHandler');

// The service layer owns all business logic and DB queries. Controllers stay
// thin: read from req → call service → send response.
const slotService = require('./slots.service');

// POST /api/doctors/:doctorId/time-slots
// Creates a new time slot for a specific doctor.
// Protected by authenticate + authorize('ADMIN') in the router, so by the
// time this handler runs req.user is guaranteed to be a logged-in admin.
const createSlot = asyncHandler(async (req, res) => {
    // req.params.doctorId is available because the slots router is created with
    // Router({ mergeParams: true }), which merges parent-route params (:doctorId
    // from /api/doctors/:doctorId/time-slots) into this router's req.params.
    // req.body has already been validated and coerced by validate(createSlotSchema)
    // middleware, so only valid { date, startTime, endTime } reaches here.
    const slot = await slotService.createSlot(req.params.doctorId, req.body);

    // 201 Created is the correct HTTP status for a successfully created resource.
    // The response envelope follows the project-wide shape: { success, message, data }.
    res.status(201).json({
        success: true,
        message: 'Slot created successfully.',
        data: slot,        // The newly persisted DoctorSlot row returned by Prisma
    });
});

// GET /api/doctors/:doctorId/time-slots
// Returns every slot (booked or not) for the given doctor, ordered by
// date then startTime. Public route — no authentication required.
const getDoctorSlots = asyncHandler(async (req, res) => {
    // req.params.doctorId inherited from the parent /api/doctors/:doctorId route
    // via mergeParams (same reason as above).
    const slots = await slotService.getDoctorSlots(req.params.doctorId);

    // 200 OK — successful read. We include a top-level `count` field so callers
    // can check the array length without parsing the full data array.
    res.status(200).json({
        success: true,
        count: slots.length,   // Convenience field: total number of slots returned
        data: slots,           // Array of DoctorSlot objects ordered asc by date/startTime
    });
});

// GET /api/doctors/:doctorId/time-slots/available
// Returns only the future, unbooked slots for the given doctor.
// Patients use this endpoint to see which slots they can actually book.
// Public route — no authentication required.
const getAvailableSlots = asyncHandler(async (req, res) => {
    // req.params.doctorId — same mergeParams mechanism as the handlers above.
    const slots = await slotService.getAvailableSlots(req.params.doctorId);

    res.status(200).json({
        success: true,
        count: slots.length,   // Number of still-available (isBooked: false, date >= now) slots
        data: slots,
    });
});

// Export all three controller functions so the router can import and attach
// them to their respective routes.
module.exports = { createSlot, getDoctorSlots, getAvailableSlots };
