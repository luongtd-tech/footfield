if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then(reg => console.log('PWA Service Worker registered.', reg))
      .catch(err => console.error('PWA Service Worker registration failed:', err));
  });
}
// ===== APP LOGIC =====
let TENANT_ID = '';
let db = {};
const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 phút

const PKG_FEATURES = {
  'pkg1': { name: 'Cơ Bản', max_fields: 3, extras: [] },
  'pkg2': { name: 'Tiêu Chuẩn', max_fields: 8, extras: ['checkin', 'payment', 'invoice', 'canteen'] },
  'pkg3': { name: 'Cao Cấp', max_fields: 999, extras: ['checkin', 'payment', 'invoice', 'canteen', 'finance', 'monitoring'] }
};

function applyPackageRestrictions(tenant) {
  if (!tenant || !tenant.package_id) return;
  const pkg = PKG_FEATURES[tenant.package_id] || PKG_FEATURES['pkg1'];
  
  // Update package label in sidebar
  document.querySelectorAll('.tenant-pkg').forEach(el => el.textContent = `📦 Gói ${pkg.name} · FootField`);

  // Hide/Show Extra features based on package
  const utilExtras = ['checkin', 'payment', 'invoice'];
  utilExtras.forEach(feat => {
    const navItem = document.getElementById(`nav-${feat}`);
    const topBtn = document.getElementById(`top-btn-${feat}`);
    const isVisible = pkg.extras.includes(feat);
    
    if (navItem) navItem.style.display = isVisible ? 'flex' : 'none';
    if (topBtn) topBtn.style.display = isVisible ? 'inline-flex' : 'none';
  });

  // Hide/Show Canteen feature
  const canteenNav = document.getElementById('nav-canteen');
  if (canteenNav) canteenNav.style.display = pkg.extras.includes('canteen') ? 'flex' : 'none';

  // Hide/Show Finance feature
  const financeNav = document.getElementById('nav-finance');
  const financeSec = document.getElementById('nav-finance-sec');
  if (financeNav) financeNav.style.display = pkg.extras.includes('finance') ? 'flex' : 'none';
  if (financeSec) financeSec.style.display = (pkg.extras.includes('finance') || pkg.extras.includes('canteen')) ? 'block' : 'none';

  // Hide/Show Monitoring feature
  const monitoringNav = document.getElementById('nav-monitoring');
  if (monitoringNav) monitoringNav.style.display = pkg.extras.includes('monitoring') ? 'flex' : 'none';

  // Hide utility section if no utility extras are visible
  const hasAnyUtilExtra = utilExtras.some(f => pkg.extras.includes(f));
  const utilSec = document.getElementById('nav-util-sec');
  if (utilSec) utilSec.style.display = hasAnyUtilExtra ? 'block' : 'none';

  // Field Limit Check for UI
  const currentCount = (db.fields || []).length;
  const btnAdd = document.getElementById('btn-add-field');
  const limitInfo = document.getElementById('field-limit-info');
  
  if (limitInfo) {
    limitInfo.textContent = `Hạn mức: ${currentCount}/${pkg.max_fields === 999 ? '∞' : pkg.max_fields} sân`;
    limitInfo.style.display = 'block';
  }

  if (btnAdd) {
    if (currentCount >= pkg.max_fields) {
      btnAdd.disabled = true;
      btnAdd.style.opacity = '0.5';
      btnAdd.style.cursor = 'not-allowed';
      btnAdd.title = 'Đã đạt giới hạn số lượng sân của gói dịch vụ';
    } else {
      btnAdd.disabled = false;
      btnAdd.style.opacity = '1';
      btnAdd.style.cursor = 'pointer';
      btnAdd.title = '';
    }
  }
}

function updateLastActive() {
  localStorage.setItem('ff_tenant_last_active', Date.now().toString());
}

// Lắng nghe các sự kiện để cập nhật thời gian hoạt động cuối cùng
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(name => {
  document.addEventListener(name, updateLastActive, true);
});

// HELPERS
function myBookings(){return(db.bookings||[]).filter(b=>b.tenant_id===TENANT_ID);}
function myCustomers(){return(db.customers||[]).filter(c=>c.tenant_id===TENANT_ID);}
function myFields(){return(db.fields||[]).filter(f=>f.tenant_id===TENANT_ID);}
function getField(id){return myFields().find(f=>f.id===id)||{};}
function fieldStatusBadge(s){const m={available:'<span class="badge badge-green">✅ Sẵn sàng</span>',maintenance:'<span class="badge badge-yellow">🔧 Bảo trì</span>',occupied:'<span class="badge badge-red">🔴 Đang dùng</span>'};return m[s]||s;}
function bkStatusBadge(s){const m={confirmed:'<span class="badge badge-blue">✓ Xác nhận</span>',pending:'<span class="badge badge-yellow">⏳ Chờ xác nhận</span>',arrived:'<span class="badge badge-purple">🏃 Đã đến sân</span>',completed:'<span class="badge badge-green">✅ Hoàn thành</span>',cancelled:'<span class="badge badge-red">✗ Đã hủy</span>'};return m[s]||s;}
function custBadge(s){const m={vip:'<span class="badge badge-yellow">⭐ VIP</span>',regular:'<span class="badge badge-blue">👤 Thường</span>',new:'<span class="badge badge-green">🌟 Mới</span>'};return m[s]||s;}
function pmBadge(s){const m={cash:'💵 Tiền mặt',transfer:'🏦 Chuyển khoản',vnpay:'🔵 VNPay'};return m[s]||s;}
function tkStatusBadge(s){const m={open:'<span class="badge badge-yellow">⏳ Đang chờ</span>',processing:'<span class="badge badge-blue">⚙️ Đang xử lý</span>',resolved:'<span class="badge badge-green">✅ Đã xong</span>'};return m[s]||s;}
function tkPrioBadge(s){const m={high:'<span class="badge badge-red">🔴 Cao</span>',medium:'<span class="badge badge-yellow">🟡 Trung bình</span>',low:'<span class="badge badge-gray">⚪ Thấp</span>'};return m[s]||s;}

// AUTH
async function doLogin(){
  const u=document.getElementById('login-user').value;
  const p=document.getElementById('login-pass').value;
  const errorEl = document.getElementById('login-error');

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p, type: 'tenant' })
    });

    const data = await response.json();

    if (data.success) {
      TENANT_ID = data.user.id || data.user.tenant_id;
      document.getElementById('login-page').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      localStorage.setItem('ff_tenant_user', JSON.stringify(data.user));
      updateLastActive(); // Khởi tạo thời gian hoạt động
      initApp();
    } else {
      errorEl.style.display = 'block';
      errorEl.textContent = '❌ ' + (data.message || 'Tài khoản hoặc mật khẩu không đúng');
    }
  } catch (error) {
    console.error('Login error:', error);
    errorEl.style.display = 'block';
    errorEl.textContent = '❌ Lỗi kết nối đến server';
  }
}
document.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
function doLogout(){
  localStorage.removeItem('ff_tenant_user');
  localStorage.removeItem('ff_tenant_last_active');
  document.getElementById('app').style.display='none';
  document.getElementById('login-page').style.display='flex';
}

// NAV
const pageTitles={dashboard:'Dashboard',fields:'Quản lý sân bóng',schedule:'Lịch đặt sân',customers:'Quản lý khách hàng',finance:'Quản lý tài chính',checkin:'Check-in QR',payment:'Thu tiền',invoice:'In hóa đơn',notifications:'Thông báo hệ thống',settings:'Cài đặt hệ thống',canteen:'Quản lý căng tin',staff:'Quản lý nhân viên',support:'Hỗ trợ & Báo lỗi',monitoring:'Giám sát sân trực tuyến'};
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  
  const targetPage = document.getElementById('page-'+name);
  if (targetPage) targetPage.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick')?.includes(`'${name}'`)) n.classList.add('active');
  });

  document.getElementById('topbar-title').textContent=pageTitles[name] || name;
  
  if(name === 'dashboard') loadDashboardData();
  
  const renders={fields:renderFields,schedule:renderSchedule,customers:renderCustomers,finance:renderFinance,checkin:renderCheckin,payment:renderPayment,invoice:renderInvoicePage,notifications:renderNotifications,settings:renderSettings,staff:renderStaff,monitoring:renderMonitoring,canteen:renderCanteen,support:renderSupport};
  const renderFn = renders[name] || (typeof window !== 'undefined' && window['render' + name.charAt(0).toUpperCase() + name.slice(1)]);
  if(renderFn) renderFn();
  
  if(name === 'notifications') markAllNotifsRead();

  // Close sidebar after selection (on mobile/tablets)
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar && sidebar.classList.contains('show')) sidebar.classList.remove('show');
  if (overlay && overlay.classList.contains('show')) overlay.classList.remove('show');
}

