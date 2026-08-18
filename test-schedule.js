const mongoose = require('mongoose');
const WellnessEngine = require('./modules/engine/wellnessEngine.service');
const CalendarService = require('./modules/calendar/calendar.service');
const User = require('./modules/user/user.model');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://bootbelModerforker:aklogic@cluster0.knqixdj.mongodb.net/bootbel?appName=Cluster0').then(async () => {
  const user = await User.findOne({});
  console.log('Testing for user:', user._id);
  user.shiftType = 'fixed_night';
  await user.save();
  try {
    await WellnessEngine.recalculateNutritionTargets(user._id);
    console.log('Nutrition targets recalculated.');
    await CalendarService.generateSchedule(
      user._id,
      new Date(),
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );
    console.log('Schedule generated successfully.');
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
});
