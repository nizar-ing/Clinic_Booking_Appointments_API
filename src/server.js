// The fully configured Express application — all middleware and routes already
// registered. Importing it here does NOT start listening; that happens below.
const app = require('./app');

// Centralised env config — reads PORT and other variables with defaults applied.
const env = require('./config/env');

// Shared Prisma client singleton — imported so gracefulShutdown can call
// prisma.$disconnect() to cleanly close all database connections on exit.
const prisma = require('./config/prisma-client');

// Factory function that registers the appointment reminder cron job with node-cron.
// Calling it once here starts the job for the lifetime of the process.
const startReminderJob = require('./jobs/appointmentReminder.job');

// Read the port from env once and store it in a local constant for clarity.
const PORT = env.PORT;

// app.listen() binds the HTTP server to the given port and starts accepting connections.
// It returns a net.Server instance (`server`) which is needed later to stop accepting
// new connections during graceful shutdown without killing in-flight requests.
// The callback fires once the port is successfully bound — a good place to log the
// URL and kick off background jobs that should only run when the server is ready.
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 Swagger docs: http://localhost:${PORT}/api/docs`);

    // Start the cron job inside the listen callback so it only begins scheduling
    // after the server is confirmed to be up. Avoids reminder emails firing during
    // a failed startup sequence.
    startReminderJob();
});

// gracefulShutdown stops the server cleanly instead of killing it mid-request.
// The pattern is: stop accepting new connections → wait for in-flight requests to
// finish → close DB connections → exit with code 0 (success).
// It accepts a `signal` string purely for informative logging.
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);

    // server.close() stops the server from accepting new connections.
    // The callback fires once all existing connections have ended naturally.
    // Any requests already in progress are allowed to complete before the callback runs.
    server.close(async () => {
        console.log('🔌 HTTP server closed.');

        // prisma.$disconnect() drains the connection pool and closes all open
        // TCP connections to the database. Skipping this can leave dangling connections
        // that the database server must eventually time out on its own.
        await prisma.$disconnect();
        console.log('🗄️  Database connection closed.');

        // process.exit(0) terminates the Node.js process with exit code 0,
        // which signals success to the OS / container orchestrator (Docker, k8s).
        process.exit(0);
    });

    // Safety net: if the server hasn't finished closing within 10 seconds
    // (e.g. a long-lived WebSocket or keep-alive connection is holding it open),
    // force-exit with code 1 to signal an abnormal shutdown.
    // Without this timeout the process could hang indefinitely.
    setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout.');
        process.exit(1);
    }, 10000);
};

// SIGTERM is the standard termination signal sent by process managers (Docker, PM2,
// systemd, Kubernetes) when they want the process to stop cleanly.
// Registering a handler here overrides the default behaviour (immediate kill)
// and runs gracefulShutdown instead.
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// SIGINT is sent when the user presses Ctrl+C in the terminal.
// Without this handler, Ctrl+C would immediately kill the process (and any in-flight
// DB writes), potentially leaving the database in an inconsistent state.
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// unhandledRejection fires when a Promise rejects and no .catch() / try-catch
// handles the rejection. In older Node versions this was silently swallowed;
// modern Node prints a warning and will crash the process in future versions.
// Triggering gracefulShutdown here ensures the DB is closed before the process exits,
// even in the case of an unexpected async failure.
process.on('unhandledRejection', async (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
    await gracefulShutdown('UNHANDLED_REJECTION');
});