// INIT
async function initApp(){
  const loadingOverlay = document.getElementById('page-loading-overlay');
  
  const now=new Date();
  document.getElementById('current-date').textContent=now.toLocaleDateString('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});
  
  // initDB();
  populateFieldFilters();

  // Load dashboard data from API
  const dashData = await loadDashboardData();
  if(db.tenant) syncGlobalUI(db.tenant);
  
  // Update storefront link dynamically
  const previewBtn = document.getElementById('storefront-preview-btn');
  const linkObj = new URL('customer.html', window.location.href);
  linkObj.searchParams.set('tenant', TENANT_ID);
  if(previewBtn) previewBtn.href = linkObj.href;

  // Pre-load canteen data
  loadCanteenData();

  // Init Flatpickr
  flatpickr("#bk-date", {
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "d/m/Y",
    locale: "vn",
    defaultDate: "today"
  });

  // Ẩn loading overlay sau khi tất cả dữ liệu đã tải xong
  if (loadingOverlay) {
    loadingOverlay.classList.add('hidden');
  }
}

async function loadCanteenData() {
  if (!TENANT_ID) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/services/tenant/${TENANT_ID}`);
    if (!res.ok) {
      db.services = [];
      return;
    }
    const data = await res.json();
    db.services = Array.isArray(data) ? data : (data && data.data ? data.data : []);
  } catch (err) {
    console.error('Error loading services:', err);
    db.services = [];
  }
}

async function renderCanteen(force = false) {
  const table = document.getElementById('canteen-table');
  if (!table) return;
  
  table.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">⏳ Đang tải dữ liệu dịch vụ...</td></tr>';

  try {
    if (!db.services || force) await loadCanteenData();
    const servicesData = Array.isArray(db.services) ? db.services : [];

    if (servicesData.length === 0) {
      table.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3);">🥤 Chưa có dịch vụ nào được thêm</td></tr>';
      return;
    }

    table.innerHTML = servicesData.map(s => {
      let catLabel = 'Khác';
      let badgeClass = 'badge-gray';
      if (s.category === 'drink') { catLabel = 'Nước uống'; badgeClass = 'badge-blue'; }
      else if (s.category === 'food') { catLabel = 'Đồ ăn'; badgeClass = 'badge-green'; }
      else if (s.category === 'rental') { catLabel = 'Thuê đồ'; badgeClass = 'badge-orange'; }
      else if (s.category === 'medical') { catLabel = 'Y tế'; badgeClass = 'badge-red'; }
      else if (s.category === 'other') { catLabel = 'Dịch vụ khác'; badgeClass = 'badge-gray'; }

      return `
      <tr>
        <td><strong>${s.name || 'Không tên'}</strong></td>
        <td><span class="badge ${badgeClass}">${catLabel}</span></td>
        <td><strong style="font-family:var(--mono)">${fmt(Number(s.price) || 0)}</strong></td>
        <td>${s.unit || ''}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="openServiceModal('${s.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteService('${s.id}')">🗑️</button>
        </td>
      </tr>
    `;
    }).join('');
  } catch (err) {
    console.error('Error in renderCanteen:', err);
    table.innerHTML = `<tr><td colspan="5" style="color:var(--red);text-align:center;padding:20px;">❌ Lỗi hiển thị: ${err.message}</td></tr>`;
  }
}


function copyStoreLink() {
  const linkObj = new URL('customer.html', window.location.href);
  linkObj.searchParams.set('tenant', TENANT_ID);
  const link = linkObj.href;
  
  navigator.clipboard.writeText(link).then(() => {
    alert('✅ Đã sao chép link gian hàng của bạn:\n' + link);
  }).catch(err => {
    prompt('Link gian hàng của bạn (Hãy bôi đen và copy):', link);
  });
}

async function loadDashboardData() {
  const loadingOverlay = document.getElementById('page-loading-overlay');
  try {
    const response = await fetch(`${API_BASE_URL}/api/tenants/${TENANT_ID}/dashboard`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Fetch customers
    const custRes = await fetch(`${API_BASE_URL}/api/customers/tenant/${TENANT_ID}`);
    db.customers = await custRes.json();
    
    // Fetch tickets
    const tkRes = await fetch(`${API_BASE_URL}/api/tickets/tenant/${TENANT_ID}`);
    db.tickets = await tkRes.json();
    
    renderDashboard(data);
    if (db.tenant) applyPackageRestrictions(db.tenant);
    if(document.getElementById('page-support').classList.contains('active')) renderSupport();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    document.getElementById('page-dashboard').innerHTML = `<div style="text-align:center;padding:40px;color:var(--red)">Lỗi tải dữ liệu Dashboard. Vui lòng kiểm tra lại kết nối và API.</div>`;
    // Vẫn ẩn overlay ngay cả khi có lỗi để user thấy thông báo lỗi
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
  }
}

// MONITORING (WebRTC Multi-Field)
let monitorSocket;
const rtcPeers = {};
const pendingStreams = {}; // fieldId -> MediaStream (if offer arrives before DOM)

async function renderMonitoring() {
  const grid = document.getElementById('monitoring-grid');
  grid.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);grid-column:1/-1;">⏳ Đang tải...</div>`;

  // Luôn fetch mới nhất
  try {
    const r = await fetch(`${API_BASE_URL}/api/fields/${TENANT_ID}`);
    db.fields = await r.json();
  } catch(e) { db.fields = []; }

  const fields = db.fields;
  if (!fields.length) {
    grid.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text3);grid-column:1/-1;">
      <div style="font-size:48px;margin-bottom:12px;">📷</div>
      <div>Chưa có sân nào.</div>
    </div>`;
    return;
  }

  // Render lưới video theo từng sân
  grid.innerHTML = fields.map(f => `
    <div class="card" style="padding:0;overflow:hidden;" id="cam-card-${f.id}">
      <div style="background:#000;position:relative;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;">
        <video id="video-field-${f.id}" autoplay playsinline style="width:100%;height:100%;object-fit:cover;display:none;"></video>
        <div id="no-signal-${f.id}" style="text-align:center;color:#94a3b8;">
          <div style="font-size:36px;margin-bottom:8px;">📡</div>
          <div style="font-size:13px;">Chưa có tín hiệu</div>
        </div>
        <div id="live-badge-${f.id}" style="display:none;position:absolute;top:8px;right:8px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;">● LIVE</div>
      </div>
      <div style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;font-size:13px;">${f.name}</div>
          <div id="cam-status-${f.id}" style="font-size:11px;color:var(--text2);margin-top:2px;">⏳ Chờ kết nối...</div>
        </div>
        <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="watchField('${f.id}')">📺 Xem</button>
      </div>
    </div>
  `).join('');

  // Nếu có stream đang chờ (offer đến trước DOM), hiển thị ngay
  for (const [fieldId, stream] of Object.entries(pendingStreams)) {
    showStream(fieldId, stream);
    delete pendingStreams[fieldId];
  }

  initMonitorSocket();
}

function showStream(fieldId, stream) {
  const video = document.getElementById(`video-field-${fieldId}`);
  const noSignal = document.getElementById(`no-signal-${fieldId}`);
  const liveBadge = document.getElementById(`live-badge-${fieldId}`);
  const status = document.getElementById(`cam-status-${fieldId}`);
  if (video) {
    video.srcObject = stream;
    video.style.display = 'block';
    if (noSignal) noSignal.style.display = 'none';
    if (liveBadge) liveBadge.style.display = 'block';
    if (status) status.textContent = '🔴 Đang phát LIVE';
  }
}

function initMonitorSocket() {
  if (monitorSocket) return;
  monitorSocket = io();

  monitorSocket.on('offer', async (payload) => {
    const roomId = payload.roomId;
    if (!roomId) return;
    const fieldId = roomId.split('-field-')[1];
    if (!fieldId) return;

    console.log(`📥 Nhận stream cho sân ${fieldId}`);

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    rtcPeers[fieldId] = peer;

    peer.onicecandidate = (e) => {
      if (e.candidate) monitorSocket.emit('ice-candidate', { target: payload.sender, candidate: e.candidate });
    };

    peer.ontrack = (e) => {
      const stream = e.streams[0];
      const videoEl = document.getElementById(`video-field-${fieldId}`);
      if (videoEl) {
        showStream(fieldId, stream);
      } else {
        // DOM chưa sẵn sàng → lưu vào buffer
        pendingStreams[fieldId] = stream;
      }
    };

    await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    monitorSocket.emit('answer', { target: payload.sender, sdp: peer.localDescription });
  });

  monitorSocket.on('ice-candidate', (payload) => {
    for (const peer of Object.values(rtcPeers)) {
      if (peer) peer.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
    }
  });
}

function watchField(fieldId) {
  if (!monitorSocket) initMonitorSocket();
  const roomId = `${TENANT_ID}-field-${fieldId}`;
  monitorSocket.emit('join-room', roomId);
  const status = document.getElementById(`cam-status-${fieldId}`);
  if (status) status.textContent = '📡 Đang tìm camera...';
}

async function connectAllCameras() {
  // Đảm bảo DOM đã render xong trước khi join room
  await renderMonitoring();
  const fields = db.fields || [];
  fields.forEach(f => watchField(f.id));
  const btn = document.getElementById('btn-connect-all');
  if (btn) {
    btn.textContent = '✅ Đã kết nối ' + fields.length + ' sân';
    setTimeout(() => { btn.textContent = '🔄 Kết nối lại'; }, 3000);
  }
}

// DASHBOARD

function renderDashboard(data){
  if (!data) return;

  const { stats, revenue7Days, todayBookingsList, fieldsStatus, vipCustomers } = data;

  // 1. Update stat cards
  document.getElementById('d-fields').textContent = stats.activeFields;
  document.getElementById('d-today').textContent = stats.todayBookings;
  document.getElementById('d-rev').textContent = (stats.todayRevenue / 1000).toFixed(0) + 'K';
  document.getElementById('d-cust').textContent = stats.totalCustomers;
  document.getElementById('d-cust-sub').textContent = `${stats.vipCustomers} khách VIP`;
  
  // Update sub-texts
  document.getElementById('d-fields-sub').textContent = `${stats.maintenanceFields} sân đang bảo trì`;
  document.getElementById('d-today-sub').textContent = `${stats.confirmedToday} đã xác nhận`;
  document.getElementById('d-rev-sub').textContent = `${stats.paidTransactionsToday} giao dịch thành công`;
  
  updateSidebarBadges(stats);

  // 2. Update revenue chart
  const revChart = document.querySelector('.rev-chart');
  if (revChart) {
    const maxRev = Math.max(...revenue7Days.map(d => d.revenue), 1);
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    revChart.innerHTML = revenue7Days.map(d => {
      const day = new Date(d.day);
      const height = (d.revenue / maxRev * 100).toFixed(0);
      return `<div class="rev-bar" style="height:${height}%;background:linear-gradient(180deg,#16a34a,#15803d);">
        <div class="rev-bar-val">${(d.revenue / 1000).toFixed(0)}K</div>
        <div class="rev-bar-label">${days[day.getDay()]}</div>
      </div>`;
    }).join('');
  }

  // 3. Update today's bookings
  document.getElementById('today-bookings').innerHTML = todayBookingsList.length ? todayBookingsList.map(b => {
    return`<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="font-size:24px">⚽</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:600">${b.customer_name}</div><div style="font-size:11px;color:var(--text2)">${b.field_name} · ${b.start_time}-${b.end_time}</div></div>
      ${bkStatusBadge(b.status)}
    </div>`}).join('') : '<div style="text-align:center;padding:20px;color:var(--text3)">Không có đặt sân hôm nay</div>';

  // 4. Update fields status
  document.getElementById('dash-fields').innerHTML = fieldsStatus.map(f => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="font-size:20px">⚽</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:600">${f.name}</div><div style="font-size:11px;color:var(--text2)">${fmt(f.price_per_hour)}/giờ</div></div>
      ${fieldStatusBadge(f.status)}
    </div>`).join('');

  // 5. Update VIP customers
  document.getElementById('dash-vips').innerHTML = vipCustomers.map(c => `
    <div class="customer-row">
      <div class="cust-ava">${c.name[0]}</div>
      <div><div class="cust-name">${c.name}</div><div class="cust-info">${c.total_bookings} lần đặt sân</div></div>
      <div class="cust-stat">${fmt(c.total_spent)}<div class="cust-stat-sub">Tổng chi</div></div>
    </div>`).join('');
}

// FIELDS
async function renderFields(){
  try {
    const response = await fetch(`${API_BASE_URL}/api/fields/${TENANT_ID}`);
    const fields = await response.json();
    db.fields = fields;

    // Fetch today's bookings to check "Occupied" status
    const bkRes = await fetch(`${API_BASE_URL}/api/bookings/tenant/${TENANT_ID}`);
    const bookings = await bkRes.json();
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const todayStr = new Date(now.getTime() + (7*60*60*1000)).toISOString().slice(0, 10);

    document.getElementById('fields-grid').innerHTML = fields.map(f => {
      // Check if occupied right now
      let status = f.status || 'available';
      if (status === 'available') {
        const activeBk = (db.bookings || []).find(b => {
          if (b.field_id !== f.id || b.date !== todayStr || b.status === 'cancelled') return false;
          const [sh, sm] = b.start_time.split(':').map(Number);
          const [eh, em] = b.end_time.split(':').map(Number);
          const start = sh * 60 + sm;
          const end = eh * 60 + em;
          return currentTime >= start && currentTime <= end;
        });
        if (activeBk) status = 'occupied';
      }

      return `<div class="field-card">
        <div class="field-top">
          <div class="field-icon">
            ${f.image && (f.image.startsWith('http') || f.image.startsWith('/')) 
              ? `<img src="${f.image}" onerror="this.src='https://placehold.co/40x40?text=⚽'">` 
              : (f.image || '⚽')}
          </div>
          <div><div class="field-name">${f.name}</div><div class="field-type">${f.type}</div></div>
        </div>
        <div class="field-body">
          <div class="field-stat-row">
            ${fieldStatusBadge(status)}
            <span class="badge badge-gray">${f.size}</span>
            <span class="badge badge-gray">🌿 ${f.grass}</span>
          </div>
          <div style="font-size:20px;font-weight:800;font-family:var(--mono);color:var(--green);margin-bottom:12px">${fmt(f.price_per_hour)}<span style="font-size:12px;font-weight:400;color:var(--text2)">/giờ</span></div>
          <div class="field-actions">
            <button class="btn btn-sm btn-secondary" onclick="openFieldModal('${f.id}')">✏️ Sửa</button>
            <button class="btn btn-sm btn-warning" onclick="toggleFieldStatus('${f.id}', '${f.status}')">
              ${f.status === 'maintenance' ? '✅ Sẵn sàng' : '🔧 Bảo trì'}
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteField('${f.id}')">🗑️ Xóa</button>
            <button class="btn btn-sm btn-primary" onclick="document.getElementById('bk-field').value='${f.id}';openBookingModal()">+ Đặt</button>
          </div>
        </div>
      </div>`}).join('');

    // Re-apply restrictions to update "Add Field" button status
    if (db.tenant) applyPackageRestrictions(db.tenant);
  } catch (error) {
    console.error('Error rendering fields:', error);
    document.getElementById('fields-grid').innerHTML = '<p style="color:red">Lỗi tải danh sách sân bóng.</p>';
  }
}

