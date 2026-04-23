const aiService = require('../services/aiService');

exports.handleChat = async (req, res) => {
  try {
    const { tenant_id, history, message } = req.body;

    if (!tenant_id || !message) {
      return res.status(400).json({ error: "Missing tenant_id or message" });
    }

    const result = await aiService.chat(tenant_id, history || [], message);
    res.json(result);
  } catch (error) {
    console.error('Chatbot Controller Error:', error);
    if (error.message && error.message.includes('429 Too Many Requests')) {
      return res.status(200).json({ text: "Hệ thống AI đang quá tải do có nhiều yêu cầu. Bạn vui lòng đợi khoảng 1 phút rồi thử lại nhé ⏳" });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};
