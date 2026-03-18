/**
 * Form Filler - Auto-populates LinkedIn job application fields
 * Handles text inputs, dropdowns, checkboxes, and custom questions
 */
const logger = require('../utils/logger');

const FIELD_MAPPINGS = {
  first_name: ['firstName', 'first_name', 'fname', 'first-name'],
  last_name: ['lastName', 'last_name', 'lname', 'last-name'],
  email: ['email', 'emailAddress', 'email_address', 'e-mail'],
  phone: ['phone', 'phoneNumber', 'phone_number', 'mobile', 'telephone'],
  location: ['location', 'city', 'address', 'current_location'],
  linkedin_url: ['linkedinUrl', 'linkedin_url', 'linkedin', 'profile_url'],
  portfolio: ['portfolio', 'website', 'portfolio_url', 'personal_website'],
  years_experience: ['yearsExperience', 'years_experience', 'experience', 'years_of_experience'],
  current_company: ['currentCompany', 'current_company', 'company', 'employer'],
  current_title: ['currentTitle', 'current_title', 'title', 'job_title', 'position'],
  salary_expectation: [
    'salaryExpectation',
    'salary_expectation',
    'expected_salary',
    'desired_salary',
  ],
  start_date: ['startDate', 'start_date', 'availability', 'available_date'],
  cover_letter: ['coverLetter', 'cover_letter', 'cover', 'message'],
  work_authorization: ['workAuthorization', 'work_authorization', 'authorized', 'visa_status'],
  willing_to_relocate: ['willingToRelocate', 'willing_to_relocate', 'relocate', 'relocation'],
};

class FormFiller {
  constructor(userProfile = {}) {
    this.userProfile = userProfile;
    this.fieldMap = this._buildFieldMap();
    this.filledFields = [];
    this.skippedFields = [];
  }

  /**
   * Build a reverse lookup from all aliases to canonical field names
   */
  _buildFieldMap() {
    const map = {};
    for (const [canonical, aliases] of Object.entries(FIELD_MAPPINGS)) {
      for (const alias of aliases) {
        map[alias.toLowerCase()] = canonical;
      }
      map[canonical.toLowerCase()] = canonical;
    }
    return map;
  }

  /**
   * Resolve a form field name to its canonical name
   */
  resolveFieldName(fieldName) {
    if (!fieldName) {
      return null;
    }
    const normalized = fieldName.toLowerCase().replace(/[-\s]+/g, '_');
    return this.fieldMap[normalized] || null;
  }

  /**
   * Get the value for a canonical field from user profile
   */
  getFieldValue(canonicalName) {
    const profile = this.userProfile;
    const valueMap = {
      first_name: profile.firstName,
      last_name: profile.lastName,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      linkedin_url: profile.linkedinUrl,
      portfolio: profile.portfolio,
      years_experience: profile.yearsExperience,
      current_company: profile.currentCompany,
      current_title: profile.currentTitle,
      salary_expectation: profile.salaryExpectation,
      start_date: profile.startDate,
      cover_letter: profile.coverLetter,
      work_authorization: profile.workAuthorization,
      willing_to_relocate: profile.willingToRelocate,
    };
    return valueMap[canonicalName] !== undefined ? valueMap[canonicalName] : null;
  }

  /**
   * Fill a single form field
   * Returns { fieldName, canonicalName, value, filled }
   */
  fillField(fieldName, fieldType = 'text') {
    const canonical = this.resolveFieldName(fieldName);
    if (!canonical) {
      this.skippedFields.push({ fieldName, reason: 'unrecognized' });
      return { fieldName, canonicalName: null, value: null, filled: false, reason: 'unrecognized' };
    }

    const value = this.getFieldValue(canonical);
    if (value === null || value === undefined) {
      this.skippedFields.push({ fieldName, canonicalName: canonical, reason: 'no_value' });
      return {
        fieldName,
        canonicalName: canonical,
        value: null,
        filled: false,
        reason: 'no_value',
      };
    }

    const formattedValue = this._formatValue(value, fieldType);
    this.filledFields.push({
      fieldName,
      canonicalName: canonical,
      value: formattedValue,
      fieldType,
    });

    return { fieldName, canonicalName: canonical, value: formattedValue, filled: true };
  }

