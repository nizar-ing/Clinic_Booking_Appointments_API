// node-cron is a scheduler library that runs functions on a cron schedule.
// A cron schedule is a string like '*/30 * * * *' that defines when to run a task.
const cron = require('node-cron');

// Shared Prisma client instance — the single DB connection used across the app.
const prisma = require('../config/prisma-client');

// Thin Nodemailer wrapper: accepts { to, subject, html } and sends the email via the
// configured SMTP transporter. Swallows errors so email failures don't crash the job.
const sendEmail = require('../utils/sendEmail');

// startReminderJob registers the cron task with node-cron.
// It is called once at server startup (from server.js or app.js) and keeps running
// in the background for the lifetime of the process.
const startReminderJob = () => {

    // cron.schedule(expression, callback) registers a recurring task.
    // '*/30 * * * *' means "every 30 minutes, every hour, every day".
    // The five fields are: minute  hour  day-of-month  month  day-of-week
    // '*/30' in the minute field means "when minute % 30 === 0" → :00 and :30.
    cron.schedule('*/30 * * * *', async () => {
        try {
            console.log('⏰ Running appointment reminder job...');

            // Capture the current moment so both boundary values share the exact same
            // reference point and the 24-hour window is consistent throughout the query.
            const now = new Date();

            // tomorrow is exactly 24 hours after now.
            // getTime() returns milliseconds since epoch, so adding 24 * 60 * 60 * 1000
            // (ms per hour × 24) gives the same wall-clock time tomorrow.
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            // Query all BOOKED appointments whose slot falls within the next 24 hours
            // and whose reminder email has not yet been sent.
            const upcomingAppointments = await prisma.appointment.findMany({
                where: {
                    // Only consider appointments that are still active (not cancelled/completed).
                    status: 'BOOKED',

                    // Skip appointments that already received a reminder in a previous run.
                    reminderSent: false,

                    // Filter on the related DoctorSlot record's date field.
                    // Prisma translates this nested `where` into a JOIN + WHERE clause.
                    slot: {
                        date: {
                            // gte (greater than or equal) → slot is not in the past.
                            gte: now,
                            // lte (less than or equal) → slot is within the next 24 hours.
                            lte: tomorrow,
                        },
                    },
                },

                // include tells Prisma to JOIN and eagerly load related records.
                // Only the listed fields are fetched (select) to keep the payload small.
                include: {
                    // Patient's name and email are needed to address and send the reminder.
                    patient: { select: { name: true, email: true } },

                    // Doctor's name is included in the reminder body.
                    doctor: { select: { name: true } },

                    // Service name is shown in the reminder body.
                    service: { select: { name: true } },

                    // Slot date and times appear in the reminder body.
                    slot: { select: { date: true, startTime: true, endTime: true } },
                },
            });

            console.log(`📋 Found ${upcomingAppointments.length} appointments needing reminders.`);

            // Process each qualifying appointment one at a time (sequential await inside
            // a for-of loop). Using Promise.all here would fire all emails in parallel,
            // which could overwhelm the SMTP server for large batches.
            for (const appointment of upcomingAppointments) {

                // Send the reminder email to the patient.
                // sendEmail swallows its own errors, so a failed send does not throw
                // and the loop continues to the next appointment.
                await sendEmail({
                    to: appointment.patient.email,
                    subject: 'Appointment Reminder - Tomorrow',

                    // Multi-line HTML string built with template literals.
                    // appointment.slot.date is a JS Date object; toDateString() converts
                    // it to a human-readable format like "Wed Jul 23 2026".
                    // startTime / endTime are stored as strings (e.g. "09:00", "09:30").
                    html: `
            <h2>Appointment Reminder</h2>
            <p>Dear ${appointment.patient.name},</p>
            <p>This is a reminder for your upcoming appointment:</p>
            <ul>
              <li><strong>Doctor:</strong> ${appointment.doctor.name}</li>
              <li><strong>Service:</strong> ${appointment.service.name}</li>
              <li><strong>Date:</strong> ${appointment.slot.date.toDateString()}</li>
              <li><strong>Time:</strong> ${appointment.slot.startTime} - ${appointment.slot.endTime}</li>
            </ul>
            <p>Please arrive 10 minutes early. See you soon!</p>
          `,
                });

                // Flip reminderSent to true so subsequent job runs skip this appointment.
                // This update happens after sendEmail: if sendEmail throws (unexpectedly),
                // the flag stays false and the patient will receive a second attempt next run.
                await prisma.appointment.update({
                    where: { id: appointment.id },
                    data: { reminderSent: true },
                });
            }

            // Only log the success line when there was actually work to do,
            // to keep log output quiet during runs with no pending reminders.
            if (upcomingAppointments.length > 0) {
                console.log(`✅ Sent ${upcomingAppointments.length} reminder(s).`);
            }
        } catch (error) {
            // Catch-all for unexpected failures (DB down, Prisma error, etc.).
            // Logging the error keeps the process alive — the job will retry on the next tick.
            console.error('❌ Reminder job error:', error.message);
        }
    });

    // Log once at startup to confirm the job was registered successfully.
    console.log('📅 Appointment reminder job scheduled (every 30 minutes).');
};

// Export the setup function so server.js (or app.js) can call it once at boot time.
module.exports = startReminderJob;
