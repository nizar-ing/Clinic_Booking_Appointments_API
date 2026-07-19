// Higher-order function (HOF) — a function that accepts another function as an argument.
// "fn" is your async route handler (e.g. an async controller function).
// Arrow function syntax: `(fn) => { ... }` is exactly equivalent to:
//   function asyncHandler(fn) { ... }
// The outer function's sole job is to receive fn and return a safely-wrapped version of it.
const asyncHandler = (fn) => {

    // Returns a NEW function with the exact Express middleware signature: (req, res, next).
    //   req  — the incoming HTTP Request object (headers, body, params, query, etc.)
    //   res  — the outgoing HTTP Response object (used to send status codes and JSON)
    //   next — a callback injected by Express; calling next(err) with an error argument
    //          bypasses all remaining regular middleware/routes and jumps directly to
    //          the global error-handling middleware (identified by its 4-param signature:
    //          (err, req, res, next) — that's the convention Express uses to distinguish it)
    // Express expects every route handler to have this shape, so the returned function is
    // a transparent drop-in replacement for any normal route handler.
    return (req, res, next) => {

        // This single line is the entire mechanism. Breaking it down left-to-right:
        //
        // 1. fn(req, res, next)
        //    Calls your original async handler and forwards the request context to it.
        //    An async function always returns a Promise, so this gives us a Promise.
        //
        // 2. Promise.resolve(...)
        //    Wraps the return value in a guaranteed Promise:
        //    - If fn is async  → it already returns a Promise; Promise.resolve is a no-op
        //    - If fn is sync   → it returns a plain value; Promise.resolve wraps it in one
        //    This normalisation means the wrapper handles both sync and async handlers
        //    with a single code path, no branching needed.
        //    Note: if fn is synchronous and THROWS (not returns), Promise.resolve does NOT
        //    catch that throw — but route handlers are virtually always async here.
        //
        // 3. .catch(next)
        //    Shorthand for .catch((err) => next(err))
        //    If the Promise REJECTS (the async handler threw or awaited a rejection),
        //    the error is passed to Express's next() function.
        //    next(err) signals Express: "an error occurred — skip all remaining regular
        //    middleware and go straight to the error handler."
        //    That error handler then reads err.statusCode and err.isOperational
        //    (properties set by AppError) to decide how to respond to the client.
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// ─── Why this utility exists: The Express 4 async problem ────────────────────
//
// In Express 4, if an async route handler throws or rejects, Express does NOT catch it.
// The error escapes as an unhandled promise rejection and the request hangs forever.
//
// Without asyncHandler — you'd need try/catch in every single controller:
//
//   router.get('/users', async (req, res, next) => {
//       try {
//           const users = await db.findAll();
//           res.json(users);
//       } catch (err) {
//           next(err); // must remember this every time — easy to forget
//       }
//   });
//
// With asyncHandler — controllers stay clean and errors are caught automatically:
//
//   router.get('/users', asyncHandler(async (req, res) => {
//       const users = await db.findAll(); // if this throws, .catch(next) handles it
//       res.json(users);
//   }));
//
// ─── Note on Express 5 (this project) ────────────────────────────────────────
//
// This project uses Express 5 (see package.json), which handles async errors natively —
// Express 5 internally wraps handlers so rejections automatically flow to next(err).
// asyncHandler is therefore technically redundant here, but it is still safe to use:
// it works as a defensive belt-and-suspenders pattern and makes the intent explicit.

// CommonJS export — same module system used throughout this project.
// Import in any file with: const asyncHandler = require('../utils/asyncHandler');
//
// Typical usage in a routes file:
//   router.post('/login', asyncHandler(async (req, res) => {
//       const token = await AuthService.login(req.body);
//       res.json({ token });
//   }));
module.exports = asyncHandler;
