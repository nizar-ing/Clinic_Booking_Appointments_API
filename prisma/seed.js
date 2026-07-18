require('dotenv/config');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Seeding database...');

    // Hash passwords
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create Admin user
    const admin = await prisma.user.upsert({
        where: { email: 'admin@clinic.com' },
        update: {},
        create: {
            name: 'Admin User',
            email: 'admin@clinic.com',
            password: hashedPassword,
            role: 'ADMIN',
        },
    });

    // Create Patient users
    const patient1 = await prisma.user.upsert({
        where: { email: 'patient1@example.com' },
        update: {},
        create: {
            name: 'John Doe',
            email: 'patient1@example.com',
            password: hashedPassword,
            role: 'PATIENT',
        },
    });

    const patient2 = await prisma.user.upsert({
        where: { email: 'patient2@example.com' },
        update: {},
        create: {
            name: 'Jane Smith',
            email: 'patient2@example.com',
            password: hashedPassword,
            role: 'PATIENT',
        },
    });

    // Create Doctors
    const doctors = await Promise.all([
        prisma.doctor.upsert({
            where: { email: 'dr.ahmed@clinic.com' },
            update: {},
            create: {
                name: 'Dr. Ahmed Hassan',
                specialization: 'General Medicine',
                bio: 'Experienced general practitioner with 10 years of practice.',
                email: 'dr.ahmed@clinic.com',
                phone: '+1234567890',
            },
        }),
        prisma.doctor.upsert({
            where: { email: 'dr.sara@clinic.com' },
            update: {},
            create: {
                name: 'Dr. Sara Ali',
                specialization: 'Dermatology',
                bio: 'Specialist in skin care and dermatological treatments.',
                email: 'dr.sara@clinic.com',
                phone: '+1234567891',
            },
        }),
        prisma.doctor.upsert({
            where: { email: 'dr.omar@clinic.com' },
            update: {},
            create: {
                name: 'Dr. Omar Khalid',
                specialization: 'Pediatrics',
                bio: 'Caring pediatrician dedicated to child health.',
                email: 'dr.omar@clinic.com',
                phone: '+1234567892',
            },
        }),
        prisma.doctor.upsert({
            where: { email: 'dr.fatima@clinic.com' },
            update: {},
            create: {
                name: 'Dr. Fatima Noor',
                specialization: 'Cardiology',
                bio: 'Heart specialist with advanced training in cardiac care.',
                email: 'dr.fatima@clinic.com',
                phone: '+1234567893',
            },
        }),
        prisma.doctor.upsert({
            where: { email: 'dr.youssef@clinic.com' },
            update: {},
            create: {
                name: 'Dr. Youssef Mansour',
                specialization: 'Orthopedics',
                bio: 'Expert in bone and joint treatments.',
                email: 'dr.youssef@clinic.com',
                phone: '+1234567894',
            },
        }),
    ]);

    // Create Clinic Services
    const services = await Promise.all([
        prisma.clinicService.create({
            data: {
                name: 'General Consultation',
                description: 'Basic health checkup and consultation.',
                price: 50.0,
                durationMinutes: 30,
            },
        }),
        prisma.clinicService.create({
            data: {
                name: 'Skin Examination',
                description: 'Full skin checkup and diagnosis.',
                price: 80.0,
                durationMinutes: 45,
            },
        }),
        prisma.clinicService.create({
            data: {
                name: 'Child Vaccination',
                description: 'Routine vaccination for children.',
                price: 40.0,
                durationMinutes: 20,
            },
        }),
        prisma.clinicService.create({
            data: {
                name: 'Heart Checkup',
                description: 'Comprehensive cardiac evaluation.',
                price: 150.0,
                durationMinutes: 60,
            },
        }),
        prisma.clinicService.create({
            data: {
                name: 'X-Ray & Imaging',
                description: 'Bone and joint X-ray imaging.',
                price: 100.0,
                durationMinutes: 30,
            },
        }),
    ]);

    // Create Doctor Slots (for the first doctor, next 3 days)
    const today = new Date();
    const slots = [];

    for (let dayOffset = 1; dayOffset <= 3; dayOffset++) {
        const slotDate = new Date(today);
        slotDate.setDate(today.getDate() + dayOffset);
        slotDate.setHours(0, 0, 0, 0);

        const timeSlots = [
            { start: '09:00', end: '09:30' },
            { start: '09:30', end: '10:00' },
            { start: '10:00', end: '10:30' },
            { start: '10:30', end: '11:00' },
            { start: '11:00', end: '11:30' },
        ];

        for (const time of timeSlots) {
            slots.push({
                doctorId: doctors[0].id,
                date: slotDate,
                startTime: time.start,
                endTime: time.end,
                isBooked: false,
            });
        }
    }

    await prisma.doctorSlot.createMany({ data: slots });

    console.log('✅ Seed data created successfully!');
    console.log('---');
    console.log('Admin: admin@clinic.com / password123');
    console.log('Patient 1: patient1@example.com / password123');
    console.log('Patient 2: patient2@example.com / password123');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
