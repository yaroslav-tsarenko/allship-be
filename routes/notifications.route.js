const express = require('express');
const {notify} = require("../controllers/notifications.controller");
const router = express.Router();

router.post('/:fullName/:phone/:typeOfDeal', notify);

module.exports = router;