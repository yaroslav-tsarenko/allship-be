const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const {register, login, registerAndAuth, logout} = authController;

router.post('/register', register);
router.post('/register-and-auth', registerAndAuth);
router.post('/login', login);
router.post('/logout', logout );

module.exports = router;