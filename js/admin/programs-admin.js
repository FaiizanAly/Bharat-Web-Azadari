/**
 * programs-admin.js — Programs CRUD Admin Module
 * Bharat Web Azadari (BWA)
 *
 * Full Create / Read / Update / Delete for Majlis programs.
 * Data is persisted via Google Apps Script + Sheets.
 *
 * Dependencies: CONFIG, apiGet, apiPost, showToast (api.js), checkAuth, logout (auth.js)
 */

// ─── Module State ─────────────────────────────────────────────────────────────
let _programs       = [];     // Master list from API
let _editingId      = null;   // ID of the program currently being edited (null = adding new)

// ─── Entry Point ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initProgramsAdmin();
});

/**
 * initProgramsAdmin()
 * ────────────────────
 * Auth check → wire up UI events → load data.
 */
async function initProgramsAdmin() {
  const token = checkAuth();
  if (!token) return;

  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // "Add Program" button → open blank modal
  document.getElementById('add-program-btn')?.addEventListener('click', openAddModal);

  // Modal close / cancel buttons
  document.getElementById('modal-close-btn')?.addEventListener('click',  closeModal);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);

  // Close modal on backdrop click
  document.getElementById('program-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'program-modal') closeModal();
  });

  // Form submit
  document.getElementById('program-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveProgram();
  });

  // Image URL preview on input
  document.getElementById('field-imageUrl')?.addEventListener('input', _onImageUrlInput);

  // Search filter
  document.getElementById('programs-search')?.addEventListener('input', _onSearch);

  // Load the data
  await loadPrograms();
}

// ─── Load & Render ────────────────────────────────────────────────────────────

/**
 * loadPrograms()
 * ──────────────
 * Fetches all programs from the API and renders the table.
 */
async function loadPrograms() {
  _showTableSkeleton();
  try {
    const res  = await apiGet('getPrograms', {});
    _programs  = (res && res.programs) ? res.programs : (Array.isArray(res) ? res : []);
    // Sort by date descending
    _programs.sort((a, b) => new Date(b.date) - new Date(a.date));
    renderProgramsTable(_programs);
  } catch (err) {
    console.error('[BWA Programs] Load error:', err);
    _showTableError('Failed to load programs. Please try again.');
  }
}

/**
 * renderProgramsTable(programs)
 * ──────────────────────────────
 * Renders an HTML table of programs into #programs-table-body.
 *
 * @param {Array} programs
 */
