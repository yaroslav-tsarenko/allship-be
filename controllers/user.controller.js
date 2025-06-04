const User = require('../models/User');
const bcrypt = require('bcryptjs');
const sendEmail = require("../utils/sendEmail");
const CardModel = require('../models/Card');
const TransactionModel = require('../models/Transaction');
const HelpQuote = require('../models/HelpQuote');
const path = require("path");
const fs = require("fs");
const { createZohoLead } = require('../utils/addToZoho');
const {sendMessageToChannel} = require('../telegram-bot/telegramBot');
const {uploadImage} = require("../utils/uploadImage");
const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    let password = '';
    password += chars.charAt(Math.floor(Math.random() * 26)); // Lowercase letter
    password += chars.charAt(Math.floor(Math.random() * 26) + 26); // Uppercase letter
    password += chars.charAt(Math.floor(Math.random() * 10) + 52); // Number
    password += chars.charAt(Math.floor(Math.random() * 10) + 62); // Special character
    for (let i = 4; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            res.redirect('/');
            res.status(404).json({error: 'User not found'});
        }
        res.json({user});
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
};

const addDriver = async (req, res) => {
    const {name, carrierId, secondName, phone, email} = req.body;
    const password = generatePassword();

    try {
        const existingUser = await User.findOne({$or: [{phone}, {email}]});

        if (existingUser) {
            return res.status(400).json({message: 'User with the same phone or email already exists'});
        }

        const newUser = new User({
            name,
            secondName,
            phone,
            carrierId,
            email,
            password: password,
            role: 'driver',
        });
        await newUser.save();
        await sendEmail(email, 'Welcome to the team!', `Carrier added you as driver, and you will be assigned for future loads, your credentials for account is: 
        Email - ${email}
        Password - ${password}
        please change it after first login, and don't share it with anyone.`);
        res.status(201).json({message: 'User created successfully', password});
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
};

const getAllDrivers = async (req, res) => {
    const {carrierId} = req.query;

    try {
        const drivers = await User.find({carrierId, role: 'driver'});
        res.status(200).json(drivers);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
};

const updateLocation = async (req, res) => {
    const {userId, lat, lng} = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({message: 'User not found'});
        }

        user.lat = lat;
        user.lng = lng;
        await user.save();

        res.status(200).json({message: 'Location updated successfully'});
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
};

const addCard = async (req, res) => {
    const {cardNumber, cardHolder, expiryDate, cvv, userId} = req.body;

    if (!cardNumber || !cardHolder || !expiryDate || !cvv || !userId) {
        return res.status(400).json({message: 'All fields are required'});
    }

    try {
        const userCards = await CardModel.find({userId});

        if (userCards.length >= 5) {
            return res.status(400).json({message: 'User already has 5 cards'});
        }

        const colors = ['grey', 'blue', 'green', 'yellow', 'purple', 'red'];
        const usedColors = userCards.map(card => card.color);
        const availableColors = colors.filter(color => !usedColors.includes(color));

        if (availableColors.length === 0) {
            return res.status(400).json({message: 'No available colors for new card'});
        }

        const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];

        const paymentSystem = cardNumber.startsWith('4') ? 'visa' : cardNumber.startsWith('5') ? 'mastercard' : 'unknown';

        const newCard = new CardModel({
            cardNumber,
            cardHolder,
            expiryDate,
            cvv,
            userId,
            color: randomColor,
            paymentSystem,
            selected: false
        });

        await newCard.save();
        res.status(201).json({message: 'Card added successfully', card: newCard});
    } catch (error) {
        console.error('Error adding card:', error);
        res.status(500).json({message: 'Error adding card', error});
    }
};

const getAllCards = async (req, res) => {
    const {userId} = req.query;

    if (!userId) {
        return res.status(400).json({message: 'User ID is required'});
    }

    try {
        const cards = await CardModel.find({userId});
        res.status(200).json(cards);
    } catch (error) {
        console.error('Error fetching cards:', error);
        res.status(500).json({message: 'Error fetching cards', error});
    }
};

const selectCard = async (req, res) => {
    const {userId, cardNumber} = req.body;

    if (!userId || !cardNumber) {
        return res.status(400).json({message: 'User ID and card number are required'});
    }

    try {
        await CardModel.updateMany({userId}, {selected: false});
        const card = await CardModel.findOneAndUpdate({userId, cardNumber}, {selected: true}, {new: true});
        if (!card) {
            return res.status(404).json({message: 'Card not found'});
        }
        res.status(200).json({message: 'Card selected successfully', card});
    } catch (error) {
        console.error('Error selecting card:', error);
        res.status(500).json({message: 'Error selecting card', error});
    }
};

