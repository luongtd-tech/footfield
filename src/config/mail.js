const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // TLS
  family: 4,     // Bắt buộc dùng IPv4, tránh lỗi ENETUNREACH trên Render
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
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
