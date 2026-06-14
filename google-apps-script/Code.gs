// ============================================================
// BHARAT WEB AZADARI — Google Apps Script Backend
// ============================================================
// DEPLOYMENT INSTRUCTIONS:
//   1. Open https://script.google.com
//   2. Create a new project, paste this entire file
//   3. Click Deploy → New Deployment
//   4. Type: Web App
//   5. Execute as: Me
//   6. Who has access: Anyone
//   7. Copy the Web App URL into js/config.js → APPS_SCRIPT_URL
// ============================================================

// ── CONFIGURATION ───────────────────────────────────────────
// Replace with your actual Google Spreadsheet ID
// (found in the spreadsheet URL: /spreadsheets/d/SPREADSHEET_ID/edit)
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

// Sheet names — must match exactly what you create in Google Sheets
const SHEET_PROGRAMS      = 'Programs';
const SHEET_ANNOUNCEMENTS = 'Announcements';
const SHEET_GALLERY       = 'Gallery';
const SHEET_LIVESTREAM    = 'LiveStream';
const SHEET_CONFIG        = 'Config';
const SHEET_CONTACTS      = 'Contacts';

// ============================================================
// ENTRY POINTS
// ============================================================

/**
 * Handle GET requests — public read operations
 * URL params: ?action=ACTION_NAME&[other params]
 */
function doGet(e) {
  try {
    const action = e.parameter.action;

    switch (action) {
      case 'getPrograms':
        return jsonResponse(getAllPrograms());

      case 'getAnnouncements':
        return jsonResponse(getAllAnnouncements());

      case 'getGallery':
        return jsonResponse(getAllGallery());

      case 'getLiveStream':
        return jsonResponse(getLiveStream());

      default:
        return jsonResponse({
          success: false,
          error: 'Unknown action: ' + (action || 'none provided')
        });
    }
  } catch (err) {
    return errorResponse(err.message || 'Internal server error');
  }
}

/**
 * Handle POST requests — write/admin operations
 * Body: JSON string with { action, ...data }
 * NOTE: Frontend sends with content-type text/plain to avoid CORS preflight
 */
function doPost(e) {
  try {
    // Parse the JSON body (sent as plain text to bypass CORS preflight)
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return errorResponse('Invalid JSON body: ' + parseErr.message);
    }

    const action = body.action;

    switch (action) {
      // ── PROGRAMS ──────────────────────────────────────────
      case 'addProgram':
        return jsonResponse(addProgram(body));

      case 'updateProgram':
        return jsonResponse(updateProgram(body));

      case 'deleteProgram':
        return jsonResponse(deleteProgram(body.id));

      // ── ANNOUNCEMENTS ─────────────────────────────────────
      case 'addAnnouncement':
        return jsonResponse(addAnnouncement(body));

      case 'updateAnnouncement':
        return jsonResponse(updateAnnouncement(body));

      case 'deleteAnnouncement':
        return jsonResponse(deleteAnnouncement(body.id));

      // ── GALLERY ───────────────────────────────────────────
      case 'addGallery':
        return jsonResponse(addGallery(body));

      case 'deleteGallery':
        return jsonResponse(deleteGallery(body.id));

      // ── LIVE STREAM ───────────────────────────────────────
      case 'setLiveStream':
        return jsonResponse(setLiveStream(body));

      // ── AUTH ──────────────────────────────────────────────
      case 'adminLogin':
        return jsonResponse(adminLogin(body.password));

      // ── CONTACT ───────────────────────────────────────────
      case 'submitContact':
        return jsonResponse(submitContact(body));

      default:
        return errorResponse('Unknown action: ' + (action || 'none provided'));
    }
  } catch (err) {
    return errorResponse(err.message || 'Internal server error');
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get a sheet by name from the spreadsheet.
 * Throws a clear error if the sheet doesn't exist.
 */
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error('Sheet "' + name + '" not found. Please create it in your spreadsheet.');
  }
  return sheet;
}

/**
 * Generate a unique ID using timestamp + random number.
 * Example: "1718000000000_a3f7"
 */
function generateId() {
  return Date.now().toString() + '_' + Math.random().toString(36).substring(2, 6);
}

/**
 * Generate a random hex token for admin sessions.
 * Example: "a3f7e2b9c1d4..."
 */
function generateToken() {
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += Math.floor(Math.random() * 16).toString(16);
  }
  return token;
}

