// express is the web framework. express() creates an application object (app)
// that holds all middleware, routes, and settings for the HTTP server.
const express = require('express');

// cors handles the Cross-Origin Resource Sharing headers.
// Without it, browsers block fetch/XHR calls from a different origin (domain/port)
// than the one that served the page.
const cors = require('cors');

// helmet sets security-related HTTP response headers (e.g. X-Content-Type-Options,
// X-Frame-Options, Strict-Transport-Security) with safe defaults in one call.
const helmet = require('helmet');

// morgan is an HTTP request logger. It logs method, URL, status code, and
// response time to stdout on every request — useful for debugging and monitoring.
const morgan = require('morgan');

// compression encodes responses with gzip/deflate, reducing transfer size for
// text-based payloads (JSON, HTML). Smaller payloads = faster client rendering.
const compression = require('compression');

const { v4: uuidv4 } = require('uuid');

// swagger-ui-express serves the interactive Swagger UI at a URL of your choice.
// swaggerUi.serve provides the static assets; swaggerUi.setup() wires up the spec.
const swaggerUi = require('swagger-ui-express');

// swaggerSpec is the generated OpenAPI JSON object (built from JSDoc comments
// in route files by swagger-jsdoc, configured in src/config/swagger.js).
const swaggerSpec = require('./config/swagger');

// Centralised env config — imports PORT, FRONTEND_URL, etc. with defaults applied.
const env = require('./config/env');

// --- Feature routers ---
// Each module exposes an express.Router() instance that maps HTTP verbs to controllers.
const authRoutes = require('./modules/auth/auth.routes');
const doctorsRoutes = require('./modules/doctors/doctors.routes');
const servicesRoutes = require('./modules/clinic-services/services.routes');
const slotsRoutes = require('./modules/time-slots/slots.routes');
const appointmentsRoutes = require('./modules/appointments/appointments.routes');

// --- Reusable middleware ---
// notFound is mounted last among routes; it catches any request that didn't match
// a defined route and responds with 404.
const notFound = require('./middlewares/notFound.middleware');

// errorHandler is the global error middleware (4-argument signature).
// Express recognises it as an error handler and only calls it when next(err) is used.
const errorHandler = require('./middlewares/error.middleware');

// authenticate verifies the JWT from the Authorization header and attaches
// req.user = { id, name, email, role } for downstream handlers.
const authenticate = require('./middlewares/auth.middleware');

// authorize(...roles) is a HOF that returns a middleware checking req.user.role.
// Must always be placed after authenticate in the middleware chain.
const authorize = require('./middlewares/role.middleware');

// generalLimiter caps request volume for all /api/ routes to prevent abuse.
// authLimiter is stricter and applied only to /api/auth to slow brute-force attacks.
const { generalLimiter, authLimiter } = require('./middlewares/rateLimiter.middleware');

// appointmentController is imported here (rather than inside a router file) because
// the admin routes below are defined directly on `app` rather than inside a dedicated
// router module.
const appointmentController = require('./modules/appointments/appointments.controller');

// Create the Express application instance.
// `app` is the central object — middleware and routes are registered on it,
// and it is passed to http.createServer() in server.js.
const app = express();

// helmet() returns a middleware that sets ~15 security headers automatically.
// Placed first so security headers are present on every response, including errors.
app.use(helmet());

// Build the list of origins the browser is allowed to call this API from.
// env.FRONTEND_URL covers the deployed frontend; the localhost entries cover
// local development with Vite (5173) or the same port as the API (3000).
const allowedOrigins = [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173'];

app.use(
    cors({
        // origin can be a function for dynamic per-request checks.
        // Express-cors calls this with the request's Origin header value and a callback.
        origin: (origin, callback) => {
            // Requests with no Origin header (Postman, curl, server-to-server calls)
            // have origin === undefined. Allowing them is intentional for API testing.
            if (!origin || allowedOrigins.includes(origin)) {
                // callback(null, true) → allow the request.
                callback(null, true);
            } else {
                // Currently also allows unlisted origins — restrict to
                // callback(new Error('Not allowed by CORS')) in production.
                callback(null, true);
            }
        },
        // credentials: true allows the browser to include cookies and
        // Authorization headers in cross-origin requests.
        credentials: true,
    })
);

// Compress all responses larger than the threshold (~1 KB by default).
// Runs early so every downstream middleware and route benefits automatically.
app.use(compression());

// Attach a unique request ID to every incoming request.
// Re-uses the X-Request-Id header if the reverse proxy (nginx, ALB) already set one,
// otherwise generates a new UUID with uuidv4().
// The ID is echoed back in the response header so clients can correlate logs.
// NOTE: uuidv4 is referenced but not imported — this will throw a ReferenceError at runtime.
app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-Id', req.id);
    next();
});

