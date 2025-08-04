const axios = require('axios');
const sendEmailLanding = require("../utils/sendEmailLanding");

const TELEGRAM_BOT_TOKEN = '8487435567:AAF6dg6W22jSMt3B3rIExvcUwDiBponeRj8';
const TELEGRAM_CHAT_ID = '@landingua_notifications';

exports.notify = async (req, res) => {
    let data = req.body;

    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (e) {
            return res.status(400).json({ status: 'error', message: 'Invalid JSON format' });
        }
    }

    // 🟢 Отримуємо з body
    const { typeOfDeal, source } = data;

    // 🟢 Отримуємо з headers
    const fullName = req.headers['fullname'] || '';
    const phone = req.headers['phone'] || '';

    if (!typeOfDeal || !source) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields: typeOfDeal and source' });
    }

    const lines = [`*${typeOfDeal}*`];
    if (fullName) lines.push(`*Ім'я:* ${fullName}`);
    if (phone) lines.push(`*Номер телефону:* ${phone}`);
    lines.push(`*Тип замовлення:* ${typeOfDeal}`);
    lines.push(`*Джерело:* ${source}`);

    const telegramMessage = lines.join('\n');

    const emailTableRows = [
        fullName ? `<tr><td style="font-weight: bold; padding-right: 10px;">Ім'я:</td><td style="font-weight: bold;">${fullName}</td></tr>` : '',
        phone ? `<tr><td style="font-weight: bold; padding-right: 10px;">Номер телефону:</td><td style="font-weight: bold;">${phone}</td></tr>` : '',
        `<tr><td style="font-weight: bold; padding-right: 10px;">Тип замовлення:</td><td style="font-weight: bold;">${typeOfDeal}</td></tr>`,
        `<tr><td style="font-weight: bold; padding-right: 10px;">Джерело:</td><td style="font-weight: bold;">${source}</td></tr>`
    ];

    const emailMessage = `
        <div style="font-family: Arial, sans-serif; font-size: 16px;">
            <h2 style="margin-bottom: 16px;">${typeOfDeal}</h2>
            <table>${emailTableRows.join('')}</table>
        </div>
    `;

    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: telegramMessage,
            parse_mode: "Markdown"
        });
    } catch (err) {
        console.error('Telegram error:', err.response?.data || err.message);
    }

    try {
        await sendEmailLanding('mail@landing.ua', 'Повідомлення про отримання нового ліда!', emailMessage, true);
    } catch (err) {
        console.error('Email error:', err.message);
    }

    res.json({ status: 'ok', message: 'Notification sent' });
};
