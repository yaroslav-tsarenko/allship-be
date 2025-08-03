const express = require('express');
const { notify } = require("../controllers/notifications.controller");
const router = express.Router();

router.post('/send-notification', notify);

module.exports = router;