const getAllTransactions = async (req, res) => {
    const {userId} = req.query;

    try {
        const transactions = await TransactionModel.find({userId});
        res.status(200).json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({message: 'Error fetching transactions', error});
    }
};

const getSelectedCard = async (req, res) => {
    const {userId} = req.query;

    if (!userId) {
        return res.status(400).json({message: 'User ID is required'});
    }

    try {
        const cards = await CardModel.find({userId});
        const selectedCard = cards.find(card => card.selected);

        if (!selectedCard) {
            return res.status(404).json({message: 'No selected card found'});
        }

        res.status(200).json(selectedCard);
    } catch (error) {
        console.error('Error fetching selected card:', error);
        res.status(500).json({message: 'Error fetching selected card', error});
    }
};

const updateUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const updates = req.body;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        if (req.files && req.files.avatar) {
            const avatar = req.files.avatar;
            const avatarName = `avatar-${userId}-${Date.now()}`;
            const avatarUrl = await uploadImage(avatar, avatarName);
            updates.avatar = avatarUrl;
        }

        const user = await User.findByIdAndUpdate(userId, updates, { new: true });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ message: "User updated successfully", user });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Error updating user", error });
    }
};

const updatePassword = async (req, res) => {
    const {userId, oldPassword, newPassword} = req.body;

    console.log("Request received", req.body);

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({message: 'User not found'});
        }

        if (oldPassword !== user.password) {
            return res.status(400).json({message: 'Incorrect old password'});
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({message: 'Password updated successfully'});
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({message: 'Error updating password', error});
    }
};

const createHelpForm = async (req, res) => {
    const {userId, email, message} = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({message: 'User not found'});
        }

        const newHelpQuote = new HelpQuote({
            userId,
            email,
            message,
        });

        const messageToChannel = `
🆘 New help quote:
👨 Name: ${user.name}
👨 Second Name: ${user.secondName}
👤 Contact: ${email}
💬 Message: ${message}
📇 User's Role: ${user.role}
📞 Phone Number: ${user.phone}`;

        sendMessageToChannel(messageToChannel);

        await newHelpQuote.save();
        res.status(201).json({message: 'Help quote created successfully'});
    } catch (error) {
        console.error('Error creating help quote:', error);
        res.status(500).json({message: 'Error creating help quote', error});
    }
};

const updateNotifications = async (req, res) => {
    const {
        userId,
        notificationsEnabled,
        aiNotifications,
        carrierNotifications,
        loadNotifications,
        driverNotifications,
        updateNotifications
    } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({message: 'User not found'});
        }

        user.notifications = {
            notificationsEnabled,
            aiNotifications,
            carrierNotifications,
            loadNotifications,
            driverNotifications,
            updateNotifications,
        };

        await user.save();
        res.status(200).json({message: 'Notification settings updated successfully'});
    } catch (error) {
        console.error('Error updating notification settings:', error);
        res.status(500).json({message: 'Error updating notification settings', error});
    }
};

const sendUserEmail = async (req, res) => {
    const {email} = req.body;
    try {
        const messageToChannel = `
⚠️ New subscriber from the website:
👤 Contact: ${email}`

        sendMessageToChannel(messageToChannel);
        sendEmail(email, "Thanks for subscribing!", "You will receive notifications about new features and updates on our platform.");
        res.status(200).json({message: 'Email sent successfully'});
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({message: 'Failed to send email'});
    }
};


const contactUsRequest = async (req, res) => {
    const { name, email, message } = req.body;

    try {
        await createZohoLead({
            lastName: name || 'Anonymous',
            email,
            company: 'AllShip Contact Form',
            phone: '',
            message,
        });

        const messageToChannel = `
⚠️ Contact Form Request:
👤 Name: ${name}
📧 Contact: ${email}
💬 Message: ${message}`;
        sendMessageToChannel(messageToChannel);

        sendEmail(
            email,
            "Thanks for contacting us!",
            "You will receive a notification when your request is reviewed."
        );

        res.status(200).json({ message: 'Lead saved & email sent successfully' });
    } catch (error) {
        console.error('Error processing contact request:', error);
        res.status(500).json({ message: 'Failed to handle request' });
    }
};

module.exports = {
    getUser,
    addCard,
    contactUsRequest,
    updatePassword,
    selectCard,
    sendUserEmail,
    addDriver,
    getAllTransactions,
    getAllCards,
    createHelpForm,
    updateUser,
    getAllDrivers,
    updateNotifications,
    updateLocation,
    getSelectedCard,
};