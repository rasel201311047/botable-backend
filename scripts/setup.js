const mongoose = require('mongoose');
const User = require('../modules/user/user.model');
const Shift = require('../modules/onboarding/shift.model');
const Goal = require('../modules/onboarding/goal.model');
const RecoveryActivity = require('../modules/sleep-recovery/recoveryActivity.model');
const Workout = require('../modules/workout/workout.model');
const logger = require('../utils/logger');

class SetupScript {
    /**
     * Run all setup tasks
     */
    static async run() {
        try {
            logger.info('Starting application setup...');

            // Connect to database
            await this.connectDatabase();

            // Create admin user
            await this.createAdminUser();

            // Seed default data
            await this.seedDefaultData();

            logger.info('Application setup completed successfully');
            process.exit(0);
        } catch (error) {
            logger.error(`Setup failed: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * Connect to database
     */
    static async connectDatabase() {
        try {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bootble_fitness');
            logger.info('Database connected successfully');
        } catch (error) {
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }

    /**
     * Create admin user
     */
    static async createAdminUser() {
        try {
            // Delete any existing admin
            await User.deleteMany({ email: 'admin@bootble.com' });
            logger.info('Deleted existing admin users');

            // Create admin user
            const admin = new User({
                name: 'Admin',
                email: 'admin@bootble.com',
                password: 'Admin@123', // Change this in production!
                role: 'admin',
                isEmailVerified: true,
                onboardingCompleted: true,
                shiftType: 'rotating',
                goalType: 'maintenance',
                subscription: {
                    plan: 'yearly',
                    isActive: true,
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
                },
            });

            logger.info('Attempting to save admin user...');
            await admin.save();
            logger.info('Admin user created successfully');
        } catch (error) {
            throw new Error(`Failed to create admin user: ${error.message}`);
        }
    }

    /**
     * Seed default data
     */
    static async seedDefaultData() {
        try {
            // Seed shifts
            const shifts = [
                {
                    name: 'fixed_night',
                    displayName: 'Fixed Night',
                    description: 'Consistent overnight schedule, usually 10pm–6am',
                    defaultWakeTime: '18:00',
                    defaultSleepTime: '10:00',
                    tags: ['sleep', 'workout', 'recovery'],
                    isActive: true,
                },
                {
                    name: 'rotating',
                    displayName: 'Rotating Shifts',
                    description: 'Schedule changes weekly or bi-weekly',
                    defaultWakeTime: '06:00',
                    defaultSleepTime: '22:00',
                    tags: ['sleep', 'workout', 'recovery', 'calendar'],
                    isActive: true,
                },
                {
                    name: 'early_morning',
                    displayName: 'Early Mornings',
                    description: 'Starting before 6am, early wake times',
                    defaultWakeTime: '04:00',
                    defaultSleepTime: '20:00',
                    tags: ['sleep', 'workout', 'calendar'],
                    isActive: true,
                },
            ];

            for (const shift of shifts) {
                await Shift.findOneAndUpdate({ name: shift.name }, shift, { upsert: true });
            }
            logger.info('Shifts seeded successfully');

            // Seed goals
            const goals = [
                {
                    name: 'fat_loss',
                    displayName: 'Fat Loss',
                    description: 'Support healthy fat reduction through smart routines',
                    calorieAdjustment: -15,
                    proteinRatio: 0.4,
                    carbRatio: 0.35,
                    fatRatio: 0.25,
                    tags: ['weight', 'workout', 'recovery'],
                    isActive: true,
                },
                {
                    name: 'strength_building',
                    displayName: 'Strength Building',
                    description: 'Increase force output and muscular efficiency safely',
                    calorieAdjustment: 10,
                    proteinRatio: 0.35,
                    carbRatio: 0.45,
                    fatRatio: 0.2,
                    tags: ['sleep', 'workout', 'recovery', 'calendar'],
                    isActive: true,
                },
                {
                    name: 'maintenance',
                    displayName: 'Maintenance',
                    description: 'Maintain current fitness levels while supporting health',
                    calorieAdjustment: 0,
                    proteinRatio: 0.3,
                    carbRatio: 0.4,
                    fatRatio: 0.3,
                    tags: ['weight', 'workout'],
                    isActive: true,
                },
            ];

            for (const goal of goals) {
                await Goal.findOneAndUpdate({ name: goal.name }, goal, { upsert: true });
            }
            logger.info('Goals seeded successfully');

            // Seed recovery activities
            const recoveryActivities = [
                {
                    key: 'post_shift_wind_down',
                    title: 'Post-Shift Wind Down',
                    description: 'Gentle sessions to help your mind transition from work mode.',
                    minDuration: 5,
                    maxDuration: 15,
                    timingTag: 'after_shift',
                    applicableShifts: ['fixed_night', 'rotating', 'early_morning'],
                    color: '#8B5CF6',
                    instructions:
                        'Find a quiet space, practice deep breathing for 5-15 minutes, avoid screens.',
                    order: 1,
                    isActive: true,
                },
                {
                    key: 'daytime_sleep',
                    title: 'Daytime Sleep',
                    description: 'Deep relaxation designed for night-shift workers.',
                    minDuration: 20,
                    maxDuration: 45,
                    timingTag: 'sleep',
                    applicableShifts: ['fixed_night', 'rotating'],
                    color: '#10B981',
                    instructions:
                        'Use blackout curtains, eye mask, and white noise. Keep naps under 45 minutes to avoid sleep inertia.',
                    order: 2,
                    isActive: true,
                },
                {
                    key: 'nervous_system_reset',
                    title: 'Nervous System Reset',
                    description: 'Calm your nervous system with guided relaxation.',
                    minDuration: 10,
                    maxDuration: 30,
                    timingTag: 'any_time',
                    applicableShifts: ['fixed_night', 'rotating', 'early_morning'],
                    color: '#3B82F6',
                    instructions:
                        'Use guided meditation apps, progressive muscle relaxation, or gentle stretching.',
                    order: 3,
                    isActive: true,
                },
                {
                    key: 'pre_shift_focus',
                    title: 'Pre-Shift Focus',
                    description: 'Prepare your mind and body for an upcoming shift.',
                    minDuration: 5,
                    maxDuration: 20,
                    timingTag: 'before_shift',
                    applicableShifts: ['fixed_night', 'rotating', 'early_morning'],
                    color: '#F59E0B',
                    instructions: 'Light exercise, caffeine timing (if appropriate), mental preparation.',
                    order: 4,
                    isActive: true,
                },
            ];

            for (const activity of recoveryActivities) {
                await RecoveryActivity.findOneAndUpdate({ key: activity.key }, activity, { upsert: true });
            }
            logger.info('Recovery activities seeded successfully');

            // Seed default workouts
            const workouts = [
                {
                    title: 'Morning Energy Boost',
                    description: 'Quick full-body workout to start your day with energy',
                    durationMinutes: 15,
                    category: 'hiit',
                    intensity: 'medium',
                    exercises: [
                        { name: 'Jumping Jacks', sets: 3, reps: 30, duration: 30, rest: 15 },
                        { name: 'Bodyweight Squats', sets: 3, reps: 15, rest: 30 },
                        { name: 'Push-ups', sets: 3, reps: 10, rest: 30 },
                        { name: 'Plank', sets: 3, duration: 30, rest: 15 },
                    ],
                    equipment: ['bodyweight'],
                    tags: ['morning', 'quick', 'full-body'],
                    isPublic: true,
                    isActive: true,
                },
                {
                    title: 'Post-Shift Recovery Flow',
                    description: 'Gentle movement to unwind after work',
                    durationMinutes: 20,
                    category: 'yoga',
                    intensity: 'low',
                    exercises: [
                        { name: 'Cat-Cow Stretch', sets: 1, duration: 60 },
                        { name: "Child's Pose", sets: 1, duration: 60 },
                        { name: 'Forward Fold', sets: 1, duration: 60 },
                        { name: 'Legs Up the Wall', sets: 1, duration: 300 },
                    ],
                    equipment: ['bodyweight'],
                    tags: ['recovery', 'post-shift', 'relaxation'],
                    isPublic: true,
                    isActive: true,
                },
                {
                    title: 'Strength Builder',
                    description: 'Full-body strength training session',
                    durationMinutes: 45,
                    category: 'strength',
                    intensity: 'high',
                    exercises: [
                        { name: 'Dumbbell Squats', sets: 4, reps: 8, rest: 60 },
                        { name: 'Dumbbell Bench Press', sets: 4, reps: 8, rest: 60 },
                        { name: 'Bent Over Rows', sets: 4, reps: 10, rest: 60 },
                        { name: 'Shoulder Press', sets: 3, reps: 10, rest: 45 },
                        { name: 'Bicep Curls', sets: 3, reps: 12, rest: 30 },
                    ],
                    equipment: ['dumbbells'],
                    tags: ['strength', 'full-body', 'dumbbells'],
                    isPublic: true,
                    isActive: true,
                },
            ];

            for (const workout of workouts) {
                await Workout.findOneAndUpdate({ title: workout.title, userId: null }, workout, {
                    upsert: true,
                });
            }
            logger.info('Default workouts seeded successfully');
        } catch (error) {
            throw new Error(`Failed to seed default data: ${error.message}`);
        }
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    require('dotenv').config();
    SetupScript.run();
}

module.exports = SetupScript;
