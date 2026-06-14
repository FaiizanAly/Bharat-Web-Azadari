// ============================================================
// BHARAT WEB AZADARI — Programs Page (programs.js)
// Loads programs from GAS, renders cards with status badges,
// provides filter tabs, and shows compact countdowns.
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initPrograms();
});

/* ─────────────────────────────────────────────────────────
   State
   ───────────────────────────────────────────────────────── */

/** All programs fetched from GAS (used for filtering) */
let _allPrograms = [];

/** Currently active filter tab */
let _activeFilter = 'all';

/* ─────────────────────────────────────────────────────────
   1. Init
   ───────────────────────────────────────────────────────── */

/**
 * Fetch programs from GAS, sort them (upcoming first, past last),
 * render the grid, and wire up the filter buttons.
 */
async function initPrograms() {
  const grid = document.getElementById('programs-grid');
  if (!grid) return;

  grid.innerHTML = generateSkeletons(6, 'program-skeleton');
  initFilterButtons();

  try {
    const res = await apiGet('getPrograms');
    _allPrograms = Array.isArray(res.data) ? res.data : [];

    // Sort: today first, upcoming next, past last — within groups by date
    _allPrograms.sort((a, b) => {
      const statusA = getProgramStatus(a);
      const statusB = getProgramStatus(b);
      const order = { today: 0, upcoming: 1, past: 2 };
      const diff = order[statusA] - order[statusB];
      if (diff !== 0) return diff;
      // Within same group, ascending date
      return new Date(a.date) - new Date(b.date);
    });

    renderPrograms(_allPrograms);
  } catch (err) {
    console.error('[BWA] initPrograms error:', err);
    grid.innerHTML = `
      <div class="error-state col-span-full" role="alert">
        <div class="error-icon" aria-hidden="true">⚠️</div>
        <h3>Could not load programs</h3>
        <p>Please check your internet connection and try refreshing the page.</p>
      </div>
    `;
  }
}

/* ─────────────────────────────────────────────────────────
   2. Filter Buttons
   ───────────────────────────────────────────────────────── */

/**
 * Wire up the filter tab buttons (All | Upcoming | Today | Past).
 * Reads `.filter-btn` elements with `data-filter` attribute.
 */
function initFilterButtons() {
  const filterBtns = document.querySelectorAll('.filter-btn[data-filter]');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      _activeFilter = btn.dataset.filter;
      filterBtns.forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', String(b === btn));
      });
      applyFilter();
    });
  });
}

/**
 * Filter the programs array by the active filter and re-render.
 */
function applyFilter() {
  if (!_allPrograms.length) return;

  let filtered;
  switch (_activeFilter) {
    case 'upcoming':
      filtered = _allPrograms.filter(p => getProgramStatus(p) === 'upcoming');
      break;
    case 'today':
      filtered = _allPrograms.filter(p => getProgramStatus(p) === 'today');
      break;
    case 'past':
      filtered = _allPrograms.filter(p => getProgramStatus(p) === 'past').reverse(); // newest past first
      break;
    default:
      filtered = _allPrograms;
  }

  renderPrograms(filtered, true);
}

/* ─────────────────────────────────────────────────────────
   3. Render
   ───────────────────────────────────────────────────────── */

/**
 * Render an array of programs into `#programs-grid`.
 *
 * @param {Array}   programs    - Programs to render
 * @param {boolean} [animate=false] - Apply CSS filter-transition animation
 */
function renderPrograms(programs, animate = false) {
  const grid = document.getElementById('programs-grid');
  if (!grid) return;

  if (!programs.length) {
    grid.innerHTML = renderEmptyState(_activeFilter);
    return;
  }

  if (animate) {
    grid.classList.add('filtering');
    setTimeout(() => grid.classList.remove('filtering'), 300);
  }

  grid.innerHTML = programs.map(p => renderProgram(p)).join('');
}

/**
 * Generate HTML for a single program card.
 *
 * @param {Object} program - Program data object from GAS
 * @returns {string} HTML string for the program card
 */
