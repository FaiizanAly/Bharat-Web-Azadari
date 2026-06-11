// ============================================================
// BHARAT WEB AZADARI — Gallery Page (gallery.js)
// Loads gallery images from GAS, renders a filterable masonry
// grid, and provides a keyboard-accessible lightbox.
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initGallery();
});

/* ─────────────────────────────────────────────────────────
   State
   ───────────────────────────────────────────────────────── */

/** All gallery items from GAS */
let _allItems   = [];
/** Items currently visible (after filter) */
let _filtered   = [];
/** Index of the currently open lightbox image */
let _lightboxIdx = -1;

/* ─────────────────────────────────────────────────────────
   1. Init
   ───────────────────────────────────────────────────────── */

/**
 * Fetch gallery items from GAS, render the grid, and wire up
 * the category filter buttons.
 */
async function initGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  grid.innerHTML = generateSkeletons(9, 'gallery-skeleton');
  initGalleryFilters();
  initLightbox();

  try {
    const res = await apiGet('getGallery');
    _allItems = Array.isArray(res.data) ? res.data : [];

    if (!_allItems.length) {
      grid.innerHTML = `
        <div class="empty-state col-span-full">
          <div class="empty-icon" aria-hidden="true">🖼️</div>
          <h3>Gallery Coming Soon</h3>
          <p>Photos and videos from our events will appear here.</p>
        </div>
      `;
      return;
    }

    _filtered = _allItems;
    renderGallery(_filtered);
  } catch (err) {
    console.error('[BWA] initGallery error:', err);
    grid.innerHTML = `
      <div class="error-state col-span-full" role="alert">
        <div class="error-icon" aria-hidden="true">⚠️</div>
        <h3>Could not load gallery</h3>
        <p>Please refresh the page to try again.</p>
      </div>
    `;
  }
}

/* ─────────────────────────────────────────────────────────
   2. Category Filter
   ───────────────────────────────────────────────────────── */

/**
 * Wire up the gallery filter buttons.
 * Expects `.gallery-filter-btn[data-category]` elements.
 */
function initGalleryFilters() {
  const btns = document.querySelectorAll('.gallery-filter-btn[data-category]');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', String(b === btn));
      });

      const cat = btn.dataset.category;
      _filtered = cat === 'all'
        ? _allItems
        : _allItems.filter(item =>
            (item.category || '').toLowerCase() === cat.toLowerCase()
          );
      renderGallery(_filtered);
    });
  });
}

/* ─────────────────────────────────────────────────────────
   3. Render Grid
   ───────────────────────────────────────────────────────── */

/**
 * Render gallery items into `#gallery-grid`.
 *
 * @param {Array} items - Gallery item objects to display
 */
