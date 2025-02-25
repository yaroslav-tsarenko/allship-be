const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
    carrierId: { type: String },
    shipperId: { type: String },
    loadId: { type: String },
    carrierCompanyName: { type: String },
    shipperName: { type: String },
    bidPrice: { type: Number },
    title: { type: String, required: true },
    subType: { type: String, required: true },
    chatHistory: [
        {
            carrierCompanyName: { type: String },
            shipperName: { type: String },
            carrierId: { type: String },
            shipperId: { type: String },
            role: { type: String },
            message: { type: String },
            createdAt: { type: Date, default: Date.now },
        },
    ],
}, { timestamps: true });

ChatSchema.pre('save', function (next) {
    if (this.isModified('chatHistory')) {
        this.chatHistory.forEach((message) => {
            if (!message.carrierCompanyName) {
                message.carrierCompanyName = this.carrierCompanyName;
            }
            if (!message.shipperName) {
                message.shipperName = this.shipperName;
            }
        });
    }
    next();
});

module.exports = mongoose.model('Chat', ChatSchema);