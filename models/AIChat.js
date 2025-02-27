const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    sender: { type: String, required: true, default: "No data" },
    text: { type: String, required: true, default: "No data" }
});

const AIChatSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    messages: { type: [MessageSchema], required: true, default: [] },
    name: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const AIChat = mongoose.model("AIChat", AIChatSchema);
module.exports = AIChat;