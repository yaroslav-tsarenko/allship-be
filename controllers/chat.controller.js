const User = require('../models/User');
const Chat = require('../models/Chat');

const getChats = async (req, res) => {
    const userId = req.query.userId;
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userRole = user.role;
        let chats;

        if (userRole === 'customer') {
            chats = await Chat.find({ $or: [{ userId }, { shipperId: userId }] });
        } else if (userRole === 'carrier') {
            chats = await Chat.find({ carrierId: userId });
        } else {
            return res.status(403).json({ message: 'Unauthorized role' });
        }

        res.status(200).json(chats);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching chats', error });
    }
};

const saveMessage = async (chatId, role, carrierId, shipperId, messageText) => {
    const chat = await Chat.findById(chatId);
    if (chat) {
        const newMessage = {
            carrierId,
            shipperId,
            message: messageText,
            role,
            createdAt: new Date(),
        };
        chat.chatHistory.push(newMessage);
        await chat.save();
        return newMessage;
    }
    throw new Error('Chat not found');
};

module.exports = { getChats, saveMessage };