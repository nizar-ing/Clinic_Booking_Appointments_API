/**
 * appointments.service.js
 *
 * Pure business logic layer for the Appointments feature.
 * All database access goes through the shared Prisma client.
 * This file never touches `req` or `res` — that belongs to the controller.
 */

// The single shared PrismaClient instance configured with @prisma/adapter-pg.
// Importing the same instance everywhere avoids connection-pool exhaustion.
const prisma = require('../../config/prisma-client');

// AppError is our operational-error class (statusCode + isOperational = true).
// Throwing it signals the global error middleware to send a structured JSON error
// instead of treating it as an unexpected programmer bug.
const AppError = require('../../utils/AppError');

// Thin wrapper around Nodemailer; sends transactional emails for booking events.
const sendEmail = require('../../utils/sendEmail');

// ---------------------------------------------------------------------------
// createAppointment
// ---------------------------------------------------------------------------

/**
 * Books a new appointment for a patient.
 *
 * Steps:
 *  1. Validate that the target slot exists, is not already taken, and is in the future.
 *  2. Verify slot ownership matches the supplied doctorId.
 *  3. Confirm the doctor and service records exist.
 *  4. Guard against double-booking (same patient, same date/time, status BOOKED).
 *  5. Atomically mark the slot as booked AND create the Appointment row.
 *  6. Fire a confirmation email (best-effort; not inside the transaction).
 *
 * @param {string} patientId  - ID of the authenticated patient (from req.user.id)
 * @param {object} data       - Validated request body (doctorId, serviceId, slotId, notes?)
 * @returns {object}          - The created Appointment with doctor/service/slot included
 */
