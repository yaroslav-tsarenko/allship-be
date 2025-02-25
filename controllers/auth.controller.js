const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
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
        const decoded = jwt.verify(token, JWT_SECRET);
        const currentUser = await User.findById(decoded.userId);

        if (!currentUser) {
            return res.status(400).json({ error: 'User not found' });
        }

        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        res.status(201).json({ message: 'User logged in successfully' });
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