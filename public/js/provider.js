if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then(reg => console.log('PWA Service Worker registered.', reg))
      .catch(err => console.error('PWA Service Worker registration failed:', err));
  });
}

// ===== APP LOGIC =====
let db = {};
let tenantIdToDelete = null;
const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 phút

function updateLastActive() {
  localStorage.setItem('ff_provider_last_active', Date.now().toString());
}

// Lắng nghe các sự kiện để cập nhật thời gian hoạt động cuối cùng
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(name => {
  document.addEventListener(name, updateLastActive, true);
});

function initDB() {
  console.log('Provider-Admin App Initialized. Working in Online API Mode.');
}

// ===== AUTH =====

async function doLogin() {
  const u = document.getElementById('login-user').value;
  const p = document.getElementById('login-pass').value;
  const errorEl = document.getElementById('login-error');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p, type: 'provider' })
    });

    const data = await response.json();

    if (data.success) {
      document.getElementById('login-page').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      // Store user info if needed
      localStorage.setItem('ff_user', JSON.stringify(data.user));
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
document.addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });
function doLogout() {
  localStorage.removeItem('ff_user');
  localStorage.removeItem('ff_provider_last_active');
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
}

// ===== NAVIGATION =====
const pageTitles = {
  dashboard:'Dashboard', tenants:'Nhà thuê dịch vụ', packages:'Gói dịch vụ',
  billing:'Hóa đơn thanh toán', tickets:'Phiếu hỗ trợ', notifications:'Thông báo hệ thống'
};
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.textContent.trim().includes(pageTitles[name])) n.classList.add('active');
  });
  document.getElementById('topbar-title').textContent = pageTitles[name];
  if (name==='tenants') renderTenants();
  if (name==='packages') renderPackages();
  if (name==='billing') renderBilling();
  if (name==='tickets') renderTickets();
  if (name==='notifications') renderNotifications();

  // Close sidebar after selection (on mobile/tablets)
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar && sidebar.classList.contains('show')) sidebar.classList.remove('show');
  if (overlay && overlay.classList.contains('show')) overlay.classList.remove('show');
}