  /**
   * Fill multiple form fields at once
   * @param {Array<{name: string, type: string}>} fields
   * @returns {Object} result with filled, skipped, and summary
   */
  fillForm(fields) {
    if (!Array.isArray(fields)) {
      throw new Error('fields must be an array');
    }

    const results = [];
    for (const field of fields) {
      const name = typeof field === 'string' ? field : field.name;
      const type = typeof field === 'string' ? 'text' : field.type || 'text';
      results.push(this.fillField(name, type));
    }

    const filled = results.filter((r) => r.filled);
    const skipped = results.filter((r) => !r.filled);

    logger.debug('Form fill complete', {
      total: fields.length,
      filled: filled.length,
      skipped: skipped.length,
    });

    return {
      results,
      filled,
      skipped,
      summary: {
        total: fields.length,
        filledCount: filled.length,
        skippedCount: skipped.length,
        completionRate: fields.length > 0 ? filled.length / fields.length : 0,
      },
    };
  }

  /**
   * Generate form data payload from user profile for known fields
   */
  generatePayload(requiredFields = []) {
    const payload = {};
    for (const fieldName of requiredFields) {
      const canonical = this.resolveFieldName(fieldName);
      if (canonical) {
        const value = this.getFieldValue(canonical);
        if (value !== null && value !== undefined) {
          payload[fieldName] = value;
        }
      }
    }
    return payload;
  }

  /**
   * Validate that all required fields can be filled
   */
  validateRequiredFields(requiredFields) {
    const missing = [];
    const available = [];

    for (const fieldName of requiredFields) {
      const canonical = this.resolveFieldName(fieldName);
      if (!canonical) {
        missing.push({ field: fieldName, reason: 'unrecognized' });
        continue;
      }
      const value = this.getFieldValue(canonical);
      if (value === null || value === undefined) {
        missing.push({ field: fieldName, canonicalName: canonical, reason: 'no_value' });
      } else {
        available.push({ field: fieldName, canonicalName: canonical });
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      available,
      completeness: requiredFields.length > 0 ? available.length / requiredFields.length : 1,
    };
  }

  /**
   * Format value based on field type
   */
  _formatValue(value, fieldType) {
    switch (fieldType) {
      case 'number':
        return typeof value === 'number' ? value : parseInt(value, 10) || value;
      case 'boolean':
      case 'checkbox':
        if (typeof value === 'boolean') {
          return value;
        }
        return value === 'true' || value === 'yes' || value === '1';
      case 'date':
        if (value instanceof Date) {
          return value.toISOString().split('T')[0];
        }
        return String(value);
      case 'select':
      case 'dropdown':
        return String(value);
      default:
        return String(value);
    }
  }

  /**
   * Get fill statistics
   */
  getStats() {
    return {
      filledCount: this.filledFields.length,
      skippedCount: this.skippedFields.length,
      filledFields: this.filledFields.map((f) => f.canonicalName),
      skippedFields: this.skippedFields.map((f) => ({
        field: f.fieldName,
        reason: f.reason,
      })),
    };
  }

  /**
   * Reset fill tracking
   */
  reset() {
    this.filledFields = [];
    this.skippedFields = [];
  }
}

// ---------------------------------------------------------------------------
// CustomQAHandler — answers custom Q&A fields on LinkedIn application forms
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

const DEFAULT_QA_CONFIG_PATH = path.resolve(__dirname, '../../config/qa-answers.json');

/**
 * CustomQAHandler
 * Loads a Q&A answer config and fuzzy-matches question text to provide answers.
 * Does NOT modify FormFiller — it is a standalone, additive export.
 */
class CustomQAHandler {
  constructor(options = {}) {
    this.configPath = options.configPath || DEFAULT_QA_CONFIG_PATH;
    this._answers = [];
    this._fallback = 'skip';
    this._loaded = false;
  }

