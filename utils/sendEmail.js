const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (to, subject, text = '', attachments = [], htmlContent = '') => {
    console.log(`📧 [sendEmail] Preparing to send to: ${to} | Subject: ${subject}`);

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
        const response = await resend.emails.send({
            from: mailOptions.from,
            to: Array.isArray(to) ? to : [to],
            subject: mailOptions.subject,
            text: mailOptions.text,
            html: mailOptions.html,
            attachments: attachments?.length
                ? attachments.map(file => ({
                    filename: file.filename || 'attachment',
                    content: file.content,
                    type: file.type || 'application/octet-stream',
                }))
                : undefined,
        });

        console.log(`✅ Email sent successfully to ${to}: ${response?.data?.id || 'OK'}`);
    } catch (error) {
        console.error('❌ Error sending email via Resend:', error);
    }
};

module.exports = sendEmail;
