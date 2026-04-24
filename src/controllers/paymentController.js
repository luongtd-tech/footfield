const crypto = require("crypto");
const db = require('../config/database');
const querystring = require('qs');

function sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj) {
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
        
        const tmnCode = process.env.VNP_TMN_CODE;
        const secretKey = process.env.VNP_HASH_SECRET;
        let vnpUrl = process.env.VNP_URL;
        const returnUrl = process.env.VNP_RETURN_URL;

        const ipAddr = req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;

        const orderId = `${bookingId}_${createDate}`; // Đảm bảo txnRef là duy nhất

        let vnp_Params = {
            'vnp_Version': '2.1.0',
            'vnp_Command': 'pay',
            'vnp_TmnCode': tmnCode,
            'vnp_Locale': 'vn',
            'vnp_CurrCode': 'VND',
            'vnp_TxnRef': orderId,
            'vnp_OrderInfo': `Thanh toan don hang ${bookingId}`,
            'vnp_OrderType': 'other',
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
            if (rspCode === "00") {
                await db.query("UPDATE bookings SET paid = 1, payment_method = 'vnpay' WHERE id = ?", [bookingId]);
                res.status(200).json({ RspCode: '00', Message: 'Success' });
            } else {
                // Thanh toán thất bại
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
