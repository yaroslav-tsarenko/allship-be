const express = require('express');
const { notify } = require("../controllers/notifications.controller");
const router = express.Router();

router.post('/send-notification/:fullName', notify);

module.exports = router;