// ===== INIT APP =====
async function initApp() {
  const loadingOverlay = document.getElementById('page-loading-overlay');
  
  const now = new Date();
  document.getElementById('current-date').textContent = now.toLocaleDateString('vi-VN', {weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});
  
  try {
    const [statsRes, tenantsRes, packagesRes, invoicesRes, invoiceStatsRes, ticketsRes, notificationsRes, monthlyRevenueRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/tenants/stats`),
      fetch(`${API_BASE_URL}/api/tenants`),
      fetch(`${API_BASE_URL}/api/packages`),
      fetch(`${API_BASE_URL}/api/invoices`),
      fetch(`${API_BASE_URL}/api/invoices/stats`),
      fetch(`${API_BASE_URL}/api/tickets`),
      fetch(`${API_BASE_URL}/api/notifications`),
      fetch(`${API_BASE_URL}/api/invoices/monthly-revenue`)
    ]);

    const stats = await statsRes.json();
    const tenants = await tenantsRes.json();
    const packages = await packagesRes.json();
    const invoices = await invoicesRes.json();
    const invoiceStats = await invoiceStatsRes.json();
    const tickets = await ticketsRes.json();
    const notifications = await notificationsRes.json();
    const monthlyRevenue = await monthlyRevenueRes.json();

    db.tenants = tenants;
    db.packages = packages;
    db.stats = stats;
    db.invoices = invoices;
    db.invoiceStats = invoiceStats;
    db.tickets = tickets;
    db.notifications = notifications;
    db.monthlyRevenue = monthlyRevenue;

    populatePackageSelects();
    renderDashboard();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  } finally {
    // Ẩn loading overlay sau khi dữ liệu đã tải xong (hoặc có lỗi)
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
  }
}

function populatePackageSelects() {
  const selects = ['nt-pkg', 'edit-nt-pkg'];
  if (!db.packages) return;
  
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = db.packages.map(p => 
        `<option value="${p.id}">${p.name} - ${fmt(p.price_monthly)}/tháng</option>`
      ).join('');
    }
  });
}

// ===== HELPERS =====
function getPkg(id) { return db.packages.find(p=>p.id===id) || {}; }
function statusBadge(s) {
  const m = {active:'<span class="badge badge-green">✓ Hoạt động</span>',suspended:'<span class="badge badge-yellow">⏸ Tạm dừng</span>',expired:'<span class="badge badge-red">✗ Hết hạn</span>'};
  return m[s] || s;
}
function prioBadge(p) {
  const m = {high:'<span class="badge badge-red">🔴 Cao</span>',medium:'<span class="badge badge-yellow">🟡 TB</span>',low:'<span class="badge badge-gray">⚪ Thấp</span>'};
  return m[p] || p;
}
function ticketStatusBadge(s) {
  const m = {open:'<span class="badge badge-red">Mới</span>',processing:'<span class="badge badge-yellow">Đang xử lý</span>',resolved:'<span class="badge badge-green">Đã giải quyết</span>'};
  return m[s] || s;
}

// ===== DASHBOARD =====
function renderDashboard() {
  const stats = db.stats || { activeTenants: 0, totalTenants: 0, openTickets: 0, monthlyRevenue: 0, newTenantsThisMonth: 0, expiringSoon: 0 };
  
  document.getElementById('dash-tenants').textContent = stats.activeTenants;
  document.getElementById('dash-tenants-sub').textContent = `▲ ${stats.newTenantsThisMonth} mới trong tháng`;
  
  document.getElementById('dash-tickets').textContent = stats.openTickets;
  const tCount = document.getElementById('ticket-count');
  if (tCount) {
    tCount.textContent = stats.openTickets;
    tCount.style.display = stats.openTickets > 0 ? 'inline-block' : 'none';
  }
  const highPrioTickets = (db.tickets || []).filter(t => t.priority === 'high' && t.status !== 'resolved').length;
  document.getElementById('dash-tickets-sub').textContent = `${highPrioTickets} ưu tiên cao cần xử lý`;

  document.getElementById('dash-expiry').textContent = stats.expiringSoon;
  document.getElementById('dash-expiry-sub').textContent = stats.expiringSoon > 0 ? `${stats.expiringSoon} nhà thuê cần gia hạn` : 'Không có ai sắp hết hạn';

  // Cập nhật doanh thu (M)
  const revenueEl = document.getElementById('dash-revenue');
  if (revenueEl) {
    const rev = parseFloat(stats.monthlyRevenue) || 0;
    revenueEl.textContent = (rev / 1000000).toFixed(2) + 'M';
  }

  // Update Monthly Revenue Chart
  const chartBars = document.getElementById('revenue-chart-bars');
  const chartLabels = document.getElementById('revenue-chart-labels');
  
  if (chartBars && chartLabels && db.monthlyRevenue && db.monthlyRevenue.length > 0) {
    const maxRev = Math.max(...db.monthlyRevenue.map(m => parseFloat(m.revenue)), 1);
    
    chartBars.innerHTML = db.monthlyRevenue.map(m => {
      const height = (parseFloat(m.revenue) / maxRev * 100).toFixed(0);
      const revM = (parseFloat(m.revenue) / 1000000).toFixed(2);
      const parts = m.month.split('-');
      const monthLabel = parts[1];
      return `<div class="chart-bar" style="height:${height}%;background:linear-gradient(180deg, var(--accent), var(--accent2));" title="Tháng ${monthLabel}: ${revM}M"></div>`;
    }).join('');
    
    chartLabels.innerHTML = db.monthlyRevenue.map(m => {
      const monthLabel = 'T' + parseInt(m.month.split('-')[1]);
      return `<div class="chart-label">${monthLabel}</div>`;
    }).join('');
  } else if (chartBars) {
    chartBars.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--text3)">Chưa có dữ liệu doanh thu</div>';
  }

  // Update Package Allocation
  const packageAllocationBars = document.getElementById('package-allocation-bars');
  const totalProjectedRevenueEl = document.getElementById('total-projected-revenue');
  
  if (packageAllocationBars && db.packages) {
    const totalTenants = (db.tenants || []).length || 1;
    packageAllocationBars.innerHTML = db.packages.map(pkg => {
      const count = pkg.tenant_count || 0;
      const percent = (count / totalTenants * 100).toFixed(0);
      return `<div class="rev-row">
        <div class="rev-label">${pkg.name}</div>
        <div class="rev-bar-wrap"><div class="rev-bar" style="width:${percent}%;background:${pkg.color}"></div></div>
        <div class="rev-val">${count} nhà</div>
      </div>`;
    }).join('');
    
    if (totalProjectedRevenueEl && stats) {
      const arr = parseFloat(stats.monthlyRevenue) * 12;
      totalProjectedRevenueEl.textContent = (arr / 1000000).toFixed(2) + 'M ₫/năm';
    }
  }

  const tbody = document.getElementById('dash-tenant-table');
  if (db.tenants) {
    tbody.innerHTML = db.tenants.slice(0, 5).map(t => {
      return `<tr>
        <td><strong>${t.name}</strong><br><small style="color:var(--text2)">${t.address}</small></td>
        <td>${t.owner}</td>
        <td><span style="color:${t.package_color||'#fff'};font-weight:600">${t.package_name||'N/A'}</span></td>
        <td>${statusBadge(t.status)}</td>
        <td>${fmtDate(t.end_date)}</td>
        <td><button class="btn btn-sm btn-secondary" onclick="showPage('tenants')">Chi tiết</button></td>
      </tr>`;
    }).join('');
  }
}

// ===== TENANTS =====
function renderTenants() {
  const q = (document.getElementById('tenant-search')||{}).value?.toLowerCase() || '';
  const sf = (document.getElementById('tenant-filter')||{}).value || '';
  const list = (db.tenants || []).filter(t =>
    (!q || t.name.toLowerCase().includes(q) || t.owner.toLowerCase().includes(q)) &&
    (!sf || t.status === sf)
  );
  document.getElementById('tenants-list').innerHTML = list.map(t => {
    // Tự động kiểm tra thời gian thực để hiển thị hết hạn
    const todayStr = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const isExpired = t.end_date < todayStr;
    const displayStatus = isExpired && t.status === 'active' ? 'expired' : t.status;
    const isLocked = displayStatus !== 'active';
    const bdgColor = displayStatus==='active'?'badge-green':(displayStatus==='suspended'?'badge-yellow':'badge-red');
    const bdgText = displayStatus==='active'?'✓ Hoạt động':(displayStatus==='suspended'?'⏸ Tạm dừng':'✗ Đã hết hạn');

    return `<div class="tenant-card" style="margin-bottom:14px; border-left: 4px solid ${displayStatus==='active'?'var(--green)':displayStatus==='suspended'?'var(--yellow)':'var(--red)'}">
      <div class="tenant-avatar" style="background:${displayStatus==='active'?'rgba(0,212,170,0.1)':displayStatus==='suspended'?'rgba(255,209,102,0.1)':'rgba(255,77,109,0.1)'};overflow:hidden;display:flex;align-items:center;justify-content:center;">
        ${renderLogo(t.logo)}
      </div>
      <div class="tenant-info">
        <div class="tenant-name" style="display:flex;align-items:center;gap:10px">
          ${t.name} ${isLocked ? `<small style="color:var(--red);font-size:10px;">[${displayStatus==='suspended'?'ĐÃ KHÓA':'HẾT HẠN'}]</small>` : ''}
        </div>
        <div class="tenant-owner">👤 ${t.owner} · 📱 ${t.phone}</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px;">📍 ${t.address}</div>
        <div class="tenant-meta">
          <span class="badge ${bdgColor}">${bdgText}</span>
          <span class="badge badge-blue">📦 ${t.package_name || 'N/A'}</span>
          <span class="badge badge-gray">🔑 ${t.username}</span>
          <span class="badge badge-gray">📅 ${t.billing_cycle==='yearly'?'Hàng năm':'Hàng tháng'}</span>
          <span class="badge ${isExpired ? 'badge-red' : 'badge-gray'}">⏳ HH: ${fmtDate(t.end_date)}</span>
        </div>
        <div class="tenant-actions">
          <button class="btn btn-sm btn-secondary" onclick="viewTenantDetail('${t.id}')">👁️ Chi tiết</button>
          <button class="btn btn-sm btn-secondary" onclick="openEditTenantModal('${t.id}')">✏️ Sửa</button>
          ${displayStatus === 'expired' 
            ? `<button class="btn btn-sm btn-primary" onclick="renewTenant('${t.id}')">🔁 Gia hạn</button>` 
            : `<button class="btn btn-sm ${displayStatus==='active'?'btn-secondary':'btn-primary'}" onclick="toggleTenantStatus('${t.id}')">
                ${displayStatus==='active'?'⏸ Tạm dừng':'▶ Kích hoạt'}
               </button>`
          }
          <button class="btn btn-sm btn-danger" onclick="deleteTenant('${t.id}')">🗑 Xóa</button>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:22px;font-weight:800;font-family:var(--mono);color:var(--accent)">${fmt(t.billing_cycle==='yearly'?t.price_yearly:t.price_monthly)}</div>
        <div style="font-size:11px;color:var(--text2)">${t.billing_cycle==='yearly'?'/năm':'/tháng'}</div>
      </div>
    </div>`;
  }).join('') || '<div style="text-align:center;padding:40px;color:var(--text2)">Không tìm thấy nhà thuê nào</div>';
}
async function toggleTenantStatus(id) {
  const t = db.tenants.find(x=>x.id===id);
  if (!t) return;
  const newStatus = t.status==='active' ? 'suspended' : 'active';
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/tenants/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await response.json();
    if (data.success) {
      await refreshTenantData();
    } else {
      alert('Lỗi: ' + data.message);
    }
  } catch (error) {
    console.error('Error updating tenant status:', error);
    alert('Lỗi kết nối đến server');
  }
}
async function renewTenant(id) {
  if (!confirm('Xác nhận gia hạn thêm 1 chu kỳ cho nhà thuê này? (Trạng thái sẽ được mở khóa và Hạn mức cộng thêm 1 chu kỳ)')) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/tenants/${id}/renew`, {
      method: 'PUT'
    });
    const data = await response.json();
    if (data.success) {
      await refreshTenantData();
      alert('Đã gia hạn thành công!');
    } else {
      alert('Lỗi: ' + data.message);
    }
  } catch (error) {
    console.error('Error renewing tenant:', error);
    alert('Lỗi kết nối đến server');
  }
}
async function deleteTenant(id) {
  if (!confirm('Xác nhận xóa nhà thuê này?')) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/tenants/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      alert('Lỗi server (' + response.status + '): ' + errorText);
      return;
    }

    const data = await response.json();
    if (data.success) {
      alert('Đã xóa nhà thuê thành công!');
      await refreshTenantData();
    } else {
      alert('Lỗi: ' + (data.message || 'Không thể xóa nhà thuê'));
    }
  } catch (error) {
    console.error('Error deleting tenant:', error);
    alert('Lỗi kết nối đến server: ' + error.message);
  }
}
function viewTenantDetail(id) {
  const t = db.tenants.find(x=>x.id===id);
  if (!t) return;
  
  const content = document.getElementById('tenant-detail-content');
  content.innerHTML = `
    <div class="modal-header-flex" style="display:flex;gap:20px;align-items:flex-start;margin-bottom:20px;">
      <div style="width:100px;height:100px;background:var(--bg2);border-radius:15px;border:1px solid var(--border);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:40px;">
        ${renderLogo(t.logo, 100)}
      </div>
      <div style="flex:1;">
        <h2 style="margin-bottom:5px;">${t.name}</h2>
        <div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
          ${statusBadge(t.status)}
          <span class="badge badge-blue">📦 ${t.package_name || 'N/A'}</span>
        </div>
        <p style="color:var(--text2);font-size:13px;line-height:1.6;">📍 <strong>Địa chỉ:</strong> ${t.address}</p>
      </div>
    </div>
    <div class="detail-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;background:var(--bg2);padding:20px;border-radius:10px;border:1px solid var(--border);">
      <div>
        <p style="font-size:12px;color:var(--text3);margin-bottom:4px;">👤 Chủ sở hữu</p>
        <p style="font-weight:600;">${t.owner}</p>
      </div>
      <div>
        <p style="font-size:12px;color:var(--text3);margin-bottom:4px;">📱 Số điện thoại</p>
        <p style="font-weight:600;">${t.phone}</p>
      </div>
      <div>
        <p style="font-size:12px;color:var(--text3);margin-bottom:4px;">📧 Email liên hệ</p>
        <p style="font-weight:600;">${t.email}</p>
      </div>
      <div>
        <p style="font-size:12px;color:var(--text3);margin-bottom:4px;">🔑 Tài khoản quản trị</p>
        <p style="font-weight:600;font-family:var(--mono);color:var(--accent);">${t.username}</p>
      </div>
      <div>
        <p style="font-size:12px;color:var(--text3);margin-bottom:4px;">📅 Chu kỳ & Giá</p>
        <p style="font-weight:600;">${t.billing_cycle==='yearly'?'Hàng năm':'Hàng tháng'} (${fmt(t.billing_cycle==='yearly'?t.price_yearly:t.price_monthly)})</p>
      </div>
      <div>
        <p style="font-size:12px;color:var(--text3);margin-bottom:4px;">⏳ Ngày đăng ký & Hết hạn</p>
        <p style="font-weight:600;">${fmtDate(t.start_date)} → <span style="color:var(--red)">${fmtDate(t.end_date)}</span></p>
      </div>
    </div>
  `;

  document.getElementById('edit-tenant-btn').onclick = () => {
    closeModal('modal-tenant-detail');
    openEditTenantModal(id);
  };
  
  document.getElementById('modal-tenant-detail').classList.add('show');
}

