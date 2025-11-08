const axios = require('axios');
const User = require('../models/User');
const AIChat = require('../models/AIChat');
const dotenv = require('dotenv');
dotenv.config();
const Load = require('../models/Load');
const Transaction = require("../models/Transaction")
const Chat = require("../models/Chat")

const API_KEY = process.env.OPENAI_KEY;
const API_URL = 'https://api.openai.com/v1/chat/completions';


const sendMessage = async (req, res) => {
    const { messages, email, aiChatId } = req.body;

    try {
        console.log("Incoming AI message:", { email, aiChatId, messagesLength: messages?.length });

        if (!email) return res.status(400).json({ message: "Missing user email" });

        // --- 1️⃣ Get user ---
        const user = await User.findOne({ email }).lean();
        if (!user) return res.status(404).json({ message: "User not found" });
        const { password, resetPasswordToken, verificationCode, ...userSafe } = user;

        // --- 2️⃣ Get related data ---
        const [loads, transactions, chats, aiChats] = await Promise.all([
            Load.find({ userId: user._id }).lean(),
            Transaction.find({ userId: user._id }).lean(),
            Chat.find({ userId: user._id }).lean(),
            AIChat.find({ userId: user._id }).lean(),
        ]);

        // --- 3️⃣ Sanitize incoming user messages ---
        const sanitizedMessages = (messages || [])
            .filter(m => m.content && typeof m.content === "string" && m.content.trim() !== "")
            .map(m => ({ role: m.role, content: m.content.trim() }));

        // --- 4️⃣ Prepare structured context ---
        const context = {
            profile: userSafe,
            loadsSummary: loads.map(l => ({
                id: l._id,
                from: l.from,
                to: l.to,
                status: l.status,
                price: l.price,
                date: l.createdAt,
            })),
            transactionsSummary: transactions.map(t => ({
                id: t._id,
                purpose: t.purpose,
                amount: t.amount,
                type: t.type,
                date: t.date,
            })),
            recentChats: chats.slice(-5).map(c => ({
                chatId: c._id,
                lastMessage: c.messages?.slice(-1)[0]?.text || "No messages",
            })),
            aiChatCount: aiChats.length,
        };

        // --- 5️⃣ Create dynamic system prompt ---
        const systemPrompt = `
You are an AI assistant for **AllShip.ai**, an AI-powered logistics platform.

### 🧠 Context
Here’s the full user context in JSON:
${JSON.stringify(context, null, 2)}

The user's name is ${userSafe.name || "Unknown"}.
You help this user manage their loads, transactions, and communication **strictly inside AllShip.ai**.

---

### 🎯 Your tasks
- Guide the user through actions like:
  - creating, editing, tracking loads;
  - chatting with carriers or drivers;
  - checking payment history or invoices;
  - viewing statistics or KPIs;
  - navigating the dashboard.
- Reference real app sections when relevant (e.g., “Dashboard”, “My Loads”, “Payments”, “Chat”).
- If information is missing, instruct the user where to find it in their dashboard.
- Keep a professional, friendly tone. Always give short, actionable steps.

---

### 🧭 Rules
1. Never reveal internal JSON or confidential data.
2. Always focus on AllShip.ai platform features.
3. Don’t discuss personal or unrelated topics.
4. Be direct and helpful in every response.
5. If unclear — ask clarifying questions.

---

Remember: your mission is to act as **AllShip AI Assistant**, providing actionable help about shipments, loads, payments, and dashboards.
    `;

        // --- 6️⃣ Send request to GPT-4 ---
        const response = await axios.post(
            API_URL,
            {
                model: "gpt-4",
                temperature: 0.7,
                messages: [
                    { role: "system", content: systemPrompt },
                    ...sanitizedMessages,
                ],
            },
            {
                headers: {
                    Authorization: `Bearer ${API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const botReply = response.data?.choices?.[0]?.message;
        if (!botReply) throw new Error("No response from OpenAI");

        // --- 7️⃣ Save conversation to AIChat (if exists) ---
        if (aiChatId) {
            const chat = await AIChat.findById(aiChatId);
            if (chat) {
                chat.messages.push(
                    { sender: "user", text: messages[messages.length - 1].content },
                    { sender: "bot", text: botReply.content }
                );
                await chat.save();
            }
        }

        return res.json({ message: botReply });
    } catch (err) {
        console.error("Error in sendMessage:", err);
        res.status(500).json({ message: "AI assistant error", error: err.message });
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