function renderGallery(items) {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  if (!items.length) {
    grid.innerHTML = `
      <div class="empty-state col-span-full">
        <div class="empty-icon" aria-hidden="true">🖼️</div>
        <h3>No photos in this category</h3>
        <p>Try selecting a different category.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map((item, idx) => renderGalleryItem(item, idx)).join('');
}

/**
 * Generate the HTML for a single gallery grid item.
 *
 * @param {Object} item - Gallery item (image, caption, category fields)
 * @param {number} idx  - Index within the _filtered array (for lightbox)
 * @returns {string} HTML string
 */
function renderGalleryItem(item, idx) {
  const caption = item.caption || item.title || '';
  const category = item.category || 'General';
  const imgSrc = item.image || item.url || 'assets/placeholder.jpg';

  return `
    <figure class="gallery-item" data-animate="fade-up" data-animate-delay="${Math.min(idx * 50, 300)}"
      tabindex="0"
      role="button"
      aria-label="View photo: ${sanitizeHTML(caption || category)}"
      data-index="${idx}"
      onclick="openLightbox(${idx})"
      onkeydown="if(event.key==='Enter'||event.key===' ')openLightbox(${idx})"
    >
      <div class="gallery-img-wrapper">
        <img
          src="${sanitizeHTML(imgSrc)}"
          alt="${sanitizeHTML(caption || category + ' photo')}"
          class="gallery-img"
          loading="lazy"
          onerror="this.parentElement.parentElement.classList.add('gallery-error'); this.src='assets/placeholder.jpg'"
        >
        <div class="gallery-overlay" aria-hidden="true">
          <div class="gallery-overlay-content">
            <svg class="gallery-zoom-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            ${caption ? `<p class="gallery-caption">${sanitizeHTML(caption)}</p>` : ''}
          </div>
        </div>
        <span class="gallery-category-tag">${sanitizeHTML(category)}</span>
      </div>
      ${caption ? `<figcaption class="sr-only">${sanitizeHTML(caption)}</figcaption>` : ''}
    </figure>
  `;
}

/* ─────────────────────────────────────────────────────────
   4. Lightbox
   ───────────────────────────────────────────────────────── */

/**
 * Create the lightbox DOM structure and attach all event listeners.
 * The lightbox is hidden by default and shown via `openLightbox()`.
 */
function initLightbox() {
  if (document.getElementById('bwa-lightbox')) return;

  const lb = document.createElement('div');
  lb.id = 'bwa-lightbox';
  lb.className = 'lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Image viewer');
  lb.setAttribute('aria-hidden', 'true');

  lb.innerHTML = `
    <div class="lightbox-backdrop" aria-hidden="true"></div>
    <div class="lightbox-container">
      <button class="lightbox-close" id="lb-close" aria-label="Close image viewer">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <button class="lightbox-nav lightbox-prev" id="lb-prev" aria-label="Previous image">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="lightbox-img-wrapper">
        <img id="lb-img" src="" alt="" class="lightbox-img" draggable="false">
        <div class="lightbox-loader" id="lb-loader" aria-label="Loading image" role="status">
          <div class="bwa-spinner"><div class="bwa-spinner-ring"></div></div>
        </div>
      </div>
      <button class="lightbox-nav lightbox-next" id="lb-next" aria-label="Next image">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      <div class="lightbox-caption-bar">
        <p class="lightbox-caption" id="lb-caption"></p>
        <span class="lightbox-counter" id="lb-counter"></span>
      </div>
    </div>
  `;

  document.body.appendChild(lb);

  // Event listeners
  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  lb.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
  document.getElementById('lb-prev').addEventListener('click', (e) => { e.stopPropagation(); navigateLightbox(-1); });
  document.getElementById('lb-next').addEventListener('click', (e) => { e.stopPropagation(); navigateLightbox(1); });

  // Keyboard navigation
  document.addEventListener('keydown', handleLightboxKey);

  // Touch / swipe support
  let _touchStartX = 0;
  lb.addEventListener('touchstart', (e) => { _touchStartX = e.changedTouches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - _touchStartX;
    if (Math.abs(dx) > 50) navigateLightbox(dx < 0 ? 1 : -1);
  }, { passive: true });
}

/**
 * Open the lightbox and show the image at the given index.
 *
 * @param {number} idx - Index of the image in `_filtered`
 */
function openLightbox(idx) {
  if (!_filtered.length) return;
  _lightboxIdx = Math.max(0, Math.min(idx, _filtered.length - 1));

  const lb = document.getElementById('bwa-lightbox');
  if (!lb) { initLightbox(); }

  updateLightboxImage(_lightboxIdx);

  lb.setAttribute('aria-hidden', 'false');
  lb.classList.add('lightbox-open');
  document.body.classList.add('lightbox-active');

  // Focus the close button for accessibility
  setTimeout(() => document.getElementById('lb-close')?.focus(), 50);
}

/**
 * Close the lightbox.
 */
function closeLightbox() {
  const lb = document.getElementById('bwa-lightbox');
  if (!lb) return;
  lb.classList.remove('lightbox-open');
  lb.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('lightbox-active');
  _lightboxIdx = -1;

  // Return focus to the last clicked gallery item
  const focused = document.querySelector('.gallery-item[data-index]');
  focused?.focus();
}

/**
 * Navigate the lightbox by a relative step.
 *
 * @param {number} step - +1 for next, -1 for previous
 */
function navigateLightbox(step) {
  if (!_filtered.length) return;
  _lightboxIdx = (_lightboxIdx + step + _filtered.length) % _filtered.length;
  updateLightboxImage(_lightboxIdx);
}

/**
 * Update the lightbox image, caption, and counter for a given index.
 *
 * @param {number} idx - Index in `_filtered`
 */
function updateLightboxImage(idx) {
  const item = _filtered[idx];
  if (!item) return;

  const img     = document.getElementById('lb-img');
  const caption = document.getElementById('lb-caption');
  const counter = document.getElementById('lb-counter');
  const loader  = document.getElementById('lb-loader');
  const prevBtn = document.getElementById('lb-prev');
  const nextBtn = document.getElementById('lb-next');

  if (!img) return;

  // Show loader while image loads
  loader?.classList.add('active');
  img.style.opacity = '0';

  const src = item.image || item.url || 'assets/placeholder.jpg';
  const alt = item.caption || item.title || item.category || 'Gallery image';

  img.onload = () => {
    loader?.classList.remove('active');
    img.style.opacity = '1';
  };
  img.onerror = () => {
    loader?.classList.remove('active');
    img.src = 'assets/placeholder.jpg';
    img.style.opacity = '1';
  };

  img.src = src;
  img.alt = alt;

  if (caption) caption.textContent = item.caption || item.title || '';
  if (counter) counter.textContent = `${idx + 1} / ${_filtered.length}`;

  // Hide prev/next if only one image
  const single = _filtered.length <= 1;
  if (prevBtn) prevBtn.style.display = single ? 'none' : '';
  if (nextBtn) nextBtn.style.display = single ? 'none' : '';

  // Update aria-label counter
  document.getElementById('bwa-lightbox')?.setAttribute('aria-label',
    `Image ${idx + 1} of ${_filtered.length}: ${alt}`);
}

/**
 * Handle keyboard events for the lightbox.
 *
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleLightboxKey(e) {
  const lb = document.getElementById('bwa-lightbox');
  if (!lb || !lb.classList.contains('lightbox-open')) return;

  switch (e.key) {
    case 'Escape':
      e.preventDefault();
      closeLightbox();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      navigateLightbox(-1);
      break;
    case 'ArrowRight':
      e.preventDefault();
      navigateLightbox(1);
      break;
  }
}
