// nodemailer is the core email-sending library for Node.js.
// It does not send emails itself — it delegates to a "transport" (SMTP, Mailtrap, SES, etc.)
// that you configure separately.
const nodemailer = require('nodemailer');

// MailtrapTransport is an official Mailtrap plugin for Nodemailer.
// It wraps the Mailtrap API so emails are captured in the Mailtrap sandbox
// instead of being delivered to real inboxes — safe for development and testing.
const { MailtrapTransport } = require('mailtrap');

// Centralised env config — all environment variables are read from here
// instead of directly from process.env, so missing vars are caught in one place.
const env = require('./env');

// Start with null so callers (sendEmail.js) can check `if (!transporter)` and
// skip sending gracefully when no transport is configured.
let transporter = null;

// Only initialise the transporter when the Mailtrap API token is present.
// This makes the email feature opt-in: the server boots normally even without
// email credentials configured, it just won't send emails.
if (env.MAILTRAP_TOKEN) {

    // nodemailer.createTransport() accepts any transport object or options.
    // MailtrapTransport({ token }) returns a transport object pre-configured
    // to authenticate with the Mailtrap API using the supplied token.
    // The resulting `transporter` exposes a .sendMail() method used by sendEmail.js.
    transporter = nodemailer.createTransport(
        MailtrapTransport({ token: env.MAILTRAP_TOKEN })
    );

    console.log('✅ Mailtrap transport initialized');
} else {
    // Warn (not error) so the process keeps running.
    // Any call to sendEmail.js will silently no-op when transporter is null.
    console.warn('⚠️  MAILTRAP_TOKEN missing — emails will be skipped.');
}

// Export the transporter instance (or null).
// sendEmail.js imports this and guards against null before calling .sendMail().
module.exports = transporter;
