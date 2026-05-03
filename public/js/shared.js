/* ========================================
   FootField Shared Utilities
   ======================================== */

const API_BASE_URL = window.location.origin;

/**
 * Fetch data from API with error handling
 */
async function fetchFromAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Format price to Vietnamese currency (e.g., 100.000 ₫)
 */
const fmt = (n) => {
  const num = Math.round(parseFloat(n) || 0);
  return num.toLocaleString('vi-VN') + ' ₫';
};

function formatPrice(price) {
  return (price || 0).toLocaleString('vi-VN');
}

/**
 * Calculate end time from start time and duration
 */
function calculateEndTime(startTime, durationHours) {
  const [h, m] = startTime.split(':').map(Number);
  const totalMins = h * 60 + m + Math.round(durationHours * 60);
  const endH = Math.floor(totalMins / 60);
  const endM = totalMins % 60;
  return (endH < 10 ? '0' + endH : endH) + ':' + (endM < 10 ? '0' + endM : endM);
}

/**
 * Normalize date to YYYY-MM-DD
 */
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

/**
 * Date formatter for UI display
 */
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('vi-VN') : '';

/**
 * Check if current view is mobile
 */
function isMobile() {
  return window.innerWidth <= 768;
}

// Global UI Sync
function syncGlobalLoading(show) {
  const overlay = document.getElementById('page-loading-overlay');
  if (overlay) {
    if (show) overlay.classList.remove('hidden');
    else overlay.classList.add('hidden');
  }
}
