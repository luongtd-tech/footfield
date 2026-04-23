const cron = require('node-cron');
const Tenant = require('../models/Tenant');

const initCronJobs = () => {
  // Chạy vào lúc 00:00 (nửa đêm) mỗi ngày
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('[Cron Job] Bắt đầu quét nhà thuê hết hạn...');
      const result = await Tenant.updateExpiredTenants();
      if (result.affectedRows > 0) {
        console.log(`[Cron Job] Đã chuyển tự động ${result.affectedRows} nhà thuê hết hạn sang trạng thái "expired".`);
      } else {
        console.log('[Cron Job] Không có nhà thuê nào cần cập nhật trạng thái hết hạn.');
      }
    } catch (error) {
      console.error('[Cron Job Lỗi]', error.message);
    }
  });

  // Chạy 1 lần khởi động để bắt kịp các deal đã hết hạn trong lúc hệ thống OFF
  Tenant.updateExpiredTenants().then(result => {
      if (result.affectedRows > 0) {
        console.log(`[Init Check] Đã tự động đổi ${result.affectedRows} nhà thuê sang "expired".`);
      }
  }).catch(e => console.error('[Init Check Error]', e.message));

  console.log('Cron jobs initialized successfully.');
};

module.exports = initCronJobs;
