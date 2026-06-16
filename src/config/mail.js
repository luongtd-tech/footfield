require('dotenv').config();

// Gọi Brevo Transactional Email API trực tiếp qua HTTPS fetch
// Tránh lỗi SMTP port bị chặn trên Render, không cần verify domain
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const mailService = {
  sendInvoice: async (to, subject, htmlContent) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      throw new Error('BREVO_API_KEY chưa được cấu hình trong biến môi trường.');
    }

    const payload = {
      sender: {
        name: 'FootField Support',
        email: process.env.EMAIL_USER || 'luongtd.tech@gmail.com'
      },
      to: [{ email: to }],
      subject: subject,
      htmlContent: htmlContent
    };

    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Brevo API error:', data);
      throw new Error(data.message || `Brevo API responded with ${response.status}`);
    }

    console.log('Email sent via Brevo, messageId:', data.messageId);
    return { success: true, messageId: data.messageId };
  }
};

module.exports = mailService;
