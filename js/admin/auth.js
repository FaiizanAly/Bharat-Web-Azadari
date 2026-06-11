/**
 * auth.js — Admin Authentication Module
 * Bharat Web Azadari (BWA)
 *
 * Handles login, logout, token storage, and auth verification
 * for all admin panel pages.
 *
 * Dependencies: CONFIG (config.js), apiPost (api.js)
 */

// ─── Token expiry: 8 hours in milliseconds ───────────────────────────────────
const TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000;

/**
 * Determines the correct path to the admin login page
 * depending on whether we're already inside admin/ or one level up.
 */
function _getLoginPath() {
  const path = window.location.pathname.replace(/\\/g, '/');
  // If URL already contains /admin/dashboard, /admin/programs, etc.
  if (path.includes('/admin/') && !path.endsWith('/admin/index.html')) {
    return './index.html';          // Same directory: admin/
  }
  return '../admin/index.html';     // One level up
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * checkAuth()
 * ───────────
 * Must be called at the top of every protected admin page.
 * Reads the stored token + timestamp from sessionStorage,
 * validates expiry, and redirects to login if invalid.
 *
 * @returns {string|null} token if valid, null if redirecting
 */
function checkAuth() {
  const token     = sessionStorage.getItem(CONFIG.ADMIN_SESSION_KEY);
  const timestamp = sessionStorage.getItem(CONFIG.ADMIN_SESSION_KEY + '_ts');

  if (!token || !timestamp) {
    _redirectToLogin('No session found.');
    return null;
  }

  const age = Date.now() - parseInt(timestamp, 10);
  if (age > TOKEN_EXPIRY_MS) {
    _clearSession();
    _redirectToLogin('Session expired. Please log in again.');
    return null;
  }

  // Valid — make sure admin content is visible
  const adminContent = document.getElementById('admin-content');
  if (adminContent) adminContent.style.display = 'block';

  return token;
}

/**
 * login(password)
 * ───────────────
 * Called on the login form submit event.
 * POSTs credentials to GAS; on success stores the token
 * and redirects to dashboard.html.
 *
 * @param {string} password - plain-text password from the form
 */
async function login(password) {
  const btn        = document.getElementById('login-btn');
  const errorEl    = document.getElementById('login-error');

  // Reset UI
  if (errorEl) errorEl.textContent = '';

  // Show loading state on button
  const originalText = btn ? btn.textContent : 'Login';
  if (btn) {
    btn.disabled     = true;
    btn.innerHTML    = '<span class="spinner"></span> Logging in…';
  }

  try {
    const response = await apiPost('adminLogin', { password });

    if (response && response.success && response.token) {
      // Store token + timestamp
      sessionStorage.setItem(CONFIG.ADMIN_SESSION_KEY,        response.token);
      sessionStorage.setItem(CONFIG.ADMIN_SESSION_KEY + '_ts', Date.now().toString());

      // Redirect to dashboard (relative to admin/index.html)
      window.location.href = 'dashboard.html';
    } else {
      const msg = (response && response.message) || 'Invalid password. Please try again.';
      _showLoginError(errorEl, msg);
    }
  } catch (err) {
    console.error('[BWA Auth] Login error:', err);
    _showLoginError(errorEl, 'Network error. Please check your connection.');
  } finally {
    if (btn) {
      btn.disabled  = false;
      btn.textContent = originalText;
    }
  }
}

/**
 * logout()
 * ────────
 * Clears the session and sends the user back to the login page.
 * Attach to any "Logout" button in the admin layout.
 */
function logout() {
  _clearSession();
  // Determine correct login URL from wherever logout is called
  const path = window.location.pathname.replace(/\\/g, '/');
  if (path.endsWith('/admin/index.html') || path.endsWith('/admin/')) {
    window.location.reload();
  } else {
    window.location.href = './index.html';
  }
}

/**
 * getAdminToken()
 * ───────────────
 * Returns the currently stored admin token (or null if not logged in).
 * Used by other admin modules that need to attach the token to API calls.
 *
 * @returns {string|null}
 */
function getAdminToken() {
  return sessionStorage.getItem(CONFIG.ADMIN_SESSION_KEY) || null;
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

function _clearSession() {
  sessionStorage.removeItem(CONFIG.ADMIN_SESSION_KEY);
  sessionStorage.removeItem(CONFIG.ADMIN_SESSION_KEY + '_ts');
}

function _redirectToLogin(reason) {
  console.warn('[BWA Auth] Redirecting to login:', reason);
  // Small delay so any current rendering completes
  setTimeout(() => {
    window.location.href = _getLoginPath();
  }, 50);
}

function _showLoginError(el, message) {
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  } else {
    alert(message);
  }
}

// ─── Auto-init login form if present ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  // If already logged in and visiting login page → skip to dashboard
  const token     = sessionStorage.getItem(CONFIG.ADMIN_SESSION_KEY);
  const timestamp = sessionStorage.getItem(CONFIG.ADMIN_SESSION_KEY + '_ts');
  if (token && timestamp) {
    const age = Date.now() - parseInt(timestamp, 10);
    if (age < TOKEN_EXPIRY_MS) {
      window.location.href = 'dashboard.html';
      return;
    }
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const password = document.getElementById('login-password')?.value.trim();
    if (!password) {
      const errorEl = document.getElementById('login-error');
      _showLoginError(errorEl, 'Please enter your password.');
      return;
    }
    login(password);
  });

  // Allow toggling password visibility
  const toggleBtn = document.getElementById('toggle-password');
  const passInput = document.getElementById('login-password');
  if (toggleBtn && passInput) {
    toggleBtn.addEventListener('click', () => {
      const isText    = passInput.type === 'text';
      passInput.type  = isText ? 'password' : 'text';
      toggleBtn.textContent = isText ? '👁' : '🙈';
    });
  }
});