function openEditTenantModal(id) {
  const t = db.tenants.find(x=>x.id===id);
  if (!t) return;

  document.getElementById('edit-nt-id').value = t.id;
  document.getElementById('edit-nt-name').value = t.name;
  document.getElementById('edit-nt-owner').value = t.owner;
  document.getElementById('edit-nt-email').value = t.email;
  document.getElementById('edit-nt-phone').value = t.phone;
  document.getElementById('edit-nt-address').value = t.address;
  document.getElementById('edit-nt-user').value = t.username;
  document.getElementById('edit-nt-pass').value = t.password;
  document.getElementById('edit-nt-pkg').value = t.package_id;
  document.getElementById('edit-nt-cycle').value = t.billing_cycle;
  document.getElementById('edit-nt-logo').value = t.logo || '';

  document.getElementById('modal-edit-tenant').classList.add('show');
}

async function saveEditTenant() {
  const id = document.getElementById('edit-nt-id').value;
  const data = {
    name: document.getElementById('edit-nt-name').value,
    owner: document.getElementById('edit-nt-owner').value,
    email: document.getElementById('edit-nt-email').value,
    phone: document.getElementById('edit-nt-phone').value,
    address: document.getElementById('edit-nt-address').value,
    username: document.getElementById('edit-nt-user').value,
    password: document.getElementById('edit-nt-pass').value,
    package_id: document.getElementById('edit-nt-pkg').value,
    billing_cycle: document.getElementById('edit-nt-cycle').value,
    logo: document.getElementById('edit-nt-logo').value
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/tenants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (result.success) {
      closeModal('modal-edit-tenant');
      await refreshTenantData();
    } else {
      alert('Lỗi: ' + result.message);
    }
  } catch (error) {
    console.error('Error saving tenant:', error);
    alert('Lỗi kết nối đến server');
  }
}
function openAddTenantModal() { document.getElementById('modal-add-tenant').classList.add('show'); }
async function addTenant() {
  const name = document.getElementById('nt-name').value.trim();
  if (!name) return alert('Vui lòng nhập tên cơ sở');
  
  const cycle = document.getElementById('nt-cycle').value;
  const daysToAdd = cycle === 'yearly' ? 365 : 30;
  
  const newT = {
    id:'tenant'+Date.now(), name, owner:document.getElementById('nt-owner').value,
    email:document.getElementById('nt-email').value, phone:document.getElementById('nt-phone').value,
    address:document.getElementById('nt-address').value,
    username:document.getElementById('nt-user').value, password:document.getElementById('nt-pass').value,
    package_id:document.getElementById('nt-pkg').value,
    billing_cycle:cycle,
    status:'active', start_date:new Date().toISOString().split('T')[0],
    end_date:new Date(Date.now() + daysToAdd * 86400000).toISOString().split('T')[0],
    logo:document.getElementById('nt-logo').value || '🏟️'
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newT)
    });
    const data = await response.json();
    if (data.success) {
      closeModal('modal-add-tenant');
      await refreshTenantData();
    } else {
      alert('Lỗi: ' + data.message);
    }
  } catch (error) {
    console.error('Error adding tenant:', error);
    alert('Lỗi kết nối đến server');
  }
}

