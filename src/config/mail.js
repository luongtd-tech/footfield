const nodemailer = require('nodemailer');
const dns = require('dns');
require('dotenv').config();

// Ép Node.js ưu tiên IPv4 khi resolve DNS — bắt buộc để hoạt động trên Render
dns.setDefaultResultOrder('ipv4first');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  socketTimeout: 10000,
  greetingTimeout: 10000
});

const mailService = {
  sendInvoice: async (to, subject, htmlContent) => {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: to,
        subject: subject,
        html: htmlContent
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent: ' + info.response);
      return { success: true, response: info.response };
    } catch (error) {
      console.error('Email error: ', error);
      throw error;
    }
  }
};

module.exports = mailService;
