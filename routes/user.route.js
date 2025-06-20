const express = require('express');
const router = express.Router();
const basicAuth = require('../middleware/basicAuth.mjddleware');
const { getUser, addDriver, getAllDrivers, sendUserEmail, addCarrierAdditionalInfo, contactUsRequest, submitMovingQuote, updateNotifications, addCard, createHelpForm, updatePassword, updateUser, getAllTransactions, getSelectedCard, selectCard, getAllCards, updateLocation } = require('../controllers/user.controller');

router.post('/submit-moving-quote', submitMovingQuote);
router.get('/get-user', basicAuth, getUser);
router.post('/add-user-driver', addDriver);
router.get('/get-all-drivers', getAllDrivers);
router.post('/update-location', updateLocation);
router.post('/add-card', addCard);
router.get('/get-all-cards', getAllCards);
router.post('/select-card', selectCard);
router.get('/get-selected-card', getSelectedCard);
router.get('/get-all-transactions', getAllTransactions);
router.post('/update-user', updateUser);
router.post('/update-password', updatePassword);
router.post('/create-form', createHelpForm);
router.post('/update-notifications', updateNotifications);
router.post('/send-email', sendUserEmail);
router.post('/contact-us-request', contactUsRequest);
router.post('/add-additional-info', addCarrierAdditionalInfo);

module.exports = router;