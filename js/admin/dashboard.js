/**
 * dashboard.js — Admin Dashboard
 * Bharat Web Azadari (BWA)
 *
 * Loads at-a-glance stats, recent programs, recent announcements,
 * and live-stream status for the admin overview page.
 *
 * Dependencies: CONFIG, apiGet, showToast (api.js), checkAuth (auth.js)
 */

// ─── Entry Point ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

/**
 * initDashboard()
 * ───────────────
 * Authenticates the session then kicks off all parallel data loads.
 */
async function initDashboard() {
  // Guard: redirects to login if no valid session
  const token = checkAuth();
  if (!token) return;

  // Wire up logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Set greeting based on time of day
  _setGreeting();

  // Start all loads in parallel for speed
  await loadStats();
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/**
 * loadStats()
 * ───────────
 * Fetches programs, announcements, gallery and live-stream data in parallel.
 * Populates stat cards and recent-item tables.
 */
async function loadStats() {
  // Show skeleton loaders
  _showStatSkeletons();

  try {
    const [programsRes, announcementsRes, galleryRes, livestreamRes] = await Promise.allSettled([
      apiGet('getPrograms',      {}),
      apiGet('getAnnouncements', {}),
      apiGet('getGallery',       {}),
      apiGet('getLiveStream',    {}),
    ]);

    // ── Programs ──────────────────────────────────────────────────────────
    const programs = _extractData(programsRes, 'programs');
    _updateStatCard('programs-count', programs.length);
    _renderRecentPrograms(programs.slice(0, 5));

    // ── Announcements ─────────────────────────────────────────────────────
    const announcements = _extractData(announcementsRes, 'announcements');
    _updateStatCard('announcements-count', announcements.length);
    _renderRecentAnnouncements(announcements.slice(0, 3));

    // ── Gallery ───────────────────────────────────────────────────────────
    const gallery = _extractData(galleryRes, 'images');
    _updateStatCard('gallery-count', gallery.length);

    // ── Upcoming program count ────────────────────────────────────────────
    const now      = new Date();
    const upcoming = programs.filter(p => new Date(p.date) >= now);
    _updateStatCard('upcoming-count', upcoming.length);

    // ── Live Stream Status ────────────────────────────────────────────────
    const livestream = (livestreamRes.status === 'fulfilled' && livestreamRes.value) ? livestreamRes.value : {};
    _renderLiveStreamStatus(livestream);

  } catch (err) {
    console.error('[BWA Dashboard] Failed to load stats:', err);
    showToast('Failed to load dashboard data. Please refresh.', 'error');
  }
}

// ─── Stat Card Helpers ────────────────────────────────────────────────────────

function _showStatSkeletons() {
  ['programs-count', 'announcements-count', 'gallery-count', 'upcoming-count'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skeleton-text" style="width:40px;height:32px;display:inline-block;"></span>';
  });
}

function _updateStatCard(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  // Animate the number
  el.classList.add('stat-updated');
  setTimeout(() => el.classList.remove('stat-updated'), 600);
}

// ─── Recent Programs Table ────────────────────────────────────────────────────

/**
 * _renderRecentPrograms(programs)
 * ────────────────────────────────
 * Renders the latest 5 programs into the mini dashboard table.
 */
function _renderRecentPrograms(programs) {
  const tbody = document.getElementById('recent-programs-body');
  if (!tbody) return;

  if (!programs || programs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-row">
          <span>No programs found.</span>
          <a href="programs.html" class="btn-link">Add one →</a>
        </td>
      </tr>`;
    return;
  }

  // Sort by date descending (most recent first)
  const sorted = [...programs].sort((a, b) => new Date(b.date) - new Date(a.date));

  tbody.innerHTML = sorted.map(program => {
    const date   = _formatDate(program.date);
    const badge  = _isPast(program.date)
      ? '<span class="badge badge-past">Past</span>'
      : '<span class="badge badge-upcoming">Upcoming</span>';

    return `
      <tr>
        <td class="program-title-cell">
          <span class="program-title">${_esc(program.title)}</span>
        </td>
        <td>${date}</td>
        <td>${_esc(program.location || '—')}</td>
        <td>${badge}</td>
      </tr>`;
  }).join('');
}

// ─── Recent Announcements ─────────────────────────────────────────────────────

/**
 * _renderRecentAnnouncements(items)
 * ──────────────────────────────────
 * Shows the 3 most recent announcements as cards on the dashboard.
 */
function _renderRecentAnnouncements(items) {
  const container = document.getElementById('recent-announcements');
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">
        No announcements yet.
        <a href="announcements.html" class="btn-link">Add one →</a>
      </div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="announcement-card-mini">
      <div class="announcement-card-mini__header">
        <span class="announcement-card-mini__title">${_esc(item.title)}</span>
        <span class="announcement-card-mini__date">${_formatDate(item.date)}</span>
      </div>
      <p class="announcement-card-mini__desc">${_esc(_truncate(item.description, 100))}</p>
    </div>
  `).join('');
}

// ─── Live Stream Status ───────────────────────────────────────────────────────

/**
 * _renderLiveStreamStatus(data)
 * ──────────────────────────────
 * Shows a LIVE or OFFLINE badge and the current stream URL on the dashboard.
 */
function _renderLiveStreamStatus(data) {
  const statusEl = document.getElementById('livestream-status');
  const urlEl    = document.getElementById('livestream-url-display');

  if (!statusEl) return;

  const isLive = data && (data.isLive === true || data.isLive === 'true' || data.isLive === 1);

  statusEl.innerHTML = isLive
    ? '<span class="badge badge-live">🔴 LIVE NOW</span>'
    : '<span class="badge badge-offline">⚫ OFFLINE</span>';

  if (urlEl) {
    urlEl.textContent = (data && data.youtubeUrl) ? data.youtubeUrl : 'No stream URL configured.';
  }
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

function _setGreeting() {
  const el   = document.getElementById('dashboard-greeting');
  if (!el) return;
  const hour = new Date().getHours();
  let   greet = 'Welcome back';
  if (hour < 12)      greet = 'Good morning';
  else if (hour < 17) greet = 'Good afternoon';
  else                greet = 'Good evening';
  el.textContent = greet + ', Admin!';
}

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function _extractData(settled, key) {
  if (settled.status === 'fulfilled' && settled.value) {
    return settled.value[key] || settled.value || [];
  }
  return [];
}

function _formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function _isPast(dateStr) {
  return new Date(dateStr) < new Date();
}

function _truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function _esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