// Helper to refresh all tenant-related data
function renderLogo(logo, size = 40) {
  if (!logo) return '🏢';
  if (logo.startsWith('http') || logo.startsWith('/') || logo.startsWith('data:')) {
    return `<img src="${logo}" style="width:100%;height:100%;object-fit:contain;" onerror="this.outerHTML='🏟️'">`;
  }
  return logo;
}
async function refreshTenantData() {
  try {
    const [statsRes, tenantsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/tenants/stats`),
      fetch(`${API_BASE_URL}/api/tenants`)
    ]);

    db.stats = await statsRes.json();
    db.tenants = await tenantsRes.json();

    renderDashboard();
    if (document.getElementById('page-tenants').classList.contains('active')) {
      renderTenants();
    }
  } catch (error) {
    console.error('Error refreshing data:', error);
  }
}

// ===== PACKAGES =====
function renderPackages() {
  if (!db.packages) return;

  document.getElementById('packages-grid').innerHTML = db.packages.map(pkg => {
    const features = typeof pkg.features === 'string' ? pkg.features.split(',').map(f => f.trim()) : (pkg.features || []);
    return `<div class="pkg-card ${pkg.popular?'popular':''}">
      ${pkg.popular ? '<div class="pkg-popular-badge">⭐ PHỔ BIẾN</div>' : ''}
      <div style="position:absolute;top:10px;right:10px;display:flex;gap:5px;">
        <button class="btn btn-sm btn-secondary" style="padding:4px 8px;" onclick="openEditPackageModal('${pkg.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" style="padding:4px 8px;" onclick="deletePackage('${pkg.id}')">🗑</button>
      </div>
      <div class="pkg-name" style="color:${pkg.color}">${pkg.name}</div>
      <div class="pkg-price" style="color:${pkg.color}">${(parseFloat(pkg.price_monthly)/1000).toFixed(0)}K</div>
      <div class="pkg-period">₫/tháng · ${(parseFloat(pkg.price_yearly)/1000000).toFixed(2)}M/năm</div>
      <div style="font-size:12px;color:var(--text2);margin:8px 0">Tối đa: ${pkg.max_fields===999?'Không giới hạn':pkg.max_fields+' sân'}</div>
      <div class="pkg-features">
        ${features.map(f=>`<div class="pkg-feature">${f}</div>`).join('')}
      </div>
      <div style="padding-top:12px;border-top:1px solid var(--border);font-size:13px;color:var(--text2)">
        <strong style="color:var(--text)">${pkg.tenant_count || 0}</strong> nhà thuê đã đăng ký
      </div>
    </div>`;
  }).join('');

  document.getElementById('pkg-stats-table').innerHTML = db.packages.map(pkg => {
    const activeTenants = pkg.active_tenant_count || 0;
    const monthlyRevenue = parseFloat(pkg.monthly_revenue) || 0;
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:10px;height:10px;border-radius:50%;background:${pkg.color}"></div>
          <strong style="color:var(--text)">${pkg.name}</strong>
        </div>
      </td>
      <td><span class="badge badge-blue">${activeTenants} nhà thuê</span></td>
      <td><strong style="font-family:var(--mono)">${fmt(monthlyRevenue)}</strong></td>
      <td><strong style="font-family:var(--mono);color:var(--accent)">${fmt(monthlyRevenue * 12)}</strong></td>
      <td>
        <div style="display:flex;gap:5px;">
          <button class="btn btn-sm btn-secondary" onclick="openEditPackageModal('${pkg.id}')">✏️ Sửa</button>
          <button class="btn btn-sm btn-danger" onclick="deletePackage('${pkg.id}')">🗑 Xóa</button>
        </div>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text2)">Chưa có gói dịch vụ nào</td></tr>';
}

function openAddPackageModal() { document.getElementById('modal-add-package').classList.add('show'); }

async function addPackage() {
  const id = document.getElementById('pkg-id').value.trim();
  const name = document.getElementById('pkg-name').value.trim();
  if (!id || !name) return alert('Vui lòng nhập đầy đủ mã và tên gói');

  const priceM = parseFloat(document.getElementById('pkg-price-m').value) || 0;
  const priceY = parseFloat(document.getElementById('pkg-price-y').value) || 0;
  const maxFields = parseInt(document.getElementById('pkg-max').value) || 0;

  if (priceM < 0 || priceY < 0) return alert('Giá gói không được nhỏ hơn 0');
  if (maxFields <= 0 && maxFields !== 0) return alert('Số sân tối đa phải lớn hơn 0');

  const newPkg = {
    id, name,
    price_monthly: priceM,
    price_yearly: priceY,
    max_fields: maxFields || 999,
    features: document.getElementById('pkg-features').value,
    color: document.getElementById('pkg-color').value,
    popular: document.getElementById('pkg-popular').checked ? 1 : 0
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPkg)
    });
    const data = await response.json();
    if (data.success) {
      closeModal('modal-add-package');
      await refreshAppData();
    } else {
      alert('Lỗi: ' + data.message);
    }
  } catch (error) {
    console.error('Error adding package:', error);
    alert('Lỗi kết nối đến server');
  }
}

function openEditPackageModal(id) {
  const pkg = db.packages.find(p => p.id === id);
  if (!pkg) return;

  document.getElementById('edit-pkg-id').value = pkg.id;
  document.getElementById('edit-pkg-name').value = pkg.name;
  document.getElementById('edit-pkg-price-m').value = pkg.price_monthly;
  document.getElementById('edit-pkg-price-y').value = pkg.price_yearly;
  document.getElementById('edit-pkg-max').value = pkg.max_fields;
  document.getElementById('edit-pkg-features').value = pkg.features;
  document.getElementById('edit-pkg-color').value = pkg.color;
  document.getElementById('edit-pkg-popular').checked = pkg.popular === 1 || pkg.popular === true;

  document.getElementById('modal-edit-package').classList.add('show');
}

async function saveEditPackage() {
  const id = document.getElementById('edit-pkg-id').value;
  const priceM = parseFloat(document.getElementById('edit-pkg-price-m').value) || 0;
  const priceY = parseFloat(document.getElementById('edit-pkg-price-y').value) || 0;
  const maxFields = parseInt(document.getElementById('edit-pkg-max').value) || 0;

  if (!id) return alert('Không tìm thấy ID gói dịch vụ');
  if (priceM < 0 || priceY < 0) return alert('Giá gói không được nhỏ hơn 0');

  const data = {
    name: document.getElementById('edit-pkg-name').value,
    price_monthly: priceM,
    price_yearly: priceY,
    max_fields: maxFields || 999,
    features: document.getElementById('edit-pkg-features').value,
    color: document.getElementById('edit-pkg-color').value,
    popular: document.getElementById('edit-pkg-popular').checked ? 1 : 0
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/packages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (result.success) {
      closeModal('modal-edit-package');
      await refreshAppData();
    } else {
      alert('Lỗi: ' + result.message);
    }
  } catch (error) {
    console.error('Error saving package:', error);
    alert('Lỗi kết nối đến server');
  }
}

async function deletePackage(id) {
  if (!confirm('Xác nhận xóa gói dịch vụ này? Lưu ý: Nếu có nhà thuê đang dùng gói này, việc xóa có thể gây lỗi hệ thống.')) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/packages/${id}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    if (data.success) {
      await refreshAppData();
    } else {
      alert('Lỗi: ' + data.message);
    }
  } catch (error) {
    console.error('Error deleting package:', error);
    alert('Lỗi kết nối đến server');
  }
}

async function refreshAppData() {
  await initApp(); // Re-fetch all data
  if (document.getElementById('page-packages').classList.contains('active')) renderPackages();
  if (document.getElementById('page-tenants').classList.contains('active')) renderTenants();
  if (document.getElementById('page-billing').classList.contains('active')) renderBilling();
  if (document.getElementById('page-tickets').classList.contains('active')) renderTickets();
}

// ===== BILLING =====
function renderBilling() {
  if (!db.invoices) return;

  const q = (document.getElementById('billing-search')||{}).value?.toLowerCase() || '';
  const sf = (document.getElementById('billing-status-filter')||{}).value || '';

  const list = db.invoices.filter(inv => 
    (!q || inv.tenant_name.toLowerCase().includes(q) || inv.id.toLowerCase().includes(q)) &&
    (!sf || inv.status === sf)
  );

  // Update summary cards (Always based on ALL invoices to show total health)
  const stats = db.invoiceStats || { paid: {total:0, count:0}, unpaid: {total:0, count:0}, overdue: {total:0, count:0} };
  
  const statsCards = document.querySelectorAll('#page-billing .stat-value');
  if (statsCards.length >= 3) {
    statsCards[0].textContent = (stats.paid.total / 1000000).toFixed(2) + 'M ₫';
    statsCards[0].nextElementSibling.textContent = stats.paid.count + ' hóa đơn';
    
    statsCards[1].textContent = (stats.unpaid.total / 1000000).toFixed(2) + 'M ₫';
    statsCards[1].nextElementSibling.textContent = stats.unpaid.count + ' hóa đơn';
    
    statsCards[2].textContent = (stats.overdue.total / 1000000).toFixed(2) + 'M ₫';
    statsCards[2].nextElementSibling.textContent = stats.overdue.count + ' hóa đơn';
  }

  document.getElementById('billing-table').innerHTML = list.map(inv => {
    const statusMap = {
      paid: '<span class="badge badge-green">✅ Đã thanh toán</span>',
      unpaid: '<span class="badge badge-yellow">⏳ Chờ thanh toán</span>',
      overdue: '<span class="badge badge-red">❌ Quá hạn</span>'
    };

    return `<tr>
      <td><span style="font-family:var(--mono);color:var(--accent)">${inv.id}</span></td>
      <td><strong>${inv.tenant_name}</strong></td>
      <td>${inv.package_name}</td>
      <td><strong style="font-family:var(--mono)">${fmt(parseFloat(inv.amount))}</strong></td>
      <td>${inv.billing_cycle==='yearly'?'Hàng năm':'Hàng tháng'}</td>
      <td>${fmtDate(inv.due_date)}</td>
      <td>${statusMap[inv.status] || inv.status}</td>
      <td>
        <div style="display:flex;gap:5px;">
          ${inv.status !== 'paid' ? `<button class="btn btn-sm btn-primary" onclick="updateInvoiceStatus('${inv.id}', 'paid')">✓ Thu tiền</button>` : ''}
          <button class="btn btn-sm btn-secondary" onclick="printInvoice('${inv.id}')">🖨 In</button>
          <button class="btn btn-sm btn-secondary" onclick="sendInvoice('${inv.id}')">📧 Gửi</button>
        </div>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text2)">Không tìm thấy hóa đơn nào</td></tr>';
}

async function updateInvoiceStatus(id, newStatus) {
  const msg = newStatus === 'paid' ? 'Xác nhận hóa đơn này đã được thanh toán?' : `Chuyển trạng thái hóa đơn sang ${newStatus}?`;
  if (!confirm(msg)) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/invoices/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const result = await response.json();
    if (result.success) {
      await refreshAppData();
    } else {
      alert('Lỗi: ' + result.message);
    }
  } catch (error) {
    console.error('Error updating invoice status:', error);
    alert('Lỗi kết nối đến server');
  }
}

