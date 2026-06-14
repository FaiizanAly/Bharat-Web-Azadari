/**
 * livestream-admin.js — Live Stream Management Admin Module
 * Bharat Web Azadari (BWA)
 *
 * Controls the current YouTube live stream URL and LIVE/OFFLINE toggle.
 * Provides real-time embed preview and YouTube URL validation.
 *
 * Dependencies: CONFIG, apiGet, apiPost, showToast (api.js), checkAuth, logout (auth.js)
 */

// ─── Module State ─────────────────────────────────────────────────────────────
let _currentData = {};      // Last loaded stream data from API
let _previewTimer = null;   // Debounce timer for live preview updates

// ─── Entry Point ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initLivestreamAdmin();
});

/**
 * initLivestreamAdmin()
 * ──────────────────────
 * Auth check → wire up events → load current stream data.
 */
async function initLivestreamAdmin() {
  const token = checkAuth();
  if (!token) return;

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // YouTube URL field — live preview + validation
  document.getElementById('field-youtubeUrl')?.addEventListener('input', _onUrlInput);

  // isLive toggle — update status badge immediately
  document.getElementById('field-isLive')?.addEventListener('change', _onLiveToggle);

  // Save button
  document.getElementById('save-livestream-btn')?.addEventListener('click', saveLivestream);

  // Clear URL button
  document.getElementById('clear-url-btn')?.addEventListener('click', _clearUrl);

  await loadLivestream();
}

// ─── Load ─────────────────────────────────────────────────────────────────────

/**
 * loadLivestream()
 * ─────────────────
 * Fetches current stream configuration from GAS and populates the form.
 */
async function loadLivestream() {
  _showLoadingSkeleton();

  try {
    const res    = await apiGet('getLiveStream', {});
    _currentData = res || {};

    _populateForm(_currentData);
    _renderStatusBadge(_currentData.isLive);
    _updatePreview(_currentData.youtubeUrl || '');
  } catch (err) {
    console.error('[BWA Livestream] Load error:', err);
    showToast('Failed to load stream data. Please refresh.', 'error');
    _hideLoadingSkeleton();
  }
}

// ─── Save ─────────────────────────────────────────────────────────────────────

/**
 * saveLivestream()
 * ─────────────────
 * Validates the URL, then POSTs the new configuration to GAS.
 */
