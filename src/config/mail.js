const nodemailer = require('nodemailer');
const env = require('./env');

const isEmailConfigured = !!(env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASS);

let transporter = null;

if (isEmailConfigured) {
    transporter = nodemailer.createTransport({
        host: env.EMAIL_HOST,
        port: env.EMAIL_PORT,
        secure: env.EMAIL_PORT === 465,
        auth: {
            user: env.EMAIL_USER,
            pass: env.EMAIL_PASS,
        },
    });

    transporter.verify()
        .then(() => console.log('✅ Mail server connection verified'))
        .catch((err) => console.warn('⚠️  Mail server connection failed:', err.message));
} else {
    console.warn('⚠️  Email not configured — EMAIL_HOST/USER/PASS missing. Emails will be skipped.');
}

module.exports = transporter;
