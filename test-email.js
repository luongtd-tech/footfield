async function run() {
  try {
    const res = await fetch('https://footfield.onrender.com/api/invoices/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'INV1781645383295',
        to: 'luongtd.tech@gmail.com',
        subject: '[FootField] Kiểm tra Hóa đơn',
        htmlContent: '<p>Đây là email kiểm tra chức năng gửi hóa đơn.</p>'
      })
    });
    const data = await res.json();
    console.log(data);
  } catch(e) {
    console.error(e);
  }
}
run();