function renderProgramsTable(programs) {
  const tbody = document.getElementById('programs-table-body');
  if (!tbody) return;

  // Update count badge
  const countEl = document.getElementById('programs-count-badge');
  if (countEl) countEl.textContent = programs.length;

  if (!programs || programs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">
          <div class="empty-state-small">
            <span>No programs found.</span>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = programs.map(p => {
    const statusBadge = _isPast(p.date)
      ? '<span class="badge badge-past">Past</span>'
      : '<span class="badge badge-upcoming">Upcoming</span>';

    const thumb = p.imageUrl
      ? `<img src="${_esc(p.imageUrl)}" alt="" class="table-thumb" loading="lazy" onerror="this.style.display='none'">`
      : '<div class="table-thumb table-thumb--placeholder">📷</div>';

    return `
      <tr data-id="${_esc(p.id)}">
        <td class="td-thumb">${thumb}</td>
        <td class="td-title">
          <span class="fw-600">${_esc(p.title)}</span>
          ${p.description ? `<br><small class="text-muted">${_esc(_truncate(p.description, 60))}</small>` : ''}
        </td>
        <td>${_formatDate(p.date)}</td>
        <td>${p.time ? _formatTime(p.time) : '—'}</td>
        <td>${_esc(p.location || '—')}</td>
        <td>${statusBadge}</td>
        <td class="td-actions">
          <button class="btn-icon btn-icon--edit"   onclick="openEditModal('${_esc(p.id)}')"   title="Edit" aria-label="Edit program">✏️</button>
          <button class="btn-icon btn-icon--delete" onclick="deleteProgram('${_esc(p.id)}')"   title="Delete" aria-label="Delete program">🗑️</button>
        </td>
      </tr>`;
  }).join('');
}

// ─── Modal ────────────────────────────────────────────────────────────────────

/**
 * openAddModal()
 * ──────────────
 * Resets the form and opens the modal for adding a new program.
 */
function openAddModal() {
  _editingId = null;
  _resetForm();

  const title = document.getElementById('modal-title');
  if (title) title.textContent = 'Add New Program';

  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.textContent = 'Add Program';

  _openModal();
}

/**
 * openEditModal(id)
 * ─────────────────
 * Finds the program by ID, pre-fills the form, and opens the modal.
 *
 * @param {string} id - program ID
 */
function openEditModal(id) {
  const program = _programs.find(p => String(p.id) === String(id));
  if (!program) {
    showToast('Program not found.', 'error');
    return;
  }

  _editingId = program.id;
  _populateForm(program);

  const title = document.getElementById('modal-title');
  if (title) title.textContent = 'Edit Program';

  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.textContent = 'Save Changes';

  _openModal();
}

function closeModal() {
  const modal = document.getElementById('program-modal');
  if (modal) {
    modal.classList.remove('modal--open');
    modal.setAttribute('aria-hidden', 'true');
  }
  _editingId = null;
}

// ─── Save ─────────────────────────────────────────────────────────────────────

/**
 * saveProgram()
 * ─────────────
 * Reads form values, validates, then calls addProgram or updateProgram via API.
 */
async function saveProgram() {
  const formData = _readFormData();

  // Client-side validation
  if (!formData.title.trim()) {
    showToast('Program title is required.', 'error');
    return;
  }
  if (!formData.date) {
    showToast('Program date is required.', 'error');
    return;
  }

  const saveBtn = document.getElementById('modal-save-btn');
  _setButtonLoading(saveBtn, true, 'Saving…');

  try {
    let response;
    if (_editingId) {
      // UPDATE existing
      response = await apiPost('updateProgram', { ...formData, id: _editingId });
    } else {
      // ADD new
      response = await apiPost('addProgram', formData);
    }

    if (response && response.success) {
      showToast(_editingId ? 'Program updated successfully!' : 'Program added successfully!', 'success');
      closeModal();
      await loadPrograms();   // Refresh table
    } else {
      const msg = (response && response.message) || 'Failed to save program.';
      showToast(msg, 'error');
    }
  } catch (err) {
    console.error('[BWA Programs] Save error:', err);
    showToast('Network error. Please try again.', 'error');
  } finally {
    _setButtonLoading(saveBtn, false, _editingId ? 'Save Changes' : 'Add Program');
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * deleteProgram(id)
 * ─────────────────
 * Shows a confirmation dialog, then deletes the program via API.
 *
 * @param {string} id - program ID
 */
async function deleteProgram(id) {
  const program = _programs.find(p => String(p.id) === String(id));
  const name    = program ? program.title : 'this program';

  const confirmed = await _confirmDialog(
    `Delete "${name}"?`,
    'This action cannot be undone.'
  );
  if (!confirmed) return;

  // Optimistically fade the row
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (row) row.style.opacity = '0.4';

  try {
    const response = await apiPost('deleteProgram', { id });

    if (response && response.success) {
      showToast('Program deleted.', 'success');
      await loadPrograms();
    } else {
      if (row) row.style.opacity = '';
      const msg = (response && response.message) || 'Failed to delete program.';
      showToast(msg, 'error');
    }
  } catch (err) {
    console.error('[BWA Programs] Delete error:', err);
    if (row) row.style.opacity = '';
    showToast('Network error. Please try again.', 'error');
  }
}

// ─── Form Helpers ─────────────────────────────────────────────────────────────

function _readFormData() {
  return {
    title:       document.getElementById('field-title')?.value.trim()    || '',
    description: document.getElementById('field-description')?.value.trim() || '',
    date:        document.getElementById('field-date')?.value            || '',
    time:        document.getElementById('field-time')?.value            || '',
    location:    document.getElementById('field-location')?.value.trim() || '',
    imageUrl:    document.getElementById('field-imageUrl')?.value.trim() || '',
  };
}

function _populateForm(program) {
  _setValue('field-title',       program.title);
  _setValue('field-description', program.description);
  _setValue('field-date',        program.date ? program.date.slice(0, 10) : '');
  _setValue('field-time',        program.time || '');
  _setValue('field-location',    program.location);
  _setValue('field-imageUrl',    program.imageUrl || '');

  // Show image preview if URL exists
  _updateImagePreview(program.imageUrl || '');
}

function _resetForm() {
  document.getElementById('program-form')?.reset();
  _updateImagePreview('');
}

function _setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

// ─── Image Preview ────────────────────────────────────────────────────────────

function _onImageUrlInput(e) {
  _updateImagePreview(e.target.value.trim());
}

function _updateImagePreview(url) {
  const preview = document.getElementById('image-preview');
  const hint    = document.getElementById('image-preview-hint');

  if (!preview) return;

  if (!url) {
    preview.style.display = 'none';
    preview.src = '';
    if (hint) hint.style.display = '';
    return;
  }

  preview.src     = url;
  preview.style.display = 'block';
  if (hint) hint.style.display = 'none';

  preview.onerror = () => {
    preview.style.display = 'none';
    if (hint) {
      hint.textContent  = '⚠️ Could not load image from this URL.';
      hint.style.display = '';
    }
  };
  preview.onload = () => {
    if (hint) {
      hint.textContent  = 'Paste an image URL above to preview it here.';
      hint.style.display = 'none';
    }
  };
}

// ─── Search Filter ────────────────────────────────────────────────────────────

function _onSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    renderProgramsTable(_programs);
    return;
  }
  const filtered = _programs.filter(p =>
    (p.title    || '').toLowerCase().includes(q) ||
    (p.location || '').toLowerCase().includes(q)
  );
  renderProgramsTable(filtered);
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function _openModal() {
  const modal = document.getElementById('program-modal');
  if (modal) {
    modal.classList.add('modal--open');
    modal.setAttribute('aria-hidden', 'false');
    // Focus first input for accessibility
    setTimeout(() => document.getElementById('field-title')?.focus(), 100);
  }
}

function _showTableSkeleton() {
  const tbody = document.getElementById('programs-table-body');
  if (!tbody) return;
  tbody.innerHTML = Array(4).fill(0).map(() => `
    <tr>
      <td><div class="skeleton-box" style="width:60px;height:40px;"></div></td>
      <td><div class="skeleton-text" style="width:140px;"></div></td>
      <td><div class="skeleton-text" style="width:80px;"></div></td>
      <td><div class="skeleton-text" style="width:60px;"></div></td>
      <td><div class="skeleton-text" style="width:100px;"></div></td>
      <td><div class="skeleton-text" style="width:60px;"></div></td>
      <td></td>
    </tr>`).join('');
}

function _showTableError(msg) {
  const tbody = document.getElementById('programs-table-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="empty-row error-row">${_esc(msg)}</td></tr>`;
}

function _setButtonLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled   = loading;
  btn.innerHTML  = loading ? '<span class="spinner"></span> ' + label : label;
}

/**
 * _confirmDialog(title, message)
 * ────────────────────────────────
 * Shows a custom confirm dialog (falls back to native confirm).
 * Returns a Promise<boolean>.
 */
function _confirmDialog(title, message) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirm-modal');
    if (!modal) {
      resolve(window.confirm(`${title}\n${message}`));
      return;
    }

    document.getElementById('confirm-title')?.textContent  !== undefined &&
      (document.getElementById('confirm-title').textContent  = title);
    document.getElementById('confirm-message')?.textContent !== undefined &&
      (document.getElementById('confirm-message').textContent = message);

    const okBtn     = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    const cleanup = (result) => {
      modal.classList.remove('modal--open');
      okBtn?.removeEventListener('click', onOk);
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

function _formatTime(timeStr) {
  if (!timeStr) return '—';
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hh     = h % 12 || 12;
    return `${hh}:${String(m).padStart(2, '0')} ${period}`;
  } catch {
    return timeStr;
  }
}

function _isPast(dateStr) {
  return dateStr && new Date(dateStr) < new Date();
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
