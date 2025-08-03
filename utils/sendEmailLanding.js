const nodemailer = require('nodemailer');

const sendEmailLanding = async (to, subject, message, isHtml = false) => {
    const transporter = nodemailer.createTransport({
        host: 'mail.adm.tools',
        port: 587,
        secure: false,
        auth: {
            user: 'mail@landing.ua',
            pass: 'minerovich22Qe!'
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    const mailOptions = {
        from: 'mail@landing.ua',
        to,
        subject,
        [isHtml ? 'html' : 'text']: message
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

module.exports = sendEmailLanding;