/**
 * Return a JSON response with CORS headers.
 * GAS doesn't support setting response headers directly in ContentService,
 * but JSON output with proper content type is sufficient for non-preflighted requests.
 */
function jsonResponse(data) {
  const json = JSON.stringify(data);
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Return a standardized error response.
 */
function errorResponse(message) {
  return jsonResponse({
    success: false,
    error: message
  });
}

/**
 * Read all rows from a sheet and return as an array of objects.
 * The first row is treated as headers (column names).
 * Empty rows are skipped.
 *
 * @param {string} sheetName - Name of the sheet
 * @returns {Array<Object>} Array of row objects
 */
function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();

  if (data.length < 2) return []; // Only headers or empty

  const headers = data[0].map(h => String(h).trim());
  const rows    = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Skip completely empty rows
    if (row.every(cell => cell === '' || cell === null || cell === undefined)) continue;

    const obj = {};
    headers.forEach((header, j) => {
      // Convert Date objects to ISO strings for JSON serialization
      if (row[j] instanceof Date) {
        obj[header] = row[j].toISOString();
      } else {
        obj[header] = row[j];
      }
    });
    rows.push(obj);
  }

  return rows;
}

/**
 * Append a new row to the specified sheet.
 * rowData is an object; keys must match the sheet's header row exactly.
 *
 * @param {string} sheetName - Name of the sheet
 * @param {Object} rowData - Object with column: value pairs
 */
function appendRow(sheetName, rowData) {
  const sheet   = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow  = headers.map(header => {
    const val = rowData[String(header).trim()];
    return val !== undefined ? val : '';
  });
  sheet.appendRow(newRow);
}

/**
 * Find the 1-based row index for a given id in a sheet.
 * Assumes the 'id' column is column A (index 0).
 *
 * @param {string} sheetName
 * @param {string} id
 * @returns {number} 1-based row index, or -1 if not found
 */
function findRow(sheetName, id) {
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();

  // Find which column index is 'id'
  if (data.length === 0) return -1;
  const headers  = data[0].map(h => String(h).trim().toLowerCase());
  const idColIdx = headers.indexOf('id');
  if (idColIdx === -1) return -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIdx]) === String(id)) {
      return i + 1; // 1-based row index (row 1 = headers)
    }
  }
  return -1;
}

/**
 * Update a row in the sheet identified by its id.
 * Only updates columns that exist in `data`.
 *
 * @param {string} sheetName
 * @param {string} id
 * @param {Object} data - Partial or full object with updated values
 * @returns {boolean} true if found and updated, false otherwise
 */
function updateRow(sheetName, id, data) {
  const sheet   = getSheet(sheetName);
  const rowIdx  = findRow(sheetName, id);

  if (rowIdx === -1) return false;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = sheet.getRange(rowIdx, 1, 1, sheet.getLastColumn()).getValues()[0];

  headers.forEach((header, colIdx) => {
    const key = String(header).trim();
    if (data[key] !== undefined) {
      rowData[colIdx] = data[key];
    }
  });

  sheet.getRange(rowIdx, 1, 1, sheet.getLastColumn()).setValues([rowData]);
  return true;
}

/**
 * Delete a row from the sheet identified by its id.
 *
 * @param {string} sheetName
 * @param {string} id
 * @returns {boolean} true if found and deleted, false otherwise
 */
function deleteRow(sheetName, id) {
  const sheet  = getSheet(sheetName);
  const rowIdx = findRow(sheetName, id);

  if (rowIdx === -1) return false;

  sheet.deleteRow(rowIdx);
  return true;
}

// ============================================================
// AUTHENTICATION
// ============================================================

/**
 * Verify admin login against the password stored in Config sheet.
 * Config sheet format: | key | value |
 * One row with key = "admin_password"
 *
 * @param {string} password - Password provided by admin
 * @returns {Object} { success: true, token } or { success: false, error }
 */
function adminLogin(password) {
  if (!password) {
    return { success: false, error: 'Password is required.' };
  }

  try {
    const configData = getSheetData(SHEET_CONFIG);
    const passwordRow = configData.find(row =>
      String(row['key']).trim().toLowerCase() === 'admin_password'
    );

    if (!passwordRow) {
      return { success: false, error: 'Admin password not configured in Config sheet.' };
    }

    const storedPassword = String(passwordRow['value']).trim();

    if (password === storedPassword) {
      return {
        success: true,
        token: generateToken(),
        message: 'Login successful.'
      };
    } else {
      return { success: false, error: 'Incorrect password.' };
    }
  } catch (err) {
    return { success: false, error: 'Auth error: ' + err.message };
  }
}

