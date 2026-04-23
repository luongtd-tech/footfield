const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function list() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('Testing gemini-pro...');
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent("Hi");
    console.log('gemini-pro result:', result.response.text());
  } catch (e) {
    console.error('gemini-pro failed:', e.message);
  }
}
list();
