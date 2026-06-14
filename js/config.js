// ============================================================
// BHARAT WEB AZADARI — Configuration
// ============================================================
// IMPORTANT: After deploying Google Apps Script, replace
// APPS_SCRIPT_URL with your deployed Web App URL.
// ============================================================

const CONFIG = {
  // Google Apps Script Web App URL (set after deployment)
  APPS_SCRIPT_URL: 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE',

  // YouTube Channel
  YOUTUBE_CHANNEL_ID: 'YOUR_YOUTUBE_CHANNEL_ID_HERE',
  YOUTUBE_CHANNEL_URL: 'https://youtube.com/@bharatwebazadari',

  // Site
  SITE_URL: 'https://yourusername.github.io/bharat-web-azadari',
  SITE_NAME: 'Bharat Web Azadari',
  SITE_TAGLINE: 'Live Majlis \u2022 Juloos \u2022 Nohay \u2022 Programs',

  // Admin
  ADMIN_SESSION_KEY: 'bwa_admin_token',
  ADMIN_TOKEN_EXPIRY: 8 * 60 * 60 * 1000, // 8 hours in ms

  // Contact
  EMAIL: 'itsfaizanali5@gmail.com',
  LOCATION: 'Senthal, Bareilly, Uttar Pradesh, India',

  // CORS Proxy for YouTube RSS (public, free)
  CORS_PROXY: 'https://api.allorigins.win/get?url=',
};
