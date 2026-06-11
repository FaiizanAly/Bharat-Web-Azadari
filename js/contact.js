// ============================================================
// BHARAT WEB AZADARI — Contact Page (contact.js)
// Handles contact form validation, submission to GAS,
// toast feedback, and a character counter on the textarea.
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initContactForm();
});

/* ─────────────────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────────────────── */

const FIELD_RULES = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    label: 'Your name',
  },
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    label: 'Email address',
  },
  subject: {
    required: true,
    minLength: 3,
    maxLength: 150,
    label: 'Subject',
  },
  message: {
    required: true,
    minLength: 10,
    maxLength: 1000,
    label: 'Message',
  },
};

const MESSAGE_MAX_CHARS = 1000;

/* ─────────────────────────────────────────────────────────
   1. Init
   ───────────────────────────────────────────────────────── */

/**
 * Initialise the contact form: attach submit handler, inline
 * validation listeners, and the character counter.
 */
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  // Attach submit handler
  form.addEventListener('submit', handleFormSubmit);

  // Attach blur (field-level) validation
  Object.keys(FIELD_RULES).forEach(fieldName => {
    const field = form.querySelector(`[name="${fieldName}"]`);
    if (!field) return;

    // Validate on blur
    field.addEventListener('blur', () => validateField(field, FIELD_RULES[fieldName]));

    // Clear error on input (re-validate only if there is already an error)
    field.addEventListener('input', () => {
      if (field.classList.contains('field-error')) {
        validateField(field, FIELD_RULES[fieldName]);
      }
    });
  });

  // Character counter for message textarea
  const messageField = form.querySelector('[name="message"]');
  if (messageField) initCharCounter(messageField);
}

/* ─────────────────────────────────────────────────────────
   2. Form Submission
   ───────────────────────────────────────────────────────── */

/**
 * Handle the contact form submission event.
 * Validates all fields, then POSTs to GAS.
 *
 * @param {SubmitEvent} e - The form submit event
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;

  // Validate all fields
  const isValid = validateForm(form);
  if (!isValid) {
    showToast('Please fix the errors above and try again.', 'error');
    // Focus first errored field
    form.querySelector('.field-error')?.focus();
    return;
  }

  // Collect form data
  const data = {
    name:    form.querySelector('[name="name"]')?.value.trim() || '',
    email:   form.querySelector('[name="email"]')?.value.trim() || '',
    subject: form.querySelector('[name="subject"]')?.value.trim() || '',
    message: form.querySelector('[name="message"]')?.value.trim() || '',
    timestamp: new Date().toISOString(),
  };

  // Show loading state
  const submitBtn = form.querySelector('[type="submit"]');
  const originalText = setButtonLoading(submitBtn, true);

  try {
    await apiPost('submitContact', data);

    // Success
    showToast('Message sent successfully! We will get back to you soon.', 'success', 6000);
    form.reset();
    resetCharCounter(form.querySelector('[name="message"]'));
    resetAllFieldErrors(form);
  } catch (err) {
    console.error('[BWA] Contact form submit error:', err);
    showToast(
      err.message?.includes('configured')
        ? 'The contact form is not yet fully set up. Please email us at ' + CONFIG.EMAIL
        : 'Failed to send message. Please try again or email us directly.',
      'error',
      8000
    );
  } finally {
    setButtonLoading(submitBtn, false, originalText);
  }
}

/* ─────────────────────────────────────────────────────────
   3. Validation
   ───────────────────────────────────────────────────────── */

/**
 * Validate all fields in the form.
 *
 * @param {HTMLFormElement} form - The form element
 * @returns {boolean} True if all fields are valid
 */
function validateForm(form) {
  let allValid = true;

  Object.entries(FIELD_RULES).forEach(([fieldName, rules]) => {
    const field = form.querySelector(`[name="${fieldName}"]`);
    if (!field) return;
    const valid = validateField(field, rules);
    if (!valid) allValid = false;
  });

  return allValid;
}

/**
 * Validate a single field and display inline error if invalid.
 *
 * @param {HTMLElement} field - The input or textarea element
 * @param {Object}      rules - Validation rule object from FIELD_RULES
 * @returns {boolean} True if the field is valid
 */
