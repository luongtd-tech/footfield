# FootField - Hệ Thống Quản Lý Sân Bóng Đá Toàn Diện (SaaS)

FootField là một nền tảng SaaS (Software as a Service) B2B2C cung cấp giải pháp chuyển đổi số toàn diện cho lĩnh vực quản lý và cho thuê sân bóng đá nhân tạo. Hệ thống giúp kết nối Chủ nền tảng (Provider), Chủ sân bóng (Tenant) và Người chơi (Customer) trong một hệ sinh thái duy nhất.

## 🌟 Tính Năng Nổi Bật

### 1. Dành Cho Chủ Nền Tảng (Provider Admin)
- **Quản lý đa cơ sở (Multi-tenant):** Quản lý tập trung hàng trăm sân bóng (Tenant) trên cùng một hệ thống với hệ thống ID định danh riêng biệt.
- **Quản lý gói dịch vụ (Packages):** Thiết lập các gói thuê bao (Cơ bản, Tiêu chuẩn, Cao cấp) và tự động giới hạn số lượng sân, tiện ích cho từng gói.
- **Báo cáo doanh thu SaaS:** Theo dõi doanh thu từ việc bán gói dịch vụ phần mềm theo chu kỳ tháng/năm.
- **Hệ thống Ticket:** Tiếp nhận và xử lý báo lỗi, yêu cầu hỗ trợ trực tiếp từ các chủ sân.

### 2. Dành Cho Chủ Sân Bóng (Tenant Admin)
- **Quản lý sân bãi:** Thiết lập cấu hình sân (Sân 5, 7, 11), định giá linh hoạt, trạng thái hoạt động/bảo trì.
- **Quản lý lịch đặt sân thông minh:** Giao diện lưới thời gian (Time-grid) trực quan, chống trùng lịch (Conflict prevention).
- **Check-in tự động (Mobile App):** Tích hợp quét mã QR bằng Camera Native trên Android để nhận sân và đối chiếu hóa đơn nhanh chóng.
- **CRM Quản lý khách hàng:** Phân hạng khách hàng tự động (VIP), theo dõi tần suất đặt sân và quản lý công nợ.
- **Tài chính & Thống kê:** Tính toán tỷ lệ lấp đầy sân (Occupancy rate), tổng hợp doanh thu theo ngày/tháng, và bản xem trước in hóa đơn hóa đơn.
- **Vận hành (Nhân sự):** Quản lý tài khoản và theo dõi lịch làm việc của đội ngũ nhân viên phục vụ sân.

### 3. Dành Cho Khách Hàng (Customer Storefront)
- **Giao diện đặt sân hiện đại:** Tìm kiếm sân, xem hình ảnh, tiện ích, và kiểm tra khung giờ trống theo thời gian thực. (Thay đổi UI/Theme động theo từng cơ sở).
- **Chatbot AI Trợ lý ảo (Gemini):** Tích hợp Google Gemini AI hỗ trợ khách hàng tư vấn giá, kiểm tra giờ trống và đặt lịch hoàn toàn qua hội thoại tự nhiên (Function Calling).
- **Thanh toán trực tuyến (VNPay):** Hỗ trợ thanh toán bảo mật và tự động ghi nhận booking ngay lập tức.
- **Vé điện tử QR Code:** Tự động sinh mã QR sau khi đặt sân thành công dùng để check-in tại sân.

---

## 🏗 Kiến Trúc Hệ Thống

Dự án áp dụng kiến trúc **Monolithic Hybrid** tích hợp cơ chế chia tách dữ liệu **Multi-tenant** dựa trên khóa ngoại `tenant_id` trong cơ sở dữ liệu.

- **Frontend:** HTML5, Vanilla CSS, JS (Hạn chế framework nặng để tối đa tốc độ tải trang).
- **Backend:** Node.js, Express.js.
- **Cơ Sở Dữ Liệu:** MySQL (Sử dụng Knex.js Query Builder để chống SQL Injection).
- **Mobile Native App:** Ionic Capacitor (Đóng gói Web App thành Android Native App, tích hợp quyền thiết bị).
- **AI Engine:** Google Gemini 2.5 Flash (Function Calling).
- **Payment Gateway:** Cổng thanh toán VNPay Sandbox/Prod.

