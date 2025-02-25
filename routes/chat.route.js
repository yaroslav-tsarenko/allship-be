const express = require('express');
const router = express.Router();
const { getChats } = require('../controllers/chat.controller');

router.get('/get-all-chats', getChats);

module.exports = router;