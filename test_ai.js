const dotenv = require('dotenv');
dotenv.config();
const aiService = require('./src/services/aiService');

async function test() {
  try {
    console.log('Testing AI Service...');
    const result = await aiService.chat('tenant1', [], 'Chào bạn!');
    console.log('Result:', result.text);
  } catch (error) {
    console.error('AI Service Test Failed:', error);
  }
}

test();
