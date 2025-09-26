const axios = require('axios');
const User = require('../models/User');
const AIChat = require('../models/AIChat');
const dotenv = require('dotenv');
dotenv.config();
const Load = require('../models/Load');

const API_KEY = process.env.OPENAI_KEY;
const API_URL = 'https://api.openai.com/v1/chat/completions';


const sendMessage = async (req, res) => {
    const {messages, email, aiChatId} = req.body;
    try {
        console.log("Request Body: ", req.body);

        const sanitizedMessages = messages
            .filter(m => m.content && typeof m.content === 'string' && m.content !== 'No data')
            .map(m => ({
                role: m.role,
                content: m.content.trim()
            }));

        const user = await User.findOne({email}).lean();
        if (!user) {
            console.error("User not found for email: ", email);
            return res.status(404).send('User not found');
        }

        // Remove password from user info
        const {password, ...userSafe} = user;

        // Fetch all user's Loads
        const loads = await Load.find({userId: user._id}).lean();

        // Prepare info for the system prompt
        const userInfo = JSON.stringify(userSafe);
        const loadsInfo = JSON.stringify(loads);

        const systemPrompt = `
The user's name is ${userSafe.name}.
Here is the user's profile: ${userInfo}
Here are all user's Loads: ${loadsInfo}
DO NOT TELL HIM ABOUT HIS PASSWORD, IT IS SECRET INFORMATION.
If the user asks about his profile, you can answer, but DO NOT TELL HIS PASSWORD.
... [rest of your instructions as before]
`;

        const response = await axios.post(API_URL, {
            model: 'gpt-4',
            messages: [
                ...sanitizedMessages,
                { role: 'system', content: systemPrompt }
            ],
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log("GPT-4 Response: ", response.data);

        const botReply = response.data.choices[0].message;

        if (aiChatId) {
            const chat = await AIChat.findById(aiChatId);
            if (chat) {
                console.log("Found AI Chat: ", chat);
                chat.messages.push({sender: 'user', text: messages[messages.length - 1].content});
                chat.messages.push({sender: 'bot', text: botReply.content});
                await chat.save();
                console.log("Updated AI Chat: ", chat);
            }
        }

        res.json({message: botReply});
    } catch (error) {
        console.error('Error fetching response:', error);
        console.error('Stack Trace: ', error.stack);
        res.status(500).send('Error fetching response');
    }
};

const createAIChat = async (req, res) => {
    const {userId} = req.body;
    try {
        const existingChats = await AIChat.find({userId});
        const chatNumber = existingChats.length > 0 ? existingChats.length : 0;
        const chatName = chatNumber === 0 ? "New Chat" : `New Chat ${chatNumber}`;

        const newAIChat = new AIChat({
            userId,
            name: chatName,
            messages: [{sender: "No data", text: "No data"}],
            createdAt: new Date(),
        });

        await newAIChat.save();
        res.status(201).json(newAIChat);
    } catch (error) {
        res.status(500).json({message: 'Error creating AI chat', error});
    }
};

const getAllChats = async (req, res) => {
    const {userId} = req.query;
    try {
        const chats = await AIChat.find({userId});
        res.status(200).json(chats);
    } catch (error) {
        res.status(500).json({message: 'Error fetching chats', error});
    }
};

const renameChat = async (req, res) => {
    const {chatId, newName} = req.body;
    try {
        const chat = await AIChat.findById(chatId);
        if (!chat) {
            return res.status(404).json({message: 'Chat not found'});
        }
        chat.name = newName;
        await chat.save();
        res.status(200).json({message: 'Chat renamed successfully'});
    } catch (error) {
        res.status(500).json({message: 'Error renaming chat', error});
    }
};

const deleteChat = async (req, res) => {
    const {chatId} = req.body;
    console.log("Received request: ", req.body);

    if (!chatId) {
        return res.status(400).json({message: 'Chat ID is required'});
    }

    try {
        const chat = await AIChat.findById(chatId);
        if (!chat) {
            console.log("Chat not found for ID: ", chatId);
            return res.status(404).json({message: 'Chat not found'});
        }
        await chat.deleteOne();
        console.log("Chat deleted successfully for ID: ", chatId);
        res.status(200).json({message: 'Chat deleted successfully'});
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({message: 'Error deleting chat', error});
    }
};

const getSelectedAIChat = async (req, res) => {
    const {aiChatId} = req.query;
    try {
        const chat = await AIChat.findById(aiChatId);
        if (!chat) {
            return res.status(404).json({message: 'Chat not found'});
        }
        res.status(200).json(chat);
    } catch (error) {
        res.status(500).json({message: 'Error fetching chat', error});
    }
};

module.exports = {
    sendMessage,
    createAIChat,
    getAllChats,
    renameChat,
    deleteChat,
    getSelectedAIChat
};