function openFieldModal(id) {
  const modal = document.getElementById('modal-field');
  const title = document.getElementById('field-modal-title');
  const saveBtn = document.getElementById('field-save-btn');
  
  document.getElementById('field-id').value = '';
  document.getElementById('field-name').value = '';
  document.getElementById('field-type').value = '5v5';
  document.getElementById('field-size').value = '';
  document.getElementById('field-grass').value = '';
  document.getElementById('field-price').value = '';
  document.getElementById('field-image').value = '';
  document.getElementById('field-amenities').value = '';
  document.getElementById('field-desc').value = '';

  if (id) {
    const field = db.fields.find(f => f.id === id);
    if (field) {
      title.textContent = '✏️ Chỉnh sửa sân';
      saveBtn.textContent = '💾 Lưu thay đổi';
      document.getElementById('field-id').value = field.id;
      document.getElementById('field-name').value = field.name;
      document.getElementById('field-type').value = field.type;
      document.getElementById('field-size').value = field.size;
      document.getElementById('field-grass').value = field.grass;
      document.getElementById('field-price').value = field.price_per_hour;
      document.getElementById('field-image').value = field.image || '';
      document.getElementById('field-amenities').value = field.amenities || '';
      document.getElementById('field-desc').value = field.description || '';
    }
  } else {
    title.textContent = '⚽ Thêm sân mới';
    saveBtn.textContent = '✅ Thêm sân';
  }
  modal.classList.add('show');
}

async function saveField() {
  const fieldId = document.getElementById('field-id').value;
  const isUpdating = !!fieldId;
  const fieldData = {
    tenant_id: TENANT_ID,
    name: document.getElementById('field-name').value,
    type: document.getElementById('field-type').value,
    size: document.getElementById('field-size').value,
    grass: document.getElementById('field-grass').value,
    price_per_hour: parseInt(document.getElementById('field-price').value, 10),
    image: document.getElementById('field-image').value,
    amenities: document.getElementById('field-amenities').value,
    description: document.getElementById('field-desc').value,
    status: isUpdating ? (db.fields.find(f=>f.id===fieldId)||{}).status : 'available'
  };

  const url = isUpdating ? `${API_BASE_URL}/api/fields/${fieldId}` : `${API_BASE_URL}/api/fields`;
  const method = isUpdating ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fieldData)
    });

    if (response.ok) {
      closeModal('modal-field');
      await renderFields(); // Refresh the list
      await loadDashboardData(); // Refresh dashboard stats
    } else {
      const error = await response.json();
      alert(`Lỗi lưu sân: ${error.message}`);
    }
  } catch (error) {
    console.error('Error saving field:', error);
    alert('Lỗi kết nối khi lưu sân.');
  }
}

async function deleteField(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa sân này không? Hành động này không thể hoàn tác.')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/fields/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      await renderFields(); // Refresh the list
      await loadDashboardData(); // Refresh dashboard
    } else {
      const error = await response.json();
      alert(`Lỗi xóa sân: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting field:', error);
    alert('Lỗi kết nối khi xóa sân.');
  }
}

async function toggleFieldStatus(id, currentStatus){
  const newStatus = currentStatus === 'available' ? 'maintenance' : 'available';
  try {
    const response = await fetch(`${API_BASE_URL}/api/fields/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (response.ok) {
      renderFields(); // Re-render to show the change
      await loadDashboardData(); // Refresh dashboard
    } else {
      alert('Lỗi cập nhật trạng thái sân.');
    }
  } catch (error) {
    console.error('Error toggling field status:', error);
    alert('Lỗi kết nối khi cập nhật trạng thái sân.');
  }
}

