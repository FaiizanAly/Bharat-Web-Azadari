/**
 * announcements-admin.js — Announcements CRUD Admin Module
 * Bharat Web Azadari (BWA)
 *
 * Full Create / Read / Update / Delete for site announcements.
 * Data is persisted via Google Apps Script + Sheets.
 *
 * Dependencies: CONFIG, apiGet, apiPost, showToast (api.js), checkAuth, logout (auth.js)
 */

// ─── Module State ─────────────────────────────────────────────────────────────
let _announcements = [];    // Master list from API
let _editingId     = null;  // ID currently being edited (null = adding new)

// ─── Entry Point ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initAnnouncementsAdmin();
});

/**
 * initAnnouncementsAdmin()
 * ─────────────────────────
 * Auth check → wire up UI events → load data.
 */
async function initAnnouncementsAdmin() {
  const token = checkAuth();
  if (!token) return;

  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // "Add Announcement" button → open blank modal
  document.getElementById('add-announcement-btn')?.addEventListener('click', openAddModal);

  // Modal close / cancel
  document.getElementById('modal-close-btn')?.addEventListener('click',  closeModal);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);

  // Close on backdrop click
  document.getElementById('announcement-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'announcement-modal') closeModal();
  });

  // Form submit
  document.getElementById('announcement-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveAnnouncement();
  });

  // Search filter
  document.getElementById('announcements-search')?.addEventListener('input', _onSearch);

  // Set today's date as default for date field
  const dateField = document.getElementById('field-date');
  if (dateField && !dateField.value) {
    dateField.value = new Date().toISOString().slice(0, 10);
  }

  await loadAnnouncements();
}

// ─── Load & Render ────────────────────────────────────────────────────────────

/**
 * loadAnnouncements()
 * ────────────────────
 * Fetches all announcements from the API and renders the table.
 */
async function loadAnnouncements() {
  _showTableSkeleton();
  try {
    const res        = await apiGet('getAnnouncements', {});
    _announcements   = (res && res.announcements)
      ? res.announcements
      : (Array.isArray(res) ? res : []);

    // Sort by date descending (newest first)
    _announcements.sort((a, b) => new Date(b.date) - new Date(a.date));
    renderAnnouncementsTable(_announcements);
  } catch (err) {
    console.error('[BWA Announcements] Load error:', err);
    _showTableError('Failed to load announcements. Please try again.');
  }
}

/**
 * renderAnnouncementsTable(items)
 * ────────────────────────────────
 * Renders an HTML table of announcements into #announcements-table-body.
 *
 * @param {Array} items
 */