// ============================================================
// PROGRAMS CRUD
// ============================================================
// Sheet columns: id | title | description | date | time | location | imageUrl | createdAt

/**
 * Get all programs from the Programs sheet.
 * @returns {{ success: true, data: Array }} or error object
 */
function getAllPrograms() {
  try {
    const programs = getSheetData(SHEET_PROGRAMS);
    // Sort by date ascending (upcoming first), then past
    programs.sort((a, b) => {
      const da = new Date(a.date || 0);
      const db = new Date(b.date || 0);
      return da - db;
    });
    return { success: true, data: programs };
  } catch (err) {
    return { success: false, error: 'Failed to fetch programs: ' + err.message };
  }
}

/**
 * Add a new program.
 * Required fields: title, date, time, location
 */
function addProgram(data) {
  try {
    if (!data.title || !data.date) {
      return { success: false, error: 'Title and date are required.' };
    }

    const now = new Date().toISOString();
    const row = {
      id:          generateId(),
      title:       data.title       || '',
      description: data.description || '',
      date:        data.date        || '',
      time:        data.time        || '',
      location:    data.location    || '',
      imageUrl:    data.imageUrl    || '',
      createdAt:   now
    };

    appendRow(SHEET_PROGRAMS, row);
    return { success: true, message: 'Program added successfully.', id: row.id };
  } catch (err) {
    return { success: false, error: 'Failed to add program: ' + err.message };
  }
}

/**
 * Update an existing program by id.
 * Required in data: id
 */
function updateProgram(data) {
  try {
    if (!data.id) {
      return { success: false, error: 'Program ID is required for update.' };
    }

    const updateData = {};
    if (data.title       !== undefined) updateData.title       = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.date        !== undefined) updateData.date        = data.date;
    if (data.time        !== undefined) updateData.time        = data.time;
    if (data.location    !== undefined) updateData.location    = data.location;
    if (data.imageUrl    !== undefined) updateData.imageUrl    = data.imageUrl;

    const updated = updateRow(SHEET_PROGRAMS, data.id, updateData);
    if (!updated) {
      return { success: false, error: 'Program not found with id: ' + data.id };
    }
    return { success: true, message: 'Program updated successfully.' };
  } catch (err) {
    return { success: false, error: 'Failed to update program: ' + err.message };
  }
}

/**
 * Delete a program by id.
 */
function deleteProgram(id) {
  try {
    if (!id) {
      return { success: false, error: 'Program ID is required for deletion.' };
    }
    const deleted = deleteRow(SHEET_PROGRAMS, id);
    if (!deleted) {
      return { success: false, error: 'Program not found with id: ' + id };
    }
    return { success: true, message: 'Program deleted successfully.' };
  } catch (err) {
    return { success: false, error: 'Failed to delete program: ' + err.message };
  }
}

// ============================================================
// ANNOUNCEMENTS CRUD
// ============================================================
// Sheet columns: id | title | description | date | createdAt

/**
 * Get all announcements, sorted newest first.
 */
function getAllAnnouncements() {
  try {
    const announcements = getSheetData(SHEET_ANNOUNCEMENTS);
    // Sort by createdAt descending (newest first)
    announcements.sort((a, b) => {
      const da = new Date(a.createdAt || a.date || 0);
      const db = new Date(b.createdAt || b.date || 0);
      return db - da;
    });
    return { success: true, data: announcements };
  } catch (err) {
    return { success: false, error: 'Failed to fetch announcements: ' + err.message };
  }
}

/**
 * Add a new announcement.
 * Required: title
 */
function addAnnouncement(data) {
  try {
    if (!data.title) {
      return { success: false, error: 'Title is required for announcement.' };
    }

    const now = new Date().toISOString();
    const row = {
      id:          generateId(),
      title:       data.title       || '',
      description: data.description || '',
      date:        data.date        || now.split('T')[0],
      createdAt:   now
    };

    appendRow(SHEET_ANNOUNCEMENTS, row);
    return { success: true, message: 'Announcement added successfully.', id: row.id };
  } catch (err) {
    return { success: false, error: 'Failed to add announcement: ' + err.message };
  }
}

/**
 * Update an existing announcement by id.
 */