// SCHEDULE
async function populateFieldFilters(){
  // Đảm bảo db.fields đã có dữ liệu
  if (!db.fields || db.fields.length === 0) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fields/${TENANT_ID}`);
      db.fields = await response.json();
    } catch (err) {
      console.error('Lỗi tải danh sách sân:', err);
    }
  }

  const opts = myFields().map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
  ['bk-field-filter','bk-field'].forEach(id=>{
    const el=document.getElementById(id);
    if(el&&el.tagName==='SELECT') el.innerHTML=(id==='bk-field-filter'?'<option value="">Tất cả sân</option>':'')+opts;
  });
  
  try {
    const res = await fetch(`${API_BASE_URL}/api/bookings/tenant/${TENANT_ID}`);
    const bks = await res.json();
    db.bookings = bks; 

    // Cập nhật thông tin tenant vào bộ nhớ đệm
    const tenantRes = await fetch(`${API_BASE_URL}/api/tenants/${TENANT_ID}/settings`);
    const t = await tenantRes.json();
    db.tenant = t; 
    syncGlobalUI(t); // Đồng bộ UI ngay khi có dữ liệu mới
    
    const payBk = document.getElementById('pay-booking');
    if(payBk) {
      payBk.innerHTML = '<option value="">-- Chọn đặt sân --</option>' + 
        bks.filter(b => !b.paid && b.status !== 'cancelled')
           .map(b => `<option value="${b.id}" data-price="${b.total_price}">${b.id} - ${b.customer_name} (${fmt(b.total_price)})</option>`).join('');
      
      payBk.onchange = () => {
        const opt = payBk.options[payBk.selectedIndex];
        const price = opt.getAttribute('data-price') || 0;
        document.getElementById('pay-amount').value = price;
        updatePayAmount();
      };
    }

    const invBk = document.getElementById('inv-booking');
    if(invBk) {
      invBk.innerHTML = '<option value="">-- Chọn đặt sân --</option>' + 
        bks.map(b => `<option value="${b.id}">${b.id} - ${b.customer_name} - ${fmtDate(b.date)}</option>`).join('');
    }
  } catch (error) {
    console.error('Error populating filters:', error);
  }
  
  const todayVn = new Date(new Date().getTime() + (7*60*60*1000)).toISOString().slice(0, 10);
  const bkDate=document.getElementById('bk-date'); if(bkDate) bkDate.value = todayVn;
}
async function renderSchedule(){
  const q = document.getElementById('bk-search')?.value || '';
  const field = document.getElementById('bk-field-filter')?.value || '';
  const status = document.getElementById('bk-status-filter')?.value || '';

  try {
    const url = new URL(`${API_BASE_URL}/api/bookings/tenant/${TENANT_ID}`);
    if (q) url.searchParams.append('q', q);
    if (field) url.searchParams.append('field', field);
    if (status) url.searchParams.append('status', status);

    const response = await fetch(url);
    const bookings = await response.json();

    document.getElementById('schedule-table').innerHTML = bookings.map(b => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:12px;color:var(--green)">${b.id}</span></td>
        <td><strong>${b.customer_name}</strong><br><small style="color:var(--text2)">${b.customer_phone}</small></td>
        <td>${b.field_name || 'N/A'}</td>
        <td>${fmtDate(b.date)}</td>
        <td>${b.start_time}–${b.end_time}</td>
        <td><strong style="font-family:var(--mono)">${fmt(b.total_price)}</strong></td>
        <td>${b.paid ? '<span class="badge badge-green">✅ Đã thu</span>' : '<span class="badge badge-red">⏳ Chưa thu</span>'}</td>
        <td>${bkStatusBadge(b.status)}</td>
        <td style="display:flex;gap:4px;flex-wrap:wrap">
          ${b.status === 'pending' ? `<button class="btn btn-sm btn-primary" onclick="updateBookingStatus('${b.id}', 'confirmed')">✓ Xác nhận</button>` : ''}
          ${!b.paid ? `<button class="btn btn-sm btn-warning" onclick="markBookingPaid('${b.id}')">💳 Thu tiền</button>` : ''}
          ${b.status !== 'cancelled' ? `<button class="btn btn-sm btn-danger" onclick="updateBookingStatus('${b.id}', 'cancelled')">✗ Hủy</button>` : ''}
        </td>
      </tr>`).join('') || '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text2)">Không có đặt sân nào</td></tr>';
  } catch (error) {
    console.error('Error rendering schedule:', error);
    document.getElementById('schedule-table').innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--red)">Lỗi tải lịch đặt sân.</td></tr>';
  }
}
async function updateBookingStatus(id, status) {
  if (status === 'cancelled' && !confirm('Bạn có chắc muốn hủy đặt sân này?')) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/bookings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (response.ok) {
      // ✅ Invalidate customer cache để đồng bộ dữ liệu real-time
      try {
        await fetch(`${API_BASE_URL}/api/cache/invalidate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant_id: TENANT_ID, action: 'booking_status_update' })
        });
      } catch (cacheError) {
        console.log('Cache invalidation failed:', cacheError);
        // Vẫn tiếp tục nếu cache invalidation thất bại
      }
      
      // ✅ LocalStorage signaling cho real-time sync
      try {
        const cacheKey = `vinhunifootball_cache_invalidate_${TENANT_ID}`;
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          action: 'booking_status_update',
          booking_id: id,
          status: status
        }));
        
        // Xóa ngay sau khi set để trigger storage event
        localStorage.removeItem(cacheKey);
      } catch (storageError) {
        console.log('LocalStorage signaling failed:', storageError);
      }
      
      renderSchedule();
      await loadDashboardData(); // Refresh dashboard statistics real-time
    } else {
      alert('Lỗi cập nhật trạng thái đặt sân.');
    }
  } catch (error) {
    console.error('Error updating booking status:', error);
    alert('Lỗi kết nối khi cập nhật trạng thái.');
  }
}

async function markBookingPaid(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bookings/${id}/payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid: true, payment_method: 'cash' })
    });
    if (response.ok) {
      // Logic for canteen services would go here if paying directly from schedule
      renderSchedule();
      await loadDashboardData();
    }
  } catch (error) { console.error(error); }
}


async function openServiceModal(id) {
  const modal = document.getElementById('modal-service');
  const title = document.getElementById('service-modal-title');
  const saveBtn = document.getElementById('service-save-btn');
  
  document.getElementById('service-id').value = '';
  document.getElementById('service-name').value = '';
  document.getElementById('service-price').value = '';
  document.getElementById('service-unit').value = 'Chai';
  document.getElementById('service-category').value = 'drink';

  if (id) {
    // Đảm bảo services đã được load
    if (!db.services || !Array.isArray(db.services)) {
      await loadCanteenData();
    }
    const s = (db.services || []).find(x => String(x.id) === String(id));
    if (s) {
      title.textContent = '✏️ Chỉnh sửa dịch vụ';
      saveBtn.textContent = '💾 Lưu thay đổi';
      document.getElementById('service-id').value = s.id;
      document.getElementById('service-name').value = s.name;
      document.getElementById('service-price').value = s.price;
      document.getElementById('service-unit').value = s.unit;
      document.getElementById('service-category').value = s.category;
    }
  } else {
    title.textContent = '🥤 Thêm dịch vụ mới';
    saveBtn.textContent = '✅ Lưu lại';
  }
  modal.classList.add('show');
}

async function saveService() {
  const id = document.getElementById('service-id').value;
  const data = {
    tenant_id: TENANT_ID,
    name: document.getElementById('service-name').value,
    price: parseInt(document.getElementById('service-price').value),
    unit: document.getElementById('service-unit').value,
    category: document.getElementById('service-category').value
  };

  const method = id ? 'PUT' : 'POST';
  const url = id ? `${API_BASE_URL}/api/services/${id}` : `${API_BASE_URL}/api/services`;

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      closeModal('modal-service');
      renderCanteen(true);
    }
  } catch (error) { alert('Lỗi lưu dịch vụ'); }
}

async function deleteService(id) {
  if (!confirm('Xóa dịch vụ này?')) return;
  await fetch(`${API_BASE_URL}/api/services/${id}`, { method: 'DELETE' });
  renderCanteen(true);
}

// PAYMENT UPGRADE
let currentSelectedServices = [];

async function renderPayment() {
  // Fetch bookings chưa thanh toán
  try {
    const res = await fetch(`${API_BASE_URL}/api/bookings/tenant/${TENANT_ID}`);
    const all = await res.json();
    db.bookings = all;
    const unpaid = all.filter(b => !b.paid && b.status !== 'cancelled');
    const sel = document.getElementById('pay-booking');
    sel.innerHTML = '<option value="">-- Chọn lượt đặt sân --</option>' +
      unpaid.map(b => {
        const dateStr = b.date || b.booking_date || '';
        const d = dateStr ? new Date(dateStr).toLocaleDateString('vi-VN') : '?';
        return `<option value="${b.id}" data-price="${b.total_price}">${b.customer_name} · ${b.field_name || 'Sân'} · ${d} ${(b.start_time||'').slice(0,5)}-${(b.end_time||'').slice(0,5)}</option>`;
      }).join('');

    // Ẩn thông tin booking cũ khi làm mới
    document.getElementById('pay-booking-info').style.display = 'none';
  } catch(e) { console.error('Lỗi tải đặt sân:', e); }

  await loadCanteenData();
  const select = document.getElementById('pay-select-service');
  select.innerHTML = '<option value="">-- Chọn món (Nước, thuê giày...) --</option>' +
    (db.services || []).map(s => `<option value="${s.id}">${s.name} (${fmt(s.price)}/${s.unit})</option>`).join('');

  currentSelectedServices = [];
  renderCurrentPaymentServices();
  document.getElementById('pay-amount').value = '';
  updatePayAmount();
}

function onBookingSelect() {
  const sel = document.getElementById('pay-booking');
  const opt = sel.options[sel.selectedIndex];
  const bId = sel.value;

  if (!bId) {
    document.getElementById('pay-booking-info').style.display = 'none';
    document.getElementById('pay-amount').value = '';
    updatePayAmount();
    return;
  }

  const booking = (db.bookings || []).find(b => String(b.id) === String(bId));
  if (booking) {
    // Tự động điền giá tiền sân
    document.getElementById('pay-amount').value = booking.total_price || 0;

    // Hiển thị thông tin đặt sân
    const dateStr = booking.date || booking.booking_date || '';
    const d = dateStr ? new Date(dateStr).toLocaleDateString('vi-VN', {weekday:'short', day:'2-digit', month:'2-digit'}) : '';
    document.getElementById('pay-info-name').textContent = `👤 ${booking.customer_name} — ${booking.field_name || 'Sân'}`;
    document.getElementById('pay-info-detail').textContent = `📅 ${d} · ⏰ ${(booking.start_time||'').slice(0,5)} – ${(booking.end_time||'').slice(0,5)}`;
    document.getElementById('pay-info-price').textContent = fmt(booking.total_price);
    document.getElementById('pay-booking-info').style.display = 'block';
  }

  updatePayAmount();
}

function addServiceToCurrentPayment() {
  const rawId = document.getElementById('pay-select-service').value;
  const qty = parseInt(document.getElementById('pay-service-qty').value) || 1;
  if (!rawId) return;

  // So sánh dạng chuỗi để tránh lỗi type mismatch
  const service = (db.services || []).find(s => String(s.id) === String(rawId));
  if (service) {
    const existing = currentSelectedServices.find(x => String(x.service_id) === String(rawId));
    if (existing) {
      existing.quantity += qty;
    } else {
      currentSelectedServices.push({
        service_id: service.id,
        name: service.name,
        price: service.price,
        quantity: qty
      });
    }
    renderCurrentPaymentServices();
    updatePayAmount();
    if (selectedPayMethod === 'transfer') updateQRImage();
  }
}

function renderCurrentPaymentServices() {
  const container = document.getElementById('pay-services-selected');
  container.innerHTML = currentSelectedServices.map((s, idx) => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg3); padding:8px 12px; border-radius:8px; margin-bottom:4px; font-size:13px;">
      <div><strong>${s.name}</strong> x${s.quantity}</div>
      <div style="display:flex; gap:10px; align-items:center;">
        <span style="font-family:var(--mono);">${fmt(s.price * s.quantity)}</span>
        <span style="cursor:pointer; color:var(--red);" onclick="removeServiceFromPayment(${idx})">✕</span>
      </div>
    </div>
  `).join('');
}

function removeServiceFromPayment(idx) {
  currentSelectedServices.splice(idx, 1);
  renderCurrentPaymentServices();
  updatePayAmount();
  if (selectedPayMethod === 'transfer') updateQRImage();
}

function updatePayAmount() {
  const bId = document.getElementById('pay-booking').value;
  const bookingPrice = parseInt(document.getElementById('pay-amount').value) || 0;
  const servicesPrice = currentSelectedServices.reduce((sum, s) => sum + (s.price * s.quantity), 0);
  const subtotal = bookingPrice + servicesPrice;
  
  let discount = 0;
  let customerType = 'Thành viên';
  
  if (bId) {
    const booking = (db.bookings || []).find(b => b.id === bId);
    if (booking) {
        const customer = (db.customers || []).find(c => c.phone === booking.customer_phone);
        if (customer) {
            if (customer.status === 'vip') {
                discount = Math.round(subtotal * 0.1); // 10% cho VIP
                customerType = '⭐ VIP - Giảm 10%';
            } else if (customer.status === 'regular') {
                discount = Math.round(subtotal * 0.05); // 5% cho Regular
                customerType = '👤 Thường xuyên - Giảm 5%';
            }
        }
    }
  }

  const discountRow = document.getElementById('pay-discount-row');
  if (discount > 0) {
      discountRow.style.display = 'flex';
      document.getElementById('pay-customer-type').textContent = customerType;
      document.getElementById('pay-discount-val').textContent = '-' + fmt(discount);
  } else {
      discountRow.style.display = 'none';
  }

  const total = subtotal - discount;
  document.getElementById('pay-total').textContent = fmt(total);
}

// Lưu phương thức thanh toán được chọn (tránh dùng regex trên .toString())
let selectedPayMethod = 'cash';
function selectPay(el, method) {
  document.querySelectorAll('.pay-method').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  selectedPayMethod = method;
  document.getElementById('pay-qr-section').style.display = method === 'transfer' ? 'block' : 'none';
  document.getElementById('vnpay-note').style.display = method === 'vnpay' ? 'block' : 'none';
  if (method === 'transfer') updateQRImage();
}

function updateQRImage() {
  const bkId = document.getElementById('pay-booking').value || 'OD';
  const bookingPrice = parseInt(document.getElementById('pay-amount').value) || 0;
  const servicesPrice = currentSelectedServices.reduce((sum, s) => sum + (s.price * s.quantity), 0);
  const subtotal = bookingPrice + servicesPrice;

  // Tính discount giống updatePayAmount để QR luôn khớp với tổng hiển thị
  let discount = 0;
  const booking = (db.bookings || []).find(b => String(b.id) === String(bkId));
  if (booking) {
    const customer = (db.customers || []).find(c => c.phone === booking.customer_phone);
    if (customer?.status === 'vip') discount = Math.round(subtotal * 0.1);
    else if (customer?.status === 'regular') discount = Math.round(subtotal * 0.05);
  }
  const finalAmount = subtotal - discount;

  const t = db.tenant || {};
  const bankId = (t.bank_name || 'MB').toUpperCase();
  const accNum = t.bank_account || '3036506868';
  const accName = encodeURIComponent(t.bank_holder || 'TRAN DUC LUONG');
  const memo = encodeURIComponent(`Thanh toan san bong FootField #${bkId}`);
  document.getElementById('pay-qr-image').src =
    `https://img.vietqr.io/image/${bankId}-${accNum}-compact2.png?amount=${finalAmount}&addInfo=${memo}&accountName=${accName}`;
  document.getElementById('pay-qr-display').textContent = fmt(finalAmount);
  const accLabel = document.getElementById('pay-qr-account');
  if (accLabel) accLabel.textContent = `${accNum} - ${t.bank_holder || 'TRAN DUC LUONG'}`;
}



async function confirmPayment() {
  const bId = document.getElementById('pay-booking').value;
  if (!bId) return alert('Vui lòng chọn lượt đặt sân');
  if (!selectedPayMethod) return alert('Vui lòng chọn phương thức thanh toán');

  // Tính tổng có trừ discount
  const bookingPrice = parseInt(document.getElementById('pay-amount').value) || 0;
  const servicesPrice = currentSelectedServices.reduce((sum, s) => sum + (s.price * s.quantity), 0);
  const subtotal = bookingPrice + servicesPrice;

  // Tính discount theo loại khách
  let discount = 0;
  const booking = (db.bookings || []).find(b => String(b.id) === String(bId));
  if (booking) {
    const customer = (db.customers || []).find(c => c.phone === booking.customer_phone);
    if (customer?.status === 'vip') discount = Math.round(subtotal * 0.1);
    else if (customer?.status === 'regular') discount = Math.round(subtotal * 0.05);
  }
  const finalAmount = subtotal - discount;

  if (selectedPayMethod === 'vnpay') {
    try {
      const vnRes = await fetch(`${API_BASE_URL}/api/payment/vnpay/create-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: finalAmount, bookingId: bId, orderInfo: `Thanh toan dat san FootField #${bId}` })
      });
      const vnData = await vnRes.json();
      if (vnData.paymentUrl) { window.location.href = vnData.paymentUrl; return; }
    } catch(e) { return alert('Lỗi tạo giao dịch VNPay'); }
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/bookings/${bId}/payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid: true, payment_method: selectedPayMethod, paid_amount: finalAmount })
    });

    if (res.ok) {
      // Lưu các dịch vụ căng tin đã dùng
      for (const s of currentSelectedServices) {
        await fetch(`${API_BASE_URL}/api/services/booking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            booking_id: bId,
            service_id: s.service_id,
            quantity: s.quantity,
            price_at_time: s.price
          })
        });
      }
      // Cập nhật trạng thái thành Hoàn thành
      await fetch(`${API_BASE_URL}/api/bookings/${bId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      alert('✅ Thanh toán thành công! Tổng: ' + fmt(finalAmount));
      showPage('dashboard');
    } else {
      alert('❌ Lỗi khi xác nhận thanh toán.');
    }
  } catch (err) { alert('Lỗi kết nối khi thanh toán'); }
}
function openBookingModal(){
  populateFieldFilters();
  
  // Set default date to today if empty
  if (!document.getElementById('bk-date').value) {
    document.getElementById('bk-date').value = new Date(new Date().getTime() + (7 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  }
  
  calcBkPrice();
  document.getElementById('modal-booking').classList.add('show');
}
function calcBkPrice(){
  const fieldSelect = document.getElementById('bk-field');
  const fieldId = fieldSelect.value;
  const field = (db.fields || []).find(f => String(f.id) === String(fieldId));
  const pricePerHour = field ? field.price_per_hour : 0;

  const s = document.getElementById('bk-start').value || '';
  const durStr = document.getElementById('bk-duration').value || '1.5';

  if (s && durStr && pricePerHour) {
    const duration = parseFloat(durStr);
    const [sh, sm] = s.split(':').map(Number);
    const totalMins = sh * 60 + sm + duration * 60;
    const eh = Math.floor(totalMins / 60);
    const em = totalMins % 60;
    
    const e = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    document.getElementById('bk-end').value = e;

    const price = duration > 0 ? Math.round(duration * pricePerHour) : 0;
    document.getElementById('bk-price-display').textContent = fmt(price);
  } else {
    document.getElementById('bk-price-display').textContent = '0 ₫';
  }
}

async function addBooking(){
  const name = document.getElementById('bk-cust').value.trim();
  const phone = document.getElementById('bk-phone').value.trim();
  const fieldId = document.getElementById('bk-field').value;
  const date = document.getElementById('bk-date').value;
  const startTime = document.getElementById('bk-start').value;
  const endTime = document.getElementById('bk-end').value;
  const note = document.getElementById('bk-note').value;

  if(!name) return alert('Vui lòng nhập tên khách hàng');
  if(!phone) return alert('Vui lòng nhập số điện thoại');
  if(!fieldId) return alert('Vui lòng chọn sân');
  if(!date) return alert('Vui lòng chọn ngày');

  // ✅ Validation: Không cho phép đặt trong quá khứ
  const now = new Date();
  const vnNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  const todayStr = vnNow.toISOString().slice(0, 10);
  const currentTime = vnNow.getHours() * 60 + vnNow.getMinutes();
  const [sh, sm] = startTime.split(':').map(Number);
  const startTimeNum = sh * 60 + sm;

  if (date < todayStr) return alert('❌ Không thể đặt sân cho ngày trong quá khứ.');
  if (date === todayStr && startTimeNum < currentTime - 5) { // Cho phép trễ 5p
    return alert('❌ Không thể đặt sân cho khung giờ đã qua.');
  }

  const field = db.fields.find(f => f.id === fieldId) || {};
  const [eh, em] = endTime.split(':').map(Number);
  const endTimeNum = eh * 60 + em;
  const duration = (endTimeNum - startTimeNum) / 60;
  
  if (duration <= 0) return alert('❌ Giờ kết thúc phải sau giờ bắt đầu');

  // ✅ Client-side Conflict Check
  try {
    const bkRes = await fetch(`${API_BASE_URL}/api/bookings/tenant/${TENANT_ID}`);
    const existingBookings = await bkRes.json();
    const hasConflict = existingBookings.some(b => {
      if (b.field_id !== fieldId || b.date !== date || !['confirmed', 'pending'].includes(b.status)) return false;
      const [bsh, bsm] = b.start_time.split(':').map(Number);
      const [beh, bem] = b.end_time.split(':').map(Number);
      const bStart = bsh * 60 + bsm;
      const bEnd = beh * 60 + bem;
      // Overlap detection
      return (startTimeNum >= bStart && startTimeNum < bEnd) || 
             (endTimeNum > bStart && endTimeNum <= bEnd) ||
             (startTimeNum <= bStart && endTimeNum >= bEnd);
    });

    if (hasConflict) {
      return alert('❌ Khung giờ này đã có người đặt. Vui lòng chọn giờ khác.');
    }
  } catch (err) { console.log('Conflict check skipped:', err); }

  const totalPrice = Math.round(duration * field.price_per_hour) || 0;

  const bookingData = {
    tenant_id: TENANT_ID,
    field_id: fieldId,
    customer_name: name,
    customer_phone: phone,
    customer_email: '',
    date: date,
    start_time: startTime,
    end_time: endTime,
    duration: duration,
    total_price: totalPrice,
    status: 'confirmed',
    payment_method: 'cash',
    paid: false,
    note: note,
    qr_code: `QR-${Date.now()}`
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData)
    });

    if (response.ok) {
      closeModal('modal-booking');
      // Reset form
      document.getElementById('bk-cust').value = '';
      document.getElementById('bk-phone').value = '';
      document.getElementById('bk-note').value = '';

      await renderSchedule();
      await renderCustomers(); // Refresh customer list
      await loadDashboardData(); // Refresh dashboard stats
      alert('✅ Đặt sân thành công!');
    } else {
      const error = await response.json();
      alert(`Lỗi đặt sân: ${error.message}`);
    }
  } catch (error) {
    console.error('Error adding booking:', error);
    alert('Lỗi kết nối khi đặt sân.');
  }
}

