// ============================================================
// BHARAT WEB AZADARI — Global Site JavaScript (main.js)
// Runs on every public page. Handles: navigation, scroll
// animations, PWA install prompt, toast container, utilities.
// ============================================================

/* ─────────────────────────────────────────────────────────
   PWA Install Prompt (captured before DOMContentLoaded)
   ───────────────────────────────────────────────────────── */
let _deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredInstallPrompt = e;
});

/* ─────────────────────────────────────────────────────────
   DOMContentLoaded — Bootstrap all global features
   ───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initToastContainer();
  initNavigation();
  initScrollAnimations();
  initCurrentYear();
  initPWA();
});

/* ─────────────────────────────────────────────────────────
   1. Toast Container
   ───────────────────────────────────────────────────────── */

/**
 * Ensure a `.toast-container` div exists in the document body.
 * The `showToast()` function from api.js uses this container.
 */
function initToastContainer() {
  if (!document.querySelector('.toast-container')) {
    const container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
  }
}

/* ─────────────────────────────────────────────────────────
   2. Navigation
   ───────────────────────────────────────────────────────── */

/**
 * Initialise all navigation behaviour:
 *  - Sticky header (adds `.scrolled` class after 50px scroll)
 *  - Mobile hamburger toggle
 *  - Close mobile nav on link click or outside click
 *  - Highlight the active page link
 *  - Smooth scroll for same-page anchor links
 */
function initNavigation() {
  const header = document.querySelector('header') || document.querySelector('.site-header');
  const hamburger = document.querySelector('.hamburger') || document.querySelector('.nav-toggle');
  const navMenu = document.querySelector('.nav-menu') || document.querySelector('.nav-links');
  const navLinks = document.querySelectorAll('.nav-menu a, .nav-links a');

  /* ── Sticky header ── */
  if (header) {
    const handleScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // run once on load
  }

  /* ── Hamburger toggle ── */
  if (hamburger && navMenu) {
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navMenu.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
      // Prevent body scroll when mobile menu is open
      document.body.classList.toggle('nav-open', isOpen);
    });

    /* ── Close on nav link click ── */
    navLinks.forEach(link => {
      link.addEventListener('click', () => closeNav());
    });

    /* ── Close on outside click ── */
    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('open') &&
          !navMenu.contains(e.target) &&
          !hamburger.contains(e.target)) {
        closeNav();
      }
    });

    /* ── Close on Escape key ── */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu.classList.contains('open')) closeNav();
    });
  }

  /* ── Active page highlighting ── */
  highlightActiveNavLink(navLinks);

  /* ── Smooth scroll for anchor links ── */
  initSmoothScroll();
}

/**
 * Close the mobile navigation menu.
 */
function closeNav() {
  const navMenu = document.querySelector('.nav-menu') || document.querySelector('.nav-links');
  const hamburger = document.querySelector('.hamburger') || document.querySelector('.nav-toggle');
  if (navMenu) navMenu.classList.remove('open');
  if (hamburger) {
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }
  document.body.classList.remove('nav-open');
}

/**
 * Compare each nav link href against the current page URL and
 * apply `.active` to the matching link.
 *
 * @param {NodeList} navLinks - All anchor elements inside the nav
 */
function highlightActiveNavLink(navLinks) {
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  const currentPage = currentPath.split('/').pop() || 'index.html';

  navLinks.forEach(link => {
    const href = link.getAttribute('href') || '';
    const linkPage = href.split('/').pop().split('?')[0] || 'index.html';

    const isHome = (currentPage === '' || currentPage === 'index.html') &&
                   (linkPage === '' || linkPage === 'index.html');
    const isMatch = isHome || (linkPage !== '' && linkPage !== 'index.html' && currentPage === linkPage);

    link.classList.toggle('active', isMatch);
    if (isMatch) link.setAttribute('aria-current', 'page');
  });
}

/**
 * Enable smooth scrolling for all same-page anchor links (href="#…").
 * Respects prefers-reduced-motion.
 */
function initSmoothScroll() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href').slice(1);
      if (!targetId) return;
      const target = document.getElementById(targetId);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({
        behavior: prefersReduced ? 'auto' : 'smooth',
        block: 'start',
      });

      // Update URL hash without jumping
      history.pushState(null, '', `#${targetId}`);

      // Move focus for accessibility
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });
}

/* ─────────────────────────────────────────────────────────
   3. Scroll Animations (IntersectionObserver)
   ───────────────────────────────────────────────────────── */

