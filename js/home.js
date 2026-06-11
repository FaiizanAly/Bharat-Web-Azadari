// ============================================================
// BHARAT WEB AZADARI — Home Page (home.js)
// Initialises all dynamic sections on the homepage:
//   1. Upcoming Program + Countdown
//   2. Live Stream embed
//   3. Latest Videos (YouTube RSS)
//   4. Announcements
//   5. Featured Video
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initUpcomingProgram();
  initLiveStream();
  initLatestVideos();
  initAnnouncements();
});

/* ─────────────────────────────────────────────────────────
   1. Upcoming Program + Countdown
   ───────────────────────────────────────────────────────── */

/** Active countdown interval so it can be cleared on refresh */
let _countdownInterval = null;

/**
 * Fetch programs from GAS, find the nearest upcoming event, render
 * its details in `#upcoming-program`, and start a live countdown.
 */
async function initUpcomingProgram() {
  const section = document.getElementById('upcoming-program');
  if (!section) return;

  const content = section.querySelector('.upcoming-content') || section;
  showLoader(content);

  try {
    const res = await apiGet('getPrograms');
    const programs = Array.isArray(res.data) ? res.data : [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter upcoming (today or future) and sort ascending
    const upcoming = programs
      .filter(p => {
        const d = new Date(p.date);
        return !isNaN(d) && d >= today;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    hideLoader(content);

    if (!upcoming.length) {
      renderNoUpcoming(content);
      return;
    }

    renderUpcomingProgram(content, upcoming[0]);
    startCountdown(upcoming[0].date, upcoming[0].time || '00:00');
  } catch (err) {
    console.error('[BWA] initUpcomingProgram error:', err);
    hideLoader(content);
    renderNoUpcoming(content);
  }
}

/**
 * Render the upcoming program card HTML into the given container.
 *
 * @param {HTMLElement} container - Target container element
 * @param {Object} program        - Program data object from GAS
 */
function renderUpcomingProgram(container, program) {
  const imageHtml = program.image
    ? `<img src="${sanitizeHTML(program.image)}" alt="${sanitizeHTML(program.title)}" class="upcoming-img" loading="lazy" onerror="this.src='assets/placeholder.jpg'">`
    : `<div class="upcoming-img-placeholder" aria-hidden="true"><span class="upcoming-placeholder-icon">🕌</span></div>`;

  container.innerHTML = `
    <div class="upcoming-card" data-animate="fade-up">
      <div class="upcoming-visual">
        ${imageHtml}
        <div class="upcoming-badge">Next Program</div>
      </div>
      <div class="upcoming-details">
        <h3 class="upcoming-title">${sanitizeHTML(program.title)}</h3>
        <div class="upcoming-meta">
          <span class="upcoming-meta-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${formatDate(program.date)}
          </span>
          ${program.time ? `
          <span class="upcoming-meta-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${sanitizeHTML(program.time)}
          </span>` : ''}
          ${program.location ? `
          <span class="upcoming-meta-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${sanitizeHTML(program.location)}
          </span>` : ''}
        </div>
        ${program.description ? `<p class="upcoming-desc">${sanitizeHTML(program.description)}</p>` : ''}
        <!-- Countdown Timer -->
        <div class="countdown-timer" id="countdown-timer" aria-label="Time remaining until event">
          <div class="countdown-unit">
            <span class="countdown-value" id="cd-days">00</span>
            <span class="countdown-label">Days</span>
          </div>
          <span class="countdown-sep" aria-hidden="true">:</span>
          <div class="countdown-unit">
            <span class="countdown-value" id="cd-hours">00</span>
            <span class="countdown-label">Hours</span>
          </div>
          <span class="countdown-sep" aria-hidden="true">:</span>
          <div class="countdown-unit">
            <span class="countdown-value" id="cd-minutes">00</span>
            <span class="countdown-label">Minutes</span>
          </div>
          <span class="countdown-sep" aria-hidden="true">:</span>
          <div class="countdown-unit">
            <span class="countdown-value" id="cd-seconds">00</span>
            <span class="countdown-label">Seconds</span>
          </div>
        </div>
        <a href="programs.html" class="btn btn-gold btn-sm upcoming-cta">View All Programs</a>
      </div>
    </div>
  `;
}

/**
 * Show a friendly placeholder when no upcoming programs exist.
 *
 * @param {HTMLElement} container - Target container element
 */
function renderNoUpcoming(container) {
  container.innerHTML = `
    <div class="empty-state" data-animate="fade-up">
      <div class="empty-icon" aria-hidden="true">📅</div>
      <h3>No Upcoming Programs</h3>
      <p>Check back soon for announcements of our next Majlis and Juloos events.</p>
      <a href="programs.html" class="btn btn-gold btn-sm">View Past Programs</a>
    </div>
  `;
}

/**
 * Start a live countdown timer that updates every second.
 * Writes into the #cd-days, #cd-hours, #cd-minutes, #cd-seconds elements.
 *
 * @param {string} targetDateStr - ISO date string (YYYY-MM-DD)
 * @param {string} [targetTimeStr='00:00'] - Time string (HH:MM or HH:MM:SS)
 */
function startCountdown(targetDateStr, targetTimeStr = '00:00') {
  if (_countdownInterval) clearInterval(_countdownInterval);

  const [year, month, day] = targetDateStr.split('-').map(Number);
  const [hour = 0, minute = 0, second = 0] = targetTimeStr.split(':').map(Number);
  const targetDate = new Date(year, month - 1, day, hour, minute, second);

  function tick() {
    const now = new Date();
    const diff = targetDate - now;

    const daysEl    = document.getElementById('cd-days');
    const hoursEl   = document.getElementById('cd-hours');
    const minutesEl = document.getElementById('cd-minutes');
    const secondsEl = document.getElementById('cd-seconds');

    if (!daysEl) { clearInterval(_countdownInterval); return; }

    if (diff <= 0) {
      clearInterval(_countdownInterval);
      daysEl.textContent = hoursEl.textContent = minutesEl.textContent = secondsEl.textContent = '00';
      const timer = document.getElementById('countdown-timer');
      if (timer) {
        timer.insertAdjacentHTML('afterend', '<p class="countdown-happening">Event is happening now!</p>');
        timer.remove();
      }
      return;
    }

    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    daysEl.textContent    = String(d).padStart(2, '0');
    hoursEl.textContent   = String(h).padStart(2, '0');
    minutesEl.textContent = String(m).padStart(2, '0');
    secondsEl.textContent = String(s).padStart(2, '0');
  }

  tick();
  _countdownInterval = setInterval(tick, 1000);
}

/* ─────────────────────────────────────────────────────────
   2. Live Stream
   ───────────────────────────────────────────────────────── */

/**
 * Fetch live stream status from GAS.
 * If live: show the `#live-section` with a YouTube embed.
 * If not live: hide the section entirely.
 */
async function initLiveStream() {
  const section = document.getElementById('live-section');
  if (!section) return;

  try {
    const res = await apiGet('getLiveStream');
    const data = res.data || res;

    const isLive = String(data.isLive).toUpperCase() === 'TRUE';
    const liveUrl = data.liveUrl || data.url || '';

    if (!isLive || !liveUrl) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    const embedId = extractYouTubeId(liveUrl);
    if (!embedId) { section.style.display = 'none'; return; }

    const embedContainer = section.querySelector('.live-embed') || section;
    embedContainer.innerHTML = `
      <div class="live-header">
        <span class="live-badge" aria-label="Currently live">
          <span class="live-dot" aria-hidden="true"></span>
          LIVE NOW
        </span>
        <h2 class="live-title">${sanitizeHTML(data.title || 'Live Majlis')}</h2>
      </div>
      <div class="video-embed-wrapper">
        <iframe
          src="https://www.youtube.com/embed/${embedId}?autoplay=1&mute=1&rel=0"
          title="${sanitizeHTML(data.title || 'BWA Live Stream')}"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          loading="lazy"
        ></iframe>
      </div>
      <a href="${sanitizeHTML(liveUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-gold live-yt-btn">
        Watch on YouTube ↗
      </a>
    `;
  } catch (err) {
    console.error('[BWA] initLiveStream error:', err);
    if (section) section.style.display = 'none';
  }
}

/**
 * Extract the YouTube video ID from various YouTube URL formats.
 *
 * @param {string} url - YouTube URL (watch, youtu.be, embed, live)
 * @returns {string|null} Video ID or null if not found
 */
function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /[?&]v=([^&#]+)/,
    /youtu\.be\/([^?&#]+)/,
    /embed\/([^?&#]+)/,
    /live\/([^?&#]+)/,
    /shorts\/([^?&#]+)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/* ─────────────────────────────────────────────────────────
   3. Latest Videos (YouTube RSS)
   ───────────────────────────────────────────────────────── */

/**
 * Fetch the latest videos from the BWA YouTube channel via RSS
 * (using the allorigins.win CORS proxy), parse the XML, and render
 * the first 6 video cards in `#videos-grid`.
 * Also delegates the first video as the Featured Video.
 */
async function initLatestVideos() {
  const grid = document.getElementById('videos-grid');
  if (!grid) return;

  // Show skeleton loaders
  grid.innerHTML = generateSkeletons(6, 'video-skeleton');

  try {
    const channelId = CONFIG.YOUTUBE_CHANNEL_ID;
    if (!channelId || channelId === 'YOUR_YOUTUBE_CHANNEL_ID_HERE') {
      throw new Error('YouTube Channel ID not configured.');
    }

    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const proxyUrl = CONFIG.CORS_PROXY + encodeURIComponent(feedUrl);

    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);

    const json = await response.json();
    const xmlString = json.contents;
    if (!xmlString) throw new Error('Empty RSS response.');

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) throw new Error('XML parse error.');

    const entries = Array.from(xmlDoc.querySelectorAll('entry')).slice(0, 6);
    if (!entries.length) throw new Error('No video entries found.');

    const videos = entries.map(entry => {
      const videoId = entry.querySelector('videoId')?.textContent ||
                      entry.querySelector('[name="videoId"]')?.textContent || '';
      const title   = entry.querySelector('title')?.textContent || 'Untitled Video';
      const published = entry.querySelector('published')?.textContent || '';
      const link    = entry.querySelector('link')?.getAttribute('href') || '';
      return {
        id: videoId,
        title,
        published,
        url: link || `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      };
    }).filter(v => v.id);

    if (!videos.length) throw new Error('No valid videos after parsing.');

    // Render featured video
    initFeaturedVideo(videos[0]);

    // Render video cards
    grid.innerHTML = videos.map(v => renderVideoCard(v)).join('');

  } catch (err) {
    console.error('[BWA] initLatestVideos error:', err);
    grid.innerHTML = `
      <div class="error-state" role="alert">
        <div class="error-icon" aria-hidden="true">📺</div>
        <h3>Could not load videos</h3>
        <p>Visit our YouTube channel to watch our latest programs.</p>
        <a href="${CONFIG.YOUTUBE_CHANNEL_URL}" target="_blank" rel="noopener noreferrer" class="btn btn-gold btn-sm">
          Visit YouTube Channel ↗
        </a>
      </div>
    `;
  }
}

/**
 * Generate the HTML for a single video card.
 *
 * @param {Object} video - Video object with id, title, published, url, thumbnail
 * @returns {string} HTML string for the video card
 */
function renderVideoCard(video) {
  return `
    <article class="video-card" data-animate="fade-up" tabindex="0"
      onclick="window.open('${sanitizeHTML(video.url)}', '_blank', 'noopener,noreferrer')"
      onkeydown="if(event.key==='Enter'||event.key===' ')window.open('${sanitizeHTML(video.url)}','_blank','noopener,noreferrer')"
      role="link"
      aria-label="Watch: ${sanitizeHTML(video.title)}"
    >
      <div class="video-thumb-wrapper">
        <img
          src="${sanitizeHTML(video.thumbnail)}"
          alt="${sanitizeHTML(video.title)}"
          class="video-thumb"
          loading="lazy"
          onerror="this.src='assets/placeholder.jpg'"
        >
        <div class="video-play-overlay" aria-hidden="true">
          <svg class="play-icon" viewBox="0 0 24 24" width="48" height="48" fill="white">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
        <div class="video-duration-badge" aria-hidden="true">▶ YouTube</div>
      </div>
      <div class="video-info">
        <h3 class="video-title">${sanitizeHTML(video.title)}</h3>
        <p class="video-date">
          <time datetime="${sanitizeHTML(video.published)}">${timeAgo(video.published)}</time>
        </p>
      </div>
    </article>
  `;
}

/* ─────────────────────────────────────────────────────────
   4. Announcements
   ───────────────────────────────────────────────────────── */

/**
 * Fetch the latest 3 announcements from GAS and render them
 * in `#announcements-list`.
 */
async function initAnnouncements() {
  const list = document.getElementById('announcements-list');
  if (!list) return;

  showLoader(list);

  try {
    const res = await apiGet('getAnnouncements');
    const announcements = Array.isArray(res.data) ? res.data : [];

    hideLoader(list);

    if (!announcements.length) {
      list.innerHTML = `
        <div class="empty-state">
          <p>No announcements at this time. Check back soon!</p>
        </div>
      `;
      return;
    }

    const latest = announcements.slice(0, 3);
    list.innerHTML = latest.map(a => renderAnnouncement(a)).join('');
  } catch (err) {
    console.error('[BWA] initAnnouncements error:', err);
    hideLoader(list);
    list.innerHTML = `
      <div class="error-state" role="alert">
        <p>Could not load announcements. Please try again later.</p>
      </div>
    `;
  }
}

/**
 * Generate the HTML for a single announcement card.
 *
 * @param {Object} announcement - Announcement object from GAS
 * @returns {string} HTML string for the announcement card
 */
function renderAnnouncement(announcement) {
  // Truncate description to ~120 chars for preview
  const MAX_CHARS = 120;
  const desc = announcement.description || announcement.message || '';
  const preview = desc.length > MAX_CHARS ? desc.slice(0, MAX_CHARS).trimEnd() + '…' : desc;

  return `
    <article class="announcement-card" data-animate="fade-up">
      <div class="announcement-date-pill">
        <time datetime="${sanitizeHTML(announcement.date)}">
          ${formatDateShort(announcement.date)}
        </time>
      </div>
      <div class="announcement-body">
        <h3 class="announcement-title">${sanitizeHTML(announcement.title)}</h3>
        ${preview ? `<p class="announcement-preview">${sanitizeHTML(preview)}</p>` : ''}
      </div>
    </article>
  `;
}

/* ─────────────────────────────────────────────────────────
   5. Featured Video
   ───────────────────────────────────────────────────────── */

/**
 * Render the first YouTube video as a large featured card
 * in `#featured-video`.
 *
 * @param {Object} video - First video from the RSS feed
 */
function initFeaturedVideo(video) {
  const container = document.getElementById('featured-video');
  if (!container || !video) return;

  container.innerHTML = `
    <article class="featured-video-card" data-animate="fade-up">
      <div class="featured-thumb-wrapper">
        <img
          src="${sanitizeHTML(video.thumbnail.replace('hqdefault', 'maxresdefault'))}"
          alt="${sanitizeHTML(video.title)}"
          class="featured-thumb"
          loading="lazy"
          onerror="this.src='${sanitizeHTML(video.thumbnail)}'"
        >
        <a href="${sanitizeHTML(video.url)}" target="_blank" rel="noopener noreferrer"
           class="featured-play-btn" aria-label="Watch featured video: ${sanitizeHTML(video.title)}">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="white" aria-hidden="true">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </a>
        <div class="featured-badge">Latest Upload</div>
      </div>
      <div class="featured-info">
        <h3 class="featured-title">${sanitizeHTML(video.title)}</h3>
        <p class="featured-meta">
          <time datetime="${sanitizeHTML(video.published)}">${formatDate(video.published)}</time>
        </p>
        <a href="${sanitizeHTML(video.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-gold btn-sm">
          Watch Video ↗
        </a>
      </div>
    </article>
  `;
}