function validateField(field, rules) {
  const value = field.value.trim();
  let errorMsg = '';

  if (rules.required && !value) {
    errorMsg = `${rules.label} is required.`;
  } else if (value && rules.minLength && value.length < rules.minLength) {
    errorMsg = `${rules.label} must be at least ${rules.minLength} characters.`;
  } else if (value && rules.maxLength && value.length > rules.maxLength) {
    errorMsg = `${rules.label} must not exceed ${rules.maxLength} characters.`;
  } else if (value && rules.pattern && !rules.pattern.test(value)) {
    errorMsg = `Please enter a valid ${rules.label.toLowerCase()}.`;
  }

  if (errorMsg) {
    setFieldError(field, errorMsg);
    return false;
  } else {
    clearFieldError(field);
    return true;
  }
}

/**
 * Mark a field as invalid and display an error message below it.
 *
 * @param {HTMLElement} field    - The field element
 * @param {string}      message  - Error message to display
 */
function setFieldError(field, message) {
  field.classList.add('field-error');
  field.setAttribute('aria-invalid', 'true');

  // Find or create the error element
  const wrapperId = field.id || field.name;
  let errorEl = document.getElementById(`${wrapperId}-error`);

  if (!errorEl) {
    errorEl = document.createElement('p');
    errorEl.id = `${wrapperId}-error`;
    errorEl.className = 'field-error-msg';
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('aria-live', 'polite');
    field.parentNode.insertBefore(errorEl, field.nextSibling);
  }

  errorEl.textContent = message;
  field.setAttribute('aria-describedby', errorEl.id);
}

/**
 * Clear the error state from a field.
 *
 * @param {HTMLElement} field - The field element
 */
function clearFieldError(field) {
  field.classList.remove('field-error');
  field.setAttribute('aria-invalid', 'false');

  const wrapperId = field.id || field.name;
  const errorEl = document.getElementById(`${wrapperId}-error`);
  if (errorEl) errorEl.textContent = '';
  field.removeAttribute('aria-describedby');
}

/**
 * Clear all field error states in a form.
 *
 * @param {HTMLFormElement} form - The form element
 */
function resetAllFieldErrors(form) {
  form.querySelectorAll('.field-error').forEach(el => clearFieldError(el));
}

/* ─────────────────────────────────────────────────────────
   4. Character Counter
   ───────────────────────────────────────────────────────── */

/**
 * Attach a live character counter below the given textarea.
 *
 * @param {HTMLTextAreaElement} textarea - The message textarea
 */
function initCharCounter(textarea) {
  if (!textarea) return;

  // Create counter element
  let counter = document.getElementById('message-char-counter');
  if (!counter) {
    counter = document.createElement('p');
    counter.id = 'message-char-counter';
    counter.className = 'char-counter';
    counter.setAttribute('aria-live', 'polite');
    counter.setAttribute('aria-atomic', 'true');
    textarea.parentNode.insertBefore(counter, textarea.nextSibling);
  }

  function update() {
    const remaining = MESSAGE_MAX_CHARS - textarea.value.length;
    counter.textContent = `${textarea.value.length} / ${MESSAGE_MAX_CHARS} characters`;
    counter.classList.toggle('char-counter-warning', remaining < 100);
    counter.classList.toggle('char-counter-danger',  remaining < 20);
  }

  textarea.setAttribute('maxlength', MESSAGE_MAX_CHARS);
  textarea.addEventListener('input', update);
  update(); // Initial render
}

/**
 * Reset the character counter to zero (called after form reset).
 *
 * @param {HTMLTextAreaElement} textarea - The message textarea
 */
function resetCharCounter(textarea) {
  if (!textarea) return;
  const counter = document.getElementById('message-char-counter');
  if (counter) {
    counter.textContent = `0 / ${MESSAGE_MAX_CHARS} characters`;
    counter.classList.remove('char-counter-warning', 'char-counter-danger');
  }
}

/* ─────────────────────────────────────────────────────────
   5. Submit Button Loading State
   ───────────────────────────────────────────────────────── */

/**
 * Toggle the submit button between its normal and loading states.
 *
 * @param {HTMLButtonElement} btn         - The submit button
 * @param {boolean}           isLoading   - Whether to show the loading state
 * @param {string}            [restoreText] - Text to restore (pass when disabling)
 * @returns {string} The original button text (captured before loading state)
 */
function setButtonLoading(btn, isLoading, restoreText = '') {
  if (!btn) return '';

  if (isLoading) {
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
      <span class="btn-spinner" aria-hidden="true"></span>
      Sending…
    `;
    btn.setAttribute('aria-busy', 'true');
    return original;
  } else {
    btn.disabled = false;
    btn.innerHTML = restoreText || 'Send Message';
    btn.setAttribute('aria-busy', 'false');
    return '';
  }
}
