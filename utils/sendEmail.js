const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtpout.secureserver.net',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, htmlContent) => {
  if (!to) return;
  
  // Jira-like HTML Wrapper
  const styledHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #f4f5f7; padding: 20px; text-align: center; border-bottom: 1px solid #dfe1e6;">
        <h2 style="color: #0052cc; margin: 0;">BeeBark Jira</h2>
      </div>
      <div style="padding: 30px;">
        ${htmlContent}
        <div style="margin-top: 30px; text-align: center;">
          <a href="${process.env.FRONTEND_URL}" style="background-color: #0052cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">View Work Item</a>
        </div>
      </div>
      <div style="background-color: #fafbfc; padding: 15px; text-align: center; color: #6b778c; font-size: 12px; border-top: 1px solid #dfe1e6;">
        You are receiving this because you are involved in this task on BeeBark.
      </div>
    </div>
  `;

  const mailOptions = {
    from: '"BeeBark Jira" <info@thebeebark.com>',
    to,
    subject,
    html: styledHtml,
    replyTo: 'info@thebeebark.com',
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
  } catch (error) {
    console.error('❌ Error sending email:', error);
  }
};

module.exports = sendEmail;