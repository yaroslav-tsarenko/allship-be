const express = require('express');
const { sendMessage, createAIChat, renameChat, getSelectedAIChat, deleteChat, getAllChats } = require('../controllers/ai.controller');
const router = express.Router();

router.post('/send-message', sendMessage);
router.post('/create-ai-chat', createAIChat);
router.get('/get-all-chats', getAllChats);
router.post('/rename-chat', renameChat);
router.delete('/delete-chat', deleteChat);
router.get('/get-selected-ai-chat', getSelectedAIChat);

module.exports = router;