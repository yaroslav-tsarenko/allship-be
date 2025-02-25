const mongoose = require("mongoose");

const CardSchema = new mongoose.Schema({
    cardNumber: {type: String, required: true},
    cardHolder: {type: String, required: true},
    expiryDate: {type: String, required: true},
    paymentSystem: {type: String, required: true},
    color: {type: String, required: true},
    cvv: {type: String, required: true},
    userId: {type: String, required: true},
    selected: {type: Boolean, default: false},
})

const CardModel = mongoose.model("cards", CardSchema);
module.exports = CardModel;