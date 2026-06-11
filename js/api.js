// ============================================================
// BHARAT WEB AZADARI — API Helper Module
// ============================================================
// Centralised functions for communicating with Google Apps
// Script (GAS) backend, UI helpers (toast, loader) and
// general utilities used across all pages.
// ============================================================

/* ─────────────────────────────────────────────────────────
   1. API — GET
   ───────────────────────────────────────────────────────── */

/**
 * Perform a GET request against the Google Apps Script Web App.
 *
 * @param {string} action  - The GAS action name (e.g. 'getPrograms')
 * @param {Object} [params={}] - Additional query-string params
 * @param {number} [retries=1]  - Number of automatic retries on failure
 * @returns {Promise<any>} Parsed JSON response from GAS
 * @throws {Error} On network failure or GAS-level error after retries
 */
async function apiGet(action, params = {}, retries = 1) {
  if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
    console.warn('[BWA] APPS_SCRIPT_URL not configured. Using mock response.');
    return { status: 'ok', data: [] };
  }

  const url = new URL(CONFIG.APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();

      // GAS-level error (status field in response body)
      if (json && json.status === 'error') {
        throw new Error(json.message || 'Google Apps Script returned an error.');
      }

      return json;
    } catch (err) {
      console.error(`[BWA] apiGet attempt ${attempt + 1} failed:`, err);
      if (attempt === retries) throw err; // exhausted retries
      // Brief pause before retry
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

/* ─────────────────────────────────────────────────────────
   2. API — POST
   ───────────────────────────────────────────────────────── */

/**
 * Perform a POST request against the Google Apps Script Web App.
 *
 * GAS CORS note: GAS doPost() only allows simple requests from
 * browsers. To avoid preflight OPTIONS (which GAS cannot handle),
 * we send Content-Type: 'text/plain' and stringify the body as
 * JSON ourselves. GAS reads it with `JSON.parse(e.postData.contents)`.
 *
 * @param {string} action - GAS action name (e.g. 'submitContact')
 * @param {Object} [data={}] - Payload object merged with action
 * @returns {Promise<any>} Parsed JSON response from GAS
 * @throws {Error} On network failure or GAS-level error
 */
async function apiPost(action, data = {}) {
  if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
    console.warn('[BWA] APPS_SCRIPT_URL not configured. Simulating POST success.');
    return { status: 'ok', message: 'Simulated success' };
  }

  const payload = JSON.stringify({ action, ...data });

  try {
    const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      // 'text/plain' avoids preflight CORS; GAS reads postData.contents
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload,
    });

    // GAS always returns 200 even for errors; parse body regardless
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (_) {
      throw new Error('Invalid JSON response from server.');
    }

    if (json && json.status === 'error') {
      throw new Error(json.message || 'Server returned an error.');
    }

    return json;
  } catch (err) {
    console.error('[BWA] apiPost failed:', err);
    throw err;
  }
}

/* ─────────────────────────────────────────────────────────
   3. Toast Notification
   ───────────────────────────────────────────────────────── */

/**
 * Display a toast notification at the bottom-right of the screen.
 *
 * Relies on a `.toast-container` element in the DOM (created by
 * main.js on page load). CSS for `.toast`, `.toast-success`,
 * `.toast-error`, etc. lives in components.css.
 *
 * @param {string} message - The message to display
 * @param {'success'|'error'|'warning'|'info'} [type='success'] - Toast type
 * @param {number} [duration=4000] - Auto-dismiss delay in ms
 */
