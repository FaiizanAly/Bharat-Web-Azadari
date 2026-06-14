/**
 * gallery-admin.js — Gallery Management Admin Module
 * Bharat Web Azadari (BWA)
 *
 * Add / view / delete gallery images with category support,
 * image URL preview, and bulk-delete selection.
 *
 * Dependencies: CONFIG, apiGet, apiPost, showToast (api.js), checkAuth, logout (auth.js)
 */

// ─── Module State ─────────────────────────────────────────────────────────────
let _galleryItems    = [];      // Full list from API
let _selectedIds     = new Set(); // IDs chosen for bulk delete
let _activeCategory  = 'all';    // Current category filter

// ─── Entry Point ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initGalleryAdmin();
});

/**
 * initGalleryAdmin()
 * ───────────────────
 * Auth check → wire up events → load data.
 */
async function initGalleryAdmin() {
  const token = checkAuth();
  if (!token) return;

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // Add-image button → open modal
  document.getElementById('add-gallery-btn')?.addEventListener('click', openAddModal);

  // Modal controls
  document.getElementById('modal-close-btn')?.addEventListener('click',  closeModal);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);
  document.getElementById('gallery-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'gallery-modal') closeModal();
  });

  // Form submit
  document.getElementById('gallery-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    addGalleryItem();
  });

  // Image URL preview
  document.getElementById('field-imageUrl')?.addEventListener('input', _onImageUrlInput);

  // Category filter buttons
  document.querySelectorAll('[data-category-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeCategory = btn.dataset.categoryFilter;
      document.querySelectorAll('[data-category-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _applyFilter();
    });
  });

  // Bulk delete button
  document.getElementById('bulk-delete-btn')?.addEventListener('click', _bulkDelete);

  // Select-all checkbox
  document.getElementById('select-all-cb')?.addEventListener('change', _onSelectAll);

  await loadGallery();
}

// ─── Load & Render ────────────────────────────────────────────────────────────

/**
 * loadGallery()
 * ─────────────
 * Fetches all gallery images from the API and renders the grid.
 */
async function loadGallery() {
  _showGridSkeleton();
  _selectedIds.clear();
  _updateBulkBar();

  try {
    const res      = await apiGet('getGallery', {});
    _galleryItems  = (res && res.images)
      ? res.images
      : (Array.isArray(res) ? res : []);

    _applyFilter();
  } catch (err) {
    console.error('[BWA Gallery] Load error:', err);
    _showGridError('Failed to load gallery. Please try again.');
  }
}

/**
 * renderGalleryGrid(items)
 * ─────────────────────────
 * Builds the masonry/CSS-grid of image thumbnails.
 * Each card has: image, caption, category badge, select checkbox,
 * and a delete button that appears on hover.
 *
 * @param {Array} items
 */
function renderGalleryGrid(items) {
  const grid    = document.getElementById('gallery-grid');
  const countEl = document.getElementById('gallery-count-badge');
  if (!grid) return;

  if (countEl) countEl.textContent = _galleryItems.length;

  if (!items || items.length === 0) {
    grid.innerHTML = `
      <div class="gallery-empty">
        <span class="gallery-empty__icon">🖼️</span>
        <p>No images in this category yet.</p>
        <button class="btn-primary btn-sm" onclick="openAddModal()">Add Image</button>
      </div>`;
    return;
  }

  grid.innerHTML = items.map(item => `
    <div class="gallery-card" data-id="${_esc(item.id)}">
      <!-- Select checkbox (shown in bulk-select mode) -->
      <label class="gallery-card__select-wrap" title="Select for bulk delete">
        <input
          type="checkbox"
          class="gallery-card__checkbox"
          value="${_esc(item.id)}"
          onchange="_onItemCheck(this, '${_esc(item.id)}')"
          ${_selectedIds.has(String(item.id)) ? 'checked' : ''}
          aria-label="Select image"
        >
      </label>

      <!-- Image -->
      <div class="gallery-card__img-wrap">
        <img
          src="${_esc(item.imageUrl)}"
          alt="${_esc(item.caption || '')}"
          class="gallery-card__img"
          loading="lazy"
          onerror="this.src='data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'150\'><rect fill=\'%23333\' width=\'200\' height=\'150\'/><text x=\'50%25\' y=\'50%25\' fill=\'%23888\' text-anchor=\'middle\' dy=\'.3em\'>No Image</text></svg>'"
        >
        <!-- Hover overlay with delete -->
        <div class="gallery-card__overlay">
          <button
            class="btn-icon btn-icon--delete gallery-card__delete-btn"
            onclick="deleteGalleryItem('${_esc(item.id)}')"
            title="Delete image"
            aria-label="Delete this image"
          >🗑️</button>
        </div>
      </div>

      <!-- Caption & Category -->
      <div class="gallery-card__info">
        ${item.caption ? `<p class="gallery-card__caption">${_esc(item.caption)}</p>` : ''}
        <span class="badge badge-category">${_esc(item.category || 'Other')}</span>
      </div>
    </div>
  `).join('');
}

