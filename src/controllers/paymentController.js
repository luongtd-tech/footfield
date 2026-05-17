const crypto = require("crypto");
const db = require('../config/database');
const querystring = require('qs');

function sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj){
        if (obj.hasOwnProperty(key)) {
            str.push(encodeURIComponent(key));
        }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}${h}${min}${s}`;
}

exports.createPaymentUrl = async (req, res) => {
    try {
        const { bookingId, amount, bankCode } = req.body;
        
        if (!bookingId || !amount) {
            return res.status(400).json({ message: "Thiếu thông tin thanh toán" });
        }

        const date = new Date();
        const createDate = formatDate(date);
        
        // Đảm bảo xóa dấu cách thừa nếu có
        const tmnCode = process.env.VNP_TMN_CODE.trim();
        const secretKey = process.env.VNP_HASH_SECRET.trim();
        let vnpUrl = process.env.VNP_URL.trim();
        const returnUrl = process.env.VNP_RETURN_URL.trim();

        let ipAddr = req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;

        // Nếu chạy ở localhost, IP có thể là ::1, VNPay yêu cầu định dạng IPv4
        if (ipAddr === '::1' || ipAddr === '127.0.0.1') {
            ipAddr = '127.0.0.1';
        }

        const orderId = `${bookingId}_${date.getTime()}`; 

        let vnp_Params = {
            'vnp_Version': '2.1.0',
            'vnp_Command': 'pay',
            'vnp_TmnCode': tmnCode,
            'vnp_Locale': 'vn',
            'vnp_CurrCode': 'VND',
            'vnp_TxnRef': orderId,
            'vnp_OrderInfo': 'Thanh toan GD ' + bookingId,
            'vnp_OrderType': 'billpayment',
            'vnp_Amount': amount * 100,
            'vnp_ReturnUrl': returnUrl,
            'vnp_IpAddr': ipAddr,
            'vnp_CreateDate': createDate
        };

        if (bankCode) {
            vnp_Params['vnp_BankCode'] = bankCode;
        }

        vnp_Params = sortObject(vnp_Params);

        const signData = querystring.stringify(vnp_Params, { encode: false });
        const hmac = crypto.createHmac("sha512", secretKey);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
        vnp_Params['vnp_SecureHash'] = signed;
        vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });

        res.json({ paymentUrl: vnpUrl });
    } catch (error) {
        console.error("Error creating VNPay URL:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi tạo link thanh toán" });
    }
};

exports.vnpayReturn = async (req, res) => {
    try {
        let vnp_Params = req.query;
        const secureHash = vnp_Params['vnp_SecureHash'];

        delete vnp_Params['vnp_SecureHash'];
        delete vnp_Params['vnp_SecureHashType'];

        vnp_Params = sortObject(vnp_Params);

        const secretKey = process.env.VNP_HASH_SECRET;
        const signData = querystring.stringify(vnp_Params, { encode: false });
        const hmac = crypto.createHmac("sha512", secretKey);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

        if (secureHash === signed) {
            const rspCode = vnp_Params['vnp_ResponseCode'];
            const txnRef = vnp_Params['vnp_TxnRef'];
            const bookingId = txnRef.split('_')[0];

            if (rspCode === "00") {
                // Thanh toán thành công -> Sẽ được xử lý bởi IPN, ở đây chỉ hiển thị kết quả
                res.redirect(`/payment-result.html?status=success&bookingId=${bookingId}`);
            } else {
                res.redirect(`/payment-result.html?status=error&code=${rspCode}`);
            }
        } else {
            res.redirect(`/payment-result.html?status=invalid_signature`);
        }
    } catch (error) {
        console.error("Error in vnpayReturn:", error);
        res.redirect(`/payment-result.html?status=system_error`);
    }
};

exports.vnpayIpn = async (req, res) => {
    try {
        let vnp_Params = req.query;
        const secureHash = vnp_Params['vnp_SecureHash'];

        delete vnp_Params['vnp_SecureHash'];
        delete vnp_Params['vnp_SecureHashType'];

        vnp_Params = sortObject(vnp_Params);
        const secretKey = process.env.VNP_HASH_SECRET;
        const signData = querystring.stringify(vnp_Params, { encode: false });
        const hmac = crypto.createHmac("sha512", secretKey);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

        if (secureHash === signed) {
            const orderId = vnp_Params['vnp_TxnRef'];
            const bookingId = orderId.split('_')[0];
            const rspCode = vnp_Params['vnp_ResponseCode'];

            // 1. Kiểm tra đơn hàng có tồn tại trong DB không
            const [bookings] = await db.query("SELECT * FROM bookings WHERE id = ?", [bookingId]);
            if (bookings.length === 0) {
                return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
            }

            const booking = bookings[0];

            // 2. Kiểm tra số tiền có khớp không (vnp_Amount trả về đã nhân 100)
            const vnpAmount = vnp_Params['vnp_Amount'] / 100;
            if (booking.total_price !== vnpAmount) {
                return res.status(200).json({ RspCode: '04', Message: 'Amount mismatch' });
            }

            // 3. Kiểm tra trạng thái đơn hàng (tránh update lại nếu đã hoàn thành)
            if (booking.paid) {
                return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
            }

            // 4. Cập nhật kết quả
            const bankCode = vnp_Params['vnp_BankCode'] || '';
            if (rspCode === "00") {
                await db.query("UPDATE bookings SET paid = 1, payment_method = 'vnpay' WHERE id = ?", [bookingId]);
                await db.query("INSERT INTO payments (vnp_txn_ref, booking_id, amount, bank_code, status) VALUES (?, ?, ?, ?, 'success')", [orderId, bookingId, vnpAmount, bankCode]);
                res.status(200).json({ RspCode: '00', Message: 'Success' });
            } else {
                // Thanh toán thất bại
                await db.query("INSERT INTO payments (vnp_txn_ref, booking_id, amount, bank_code, status) VALUES (?, ?, ?, ?, 'fail')", [orderId, bookingId, vnpAmount, bankCode]);
                res.status(200).json({ RspCode: '00', Message: 'Payment Failed acknowledged' });
            }
        } else {
            res.status(200).json({ RspCode: '97', Message: 'Invalid Checksum' });
        }
    } catch (error) {
        console.error("VNPay IPN Error:", error);
        res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
    }
};

exports.bankTransferWebhook = async (req, res) => {
    try {
        console.log("👉 Received bank transfer webhook payload:", JSON.stringify(req.body));
        
        let transactions = [];
        
        // 1. Phân tích cú pháp dữ liệu (Parse payload dynamically)
        if (req.body.data && Array.isArray(req.body.data)) {
            // Định dạng Casso / PayOS
            transactions = req.body.data.map(item => ({
                id: item.id || item.transactionId,
                amount: item.amount,
                description: item.description || item.content || ''
            }));
        } else if (req.body.transferAmount !== undefined) {
            // Định dạng SePay
            transactions = [{
                id: req.body.id,
                amount: req.body.transferAmount,
                description: req.body.content || ''
            }];
        } else if (req.body.description !== undefined) {
            // Định dạng custom test webhook
            transactions = [{
                id: req.body.id || Date.now(),
                amount: req.body.amount || 0,
                description: req.body.description || ''
            }];
        }

        const pushNotifier = require('../utils/pushNotifier');
        const Booking = require('../models/Booking');

        for (const tx of transactions) {
            const desc = tx.description || '';
            const amount = tx.amount || 0;
            
            // Tìm mã booking dạng bk_xxxxxxx trong nội dung chuyển khoản
            const match = desc.match(/FootField\s*#\s*(bk_[a-zA-Z0-9_]+)/i) || desc.match(/#(bk_[a-zA-Z0-9_]+)/i);
            
            if (match) {
                const bookingId = match[1];
                console.log(`🔍 Found potential booking ID: ${bookingId} in transaction description.`);

                // 2. Tìm đơn đặt sân trong Database
                const booking = await Booking.findById(bookingId);
                if (booking) {
                    if (booking.paid) {
                        console.log(`ℹ️ Booking ${bookingId} is already paid. Skipping.`);
                        continue;
                    }

                    // 3. Cập nhật trạng thái thanh toán của đơn hàng thành công
                    // Đánh dấu là paid=1, payment_method='transfer' (chuyển khoản)
                    await Booking.updatePayment(bookingId, 1, 'transfer');
                    
                    // Cập nhật cả status thành 'confirmed' (tự động duyệt lịch khi đã thanh toán)
                    await Booking.updateStatus(bookingId, 'confirmed');

                    console.log(`✅ Automatically confirmed booking ${bookingId} for amount ${amount}đ.`);

                    // 4. Lưu vết giao dịch vào bảng payments
                    try {
                        await db.query(
                            "INSERT INTO payments (vnp_txn_ref, booking_id, amount, bank_code, status) VALUES (?, ?, ?, ?, 'success')",
                            [`BANK_${tx.id || Date.now()}`, bookingId, amount, 'BANK_TRANSFER', 'success']
                        );
                    } catch (dbErr) {
                        console.error("⚠️ Failed to log transaction in payments table:", dbErr.message);
                    }

                    // 5. Gửi Push Notification thời gian thực cho Khách hàng & Chủ sân (Tenant)
                    try {
                        // Thông báo cho Tenant (Chủ sân)
                        await pushNotifier.sendToTenant(
                            booking.tenant_id,
                            '💰 Đã nhận tiền chuyển khoản!',
                            `Đơn đặt sân #${bookingId} của khách hàng ${booking.customer_name} đã được thanh toán thành công qua VietQR (${amount.toLocaleString()}đ).`,
                            { bookingId: bookingId, type: 'payment_success' }
                        );

                        // Thông báo cho Customer (Khách hàng)
                        const [customers] = await db.query('SELECT id FROM customers WHERE phone = ? AND tenant_id = ?', [booking.customer_phone, booking.tenant_id]);
                        if (customers.length > 0) {
                            await pushNotifier.sendToCustomer(
                                customers[0].id,
                                '✅ Thanh toán thành công!',
                                `Lịch đặt sân #${bookingId} của bạn đã được xác nhận thanh toán thành công qua VietQR. Cảm ơn bạn!`,
                                { bookingId: bookingId, type: 'payment_success' }
                            );
                        }
                    } catch (pushErr) {
                        console.error("⚠️ Failed to send real-time push notification:", pushErr.message);
                    }
                } else {
                    console.log(`❌ Booking with ID ${bookingId} not found in database.`);
                }
            } else {
                console.log(`ℹ️ Transaction description "${desc}" does not contain a valid FootField booking ID format.`);
            }
        }

        res.status(200).json({ success: true, message: "Webhook processed successfully" });
    } catch (error) {
        console.error("🔴 Error processing bank transfer webhook:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};
