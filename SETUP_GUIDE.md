# Bharat Web Azadari (BWA) — Complete Setup & Deployment Guide

> **Designed & Developed by Faizan Ali**
> For queries: itsfaizanali5@gmail.com

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Project Structure Overview](#2-project-structure-overview)
3. [Setting Up Google Sheets](#3-setting-up-google-sheets)
4. [Deploying Google Apps Script](#4-deploying-google-apps-script)
5. [Configuring the Website](#5-configuring-the-website)
6. [Getting Your YouTube Channel ID](#6-getting-your-youtube-channel-id)
7. [Preparing Assets (Logo & Icons)](#7-preparing-assets-logo--icons)
8. [Deploying to GitHub Pages](#8-deploying-to-github-pages)
9. [Setting Up PWA Icons](#9-setting-up-pwa-icons)
10. [Admin Panel Usage Guide](#10-admin-panel-usage-guide)
11. [Changing the Admin Password](#11-changing-the-admin-password)
12. [Troubleshooting Common Issues](#12-troubleshooting-common-issues)
13. [Custom Domain Setup (Optional)](#13-custom-domain-setup-optional)

---

## 1. Prerequisites

Before you begin, make sure you have:

| Requirement | What it is | Where to get it |
|-------------|-----------|-----------------|
| **Google Account** | For Google Sheets & Apps Script | [google.com](https://google.com) |
| **GitHub Account** | For hosting the website | [github.com](https://github.com) |
| **YouTube Channel** | Your BWA channel | [youtube.com](https://youtube.com) |
| **A modern browser** | Chrome, Firefox, or Edge | Already on your computer |

> **No coding knowledge is required** beyond following these steps exactly.

---

## 2. Project Structure Overview

Your project folder looks like this:

```
Bharat Web Azadari Project/
│
├── index.html          ← Home page
├── about.html          ← About page
├── programs.html       ← Programs & Majlis events
├── gallery.html        ← Photo gallery
├── videos.html         ← YouTube videos
├── contact.html        ← Contact form
├── 404.html            ← Page not found
│
├── manifest.json       ← PWA settings (app icon, name)
├── sw.js               ← Service Worker (offline support)
├── sitemap.xml         ← For Google Search indexing
├── robots.txt          ← Search engine instructions
│
├── admin/              ← Admin panel (password protected)
│   ├── index.html      ← Admin login
│   ├── dashboard.html  ← Overview
│   ├── programs.html   ← Manage programs
│   ├── announcements.html
│   ├── gallery.html
│   └── livestream.html
│
├── assets/
│   ├── logo.png        ← YOUR LOGO (copy here)
│   └── icons/          ← PWA app icons
│
├── css/
│   ├── main.css        ← Main styles
│   └── components.css  ← Reusable component styles
│
├── js/
│   ├── config.js       ← ⚠️ YOU MUST EDIT THIS FILE
│   ├── api.js          ← API communication
│   ├── main.js         ← Shared functionality
│   └── ...             ← Page-specific scripts
│
└── google-apps-script/
    └── Code.gs         ← Backend (goes to Google Apps Script)
```

**The two files you MUST edit are:**
- `js/config.js` — add your Google Apps Script URL and YouTube Channel ID
- `google-apps-script/Code.gs` — add your Google Spreadsheet ID

---

## 3. Setting Up Google Sheets

The website stores all data (programs, announcements, gallery, contacts) in a Google Spreadsheet. Let's set it up.

### Step 1 — Create a new Google Spreadsheet

1. Open your browser and go to [https://sheets.google.com](https://sheets.google.com)
2. Click the **big "+" button** (Blank) to create a new spreadsheet
3. At the top left, click on "**Untitled spreadsheet**" and rename it to:
   ```
   Bharat Web Azadari Data
   ```
4. You will now see the spreadsheet URL in your browser address bar. It looks like this:
   ```
   https://docs.google.com/spreadsheets/d/1ABC123XYZ.../edit
   ```
5. **Copy the long ID** between `/d/` and `/edit`. For example:
   ```
   1ABC123XYZabcDEFGHIJKLMNopqrstuvwxyz1234567890
   ```
   ✅ **Save this ID** — you will need it in Step 4.

### Step 2 — Open Google Apps Script

Now we will set up the backend automatically using the `initializeSpreadsheet()` function:

1. In your spreadsheet, click on the **Extensions** menu (top menu bar)
2. Click **Apps Script**
3. A new tab will open — this is the Google Apps Script editor
4. You will see a default `function myFunction() {}` — **delete all of this**

### Step 3 — Paste the backend code

1. Open the file `google-apps-script/Code.gs` from your project folder in any text editor (Notepad, VS Code, etc.)
2. Select all the text (`Ctrl+A`) and copy it (`Ctrl+C`)
3. Go back to the Apps Script editor tab
4. Click inside the editor area and paste (`Ctrl+V`)
5. Near the top of the code, find this line:
   ```javascript
   const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
   ```
6. Replace `YOUR_SPREADSHEET_ID_HERE` with the ID you copied in Step 1. Example:
   ```javascript
   const SPREADSHEET_ID = '1ABC123XYZabcDEFGHIJKLMNopqrstuvwxyz1234567890';
   ```
7. Click **Save** (Ctrl+S or the floppy disk icon 💾)
8. Give the project a name if asked — type `BWA Backend` and click **Rename**

### Step 4 — Initialize the spreadsheet sheets

1. In the Apps Script editor, look at the top toolbar — there is a dropdown that says **"Select function"** (or shows a function name)
2. Click that dropdown and select **`initializeSpreadsheet`**
3. Click the **▶ Run** button (play button)
4. A popup will appear asking for permissions — click **Review permissions**
5. Select your Google account
6. You may see a warning: "Google hasn't verified this app" — click **Advanced** → **Go to BWA Backend (unsafe)**
7. Click **Allow**
8. The function will run and create all the sheets automatically
9. A popup will appear saying **"Setup Complete!"** — click OK
10. Go back to your Google Spreadsheet tab — you should now see these sheets at the bottom:
    - `Programs`
    - `Announcements`
    - `Gallery`
    - `LiveStream`
    - `Config`
    - `Contacts`

> ✅ **Success!** Your spreadsheet is ready with all the correct columns.

> ⚠️ **Important**: The default admin password is `bwa@admin2026`. Change this before going live — see [Section 11](#11-changing-the-admin-password).

---

## 4. Deploying Google Apps Script

Now we need to publish the backend so the website can talk to it.

### Step 1 — Deploy as Web App

1. In the Apps Script editor, click **Deploy** (top right button)
2. Click **New deployment**
3. Click the gear icon ⚙️ next to "Select type"
4. Choose **Web App**
5. Fill in the settings:
   - **Description**: `BWA Backend v1.0`
   - **Execute as**: `Me` (your Google account)
   - **Who has access**: `Anyone`
6. Click **Deploy**
7. Click **Authorize access** if prompted — follow the same permission steps as before

### Step 2 — Copy the Web App URL

After deployment, you will see a screen like this:

```
Deployment successfully created

Web App URL:
https://script.google.com/macros/s/AKfycbXXXXXXXXXXXXXX.../exec
```

8. Click **Copy** to copy the Web App URL
9. ✅ **Save this URL** — you will paste it in `js/config.js`

> ⚠️ **Every time you change the code**, you must create a **New deployment** (not update existing) or deploy a new version for changes to take effect.

---

## 5. Configuring the Website

Now we connect the website to your Google Apps Script backend.

### Edit `js/config.js`

1. Open the file `js/config.js` in a text editor (right-click → Open with Notepad, or use VS Code)
2. You will see:

```javascript
const CONFIG = {
  APPS_SCRIPT_URL: 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE',
  YOUTUBE_CHANNEL_ID: 'UCBharatWebAzadari',
  YOUTUBE_CHANNEL_URL: 'https://youtube.com/@bharatwebazadari',
  SITE_URL: 'https://yourusername.github.io/bharat-web-azadari',
  SITE_NAME: 'Bharat Web Azadari',
  ADMIN_SESSION_KEY: 'bwa_admin_token',
};
```

3. Replace each value:

| Field | Replace with |
|-------|-------------|
| `YOUR_GOOGLE_APPS_SCRIPT_URL_HERE` | The Web App URL from Section 4 |
| `UCBharatWebAzadari` | Your YouTube Channel ID (see Section 6) |
| `https://youtube.com/@bharatwebazadari` | Your YouTube channel URL |
| `https://yourusername.github.io/bharat-web-azadari` | Your GitHub Pages URL (see Section 8) |

**Example after editing:**
```javascript
const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbXXXX.../exec',
  YOUTUBE_CHANNEL_ID: 'UCabc123XYZdef456',
  YOUTUBE_CHANNEL_URL: 'https://youtube.com/@bharatwebazadari',
  SITE_URL: 'https://faizanali.github.io/bharat-web-azadari',
  SITE_NAME: 'Bharat Web Azadari',
  ADMIN_SESSION_KEY: 'bwa_admin_token',
};
```

4. Save the file (`Ctrl+S`)

### Update sitemap.xml and robots.txt

1. Open `sitemap.xml` — find and replace all occurrences of:
   ```
   https://yourusername.github.io/bharat-web-azadari/
   ```
   with your actual GitHub Pages URL.

2. Open `robots.txt` — do the same for the Sitemap line.

3. Open `manifest.json` — find the `"url"` field in `related_applications` and update it too.

---

## 6. Getting Your YouTube Channel ID

The website uses your YouTube Channel ID to fetch your latest videos.

### Method 1 — From YouTube Studio

1. Go to [https://studio.youtube.com](https://studio.youtube.com)
2. Click on your profile picture or channel name
3. Click **Settings** (left sidebar at the bottom)
4. Click **Channel** → **Advanced settings**
5. You will see **"Channel ID"** — it looks like: `UCabc123XYZdef456`
6. Copy it and paste it in `config.js`

### Method 2 — From your channel page

1. Go to your YouTube channel page: `https://youtube.com/@bharatwebazadari`
2. Right-click anywhere on the page
3. Click **"View page source"**
4. Press `Ctrl+F` and search for: `"channelId"`
5. You will find something like: `"channelId":"UCabc123XYZdef456"`
6. Copy the ID (starting with `UC...`)

> ✅ **Note**: Channel IDs always start with `UC` and are 24 characters long.

---

## 7. Preparing Assets (Logo & Icons)

### Copy your logo

1. Get your BWA logo file (should be a PNG with transparent background if possible)
2. Name it exactly: `logo.png`
3. Copy it to: `assets/logo.png` (inside your project folder)

> The logo will appear in the navigation bar, footer, and browser tab (favicon).

### Prepare PWA Icons

For the app to install properly on phones, you need 8 icon sizes. The easiest way:

**Option A — Online Tool (Recommended):**

1. Go to [https://realfavicongenerator.net](https://realfavicongenerator.net)
2. Click **Select your Favicon image** and upload your logo
3. Scroll down and click **Generate your Favicons**
4. Download the ZIP file
5. Extract it and copy:
   - `android-chrome-192x192.png` → rename to `icon-192.png`
   - `android-chrome-512x512.png` → rename to `icon-512.png`
6. For the other sizes, go to [https://www.pwabuilder.com/imageGenerator](https://www.pwabuilder.com/imageGenerator)
7. Upload your logo
8. Download all icons and place them in `assets/icons/` folder

**Required file names:**
```
assets/icons/
├── icon-72.png
├── icon-96.png
├── icon-128.png
├── icon-144.png
├── icon-152.png
├── icon-192.png
├── icon-384.png
└── icon-512.png
```

**Option B — Use one icon for now:**
- If you just want to test quickly, copy your logo.png 8 times with the names above
- Proper icons can be added later

---

## 8. Deploying to GitHub Pages

GitHub Pages gives you a free website at `https://yourusername.github.io/repo-name/`

### Step 1 — Create a GitHub Account (if you don't have one)

1. Go to [https://github.com](https://github.com)
2. Click **Sign up** and follow the steps
3. Verify your email

### Step 2 — Create a new repository

1. Log into GitHub
2. Click the **"+"** button (top right) → **New repository**
3. Fill in:
   - **Repository name**: `bharat-web-azadari`
   - **Description**: `Official website for Bharat Web Azadari - Live Majlis, Juloos, Nohay`
   - **Public** (must be Public for free GitHub Pages)
   - Check **"Add a README file"**
4. Click **Create repository**

### Step 3 — Upload your project files

**Method A — GitHub Website Upload (easiest):**

1. In your new repository, click **"Add file"** → **"Upload files"**
2. Open your project folder on your computer
3. Select ALL files and folders (Ctrl+A)
4. Drag them into the GitHub upload area
5. Wait for upload to complete (may take a few minutes)
6. Scroll down, write a commit message: `Initial website upload`
7. Click **Commit changes**

> ⚠️ **Important**: Do NOT upload the `google-apps-script/` folder — that code stays in Google Apps Script only.

**Method B — GitHub Desktop (easier for future updates):**

1. Download [GitHub Desktop](https://desktop.github.com/)
2. Sign in with your GitHub account
3. Click **File** → **Clone Repository**
4. Select your `bharat-web-azadari` repository
5. Choose a folder on your computer and clone it
6. Copy all your project files into that cloned folder
7. In GitHub Desktop, you will see all changed files listed
8. Write a summary ("Initial upload") and click **Commit to main**
9. Click **Push origin**

### Step 4 — Enable GitHub Pages

1. In your repository on GitHub, click **Settings** (top menu)
2. In the left sidebar, scroll down to **Pages**
3. Under **Source**, click the dropdown that says **"None"**
4. Select **"main"** branch
5. Click **Save**
6. Wait 2-5 minutes
7. Refresh the page — you will see:
   ```
   ✅ Your site is published at https://yourusername.github.io/bharat-web-azadari/
   ```
8. Click that link to see your live website!

> ✅ **Congratulations!** Your website is now live on the internet.

### Step 5 — Update URLs with your actual GitHub Pages URL

Now that you know your GitHub Pages URL, go back and update:

1. `js/config.js` → `SITE_URL`
2. `sitemap.xml` → all `<loc>` URLs
3. `robots.txt` → Sitemap URL
4. `manifest.json` → `related_applications` URL

Upload/push these updated files to GitHub again.

---

## 9. Setting Up PWA Icons

The PWA (Progressive Web App) lets users install the website like a real app on their phone.

### Testing PWA Installation

1. Open your website on a mobile phone (Chrome on Android or Safari on iPhone)
2. **On Android**: A banner will appear at the bottom saying "Add to home screen" — tap it
3. **On iPhone**: Tap the Share button → "Add to Home Screen"

### Verifying your PWA setup

1. Open Chrome on your computer
2. Go to your website URL
3. Press `F12` to open Developer Tools
4. Click the **Application** tab
5. Click **Manifest** in the left sidebar
6. You should see your app name, icons, and settings
7. If there are any red errors, check that icon files are in the right place

---

## 10. Admin Panel Usage Guide

The admin panel lets you manage all website content without touching any code.

### Accessing the Admin Panel

Your admin panel is at: `https://yourusername.github.io/bharat-web-azadari/admin/`

> ⚠️ **This URL is public** but protected by password. Keep the password secret.

### Logging In

1. Go to `/admin/` on your website
2. Enter the admin password (default: `bwa@admin2026`)
3. Click **Login**
4. You will be taken to the dashboard

> The login session lasts until you close the browser tab or click Logout.

### Dashboard

The dashboard shows:
- Total programs count
- Total announcements count
- Total gallery items count
- Current live stream status
- Quick links to each admin section

### Managing Programs

**To Add a New Program:**
1. Click **Programs** in the admin sidebar
2. Click **Add New Program**
3. Fill in:
   - **Title**: Name of the program (e.g., "Majlis-e-Aza — 1 Muharram")
   - **Date**: Select date from calendar
   - **Time**: Enter time (e.g., "8:00 PM")
   - **Location**: Venue name and address
   - **Description**: More details about the program
   - **Image URL**: Link to a program image (optional)
4. Click **Save Program**

**To Edit a Program:**
1. Find the program in the list
2. Click the **Edit** (pencil) icon
3. Make your changes
4. Click **Save**

**To Delete a Program:**
1. Click the **Delete** (trash) icon
2. Confirm the deletion in the popup

### Managing Announcements

1. Click **Announcements** in the sidebar
2. Click **Add Announcement**
3. Enter title and description
4. Click **Save**

> Announcements appear on the home page. Keep them short and important.

### Managing Gallery

**To Add Photos:**
1. Click **Gallery** in the sidebar
2. Click **Add Photo**
3. Enter the image URL (you need to host images somewhere — see below)
4. Add a caption and category (Majlis, Juloos, Programs)
5. Click **Save**

**Where to host images for free:**
- Upload to [https://imgur.com](https://imgur.com) → right-click the image → Copy Image Address
- Upload to Google Drive → Share → "Anyone with link" → get direct link
- Use [https://postimages.org](https://postimages.org) → upload → copy "Direct link"

### Managing Live Stream

1. Click **Live Stream** in the sidebar
2. Enter your **YouTube Live Stream URL** (the URL of your live video)
3. Toggle **"Is Live"** to ON when you are streaming
4. Click **Save**

> The home page will show a LIVE badge and the stream embed when "Is Live" is ON.

**To get the YouTube Live URL:**
1. Start your live stream on YouTube
2. Go to YouTube Studio → Live
3. Copy the video URL (like `https://youtube.com/watch?v=XXXXXXXXXX`)
4. Paste it in the admin panel

---

## 11. Changing the Admin Password

**Change the password before going live!**

### Steps:

1. Go to [https://sheets.google.com](https://sheets.google.com)
2. Open your **"Bharat Web Azadari Data"** spreadsheet
3. Click on the **Config** sheet tab (at the bottom)
4. You will see a row with:
   ```
   | key            | value          |
   | admin_password | bwa@admin2026  |
   ```
5. Click on the cell `bwa@admin2026`
6. Type your new password (use a strong password!)
7. Press Enter
8. **Done!** The new password takes effect immediately.

> ✅ **Good password tips:**
> - At least 12 characters
> - Mix of letters, numbers, and symbols
> - Example: `BWA@Senthal#2026`

---

## 12. Troubleshooting Common Issues

### ❌ "Unknown action" error on the website

**Problem**: The API call fails with "Unknown action" error.

**Solution**:
1. Check that `APPS_SCRIPT_URL` in `config.js` is correct
2. Make sure you deployed the Apps Script as a **Web App** with access set to **"Anyone"**
3. If you updated the Code.gs, create a **New Deployment** (not update existing)

---

### ❌ No videos showing on the Videos page

**Problem**: YouTube videos section is empty.

**Solution**:
1. Make sure `YOUTUBE_CHANNEL_ID` in `config.js` starts with `UC`
2. Make sure your channel has at least 1 public video
3. Open browser console (F12) and check for errors
4. The CORS proxy (allorigins.win) might be temporarily down — wait a few minutes and refresh

---

### ❌ Admin login fails with correct password

**Problem**: Can't log in to admin panel.

**Solutions**:
- Make sure you're using the exact password in the Config sheet (no extra spaces)
- Clear browser cache (`Ctrl+Shift+Delete`) and try again
- Make sure your Apps Script is deployed correctly
- Check the Config sheet — the key must be exactly `admin_password` (lowercase)

---

### ❌ Contact form doesn't submit

**Problem**: Contact form shows error when submitting.

**Solutions**:
1. Check that your Apps Script URL in `config.js` is correct
2. Make sure the `Contacts` sheet exists in your spreadsheet
3. Open browser console (F12) — look for any red errors

---

### ❌ Website not updating after changes

**Problem**: You uploaded new files to GitHub but the website looks the same.

**Solutions**:
1. Wait 5-10 minutes — GitHub Pages can be slow to update
2. Do a **hard refresh**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. Open an incognito/private window to check
4. Clear browser cache

---

### ❌ PWA icons not showing / install prompt not appearing

**Problem**: The "Add to home screen" prompt doesn't appear.

**Solutions**:
1. Make sure icon files exist in `assets/icons/` with exact names
2. Check that `manifest.json` is in the root folder (same level as `index.html`)
3. The website must be served over **HTTPS** (GitHub Pages does this automatically)
4. The Service Worker (`sw.js`) must be in the root folder

---

### ❌ Service Worker errors in console

**Problem**: Browser console shows SW errors.

**Solution**:
1. The SW tries to cache certain files during install. If a file doesn't exist, it logs a warning (not a breaking error)
2. Make sure all files listed in `STATIC_ASSETS` in `sw.js` actually exist
3. To reset the SW: Open DevTools → Application → Service Workers → Unregister → Refresh

---

### ❌ Programs / Gallery not loading (CORS error)

**Problem**: Data doesn't load and console shows CORS error.

**Solution**:
This means your Apps Script is not deployed with access "Anyone":
1. Open Apps Script editor
2. Click **Deploy** → **Manage deployments**
3. Click the edit (pencil) icon on your deployment
4. Change "Who has access" to **"Anyone"**
5. Click **Deploy**

---

### ❌ Google Sheets API Quota exceeded

**Problem**: API calls fail with quota error.

**Context**: Google Apps Script has daily quotas:
- Free accounts: 20,000 reads/day, 2,000 writes/day

**Solution**: This only happens with very high traffic. For a typical Azadari website, you won't hit these limits. If you do, wait until midnight (UTC) for the quota to reset.

---

## 13. Custom Domain Setup (Optional)

By default, your website is at `yourusername.github.io/bharat-web-azadari`. You can use a custom domain like `bharatwebazadari.com` or `bwazadari.in`.

### Step 1 — Buy a domain

Buy a domain from:
- [GoDaddy](https://godaddy.com) (easy to use)
- [Namecheap](https://namecheap.com) (affordable)
- [Hostinger](https://hostinger.in) (has `.in` domains)

For an Indian Azadari website, consider: `.in`, `.com`, `.org`

### Step 2 — Add domain to GitHub Pages

1. In your GitHub repository → **Settings** → **Pages**
2. Under **Custom domain**, type your domain (e.g., `bharatwebazadari.com`)
3. Click **Save**
4. GitHub will show you some DNS values to add

### Step 3 — Configure DNS records

1. Log into your domain registrar (where you bought the domain)
2. Go to **DNS Settings** or **DNS Management**
3. Add these records:

**For a root domain (bharatwebazadari.com):**
```
Type: A    Name: @    Value: 185.199.108.153
Type: A    Name: @    Value: 185.199.109.153
Type: A    Name: @    Value: 185.199.110.153
Type: A    Name: @    Value: 185.199.111.153
```

**For www subdomain:**
```
Type: CNAME    Name: www    Value: yourusername.github.io
```

4. Wait 24-48 hours for DNS to propagate
5. Go back to GitHub Pages settings and check **"Enforce HTTPS"** ✅

### Step 4 — Update your website URLs

After your custom domain is working, update all URL references:
1. `js/config.js` → `SITE_URL: 'https://bharatwebazadari.com'`
2. `sitemap.xml` → change all `<loc>` URLs
3. `robots.txt` → Sitemap line
4. `manifest.json` → related_applications URL

Commit and push these changes to GitHub.

---

## Quick Reference Card

| What | Where |
|------|-------|
| Admin Panel | `yoursite.com/admin/` |
| Change Password | Google Sheets → Config tab → admin_password |
| Add Programs | Admin Panel → Programs → Add New |
| Turn Live ON/OFF | Admin Panel → Live Stream |
| Update GAS Code | script.google.com → Deploy → New Deployment |
| Website Files | GitHub repository |

---

## Contact & Support

If you need help setting up the website:

- **Email**: itsfaizanali5@gmail.com
- **Designed & Developed by**: Faizan Ali
- **Channel**: [youtube.com/@bharatwebazadari](https://youtube.com/@bharatwebazadari)

---

*© 2026 Bharat Web Azadari — Senthal, Bareilly, Uttar Pradesh, India*
*Ya Husain (A.S.)*
