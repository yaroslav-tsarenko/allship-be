const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {sendMessageToChannel} = require("../telegram-bot/telegramBot");
require('dotenv').config();

const JWT_SECRET = "4c025b65c5cc41dafdd9b7eafb297d97df58c367eb9d924757072761e6c5e8e41531550eb0d95a0e1161a22b5929d9a38a8af9c65ce23be91d10c3b9fd482d05";

const register = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, secondName, email, phone, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const newUser = new User({
            name,
            secondName,
            email,
            phone,
            password,
        });
        await newUser.save();
        const messageToChannel = `
🎉 New User Registered 🎉
👤 Name ${name}
👥 Second Name: ${secondName}
📞 Phone: ${phone}
📧 Email: ${email}
        `;
        sendMessageToChannel(messageToChannel);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('User logging in:', req.body);

        const user = await User.findOne({ email });

        if (!user) {
            console.error('User not found:', email);
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        if (password !== user.password) {
            console.error('Password does not match for user:', email);
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        const isHttps = req.protocol === 'https' || req.get('origin')?.includes('https');
        const origin = req.get('origin');

        let cookieOptions = {
            httpOnly: true, // Защищает от XSS атак
            sameSite: 'None', // Разрешает работу на разных доменах
            secure: isHttps, // Куки работают по HTTPS
        };

        if (origin?.includes('allship.ai')) {
            cookieOptions.domain = '.allship.ai';
        }

        res.cookie('token', token, cookieOptions);

        res.status(201).json({ message: 'User logged in successfully', token });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Server error');
    }
};



const logout = (req, res) => {
    res.clearCookie('token', { path: '/' });
    res.status(200).json({ message: 'Logged out successfully' });
};

module.exports = {
    register,
    login,
    logout,
};