// Measure and expose server-side processing time for every response.
// process.hrtime() returns a high-resolution [seconds, nanoseconds] tuple.
// process.hrtime(start) returns the *difference* since `start` was captured.
// The 'finish' event fires after the response is fully flushed to the socket,
// so the measurement covers the complete request lifecycle.
// The result is written as a response header (X-Response-Time: 12.34ms) rather
// than logged, so clients and proxies can consume it.
app.use((req, res, next) => {
    const start = process.hrtime();
    const originalEnd = res.end;
    res.end = function (...args) {
        if (!res.headersSent) {
            const [seconds, nanoseconds] = process.hrtime(start);
            const ms = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);
            res.setHeader('X-Response-Time', `${ms}ms`);
        }
        return originalEnd.apply(this, args);
    };
    next();
});

// Define a custom morgan token 'id' that reads req.id (set above).
// Tokens are placeholders that morgan replaces with runtime values when formatting log lines.
morgan.token('id', (req) => req.id);

// Log each request as: <requestId> GET /api/health 200 3.45 ms
// Having the request ID in the log makes it easy to trace a specific request across entries.
app.use(morgan(':id :method :url :status :response-time ms'));

// Parse incoming JSON request bodies and attach the result to req.body.
// limit: '10kb' rejects payloads larger than 10 KB to prevent memory exhaustion attacks.
app.use(express.json({ limit: '10kb' }));

// Parse URL-encoded form bodies (application/x-www-form-urlencoded).
// extended: true uses the `qs` library which supports nested objects.
// limit: '10kb' mirrors the JSON limit for consistency.
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Apply the general rate limiter to every /api/ route.
// This is registered a second time below — only the first registration matters because
// Express processes middleware in order and the limiter is stateless per-registration.
app.use('/api/', generalLimiter);

// Mount the Swagger UI at /api/docs.
// swaggerUi.serve delivers the UI static files; swaggerUi.setup(swaggerSpec) injects
// the OpenAPI spec so the UI renders the documented endpoints.
// The CSP override is required because helmet's default policy blocks the inline
// scripts and styles that Swagger UI relies on.
app.use(
    '/api/docs',
    (req, res, next) => {
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
        );
        next();
    },
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);

// --- Feature routes ---
// authLimiter on /api/auth enforces a tighter request cap (e.g. 10 req/15 min)
// to slow down credential brute-force or registration spam.
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/clinic-services', servicesRoutes);

// slotsRoutes uses Router({ mergeParams: true }) so that :doctorId from the parent
// path segment is accessible as req.params.doctorId inside the slots router.
app.use('/api/doctors/:doctorId/time-slots', slotsRoutes);
app.use('/api/appointments', appointmentsRoutes);

/**
 * @openapi
 * /api/admin/appointments:
 *   get:
 *     tags: [Admin]
 *     summary: List all appointments with pagination (Admin only)
 *     description: |
 *       Paginated, filterable view of every appointment across all patients.
 *       Supports filtering by status, date range, and doctor.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [BOOKED, CANCELLED, COMPLETED] }
 *         description: Filter by appointment status
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: "Earliest slot date — ISO 8601 (e.g. 2026-08-01)"
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: "Latest slot date — ISO 8601 (e.g. 2026-08-31)"
 *       - in: query
 *         name: doctorId
 *         schema: { type: string, format: uuid }
 *         description: Filter by doctor
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated appointments list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Appointment'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
app.get('/api/admin/appointments', authenticate, authorize('ADMIN'), appointmentController.getAllAppointments);

/**
 * @openapi
 * /api/admin/appointments/{id}/complete:
 *   patch:
 *     tags: [Admin]
 *     summary: Mark an appointment as completed (Admin only)
 *     description: Only appointments with status `BOOKED` can be transitioned to `COMPLETED`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Appointment UUID
 *     responses:
 *       200:
 *         description: Appointment marked as completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Appointment marked as completed.
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Appointment is not in BOOKED status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
app.patch('/api/admin/appointments/:id/complete', authenticate, authorize('ADMIN'), appointmentController.completeAppointment);

/**
 * @openapi
 * /api/admin/reports/summary:
 *   get:
 *     tags: [Admin]
 *     summary: Get clinic-wide appointment statistics (Admin only)
 *     description: |
 *       Returns aggregated counts, today's bookings, total revenue from non-cancelled
 *       appointments, and cancellation rate.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Clinic summary report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/SummaryReport'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
app.get('/api/admin/reports/summary', authenticate, authorize('ADMIN'), appointmentController.getSummaryReport);

// Duplicate generalLimiter registration — redundant, the one above already covers /api/.
app.use('/api/', generalLimiter);

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: API health check
 *     description: Returns 200 when the server is running. Used by load balancers and uptime monitors.
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: API is healthy
 */
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is healthy',
    });
});

// --- Error-handling middleware (must come after all routes) ---

// notFound catches any request that reached this point without matching a route above.
// It calls next(new AppError('Not found', 404)) to hand off to errorHandler.
app.use(notFound);

// errorHandler is Express's global error middleware — identified by its 4-argument
// signature (err, req, res, next). It maps Prisma error codes to HTTP statuses and
// sends a consistent { success: false, message, errors?, stack? } JSON response.
app.use(errorHandler);

// Export the configured app so server.js can pass it to http.createServer()
// and bind it to a port. Keeping app and server.listen() separate makes it easy
// to import `app` in integration tests without actually starting a server.
module.exports = app;
