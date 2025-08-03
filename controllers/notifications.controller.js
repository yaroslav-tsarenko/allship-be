const axios = require('axios');
const sendEmail = require('../utils/sendEmail');

const TELEGRAM_BOT_TOKEN = '8487435567:AAF6dg6W22jSMt3B3rIExvcUwDiBponeRj8';
const TELEGRAM_CHAT_ID = '@landingua_notifications';

const dealMessages = {
    'site development': 'New lead for Site Development!',
    'seo audit': 'New lead for SEO Audit!',
    // Add more types as needed
};

exports.notify = async (req, res) => {
    const { fullName, phone, typeOfDeal } = req.params;
    const dealType = typeOfDeal.replace(/-/g, ' ').toLowerCase();
    const dealMessage = dealMessages[dealType] || 'New lead!';

    const message = `${dealMessage}\nName: ${fullName}\nPhone: ${phone}\nType: ${dealType}`;

    // Send Telegram message
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message
        });
    } catch (err) {
        console.error('Telegram error:', err.response?.data || err.message);
    }

    // Send Email
    try {
        await sendEmail('yaroslav7v@gmail.com', 'New Lead Notification', message);
    } catch (err) {
        console.error('Email error:', err.message);
    }

    res.json({ status: 'ok', message: 'Notification sent' });
};