exports.seed = function(knex) {
  // Deletes ALL existing entries in correct order
  return knex('service_invoices').del()
    .then(() => knex('tickets').del())
    .then(() => knex('tenants').del())
    .then(() => knex('admins').del())
    .then(() => knex('notifications').del())
    .then(() => knex('packages').del())
    .then(function () {
      // Inserts seed entries for admins
      return knex('admins').insert([
        { username: 'luongtd', password: 'footfield', name: 'Trần Đức Lương', role: 'admin' }
      ]);
    })
    .then(function () {
      // Inserts seed entries for packages
      return knex('packages').insert([
        { id: 'pkg1', name: 'Gói Cơ Bản', price_monthly: 299000, price_yearly: 2990000, max_fields: 3, features: 'Quản lý lịch đặt sân, Báo cáo doanh thu, Hỗ trợ email', color: '#6c757d', popular: false },
        { id: 'pkg2', name: 'Gói Tiêu Chuẩn', price_monthly: 599000, price_yearly: 5990000, max_fields: 8, features: 'Tất cả Gói Cơ Bản, QR Check-in, Thu tiền đa phương thức, In hóa đơn, Hỗ trợ chat', color: '#0d6efd', popular: true },
        { id: 'pkg3', name: 'Gói Cao Cấp', price_monthly: 999000, price_yearly: 9990000, max_fields: 999, features: 'Tất cả Gói Tiêu Chuẩn, Không giới hạn sân, API tích hợp, Hỗ trợ 24/7, Trang khách hàng tùy chỉnh', color: '#198754', popular: false }
      ]);
    })
    .then(function(){
        return knex('tenants').insert([
            { id: 'tenant1', name: 'VinhUniFootBall', owner: 'Nguyễn Văn Vinh', email: 'vinh@vinhunifootball.vn', phone: '0912345678', address: 'Số 15, Đường Trần Phú, TP. Vinh, Nghệ An', username: 'vinhunifootball', password: 'footfield', package_id: 'pkg2', status: 'active', start_date: '2025-01-01', end_date: '2026-01-01', billing_cycle: 'yearly', logo: '🏟️', theme_color: '#16a34a'}
        ]);
    })
    .then(function() {
      return knex('service_invoices').insert([
        { id: 'INV-0001', tenant_id: 'tenant1', package_id: 'pkg2', amount: 5990000, billing_cycle: 'yearly', status: 'paid', due_date: '2025-01-01', payment_date: '2025-01-01' },
        { id: 'INV-0002', tenant_id: 'tenant1', package_id: 'pkg2', amount: 599000, billing_cycle: 'monthly', status: 'paid', due_date: '2025-02-01', payment_date: '2025-02-01' },
        { id: 'INV-0003', tenant_id: 'tenant1', package_id: 'pkg2', amount: 599000, billing_cycle: 'monthly', status: 'paid', due_date: '2025-03-01', payment_date: '2025-03-01' },
        { id: 'INV-0004', tenant_id: 'tenant1', package_id: 'pkg2', amount: 599000, billing_cycle: 'monthly', status: 'paid', due_date: '2025-04-01', payment_date: '2025-04-01' }
      ]);
    })
    .then(function() {
      return knex('tickets').insert([
        { id: 'tk001', tenant_id: 'tenant1', subject: 'Lỗi không hiển thị lịch đặt sân ngày 18/3', type: 'bug', priority: 'high', status: 'open', created_at: '2026-03-18', message: 'Hệ thống không hiển thị được lịch đặt sân cho ngày 18/3/2026. Khách hàng không thể xem được lịch.', tenant_name: 'VinhUniFootBall' },
        { id: 'tk002', tenant_id: 'tenant1', subject: 'Đề xuất thêm tính năng nhắc nhở qua Zalo', type: 'feature', priority: 'medium', status: 'processing', created_at: '2026-03-15', message: 'Mong muốn có tính năng gửi nhắc nhở đặt sân qua Zalo OA.', tenant_name: 'VinhUniFootBall' }
      ]);
    })
    .then(function() {
      return knex('notifications').insert([
        { id: 'n1', title: 'Bảo trì hệ thống định kỳ', message: 'Hệ thống sẽ được bảo trì vào lúc 02:00 sáng ngày 25/03/2026. Dự kiến kéo dài 2 tiếng.', type: 'system', target: 'all', created_at: '2026-03-20' },
        { id: 'n2', title: 'Khuyến mãi Gói Cao Cấp', message: 'Giảm giá 20% khi nâng cấp lên Gói Cao Cấp trong tháng 3.', type: 'promo', target: 'all', created_at: '2026-03-19' }
      ]);
    });
};