function updateAnnouncement(data) {
  try {
    if (!data.id) {
      return { success: false, error: 'Announcement ID is required for update.' };
    }

    const updateData = {};
    if (data.title       !== undefined) updateData.title       = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.date        !== undefined) updateData.date        = data.date;

    const updated = updateRow(SHEET_ANNOUNCEMENTS, data.id, updateData);
    if (!updated) {
      return { success: false, error: 'Announcement not found with id: ' + data.id };
    }
    return { success: true, message: 'Announcement updated successfully.' };
  } catch (err) {
    return { success: false, error: 'Failed to update announcement: ' + err.message };
  }
}

/**
 * Delete an announcement by id.
 */
function deleteAnnouncement(id) {
  try {
    if (!id) {
      return { success: false, error: 'Announcement ID is required for deletion.' };
    }
    const deleted = deleteRow(SHEET_ANNOUNCEMENTS, id);
    if (!deleted) {
      return { success: false, error: 'Announcement not found with id: ' + id };
    }
    return { success: true, message: 'Announcement deleted successfully.' };
  } catch (err) {
    return { success: false, error: 'Failed to delete announcement: ' + err.message };
  }
}

// ============================================================
// GALLERY CRUD
// ============================================================
// Sheet columns: id | imageUrl | caption | category | createdAt

/**
 * Get all gallery items.
 */
function getAllGallery() {
  try {
    const gallery = getSheetData(SHEET_GALLERY);
    // Sort newest first
    gallery.sort((a, b) => {
      const da = new Date(a.createdAt || 0);
      const db = new Date(b.createdAt || 0);
      return db - da;
    });
    return { success: true, data: gallery };
  } catch (err) {
    return { success: false, error: 'Failed to fetch gallery: ' + err.message };
  }
}

/**
 * Add a new gallery item.
 * Required: imageUrl
 */
function addGallery(data) {
  try {
    if (!data.imageUrl) {
      return { success: false, error: 'Image URL is required.' };
    }

    const now = new Date().toISOString();
    const row = {
      id:        generateId(),
      imageUrl:  data.imageUrl  || '',
      caption:   data.caption   || '',
      category:  data.category  || 'General',
      createdAt: now
    };

    appendRow(SHEET_GALLERY, row);
    return { success: true, message: 'Gallery item added successfully.', id: row.id };
  } catch (err) {
    return { success: false, error: 'Failed to add gallery item: ' + err.message };
  }
}

/**
 * Delete a gallery item by id.
 */
function deleteGallery(id) {
  try {
    if (!id) {
      return { success: false, error: 'Gallery item ID is required for deletion.' };
    }
    const deleted = deleteRow(SHEET_GALLERY, id);
    if (!deleted) {
      return { success: false, error: 'Gallery item not found with id: ' + id };
    }
    return { success: true, message: 'Gallery item deleted successfully.' };
  } catch (err) {
    return { success: false, error: 'Failed to delete gallery item: ' + err.message };
  }
}

// ============================================================
// LIVE STREAM
// ============================================================
// Sheet columns: youtubeUrl | isLive | updatedAt
// Note: Only ONE row of data (row 2). We always read/write row 2.

/**
 * Get the current live stream status.
 */
function getLiveStream() {
  try {
    const sheet = getSheet(SHEET_LIVESTREAM);
    const data  = sheet.getDataRange().getValues();

    if (data.length < 2) {
      // Return defaults if no data row exists yet
      return {
        success: true,
        data: {
          youtubeUrl: '',
          isLive:     false,
          updatedAt:  ''
        }
      };
    }

    const headers = data[0].map(h => String(h).trim());
    const row     = data[1]; // Always row 2

    const obj = {};
    headers.forEach((header, j) => {
      if (row[j] instanceof Date) {
        obj[header] = row[j].toISOString();
      } else {
        obj[header] = row[j];
      }
    });

    // Normalize isLive to boolean
    obj.isLive = obj.isLive === true || String(obj.isLive).toLowerCase() === 'true';

    return { success: true, data: obj };
  } catch (err) {
    return { success: false, error: 'Failed to fetch live stream: ' + err.message };
  }
}

/**
 * Update the live stream settings.
 * This always writes to row 2 of the LiveStream sheet.
 * Creates the data row if it doesn't exist.
 *
 * @param {Object} data - { youtubeUrl, isLive }
 */