// ─── Add Gallery Item ─────────────────────────────────────────────────────────

/**
 * addGalleryItem()
 * ─────────────────
 * Reads form, validates, POSTs to API, reloads gallery.
 */
async function addGalleryItem() {
  const formData = _readFormData();

  if (!formData.imageUrl) {
    showToast('Image URL is required.', 'error');
    return;
  }

  const saveBtn = document.getElementById('modal-save-btn');
  _setButtonLoading(saveBtn, true, 'Adding…');

  try {
    const response = await apiPost('addGallery', formData);

    if (response && response.success) {
      showToast('Image added to gallery!', 'success');
      closeModal();
      await loadGallery();
    } else {
      const msg = (response && response.message) || 'Failed to add image.';
      showToast(msg, 'error');
    }
  } catch (err) {
    console.error('[BWA Gallery] Add error:', err);
    showToast('Network error. Please try again.', 'error');
  } finally {
    _setButtonLoading(saveBtn, false, 'Add Image');
  }
}

// ─── Delete Gallery Item ──────────────────────────────────────────────────────

/**
 * deleteGalleryItem(id)
 * ──────────────────────
 * Confirm → delete via API → remove card from DOM immediately (optimistic).
 *
 * @param {string} id
 */
async function deleteGalleryItem(id) {
  const item = _galleryItems.find(i => String(i.id) === String(id));
  const name = item?.caption || 'this image';

  const confirmed = await _confirmDialog(
    `Delete "${name}"?`,
    'This will permanently remove the image from the gallery.'
  );
  if (!confirmed) return;

  // Optimistic: hide the card immediately
  const card = document.querySelector(`.gallery-card[data-id="${id}"]`);
  if (card) {
    card.style.opacity   = '0';
    card.style.transform = 'scale(0.9)';
    card.style.transition = 'all 0.3s ease';
  }

  try {
    const response = await apiPost('deleteGallery', { id });

    if (response && response.success) {
      showToast('Image deleted.', 'success');
      // Remove from local list and re-render to update count
      _galleryItems = _galleryItems.filter(i => String(i.id) !== String(id));
      _selectedIds.delete(String(id));
      _updateBulkBar();
      _applyFilter();
    } else {
      // Rollback
      if (card) { card.style.opacity = ''; card.style.transform = ''; }
      const msg = (response && response.message) || 'Failed to delete.';
      showToast(msg, 'error');
    }
  } catch (err) {
    console.error('[BWA Gallery] Delete error:', err);
    if (card) { card.style.opacity = ''; card.style.transform = ''; }
    showToast('Network error. Please try again.', 'error');
  }
}

// ─── Bulk Operations ──────────────────────────────────────────────────────────

/**
 * _bulkDelete()
 * ─────────────
 * Deletes all currently selected items after confirmation.
 */