// CUSTOMERS
function updateCustomerStatus(customer) {
  // Handled by backend API
}

async function renderCustomers(){
  const q=(document.getElementById('cust-search')||{}).value?.toLowerCase()||'';
  const sf=(document.getElementById('cust-status-filter')||{}).value||'';
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/tenant/${TENANT_ID}`);
    const customers = await response.json();
    db.customers = customers;
    
    const list = customers.filter(c=>(!q||c.name.toLowerCase().includes(q)||c.phone.includes(q))&&(!sf||c.status===sf));
    
    document.getElementById('c-vip').textContent=customers.filter(c=>c.status==='vip').length;
    document.getElementById('c-reg').textContent=customers.filter(c=>c.status==='regular').length;
    document.getElementById('c-new').textContent=customers.filter(c=>c.status==='new').length;
    
    document.getElementById('customers-table').innerHTML=list.map(c=>`<tr>
      <td><div style="display:flex;align-items:center;gap:10px"><div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#16a34a,#0891b2);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px">${c.name[0]}</div><strong>${c.name}</strong></div></td>
      <td>${c.phone}</td>
      <td>${c.email || ''}</td>
      <td style="font-family:var(--mono)">${c.total_bookings}</td>
      <td style="font-family:var(--mono);color:var(--green);font-weight:700">${fmt(c.total_spent)}</td>
      <td>${fmtDate(c.last_visit)}</td>
      <td>${custBadge(c.status)}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="viewCustomerHistory('${c.id}')">📋 Lịch sử</button>
        <button class="btn btn-sm btn-warning" onclick="editCustomer('${c.id}')">✏️ Sửa</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCustomer('${c.id}')">🗑️ Xóa</button>
      </td>
    </tr>`).join('')||'<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text2)">Không có khách hàng</td></tr>';
  } catch (error) {
    console.error('Error rendering customers:', error);
  }
}
function openAddCustomerModal(){
  // Reset form
  document.getElementById('nc-name').value = '';
  document.getElementById('nc-phone').value = '';
  document.getElementById('nc-email').value = '';
  document.getElementById('modal-add-customer').classList.add('show');
}
async function addCustomer(){
  const name = document.getElementById('nc-name').value.trim();
  const phone = document.getElementById('nc-phone').value.trim();
  const email = document.getElementById('nc-email').value.trim();
  
  // Validation
  if(!name) return alert('❌ Vui lòng nhập tên khách hàng');
  if(!phone) return alert('❌ Vui lòng nhập số điện thoại');
  if(!/^[0-9]{10}$/.test(phone)) return alert('❌ Số điện thoại không hợp lệ (phải có 10 số)');
  if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert('❌ Email không hợp lệ');
  
  const customerData = {
    tenant_id: TENANT_ID,
    name: name,
    phone: phone,
    email: email
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerData)
    });

    if (response.ok) {
      closeModal('modal-add-customer');
      await renderCustomers();
      await loadDashboardData();
      alert(`✅ Thêm khách hàng ${name} thành công!`);
    } else {
      const error = await response.json();
      alert(`❌ Lỗi: ${error.message}`);
    }
  } catch (error) {
    console.error('Error adding customer:', error);
    alert('❌ Lỗi kết nối khi thêm khách hàng.');
  }
}

function viewCustomerHistory(customerId) {
  const customer = myCustomers().find(c => c.id === customerId);
  if (!customer) return;
  
  const customerBookings = myBookings().filter(b => b.customer_phone === customer.phone);
  alert(`Lịch sử đặt sân của ${customer.name}:\n\nTổng số lần: ${customerBookings.length}\nTổng chi tiêu: ${fmt(customer.total_spent)}`);
}

function editCustomer(customerId) {
  const customer = myCustomers().find(c => c.id === customerId);
  if (!customer) return;
  
  document.getElementById('nc-name').value = customer.name;
  document.getElementById('nc-phone').value = customer.phone;
  document.getElementById('nc-email').value = customer.email || '';
  
  document.querySelector('#modal-add-customer .modal-title').textContent = '✏️ Chỉnh sửa khách hàng';
  document.querySelector('#modal-add-customer .modal-footer .btn-primary').textContent = '💾 Lưu thay đổi';
  document.querySelector('#modal-add-customer .modal-footer .btn-primary').onclick = () => updateCustomer(customerId);
  
  document.getElementById('modal-add-customer').classList.add('show');
}

async function updateCustomer(customerId) {
  const name = document.getElementById('nc-name').value.trim();
  const phone = document.getElementById('nc-phone').value.trim();
  const email = document.getElementById('nc-email').value.trim();
  
  if(!name || !phone) return alert('❌ Vui lòng nhập tên và số điện thoại');

  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email })
    });

    if (response.ok) {
      closeModal('modal-add-customer');
      await renderCustomers();
      alert(`✅ Cập nhật khách hàng thành công!`);
    } else {
      const error = await response.json();
      alert(`❌ Lỗi: ${error.message}`);
    }
  } catch (error) {
    console.error('Error updating customer:', error);
    alert('❌ Lỗi kết nối khi cập nhật khách hàng.');
  }
}

async function deleteCustomer(customerId) {
  if (!confirm('Bạn có chắc chắn muốn xóa khách hàng này không?')) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      await renderCustomers();
      await loadDashboardData();
      alert('✅ Đã xóa khách hàng thành công!');
    } else {
      const error = await response.json();
      alert(`❌ Lỗi xóa khách hàng: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting customer:', error);
    alert('❌ Lỗi kết nối khi xóa khách hàng.');
  }
}

