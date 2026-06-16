require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const mailService = {
  sendInvoice: async (to, subject, htmlContent) => {
    try {
      const { data, error } = await resend.emails.send({
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