function renderProgram(program) {
  const status = getProgramStatus(program);
  const statusLabels = { today: 'TODAY', upcoming: 'UPCOMING', past: 'PAST' };
  const statusLabel = statusLabels[status] || 'PROGRAM';

  // Image or illustrated placeholder
  const imageHtml = program.image
    ? `<img src="${sanitizeHTML(program.image)}" alt="${sanitizeHTML(program.title)}" class="program-card-img" loading="lazy" onerror="this.src='assets/placeholder.jpg'">`
    : `<div class="program-img-placeholder" aria-hidden="true">
         <span class="program-placeholder-icon">${status === 'past' ? '🕌' : '📅'}</span>
       </div>`;

  // Compact countdown only for upcoming/today programs
  const countdownHtml = (status === 'upcoming' || status === 'today')
    ? renderCompactCountdown(program.date, program.time)
    : `<p class="program-past-label">Program Completed</p>`;

  // Truncate description
  const MAX = 150;
  const desc = program.description || '';
  const descId = `desc-${Math.random().toString(36).slice(2, 8)}`;
  const truncated = desc.length > MAX;
  const descPreview = truncated ? desc.slice(0, MAX).trimEnd() + '…' : desc;

  return `
    <article class="program-card status-${status}" data-animate="fade-up" data-status="${status}">
      <div class="program-card-visual">
        ${imageHtml}
        <span class="program-status-badge badge-${status}" aria-label="Status: ${statusLabel}">${statusLabel}</span>
      </div>
      <div class="program-card-body">
        <h3 class="program-card-title">${sanitizeHTML(program.title)}</h3>
        <div class="program-card-meta">
          <span class="program-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <time datetime="${sanitizeHTML(program.date)}">${formatDate(program.date)}</time>
          </span>
          ${program.time ? `
          <span class="program-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${sanitizeHTML(program.time)}
          </span>` : ''}
          ${program.location ? `
          <span class="program-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${sanitizeHTML(program.location)}
          </span>` : ''}
        </div>
        ${desc ? `
          <div class="program-desc-wrapper">
            <p class="program-desc" id="${descId}">${sanitizeHTML(descPreview)}</p>
            ${truncated ? `
              <button class="btn-text read-more-btn"
                aria-expanded="false"
                aria-controls="${descId}"
                data-full="${sanitizeHTML(desc)}"
                data-preview="${sanitizeHTML(descPreview)}"
                onclick="toggleReadMore(this)"
              >Read More</button>` : ''}
          </div>
        ` : ''}
        ${countdownHtml}
      </div>
    </article>
  `;
}

/**
 * Generate a compact inline countdown (X days / hours remaining)
 * for upcoming / today program cards.
 *
 * @param {string} dateStr    - Program date (YYYY-MM-DD)
 * @param {string} [timeStr='00:00'] - Program time (HH:MM)
 * @returns {string} HTML string
 */
function renderCompactCountdown(dateStr, timeStr = '00:00') {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour = 0, minute = 0] = (timeStr || '00:00').split(':').map(Number);
    const target = new Date(year, month - 1, day, hour, minute);
    const now = new Date();
    const diff = target - now;

    if (diff <= 0) return '<p class="program-happening">Happening now!</p>';

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);

    let label;
    if (days > 0) label = `${days} day${days !== 1 ? 's' : ''} remaining`;
    else label = `${hours} hour${hours !== 1 ? 's' : ''} remaining`;

    return `
      <p class="program-compact-countdown" aria-label="Time until event: ${label}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${label}
      </p>
    `;
  } catch (_) {
    return '';
  }
}

/* ─────────────────────────────────────────────────────────
   4. Empty State
   ───────────────────────────────────────────────────────── */

/**
 * Render an empty-state message appropriate to the active filter.
 *
 * @param {string} filter - Active filter key
 * @returns {string} HTML string
 */
function renderEmptyState(filter) {
  const messages = {
    upcoming: { icon: '📅', title: 'No Upcoming Programs', text: 'New programs will be announced soon. Stay tuned!' },
    today:    { icon: '🕌', title: 'No Programs Today',    text: 'There are no programs scheduled for today.' },
    past:     { icon: '📜', title: 'No Past Programs',     text: 'Past programs will appear here once events have concluded.' },
    all:      { icon: '📅', title: 'No Programs Found',    text: 'Programs will be listed here once they are added.' },
  };
  const { icon, title, text } = messages[filter] || messages.all;
  return `
    <div class="empty-state col-span-full">
      <div class="empty-icon" aria-hidden="true">${icon}</div>
      <h3>${title}</h3>
      <p>${text}</p>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────
   5. Helpers
   ───────────────────────────────────────────────────────── */

/**
 * Determine the status of a program relative to today.
 *
 * @param {Object} program - Program object with `date` field
 * @returns {'today'|'upcoming'|'past'} Status string
 */
function getProgramStatus(program) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const progDate = new Date(program.date);
  const progDay  = new Date(progDate.getFullYear(), progDate.getMonth(), progDate.getDate());

  if (progDay.getTime() === today.getTime()) return 'today';
  if (progDay > today) return 'upcoming';
  return 'past';
}

/**
 * Toggle the "Read More / Read Less" state on a description block.
 *
 * @param {HTMLButtonElement} btn - The button element that was clicked
 */
function toggleReadMore(btn) {
  const descEl   = document.getElementById(btn.getAttribute('aria-controls'));
  const isExpanded = btn.getAttribute('aria-expanded') === 'true';

  if (isExpanded) {
    descEl.textContent = btn.dataset.preview;
    btn.textContent = 'Read More';
    btn.setAttribute('aria-expanded', 'false');
  } else {
    descEl.textContent = btn.dataset.full;
    btn.textContent = 'Read Less';
    btn.setAttribute('aria-expanded', 'true');
  }
}