function syncCustomerFinancials() {
  const customers = myCustomers();
  customers.forEach(customer => {
    const customerBookings = myBookings().filter(b => 
      b.customer_phone === customer.phone && b.paid
    );
    
    customer.total_bookings = customerBookings.length;
    customer.total_spent = customerBookings.reduce((sum, b) => sum + b.total_price, 0);
    customer.last_visit = customerBookings.length > 0 ? 
      customerBookings.sort((a,b) => b.date.localeCompare(a.date))[0].date : 
      customer.last_visit;
  });
  saveDB();
}

// FINANCE
// Finance data is now fetched from the backend API

async function renderFinance(){
  try {
    const response = await fetch(`${API_BASE_URL}/api/finance/tenant/${TENANT_ID}/report`);
    const data = await response.json();
    const { stats, paymentBreakdown, fieldRevenue, recentTransactions } = data;
    
    // Update stat cards
    document.getElementById('total-revenue').textContent = fmt(stats.totalRevenue);
    document.getElementById('paid-count').textContent = stats.paidCount; // Fixed: was showing revenue
    document.getElementById('unpaid-amount').textContent = fmt(stats.unpaidAmount);
    document.getElementById('unpaid-count').textContent = `${stats.unpaidCount} đặt chưa thanh toán`;
    document.getElementById('growth-percentage').textContent = stats.growthPercentage >= 0 ? 
      `▲ +${stats.growthPercentage.toFixed(1)}% vs ${stats.prevMonthName}` : 
      `▼ ${Math.abs(stats.growthPercentage).toFixed(1)}% vs ${stats.prevMonthName}`;
    document.getElementById('occupancy-rate').textContent = `${stats.occupancyRate.toFixed(1)}%`;
    const occSub = document.getElementById('occupancy-rate').nextElementSibling;
    if (occSub) occSub.textContent = 'Hiệu suất sử dụng tháng này';
    document.getElementById('paid-transactions').textContent = `Số giao dịch thành công`;
    
    // Payment breakdown
    const pmNames={cash:'Tiền mặt',transfer:'Chuyển khoản',vnpay:'VNPay'};
    const maxPm = Math.max(...paymentBreakdown.map(v => v.value), 1);
    document.getElementById('payment-breakdown').innerHTML = paymentBreakdown.map(v => `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>${pmNames[v.id]||v.id}</span><span style="font-family:var(--mono);font-weight:700">${fmt(v.value)}</span></div>
        <div style="background:var(--bg3);border-radius:4px;height:8px"><div style="width:${(v.value/maxPm*100).toFixed(0)}%;height:100%;background:var(--green);border-radius:4px"></div></div>
      </div>`).join('') || '<div style="color:var(--text2);text-align:center;padding:20px">Chưa có giao dịch</div>';

    // Field revenue
    const maxFr = Math.max(...fieldRevenue.map(v => v.value), 1);
    document.getElementById('field-revenue').innerHTML = fieldRevenue.map(v => `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>⚽ ${v.name}</span><span style="font-family:var(--mono);font-weight:700">${fmt(v.value)}</span></div>
        <div style="background:var(--bg3);border-radius:4px;height:8px"><div style="width:${(v.value/maxFr*100).toFixed(0)}%;height:100%;background:var(--accent3);border-radius:4px"></div></div>
      </div>`).join('') || '<div style="color:var(--text2);text-align:center;padding:20px">Chưa có dữ liệu tháng này</div>';

    // Transaction table
    document.getElementById('finance-table').innerHTML = recentTransactions.map(b => `<tr>
        <td><span style="font-family:var(--mono);font-size:12px;color:var(--green)">${b.id}</span></td>
        <td><strong>${b.customer_name}</strong></td>
        <td>${b.field_name}</td>
        <td>${fmtDate(b.date)}</td>
        <td style="font-family:var(--mono);font-weight:700">${fmt(b.total_price)}</td>
        <td>${pmBadge(b.payment_method)}</td>
        <td>${b.paid?'<span class="badge badge-green">✅ Đã thu</span>':'<span class="badge badge-red">⏳ Chưa thu</span>'}</td>
      </tr>`).join('');
  } catch (error) {
    console.error('Error rendering finance:', error);
  }
}



async function renderCheckin(){
  const today = new Date(new Date().getTime() + (7 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  try {
    const res = await fetch(`${API_BASE_URL}/api/bookings/tenant/${TENANT_ID}?date=${today}`);
    const bks = await res.json();
    document.getElementById('checkin-history').innerHTML = bks.map(b => `<tr>
        <td><span style="font-family:var(--mono);color:var(--green)">${b.qr_code}</span></td>
        <td><strong>${b.customer_name}</strong></td>
        <td>${b.field_name}</td>
        <td>${b.start_time.substring(0,5)}–${b.end_time.substring(0,5)}</td>
        <td>${b.status==='completed'?'✅':'—'}</td>
        <td>${b.status==='completed'?'<span class="badge badge-green">✅ Đã check-in</span>':'<span class="badge badge-yellow">⏳ Chờ sân</span>'}</td>
      </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">Không có lịch hôm nay</td></tr>';
  } catch (error) { console.error('Error rendering checkin:', error); }
}

async function doCheckin(){
  const code = (document.getElementById('qr-input').value || '').trim().toUpperCase();
  const resBox = document.getElementById('checkin-result');
  if(!code) return alert('Nhập mã QR');

  try {
    // 1. Tra cứu mã QR trên toàn bộ hệ thống (Toàn bộ MySQL)
    const searchRes = await fetch(`${API_BASE_URL}/api/bookings/qr/${code}`);
    if (!searchRes.ok) {
      if (searchRes.status === 404) return alert('❌ Không tìm thấy mã đặt sân này trong hệ thống!');
      else return alert('❌ Lỗi kết nối máy chủ!');
    }
    const bk = await searchRes.json();
    
    // 2. Kiểm tra logic ngày tháng và trạng thái (Chuẩn hóa múi giờ Việt Nam UTC+7)
    const vnNow = new Date(new Date().getTime() + (7 * 60 * 60 * 1000));
    const todayStr = vnNow.toISOString().slice(0, 10);
    
    // Giải quyết vấn đề lệch múi giờ khi nhận date từ MySQL (thường ở dạng UTC)
    const bookingDateRaw = new Date(bk.date);
    const vnBookingDate = new Date(bookingDateRaw.getTime() + (7 * 60 * 60 * 1000));
    const bkDateStr = vnBookingDate.toISOString().slice(0, 10);
    
    // Nếu mã của ngày trong quá khứ
    if (bkDateStr < todayStr) {
      return alert(`❌ Lượt đặt sân này đã hết hạn từ ngày ${fmtDate(bk.date)}!`);
    }

    // Nếu mã của ngày trong tương lai (Đã có logic cảnh báo ở bước trước, nhưng có thể cho phép check-in sớm tùy chính sách)
    // Ở đây ta giữ nguyên logic cũ là báo mã dành cho ngày khác nếu không phải hôm nay
    if (bkDateStr > todayStr) {
      return alert(`⚠️ Mã này dành cho ngày ${fmtDate(bk.date)}. Hiện tại chưa đến ngày sử dụng!`);
    }

    // Nếu là ngày hôm nay, kiểm tra giờ kết thúc
    if (bkDateStr === todayStr) {
      const currentTimeStr = vnNow.toISOString().slice(11, 19); // HH:mm:ss
      if (bk.end_time < currentTimeStr) {
        return alert(`❌ Lượt đặt sân này đã hết hạn (Đã kết thúc lúc ${bk.end_time.substring(0,5)} hôm nay)!`);
      }
    }

    // Nếu mã đã check-in rồi
    if (bk.status === 'completed') {
      resBox.innerHTML=`<div class="card-header"><div class="card-title" style="color:var(--green)">✅ Thông tin Check-in</div></div>
        <div style="text-align:center;padding:20px;">
          <div style="font-size:60px;margin-bottom:10px;">✅</div>
          <div style="font-size:18px;font-weight:800;margin-bottom:5px;">${bk.customer_name}</div>
          <div class="badge badge-green">Mã này ĐÃ CHECK-IN</div>
        </div>
        <div style="padding:15px;background:var(--bg3);border-radius:12px;display:grid;grid-template-columns:1fr 1fr;gap:15px;font-size:13px;">
          <div><div style="color:var(--text2)">Sân</div><strong>${bk.field_name}</strong></div>
          <div><div style="color:var(--text2)">Giờ đặt</div><strong>${bk.start_time.substring(0,5)} – ${bk.end_time.substring(0,5)}</strong></div>
          <div><div style="color:var(--text2)">Thanh toán</div><strong style="color:var(--green)">Đã thu: ${fmt(bk.total_price)}</strong></div>
          <div><div style="color:var(--text2)">Trạng thái</div><strong style="color:var(--green)">ĐÃ HOÀN TẤT</strong></div>
        </div>`;
      document.getElementById('qr-input').value = '';
      document.getElementById('qr-input').focus();
      return;
    }

    // Nếu mã bị hủy
    if (bk.status === 'cancelled') {
        return alert('❌ Đơn đặt sân này đã bị hủy trên hệ thống!');
    }

    // 💡 Cảnh báo nếu chưa thanh toán nhưng vẫn cho check-in (tùy chính sách)
    if (!bk.paid) {
        if (!confirm(`⚠️ Khách hàng ${bk.customer_name} CHƯA THANH TOÁN (${fmt(bk.total_price)}). Bạn vẫn muốn cho Check-in chứ?`)) {
            return;
        }
    }

    // 3. Thực hiện check-in (Cập nhật 'arrived' - Đã đến sân)
    const updateRes = await fetch(`${API_BASE_URL}/api/bookings/${bk.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'arrived' })
    });

    if (updateRes.ok) {
      resBox.innerHTML=`<div class="card-header"><div class="card-title" style="color:var(--green)">✨ Check-in THÀNH CÔNG!</div></div>
        <div class="qr-box" style="padding:30px;background:linear-gradient(135deg,rgba(22,163,74,0.1),transparent)">
          <span class="qr-code" style="font-size:80px;animation:bounceIn 0.5s ease;">🎉</span>
          <div class="qr-info" style="font-size:24px;font-weight:800;margin:15px 0;">${bk.customer_name}</div>
          <div style="font-size:16px;color:var(--green);font-weight:600;">⚽ ${bk.field_name}</div>
          <div style="font-size:20px;font-weight:700;margin-top:10px;font-family:var(--mono)">${bk.start_time.substring(0,5)} – ${bk.end_time.substring(0,5)}</div>
        </div>
        <div style="padding:15px;border-top:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
          <div><div style="color:var(--text2);margin-bottom:4px">Mã tra cứu</div><strong style="font-family:var(--mono)">${bk.qr_code}</strong></div>
          <div><div style="color:var(--text2);margin-bottom:4px">Thanh toán</div><strong style="color:${bk.paid?'var(--green)':'var(--red)'}">${bk.paid?'✅ Đã thu đủ':'⏳ Chờ thu tiền'}</strong></div>
        </div>`;
      
      await renderCheckin();
      await renderSchedule(); // Đồng bộ bảng lịch sân
      document.getElementById('qr-input').value = '';
      document.getElementById('qr-input').focus(); // Sẵn sàng quét mã tiếp theo
      
      // Hiệu ứng thành công âm thanh (tùy chọn)
      console.log('Check-in success for:', bk.qr_code);
    } else {
      alert('❌ Lỗi xử lý check-in trên máy chủ.');
    }
  } catch (error) {
    console.error('Check-in error:', error);
    alert('❌ Lỗi kết nối khi quét mã QR.');
  }
}
async function startClock() {
  setInterval(() => {
    const el = document.getElementById('checkin-clock');
    if (el) {
      const vnTime = new Date(new Date().getTime() + (7 * 60 * 60 * 1000));
      el.textContent = vnTime.toISOString().slice(11, 19);
    }
  }, 1000);
}