function printInvoice(id) {
  const inv = db.invoices.find(i => i.id === id);
  if (!inv) return;

  const content = document.getElementById('invoice-print-content');
  const addInfo = encodeURIComponent(`Thanh toan hoa don ${inv.id}`);
  const qrUrl = `https://img.vietqr.io/image/TCB-3036506868-compact.png?amount=${inv.amount}&addInfo=${addInfo}`;

  const invoiceHTML = `
    <div class="invoice-box" style="width:100%; max-width:100%; overflow-x:hidden;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #333; padding-bottom:15px; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
        <div>
          <h1 style="margin:0; color:var(--accent); font-size:24px;">FOOTFIELD</h1>
          <p style="margin:2px 0; font-size:12px; color:#666;">Hệ thống quản lý sân bóng thông minh</p>
        </div>
        <div style="text-align:right; min-width:150px;">
          <h2 style="margin:0; font-size:18px;">HÓA ĐƠN DỊCH VỤ</h2>
          <p style="margin:2px 0; font-weight:bold; font-size:13px;">Mã: ${inv.id}</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom:20px;">
        <div style="font-size:13px;">
          <h4 style="border-bottom:1px solid #ddd; padding-bottom:5px; margin-bottom:8px; font-size:12px; color:#888;">ĐƠN VỊ CUNG CẤP</h4>
          <p style="margin:2px 0; font-weight:600;">Công ty Giải pháp FootField</p>
          <p style="margin:2px 0;">Khu Công nghệ cao, TP. Vinh</p>
          <p style="margin:2px 0;">SĐT: 0123 456 789</p>
        </div>
        <div style="font-size:13px;">
          <h4 style="border-bottom:1px solid #ddd; padding-bottom:5px; margin-bottom:8px; font-size:12px; color:#888;">KHÁCH HÀNG</h4>
          <p style="margin:2px 0; font-weight:600;">${inv.tenant_name}</p>
          <p style="margin:2px 0; font-size:12px;">SĐT: ${inv.tenant_phone || 'N/A'}</p>
        </div>
      </div>

      <div style="overflow-x:auto; margin-bottom:20px;">
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="background:#f8f9fa;">
              <th style="border:1px solid #ddd; padding:10px; text-align:left;">Dịch vụ</th>
              <th style="border:1px solid #ddd; padding:10px; text-align:right;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid #ddd; padding:10px;">Thuê phần mềm FootField - <strong>${inv.package_name}</strong> (${inv.billing_cycle === 'yearly' ? 'Năm' : 'Tháng'})</td>
              <td style="border:1px solid #ddd; padding:10px; text-align:right; font-weight:600;">${fmt(parseFloat(inv.amount))}</td>
            </tr>
            <tr style="background:#fdfdfd;">
              <td style="border:1px solid #ddd; padding:10px; text-align:right; font-weight:bold;">TỔNG CỘNG</td>
              <td style="border:1px solid #ddd; padding:10px; text-align:right; font-weight:800; font-size:16px; color:#00d4aa;">${fmt(parseFloat(inv.amount))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="text-align: center; margin-bottom: 25px; padding: 15px; border: 1px dashed #ddd; border-radius: 8px;">
        <img src="${qrUrl}" alt="QR Code" style="width:120px; height:120px;">
        <p style="font-size:11px; color:#666; margin-top:8px;">Quét mã VietQR để thanh toán</p>
      </div>

      <div style="display:flex; justify-content:space-between; margin-top:30px; gap:20px; flex-wrap:wrap;">
        <div style="text-align:center; flex:1; min-width:120px;">
          <p style="margin-bottom:40px; font-size:13px;">Khách hàng</p>
          <p style="font-size:11px; font-style:italic; color:#999;">(Ký tên)</p>
        </div>
        <div style="text-align:center; flex:1; min-width:120px;">
          <p style="margin-bottom:40px; font-size:13px;">Người lập phiếu</p>
          <p style="font-size:13px; font-weight:bold;">Trần Đức Lương</p>
        </div>
      </div>

      <div style="margin-top:30px; padding-top:15px; border-top:1px solid #eee; font-size:11px; color:#aaa; text-align:center;">
        <p>Cảm ơn quý khách đã đồng hành cùng FootField!</p>
      </div>
    </div>
  `;
  content.innerHTML = invoiceHTML;

  document.getElementById('modal-invoice-print').classList.add('show');
}

