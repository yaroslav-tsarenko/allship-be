const express = require('express');
const { notify } = require("../controllers/notifications.controller");
const router = express.Router();

router.post('/send-notification/:fullName/:phoneNumber', notify);

module.exports = router;
