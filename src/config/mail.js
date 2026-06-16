require('dotenv').config();

// Brevo (Sendinblue) HTTP API — không bị Render chặn, gửi được đến bất kỳ email nào
// Free tier: 300 email/ngày, không cần verify domain
const Brevo = require('@getbrevo/brevo');

let _apiInstance = null;
function getBrevoApi() {
  if (!_apiInstance) {
    if (!process.env.BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY chưa được cấu hình trong biến môi trường.');
    }
    const client = Brevo.ApiClient.instance;
    client.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
    _apiInstance = new Brevo.TransactionalEmailsApi();
  }
  return _apiInstance;
}

const mailService = {
  sendInvoice: async (to, subject, htmlContent) => {
    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = htmlContent;
      sendSmtpEmail.sender = {
        name: 'FootField Support',
        email: process.env.EMAIL_USER || 'luongtd.tech@gmail.com'
      };
      sendSmtpEmail.to = [{ email: to }];

      const data = await getBrevoApi().sendTransacEmail(sendSmtpEmail);
      console.log('Email sent via Brevo, messageId:', data.body?.messageId);
      return { success: true, messageId: data.body?.messageId };
    } catch (error) {
      console.error('Brevo email error:', error);
      throw error;
    }
  }
};

module.exports = mailService;