  /**
   * Load answer config from the default path (lazy — called automatically by findAnswer).
   * Gracefully falls back to empty config if the file is missing.
   */
  _ensureLoaded() {
    if (this._loaded) {
      return;
    }
    this.loadFromFile(this.configPath);
  }

  /**
   * Load answer config from a custom file path.
   * @param {string} filePath - Absolute or relative path to a qa-answers.json file.
   */
  loadFromFile(filePath) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const config = JSON.parse(raw);
      this._answers = Array.isArray(config.answers) ? config.answers : [];
      this._fallback = config.fallback || 'skip';
      this._loaded = true;
      logger.debug('CustomQAHandler: loaded Q&A config', {
        file: filePath,
        count: this._answers.length,
      });
    } catch (err) {
      logger.warn('CustomQAHandler: could not load Q&A config, using empty defaults', {
        file: filePath,
        error: err.message,
      });
      this._answers = [];
      this._fallback = 'skip';
      this._loaded = true;
    }
  }

  /**
   * Find the best matching answer entry for a question text.
   * @param {string} questionText - The label text of the form question.
   * @returns {Object|null} matched answer entry or null if no match found.
   */
  findAnswer(questionText) {
    this._ensureLoaded();

    if (!questionText || typeof questionText !== 'string') {
      return null;
    }

    const normalizedQuestion = questionText.toLowerCase().trim();

    for (const entry of this._answers) {
      if (!entry.pattern) {
        continue;
      }

      const matched = this._matchPattern(normalizedQuestion, entry.pattern, entry.matchMode);
      if (matched) {
        return entry;
      }
    }

    return null;
  }

  /**
   * Answer a question given its text and the HTML field type.
   * @param {string} questionText - The label text of the form question.
   * @param {string} fieldType - 'text' | 'numeric' | 'boolean' | 'select' | etc.
   * @returns {string|boolean|number|null} formatted answer, or null if no match / fallback=skip.
   */
  answerQuestion(questionText, fieldType) {
    const entry = this.findAnswer(questionText);

    if (!entry) {
      if (this._fallback === 'skip') {
        return null;
      }
      return null;
    }

    return this._formatAnswer(entry.value, fieldType || entry.type);
  }

  /**
   * Match a question string against a pattern using the specified matchMode.
   * @param {string} question - Normalised question text (lowercase).
   * @param {string} pattern - Pattern from config.
   * @param {string} matchMode - 'contains' | 'exact' | 'regex'
   * @returns {boolean}
   */
  _matchPattern(question, pattern, matchMode) {
    const mode = (matchMode || 'contains').toLowerCase();
    const normalizedPattern = pattern.toLowerCase().trim();

    switch (mode) {
      case 'exact':
        return question === normalizedPattern;

      case 'regex': {
        try {
          const re = new RegExp(pattern, 'i');
          return re.test(question);
        } catch (err) {
          logger.warn('CustomQAHandler: invalid regex pattern', { pattern, error: err.message });
          return false;
        }
      }

      case 'contains':
      default:
        return question.includes(normalizedPattern);
    }
  }

  /**
   * Format a raw config value into the expected type for the form field.
   * @param {string} rawValue - The string value from config.
   * @param {string} fieldType - Desired output type.
   * @returns {string|boolean|number}
   */
  _formatAnswer(rawValue, fieldType) {
    switch ((fieldType || 'text').toLowerCase()) {
      case 'numeric':
      case 'number':
        return parseInt(rawValue, 10) || rawValue;

      case 'boolean':
      case 'checkbox': {
        const lower = String(rawValue).toLowerCase();
        return lower === 'yes' || lower === 'true' || lower === '1';
      }

      case 'text':
      default:
        return String(rawValue);
    }
  }

  /**
   * Return how many answer rules are currently loaded.
   * @returns {number}
   */
  get answerCount() {
    this._ensureLoaded();
    return this._answers.length;
  }
}

module.exports = { FormFiller, FIELD_MAPPINGS, CustomQAHandler };