/**
 * Watch all `[data-animate]` elements with an IntersectionObserver.
 * When an element enters the viewport (10% visibility), add the
 * `.animate-in` class so CSS transitions play.
 *
 * Attribute values on `data-animate` can further control behaviour
 * via CSS (e.g. data-animate="fade-up", "fade-left", "scale-in").
 *
 * Falls back gracefully if IntersectionObserver is unsupported.
 */
function initScrollAnimations() {
  const targets = document.querySelectorAll('[data-animate]');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    // Fallback: show all immediately
    targets.forEach(el => el.classList.add('animate-in'));
    return;
  }

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    targets.forEach(el => el.classList.add('animate-in'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.animateDelay || '0';
        setTimeout(() => {
          entry.target.classList.add('animate-in');
        }, parseInt(delay, 10));
        observer.unobserve(entry.target); // animate once only
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px',
  });

  targets.forEach(el => observer.observe(el));
}

/* ─────────────────────────────────────────────────────────
   4. PWA Install Prompt
   ───────────────────────────────────────────────────────── */

/**
 * Register the service worker and show a custom PWA install
 * banner 3 seconds after page load (if not previously dismissed).
 */
function initPWA() {
  /* ── Register Service Worker ── */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('[BWA] SW registration failed:', err);
    });
  }

  /* ── Install Banner ── */
  const DISMISSED_KEY = 'bwa_pwa_dismissed';
  const dismissed = localStorage.getItem(DISMISSED_KEY);
  if (dismissed) return;

  // Wait 3 seconds, then show banner if prompt was captured
  setTimeout(() => {
    if (!_deferredInstallPrompt) return;
    showInstallBanner();
  }, 3000);

  function showInstallBanner() {
    const existing = document.getElementById('bwa-install-banner');
    if (existing) return;

    const banner = document.createElement('div');
    banner.id = 'bwa-install-banner';
    banner.className = 'pwa-install-banner';
    banner.setAttribute('role', 'complementary');
    banner.setAttribute('aria-label', 'Install Bharat Web Azadari app');
    banner.innerHTML = `
      <div class="pwa-banner-content">
        <img src="assets/logo.png" alt="BWA Logo" class="pwa-banner-logo" width="40" height="40">
        <div class="pwa-banner-text">
          <strong>Install BWA App</strong>
          <span>Add to your home screen for quick access</span>
        </div>
        <div class="pwa-banner-actions">
          <button id="pwa-install-btn" class="btn btn-gold btn-sm" aria-label="Install app">Install</button>
          <button id="pwa-dismiss-btn" class="btn btn-ghost btn-sm" aria-label="Dismiss install banner">&times;</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('pwa-banner-visible'));

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (!_deferredInstallPrompt) return;
      _deferredInstallPrompt.prompt();
      const { outcome } = await _deferredInstallPrompt.userChoice;
      console.log(`[BWA] PWA install outcome: ${outcome}`);
      _deferredInstallPrompt = null;
      dismissBanner(banner, DISMISSED_KEY);
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      dismissBanner(banner, DISMISSED_KEY);
    });
  }

  function dismissBanner(banner, key) {
    banner.classList.remove('pwa-banner-visible');
    setTimeout(() => banner.remove(), 400);
    localStorage.setItem(key, '1');
  }
}

/* ─────────────────────────────────────────────────────────
   5. Current Year Injection
   ───────────────────────────────────────────────────────── */

/**
 * Inject the current year into all elements with class `.current-year`.
 * Typically used in footer copyright notices.
 */
function initCurrentYear() {
  const year = new Date().getFullYear();
  document.querySelectorAll('.current-year').forEach(el => {
    el.textContent = year;
  });
}

/* ─────────────────────────────────────────────────────────
   6. Copy to Clipboard
   ───────────────────────────────────────────────────────── */

/**
 * Copy a string to the user's clipboard.
 * Shows a toast notification on success or failure.
 *
 * @param {string} text - The text to copy
 * @param {string} [label='Link'] - Human-readable label for the toast message
 * @returns {Promise<void>}
 */
async function copyToClipboard(text, label = 'Link') {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    showToast(`${label} copied to clipboard!`, 'success');
  } catch (_) {
    showToast('Failed to copy. Please copy manually.', 'error');
  }
}

/* ─────────────────────────────────────────────────────────
   7. Expose globals for inline usage
   ───────────────────────────────────────────────────────── */
window.BWA = window.BWA || {};
Object.assign(window.BWA, {
  closeNav,
  copyToClipboard,
});
