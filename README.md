# FootField - Hệ Thống Quản Lý Sân Bóng Đá Toàn Diện (SaaS Platform)

FootField là một nền tảng SaaS (Software as a Service) B2B2C mạnh mẽ, cung cấp giải pháp chuyển đổi số toàn diện cho ngành quản lý và cho thuê sân bóng đá. Hệ thống được thiết kế để phục vụ ba đối tượng chính: **Chủ nền tảng (Provider)**, **Chủ sân bóng (Tenant)** và **Người chơi (Customer)** trong một hệ sinh thái đồng nhất, mượt mà.

---

## 🌟 Tính Năng Cốt Lõi

### 1. Quản Trị Hệ Thống (Provider Admin)
- **Kiến trúc Multi-tenant:** Quản lý không giới hạn các cơ sở kinh doanh (Tenants) với định danh riêng biệt.
- **Hệ thống Gói dịch vụ (Subscription):** Linh hoạt thiết lập các gói thuê bao (Basic, Standard, Premium) với cơ chế giới hạn tính năng và số lượng sân tự động.
- **Báo cáo SaaS chuyên sâu:** Theo dõi doanh thu từ phí dịch vụ phần mềm, biểu đồ tăng trưởng nhà thuê và hiệu suất hệ thống.
- **Trung tâm hỗ trợ (Ticket System):** Tiếp nhận và phản hồi các yêu cầu hỗ trợ, báo lỗi từ các chủ sân theo thời gian thực.

### 2. Quản Lý Vận Hành (Tenant Admin)
- **Smart Scheduling:** Giao diện lưới thời gian (Time-grid) trực quan, tự động ngăn chặn trùng lịch và tối ưu hóa tỷ lệ lấp đầy.
- **Tích hợp Mobile App & QR Check-in:** Sử dụng Camera Native trên Android để quét mã QR nhận sân, đối chiếu hóa đơn tức thì.
- **In ấn không dây (Native Printing):** Kết nối trực tiếp với máy in nhiệt qua Bluetooth/Wi-Fi để in hóa đơn ngay trên ứng dụng di động.
- **Quản lý CRM & Tài chính:** Tự động phân hạng khách hàng (VIP), theo dõi công nợ, quản lý dịch vụ căng tin (đồ ăn, nước uống) và thống kê doanh thu chi tiết.
- **Thông báo đẩy (FCM):** Nhận thông báo thời gian thực khi có khách đặt sân mới hoặc các thay đổi từ hệ thống.

### 3. Trải Nghiệm Khách Hàng (Customer Storefront)
- **Booking Online 24/7:** Tìm kiếm sân, kiểm tra khung giờ trống và đặt lịch nhanh chóng với giao diện tùy biến theo thương hiệu của từng sân.
- **Trợ lý ảo AI (Gemini):** Chatbot thông minh hỗ trợ tư vấn giá, tìm giờ trống và thực hiện đặt sân trực tiếp qua ngôn ngữ tự nhiên.
- **Thanh toán đa phương thức:** Tích hợp cổng thanh toán VNPay (ATM, QR Code, Ví điện tử) với cơ chế xác nhận tự động.
- **Ví điện tử & QR Ticket:** Lưu trữ vé đặt sân dưới dạng QR Code giúp quá trình check-in tại sân diễn ra trong vài giây.

---

## 🏗 Kiến Trúc Kỹ Thuật

Dự án sử dụng kiến trúc **Modular Monolith** hiện đại, ưu tiên hiệu năng và khả năng bảo trì.

### Tech Stack
- **Backend:** Node.js (Express), Knex.js (Query Builder).
- **Frontend:** Vanilla HTML5/JS, CSS3 (Shared Design System).
- **Database:** MySQL 8.0 (Managed by Aiven).
- **Mobile:** Ionic Capacitor (Android Native Integration).
- **AI Engine:** Google Gemini Pro (Function Calling).
- **Cloud Storage:** Cloudinary (Hybrid Local Fallback).
- **Messaging:** Firebase Cloud Messaging (FCM).
- **Signaling:** Socket.io (For Live Monitoring).

### 📂 Cấu Trúc Thư Mục (Optimized)

```text
footfield-main/
├── public/                 # Giao diện Frontend Web
│   ├── css/                # Hệ thống CSS module (shared.css, portal-specific)
│   ├── js/                 # Logic JS module (shared.js, portal-specific)
│   ├── images/             # Tài nguyên hình ảnh hệ thống
│   ├── customer.html       # Cổng thông tin khách hàng & AI Chatbot
│   ├── tenant-admin.html   # Cổng quản trị dành cho chủ sân
│   └── provider-admin.html # Cổng quản trị dành cho chủ nền tảng
│
├── src/                    # Mã nguồn Backend (Layered Architecture)
│   ├── config/             # Cấu hình DB, Firebase, Cloudinary
│   ├── controllers/        # Điều phối logic Request/Response
│   ├── models/             # Định nghĩa Schema và tương tác Database
│   ├── services/           # Logic nghiệp vụ & Tích hợp API bên thứ 3
│   ├── routes/             # Định nghĩa API Endpoints
│   ├── middleware/         # Xác thực JWT, phân quyền, xử lý lỗi
│   └── utils/              # Tiện ích chung (Push Notification, Formatter)
│
├── android-tenant/         # Dự án Native Android dành cho Chủ sân
├── android-provider/       # Dự án Native Android dành cho Chủ nền tảng
├── scripts/                # Các kịch bản tối ưu hóa và bảo trì hệ thống
├── docs/                   # Tài liệu kỹ thuật và thiết kế
└── knexfile.js             # Cấu hình Database Migration
```

---

## 🚀 Hướng Dẫn Triển Khai

### 1. Thiết lập Môi trường (.env)
Tạo tệp `.env` tại thư mục gốc với các thông số sau:

```env
PORT=3000
# Database (Aiven/MySQL)
DB_HOST=your_host
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=footfield_db

# AI & Storage
GEMINI_API_KEY=your_gemini_key
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name

# Firebase (JSON string)
FIREBASE_SERVICE_ACCOUNT={"project_id": "...", ...}

# Payments (VNPay)
VNP_TMN_CODE=your_code
VNP_HASH_SECRET=your_secret
```

### 2. Cài đặt & Khởi chạy
```bash
# Cài đặt phụ thuộc
npm install

# Chạy Migration để tạo cấu trúc DB
npx knex migrate:latest

# Khởi chạy server (Development)
npm run dev
```

### 3. Build Ứng dụng Di động
1. Mở thư mục `android-tenant` (hoặc `android-provider`) bằng **Android Studio**.
2. Đảm bảo cấu hình `capacitor.config.ts` trỏ đúng vào Domain API của bạn.
3. Build Signed APK/AAB để phát hành.

---

## 🛡 Bảo Mật & Tối Ưu
- **SQL Injection:** Ngăn chặn tuyệt đối thông qua Knex.js.
- **XSS & CSRF:** Đã được xử lý qua cấu hình Middleware và bảo mật tiêu chuẩn.
- **Asset Unification:** Sử dụng hệ thống Design System tập trung giúp giảm 70% nợ kỹ thuật CSS/JS.
- **Hybrid Storage:** Cơ chế tự động chuyển đổi giữa lưu trữ cục bộ và Cloudinary đảm bảo dữ liệu không bị mất trên các nền tảng PaaS như Render.

---
© 2026 FootField Platform. Phát triển bởi luongtd.tech@gmail.com vì cộng đồng bóng đá.
