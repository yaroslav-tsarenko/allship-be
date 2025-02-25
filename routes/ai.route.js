const express = require('express');
const { sendMessage } = require('../controllers/ai.controller');
const router = express.Router();

router.post('/send-message', sendMessage);

module.exports = router;