async function sendInvoice(id) {
  const inv = db.invoices.find(i => i.id === id);
  if (!inv) return;

  const recipientEmail = inv.tenant_email;
  if (!recipientEmail) {
    alert('❌ Không tìm thấy địa chỉ email của nhà thuê!');
    return;
  }

  if (!confirm(`Bạn có chắc muốn gửi hóa đơn ${inv.id} thực tế đến email: ${recipientEmail}?`)) return;

  try {
    const btn = event.target;
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⌛ Đang gửi...';

    const addInfo = encodeURIComponent(`Thanh toan hoa don ${inv.id}`);
    const qrUrl = `https://img.vietqr.io/image/TCB-3036506868-compact.png?amount=${inv.amount}&addInfo=${addInfo}`;

    // Tạo nội dung HTML cho email (giống mẫu in nhưng đơn giản hơn)
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #00d4aa; text-align: center;">HÓA ĐƠN DỊCH VỤ FOOTFIELD</h2>
        <hr>
        <p>Xin chào <strong>${inv.tenant_name}</strong>,</p>
        <p>Đây là thông báo về hóa đơn dịch vụ của bạn trên hệ thống FootField:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Mã hóa đơn:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${inv.id}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Gói dịch vụ:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${inv.package_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Số tiền:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #ff4d4f;">${fmt(parseFloat(inv.amount))}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Hạn thanh toán:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${fmtDate(inv.due_date)}</td>
          </tr>
        </table>
        <p>Vui lòng thanh toán hóa đơn đúng hạn để duy trì dịch vụ. Cảm ơn quý khách!</p>
        <div style="text-align: center; margin: 20px 0;">
          <p>Hoặc quét mã QR để thanh toán nhanh:</p>
          <img src="${qrUrl}" alt="QR Code" style="width:180px; height:180px;">
        </div>
        <hr>
        <p style="font-size: 12px; color: #999; text-align: center;">Đây là email tự động từ hệ thống FootField.</p>
      </div>
    `;

    const response = await fetch(`${API_BASE_URL}/api/invoices/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: inv.id,
        to: recipientEmail,
        subject: `[FootField] Hóa đơn dịch vụ ${inv.id} - ${inv.tenant_name}`,
        htmlContent: emailHtml
      })
    });

    const data = await response.json();

    if (data.success) {
      alert(`✅ Đã gửi hóa đơn thực tế đến: ${recipientEmail}`);
    } else {
      alert('❌ Lỗi gửi email: ' + (data.message || 'Không xác định'));
      console.error('Send error details:', data.error);
    }
    btn.innerHTML = oldText;
    btn.disabled = false;
  } catch (error) {
    console.error('Error sending invoice:', error);
    alert('❌ Lỗi kết nối đến server hoặc lỗi SMTP');
    if (typeof btn !== 'undefined') {
      btn.innerHTML = '📧 Gửi';
      btn.disabled = false;
    }
  }
}

