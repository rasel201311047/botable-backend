const express = require('express');
const router = express.Router();
const WishlistController = require('./wishlist.controller');

// Public route to join wishlist
router.post('/', WishlistController.joinWishlist);

module.exports = router;
