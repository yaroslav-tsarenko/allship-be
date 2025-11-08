const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { register, login, registerAndAuth, verifyCode, logout, forgotPassword, resetPassword } = authController;

router.post('/register', register);
router.post('/register-and-auth', registerAndAuth);
router.post('/verify-code', verifyCode);
router.post('/login', login);
router.post('/logout', logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

module.exports = router;
