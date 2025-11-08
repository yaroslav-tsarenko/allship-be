const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, text = '', attachments = [], htmlContent = '') => {
    console.log(`📧 [sendEmail] Preparing to send to: ${to} | Subject: ${subject}`);

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.MAIL_USER || 'noreply@allship.ai',
            pass: process.env.MAIL_PASS || 'roaz hpgr ltua isva', // app password
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    // 🔹 Обгортаємо в AllShipAI шаблон
    const html = `
    <html>
      <body style="background:#f4f6f8;padding:40px 0;font-family:Arial,Helvetica,sans-serif;">
        <table align="center" width="520" cellpadding="0" cellspacing="0"
              style="background:#fff;border-radius:10px;box-shadow:0 5px 20px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb,#1e3a8a);padding:24px 0;text-align:center;color:#fff;font-size:22px;font-weight:bold;">
              AllShipAI
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;color:#333;font-size:15px;line-height:1.6;">
              ${htmlContent || text || ''}
              <p style="margin-top:20px;font-size:13px;color:#666;">
                If you didn’t request this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;text-align:center;padding:16px;font-size:12px;color:#777;">
              © ${new Date().getFullYear()} AllShipAI. All rights reserved.<br>
              <a href="https://allship.ai" style="color:#2563eb;text-decoration:none;">Visit Website</a> •
              <a href="mailto:support@allship.ai" style="color:#2563eb;text-decoration:none;">Contact Support</a>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

    const mailOptions = {
        from: `"AllShipAI" <${process.env.MAIL_USER || 'noreply@allship.ai'}>`,
        to,
        subject,
        text,
        html,
        attachments,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully to ${to}: ${info.response}`);
    } catch (error) {
        console.error('❌ Error sending email:', error);
    }
};

module.exports = sendEmail;
