// dotenv reads a `.env` file from the project root and copies each key=value pair
// into process.env, making them available to the rest of the Node.js process.
// It is a no-op if the file doesn't exist, so production environments can rely
// on real environment variables set by the host (Docker, Railway, etc.) instead.
const dotenv = require('dotenv');

// dotenv.config() must be called before any process.env reads happen.
// Calling it here — at module load time, before the export — guarantees that
// every other file that imports env.js already has process.env populated.
dotenv.config();

// Export a plain object of validated, defaulted env vars.
// All other modules import from here instead of reading process.env directly so:
//   1. Defaults and types live in one place.
//   2. A missing required var is easy to spot (no default → value is undefined).
//   3. Renaming a var only requires a change here, not across the whole codebase.
module.exports = {
    // The TCP port the Express server listens on.
    // Defaults to 3000 for local development; override in production via PORT env var.
    PORT: process.env.PORT || 3000,

    // Full PostgreSQL connection string used by Prisma.
    // The fallback points to a local DB named "clinic" — useful for quick local setup
    // without a .env file, but should always be overridden in staging/production.
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/clinic',

    // Secret key used to sign and verify JWTs.
    // The fallback 'secret' is intentionally weak — it exists only so the server
    // can start during development without a .env file. Never use it in production.
    JWT_SECRET: process.env.JWT_SECRET || 'secret',

    // How long a signed JWT remains valid (e.g. '2d', '1h', '15m').
    // Parsed by the `jsonwebtoken` library's `expiresIn` option.
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '2d',

    // Mailtrap API token for the email sandbox transport (see config/mail.js).
    // No default — undefined signals mail.js to skip transport initialisation,
    // so the server runs fine without email credentials configured.
    MAILTRAP_TOKEN: process.env.MAILTRAP_TOKEN,

    // The "From" address shown in outgoing emails (e.g. 'Clinic <no-reply@clinic.com>').
    // No default — if missing, Nodemailer will use whatever the transport provides,
    // or sendEmail.js should guard against it before calling .sendMail().
    EMAIL_FROM: process.env.EMAIL_FROM,

    // Base URL of the frontend app — used in CORS configuration and email links.
    // Defaults to localhost:3000 for local development.
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
};