const createAppointment = async (patientId, data) => {
    // Destructure the four expected fields from the validated body.
    // `notes` is optional and will be undefined if not supplied.
    const { doctorId, serviceId, slotId, notes } = data;

    // --- Step 1: Slot validation ---

    // findUnique looks up exactly one record by a unique field (here: primary key `id`).
    // Returns null if no record matches — never throws for a missing row.
    const slot = await prisma.doctorSlot.findUnique({ where: { id: slotId } });

    // Throw 404 if the slot ID doesn't exist in the database.
    if (!slot) {
        throw new AppError('Slot not found.', 404);
    }

    // `isBooked` is a boolean column on DoctorSlot.
    // Reject the request early if another appointment already claimed this slot.
    if (slot.isBooked) {
        throw new AppError('This slot is already booked.', 400);
    }

    // Compare the slot's `date` (a JS Date stored as UTC midnight) against now.
    // Past slots are invalid for booking even if technically unbooked.
    const now = new Date();
    if (slot.date < now) {
        throw new AppError('Cannot book a slot in the past.', 400);
    }

    // --- Step 2: Ownership check ---

    // Confirm that the slot's FK `doctorId` matches the doctorId sent in the request body.
    // This prevents a patient from booking slot #42 (which belongs to Dr. A) while
    // claiming it is for Dr. B by simply changing the doctorId in the payload.
    if (slot.doctorId !== doctorId) {
        throw new AppError('This slot does not belong to the specified doctor.', 400);
    }

    // --- Step 3: Existence checks ---

    // Verify the Doctor row exists. We do this after the slot check because
    // the slot already carries doctorId — but the doctor record itself could
    // theoretically be deleted after the slot was created.
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) {
        throw new AppError('Doctor not found.', 404);
    }

    // Verify the ClinicService row exists. The serviceId is supplied by the client
    // and must reference a real, currently-active service.
    const service = await prisma.clinicService.findUnique({ where: { id: serviceId } });
    if (!service) {
        throw new AppError('Service not found.', 404);
    }

    // --- Step 4: Double-booking guard ---

    // findFirst returns the first matching row or null (no unique constraint required).
    // We check across the relation `slot` (joined table) using a nested `where`.
    // Prisma translates this into a JOIN on the DoctorSlot table filtering by
    // date and startTime, scoped to this patient's BOOKED appointments.
    const conflicting = await prisma.appointment.findFirst({
        where: {
            patientId,          // Must belong to this patient
            status: 'BOOKED',   // Only active bookings count; CANCELLED ones are fine
            slot: {
                date: slot.date,            // Same calendar date
                startTime: slot.startTime,  // Same start time (overlapping block)
            },
        },
    });

    // A non-null result means a conflicting appointment was found.
    if (conflicting) {
        throw new AppError('You already have an appointment at this date and time.', 400);
    }

    // --- Step 5: Atomic booking via transaction ---

    // prisma.$transaction(callback) runs every Prisma call inside `callback` in a
    // single database transaction. If any call throws, the whole transaction rolls back —
    // ensuring we never end up with a booked slot but no Appointment row (or vice versa).
    // The `tx` argument is a scoped Prisma client that routes calls through the open TX.
    const appointment = await prisma.$transaction(async (tx) => {

        // Mark the DoctorSlot as taken so no other request can claim it simultaneously.
        // update() finds the row by `where` and applies the `data` patch; it throws
        // P2025 (record not found) if the id doesn't exist — handled by error middleware.
        await tx.doctorSlot.update({
            where: { id: slotId },
            data: { isBooked: true },
        });

        // Create the Appointment row linking all four entities.
        // `include` tells Prisma to JOIN and return the related records in the same query,
        // so we get doctor name/specialization, service name, and slot timing in one round-trip.
        return  await tx.appointment.create({
            data: {
                patientId,   // FK → User
                doctorId,    // FK → Doctor
                serviceId,   // FK → ClinicService
                slotId,      // FK → DoctorSlot (unique — enforces one appointment per slot)
                notes,       // Optional free-text field; undefined is stored as NULL
            },
            include: {
                doctor:  { select: { name: true, specialization: true } },
                service: { select: { name: true } },
                slot:    { select: { date: true, startTime: true, endTime: true } },
            },
        });
    });

    // --- Step 6: Confirmation email (fire-and-forget style) ---

    // Fetch the patient's name and email for personalising the email body.
    // This runs AFTER the transaction so a mail-server failure doesn't roll back the booking.
    const patient = await prisma.user.findUnique({ where: { id: patientId } });

    if (patient) {
        // await here means we wait for the SMTP handshake to finish.
        // For truly non-blocking behaviour this could be `sendEmail(...).catch(console.error)`
        // but awaiting it keeps error visibility during development.
        await sendEmail({
            to: patient.email,
            subject: 'Appointment Booking Confirmation',
            // Inline HTML email body. Template literals interpolate the appointment
            // details that were just returned by the transaction above.
            html: `
        <h2>Appointment Confirmed!</h2>
        <p>Dear ${patient.name},</p>
        <p>Your appointment has been booked successfully.</p>
        <ul>
          <li><strong>Doctor:</strong> ${appointment.doctor.name}</li>
          <li><strong>Service:</strong> ${appointment.service.name}</li>
          <li><strong>Date:</strong> ${appointment.slot.date.toDateString()}</li>
          <li><strong>Time:</strong> ${appointment.slot.startTime} - ${appointment.slot.endTime}</li>
        </ul>
        <p>Thank you for choosing our clinic!</p>
      `,
        });
    }

    // Return the full appointment object (with included relations) to the controller,
    // which will wrap it in a 201 JSON response.
    return appointment;
};

// ---------------------------------------------------------------------------
// getMyAppointments
// ---------------------------------------------------------------------------

/**
 * Returns all appointments for the authenticated patient.
 * Supports an optional `?status=` query param to filter by appointment status.
 *
 * @param {string} patientId - ID of the authenticated patient
 * @param {object} query     - Parsed query string from req.query (e.g. { status: 'BOOKED' })
 * @returns {object[]}       - Array of appointments with doctor/service/slot details
 */
