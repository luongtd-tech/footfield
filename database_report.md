# Báo cáo Chi tiết Từ điển Dữ liệu (Database Dictionary) - Dự án FootField

Cơ sở dữ liệu `footfield` được thiết kế theo kiến trúc **Multi-Tenant (Shared Database, Shared Schema)**. Điều này có nghĩa là tất cả dữ liệu của mọi cơ sở kinh doanh (chủ sân) đều nằm chung trong các bảng này, nhưng được phân tách nghiêm ngặt bằng cột `tenant_id`.

Dưới đây là giải thích chi tiết ý nghĩa của 16 bảng và các cột quan trọng.

---

## 1. Nhóm Bảng Hệ Thống & Quản Trị (Platform Administration)

Nhóm này quản lý lõi của nền tảng SaaS, do **Provider (Chủ nền tảng)** kiểm soát.

### 1.1. Bảng `admins`
Lưu trữ tài khoản của chủ nền tảng (Super Admin).
- `id` (PK): Mã định danh duy nhất của admin.
- `username` / `password`: Thông tin đăng nhập.
- `name` / `email`: Thông tin liên hệ.
- `role`: Phân quyền (ví dụ: superadmin, support).

### 1.2. Bảng `packages`
Lưu trữ các gói dịch vụ (Subscription Plans) mà nền tảng cung cấp cho chủ sân.
- `id` (PK): Mã gói (VD: BASIC, PRO).
- `name`: Tên hiển thị của gói.
- `price_monthly` / `price_yearly`: Giá cước hàng tháng/năm.
- `max_fields`: Số lượng sân bóng tối đa mà gói này cho phép tạo.
- `features`: Chuỗi mô tả các tính năng đính kèm (có thể lưu dạng JSON).

### 1.3. Bảng `tenants`
Bảng cực kỳ quan trọng, lưu trữ toàn bộ các Cơ sở kinh doanh (Khách hàng B2B của nền tảng).
- `id` (PK): Mã định danh cơ sở (VD: `vinhuni`, `sondaithanh`). Sẽ được dùng làm Prefix hoặc Subdomain.
- `name` / `owner`: Tên cơ sở và tên người đại diện pháp luật.
- `package_id` (FK): Khóa ngoại liên kết tới bảng `packages`. Xác định cơ sở này đang xài gói nào.
- `status`: `active` (hoạt động), `suspended` (khóa), `expired` (hết hạn).
- `fcm_token`: Chuỗi token để Firebase gửi thông báo đẩy (Push Notification) đến điện thoại của chủ sân.
- `bank_name` / `bank_account`: Thông tin ngân hàng của chủ sân để khách hàng chuyển khoản trực tiếp (nếu không dùng VNPay).

### 1.4. Bảng `service_invoices`
Hóa đơn thanh toán tiền thuê phần mềm của chủ sân (Tenant) trả cho chủ nền tảng (Provider).
- `id` (PK): Mã hóa đơn dịch vụ.
- `tenant_id` (FK): Khách hàng (Chủ sân) bị lập hóa đơn.
- `amount`: Số tiền phải đóng.
- `billing_cycle`: Trả theo `monthly` (Tháng) hay `yearly` (Năm).

---

## 2. Nhóm Bảng Vận Hành Khách Hàng (Tenant Operations)

Nhóm này chứa dữ liệu nghiệp vụ của từng chủ sân, quản lý sân bãi, đặt lịch và nhân viên.

### 2.1. Bảng `fields`
Danh sách các sân bóng vật lý thuộc sở hữu của một Tenant.
- `id` (PK): Mã sân bóng.
- `tenant_id` (FK): Chủ sở hữu sân này là ai.
- `name`: Tên sân (VD: Sân 5, Sân 7).
- `type` / `size`: Loại sân (5v5, 7v7, 11v11).
- `price_per_hour`: Giá thuê cơ sở (mỗi giờ).

### 2.2. Bảng `bookings`
Lưu trữ mọi giao dịch đặt sân. Đây là **trái tim của hệ thống**.
- `id` (PK): Mã đặt sân.
- `tenant_id` (FK) / `field_id` (FK): Ai đặt, đặt sân nào.
- `date` / `start_time` / `end_time`: Thời gian diễn ra trận đấu.
- `total_price`: Tổng tiền (đã tính toán giá theo khung giờ).
- `status`: `pending` (chờ duyệt), `confirmed` (đã nhận), `completed` (đá xong), `cancelled` (hủy).
- `paid`: Boolean (0/1). Đã thanh toán chưa.
- `qr_code`: Chuỗi mã hóa để tạo mã QR check-in qua App di động.

