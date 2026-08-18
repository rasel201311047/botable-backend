const express = require('express');
const router = express.Router();
const EngineController = require('./engine.controller');
const { protect } = require('../../middlewares/auth.middleware');

router.get('/startup', EngineController.getStartupState);
router.get('/context', protect, EngineController.getContext);

module.exports = router;