// ===== TICKETS =====
let selectedTicketId = null;
function renderTickets() {
  if (!db.tickets) return;

  const q = (document.getElementById('ticket-search')||{}).value?.toLowerCase() || '';
  const sf = (document.getElementById('ticket-status-filter')||{}).value || '';
  const pf = (document.getElementById('ticket-prio-filter')||{}).value || '';
  
  const list = db.tickets.filter(t =>
    (!q || t.subject.toLowerCase().includes(q) || t.tenant_name.toLowerCase().includes(q)) &&
    (!sf || t.status===sf) && (!pf || t.priority===pf)
  );
  
  const prioColor = {high:'var(--red)',medium:'var(--yellow)',low:'var(--text2)'};
  document.getElementById('tickets-list').innerHTML = list.map(t => {
    const isBug = t.type === 'bug';
    return `
    <div class="ticket-item" onclick="openTicketDetail('${t.id}')" style="border-left: 4px solid ${prioColor[t.priority]}">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          ${prioBadge(t.priority)} ${ticketStatusBadge(t.status)}
          <span class="badge ${isBug?'badge-red':'badge-blue'}">${isBug?'🐛 Lỗi hệ thống':'💡 Đề xuất tính năng'}</span>
        </div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${t.subject}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px">
          <span style="color:var(--accent)">🏢 ${t.tenant_name}</span> · 📅 ${fmtDate(t.created_at)}
        </div>
        <div style="font-size:12px;color:var(--text3);margin-top:6px;line-height:1.4">${t.message.substring(0,100)}${t.message.length>100?'...':''}</div>
      </div>
      <div style="flex-shrink:0;align-self:center"><button class="btn btn-sm btn-secondary">Chi tiết →</button></div>
    </div>`;
  }).join('') || '<div style="text-align:center;padding:60px;color:var(--text2)">Không tìm thấy phiếu hỗ trợ nào</div>';
}
function openTicketDetail(id) {
  const t = db.tickets.find(x=>x.id===id);
  if (!t) return;
  selectedTicketId = id;
  const isBug = t.type === 'bug';

  document.getElementById('ticket-detail-content').innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:16px">
      ${prioBadge(t.priority)} ${ticketStatusBadge(t.status)} 
      <span class="badge ${isBug?'badge-red':'badge-blue'}">${isBug?'🐛 Bug':'💡 Feature'}</span>
      <span class="badge badge-gray">${t.id}</span>
    </div>
    <h3 style="margin-bottom:8px;font-size:18px">${t.subject}</h3>
    <div style="font-size:13px;color:var(--text2);margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid var(--border)">
      <strong style="color:var(--text)">Gửi bởi:</strong> ${t.tenant_name} <br>
      <strong style="color:var(--text)">Thời gian:</strong> ${fmtDate(t.created_at)}
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;font-size:14px;line-height:1.6;color:var(--text)">
      ${t.message}
    </div>
    ${t.status==='resolved' ? '<div style="margin-top:16px;padding:12px;background:rgba(0,212,170,.1);border:1px solid rgba(0,212,170,.2);border-radius:8px;font-size:13px;color:var(--accent);text-align:center">✅ Phiếu này đã được giải quyết hoàn tất</div>' : ''}
  `;

  // Control Buttons
  const footer = document.querySelector('#modal-ticket-detail .modal-footer');
  const isResolved = t.status === 'resolved';
  const isProcessing = t.status === 'processing';

  footer.innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('modal-ticket-detail')">Đóng</button>
    ${!isResolved && !isProcessing ? `<button class="btn btn-secondary" style="background:var(--accent2);color:white;border:none" onclick="updateTicketStatus('${id}', 'processing')">⚙️ Tiếp nhận & Xử lý</button>` : ''}
    ${!isResolved ? `<button class="btn btn-primary" onclick="updateTicketStatus('${id}', 'resolved')">✅ Hoàn thành</button>` : ''}
  `;

  document.getElementById('modal-ticket-detail').classList.add('show');
}

