require('dotenv').config();
const { Resend } = require('resend');

// Khởi tạo lazy — tránh crash khi thiếu env var lúc startup
let _resend = null;
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY chưa được cấu hình trong biến môi trường.');
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const mailService = {
  sendInvoice: async (to, subject, htmlContent) => {
    try {
      const { data, error } = await getResend().emails.send({
        from: process.env.EMAIL_FROM || 'FootField Support <onboarding@resend.dev>',
        to: [to],
        subject: subject,
        html: htmlContent
      });

      if (error) {
        console.error('Resend error:', error);
        throw new Error(error.message);
      }

      console.log('Email sent via Resend, id:', data.id);
      return { success: true, id: data.id };
    } catch (error) {
      console.error('Email error:', error);
      throw error;
    }
  }
};

module.exports = mailService;
