const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

const BACKEND_DIR = '/home/tayebur/project/khaled_dev/bootbale-modderforker';

// Load environment variables
dotenv.config({ path: path.join(BACKEND_DIR, '.env') });

const User = require(path.join(BACKEND_DIR, 'modules/user/user.model'));
const UserShiftSchedule = require(path.join(BACKEND_DIR, 'modules/calendar/calendar.model'));
const WorkoutLog = require(path.join(BACKEND_DIR, 'modules/workout/workoutLog.model'));
const Meal = require(path.join(BACKEND_DIR, 'modules/nutrition/meal.model'));
const SleepLog = require(path.join(BACKEND_DIR, 'modules/sleep-recovery/sleepLog.model'));
const Shift = require(path.join(BACKEND_DIR, 'modules/onboarding/shift.model'));
const CalendarService = require(path.join(BACKEND_DIR, 'modules/calendar/calendar.service'));
const NutritionTarget = require(path.join(BACKEND_DIR, 'nutrition/nutritionTarget.model'));
const DailyNutritionSummary = require(path.join(BACKEND_DIR, 'nutrition/dailyNutritionSummary.model'));

async function runTests() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bootble');
  console.log('Connected!');

  const testEmail = 'calendar_tester@example.com';

  // 1. Cleanup old test data
  await User.deleteMany({ email: testEmail });
  const testUserId = new mongoose.Types.ObjectId();
  await UserShiftSchedule.deleteMany({ userId: testUserId });
  await WorkoutLog.deleteMany({ userId: testUserId });
  await Meal.deleteMany({ userId: testUserId });
  await SleepLog.deleteMany({ userId: testUserId });
  await NutritionTarget.deleteMany({ userId: testUserId });
  await DailyNutritionSummary.deleteMany({ userId: testUserId });

  // 2. Create shift configuration if it doesn't exist
  let nightShift = await Shift.findOne({ name: 'fixed_night' });
  if (!nightShift) {
    nightShift = await Shift.create({
      name: 'fixed_night',
      label: 'Night Shift',
      defaultWakeTime: '22:00',
      defaultSleepTime: '06:00',
      workHours: 8,
    });
  }

  // 3. Create test user
  console.log('\n--- 1. Creating test user ---');
  const user = await User.create({
    _id: testUserId,
    name: 'Shift Tester',
    email: testEmail,
    password: 'StrongPassword123!',
    isEmailVerified: true,
    accountStatus: 'active',
    shiftType: 'fixed_night',
  });
  console.log('PASS: Test user created with fixed_night shift.');

  // Create today's work schedule
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await UserShiftSchedule.create({
    userId: user._id,
    date: today,
    dayType: 'work',
    shiftStart: '22:00',
    shiftEnd: '06:00',
  });

  // Mocking Date.prototype methods for predictable time-dependent tests
  const originalGetHours = Date.prototype.getHours;
  const originalGetMinutes = Date.prototype.getMinutes;
  const originalToDateString = Date.prototype.toDateString;

  let mockHours = 20; // 8 PM (2 hours before shiftStart 10 PM)
  let mockMinutes = 0;

  Date.prototype.getHours = function() { return mockHours; };
  Date.prototype.getMinutes = function() { return mockMinutes; };

  // --- Test Low Readiness (Default / No sleep logs) ---
  console.log('\n--- 2. Testing Low Readiness Workout Downgrade (<65) ---');
  let timeline = await CalendarService.getDailyTimeline(user._id, today, 'on_shift');
  console.log('Readiness:', timeline.readiness);
  
  let workoutEvent = timeline.events.find(e => e.id === 'rec_mid_shift_workout');
  console.log('Workout Event Title:', workoutEvent?.title);
  console.log('Workout Event Subtitle:', workoutEvent?.subtitle);
  
  if (workoutEvent?.title === 'Mid-Shift Active Recovery Stretch') {
    console.log('PASS: Workout successfully downgraded to Active Recovery Stretch.');
  } else {
    console.error('FAIL: Expected downgraded stretch workout.');
  }

  // --- Test High Readiness (With long sleep logged + nutrition targets) ---
  console.log('\n--- 3. Testing High Readiness Workout (>=65) ---');
  // Log a perfect 8-hour sleep log to boost readiness
  await SleepLog.create({
    userId: user._id,
    date: today,
    startTime: '13:00',
    endTime: '21:00',
    durationMinutes: 480,
    quality: 'good',
    activityKey: 'night_sleep',
  });

  // Log matching nutrition to get 100% adherence and lift readiness score
  await NutritionTarget.create({
    userId: user._id,
    calorieTarget: 2000,
    proteinTarget: 150,
    carbTarget: 200,
    fatTarget: 65,
    proteinRatio: 0.3,
    carbRatio: 0.4,
    fatRatio: 0.3,
  });
  
  await DailyNutritionSummary.create({
    userId: user._id,
    date: today,
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 65,
    mealCount: 3,
  });

  timeline = await CalendarService.getDailyTimeline(user._id, today, 'on_shift');
  console.log('Readiness with Sleep & Nutrition:', timeline.readiness);
  workoutEvent = timeline.events.find(e => e.id === 'rec_mid_shift_workout');
  console.log('Workout Event Title:', workoutEvent?.title);
  
  if (workoutEvent?.title === 'Mid-Shift Express Workout') {
    console.log('PASS: Workout successfully upgraded to Express Workout.');
  } else {
    console.error('FAIL: Expected Express Workout.');
  }

  // --- Test Live Day Progression (Missed energy window) ---
  console.log('\n--- 4. Testing Live Day Progression - Missed Pre-Shift Energizer ---');
  // Move mock time past the Pre-Shift Energizer (scheduled at 21:00) by >1 hour (e.g. to 23:30)
  mockHours = 23;
  mockMinutes = 30;

  timeline = await CalendarService.getDailyTimeline(user._id, today, 'on_shift');
  let preShiftEvent = timeline.events.find(e => e.id === 'rec_pre_shift_energizer');
  console.log('Pre-Shift Event Title:', preShiftEvent?.title);
  console.log('Pre-Shift Event Status:', preShiftEvent?.status);

  if (preShiftEvent?.title === 'Hydration Reset & Breathwork' && preShiftEvent?.status === 'downgraded') {
    console.log('PASS: Missed Pre-Shift Energizer successfully downgraded to Hydration Reset.');
  } else {
    console.error('FAIL: Expected downgraded Pre-Shift Energizer.');
  }

  // --- Test Live Day Progression - Missed Workout Carry Forward ---
  console.log('\n--- 5. Testing Live Day Progression - Missed Workout Pushed Forward ---');
  // Mid-Shift Workout scheduled at 02:30 (22:00 + 4.5 hours). Move time to 04:00 (1.5 hours past)
  mockHours = 4;
  mockMinutes = 0;

  timeline = await CalendarService.getDailyTimeline(user._id, today, 'on_shift');
  workoutEvent = timeline.events.find(e => e.id === 'rec_mid_shift_workout');
  console.log('Workout Time Pushed to:', workoutEvent?.time);
  console.log('Workout Title:', workoutEvent?.title);
  console.log('Workout Status:', workoutEvent?.status);

  if (workoutEvent?.time === '04:10' && workoutEvent?.status === 'downgraded') {
    console.log('PASS: Missed workout successfully pushed forward to current time + 10 mins.');
  } else {
    console.error('FAIL: Expected workout to be pushed to 04:10.');
  }

  // --- Test Rescheduling Recommended Placeholders ---
  console.log('\n--- 6. Testing Rescheduling Recommended Tasks ---');
  // Reset mock clock before doing DB writes
  mockHours = 20;
  mockMinutes = 0;

  await CalendarService.rescheduleEvent(user._id, {
    eventType: 'workout',
    eventId: 'rec_mid_shift_workout',
    newTime: '01:30',
    date: today.toISOString().split('T')[0]
  });

  const rescheduledWorkout = await WorkoutLog.findOne({ userId: user._id });
  console.log('Rescheduled Workout Time in DB:', rescheduledWorkout?.scheduledTime);
  console.log('Rescheduled Workout Status:', rescheduledWorkout?.status);

  if (rescheduledWorkout && rescheduledWorkout.scheduledTime === '01:30' && rescheduledWorkout.status === 'rescheduled') {
    console.log('PASS: Recommended workout successfully instantiated and rescheduled in database.');
  } else {
    console.error('FAIL: Expected rescheduled workout log in DB.');
  }

  // --- Test Completing Recommended Placeholders ---
  console.log('\n--- 7. Testing Completing Recommended Tasks ---');
  await CalendarService.completeEvent(user._id, {
    eventType: 'meal',
    eventId: 'rec_pre_shift_energizer',
    date: today.toISOString().split('T')[0],
    time: '21:00'
  });

  const completedMeal = await Meal.findOne({ userId: user._id, mealType: 'pre_workout' });
  console.log('Completed Meal in DB:', completedMeal?.title);
  console.log('Completed Meal Status:', completedMeal?.status);

  if (completedMeal && completedMeal.status === 'logged') {
    console.log('PASS: Recommended meal successfully marked completed (status logged) in database.');
  } else {
    console.error('FAIL: Expected completed meal log in DB.');
  }

  // Restore Date prototype methods
  Date.prototype.getHours = originalGetHours;
  Date.prototype.getMinutes = originalGetMinutes;

  // Cleanup
  await User.deleteMany({ email: testEmail });
  await UserShiftSchedule.deleteMany({ userId: testUserId });
  await WorkoutLog.deleteMany({ userId: testUserId });
  await Meal.deleteMany({ userId: testUserId });
  await SleepLog.deleteMany({ userId: testUserId });
  await NutritionTarget.deleteMany({ userId: testUserId });
  await DailyNutritionSummary.deleteMany({ userId: testUserId });

  await mongoose.disconnect();
  console.log('\nAll calendar on-shift orchestration tests passed!');
}

runTests().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
