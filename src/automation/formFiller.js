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
  salary_expectation: ['salaryExpectation', 'salary_expectation', 'expected_salary', 'desired_salary'],
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
    if (!fieldName) {return null;}
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
      return { fieldName, canonicalName: canonical, value: null, filled: false, reason: 'no_value' };
    }

    const formattedValue = this._formatValue(value, fieldType);
    this.filledFields.push({ fieldName, canonicalName: canonical, value: formattedValue, fieldType });

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
      const type = typeof field === 'string' ? 'text' : (field.type || 'text');
      results.push(this.fillField(name, type));
    }

    const filled = results.filter(r => r.filled);
    const skipped = results.filter(r => !r.filled);

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
      completeness: requiredFields.length > 0
        ? available.length / requiredFields.length
        : 1,
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
        if (typeof value === 'boolean') {return value;}
        return value === 'true' || value === 'yes' || value === '1';
      case 'date':
        if (value instanceof Date) {return value.toISOString().split('T')[0];}
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
      filledFields: this.filledFields.map(f => f.canonicalName),
      skippedFields: this.skippedFields.map(f => ({
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

module.exports = { FormFiller, FIELD_MAPPINGS };
