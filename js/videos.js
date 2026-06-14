// ============================================================
// BHARAT WEB AZADARI — Videos Page (videos.js)
// Fetches the YouTube RSS feed via CORS proxy, parses XML,
// and renders video cards. Includes skeleton loaders and
// graceful error handling.
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initVideos();
});

/* ─────────────────────────────────────────────────────────
   1. Init
   ───────────────────────────────────────────────────────── */

/**
 * Fetch all videos (up to 15) from the BWA YouTube channel RSS
 * feed and render them in `#videos-grid`.
 *
 * Also renders the channel info bar at the top.
 */
async function initVideos() {
  const grid = document.getElementById('videos-grid');
  if (!grid) return;

  // Render skeleton loaders immediately
  grid.innerHTML = generateSkeletons(6, 'video-page-skeleton');

  renderChannelInfo();

  try {
    const channelId = CONFIG.YOUTUBE_CHANNEL_ID;
    if (!channelId || channelId === 'YOUR_YOUTUBE_CHANNEL_ID_HERE') {
      throw new Error('YouTube Channel ID is not configured. Please update js/config.js.');
    }

    const feedUrl  = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const proxyUrl = CONFIG.CORS_PROXY + encodeURIComponent(feedUrl);

    const response = await fetch(proxyUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`RSS fetch failed with status ${response.status}`);

    const json = await response.json();
    const xmlString = json.contents;
    if (!xmlString) throw new Error('Proxy returned empty contents.');

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

    // Check for XML parse errors
    if (xmlDoc.querySelector('parsererror')) {
      throw new Error('Failed to parse YouTube RSS XML.');
    }

    const entries = Array.from(xmlDoc.querySelectorAll('entry')).slice(0, 15);
    if (!entries.length) throw new Error('No video entries found in feed.');

    const videos = entries.map(parseVideoEntry).filter(v => v && v.id);

    if (!videos.length) throw new Error('No valid videos after parsing.');

    grid.innerHTML = videos.map(v => renderVideo(v)).join('');
  } catch (err) {
    console.error('[BWA] initVideos error:', err);
    grid.innerHTML = `
      <div class="error-state col-span-full" role="alert">
        <div class="error-icon" aria-hidden="true">📺</div>
        <h3>Could not load videos</h3>
        <p>${err.message || 'An unexpected error occurred.'}</p>
        <p>You can still watch all our videos directly on YouTube:</p>
        <a
          href="${CONFIG.YOUTUBE_CHANNEL_URL}"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-gold"
          aria-label="Visit Bharat Web Azadari on YouTube"
        >
          Visit Our YouTube Channel ↗
        </a>
      </div>
    `;
  }
}

/* ─────────────────────────────────────────────────────────
   2. Parse XML Entry
   ───────────────────────────────────────────────────────── */

/**
 * Parse a single `<entry>` element from the YouTube RSS feed.
 *
 * YouTube RSS namespace: yt:videoId, yt:channelId, media:group, etc.
 * We use querySelector which ignores namespace prefixes in most browsers
 * when the local name matches — this is the most reliable cross-browser approach.
 *
 * @param {Element} entry - XML `<entry>` element
 * @returns {Object|null} Video data object or null if invalid
 */
function parseVideoEntry(entry) {
  try {
    // yt:videoId — YouTube-specific element
    const videoId = entry.querySelector('videoId')?.textContent?.trim() ||
                    entry.getElementsByTagNameNS('http://www.youtube.com/xml/schemas/2015', 'videoId')[0]?.textContent?.trim() ||
                    '';

    if (!videoId) return null;

    const title     = entry.querySelector('title')?.textContent?.trim() || 'Untitled Video';
    const published = entry.querySelector('published')?.textContent?.trim() || '';
    const updated   = entry.querySelector('updated')?.textContent?.trim() || published;
    const link      = entry.querySelector('link')?.getAttribute('href') || `https://www.youtube.com/watch?v=${videoId}`;

    // Media group description (optional)
    const description = entry.querySelector('description')?.textContent?.trim() ||
                        entry.querySelector('media\\:description, description')?.textContent?.trim() || '';

    return {
      id: videoId,
      title,
      published,
      updated,
      url: link,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      thumbnailMax: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      description,
    };
  } catch (err) {
    console.warn('[BWA] parseVideoEntry failed:', err);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────
   3. Render Video Card
   ───────────────────────────────────────────────────────── */

/**
 * Generate the HTML for a single video card.
 * Clicking the card opens the YouTube video in a new tab.
 *
 * @param {Object} video - Parsed video object
 * @returns {string} HTML string for the video card
 */
function renderVideo(video) {
  // Truncate title to ~80 chars for the 2-line clamp to work well
  const MAX_TITLE = 80;
  const title = video.title.length > MAX_TITLE
    ? video.title.slice(0, MAX_TITLE).trimEnd() + '…'
    : video.title;

  const youtubeUrl = sanitizeHTML(video.url);
  const thumbnail  = sanitizeHTML(video.thumbnail);
  const titleEsc   = sanitizeHTML(video.title);
  const titleShort = sanitizeHTML(title);

  return `
    <article
      class="video-card"
      data-animate="fade-up"
      tabindex="0"
      role="link"
      aria-label="Watch: ${titleEsc}"
      onclick="window.open('${youtubeUrl}', '_blank', 'noopener,noreferrer')"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.open('${youtubeUrl}','_blank','noopener,noreferrer')}"
    >
      <div class="video-thumb-wrapper">
        <img
          src="${thumbnail}"
          alt="${titleEsc}"
          class="video-thumb"
          loading="lazy"
          onerror="this.src='assets/placeholder.jpg'"
        >
        <!-- Play overlay -->
        <div class="video-play-overlay" aria-hidden="true">
          <div class="play-btn-circle">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="white">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
        <!-- YouTube badge -->
        <div class="video-platform-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="#FF0000">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          YouTube
        </div>
      </div>
      <div class="video-info">
        <h3 class="video-title" title="${titleEsc}">${titleShort}</h3>
        <p class="video-meta">
          <time datetime="${sanitizeHTML(video.published)}">${formatDate(video.published)}</time>
          <span class="video-meta-sep" aria-hidden="true">·</span>
          <span class="video-ago">${timeAgo(video.published)}</span>
        </p>
      </div>
    </article>
  `;
}

/* ─────────────────────────────────────────────────────────
   4. Channel Info Bar
   ───────────────────────────────────────────────────────── */

/**
 * Render the channel info bar (subscribe CTA) into `#channel-info`.
 * This is a static banner rendered immediately without API calls.
 */
function renderChannelInfo() {
  const container = document.getElementById('channel-info');
  if (!container) return;

  container.innerHTML = `
    <div class="channel-info-bar" data-animate="fade-up">
      <div class="channel-info-left">
        <img src="assets/logo.png" alt="Bharat Web Azadari Logo" class="channel-logo" width="48" height="48" loading="lazy">
        <div class="channel-text">
          <h2 class="channel-name">${sanitizeHTML(CONFIG.SITE_NAME)}</h2>
          <p class="channel-tagline">${sanitizeHTML(CONFIG.SITE_TAGLINE)}</p>
        </div>
      </div>
      <a
        href="${CONFIG.YOUTUBE_CHANNEL_URL}"
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-red channel-subscribe-btn"
        aria-label="Subscribe to Bharat Web Azadari on YouTube"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
        Subscribe on YouTube
      </a>
    </div>
  `;
}