function renderAnnouncementsTable(items) {
  const tbody = document.getElementById('announcements-table-body');
  if (!tbody) return;

  // Update count badge
  const countEl = document.getElementById('announcements-count-badge');
  if (countEl) countEl.textContent = items.length;

  if (!items || items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-row">
          <div class="empty-state-small">
            <span>No announcements yet.</span>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = items.map(item => `
    <tr data-id="${_esc(item.id)}">
      <td class="td-title">
        <span class="fw-600">${_esc(item.title)}</span>
      </td>
      <td class="td-description">
        <span class="text-muted">${_esc(_truncate(item.description, 100))}</span>
      </td>
      <td class="td-date">
        ${_formatDate(item.date)}
      </td>
      <td class="td-actions">
        <button class="btn-icon btn-icon--edit"   onclick="openEditModal('${_esc(item.id)}')"   title="Edit" aria-label="Edit announcement">✏️</button>
        <button class="btn-icon btn-icon--delete" onclick="deleteAnnouncement('${_esc(item.id)}')" title="Delete" aria-label="Delete announcement">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// ─── Modal ────────────────────────────────────────────────────────────────────

/**
 * openAddModal()
 * ──────────────
 * Resets the form and opens the modal for a new announcement.
 */
function openAddModal() {
  _editingId = null;
  _resetForm();

  const titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.textContent = 'Add Announcement';

  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.textContent = 'Add Announcement';

  _openModal();
}

/**
 * openEditModal(id)
 * ─────────────────
 * Finds the announcement by ID, pre-fills the form, and opens the modal.
 *
 * @param {string} id - announcement ID
 */
function openEditModal(id) {
  const item = _announcements.find(a => String(a.id) === String(id));
  if (!item) {
    showToast('Announcement not found.', 'error');
    return;
  }

  _editingId = item.id;
  _populateForm(item);

  const titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.textContent = 'Edit Announcement';

  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.textContent = 'Save Changes';

  _openModal();
}

function closeModal() {
  const modal = document.getElementById('announcement-modal');
  if (modal) {
    modal.classList.remove('modal--open');
    modal.setAttribute('aria-hidden', 'true');
  }
  _editingId = null;
}

// ─── Save ─────────────────────────────────────────────────────────────────────

/**
 * saveAnnouncement()
 * ──────────────────
 * Reads form values, validates, calls addAnnouncement or updateAnnouncement API.
 */
async function saveAnnouncement() {
  const formData = _readFormData();

  // Validate
  if (!formData.title.trim()) {
    showToast('Title is required.', 'error');
    return;
  }
  if (!formData.description.trim()) {
    showToast('Description is required.', 'error');
    return;
  }

  const saveBtn = document.getElementById('modal-save-btn');
  _setButtonLoading(saveBtn, true, 'Saving…');

  try {
    let response;
    if (_editingId) {
      response = await apiPost('updateAnnouncement', { ...formData, id: _editingId });
    } else {
      response = await apiPost('addAnnouncement', formData);
    }

    if (response && response.success) {
      showToast(
        _editingId ? 'Announcement updated!' : 'Announcement added!',
        'success'
      );
      closeModal();
      await loadAnnouncements();
    } else {
      const msg = (response && response.message) || 'Failed to save announcement.';
      showToast(msg, 'error');
    }
  } catch (err) {
    console.error('[BWA Announcements] Save error:', err);
    showToast('Network error. Please try again.', 'error');
  } finally {
    _setButtonLoading(saveBtn, false, _editingId ? 'Save Changes' : 'Add Announcement');
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * deleteAnnouncement(id)
 * ──────────────────────
 * Confirmation dialog → delete via API → refresh table.
 *
 * @param {string} id - announcement ID
 */
async function deleteAnnouncement(id) {
  const item = _announcements.find(a => String(a.id) === String(id));
  const name = item ? item.title : 'this announcement';

  const confirmed = await _confirmDialog(
    `Delete "${name}"?`,
    'This action cannot be undone.'
  );
  if (!confirmed) return;

  // Optimistic fade
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (row) row.style.opacity = '0.4';

  try {
    const response = await apiPost('deleteAnnouncement', { id });

    if (response && response.success) {
      showToast('Announcement deleted.', 'success');
      await loadAnnouncements();
    } else {
      if (row) row.style.opacity = '';
      const msg = (response && response.message) || 'Failed to delete.';
      showToast(msg, 'error');
    }
  } catch (err) {
    console.error('[BWA Announcements] Delete error:', err);
    if (row) row.style.opacity = '';
    showToast('Network error. Please try again.', 'error');
  }
}

// ─── Search Filter ────────────────────────────────────────────────────────────

function _onSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    renderAnnouncementsTable(_announcements);
    return;
  }
  const filtered = _announcements.filter(a =>
    (a.title       || '').toLowerCase().includes(q) ||
    (a.description || '').toLowerCase().includes(q)
  );
  renderAnnouncementsTable(filtered);
}

// ─── Form Helpers ─────────────────────────────────────────────────────────────

function _readFormData() {
  return {
    title:       document.getElementById('field-title')?.value.trim()       || '',
    description: document.getElementById('field-description')?.value.trim() || '',
    date:        document.getElementById('field-date')?.value               || new Date().toISOString().slice(0, 10),
  };
}

function _populateForm(item) {
  _setValue('field-title',       item.title);
  _setValue('field-description', item.description);
  _setValue('field-date',        item.date ? item.date.slice(0, 10) : '');
}

function _resetForm() {
  document.getElementById('announcement-form')?.reset();
  // Reset date to today
  const dateField = document.getElementById('field-date');
  if (dateField) dateField.value = new Date().toISOString().slice(0, 10);
}

function _setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function _openModal() {
  const modal = document.getElementById('announcement-modal');
  if (modal) {
    modal.classList.add('modal--open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => document.getElementById('field-title')?.focus(), 100);
  }
}

function _showTableSkeleton() {
  const tbody = document.getElementById('announcements-table-body');
  if (!tbody) return;
  tbody.innerHTML = Array(4).fill(0).map(() => `
    <tr>
      <td><div class="skeleton-text" style="width:160px;"></div></td>
      <td><div class="skeleton-text" style="width:240px;"></div></td>
      <td><div class="skeleton-text" style="width:80px;"></div></td>
      <td></td>
    </tr>`).join('');
}

function _showTableError(msg) {
  const tbody = document.getElementById('announcements-table-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="empty-row error-row">${_esc(msg)}</td></tr>`;
}

function _setButtonLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled  = loading;
  btn.innerHTML = loading ? '<span class="spinner"></span> ' + label : label;
}

/**
 * _confirmDialog(title, message)
 * Returns a Promise<boolean> — resolves true on confirm, false on cancel.
 */
function _confirmDialog(title, message) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirm-modal');
    if (!modal) {
      resolve(window.confirm(`${title}\n${message}`));
      return;
    }

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

// ─── Utility Functions ────────────────────────────────────────────────────────

function _formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function _truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function _esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
