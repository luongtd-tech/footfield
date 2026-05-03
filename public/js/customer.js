// ===== API CONFIGURATION =====
    const urlParams = new URLSearchParams(window.location.search);
    const TENANT_ID = urlParams.get('tenant') || 'tenant1';
    let tenantSettings = null;
    let cachedData = null;
    const CACHE_DURATION = 2000; // Giảm từ 10s xuống 2s

    // ✅ Cache invalidation for real-time sync
    let cacheInvalidationInterval = null;

    function startCacheInvalidationListener() {
      if (cacheInvalidationInterval) {
        clearInterval(cacheInvalidationInterval);
      }

      // Lắng nghe localStorage events từ admin (cùng domain)
      window.addEventListener('storage', (e) => {
        if (e.key === `vinhunifootball_cache_invalidate_${TENANT_ID}`) {
          console.log('🔄 Cache invalidated by admin via localStorage');
          cachedData = null;
          dataLoadTime = null;

          if (document.getElementById('page-booking').classList.contains('active')) {
            setTimeout(() => updateTimeSlots(), 200);
          }
        }
      });

      // Polling server mỗi 3 giây để đồng bộ real-time
      let lastServerInvalidationTime = 0;
      cacheInvalidationInterval = setInterval(async () => {
        // Không trigger nếu đang render hoặc không ở trang booking
        try {
          const response = await fetch(`${API_BASE_URL}/api/cache/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenant_id: TENANT_ID, timestamp: lastServerInvalidationTime })
          });

          if (response.ok) {
            const result = await response.json();
            if (result.invalidated && result.lastInvalidation > lastServerInvalidationTime) {
              console.log('🔄 Admin xác nhận booking — đang làm mới time slots...');
              lastServerInvalidationTime = result.lastInvalidation;
              cachedData = null;
              dataLoadTime = null;

              if (document.getElementById('page-booking')?.classList.contains('active')) {
                setTimeout(() => updateTimeSlots(), 300);
              }
            }
          }
        } catch (error) {
          // silent fail
        }
      }, 3000);
    }

    // Khởi động listener khi trang tải
    document.addEventListener('DOMContentLoaded', startCacheInvalidationListener);

    // ===== API FUNCTIONS =====

    async function loadFieldsFromAPI() {
      try { return await fetchFromAPI(`/api/fields/${TENANT_ID}`) || []; }
      catch (e) { console.error('Error loading fields:', e); return []; }
    }

    async function loadBookingsFromAPI() {
      try { return await fetchFromAPI(`/api/bookings/tenant/${TENANT_ID}`) || []; }
      catch (e) { console.error('Error loading bookings:', e); return []; }
    }

    async function loadStaffFromAPI() {
      try { return await fetchFromAPI(`/api/staff/tenant/${TENANT_ID}`) || []; }
      catch (e) { console.error('Error loading staff:', e); return []; }
    }

    // ✅ Force reload bookings - bỏ qua cache
    async function forceReloadBookings() {
      try {
        const bookings = await loadBookingsFromAPI();
        if (cachedData) {
          cachedData.bookings = bookings;
          dataLoadTime = Date.now();
        }
        return bookings;
      } catch (e) {
        console.error('Error force reloading bookings:', e);
        return [];
      }
    }

    // ===== DATA LOADING =====
    async function fetchTenantSettings() {
      try { return await fetchFromAPI(`/api/tenants/${TENANT_ID}/settings`) || {}; }
      catch (e) { console.error('Error loading tenant settings:', e); return {}; }
    }

    let db = { fields: [], bookings: [], customers: [], staff: [] };

    async function loadDB() {
      const now = Date.now();
      if (cachedData && dataLoadTime && (now - dataLoadTime) < CACHE_DURATION) {
        db = cachedData; return db;
      }
      try {
        const [fields, bookings, staff, settings] = await Promise.all([
          loadFieldsFromAPI(), loadBookingsFromAPI(), loadStaffFromAPI(), fetchTenantSettings()
        ]);
        db = { fields, bookings, customers: [], staff };
        cachedData = db; dataLoadTime = now;
        
        // Apply theme right away
        if (!tenantSettings) {
          tenantSettings = settings;
          applyTenantTheme(settings);
        }
        
        return db;
      } catch (e) {
        console.error('Error loading DB:', e);
        if (cachedData) { db = cachedData; return db; }
        return { fields: [], bookings: [], customers: [], staff: [] };
      }
    }

    function applyTenantTheme(settings) {
      if (!settings || !settings.name) return;
      
      const navTexts = document.querySelectorAll('.nav-logo-text');
      navTexts.forEach(el => el.textContent = settings.name);
      
      const footBrand = document.querySelector('.footer-brand');
      if (footBrand) footBrand.textContent = settings.name;

      const footLinks = document.querySelectorAll('.footer-link');
      if (footLinks.length >= 8) {
        footLinks[4].textContent = `📞 ${settings.phone || 'Chưa cập nhật'}`;
        footLinks[5].textContent = `📧 ${settings.email || 'Chưa cập nhật'}`;
        footLinks[6].textContent = `📍 ${settings.address || 'Chưa cập nhật'}`;
        footLinks[7].textContent = `⏰ ${settings.open_time ? settings.open_time.substring(0,5) : '05:30'} – ${settings.close_time ? settings.close_time.substring(0,5) : '22:30'} hàng ngày`;
      }

      const footDesc = document.getElementById('footer-desc');
      if (footDesc && settings.address) {
        footDesc.textContent = `Hệ thống sân bóng đá chuyên nghiệp tại ${settings.address}. Đặt sân online nhanh chóng, giá cả hợp lý.`;
      }
      
      document.title = `${settings.name} – Đặt sân bóng đá online`;
      
      const heroTitle = document.querySelector('.hero-title');
      if (heroTitle) heroTitle.textContent = `⚽ Chào mừng đến ${settings.name} ⚽`;
      
      const pageHeroTitle = document.querySelector('.page-hero h1');
      if (pageHeroTitle) pageHeroTitle.textContent = `⚽ Các sân của ${settings.name}`;

      // Dynamic Hero Banner
      if (settings.hero_banner) {
        document.documentElement.style.setProperty('--hero-bg-image', `url('${settings.hero_banner}')`);
      }

      // Dynamic Logo
      if (settings.logo) {
        const logoIcon = document.querySelector('.nav-logo-icon');
        if (logoIcon) {
          if (settings.logo.startsWith('http') || settings.logo.startsWith('/') || settings.logo.startsWith('data:')) {
            logoIcon.style.backgroundImage = `url('${settings.logo}')`;
            logoIcon.textContent = ''; // Xóa icon quả bóng nếu dùng logo ảnh
          } else {
            logoIcon.textContent = settings.logo;
            logoIcon.style.backgroundImage = 'none';
          }
        }
      }
    }

    let currentBooking = { field_id: '', date: '', duration: 0, staff: '', start_time: '' };

    // ===== UTILITY =====
    /**
     * ✅ FIX: Chuẩn hóa field type → trả về số '5', '7', '11'
     * Hỗ trợ input: '5', '5v5', '7', '7v7', '11', '11v11'
     */
    function normalizeFieldType(type) {
      if (!type) return 'default';
      const str = String(type).toLowerCase().trim();
      if (str.startsWith('5')) return '5';
      if (str.startsWith('7')) return '7';
      if (str.startsWith('11')) return '11';
      return 'default';
    }

    function getFieldTypeName(type) {
      const n = normalizeFieldType(type);
      const map = { '5': 'Sân 5 người', '7': 'Sân 7 người', '11': 'Sân 11 người', 'default': 'Sân bóng' };
      return map[n] || `Sân ${type}`;
    }


    function isTimeSlotConflicting(booking, fieldId, date, startTime, duration, statuses = ['confirmed', 'pending', 'completed']) {
      if (!statuses.includes(booking.status)) return false;
      if (booking.tenant_id !== TENANT_ID || booking.field_id !== fieldId) return false;
      const bookingDate = normalizeBookingDate(booking.date);
      if (bookingDate !== date) return false;

      const bookingStart = booking.start_time.substring(0, 5);
      const bookingEnd = booking.end_time.substring(0, 5);
      const endTime = calculateEndTime(startTime, duration);

      return (startTime >= bookingStart && startTime < bookingEnd) ||
        (endTime > bookingStart && endTime <= bookingEnd) ||
        (startTime <= bookingStart && endTime >= bookingEnd);
    }

    // ===== FIELD CARD HTML =====
    function buildFieldCard(f, index, options = {}) {
      const { showBookBtn = true, animate = true } = options;
      const typeName = getFieldTypeName(f.type);
      const typeClass = normalizeFieldType(f.type); // '5', '7', '11', hoặc 'default'
      const isAvailable = f.status === 'available';

      const statusBadge = isAvailable
        ? `<span class="badge badge-green">${typeName}</span>`
        : `<span class="badge" style="background:#fee2e2;color:#b91c1c;">Bảo trì</span>`;

      const bookAction = isAvailable
        ? `showPage('booking');setTimeout(()=>{document.getElementById('bk-field').value='${f.id}';updateTimeSlots()},100)`
        : `alert('Sân này đang bảo trì!')`;

      const animStyle = animate ? `animation: fadeInUp 0.5s ease-out ${index * 0.08}s both;` : '';
      const fieldImageStyle = f.image ? `background-image: url('${f.image}'); background-size: cover; background-position: center;` : '';

      return `
    <div class="field-card field-item" data-type="${typeClass}"
         onclick="showFieldDetail('${f.id}')" style="${animStyle}">
      <!-- ✅ Tùy chỉnh ảnh riêng nếu có, nếu không dùng class theo loại -->
      <div class="field-img type-${typeClass}" style="${fieldImageStyle}">
        <div class="field-img-badge">${statusBadge}</div>
      </div>
      <div class="field-body">
        <div class="field-name">${f.name}</div>
        <div class="field-type">${typeName}</div>
        <div class="field-features">
          ${(() => {
            const ams = typeof f.amenities === 'string' ? f.amenities.split(',').map(a => a.trim()).filter(a => a) : (f.amenities || []);
            return ams.slice(0, 3).map(a => `<span class="field-feat">${a}</span>`).join('') + (ams.length > 3 ? `<span class="field-feat">+${ams.length - 3}</span>` : '');
          })()}
        </div>
        <div class="field-bottom">
          <div>
            <div class="field-price">${formatPrice(f.price_per_hour)} ₫</div>
            <div class="field-price-sub">/giờ</div>
          </div>
          ${showBookBtn ? `
            <button class="btn-book"
              ${!isAvailable ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}
              onclick="event.stopPropagation();${bookAction}">
              ${isAvailable ? 'Đặt ngay' : 'Bảo trì'}
            </button>` : ''}
        </div>
      </div>
    </div>
  `;
    }

    // ===== RENDER FIELDS =====
    async function renderHomeFields() {
      const container = document.getElementById('home-fields');
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)"><div class="loading-spinner">⚽</div><div style="margin-top:10px">Đang tải từ server...</div></div>';
      try {
        const db = await loadDB();
        const list = (db.fields || [])
          .filter(f => f.tenant_id === TENANT_ID && f.status === 'available')
          .sort((a, b) => (a.price_per_hour || 0) - (b.price_per_hour || 0))
          .slice(0, 3);

        if (!list.length) {
          container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">⚽ Hiện tại không có sân nào khả dụng.</div>';
          return;
        }
        container.innerHTML = list.map((f, i) => buildFieldCard(f, i)).join('');
      } catch (e) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red)">❌ Lỗi tải dữ liệu. Vui lòng tải lại trang!</div>';
      }
    }

    async function renderAllFields() {
      const container = document.getElementById('all-fields');
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">🔄 Đang tải...</div>';
      try {
        const db = await loadDB();
        const list = (db.fields || [])
          .filter(f => f.tenant_id === TENANT_ID)
          .sort((a, b) => {
            if (a.status === 'available' && b.status !== 'available') return -1;
            if (a.status !== 'available' && b.status === 'available') return 1;
            return (a.price_per_hour || 0) - (b.price_per_hour || 0);
          });

        if (!list.length) {
          container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">⚽ Không tìm thấy sân nào.</div>';
          return;
        }
        container.innerHTML = list.map((f, i) => buildFieldCard(f, i)).join('');
      } catch (e) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red)">❌ Lỗi tải dữ liệu. Vui lòng tải lại trang!</div>';
      }
    }

    function filterFields(type, btn) {
      document.querySelectorAll('.field-filter-btn').forEach(b => {
        b.classList.remove('active-filter');
        b.style.background = ''; b.style.color = '';
      });
      btn.classList.add('active-filter');

      document.querySelectorAll('.field-item').forEach((el, i) => {
        const t = el.getAttribute('data-type');
        // type từ button là '5','7','11' hoặc 'all'
        const show = type === 'all' || t === type;
        el.style.display = show ? 'block' : 'none';
        if (show) el.style.animation = `slideIn 0.3s ease-out ${i * 0.04}s both`;
      });
    }

    // ===== FIELD DETAIL =====
    async function showFieldDetail(fieldId) {
      const db = await loadDB();
      const field = db.fields?.find(f => f.id === fieldId);
      if (!field) return;
      const typeClass = normalizeFieldType(field.type);
      const fieldImageStyle = field.image ? `background-image: url('${field.image}'); background-size: cover; background-position: center;` : '';
      const content = document.getElementById('field-detail-content');
      content.innerHTML = `
    <div style="padding:40px 5%;max-width:800px;margin:0 auto;">
      <div onclick="showPage('fields')" style="cursor:pointer;color:var(--green);font-weight:600;margin-bottom:20px;">← Quay lại danh sách sân</div>
      <!-- ✅ Field detail hero image -->
      <div class="field-img type-${typeClass}" style="min-height:220px;border-radius:16px;margin-bottom:32px;font-size:64px; ${fieldImageStyle}">
      </div>
      <div style="font-size:28px;font-weight:800;color:var(--green);margin-bottom:8px;">${field.name}</div>
      <div style="color:var(--text2);margin-bottom:24px;">${getFieldTypeName(field.type)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px;">
        <div style="background:var(--bg2);padding:20px;border-radius:12px;">
          <h3 style="margin-bottom:16px;">Thông tin chung</h3>
          <div style="margin-bottom:8px;">💰 Giá: ${formatPrice(field.price_per_hour)} ₫/giờ</div>
          <div style="margin-bottom:8px;">⚽ Loại: ${getFieldTypeName(field.type)}</div>
          <div>📍 Trạng thái: ${field.status === 'available' ? '✅ Sẵn sàng' : '🔧 Bảo trì'}</div>
        </div>
        <div style="background:var(--bg2);padding:20px;border-radius:12px;">
          <h3 style="margin-bottom:16px;">Tiện nghi</h3>
          ${(() => {
            const ams = typeof field.amenities === 'string' ? field.amenities.split(',').map(a => a.trim()).filter(a => a) : (field.amenities || []);
            return ams.map(a => `<div style="margin-bottom:6px;">✓ ${a}</div>`).join('') || '<div>(Chưa có thông tin)</div>';
          })()}
        </div>
      </div>
      <div style="text-align:center;">
        <button class="btn btn-primary" style="padding:16px 48px;font-size:16px;"
          onclick="showPage('booking');setTimeout(()=>{document.getElementById('bk-field').value='${fieldId}';updateTimeSlots()},100)">
          📅 Đặt sân này
        </button>
      </div>
    </div>
  `;
      showPage('field-detail');
    }

    // ===== BOOKING =====

    // ===== MULTI-STEP NAVIGATION =====
    function goToStep(n) {
      [1, 2, 3].forEach(i => {
        const panel = document.getElementById(`booking-step-${i}`);
        const stepEl = document.getElementById(`step${i}`);
        if (panel) panel.style.display = (i === n) ? '' : 'none';
        if (stepEl) {
          stepEl.classList.remove('active', 'done');
          if (i === n) stepEl.classList.add('active');
          if (i < n) stepEl.classList.add('done');
        }
      });
      // Update step lines
      const line1 = document.getElementById('step-line-1');
      const line2 = document.getElementById('step-line-2');
      if (line1) line1.classList.toggle('done', n > 1);
      if (line2) line2.classList.toggle('done', n > 2);
      // Scroll to top of booking section
      document.getElementById('page-booking')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function goToStep2() {
      const fieldId = document.getElementById('bk-field').value;
      const date = document.getElementById('bk-date').value;
      const duration = parseFloat(document.getElementById('bk-duration').value);
      const staff = document.getElementById('bk-staff').value;
      const startTime = currentBooking.start_time;

      if (!fieldId) return alert('⚠️ Vui lòng chọn sân!');
      if (!date) return alert('⚠️ Vui lòng chọn ngày chơi!');
      if (!duration || isNaN(duration)) return alert('⚠️ Vui lòng chọn số giờ thuê!');
      if (!staff) return alert('⚠️ Vui lòng chọn nhân viên hỗ trợ!');
      if (!startTime) return alert('⚠️ Vui lòng chọn giờ bắt đầu!');

      goToStep(2);
    }

    function goToStep3() {
      const name = document.getElementById('bk-name').value.trim();
      const phone = document.getElementById('bk-phone').value.trim();

      if (!name) return alert('⚠️ Vui lòng nhập họ và tên!');
      if (!phone) return alert('⚠️ Vui lòng nhập số điện thoại!');
      if (!/^0\d{9}$/.test(phone)) return alert('⚠️ Số điện thoại không hợp lệ (10 chữ số bắt đầu bằng 0)!');

      // Render summary
      const db2 = window._latestDB || {};
      const fieldId = document.getElementById('bk-field').value;
      const field = (db2.fields || []).find(f => f.id === fieldId) || {};
      const fieldName = field.name || document.getElementById('bk-field').selectedOptions[0]?.text || fieldId;
      const date = document.getElementById('bk-date').value;
      const duration = document.getElementById('bk-duration').value;
      const staff = document.getElementById('bk-staff').value;
      const startTime = currentBooking.start_time;
      const endTime = calculateEndTime(startTime, parseFloat(duration));
      const price = currentBooking.price || 0;

      const rows = [
        ['⚽ Sân', fieldName],
        ['📅 Ngày chơi', date],
        ['⏰ Khung giờ', `${startTime} → ${endTime}`],
        ['⏱ Thời lượng', `${duration} giờ`],
        ['👤 Nhân viên', staff],
        ['👤 Họ và tên', name],
        ['📞 SĐT', phone],
        ['📝 Ghi chú', document.getElementById('bk-note').value || '(Không có)'],
        ['💰 Tổng tiền', `<strong style="color:var(--green);font-size:16px">${price.toLocaleString('vi-VN')} ₫</strong>`],
      ];

      document.getElementById('confirm-summary').innerHTML = rows.map(([label, val]) =>
        `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
       <span style="color:var(--text2)">${label}</span>
       <span style="font-weight:600;text-align:right">${val}</span>
     </div>`
      ).join('');

      goToStep(3);
    }

    async function renderBookingForm() {
      const db = await loadDB();
      window._latestDB = db; // cache for goToStep3
      goToStep(1); // always start from step 1

      // ✅ Thiết lập ngày tối thiểu là hôm nay
      const dateInput = document.getElementById('bk-date');
      const todayStr = normalizeBookingDate(new Date()); 
      dateInput.min = todayStr;
      if (!dateInput.value || dateInput.value < todayStr) {
        dateInput.value = todayStr;
      }

      const select = document.getElementById('bk-field');
      select.innerHTML = '<option value="">-- Chọn sân --</option>';
      (db.fields || [])
        .filter(f => f.tenant_id === TENANT_ID && f.status === 'available')
        .forEach(f => {
          select.innerHTML += `<option value="${f.id}">${f.name} - ${formatPrice(f.price_per_hour)} ₫/giờ</option>`;
        });

      const staffSelect = document.getElementById('bk-staff');
      staffSelect.innerHTML = '<option value="">-- Chọn nhân viên hỗ trợ --</option><option value="Không yêu cầu">Không yêu cầu</option>';
      (db.staff || []).forEach(s => {
        staffSelect.innerHTML += `<option value="${s.name} - ${s.phone}">${s.name} - ${s.phone}</option>`;
      });

      // Load dữ liệu đã chọn từ localStorage
      const savedBooking = localStorage.getItem('currentBooking');
      if (savedBooking) {
        try {
          const booking = JSON.parse(savedBooking);
          if (booking.field_id) document.getElementById('bk-field').value = booking.field_id;
          if (booking.date) document.getElementById('bk-date').value = booking.date;
          if (booking.duration) document.getElementById('bk-duration').value = booking.duration;
          if (booking.staff) document.getElementById('bk-staff').value = booking.staff;
          currentBooking = booking;
        } catch (e) {
          console.warn('Lỗi load currentBooking từ localStorage:', e);
        }
      }

      // Cập nhật time slots ngay sau khi load
      setTimeout(() => updateTimeSlots(), 100);
    }

    async function updateTimeSlots() {
      console.log('🔄 updateTimeSlots called - Force reloading data');
      const fieldId = document.getElementById('bk-field').value;
      const duration = parseFloat(document.getElementById('bk-duration').value);
      const staff = document.getElementById('bk-staff').value;
      const date = document.getElementById('bk-date').value;

      if (!fieldId) {
        document.getElementById('time-slots').innerHTML = '<p style="color:var(--text3);font-size:13px;grid-column:1/-1">Chọn sân để xem giờ trống</p>';
        currentBooking = { field_id: '', date: '', duration: 0, staff: '', start_time: '' };
        return;
      }

      if (!duration || isNaN(duration)) {
        document.getElementById('time-slots').innerHTML = '<p style="color:var(--text3);font-size:13px;grid-column:1/-1">⚠️ Vui lòng chọn số giờ thuê trước</p>';
        currentBooking.start_time = '';
        return;
      }

      if (!staff) {
        document.getElementById('time-slots').innerHTML = '<p style="color:var(--text3);font-size:13px;grid-column:1/-1">⚠️ Vui lòng chọn nhân viên hỗ trợ trước</p>';
        currentBooking.start_time = '';
        return;
      }

      if (currentBooking.field_id !== fieldId || currentBooking.date !== date || currentBooking.duration !== duration || currentBooking.staff !== staff) {
        currentBooking = { field_id: fieldId, date, duration, staff, start_time: '' };
      }

      currentBooking.field_id = fieldId;
      currentBooking.date = date;
      currentBooking.duration = duration;
      currentBooking.staff = staff;

      console.log('📡 Force reloading bookings from server...');
      const bookings = await forceReloadBookings();
      console.log('📋 Loaded bookings:', bookings.length, 'items');

      const db = await loadDB();
      const field = db.fields?.find(f => f.id === fieldId);

      // ===== Hàm chuẩn hóa date (YYYY-MM-DD) xử lý đúng timezone local =====
      const formatDateYYYYMMDD = (d) => {
        if (!d) return '';
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return typeof d === 'string' ? d.substring(0, 10) : '';

        // Nếu là chuỗi ISO có 'T' hoặc Date object -> lấy local date components
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const normalizeDate = (d) => {
        if (!d) return '';
        if (typeof d === 'string' && !d.includes('T')) return d.substring(0, 10);
        return formatDateYYYYMMDD(d);
      };

      const isConflictingWithBooking = (booking, slotStart) => {
        if (!['confirmed', 'pending', 'completed'].includes(booking.status)) return false;
        if (booking.tenant_id !== TENANT_ID || booking.field_id !== fieldId) return false;
        const bookingDate = normalizeDate(booking.date);
        if (bookingDate !== date) return false;

        const bookingStart = booking.start_time.substring(0, 5);
        const bookingEnd = booking.end_time.substring(0, 5);
        const slotEnd = calculateEndTime(slotStart, duration);

        return (
          (slotStart >= bookingStart && slotStart < bookingEnd) ||
          (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
          (slotStart <= bookingStart && slotEnd >= bookingEnd)
        );
      };

      // ===== DEBUG: In chi tiết booking để kiểm tra format =====
      if (bookings.length > 0) {
        const b = bookings[0];
        console.log('🔬 Booking debug:', {
          id: b.id,
          field_id: b.field_id,
          tenant_id: b.tenant_id,
          date: b.date,
          date_type: typeof b.date,
          date_normalized: normalizeDate(b.date),
          status: b.status,
          start_time: b.start_time,
          end_time: b.end_time,
        });
        console.log('🔬 Comparing with → fieldId:', fieldId, '| tenant:', TENANT_ID, '| date:', date);
        console.log('🔬 field_id match:', b.field_id === fieldId, '| tenant match:', b.tenant_id === TENANT_ID);
      }

      const slots = generateTimeSlots();
      
      // ✅ Lọc các khung giờ đã qua nếu là ngày hôm nay
      const now = new Date();
      const todayStr = formatDateYYYYMMDD(now);
      const currentTimeMins = now.getHours() * 60 + now.getMinutes();
      
      const filteredSlots = slots.filter(time => {
        if (date > todayStr) return true;
        const [h, m] = time.split(':').map(Number);
        const slotMins = h * 60 + m;
        // Cho phép đặt từ giờ hiện tại cộng thêm ít nhất 15 phút buffer
        return slotMins >= currentTimeMins + 15; 
      });

      console.log('🔍 Checking slots for field:', fieldId, 'date:', date, 'duration:', duration);

      // Nếu slot đã chọn không còn khả dụng (do quá giờ), xóa selection
      if (currentBooking.start_time && !filteredSlots.includes(currentBooking.start_time)) {
        currentBooking.start_time = '';
      }

      document.getElementById('time-slots').innerHTML = filteredSlots.map((time, index) => {
        const conflictingBooking = bookings.find(b => isConflictingWithBooking(b, time));
        const selected = currentBooking.start_time === time;

        let statusClass = '';
        let onclickAction = '';
        let statusIcon = '';
        let tooltip = '';

        if (conflictingBooking) {
          const s = conflictingBooking.status;
          statusClass = 'booked ' + (s === 'pending' ? 'pending' : 'confirmed');
          const statusText = s === 'pending' ? 'Chờ xác nhận' : 'Đã xác nhận';
          tooltip = `title="${statusText} bởi ${(conflictingBooking.customer_name || 'khách hàng')}"`;
          
          if (s === 'pending') {
            statusIcon = '<span style="position:absolute;top:2px;right:2px;font-size:12px;">⏳</span>';
          } else {
            // Bao gồm confirmed và completed
            statusIcon = '<span style="position:absolute;top:2px;right:2px;font-size:12px;">🔒</span>';
          }
        } else if (selected) {
          statusClass = 'selected';
          tooltip = 'title="Đã chọn"';
          statusIcon = '<span style="position:absolute;top:2px;right:2px;font-size:12px;">✓</span>';
        } else {
          statusClass = '';
          onclickAction = `setTimeSlot('${time}', event)`;
          tooltip = 'title="Còn trống"';
          statusIcon = '<span style="position:absolute;top:2px;right:2px;font-size:12px;opacity:0;">✓</span>';
        }

        return `<div class="time-slot ${statusClass}" ${onclickAction ? `onclick="${onclickAction}"` : ''} ${tooltip} style="animation: fadeIn 0.3s ease-out ${index * 0.05}s both;">
      ${time}
      ${statusIcon}
    </div>`;
      }).join('');

      // Lưu currentBooking vào localStorage
      localStorage.setItem('currentBooking', JSON.stringify(currentBooking));

      calcPrice();
    }

    // ✅ Hàm highlight các slot có conflict
    function highlightConflictingSlots(startTime, endTime) {
      document.querySelectorAll('.time-slot').forEach(slot => {
        const slotTime = slot.textContent.trim();

        // Kiểm tra xem slot này có conflict không
        const isConflicting = (slotTime >= startTime && slotTime < endTime) ||
          (slotTime > startTime && slotTime <= endTime) ||
          (slotTime <= startTime && slotTime >= endTime);

        if (isConflicting && !slot.classList.contains('booked')) {
          // Thêm class conflict với hiệu ứng đặc biệt
          slot.classList.add('conflict');
          slot.style.animation = 'shake 0.5s ease-in-out, pulse 1s ease-in-out 2';

          // Xóa hiệu ứng sau 3 giây
          setTimeout(() => {
            slot.classList.remove('conflict');
            slot.style.animation = '';
          }, 3000);
        }
      });
    }

    // ===== HELPER: Tính giờ kết thúc từ giờ bắt đầu + số giờ =====
    function calculateEndTime(startTime, durationHours) {
      const [h, m] = startTime.split(':').map(Number);
      const totalMins = h * 60 + m + Math.round(durationHours * 60);
      const endH = Math.floor(totalMins / 60);
      const endM = totalMins % 60;
      return (endH < 10 ? '0' + endH : endH) + ':' + (endM < 10 ? '0' + endM : endM);
    }

    // ===== HELPER: Chuẩn hóa ngày từ MySQL về YYYY-MM-DD (xử lý đúng timezone local) =====
    function normalizeBookingDate(d) {
      if (!d) return '';
      if (typeof d === 'string' && !d.includes('T')) return d.substring(0, 10);

      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return '';

      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    function generateTimeSlots() {
      const slots = [];
      for (let h = 5; h <= 22; h++) {
        slots.push((h < 10 ? '0' + h : h) + ':00');
        slots.push((h < 10 ? '0' + h : h) + ':30');
      }
      return slots;
    }

    async function setTimeSlot(time, event) {
      console.log(`🔧 setTimeSlot called with time: ${time}, current: ${currentBooking.start_time}`);

      const duration = parseFloat(document.getElementById('bk-duration').value);
      const staff = document.getElementById('bk-staff').value;
      const fieldId = document.getElementById('bk-field').value;
      const date = document.getElementById('bk-date').value;

      if (!duration || isNaN(duration)) {
        alert('⚠️ Vui lòng chọn số giờ thuê trước!');
        document.getElementById('bk-duration').focus();
        return;
      }

      if (!staff) {
        alert('⚠️ Vui lòng chọn nhân viên hỗ trợ trước!');
        document.getElementById('bk-staff').focus();
        return;
      }

      const slotElement = event?.currentTarget || event?.target;
      if (!slotElement || !(slotElement instanceof HTMLElement)) {
        console.warn('⚠️ Không tìm thấy slot element');
        return;
      }

      const bookingsForCheck = await forceReloadBookings();

      // Kiểm tra conflict inline (xử lý đúng timezone)
      const normalizeDate = (d) => normalizeBookingDate(d);
      const endTime = calculateEndTime(time, duration);
      const conflictingBookings = bookingsForCheck.filter(b => {
        if (!['confirmed', 'pending'].includes(b.status)) return false;
        if (b.tenant_id !== TENANT_ID || b.field_id !== fieldId) return false;
        if (normalizeDate(b.date) !== date) return false;
        const bStart = b.start_time.substring(0, 5);
        const bEnd = b.end_time.substring(0, 5);
        return (
          (time >= bStart && time < bEnd) ||
          (endTime > bStart && endTime <= bEnd) ||
          (time <= bStart && endTime >= bEnd)
        );
      });

      console.log('🔍 setTimeSlot conflict candidate bookings', conflictingBookings);

      if (conflictingBookings.length > 0) {
        alert('⚠️ Khung giờ này đã bị đặt hoặc đang chờ xác nhận. Vui lòng chọn khung giờ khác.');
        updateTimeSlots();
        return;
      }

      if (slotElement.classList.contains('booked') || slotElement.classList.contains('pending') || slotElement.classList.contains('confirmed')) {
        slotElement.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => { slotElement.style.animation = ''; }, 500);
        return;
      }

      proceedWithSlotSelection(time, slotElement);
    }

    function proceedWithSlotSelection(time, slotElement) {
      // Nếu đang chọn slot khác, xóa lựa chọn cũ
      if (currentBooking.start_time && currentBooking.start_time !== time) {
        console.log(`🔧 Clearing previous selection: ${currentBooking.start_time}`);
        document.querySelectorAll('.time-slot.selected').forEach(s => {
          s.classList.remove('selected');
          // ✅ Tìm tất cả các span icon và ẩn chúng
          const icons = s.querySelectorAll('span');
          icons.forEach(icon => {
            if (icon.textContent.includes('✓')) {
              icon.style.opacity = '0';
            }
          });
        });
      }

      // Chọn slot mới
      console.log(`🔧 Selecting new slot: ${time}`);
      slotElement.classList.add('selected');

      // Hiện icon ✓ với hiệu ứng fade in
      const icons = slotElement.querySelectorAll('span');
      const selectedIcon = Array.from(icons).find(icon => icon.textContent.includes('✓'));
      if (selectedIcon) {
        selectedIcon.style.opacity = '1';
        selectedIcon.style.transition = 'opacity 0.3s ease';
      }

      // Cập nhật current booking
      currentBooking.start_time = time;

      // Tính giá với hiệu ứng
      calcPrice();

      // Hiệu ứng pulse nhẹ khi chọn
      slotElement.style.animation = 'pulse 0.6s ease-out';
      setTimeout(() => {
        slotElement.style.animation = 'pulse 2s infinite';
      }, 600);
    }

    async function calcPrice() {
      const fieldId = document.getElementById('bk-field').value;
      const duration = parseFloat(document.getElementById('bk-duration').value);
      if (!fieldId || !currentBooking.start_time) {
        document.getElementById('bk-price').textContent = '0 ₫';
        document.getElementById('bk-price-detail').textContent = 'Chọn sân và giờ để xem giá';
        return;
      }
      const db = await loadDB();
      const field = db.fields?.find(f => f.id === fieldId);
      const price = (field?.price_per_hour || 0) * duration;
      document.getElementById('bk-price').textContent = price.toLocaleString('vi-VN') + ' ₫';
      document.getElementById('bk-price-detail').textContent = `${duration} giờ × ${formatPrice(field?.price_per_hour)} ₫`;
      currentBooking.price = price;
    }

    async function submitBooking() {
      const name = document.getElementById('bk-name').value.trim();
      const phone = document.getElementById('bk-phone').value.trim();
      const fieldId = document.getElementById('bk-field').value;
      const date = document.getElementById('bk-date').value;
      const startTime = currentBooking.start_time;
      const duration = parseFloat(document.getElementById('bk-duration').value);

      if (!name || !phone || !fieldId || !startTime) { alert('⚠️ Vui lòng điền đầy đủ thông tin'); return; }
      if (!/^0\d{9}$/.test(phone)) { alert('⚠️ Số điện thoại không hợp lệ'); return; }

      try {
        // ✅ Kiểm tra xung đột thời gian TRƯỚC KHI gửi booking
        console.log('🔍 Checking time conflict before submission...');
        const db = await loadDB();
        const bookings = await forceReloadBookings(); // Force reload để có dữ liệu mới nhất

        // Kiểm tra xung đột với bookings hiện có
        const calculatedEndTime = calculateEndTime(startTime, duration);

        const hasConflict = bookings.some(booking => {
          if (booking.tenant_id !== TENANT_ID || booking.field_id !== fieldId) return false;
          if (normalizeBookingDate(booking.date) !== date) return false;

          // ✅ Kiểm tra cả confirmed, pending và completed để đồng bộ với server
          if (!['confirmed', 'pending', 'completed'].includes(booking.status)) return false;

          const bStart = booking.start_time.substring(0, 5);
          const bEnd = booking.end_time.substring(0, 5);
          return (
            (startTime >= bStart && startTime < bEnd) ||
            (calculatedEndTime > bStart && calculatedEndTime <= bEnd) ||
            (startTime <= bStart && calculatedEndTime >= bEnd)
          );
        });

        if (hasConflict) {
          alert('⚠️ Khung giờ này đã có người đặt hoặc đang chờ xác nhận. Vui lòng chọn giờ khác!');
          currentBooking.start_time = '';
          updateTimeSlots();
          return;
        }

        // ✅ Không có xung đột, tiếp tục đặt sân
        console.log('✅ No conflict detected, proceeding with booking...');

        const endTime = calculateEndTime(startTime, duration);
        const bookingId = 'bk' + Math.random().toString(36).substr(2, 9);
        const field = db.fields?.find(f => f.id === fieldId);

        const booking = {
          id: bookingId,
          tenant_id: TENANT_ID,
          field_id: fieldId,
          customer_name: name,
          customer_phone: phone,
          customer_email: '',
          date, start_time: startTime, end_time: endTime, duration,
          total_price: currentBooking.price,
          status: 'pending',
          payment_method: 'cash',
          paid: false,
          qr_code: 'QR-' + bookingId.toUpperCase(),
          note: (document.getElementById('bk-note').value.trim() + ' | Staff: ' + currentBooking.staff).trim(),
          fcm_token: localStorage.getItem('ff_fcm_token') || ''
        };

        console.log('📤 Sending booking to server:', booking);

        const response = await fetch(`${API_BASE_URL}/api/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(booking)
        });

        if (response.ok) {
          // Lưu id khách hàng để dùng cho thông báo sau này
          const bookingResult = await response.json();
          if (bookingResult.customer_id) {
            localStorage.setItem('ff_customer_id', bookingResult.customer_id);
          }
          
          // ✅ 清除缓存以确保数据同步
          cachedData = null;
          dataLoadTime = null;

          // ✅ 重新加载数据以获取最新的预订信息
          const freshDB = await loadDB();

          if (!freshDB.bookings) freshDB.bookings = [];
          freshDB.bookings.push(booking);

          // ✅ 更新缓存
          cachedData = freshDB;
          dataLoadTime = Date.now();

          localStorage.setItem('lastBooking', JSON.stringify(booking));
          showResultPage(booking, field);

          // ✅ 如果在同一页面，刷新时间槽显示
          if (document.getElementById('page-booking').classList.contains('active')) {
            setTimeout(() => updateTimeSlots(), 100);
          }
        } else if (response.status === 409) {
          const error = await response.json();
          console.log('⚠️ Server conflict:', error);
          alert('⚠️ Khung giờ này vừa có người đặt. Hệ thống đang cập nhật lại lịch...');
          // Refresh time slots để hiển thị đúng trạng thái từ server
          updateTimeSlots();
        } else {
          const err = await response.json();
          alert(`❌ Lỗi đặt sân: ${err.message || 'Vui lòng thử lại'}`);
        }
      } catch (e) {
        console.error('submitBooking error:', e);
        alert('❌ Lỗi kết nối đến server. Vui lòng thử lại!');
      }
    }

    // ===== RESULT PAGE =====
    function showResultPage(booking, field) {
      // Lưu booking vào global variable để các hàm khác có thể truy cập
      window.currentBookingResult = { booking, field };

      document.getElementById('result-detail').innerHTML = `
    <div class="result-row"><span class="result-row-label">Mã đặt sân</span><span class="result-row-val" style="font-family:var(--mono);color:var(--green);font-weight:800;">${booking.qr_code}</span></div>
    <div class="result-row"><span class="result-row-label">Sân bóng</span><span class="result-row-val">${field?.name || 'N/A'}</span></div>
    <div class="result-row"><span class="result-row-label">Ngày</span><span class="result-row-val">${new Date(booking.date).toLocaleDateString('vi-VN')}</span></div>
    <div class="result-row"><span class="result-row-label">Giờ</span><span class="result-row-val">${booking.start_time} – ${booking.end_time}</span></div>
    <div class="result-row"><span class="result-row-label">Khách hàng</span><span class="result-row-val">${booking.customer_name}</span></div>
    <div class="result-row"><span class="result-row-label">Tổng tiền</span><span class="result-row-val">${booking.total_price.toLocaleString('vi-VN')} ₫</span></div>
  `;
      showPage('result');

      setTimeout(() => {
        const container = document.getElementById('result-qr');
        const textContainer = document.getElementById('qr-code-text');
        if (!container) return;
        container.innerHTML = '';
        if (textContainer) textContainer.textContent = booking.qr_code;

        if (typeof QRCode !== 'undefined') {
          try {
            // Chỉ tạo một QR duy nhất
            new QRCode(container, {
              text: booking.qr_code,
              width: 200, height: 200,
              colorDark: '#16a34a', colorLight: '#ffffff'
            });
          } catch (e) {
            qrFallback(booking.qr_code, container);
          }
        } else {
          qrFallback(booking.qr_code, container);
        }
      }, 200);
    }

    // ✅ Hàm sao chép mã đặt sân
    function copyBookingCode() {
      const booking = window.currentBookingResult?.booking;
      if (!booking) {
        alert('❌ Không tìm thấy thông tin đặt sân');
        return;
      }

      const code = booking.qr_code;

      // Thử sử dụng Clipboard API mới
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(code).then(() => {
          alert('✅ Đã sao chép mã đặt sân: ' + code);
        }).catch(err => {
          fallbackCopyText(code);
        });
      } else {
        // Fallback cho các trình duyệt cũ
        fallbackCopyText(code);
      }
    }

    // ✅ Fallback copy cho các trình duyệt cũ
    function fallbackCopyText(text) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        if (successful) {
          alert('✅ Đã sao chép mã đặt sân: ' + text);
        } else {
          alert('❌ Không thể sao chép mã');
        }
      } catch (err) {
        alert('❌ Lỗi khi sao chép mã');
      }

      document.body.removeChild(textArea);
    }

    // ✅ Hàm lưu QR hình ảnh
    function saveQRImage() {
      const booking = window.currentBookingResult?.booking;
      if (!booking) {
        alert('❌ Không tìm thấy thông tin đặt sân');
        return;
      }

      const qrContainer = document.getElementById('result-qr');
      if (!qrContainer) {
        alert('❌ Không tìm thấy mã QR');
        return;
      }

      // Tìm canvas hoặc img trong QR container
      const canvas = qrContainer.querySelector('canvas');
      const img = qrContainer.querySelector('img');

      if (canvas) {
        // Nếu là canvas, chuyển thành blob và tải về
        canvas.toBlob(function (blob) {
          const url = URL.createObjectURL(blob);
          downloadImage(url, `QR-${booking.qr_code}.png`);
        });
      } else if (img) {
        // Nếu là img, tải trực tiếp
        downloadImage(img.src, `QR-${booking.qr_code}.png`);
      } else {
        // Fallback: tạo ảnh từ nội dung QR
        createQRImageFallback(booking.qr_code);
      }
    }

    // ✅ Hàm tải ảnh
    function downloadImage(url, filename) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Dọn dẹp URL object nếu là blob
      if (url.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }

      alert('✅ Đã lưu mã QR: ' + filename);
    }

    // ✅ Fallback tạo QR ảnh nếu không có canvas/img
    function createQRImageFallback(qrCode) {
      // Tạo một canvas đơn giản với text
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');

      // Vẽ nền trắng
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 300, 300);

      // Vẽ border
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, 280, 280);

      // Vẽ text
      ctx.fillStyle = '#16a34a';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(qrCode, 150, 150);

      // Tải xuống
      canvas.toBlob(function (blob) {
        const url = URL.createObjectURL(blob);
        downloadImage(url, `QR-${qrCode}.png`);
      });
    }

    // ===== QR UTILS =====
    function copyQRCode(qrCode) {
      navigator.clipboard?.writeText(qrCode).then(() => showToast('✅ Đã sao chép: ' + qrCode))
        .catch(() => { /* fallback */ showToast('✅ Đã sao chép: ' + qrCode); });
    }
    function downloadQRCode(qrCode) {
      const canvas = document.querySelector('#result-qr canvas');
      if (canvas) {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `QR-${qrCode}.png`;
        a.click();
        showToast('✅ Đã tải mã QR!');
      } else {
        showToast('❌ Mã QR chưa sẵn sàng. Thử lại sau giây lát!');
      }
    }
    function shareQRCode(qrCode) {
      if (navigator.share) {
        navigator.share({ title: 'Mã QR VinhUniFootBall', text: `Mã QR: ${qrCode}`, url: window.location.href })
          .catch(() => copyQRCode(qrCode));
      } else { copyQRCode(qrCode); }
    }
    function printQRCode() { window.print(); }

    function showToast(msg) {
      const t = document.createElement('div');
      t.style.cssText = 'position:fixed;top:20px;right:20px;background:var(--green);color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;z-index:9999;animation:slideIn 0.3s ease-out;box-shadow:0 4px 12px rgba(0,0,0,.15);';
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(() => { t.style.animation = 'fadeOut 0.3s ease-out'; setTimeout(() => t.remove(), 300); }, 3000);
    }

    // ===== LOOKUP =====
    async function doLookup() {
      const input = document.getElementById('lookup-input').value.trim().toUpperCase();
      const resultsDiv = document.getElementById('lookup-results');
      if (!input) { resultsDiv.innerHTML = ''; return; }

      const db = await loadDB();
      const results = (db.bookings || []).filter(b =>
        b.tenant_id === TENANT_ID &&
        (b.customer_phone.includes(input) || b.qr_code.includes(input))
      );

      if (!results.length) {
        resultsDiv.innerHTML = '<p style="text-align:center;color:var(--text3);padding:20px">❌ Không tìm thấy lịch đặt sân nào</p>';
        return;
      }

      resultsDiv.innerHTML = results.map(b => {
        const field = db.fields?.find(f => f.id === b.field_id);
        const statusLabel = b.status === 'confirmed' ? '✅ Đã xác nhận' : b.status === 'pending' ? '⏳ Chờ xác nhận' : '✓ Hoàn thành';
        return `
      <div class="lookup-item">
        <div class="lookup-header">
          <div class="lookup-id">${b.qr_code}</div>
          <div style="font-size:12px;color:var(--text3)">${statusLabel}</div>
        </div>
        <div class="lookup-rows">
          <div><div class="lookup-label">Sân</div><div class="lookup-val">${field?.name || 'N/A'}</div></div>
          <div><div class="lookup-label">Ngày</div><div class="lookup-val">${new Date(b.date).toLocaleDateString('vi-VN')}</div></div>
          <div><div class="lookup-label">Giờ</div><div class="lookup-val">${b.start_time}–${b.end_time}</div></div>
          <div><div class="lookup-label">Khách</div><div class="lookup-val">${b.customer_name}</div></div>
          <div><div class="lookup-label">Giá</div><div class="lookup-val">${b.total_price.toLocaleString('vi-VN')} ₫</div></div>
          <div><div class="lookup-label">SĐT</div><div class="lookup-val">${b.customer_phone}</div></div>
        </div>
      </div>
    `;
      }).join('');
    }

    // ===== PAGE NAVIGATION =====
    async function showPage(page) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + page).classList.add('active');
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      document.getElementById('nl-' + page)?.classList.add('active');

      if (page === 'home') {
        await renderHomeFields();
      } else if (page === 'fields') {
        await renderAllFields();
      } else if (page === 'booking') {
        await renderBookingForm();
        currentBooking = { field_id: '', date: '', duration: 0, players: '', start_time: '' };
        // Refresh slots ngay để đồng bộ trạng thái mới nhất
        setTimeout(() => updateTimeSlots(), 50);
      }
      
      // Close mobile nav after clicking
      document.getElementById('nav-links')?.classList.remove('show');
    }

    function toggleNav() {
      document.getElementById('nav-links').classList.toggle('show');
    }

    // ===== INIT =====
    document.addEventListener('DOMContentLoaded', async () => {
      const homeContainer = document.getElementById('home-fields');
      const loadingOverlay = document.getElementById('page-loading-overlay');
      
      setTimeout(async () => {
        try {
          await loadDB();
          await renderHomeFields();
          // Ẩn loading overlay sau khi dữ liệu đã tải xong
          if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
          }
        } catch (e) {
          console.error('Init error:', e);
          if (homeContainer) homeContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red)">❌ Lỗi khởi tạo trang. Vui lòng tải lại!</div>';
          // Vẫn ẩn overlay ngay cả khi có lỗi để user thấy thông báo lỗi
          if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
          }
        }
      }, 200);

      flatpickr("#bk-date", {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d/m/Y",
        locale: "vn",
        defaultDate: new Date(),
        onChange: function(selectedDates, dateStr, instance) {
          if (typeof updateTimeSlots === 'function') updateTimeSlots();
        }
      });
    });
  

    // --- Chatbot Logic ---
    let chatHistory = [];
    let isChatOpen = false;

    function toggleChat() {
      isChatOpen = !isChatOpen;
      document.getElementById('chatbot-window').classList.toggle('active', isChatOpen);
      if (isChatOpen) document.getElementById('chat-input').focus();
    }

    async function sendChatMessage() {
      const input = document.getElementById('chat-input');
      const message = input.value.trim();
      if (!message) return;

      appendMessage('user', message);
      input.value = '';

      const thinkingId = 'thinking-' + Date.now();
      appendMessage('bot', '...', thinkingId);

      try {
        const response = await fetch(`${API_BASE_URL}/api/chatbot/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: TENANT_ID,
            message: message,
            history: chatHistory
          })
        });

        const data = await response.json();
        document.getElementById(thinkingId).remove();

        if (data.error) {
          appendMessage('bot', 'Xin lỗi, tôi gặp lỗi nhỏ. Bạn thử lại nhé!');
        } else {
          appendMessage('bot', data.text);
          if (data.booking) {
             appendBookingCard(data.booking);
          }
          chatHistory = data.history;
        }
      } catch (e) {
        document.getElementById(thinkingId).remove();
        appendMessage('bot', 'Lỗi kết nối máy chủ. Vui lòng kiểm tra internet!');
      }
    }

    function appendMessage(role, text, id) {
      const container = document.getElementById('chat-messages');
      const div = document.createElement('div');
      div.className = `msg msg-${role}`;
      if (id) div.id = id;
      div.textContent = text;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function appendBookingCard(booking) {
      const container = document.getElementById('chat-messages');
      const div = document.createElement('div');
      div.className = 'msg msg-bot';
      div.style.background = 'var(--bg2)';
      div.style.padding = '16px';
      div.style.maxWidth = '90%';
      div.style.border = '2px solid var(--green3)';
      
      div.innerHTML = `
        <div style="font-weight:700; text-align:center; margin-bottom:8px; color:var(--text)">Mã đặt sân của bạn</div>
        <div style="font-family:var(--mono); color:var(--green); font-size:16px; font-weight:800; text-align:center; margin-bottom:12px;">${booking.qr_code}</div>
        <div style="background:#fff; padding:10px; border-radius:8px; display:flex; justify-content:center; align-items:center; margin-bottom:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05)">
           <div id="qr-${booking.id}"></div>
        </div>
        <div style="font-size:13px; color:var(--text2); line-height:1.6">
           <div>📅 Ngày: <strong style="color:var(--text)">${new Date(booking.date).toLocaleDateString('vi-VN')}</strong></div>
           <div>⏰ Giờ: <strong style="color:var(--text)">${booking.start_time} - ${booking.end_time}</strong></div>
           <div>👤 Khách: <strong style="color:var(--text)">${booking.customer_name}</strong></div>
           <div>📞 SĐT: <strong style="color:var(--text)">${booking.customer_phone}</strong></div>
           <div style="color:var(--green); font-weight:700; font-size:15px; margin-top:8px; text-align:center;">Tổng: ${booking.total_price.toLocaleString('vi-VN')} ₫</div>
        </div>
        <button class="btn-book-full" style="padding:10px; margin-top:12px; font-size:13px; width:100%" onclick="window.location.reload()">🔄 Làm mới lịch</button>
      `;
      
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
      
      setTimeout(() => {
          const qrContainer = document.getElementById('qr-' + booking.id);
          if (typeof QRCode !== 'undefined' && qrContainer) {
              new QRCode(qrContainer, {
                text: booking.qr_code,
                width: 150, height: 150,
                colorDark: '#16a34a', colorLight: '#ffffff'
              });
          }
      }, 200);
    }
  

    // FIREBASE MESSAGING
    async function initNotifications() {
      if (!('Notification' in window)) return;
      
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
            const customerId = localStorage.getItem('ff_customer_id');
            if (customerId) {
              await fetch('/api/notifications/fcm-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'customer', id: customerId, token: currentToken })
              });
            }
            localStorage.setItem('ff_fcm_token', currentToken);
          }

          messaging.onMessage((payload) => {
            showWebNotification(payload.notification.title, payload.notification.body);
          });
        } catch (err) { console.warn('Web Push failed:', err); }
      }
    }

    function showWebNotification(title, body) {
      const toast = document.createElement('div');
      toast.style = `position:fixed; top:20px; right:20px; background:#16a34a; color:white; padding:15px 25px; 
        border-radius:10px; box-shadow:0 10px 25px rgba(0,0,0,0.2); z-index:9999; animation: slideIn 0.3s ease;`;
      toast.innerHTML = `<strong>${title}</strong><br>${body}`;
      document.body.appendChild(toast);

      // Play sound
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
      audio.play().catch(e => console.log('Audio autoplay blocked'));

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = '0.3s';
        setTimeout(() => toast.remove(), 300);
      }, 5000);
    }

    initNotifications();