function showToast(message, type = 'success', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${sanitizeHTML(message)}</span>
    <button class="toast-close" aria-label="Dismiss notification">&times;</button>
  `;

  // Close button
  toast.querySelector('.toast-close').addEventListener('click', () => dismiss(toast));

  container.appendChild(toast);

  // Trigger enter animation (next frame)
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  // Auto-dismiss
  const timer = setTimeout(() => dismiss(toast), duration);
  toast.dataset.timerId = timer;

  function dismiss(el) {
    clearTimeout(Number(el.dataset.timerId));
    el.classList.remove('toast-visible');
    el.classList.add('toast-hiding');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    // Fallback removal
    setTimeout(() => el.remove(), 500);
  }
}

/* ─────────────────────────────────────────────────────────
   4. Loader / Spinner
   ───────────────────────────────────────────────────────── */

/**
 * Insert a loading spinner into a container element.
 * Removes any existing spinner first to avoid duplicates.
 *
 * @param {HTMLElement} container - The DOM element to insert the spinner into
 */
function showLoader(container) {
  if (!container) return;
  hideLoader(container); // prevent duplicates
  const loader = document.createElement('div');
  loader.className = 'bwa-loader';
  loader.setAttribute('aria-label', 'Loading…');
  loader.setAttribute('role', 'status');
  loader.innerHTML = `
    <div class="bwa-spinner">
      <div class="bwa-spinner-ring"></div>
    </div>
    <p class="bwa-loader-text">Loading…</p>
  `;
  container.appendChild(loader);
}

/**
 * Remove the loading spinner from a container element.
 *
 * @param {HTMLElement} container - The DOM element containing the spinner
 */
function hideLoader(container) {
  if (!container) return;
  const existing = container.querySelector('.bwa-loader');
  if (existing) existing.remove();
}

/* ─────────────────────────────────────────────────────────
   5. Date Formatting
   ───────────────────────────────────────────────────────── */

/**
 * Format a date string into a readable English representation.
 * Example output: "15 January 2026"
 *
 * @param {string} dateString - Any string parseable by Date constructor
 * @returns {string} Formatted date, or original string on parse failure
 */
function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch (_) {
    return dateString;
  }
}

/**
 * Format a date string into short form.
 * Example output: "15 Jan 2026"
 *
 * @param {string} dateString - Any string parseable by Date constructor
 * @returns {string} Short formatted date
 */
function formatDateShort(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch (_) {
    return dateString;
  }
}

/* ─────────────────────────────────────────────────────────
   6. Relative Time (time ago)
   ───────────────────────────────────────────────────────── */

/**
 * Return a human-friendly relative time string.
 * Examples: "Just now", "3 minutes ago", "2 days ago", "1 month ago"
 *
 * @param {string} dateString - Any string parseable by Date constructor
 * @returns {string} Relative time description
 */
function timeAgo(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${seconds} seconds ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;

    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;

    const years = Math.floor(days / 365);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  } catch (_) {
    return dateString;
  }
}

/* ─────────────────────────────────────────────────────────
   7. Debounce
   ───────────────────────────────────────────────────────── */

/**
 * Return a debounced version of the given function.
 * Delays execution until `wait` ms have elapsed since last invocation.
 *
 * @param {Function} func - The function to debounce
 * @param {number} wait   - Delay in milliseconds
 * @returns {Function} Debounced function with a `.cancel()` method
 */
function debounce(func, wait) {
  let timeoutId;
  function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), wait);
  }
  debounced.cancel = () => clearTimeout(timeoutId);
  return debounced;
}

/* ─────────────────────────────────────────────────────────
   8. HTML Sanitisation
   ───────────────────────────────────────────────────────── */

/**
 * Basic HTML sanitisation — escapes characters that could allow
 * XSS injection when inserting user-provided content into the DOM.
 *
 * Note: For rich HTML, use a dedicated library like DOMPurify.
 * This function is suitable for plain-text user content.
 *
 * @param {string} str - Raw string to sanitise
 * @returns {string} Escaped string safe for innerHTML
 */
function sanitizeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ─────────────────────────────────────────────────────────
   9. Skeleton Loader Helpers
   ───────────────────────────────────────────────────────── */

/**
 * Generate N skeleton card placeholder elements as an HTML string.
 * Used for loading states across cards grids.
 *
 * @param {number} [count=6] - Number of skeleton cards to generate
 * @param {string} [extraClass=''] - Extra CSS class for the skeleton element
 * @returns {string} HTML string of skeleton cards
 */
function generateSkeletons(count = 6, extraClass = '') {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card ${extraClass}" aria-hidden="true">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
    </div>
  `).join('');
}
