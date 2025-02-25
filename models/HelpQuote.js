const mongoose = require('mongoose');

const HelpQuoteSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

const HelpQuote = mongoose.model('HelpQuote', HelpQuoteSchema);
module.exports = HelpQuote;