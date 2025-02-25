const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
    purpose: {type: String, required: true},
    amount: {type: String, required: true},
    type: {type: String, required: true, enum: ['payment', 'refund']},
    date: {type: Date, default: Date.now},
    userId: {type: String, required: true},
})

const TransactionModel = mongoose.model("transactions", TransactionSchema);
module.exports = TransactionModel;