async function updateTicketStatus(id, newStatus) {
  const statusLabels = { 'processing': 'Đang xử lý', 'resolved': 'Đã giải quyết' };
  if (!confirm(`Xác nhận chuyển phiếu hỗ trợ sang trạng thái: ${statusLabels[newStatus] || newStatus}?`)) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/tickets/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await response.json();
    if (data.success) {
      await refreshAppData();
      closeModal('modal-ticket-detail');
    } else {
      alert('Lỗi: ' + data.message);
    }
  } catch (error) {
    console.error('Error updating ticket status:', error);
    alert('Lỗi kết nối đến server');
  }
}

// ===== NOTIFICATIONS =====
function renderNotifications() {
  if (!db.notifications) return;
  const icons = {system:'🔧',promo:'🎁',feature:'✨'};
  document.getElementById('notifs-list').innerHTML = db.notifications.map(n => `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;gap:14px;align-items:flex-start">
        <div class="notif-icon ${n.type==='system'?'sys':n.type==='promo'?'promo':'feat'}" style="font-size:20px">${icons[n.type]||'📢'}</div>
        <div style="flex:1">
          <div style="font-size:15px;font-weight:700">${n.title}</div>
          <div style="font-size:13px;color:var(--text2);margin-top:4px">${n.message}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:8px">📅 ${fmtDate(n.created_at)} · 🎯 ${n.target==='all'?'Tất cả nhà thuê':'Chọn lọc'}</div>
        </div>
        <button class="btn btn-sm btn-danger" onclick="deleteNotif('${n.id}')">🗑</button>
      </div>
    </div>`).join('') || '<div style="text-align:center;padding:40px;color:var(--text2)">Chưa có thông báo nào</div>';
}
function openNotifModal() { 
  const targetSel = document.getElementById('notif-target');
  targetSel.value = 'all';
  toggleNotifTarget();
  
  // Populate tenant dropdown
  const tenantSel = document.getElementById('notif-tenant-id');
  tenantSel.innerHTML = (db.tenants || []).map(t => `<option value="${t.id}">${t.name} (${t.id})</option>`).join('');
  
  document.getElementById('modal-notif').classList.add('show'); 
}

function toggleNotifTarget() {
  const target = document.getElementById('notif-target').value;
  document.getElementById('notif-tenant-row').style.display = target === 'tenant' ? 'block' : 'none';
}
async function sendNotif() {
  const title = document.getElementById('notif-title').value.trim();
  if (!title) return alert('Vui lòng nhập tiêu đề');
  
  const target = document.getElementById('notif-target').value;
  const tenant_id = target === 'tenant' ? document.getElementById('notif-tenant-id').value : null;

  const newNotif = {
    id: 'n' + Date.now(),
    title,
    message: document.getElementById('notif-msg').value,
    type: document.getElementById('notif-type').value,
    target,
    tenant_id
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNotif)
    });
    const data = await response.json();
    if (data.success) {
      // Refresh notifications data
      const notifsRes = await fetch(`${API_BASE_URL}/api/notifications`);
      db.notifications = await notifsRes.json();
      
      closeModal('modal-notif');
      renderNotifications();
      ['notif-title', 'notif-msg'].forEach(id => document.getElementById(id).value = '');
    } else {
      alert('Lỗi: ' + data.message);
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    alert('Lỗi kết nối đến server');
  }
}
async function deleteNotif(id) {
  if (!confirm('Xóa thông báo này?')) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/${id}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    if (data.success) {
      // Refresh notifications data
      const notifsRes = await fetch(`${API_BASE_URL}/api/notifications`);
      db.notifications = await notifsRes.json();
      renderNotifications();
    } else {
      alert('Lỗi: ' + data.message);
    }
  } catch (error) {
    console.error('Error deleting notification:', error);
    alert('Lỗi kết nối đến server');
  }
}

// ===== MODAL =====
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target===m) m.classList.remove('show'); });
});

// ===== BOOT =====
const savedUser = localStorage.getItem('ff_user');
const lastActive = localStorage.getItem('ff_provider_last_active');

if (savedUser) {
  try {
    const now = Date.now();
    // Kiểm tra thời gian không hoạt động (5 phút)
    if (lastActive && (now - parseInt(lastActive) > INACTIVITY_LIMIT)) {
      alert('⚠️ Phiên làm việc đã hết hạn do bạn không hoạt động quá 5 phút. Vui lòng đăng nhập lại.');
      doLogout();
    } else {
      document.getElementById('login-page').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      updateLastActive(); // Cập nhật lại thời gian khi load trang thành công
      initApp();
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
      const user = JSON.parse(localStorage.getItem('ff_user') || '{}');
      updateFCMToken('admin', user.id, token.value);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      showWebNotification(notification.title, notification.body);
    });
  } else if ('Notification' in window) {
    // WEB BROWSER LOGIC
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      try {
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
          const user = JSON.parse(localStorage.getItem('ff_user') || '{}');
          updateFCMToken('admin', user.id, currentToken);
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
  const toast = document.createElement('div');
  toast.style = `position:fixed; top:20px; right:20px; background:var(--accent); color:white; padding:15px 25px; 
    border-radius:10px; box-shadow:var(--shadow-lg); z-index:9999; animation: slideIn 0.3s ease;`;
  toast.innerHTML = `<strong>${title}</strong><br>${body}`;
  document.body.appendChild(toast);
  
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
  audio.play().catch(e => console.log('Audio autoplay blocked'));

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}


function doRealPrint() {
  const content = document.getElementById('invoice-print-content').innerHTML;
  if (window.cordova && window.cordova.plugins && window.cordova.plugins.printer) {
    window.cordova.plugins.printer.check(function (available) {
      if (available) {
        window.cordova.plugins.printer.print(content, { name: 'HoaDon_DichVu' });
      } else {
        alert('❌ Không tìm thấy máy in khả dụng.');
      }
    });
  } else {
    window.print();
  }
}

function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('show');
  document.querySelector('.sidebar-overlay').classList.toggle('show');
}