// INVOICE
async function renderInvoicePage(){ await populateFieldFilters(); }
function renderInvoicePreview(){
  const id=document.getElementById('inv-booking').value;
  if(!id)return;
  const bks = db.bookings || [];
  const bk=bks.find(b=>b.id===id);
  if(!bk) return document.getElementById('invoice-preview').innerHTML = '<div style="text-align:center;padding:40px;color:var(--red)">Không tìm thấy dữ liệu hóa đơn.</div>';

  document.getElementById('invoice-preview').innerHTML=`
    <div class="invoice-print" style="padding:40px; background:#fff; color:#000; border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,0.05);">
      <div class="inv-header" style="display:flex; justify-content:space-between; align-items:start; border-bottom:2px solid #eee; padding-bottom:20px; margin-bottom:20px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="font-size:40px;">⚽</div>
          <div>
            <div style="font-size:22px; font-weight:800; color:#16a34a; letter-spacing:-0.5px;">${db.tenant?.name || 'VinhUniFootBall'}</div>
            <div style="font-size:12px; color:#666;">${db.tenant?.address || 'Số 15, Đường Trần Phú, TP. Vinh, Nghệ An'}</div>
            <div style="font-size:12px; color:#666;">Hotline: ${db.tenant?.phone || '0912.345.678'}</div>
          </div>
        </div>
        <div class="inv-header-right" style="text-align:right;">
          <div style="font-size:14px; font-weight:700; color:#999; margin-bottom:4px;">PHIẾU THANH TOÁN</div>
          <div style="font-size:18px; font-weight:800; font-family:var(--mono); color:#16a34a;">${bk.id}</div>
          <div style="font-size:11px; color:#666; margin-top:4px;">Ngày lập: ${new Date().toLocaleDateString('vi-VN')}</div>
        </div>
      </div>

      <div class="inv-details" style="display:grid; grid-template-columns:1fr 1fr; gap:30px; margin-bottom:30px;">
        <div>
          <div style="font-size:11px; font-weight:700; color:#999; text-transform:uppercase; margin-bottom:8px;">Khách hàng</div>
          <div style="font-size:15px; font-weight:700;">${bk.customer_name}</div>
          <div style="font-size:13px; color:#444;">SĐT: ${bk.customer_phone}</div>
        </div>
        <div class="inv-details-right" style="text-align:right;">
          <div style="font-size:11px; font-weight:700; color:#999; text-transform:uppercase; margin-bottom:8px;">Chi tiết thuê sân</div>
          <div style="font-size:14px; font-weight:700;">${bk.field_name}</div>
          <div style="font-size:13px; color:#444;">Ngày đá: ${fmtDate(bk.date)}</div>
          <div style="font-size:13px; color:#444;">Giờ: ${bk.start_time.substring(0,5)} – ${bk.end_time.substring(0,5)} (${bk.duration}h)</div>
        </div>
      </div>

      <div class="inv-table-wrap">
        <table style="width:100%; border-collapse:collapse; margin-bottom:10px;">
          <thead>
            <tr style="background:#f8fdf9; border-bottom:2px solid #16a34a;">
              <th style="padding:12px 8px; text-align:left; font-size:12px; color:#16a34a;">Dịch vụ</th>
              <th style="padding:12px 8px; text-align:right; font-size:12px; color:#16a34a;">Đơn giá</th>
              <th style="padding:12px 8px; text-align:right; font-size:12px; color:#16a34a;">Thời lượng</th>
              <th style="padding:12px 8px; text-align:right; font-size:12px; color:#16a34a;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:15px 8px; font-size:14px; font-weight:600;">Thuê sân bóng ${bk.field_name}</td>
              <td style="padding:15px 8px; text-align:right; font-family:var(--mono); font-size:14px;">${fmt(bk.total_price/bk.duration)}</td>
              <td style="padding:15px 8px; text-align:right; font-size:14px;">${bk.duration} h</td>
              <td style="padding:15px 8px; text-align:right; font-family:var(--mono); font-size:15px; font-weight:700;">${fmt(bk.total_price)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="inv-footer" style="display:flex; justify-content:space-between; align-items:end;">
        <div>
          <div style="font-size:12px; color:#666; margin-bottom:4px;">Phương thức thanh toán:</div>
          <div style="font-size:14px; font-weight:700; color:#444;">${pmBadge(bk.payment_method)}</div>
          <div style="margin-top:6px;">${bk.paid?'<span style="color:#16a34a; font-weight:700; font-size:12px; padding:4px 8px; background:#e8f5e9; border-radius:4px;">✅ ĐÃ THANH TOÁN</span>':'<span style="color:#dc2626; font-weight:700; font-size:12px; padding:4px 8px; background:#fef2f2; border-radius:4px;">⏳ CHƯA THU TIỀN</span>'}</div>
        </div>
        <div class="inv-footer-right" style="text-align:right;">
          <div style="font-size:13px; color:#666; margin-bottom:5px;">TỔNG CỘNG</div>
          <div style="font-size:32px; font-weight:900; color:#16a34a; font-family:var(--mono);">${fmt(bk.total_price)}</div>
        </div>
      </div>

      <div style="margin-top:50px; text-align:center; border-top:1px dashed #ddd; padding-top:20px;">
        <div style="font-size:14px; font-weight:700; color:#444; margin-bottom:5px;">Cảm ơn quý khách đã tin chọn VinhUniFootBall! ⚽</div>
        <div style="font-size:11px; color:#999;">Mọi thắc mắc vui lòng liên hệ Ban quản lý sân để được hỗ trợ.</div>
      </div>
    </div>`;
}
function printInvoice(){
  const id=document.getElementById('inv-booking').value;
  if(!id){alert('Chọn đặt sân cần in');return;}
  
  const content = document.getElementById('invoice-preview').innerHTML;
  
  if (window.cordova && window.cordova.plugins && window.cordova.plugins.printer) {
    window.cordova.plugins.printer.check(function (available) {
      if (available) {
        window.cordova.plugins.printer.print(content, { name: 'HoaDon_FootField_' + id });
      } else {
        alert('❌ Không tìm thấy máy in khả dụng hoặc dịch vụ in bị tắt.');
      }
    });
  } else {
    // Fallback for web browser
    window.print();
  }
}

// NOTIFICATIONS
async function renderNotifications(){
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/tenant/${TENANT_ID}`);
    const data = await response.json();
    
    const icons={system:'🔧',promo:'🎁',feature:'✨'};
    document.getElementById('notifs-container').innerHTML = data.map(n => `
    <div class="notif-banner ${n.is_read ? '' : 'unread'}">
      <div class="notif-icon">${icons[n.type]||'📢'}</div>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:14px;font-weight:700">${n.title}</div>
          ${!n.is_read ? '<span class="badge badge-red" style="font-size:9px;padding:2px 6px;">MỚI</span>' : ''}
        </div>
        <div style="font-size:13px;color:var(--text2);margin-top:4px">${n.message}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:6px">📅 ${fmtDate(n.created_at)}</div>
      </div>
    </div>`).join('')||'<div style="text-align:center;padding:40px;color:var(--text2)">Chưa có thông báo</div>';
  } catch (error) {
    console.error('Error rendering notifications:', error);
  }
}

async function renderSettings(){
  try {
    const res = await fetch(`${API_BASE_URL}/api/tenants/${TENANT_ID}/settings`);
    const t = await res.json();
    db.tenant = t; 

    document.getElementById('set-name').value = t.name || '';
    document.getElementById('set-owner').value = t.owner || '';
    document.getElementById('set-phone').value = t.phone || '';
    document.getElementById('set-email').value = t.email || '';
    document.getElementById('set-address').value = t.address || '';
    
    document.getElementById('set-open').value = (t.open_time || '06:00:00').substring(0,5);
    document.getElementById('set-close').value = (t.close_time || '22:00:00').substring(0,5);
    
    document.getElementById('set-bank-name').value = t.bank_name || '';
    document.getElementById('set-bank-acc').value = t.bank_account || '';
    document.getElementById('set-bank-holder').value = t.bank_holder || '';
    
    // Appearance
    const bannerInput = document.getElementById('set-hero-banner');
    if (bannerInput) bannerInput.value = t.hero_banner || '';
    
  } catch (error) {
    console.error('Error rendering settings:', error);
  }
}

async function saveSettings(section){
  if(section==='info') return; 
  let data = {};
  if(section==='hours'){
    data = {
      open_time: document.getElementById('set-open').value,
      close_time: document.getElementById('set-close').value
    };
  } else if(section==='bank'){
    data = {
      bank_name: document.getElementById('set-bank-name').value,
      bank_account: document.getElementById('set-bank-acc').value,
      bank_holder: document.getElementById('set-bank-holder').value
    };
  } else if(section==='appearance'){
    data = {
      hero_banner: document.getElementById('set-hero-banner').value
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/tenants/${TENANT_ID}/settings`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });
    if (res.ok) {
      alert(`✅ Đã cập nhật cài đặt thành công!`);
      await renderSettings();
      await loadDashboardData(); // Cập nhật lại số liệu thống kê & Badges ở Sidebar
    } else {
      alert('❌ Lỗi khi cập nhật cài đặt.');
    }
  } catch (error) {
    console.error('Save settings error:', error);
    alert('❌ Lỗi kết nối máy chủ.');
  }
}

function syncGlobalUI(t){
  if(!t)return;
  document.querySelectorAll('#side-facility-name').forEach(el=>el.textContent=t.name||'VinhUniFootBall');
  document.querySelectorAll('.tenant-nm').forEach(el=>el.textContent=t.owner||'Chủ cơ sở');
  document.querySelectorAll('.tenant-ava').forEach(el=>el.textContent=(t.name||'V').substring(0,1).toUpperCase());
  
  // Update logo
  const logoEl = document.getElementById('side-logo');
  if (logoEl) {
    if (t.logo) {
      if (t.logo.startsWith('http') || t.logo.startsWith('/') || t.logo.startsWith('data:')) {
        // Logo is an image URL
        logoEl.innerHTML = `<img src="${t.logo}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" onerror="this.outerHTML='⚽'">`;
      } else {
        // Logo is emoji or text
        logoEl.textContent = t.logo;
      }
    } else {
      // Fallback to first letter of name
      logoEl.textContent = (t.name || 'V').substring(0,1).toUpperCase();
    }
  }
}

function updateSidebarBadges(stats) {
  if (!stats) return;
  
  const pendingEl = document.getElementById('nb-pending');
  if (pendingEl) {
    pendingEl.textContent = stats.pendingBookings;
    pendingEl.style.display = stats.pendingBookings > 0 ? 'inline-block' : 'none';
  }
  
  const notifsEl = document.getElementById('nb-notifs');
  if (notifsEl) {
    notifsEl.textContent = stats.unreadNotifications;
    notifsEl.style.display = stats.unreadNotifications > 0 ? 'inline-block' : 'none';
  }
}