async function _bulkDelete() {
  if (_selectedIds.size === 0) {
    showToast('No images selected.', 'info');
    return;
  }

  const confirmed = await _confirmDialog(
    `Delete ${_selectedIds.size} image(s)?`,
    'This action cannot be undone.'
  );
  if (!confirmed) return;

  const ids    = Array.from(_selectedIds);
  let   failed = 0;

  // Sequential deletes to avoid overwhelming the API
  for (const id of ids) {
    try {
      const response = await apiPost('deleteGallery', { id });
      if (response && response.success) {
        _galleryItems = _galleryItems.filter(i => String(i.id) !== String(id));
        _selectedIds.delete(String(id));
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  if (failed === 0) {
    showToast(`Deleted ${ids.length} image(s).`, 'success');
  } else {
    showToast(`Deleted ${ids.length - failed} image(s). ${failed} failed.`, 'warning');
  }

  _updateBulkBar();
  _applyFilter();
}

function _onItemCheck(checkbox, id) {
  if (checkbox.checked) {
    _selectedIds.add(String(id));
  } else {
    _selectedIds.delete(String(id));
  }
  _updateBulkBar();
}

function _onSelectAll(e) {
  const checked     = e.target.checked;
  const visible     = _getFilteredItems();

  visible.forEach(item => {
    if (checked) _selectedIds.add(String(item.id));
    else         _selectedIds.delete(String(item.id));
  });

  // Sync individual checkboxes
  document.querySelectorAll('.gallery-card__checkbox').forEach(cb => {
    cb.checked = checked;
  });

  _updateBulkBar();
}

function _updateBulkBar() {
  const count   = _selectedIds.size;
  const bar     = document.getElementById('bulk-action-bar');
  const countEl = document.getElementById('selected-count');

  if (bar) bar.style.display = count > 0 ? 'flex' : 'none';
  if (countEl) countEl.textContent = `${count} selected`;

  // Also update the select-all state
  const allCb   = document.getElementById('select-all-cb');
  const visible = _getFilteredItems();
  if (allCb && visible.length > 0) {
    allCb.indeterminate = count > 0 && count < visible.length;
    allCb.checked       = count === visible.length;
  }
}

// ─── Filter ───────────────────────────────────────────────────────────────────

function _applyFilter() {
  const filtered = _getFilteredItems();
  renderGalleryGrid(filtered);

  const countEl = document.getElementById('gallery-count-badge');
  if (countEl) countEl.textContent = _galleryItems.length;
}

function _getFilteredItems() {
  if (_activeCategory === 'all') return _galleryItems;
  return _galleryItems.filter(
    i => (i.category || 'Other').toLowerCase() === _activeCategory.toLowerCase()
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openAddModal() {
  _resetForm();
  _openModal();
}

function closeModal() {
  const modal = document.getElementById('gallery-modal');
  if (modal) {
    modal.classList.remove('modal--open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function _openModal() {
  const modal = document.getElementById('gallery-modal');
  if (modal) {
    modal.classList.add('modal--open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => document.getElementById('field-imageUrl')?.focus(), 100);
  }
}

// ─── Image Preview ────────────────────────────────────────────────────────────

function _onImageUrlInput(e) {
  const url     = e.target.value.trim();
  const preview = document.getElementById('image-preview');
  const hint    = document.getElementById('image-preview-hint');

  if (!preview) return;

  if (!url) {
    preview.style.display = 'none';
    if (hint) { hint.style.display = ''; hint.textContent = 'Paste an image URL above to preview.'; }
    return;
  }

  preview.src           = url;
  preview.style.display = 'block';
  if (hint) hint.style.display = 'none';

  preview.onerror = () => {
    preview.style.display = 'none';
    if (hint) { hint.style.display = ''; hint.textContent = '⚠️ Cannot load image from this URL.'; }
  };
}

// ─── Form Helpers ─────────────────────────────────────────────────────────────

function _readFormData() {
  return {
    imageUrl: document.getElementById('field-imageUrl')?.value.trim()  || '',
    caption:  document.getElementById('field-caption')?.value.trim()   || '',
    category: document.getElementById('field-category')?.value         || 'Other',
  };
}

function _resetForm() {
  document.getElementById('gallery-form')?.reset();
  const preview = document.getElementById('image-preview');
  if (preview) { preview.src = ''; preview.style.display = 'none'; }
  const hint = document.getElementById('image-preview-hint');
  if (hint) { hint.style.display = ''; hint.textContent = 'Paste an image URL above to preview.'; }
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function _showGridSkeleton() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  grid.innerHTML = Array(8).fill(0).map(() => `
    <div class="gallery-card skeleton-card">
      <div class="skeleton-box gallery-card__img-wrap"></div>
      <div class="gallery-card__info">
        <div class="skeleton-text" style="width:80%;"></div>
      </div>
    </div>`).join('');
}

function _showGridError(msg) {
  const grid = document.getElementById('gallery-grid');
  if (grid) grid.innerHTML = `<div class="gallery-empty error-row">${_esc(msg)}</div>`;
}

function _setButtonLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled  = loading;
  btn.innerHTML = loading ? '<span class="spinner"></span> ' + label : label;
}

function _confirmDialog(title, message) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirm-modal');
    if (!modal) { resolve(window.confirm(`${title}\n${message}`)); return; }

    const titleEl = document.getElementById('confirm-title');
    const msgEl   = document.getElementById('confirm-message');
    if (titleEl) titleEl.textContent = title;
    if (msgEl)   msgEl.textContent   = message;

    const okBtn     = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    const cleanup = (result) => {
      modal.classList.remove('modal--open');
      okBtn?.removeEventListener('click',     onOk);
      cancelBtn?.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk     = () => cleanup(true);
    const onCancel = () => cleanup(false);

    okBtn?.addEventListener('click',     onOk);
    cancelBtn?.addEventListener('click', onCancel);
    modal.classList.add('modal--open');
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function _esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
