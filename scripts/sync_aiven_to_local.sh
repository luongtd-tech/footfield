#!/bin/bash

# === Cấu hình Aiven (Cloud) ===
# Lấy từ file .env của dự án
CLOUD_HOST="mysql-33e8e24-luongtd.c.aivencloud.com"
CLOUD_PORT="20403"
CLOUD_USER="avnadmin"
# Lấy mật khẩu từ file .env ở thư mục gốc
source "$(dirname "$0")/../.env"
CLOUD_PASS="$DB_PASSWORD"
CLOUD_DB="defaultdb"

# === Cấu hình MySQL Local (Máy tính của bạn) ===
# Mặc định XAMPP hoặc cài đặt local thường dùng root và không pass
LOCAL_USER="root"
LOCAL_PASS="1112" # Nhập mật khẩu local của bạn vào đây nếu có
LOCAL_DB="footfield" # Tên database ở máy của bạn

echo "[$(date)] Bắt đầu đồng bộ dữ liệu từ Aiven về Local..."

# Lệnh 1: Xóa và tạo lại Database Local (để dọn dẹp data cũ nếu cần, có thể bỏ qua nếu muốn)
mysql -u $LOCAL_USER ${LOCAL_PASS:+-p"$LOCAL_PASS"} -e "CREATE DATABASE IF NOT EXISTS $LOCAL_DB;"

# Lệnh 2: Chạy mysqldump từ Aiven và đẩy thẳng (pipe) vào mysql local
# Cờ --single-transaction giúp không khóa bảng trên Aiven khi đang dump
mysqldump -h $CLOUD_HOST -P $CLOUD_PORT -u $CLOUD_USER -p"$CLOUD_PASS" \
    --single-transaction --routines --triggers --set-gtid-purged=OFF $CLOUD_DB \
    | mysql -u $LOCAL_USER ${LOCAL_PASS:+-p"$LOCAL_PASS"} $LOCAL_DB

if [ $? -eq 0 ]; then
    echo "[$(date)] Đồng bộ thành công!"
else
    echo "[$(date)] Đồng bộ thất bại! Vui lòng kiểm tra lại kết nối."
fi
