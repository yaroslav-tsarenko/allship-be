const axios = require('axios');
const sendEmail = require('../utils/sendEmail');

const TELEGRAM_BOT_TOKEN = '8487435567:AAF6dg6W22jSMt3B3rIExvcUwDiBponeRj8';
const TELEGRAM_CHAT_ID = '@landingua_notifications';

const dealMessages = {
    siteDevelopment: 'New lead for Site Development!',
    seoAudit: 'New lead for SEO Audit!',
};

exports.notify = async (req, res) => {
    const { fullName, phone, typeOfDeal, source } = req.params;
    const dealType = typeOfDeal.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    const dealMessage = dealMessages[dealType] || 'New lead!';

    const message = `${dealMessage}\nName: ${fullName}\nPhone: ${phone}\nType: ${dealType}\nSource: ${source}`;

    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message
        });
    } catch (err) {
        console.error('Telegram error:', err.response?.data || err.message);
    }

    try {
        await sendEmail('yaroslav7v@gmail.com', 'New Lead Notification', message);
    } catch (err) {
        console.error('Email error:', err.message);
    }

    res.json({ status: 'ok', message: 'Notification sent' });
};