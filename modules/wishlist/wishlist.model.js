const mongoose = require('mongoose');
const validator = require('validator');

const wishlistSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      trim: true,
      lowercase: true,
      validate: [validator.isEmail, 'Please provide a valid email address'],
    },
    source: {
      type: String,
      default: 'landing_page',
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

wishlistSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Wishlist', wishlistSchema);