async function markAllNotifsRead() {
  try {
    await fetch(`${API_BASE_URL}/api/notifications/tenant/${TENANT_ID}/read-all`, {
      method: 'POST'
    });
    // Update local badge immediately
    const notifsEl = document.getElementById('nb-notifs');
    if (notifsEl) notifsEl.style.display = 'none';
  } catch (err) {
    console.error('Error marking notifications as read:', err);
  }
}

// MODAL
function closeModal(id){document.getElementById(id).classList.remove('show');}
document.querySelectorAll('.modal-overlay').forEach(m=>{m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show');});});

// QR SCANNER
let stream = null;
let scanInterval = null;

async function startQRScanner() {
  try {
    const video = document.getElementById('qr-video');
    const placeholder = document.getElementById('qr-placeholder');
    const scanner = document.getElementById('qr-scanner');
    const startBtn = document.getElementById('start-camera');
    const stopBtn = document.getElementById('stop-camera');
    
    // Request camera access
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    });
    
    video.srcObject = stream;
    video.style.display = 'block';
    placeholder.style.display = 'none';
    scanner.style.display = 'block';
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-flex';
    
    // Start scanning
    video.play();
    scanInterval = setInterval(captureAndScan, 500);
    
  } catch (error) {
    console.error('Camera access error:', error);
    alert(`❌ Lỗi Camera (${error.name}): ${error.message}\n\nVui lòng đảm bảo bạn đã cấp quyền camera cho ứng dụng trong Cài đặt điện thoại.`);
  }
}

function stopQRScanner() {
  try {
    const video = document.getElementById('qr-video');
    const placeholder = document.getElementById('qr-placeholder');
    const scanner = document.getElementById('qr-scanner');
    const startBtn = document.getElementById('start-camera');
    const stopBtn = document.getElementById('stop-camera');
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    
    video.style.display = 'none';
    placeholder.style.display = 'flex';
    scanner.style.display = 'none';
    startBtn.style.display = 'inline-flex';
    stopBtn.style.display = 'none';
    
  } catch (error) {
    console.error('Error stopping camera:', error);
  }
}

function captureAndScan() {
  const video = document.getElementById('qr-video');
  const canvas = document.getElementById('qr-canvas');
  
  if (!video || video.readyState !== 4) return;
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "dontInvert",
  });
  
  if (code) {
    console.log('QR Code detected:', code.data);
    document.getElementById('qr-input').value = code.data;
    doCheckin();
    stopQRScanner();
  }
}

function simulateQRDetection() {
  // This is a simulation for demo purposes
  // In production, integrate with a real QR library like jsQR
  const sampleCodes = ['QR-BK001', 'QR-BK002', 'QR-BK003'];
  const randomCode = sampleCodes[Math.floor(Math.random() * sampleCodes.length)];
  
  // Simulate successful scan after some time
  if (Math.random() > 0.95) { // 5% chance per scan
    document.getElementById('qr-input').value = randomCode;
    doCheckin();
    stopQRScanner();
  }
}

// SUPPORT
function renderSupport() {
  if (!db.tickets) return;
  document.getElementById('tickets-table').innerHTML = db.tickets.map(t => `
    <tr>
      <td><span style="font-family:var(--mono);color:var(--green)">${t.id}</span></td>
      <td><strong>${t.subject}</strong></td>
      <td>${t.type==='bug'?'🐛 Lỗi':'💡 Đề xuất'}</td>
      <td>${tkPrioBadge(t.priority)}</td>
      <td>${fmtDate(t.created_at)}</td>
      <td>${tkStatusBadge(t.status)}</td>
    </tr>
  `).join('') || '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text3)">Chưa có yêu cầu hỗ trợ nào</td></tr>';
}

function openAddTicketModal() {
  document.getElementById('modal-add-ticket').classList.add('show');
}

async function submitTicket() {
  const subject = document.getElementById('tk-subject').value.trim();
  const message = document.getElementById('tk-message').value.trim();
  const type = document.getElementById('tk-type').value;
  const priority = document.getElementById('tk-prio').value;

  if (!subject || !message) return alert('Vui lòng nhập đầy đủ tiêu đề và nội dung');

  try {
    const response = await fetch(`${API_BASE_URL}/api/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        subject, message, type, priority
      })
    });
    const result = await response.json();
    if (result.success) {
      closeModal('modal-add-ticket');
      // Reset form
      document.getElementById('tk-subject').value = '';
      document.getElementById('tk-message').value = '';
      
      // Refresh tickets
      const tkRes = await fetch(`${API_BASE_URL}/api/tickets/tenant/${TENANT_ID}`);
      db.tickets = await tkRes.json();
      renderSupport();
      alert('🚀 Đã gửi yêu cầu thành công! Quản trị viên sẽ sớm phản hồi.');
    } else {
      alert('Lỗi: ' + result.message);
    }
  } catch (error) {
    console.error('Error submitting ticket:', error);
    alert('Lỗi kết nối đến server');
  }
}


// STAFF LOGIC
async function renderStaff() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/staff/tenant/${TENANT_ID}`);
    const staff = await response.json();
    db.staff = staff;

    document.getElementById('staff-table').innerHTML = staff.map(s => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:12px;color:var(--green)">${s.id}</span></td>
        <td><strong>${s.name}</strong></td>
        <td>${s.phone || 'N/A'}</td>
        <td><span class="badge badge-green">${s.status}</span></td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="openStaffModal('${s.id}')">✏️ Sửa</button>
          <button class="btn btn-sm btn-danger" onclick="deleteStaff('${s.id}')">🗑️ Xóa</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text2)">Chưa có nhân viên nào</td></tr>';
  } catch (error) {
    console.error('Error rendering staff:', error);
    document.getElementById('staff-table').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--red)">Lỗi tải danh sách nhân viên.</td></tr>';
  }
}

function openStaffModal(id) {
  const modal = document.getElementById('modal-staff');
  const title = document.getElementById('staff-modal-title');
  const saveBtn = document.getElementById('staff-save-btn');
  
  document.getElementById('staff-id').value = '';
  document.getElementById('staff-name').value = '';
  document.getElementById('staff-phone').value = '';

  if (id) {
    const s = db.staff.find(x => x.id === id);
    if (s) {
      title.textContent = '✏️ Chỉnh sửa nhân viên';
      saveBtn.textContent = '💾 Lưu thay đổi';
      document.getElementById('staff-id').value = s.id;
      document.getElementById('staff-name').value = s.name;
      document.getElementById('staff-phone').value = s.phone;
    }
  } else {
    title.textContent = '👔 Thêm nhân viên mới';
    saveBtn.textContent = '✅ Thêm nhân viên';
  }
  modal.classList.add('show');
}

async function saveStaff() {
  const id = document.getElementById('staff-id').value;
  const isUpdating = !!id;
  const staffData = {
    tenant_id: TENANT_ID,
    name: document.getElementById('staff-name').value.trim(),
    phone: document.getElementById('staff-phone').value.trim(),
    status: 'active'
  };

  if (!staffData.name) return alert('Vui lòng nhập tên nhân viên');

  const url = isUpdating ? `${API_BASE_URL}/api/staff/${id}` : `${API_BASE_URL}/api/staff`;
  const method = isUpdating ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(staffData)
    });

    if (response.ok) {
      closeModal('modal-staff');
      renderStaff();
    } else {
      const error = await response.json();
      alert(`Lỗi lưu nhân viên: ${error.message}`);
    }
  } catch (error) {
    console.error('Error saving staff:', error);
    alert('Lỗi kết nối khi lưu nhân viên.');
  }
}

async function deleteStaff(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/staff/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      renderStaff();
    } else {
      const error = await response.json();
      alert(`Lỗi xóa nhân viên: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting staff:', error);
    alert('Lỗi kết nối khi xóa nhân viên.');
  }
}

// BOOT
const savedUser = localStorage.getItem('ff_tenant_user');
const lastActive = localStorage.getItem('ff_tenant_last_active');

if (savedUser) {
  try {
    const user = JSON.parse(savedUser);
    const now = Date.now();
    
    // Kiểm tra thời gian không hoạt động (5 phút)
    if (lastActive && (now - parseInt(lastActive) > INACTIVITY_LIMIT)) {
      alert('⚠️ Phiên làm việc đã hết hạn do bạn không hoạt động quá 5 phút. Vui lòng đăng nhập lại.');
      doLogout();
    } else if(user && (user.id || user.tenant_id)) {
      TENANT_ID = user.id || user.tenant_id;
      document.getElementById('login-page').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      updateLastActive(); // Cập nhật lại thời gian khi load trang thành công
      initApp();
      startClock();
      if (window.Capacitor) {
        initNotifications();
      }
    }
  } catch(e) {
    console.error('Session error', e);
  }
} else {
  // User chưa đăng nhập - ẩn loading overlay để hiển thị trang đăng nhập
  const loadingOverlay = document.getElementById('page-loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.classList.add('hidden');
  }
}

// CAPACITOR & WEB NOTIFICATIONS
async function initNotifications() {
  if (window.Capacitor) {
    const { PushNotifications } = Capacitor.Plugins;
    const { LocalNotifications } = Capacitor.Plugins;

    // Request permission
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    await PushNotifications.register();
    PushNotifications.addListener('registration', async (token) => {
      updateFCMToken('tenant', TENANT_ID, token.value);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      showWebNotification(notification.title, notification.body);
    });
  } else if ('Notification' in window) {
    // WEB BROWSER LOGIC
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      try {
        // Initialize Firebase for Web (User needs to fill config)
        const firebaseConfig = {
          apiKey: "AIzaSyDzfWF3Bt_JRSz1a_PIieo8troLfkglzDE",
          projectId: "footfield-db573",
          messagingSenderId: "843846666103",
          appId: "1:843846666103:web:9446c24d839f2b1be78372"
        };
        
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        const messaging = firebase.messaging();
        
        const currentToken = await messaging.getToken({ vapidKey: 'BKhBnMN02jYjxDRIPwmqiI9Z2nXOYSB34DQZMp_cf-9bA24hx1quLGzn8B8gRiJi-BZ0J2IDjCNt8LTzUcoGcbU' });
        if (currentToken) {
          updateFCMToken('tenant', TENANT_ID, currentToken);
        }

        messaging.onMessage((payload) => {
          showWebNotification(payload.notification.title, payload.notification.body);
        });
      } catch (err) { console.warn('Web Push initialization failed:', err); }
    }
  }
}

async function updateFCMToken(type, id, token) {
  try {
    await fetch(`${API_BASE_URL}/api/notifications/fcm-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, token })
    });
  } catch (err) { console.error('Error updating FCM token:', err); }
}

function showWebNotification(title, body) {
  // Show visual toast
  const toast = document.createElement('div');
  toast.style = `position:fixed; top:20px; right:20px; background:var(--accent); color:white; padding:15px 25px; 
    border-radius:10px; box-shadow:var(--shadow-lg); z-index:9999; animation: slideIn 0.3s ease;`;
  toast.innerHTML = `<strong>${title}</strong><br>${body}`;
  document.body.appendChild(toast);
  
  // Play sound
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
  audio.play().catch(e => console.log('Audio autoplay blocked'));

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}


function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('show');
  if (overlay) overlay.classList.toggle('show');
}