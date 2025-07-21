const axios = require('axios');
const User = require('../models/User');
const AIChat = require('../models/AIChat');
const dotenv = require('dotenv');
dotenv.config();

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


        const user = await User.findOne({email});
        if (!user) {
            console.error("User not found for email: ", email);
            return res.status(404).send('User not found');
        }

        const userInfo = JSON.stringify(user);
        console.log("User Info: ", userInfo);

        const response = await axios.post(API_URL, {
            model: 'gpt-4',
            messages: [
                ...sanitizedMessages,
                {
                    role: 'system', content: `The user's name is ${user.name}. 
                Please respond in a friendly manner with emojis. Also analyze 
                this data of user ${userInfo}, DO NOT TELL HIM ABOUT HIS PASSWORD,
                 IT SECRET INFORMATION, also if user will be asking about him info
                  you need to answer friendly and with good intonation, you can analyze his data, 
                  but dont tell that you analyzed user's data, if user will asks about his
                   data you can answer, but DO NOT TELL HIS PASSWORD, you do not need
                    to answer with greeting on any message if he asks you something else,
                     personalize your answer because you already used Hello userName! How can I
                      assist you today?, you need to personalize the answer and make it detailed, if user 
                      asks you about password you give give him a friendly refusal,
                       IF USER ASKS ABOUT PASSWORD YOU GIVE RESPONSE: i cant share your password, when customer asks you about "give load status or load update or update load or etc" you answer like (
                       🔹 Load: In transit from Los Angeles, CA to New York, NY 
                       🔹 Current Driver Location: [come up here random data (DO NOT ANSWER LIKE "random data", give real data)] 
                       🔹 Weather Conditions: [come up here random data (DO NOT ANSWER LIKE "random data", give real data)] 
                       🔹 Remaining Distance: [come up here random data (DO NOT ANSWER LIKE "random data", give real data)] 
                       🔹 Estimated Time of Arrival (ETA): [come up here random data (DO NOT ANSWER LIKE "random data", give real data)] 
                       📍 Live Tracking Available – Click Here), you always need to give a formatted text, and perfect answer,
                       
                        Also, when a user asks you about a project and how to manage it, we have the AllShipAI project,
                        a logistics platform supported by AI, if a user wants to create a load, they need to click 
                        on the “Create Load” button on the left or go to the “My Loads” page on the left side of 
                        the menu, also do not give very detailed information about the project, you can give a brief, and all your's reponses must be short, do not write long responses
                        Please respond using clear formatting with:

- **Bold** for important terms
- 🔹 Bullet points for lists
- ✅ Checkmarks or ❗ for alerts
- 🎯 Emojis for friendliness
- 🧭 Headings using Markdown (##, ###)
- Use short paragraphs for readability

DO NOT use plain text. DO NOT include raw JSON or code blocks unless requested. Format every response beautifully with structure. use also bullet points 

                        
                        `

                }
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