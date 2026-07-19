// Import the custom error class so validation failures can be forwarded to the global
// error handler as structured AppError instances with an HTTP 400 status code.
// (AppError adds .statusCode, .errors, and .isOperational — see src/utils/AppError.js)
const AppError = require('../utils/AppError');

// Higher-order function — same pattern as asyncHandler.js.
// Takes a Zod schema object as its argument and returns an Express middleware function.
// "schema" is a Zod schema (e.g. z.object({ email: z.string().email(), password: z.string() }))
// created once in the validation file and passed in when the route is mounted.
// This separation means you define the shape in one place and reuse this middleware everywhere.
const validate = (schema) => {

    // Returns a standard Express middleware function: (req, res, next).
    //   req  — the incoming HTTP request (body, params, headers, etc.)
    //   res  — the outgoing HTTP response (not used here — validation either passes or errors)
    //   next — Express callback; next() advances to the next middleware, next(err) jumps to
    //          the global error-handling middleware (4-param signature: err, req, res, next)
    return (req, res, next) => {

        // Zod's NON-THROWING validation method applied to the raw request body.
        // req.body contains the JSON payload parsed by Express's json() body-parser middleware.
        //
        // safeParse vs parse — the critical difference:
        //   schema.parse(data)     → returns typed data on success, THROWS ZodError on failure
        //   schema.safeParse(data) → NEVER throws; always returns a discriminated union:
        //                              { success: true,  data: <validated data> }
        //                              { success: false, error: ZodError }
        //
        // We use safeParse so we can inspect all the errors and forward them via next()
        // instead of letting an uncaught throw bubble up unpredictably.
        const result = schema.safeParse(req.body);

        // Discriminated union check — Zod sets result.success = false when ANY field fails.
        // Inside this branch, result.error is a ZodError instance that holds every issue
        // found in the request body. Zod collects ALL failures in a single pass, not just
        // the first one, so the client learns everything it needs to fix at once.
        if (!result.success) {

            // result.error.errors (also aliased as result.error.issues) is an array of
            // ZodIssue objects. Each issue describes one validation failure and looks like:
            //
            //   {
            //     code: "invalid_type",           // machine-readable error code
            //     expected: "string",
            //     received: "number",
            //     path: ["address", "city"],       // array of keys/indices to the bad field
            //     message: "Expected string, received number"  // human-readable description
            //   }
            //
            // .map() transforms each raw ZodIssue into a simpler { field, message } shape
            // suitable for sending to the API client.
            const errors = result.error.errors.map((err) => ({

                // err.path is an array tracing the location of the failing field in the body.
                // Examples:
                //   top-level field → path: ["email"]          → joined: "email"
                //   nested field    → path: ["address", "city"] → joined: "address.city"
                //   array element   → path: ["items", 2]        → joined: "items.2"
                //   whole object    → path: []                   → joined: "" (empty string)
                // .join('.') converts the array to a dot-notation string in one step.
                field: err.path.join('.'),

                // The human-readable description of what was wrong, e.g.:
                // "Expected string, received number", "Invalid email", "Required"
                // This is what the client displays to the user to explain the error.
                message: err.message,
            }));

            // Forward the error to Express's error-handling pipeline.
            // "return" is critical here — it stops execution so the happy-path lines
            // below (req.body = result.data and next()) are NOT reached after a failure.
            //
            // new AppError('Validation failed', 400, errors):
            //   - 'Validation failed' — top-level message for the response
            //   - 400                 — HTTP 400 Bad Request (client sent invalid data)
            //   - errors              — the mapped array of { field, message } objects,
            //                          stored on AppError's .errors property and included
            //                          in the JSON response by the error handler
            return next(new AppError('Validation failed', 400, errors));
        }

        // Happy path — validation passed.
        // Replace req.body with result.data rather than leaving the raw input in place.
        // result.data is NOT simply a copy of req.body — Zod may have transformed it:
        //   • Applied .default() values for missing optional fields
        //   • Coerced types: z.coerce.number() converts "42" (string) → 42 (number)
        //   • Stripped unknown keys (when the schema uses .strict() or .strip())
        // Assigning result.data ensures every downstream controller receives clean,
        // type-safe, fully validated data — never the raw untrusted input.
        req.body = result.data;

        // No error — pass control to the next middleware or the route handler itself.
        // Calling next() with no arguments means "everything is fine, keep going".
        next();
    };
};

// CommonJS export — importable with:
//   const validate = require('../middlewares/validate.middleware');
//
// Typical usage when mounting a route (validate runs BEFORE the controller):
//   const { loginSchema } = require('./auth.validation');
//   router.post('/login', validate(loginSchema), asyncHandler(loginController));
//                         ^^^^^^^^^^^^^^^^^^^^^ schema passed in here as argument
module.exports = validate;