const getMyAppointments = async (patientId, query) => {
    // Start with a base filter: only this patient's appointments.
    // `where` is built up incrementally so additional filters can be composed cleanly.
    const where = { patientId };

    // If the caller passed ?status=booked (or BOOKED/Cancelled/etc.), apply it.
    // toUpperCase() normalises the input; the array membership check prevents
    // injecting arbitrary strings into the Prisma query.
    if (query.status && ['BOOKED', 'CANCELLED', 'COMPLETED'].includes(query.status.toUpperCase())) {
        where.status = query.status.toUpperCase();
    }

    // findMany returns an array of all matching rows (empty array if none).
    // `include` joins three related tables and `select` limits which columns come back,
    // keeping the payload small and avoiding leaking sensitive data (e.g. doctor's internal ID).
    // `orderBy: { createdAt: 'desc' }` puts the most recently created appointments first.
    return prisma.appointment.findMany({
        where,
        include: {
            doctor:  { select: { name: true, specialization: true } },
            service: { select: { name: true, price: true } },
            slot:    { select: { date: true, startTime: true, endTime: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
};

// ---------------------------------------------------------------------------
// getAppointmentById
// ---------------------------------------------------------------------------

/**
 * Fetches a single appointment by its ID.
 * Patients can only retrieve their own; admins can retrieve any.
 *
 * @param {string} id       - Appointment UUID
 * @param {string} userId   - ID of the requesting user (req.user.id)
 * @param {string} userRole - 'PATIENT' or 'ADMIN' (req.user.role)
 * @returns {object}        - The appointment with full related data
 */
const getAppointmentById = async (id, userId, userRole) => {
    // findUnique returns the row or null; we use `include` to eagerly load all relations
    // the client needs to display a full appointment detail view.
    const appointment = await prisma.appointment.findUnique({
        where: { id },
        include: {
            // Include the patient's basic profile (id is included so the auth check below works).
            patient: { select: { id: true, name: true, email: true } },
            doctor:  { select: { name: true, specialization: true } },
            service: { select: { name: true, price: true } },
            slot:    { select: { date: true, startTime: true, endTime: true } },
        },
    });

    // Prisma returns null (not an exception) when no row matches — map to 404.
    if (!appointment) {
        throw new AppError('Appointment not found.', 404);
    }

    // Role-based access control at the service layer.
    // Patients can only see their own record; admins bypass this guard.
    // We compare appointment.patientId (the FK stored on the row) with the requesting userId.
    if (userRole === 'PATIENT' && appointment.patientId !== userId) {
        throw new AppError('You do not have access to this appointment.', 403);
    }

    return appointment;
};

// ---------------------------------------------------------------------------
// cancelAppointment
// ---------------------------------------------------------------------------

/**
 * Cancels a patient's own appointment and releases the slot back to the pool.
 * Only the owning patient may cancel (admins use a separate admin endpoint if needed).
 *
 * @param {string} id     - Appointment UUID
 * @param {string} userId - ID of the requesting patient
 * @returns {object}      - The updated (cancelled) appointment
 */
const cancelAppointment = async (id, userId) => {
    // Fetch only the minimal fields needed for validation before starting a transaction.
    // Avoids unnecessary JOINs at this stage.
    const appointment = await prisma.appointment.findUnique({ where: { id } });

    if (!appointment) {
        throw new AppError('Appointment not found.', 404);
    }

    // Ownership check: a patient cannot cancel someone else's appointment.
    if (appointment.patientId !== userId) {
        throw new AppError('You can only cancel your own appointments.', 403);
    }

    // Idempotency guard: cancelling an already-cancelled appointment is a no-op error,
    // not a silent success, so the caller knows their request had no effect.
    if (appointment.status === 'CANCELLED') {
        throw new AppError('Appointment is already cancelled.', 400);
    }

    // Atomic cancel: both the status update AND the slot release must succeed together.
    // If the slot update fails after the appointment is cancelled, the slot would be
    // stuck as `isBooked: true` forever — hence the transaction.
    return await prisma.$transaction(async (tx) => {

        // Update the Appointment status to CANCELLED and fetch the updated row
        // with doctor and slot details for the response body.
        const updated = await tx.appointment.update({
            where: { id },
            data: { status: 'CANCELLED' },
            include: {
                doctor: { select: { name: true } },
                slot:   { select: { date: true, startTime: true, endTime: true } },
            },
        });

        // Free the DoctorSlot so other patients can book it.
        // We use `appointment.slotId` (captured before the TX) because the updated
        // appointment above doesn't re-select slotId from `include`.
        await tx.doctorSlot.update({
            where: { id: appointment.slotId },
            data: { isBooked: false },
        });

        // Return the cancelled appointment row out of the transaction callback.
        return updated;
    });
};

// ---------------------------------------------------------------------------
// getAllAppointments  (Admin only)
// ---------------------------------------------------------------------------

/**
 * Paginated list of all appointments across every patient.
 * Supports filtering by status, date range, and doctor.
 *
 * Query params:
 *   page     - Page number (default: 1)
 *   limit    - Items per page (default: 20)
 *   status   - BOOKED | CANCELLED | COMPLETED
 *   from     - ISO date string for the earliest slot date
 *   to       - ISO date string for the latest slot date
 *   doctorId - Filter to one doctor's appointments
 *
 * @param {object} query - req.query object
 * @returns {{ appointments: object[], pagination: object }}
 */
const getAllAppointments = async (query) => {
    // Parse page/limit with parseInt; fall back to sensible defaults if missing or NaN.
    const page  = parseInt(query.page)  || 1;
    const limit = parseInt(query.limit) || 20;

    // `skip` is the offset Prisma uses for cursor-free pagination:
    // page 1 → skip 0, page 2 → skip 20, page 3 → skip 40, etc.
    const skip = (page - 1) * limit;

    // Build the WHERE clause progressively so each optional filter is only added
    // when its corresponding query param is present.
    const where = {};

    // Status filter — same whitelist approach as getMyAppointments.
    if (query.status && ['BOOKED', 'CANCELLED', 'COMPLETED'].includes(query.status.toUpperCase())) {
        where.status = query.status.toUpperCase();
    }

    // Date-range filter: targets the nested `slot.date` relation column.
    // Prisma supports filtering across relations using nested `where` objects.
    // `gte` = greater-than-or-equal ("from"), `lte` = less-than-or-equal ("to").
    if (query.from || query.to) {
        where.slot = { date: {} };                                // nested relation filter
        if (query.from) where.slot.date.gte = new Date(query.from);
        if (query.to)   where.slot.date.lte = new Date(query.to);
    }

    // Doctor filter: a simple FK equality check on the Appointment table itself.
    if (query.doctorId) {
        where.doctorId = query.doctorId;
    }

    // Run the data query and the total-count query in parallel with Promise.all.
    // Both share the same `where` clause, so the count reflects the filtered total.
    // This avoids two sequential round-trips to the database.
    const [appointments, total] = await Promise.all([
        prisma.appointment.findMany({
            where,
            include: {
                patient: { select: { name: true, email: true } },
                doctor:  { select: { name: true, specialization: true } },
                service: { select: { name: true } },
                slot:    { select: { date: true, startTime: true, endTime: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip,       // How many rows to skip (offset)
            take: limit, // How many rows to return (limit)
        }),

        // count() returns a plain number — the total matching rows ignoring pagination.
        // Used to calculate totalPages on the client side.
        prisma.appointment.count({ where }),
    ]);

    return {
        appointments,
        // Pagination metadata lets clients build "next page" links without another count query.
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

// ---------------------------------------------------------------------------
// getSummaryReport  (Admin only)
// ---------------------------------------------------------------------------

/**
 * Aggregates clinic-wide statistics for the admin dashboard.
 * Computes counts, today's bookings, total revenue, and cancellation rate.
 *
 * @returns {object} - Flat stats object
 */
const getSummaryReport = async () => {
    // Build a date range for "today" in local server time (midnight → midnight).
    const today    = new Date();
    today.setHours(0, 0, 0, 0);           // Start of today (00:00:00.000)
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow = end of today

    // Fire all nine queries in parallel — none depends on another's result.
    // Promise.all waits for every promise and resolves to an array in the same order.
    // Destructuring assigns each result to a named constant.
    const [
        totalAppointments,   // Total row count regardless of status
        bookedCount,         // Active, upcoming appointments
        cancelledCount,      // Cancelled appointments
        completedCount,      // Completed appointments
        totalDoctors,        // Total Doctor rows
        totalPatients,       // User rows with role = PATIENT
        totalServices,       // Total ClinicService rows
        todayAppointments,   // BOOKED appointments whose slot.date falls in today's window
        revenueData,         // Raw rows for non-cancelled appointments (price calculation below)
    ] = await Promise.all([
        prisma.appointment.count(),
        prisma.appointment.count({ where: { status: 'BOOKED' } }),
        prisma.appointment.count({ where: { status: 'CANCELLED' } }),
        prisma.appointment.count({ where: { status: 'COMPLETED' } }),
        prisma.doctor.count(),
        prisma.user.count({ where: { role: 'PATIENT' } }),
        prisma.clinicService.count(),

        // Filter appointments by the slot's date being within today's window.
        // `gte today` AND `lt tomorrow` equals "date = today" without time-zone issues.
        prisma.appointment.count({
            where: { slot: { date: { gte: today, lt: tomorrow } }, status: 'BOOKED' },
        }),

        // Prisma doesn't have a built-in SUM aggregation for relations,
        // so we fetch each appointment's service price and sum in JS below.
        // `select` limits the payload to only the price field to keep the query lean.
        prisma.appointment.findMany({
            where: { status: { not: 'CANCELLED' } }, // Exclude cancelled appointments from revenue
            select: { service: { select: { price: true } } },
        }),
    ]);

    // Sum prices in JavaScript using Array.reduce().
    // The optional chaining `a.service?.price` guards against an orphaned appointment
    // whose service was deleted (fallback to 0 keeps the sum valid).
    const totalRevenue = revenueData.reduce((sum, a) => sum + (a.service?.price || 0), 0);

    // Cancellation rate as a percentage string, e.g. "12.5%".
    // Guard against division by zero when there are no appointments yet.
    const cancellationRate = totalAppointments > 0
        ? ((cancelledCount / totalAppointments) * 100).toFixed(1) // 1 decimal place
        : '0.0';

    return {
        totalAppointments,
        bookedCount,
        cancelledCount,
        completedCount,
        todayAppointments,
        cancellationRate: `${cancellationRate}%`,
        // toFixed(2) rounds to 2 decimal places; parseFloat removes trailing zeros.
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalDoctors,
        totalPatients,
        totalServices,
    };
};

// ---------------------------------------------------------------------------
// completeAppointment  (Admin only)
// ---------------------------------------------------------------------------

/**
 * Marks a BOOKED appointment as COMPLETED.
 * Only valid for appointments currently in BOOKED status.
 *
 * @param {string} id - Appointment UUID
 * @returns {object}  - The updated appointment with full related data
 */
const completeAppointment = async (id) => {
    // Fetch the appointment first to validate its current status before updating.
    // Avoids a blind update that could silently change a CANCELLED appointment to COMPLETED.
    const appointment = await prisma.appointment.findUnique({ where: { id } });

    if (!appointment) {
        throw new AppError('Appointment not found.', 404);
    }

    // Only BOOKED appointments can be completed. Completing a CANCELLED or already-COMPLETED
    // one would corrupt the status history.
    if (appointment.status !== 'BOOKED') {
        throw new AppError(`Cannot complete an appointment with status: ${appointment.status}.`, 400);
    }

    // A single update() is sufficient here — no slot state change is needed
    // (the slot stays booked; it was used for the appointment).
    // `include` returns the full detail for the confirmation response.
    return prisma.appointment.update({
        where: { id },
        data: { status: 'COMPLETED' },
        include: {
            patient: { select: { name: true, email: true } },
            doctor:  { select: { name: true } },
            service: { select: { name: true, price: true } },
            slot:    { select: { date: true, startTime: true, endTime: true } },
        },
    });
};

// Export all service functions so the controller can import them by name.
module.exports = {
    createAppointment,
    getMyAppointments,
    getAppointmentById,
    cancelAppointment,
    completeAppointment,
    getAllAppointments,
    getSummaryReport,
};
