const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function list() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // There is no direct listModels in the main genAI object usually, 
    // it's often done via a specific fetch if not in SDK.
    // Actually, in the latest SDK: 
    // This is not always available in the client SDK.
    console.log('API Key:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hi");
    console.log(result.response.text());
  } catch (e) {
    console.error(e);
  }
}
list();