### 📂 Tổ Chức Mã Nguồn (Directory Structure)

```text
footfield-main/
│
├── public/                 # Tệp tĩnh Frontend (HTML, CSS, JS, Images)
│   ├── customer.html       # Trang đặt sân (B2C) & Chatbot
│   ├── tenant-admin.html   # Quản lý sân bóng (B2B)
│   ├── provider-admin.html # Quản trị tổng hệ thống (Super Admin)
│   └── payment-result.html # Trang xử lý Callback VNPay
│
├── src/                    # Mã nguồn Backend API (Node.js)
│   ├── config/             # Thiết lập Database, Constants, Môi trường
│   ├── controllers/        # Xử lý logic API (Bookings, Tenants, AI, VNPay)
│   ├── db/                 # Các file Database Migrations & Seeds của Knex
│   ├── jobs/               # Cron jobs (Ví dụ: tự động đánh dấu hết hạn gói)
│   ├── middleware/         # Bảo mật (Xác thực JWT), Xử lý lỗi
│   ├── models/             # Định nghĩa tương tác với MySQL
│   ├── routes/             # Cấu trúc API Endpoints
│   └── services/           # Tích hợp dịch vụ bên thứ 3 (aiService, vnpayService)
│
├── mobile-provider/        # Android Project (Super Admin App) - Capacitor
├── mobile-tenant/          # Android Project (Tenant App) - Capacitor
│
├── index.js                # Entry point khởi chạy HTTP Server
├── knexfile.js             # Cấu hình chuỗi kết nối Database cho Knex
└── package.json            # Quản lý thư viện Node.js
```

---

## 🚀 Hướng Dẫn Triển Khai (Deployment)

Dự án được tối ưu để triển khai trọn gói lên nền tảng Cloud.

### 1. Môi trường triển khai Production
- **Backend & Frontend Host:** Dịch vụ Web Service Serverless/PaaS trên **Render** (Node.js Environment).
- **Database:** Cụm máy chủ MySQL Managed Service được lưu trữ độc lập trên **Aiven**.

### 2. Thiết lập Biến Môi Trường (`.env`)
Đảm bảo thêm các khóa sau vào cấu hình Environment Variables trên bảng điều khiển của **Render**:

```env
PORT=3000
# Aiven MySQL Connection
DB_HOST=mysql-xxx-xxx.aivencloud.com
DB_PORT=xxxx
DB_USER=avnadmin
DB_PASSWORD=your_aiven_password
DB_NAME=footfield_db

# Security & Services
JWT_SECRET=your_super_secret_jwt_key
GEMINI_API_KEY=your_google_gemini_api_key

# VNPay Payment Gateway
VNP_TMN_CODE=your_vnpay_tmn_code
VNP_HASH_SECRET=your_vnpay_hash_secret
VNP_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNP_RETURN_URL=https://<your-render-domain>.onrender.com/payment-result.html
```

### 3. Quy trình Build Android Native App (AAB/APK)
Vì ứng dụng di động lấy giao diện Web trực tiếp từ Render Host (Load URL), khi bạn cập nhật code Frontend, ứng dụng Android tự động thay đổi. 
Bạn **chỉ cần Build lại ứng dụng Android** qua Android Studio nếu:
1. Có thay đổi về cấu hình Native (như Logo ứng dụng, Splash Screen).
2. Có thay đổi về quyền hệ thống trong file `AndroidManifest.xml` (Ví dụ: cấp lại quyền `android.permission.CAMERA`).

**Các bước Build App:**
1. Mở thư mục `mobile-tenant/android` (hoặc `mobile-provider`) bằng **Android Studio**.
2. Đợi Gradle đồng bộ (Sync).
3. Chọn menu **Build > Generate Signed Bundle / APK** để tạo file phát hành lên Google Play hoặc cài đặt nội bộ.