async function saveLivestream() {
  const url    = document.getElementById('field-youtubeUrl')?.value.trim() || '';
  const isLive = document.getElementById('field-isLive')?.checked || false;

  // Validate: if isLive is true, a URL must be provided
  if (isLive && !url) {
    showToast('Please enter a YouTube URL to go LIVE.', 'error');
    document.getElementById('field-youtubeUrl')?.focus();
    return;
  }

  // Validate YouTube URL format (if not empty)
  if (url && !_isValidYouTubeUrl(url)) {
    showToast('Please enter a valid YouTube video or live URL.', 'error');
    document.getElementById('field-youtubeUrl')?.focus();
    return;
  }

  const data   = { youtubeUrl: url, isLive };
  const saveBtn = document.getElementById('save-livestream-btn');
  _setButtonLoading(saveBtn, true, 'Saving…');

  try {
    const response = await apiPost('setLiveStream', data);

    if (response && response.success) {
      _currentData = data;
      _renderStatusBadge(isLive);
      showToast(
        isLive ? '🔴 Stream is now LIVE!' : '⚫ Stream set to OFFLINE.',
        isLive ? 'success' : 'info'
      );
    } else {
      const msg = (response && response.message) || 'Failed to save stream settings.';
      showToast(msg, 'error');
    }
  } catch (err) {
    console.error('[BWA Livestream] Save error:', err);
    showToast('Network error. Please try again.', 'error');
  } finally {
    _setButtonLoading(saveBtn, false, 'Save Stream Settings');
  }
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

/**
 * _renderStatusBadge(isLive)
 * ───────────────────────────
 * Updates the LIVE/OFFLINE status badge at the top of the page.
 *
 * @param {boolean|string|number} isLive
 */
function _renderStatusBadge(isLive) {
  const badge = document.getElementById('stream-status-badge');
  if (!badge) return;

  const live = isLive === true || isLive === 'true' || isLive === 1 || isLive === '1';

  badge.innerHTML = live
    ? '<span class="badge badge-live pulse">🔴 LIVE NOW</span>'
    : '<span class="badge badge-offline">⚫ OFFLINE</span>';
}

// ─── URL Input Handlers ───────────────────────────────────────────────────────

function _onUrlInput(e) {
  const url        = e.target.value.trim();
  const validEl    = document.getElementById('url-validation-msg');
  const videoIdEl  = document.getElementById('detected-video-id');

  // Validate in real time
  if (!url) {
    _clearValidation(validEl);
    _updatePreview('');
    if (videoIdEl) videoIdEl.textContent = '';
    return;
  }

  if (_isValidYouTubeUrl(url)) {
    if (validEl) {
      validEl.textContent  = '✅ Valid YouTube URL';
      validEl.className    = 'validation-msg validation-msg--ok';
      validEl.style.display = 'block';
    }
    const videoId = _extractVideoId(url);
    if (videoIdEl) videoIdEl.textContent = videoId ? `Video ID: ${videoId}` : '';
  } else {
    if (validEl) {
      validEl.textContent  = '⚠️ Not a recognised YouTube URL format.';
      validEl.className    = 'validation-msg validation-msg--warn';
      validEl.style.display = 'block';
    }
    if (videoIdEl) videoIdEl.textContent = '';
  }

  // Debounce preview update (300 ms)
  clearTimeout(_previewTimer);
  _previewTimer = setTimeout(() => _updatePreview(url), 300);
}

function _onLiveToggle(e) {
  _renderStatusBadge(e.target.checked);
}

function _clearUrl() {
  const urlField = document.getElementById('field-youtubeUrl');
  if (urlField) urlField.value = '';
  _clearValidation(document.getElementById('url-validation-msg'));
  _updatePreview('');

  const videoIdEl = document.getElementById('detected-video-id');
  if (videoIdEl) videoIdEl.textContent = '';
}

// ─── Embed Preview ────────────────────────────────────────────────────────────

/**
 * _updatePreview(url)
 * ────────────────────
 * Generates an iframe embed for valid YouTube URLs and shows it
 * in the #preview-container. If URL is empty/invalid, shows a placeholder.
 *
 * @param {string} url
 */
function _updatePreview(url) {
  const container   = document.getElementById('preview-container');
  const placeholder = document.getElementById('preview-placeholder');
  const iframe      = document.getElementById('preview-iframe');

  if (!container) return;

  const videoId = _extractVideoId(url);

  if (!videoId) {
    // Show placeholder
    if (iframe)      iframe.style.display      = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    if (iframe)      iframe.src                = '';
    return;
  }

  // Build embed URL
  // For live streams we use the video page; for regular videos same embed works
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`;

  if (iframe) {
    iframe.src          = embedUrl;
    iframe.style.display = 'block';
  }
  if (placeholder) placeholder.style.display = 'none';
}

// ─── Form Helpers ─────────────────────────────────────────────────────────────

function _populateForm(data) {
  const urlField    = document.getElementById('field-youtubeUrl');
  const isLiveField = document.getElementById('field-isLive');

  if (urlField)    urlField.value    = data.youtubeUrl || '';
  if (isLiveField) isLiveField.checked = (data.isLive === true || data.isLive === 'true' || data.isLive === 1);

  _hideLoadingSkeleton();

  // Trigger initial validation display if URL exists
  if (data.youtubeUrl) {
    _onUrlInput({ target: { value: data.youtubeUrl } });
  }
}

// ─── YouTube URL Utilities ────────────────────────────────────────────────────

/**
 * _isValidYouTubeUrl(url)
 * ────────────────────────
 * Returns true if the URL matches any of the common YouTube URL patterns:
 *   - https://www.youtube.com/watch?v=XXXXX
 *   - https://youtu.be/XXXXX
 *   - https://www.youtube.com/live/XXXXX
 *   - https://www.youtube.com/embed/XXXXX
 *
 * @param {string} url
 * @returns {boolean}
 */
function _isValidYouTubeUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      return u.pathname.length > 1;
    }

    if (host === 'youtube.com') {
      // /watch?v=, /live/ID, /embed/ID, /shorts/ID
      if (u.pathname.startsWith('/watch') && u.searchParams.get('v')) return true;
      if (/^\/(live|embed|shorts)\/[a-zA-Z0-9_-]{11}/.test(u.pathname)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * _extractVideoId(url)
 * ─────────────────────
 * Extracts the 11-character YouTube video ID from any supported URL format.
 *
 * @param {string} url
 * @returns {string|null} video ID or null
 */
function _extractVideoId(url) {
  if (!url) return null;
  try {
    const u    = new URL(url);
    const host = u.hostname.replace(/^www\./, '');

    // youtu.be/VIDEO_ID
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('?')[0];
      return _isVideoId(id) ? id : null;
    }

    if (host === 'youtube.com') {
      // /watch?v=VIDEO_ID
      const v = u.searchParams.get('v');
      if (v && _isVideoId(v)) return v;

      // /live/VIDEO_ID, /embed/VIDEO_ID, /shorts/VIDEO_ID
      const match = u.pathname.match(/\/(live|embed|shorts)\/([a-zA-Z0-9_-]{11})/);
      if (match) return match[2];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * _isVideoId(str)
 * ────────────────
 * Checks if a string looks like a valid YouTube video ID (11 chars).
 */
function _isVideoId(str) {
  return typeof str === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(str);
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function _showLoadingSkeleton() {
  const form = document.getElementById('livestream-form-section');
  if (form) form.style.opacity = '0.5';
}

function _hideLoadingSkeleton() {
  const form = document.getElementById('livestream-form-section');
  if (form) form.style.opacity = '1';
}

function _clearValidation(el) {
  if (!el) return;
  el.textContent   = '';
  el.style.display = 'none';
}

function _setButtonLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled  = loading;
  btn.innerHTML = loading ? '<span class="spinner"></span> ' + label : label;
}
