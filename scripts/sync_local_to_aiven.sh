#!/bin/bash
set -euo pipefail

# === Cấu hình Local ===
LOCAL_HOST="${LOCAL_DB_HOST:-127.0.0.1}"
LOCAL_PORT="${LOCAL_DB_PORT:-3306}"
LOCAL_USER="${LOCAL_DB_USER:-root}"
LOCAL_PASS="${LOCAL_DB_PASSWORD:-}"
LOCAL_DB="${LOCAL_DB_NAME:-footfield}"

# === Cấu hình Aiven (Cloud) ===
AIVEN_HOST="${AIVEN_DB_HOST:-}"
AIVEN_PORT="${AIVEN_DB_PORT:-3306}"
AIVEN_USER="${AIVEN_DB_USER:-}"
AIVEN_PASS="${AIVEN_DB_PASSWORD:-}"
AIVEN_DB="${AIVEN_DB_NAME:-defaultdb}"

if [ -z "$AIVEN_HOST" ] || [ -z "$AIVEN_USER" ] || [ -z "$AIVEN_PASS" ]; then
  echo "Thiếu biến AIVEN_DB_HOST / AIVEN_DB_USER / AIVEN_DB_PASSWORD. Vui lòng khai báo trong .env hoặc biến môi trường." >&2
  exit 1
fi

MYSQL_SSL="--ssl-mode=REQUIRED"
MYSQL_BIN="${MYSQL_BIN:-}"
MYSQLDUMP_BIN="${MYSQLDUMP_BIN:-}"

if [ -z "$MYSQL_BIN" ] && command -v mysql >/dev/null 2>&1; then
  MYSQL_BIN="$(command -v mysql)"
fi
if [ -z "$MYSQLDUMP_BIN" ] && command -v mysqldump >/dev/null 2>&1; then
  MYSQLDUMP_BIN="$(command -v mysqldump)"
fi

if [ -z "$MYSQL_BIN" ] || [ -z "$MYSQLDUMP_BIN" ]; then
  for candidate in \
    "C:/Program Files/MySQL/MySQL Server 8.0/bin" \
    "C:/Program Files/MySQL/MySQL Workbench 8.0" \
    "/usr/local/mysql/bin" \
    "/opt/homebrew/bin"; do
    if [ -x "$candidate/mysql.exe" ] || [ -x "$candidate/mysql" ]; then
      MYSQL_BIN="$candidate/mysql"
    fi
    if [ -x "$candidate/mysqldump.exe" ] || [ -x "$candidate/mysqldump" ]; then
      MYSQLDUMP_BIN="$candidate/mysqldump"
    fi
    if [ -n "$MYSQL_BIN" ] && [ -n "$MYSQLDUMP_BIN" ]; then
      break
    fi
  done
fi

if [ -z "$MYSQL_BIN" ] || [ -z "$MYSQLDUMP_BIN" ]; then
  echo "Không tìm thấy lệnh mysql/mysqldump. Hãy cài MySQL Client hoặc set MYSQL_BIN / MYSQLDUMP_BIN." >&2
  exit 1
fi

if [ -f "$MYSQL_BIN.exe" ] && [ -x "$MYSQL_BIN.exe" ]; then
  MYSQL_BIN="$MYSQL_BIN.exe"
fi
if [ -f "$MYSQLDUMP_BIN.exe" ] && [ -x "$MYSQLDUMP_BIN.exe" ]; then
  MYSQLDUMP_BIN="$MYSQLDUMP_BIN.exe"
fi

echo "[$(date)] Bắt đầu đồng bộ dữ liệu từ Local lên Aiven..."

"$MYSQLDUMP_BIN" -h "$LOCAL_HOST" -P "$LOCAL_PORT" -u "$LOCAL_USER" ${LOCAL_PASS:+-p"$LOCAL_PASS"} \
  --single-transaction --routines --triggers --set-gtid-purged=OFF "$LOCAL_DB" \
  | "$MYSQL_BIN" -h "$AIVEN_HOST" -P "$AIVEN_PORT" -u "$AIVEN_USER" -p"$AIVEN_PASS" $MYSQL_SSL "$AIVEN_DB"

echo "[$(date)] Đồng bộ thành công từ Local lên Aiven!"
