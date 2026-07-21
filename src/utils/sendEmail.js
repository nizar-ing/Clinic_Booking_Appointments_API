const transporter = require('../config/mail');
const env = require('../config/env');

// Utility to send an email
const sendEmail = async ({ to, subject, html }) => {
    if (!transporter) return;
    try {
        const mailOptions = {
            from: env.EMAIL_FROM,
            to,
            subject,
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Email sent: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
        // Don't throw - email failure should not break the main flow
    }
};

module.exports = sendEmail;