function setLiveStream(data) {
  try {
    const sheet   = getSheet(SHEET_LIVESTREAM);
    const now     = new Date().toISOString();
    const sheetData = sheet.getDataRange().getValues();

    const rowData = [
      data.youtubeUrl !== undefined ? data.youtubeUrl : '',
      data.isLive     !== undefined ? data.isLive     : false,
      now
    ];

    if (sheetData.length < 2) {
      // No data row yet — append one
      sheet.appendRow(rowData);
    } else {
      // Update existing row 2
      const numCols = sheet.getLastColumn();
      sheet.getRange(2, 1, 1, Math.max(numCols, rowData.length)).setValues([rowData]);
    }

    return {
      success:    true,
      message:    'Live stream settings updated.',
      youtubeUrl: data.youtubeUrl,
      isLive:     data.isLive
    };
  } catch (err) {
    return { success: false, error: 'Failed to update live stream: ' + err.message };
  }
}

// ============================================================
// CONTACT
// ============================================================
// Sheet columns: id | name | email | subject | message | receivedAt

/**
 * Save a contact form submission to the Contacts sheet.
 * Required: name, email, message
 */
function submitContact(data) {
  try {
    // Validate required fields
    if (!data.name || !data.name.trim()) {
      return { success: false, error: 'Name is required.' };
    }
    if (!data.email || !data.email.trim()) {
      return { success: false, error: 'Email is required.' };
    }
    if (!data.message || !data.message.trim()) {
      return { success: false, error: 'Message is required.' };
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      return { success: false, error: 'Please provide a valid email address.' };
    }

    const now = new Date().toISOString();
    const row = {
      id:         generateId(),
      name:       data.name.trim(),
      email:      data.email.trim().toLowerCase(),
      subject:    data.subject ? data.subject.trim() : '(No subject)',
      message:    data.message.trim(),
      receivedAt: now
    };

    appendRow(SHEET_CONTACTS, row);

    return {
      success: true,
      message: 'Thank you for your message! We will get back to you soon.'
    };
  } catch (err) {
    return { success: false, error: 'Failed to submit contact: ' + err.message };
  }
}

// ============================================================
// SPREADSHEET INITIALIZATION HELPER
// ============================================================
// Run this function ONCE manually to set up all required sheets
// and their headers. Go to Run → initializeSpreadsheet
// NOTE: This will NOT delete existing sheets or data.

function initializeSpreadsheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const sheetsConfig = [
    {
      name:    SHEET_PROGRAMS,
      headers: ['id', 'title', 'description', 'date', 'time', 'location', 'imageUrl', 'createdAt']
    },
    {
      name:    SHEET_ANNOUNCEMENTS,
      headers: ['id', 'title', 'description', 'date', 'createdAt']
    },
    {
      name:    SHEET_GALLERY,
      headers: ['id', 'imageUrl', 'caption', 'category', 'createdAt']
    },
    {
      name:    SHEET_LIVESTREAM,
      headers: ['youtubeUrl', 'isLive', 'updatedAt']
    },
    {
      name:    SHEET_CONFIG,
      headers: ['key', 'value']
    },
    {
      name:    SHEET_CONTACTS,
      headers: ['id', 'name', 'email', 'subject', 'message', 'receivedAt']
    }
  ];

  sheetsConfig.forEach(config => {
    let sheet = ss.getSheetByName(config.name);

    if (!sheet) {
      // Create the sheet if it doesn't exist
      sheet = ss.insertSheet(config.name);
      Logger.log('Created sheet: ' + config.name);
    } else {
      Logger.log('Sheet already exists: ' + config.name);
    }

    // Set headers in row 1
    const headerRange = sheet.getRange(1, 1, 1, config.headers.length);
    headerRange.setValues([config.headers]);

    // Style the header row
    headerRange.setBackground('#D4AF37');
    headerRange.setFontColor('#000000');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  });

  // Add default admin password to Config sheet (if not already set)
  const configSheet = ss.getSheetByName(SHEET_CONFIG);
  const configData  = configSheet.getDataRange().getValues();
  const hasPassword = configData.some(row => String(row[0]).trim() === 'admin_password');

  if (!hasPassword) {
    configSheet.appendRow(['admin_password', 'bwa@admin2026']);
    Logger.log('Default admin password set: bwa@admin2026 — PLEASE CHANGE THIS!');
  }

  Logger.log('✅ Spreadsheet initialization complete! Check the Sheets.');
  SpreadsheetApp.getUi().alert(
    'Setup Complete!\n\n' +
    'All sheets have been created with headers.\n\n' +
    'Default admin password: bwa@admin2026\n\n' +
    'IMPORTANT: Change the password in the Config sheet before going live!'
  );
}