### 2.3. Bảng `customers`
Quản lý tập khách hàng (CRM) của từng chủ sân.
- `id` (PK): Mã định danh khách hàng.
- `tenant_id` (FK): Khách hàng này thuộc sở hữu của chủ sân nào (đảm bảo sân A không nhìn thấy số điện thoại khách của sân B).
- `total_bookings` / `total_spent`: Tổng số trận đã đá và tổng tiền đã tiêu (Dùng để phân hạng VIP).

### 2.4. Bảng `staff`
Lưu trữ nhân viên làm việc tại sân (Bảo vệ, thu ngân, người quét dọn).
- `id` (PK), `name`, `phone`, `status`.
- (Có thể mở rộng thêm hệ thống phân quyền trong tương lai).

### 2.5. Bảng `tickets`
Hệ thống Hỗ trợ (Support Ticket) giữa Chủ sân và Chủ nền tảng.
- `id` (PK): Mã yêu cầu.
- `tenant_id` (FK): Sân nào đang yêu cầu hỗ trợ.
- `subject` / `message`: Nội dung báo cáo (VD: Lỗi phần mềm, xin gia hạn).
- `status`: `open` (đang xử lý), `resolved` (đã giải quyết).

---

## 3. Nhóm Bảng Tài Chính & Tiện Ích Căn Tin (Finance & Canteen)

### 3.1. Bảng `payments`
Ghi log lịch sử mọi giao dịch thanh toán trực tuyến (VNPay).
- `vnp_txn_ref` (PK): Mã giao dịch sinh ra từ VNPay (Dùng để đối soát).
- `booking_id` (FK): Giao dịch này trả tiền cho mã đặt sân nào.
- `amount`: Số tiền thanh toán.
- `status`: `success` hoặc `fail`. Bảng này giúp tra soát tiền nong cực kỳ minh bạch.

### 3.2. Bảng `invoices`
Hóa đơn bán lẻ (hóa đơn sân bãi + tiền nước) để in ra giấy (qua máy in nhiệt) giao cho khách.
- `id` (PK), `tenant_id`, `booking_id`.
- `amount`: Tổng số tiền khách cần trả.

### 3.3. Bảng `services` (Mặt hàng Căn tin)
Quản lý kho hàng hóa bán kèm (Nước suối, áo pitch, thuê bóng).
- `id` (PK): Mã mặt hàng.
- `name`: Tên hàng (VD: Sting dâu, Nước khoáng).
- `price`: Giá bán.
- `category`: Phân loại (`drink`, `food`, `rental`).
- `stock`: Số lượng tồn kho.

### 3.4. Bảng `booking_services` (Hóa đơn Căn tin)
Bảng cầu nối (Junction Table) lưu việc Khách mua nước uống gán vào mã đặt sân.
- `id` (PK).
- `booking_id` (FK): Trận đấu nào mua.
- `service_id` (FK): Mua mặt hàng nào.
- `quantity`: Số lượng bao nhiêu chai/cái.
- `price_at_time`: Giá tại thời điểm bán (Rất quan trọng, để tránh việc hôm sau tăng giá nước thì hóa đơn cũ bị sai lệch).

---

## 4. Nhóm Bảng Cấu trúc Ẩn (Internal System)

### 4.1. Bảng `notifications`
Lưu trữ lịch sử các thông báo đẩy.
- `id`, `title`, `message`, `type`, `target`. 
- Giúp người dùng mở app lên có thể xem lại "Chuông thông báo" như trên Facebook.

### 4.2. Bảng `knex_migrations` & `knex_migrations_lock`
- Do hệ thống KnexJS tạo ra tự động để quản lý phiên bản database.
- `knex_migrations`: Lưu danh sách các file code migration đã chạy (để không chạy trùng).
- `knex_migrations_lock`: Ngăn chặn việc 2 người cùng nâng cấp database cùng một lúc gây vỡ hệ thống.
