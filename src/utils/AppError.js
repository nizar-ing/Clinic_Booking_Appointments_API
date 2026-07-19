// ES6 class syntax that creates AppError as a subclass of the built-in JavaScript Error.
// "extends Error" sets up the prototype chain so AppError inherits the native .message,
// .stack, and .name properties automatically.
// Instances satisfy BOTH: (err instanceof AppError) and (err instanceof Error).
// This is the standard Node.js pattern for creating named, typed, catchable custom errors.
class AppError extends Error {

    // The constructor is called every time you write: throw new AppError(...)
    // Parameters:
    //   message    — human-readable description of what went wrong (e.g. "User not found")
    //   statusCode — HTTP status code to send back (e.g. 400, 401, 404, 500)
    //   errors     — ES6 default parameter: optional structured payload for multiple errors
    //                (e.g. an array of field-level validation errors from Joi).
    //                Defaults to null so you don't need to pass it for simple cases.
    constructor(message, statusCode, errors = null) {

        // MANDATORY first call inside any subclass constructor — must come before any "this." usage.
        // Invokes the built-in Error constructor, which:
        //   1. Sets this.message to the string you passed in
        //   2. Correctly wires up the prototype chain (AppError → Error → Object)
        // Without super(), JavaScript throws:
        //   ReferenceError: Must call super constructor before accessing 'this'
        super(message);

        // Attaches the HTTP status code as an own property on this error instance.
        // Express error-handling middleware will read err.statusCode to call res.status()
        // before sending the JSON response to the client.
        // Keeps "what went wrong" (message) separate from "how to respond" (status code).
        this.statusCode = statusCode;

        // Stores any additional structured error details on the instance.
        // Useful for validation failures where multiple fields are wrong at once —
        // e.g. errors = [{ field: 'email', msg: 'Invalid format' }, { field: 'age', msg: 'Must be a number' }]
        // The error middleware will forward this to the client so they can fix all issues in one round-trip.
        // Defaults to null (set by the default parameter above) for simple single-message errors.
        this.errors = errors;

        // A custom boolean flag that classifies errors into two categories:
        //
        //   isOperational = true  → EXPECTED/ANTICIPATED error:
        //     e.g. user not found, wrong password, invalid input, unauthorized access.
        //     These are part of normal application flow. It is safe to send the
        //     error message and details back to the client in the HTTP response.
        //
        //   isOperational = false → PROGRAMMER / SYSTEM error (the default for any
        //     unhandled Error that is NOT an AppError):
        //     e.g. a bug, database connection crash, undefined is not a function.
        //     These are unexpected. The global error handler should hide the details,
        //     send a generic "Something went wrong" 500, and potentially restart the process.
        //
        // Express global error middleware checks this flag to decide the response strategy.
        this.isOperational = true;

        // V8-engine-specific method (Node.js only — not available in browsers).
        // Manually creates a clean .stack property on this AppError instance.
        //
        // Why it exists:
        //   super(message) already generates a .stack, but it includes the AppError
        //   constructor frame at the top — which is noise when debugging.
        //
        // What the second argument does:
        //   Passing "this.constructor" (i.e. the AppError class itself) tells V8:
        //   "exclude AppError's constructor and everything above it from the stack trace."
        //   So error.stack starts at the exact line that called: throw new AppError(...)
        //   instead of pointing inside this constructor file.
        //
        // Result: stack traces lead directly to your business logic (the controller,
        //   service, or middleware that threw the error) — much easier to debug.
        Error.captureStackTrace(this, this.constructor);
    }
}

// CommonJS export syntax — the module system used throughout this project.
// Makes AppError importable in any other file with:
//   const AppError = require('../utils/AppError');
//
// ES Module (ESM) equivalent would be: export default AppError
// CommonJS (CJS) is used here because package.json does not set "type": "module".
module.exports = AppError;
