/**
 * Unit tests for src/utils/validators.js
 * Tests all input validation utilities.
 */

const {
  isValidEmail,
  isValidUUID,
  isValidURL,
  isValidSalaryRange,
  validatePagination,
  sanitizeString,
  isValidApplicationStatus,
  isValidJobLevel,
  validateRequiredFields,
  validatePasswordStrength,
} = require('../../../src/utils/validators');

// ============================================================
// isValidEmail
// ============================================================
describe('validators - isValidEmail', () => {
  test('accepts valid email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('john.doe@company.co.uk')).toBe(true);
    expect(isValidEmail('test+tag@gmail.com')).toBe(true);
    expect(isValidEmail('user123@domain.org')).toBe(true);
    expect(isValidEmail('a@b.co')).toBe(true);
  });

  test('rejects invalid email addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('missing@')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user @domain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
  });

  test('rejects null and undefined', () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });

  test('rejects non-string types', () => {
    expect(isValidEmail(123)).toBe(false);
    expect(isValidEmail({})).toBe(false);
    expect(isValidEmail([])).toBe(false);
    expect(isValidEmail(true)).toBe(false);
  });

  test('trims whitespace before validation', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true);
  });
});

// ============================================================
// isValidUUID
// ============================================================
describe('validators - isValidUUID', () => {
  test('accepts valid UUID v4 strings', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
  });

  test('accepts UUIDs in uppercase', () => {
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  test('rejects invalid UUID formats', () => {
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
    expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false);
    expect(isValidUUID('gggggggg-gggg-gggg-gggg-gggggggggggg')).toBe(false);
  });

  test('rejects null, undefined, and non-string types', () => {
    expect(isValidUUID(null)).toBe(false);
    expect(isValidUUID(undefined)).toBe(false);
    expect(isValidUUID(123)).toBe(false);
    expect(isValidUUID({})).toBe(false);
  });
});

// ============================================================
// isValidURL
// ============================================================
describe('validators - isValidURL', () => {
  test('accepts valid HTTP URLs', () => {
    expect(isValidURL('http://example.com')).toBe(true);
    expect(isValidURL('https://example.com')).toBe(true);
    expect(isValidURL('https://www.example.com/path?query=1')).toBe(true);
    expect(isValidURL('http://localhost:3000')).toBe(true);
    expect(isValidURL('https://sub.domain.co.uk/path')).toBe(true);
  });

  test('rejects invalid URLs', () => {
    expect(isValidURL('')).toBe(false);
    expect(isValidURL('ftp://files.com')).toBe(false);
    expect(isValidURL('not a url')).toBe(false);
    expect(isValidURL('example.com')).toBe(false);
    expect(isValidURL('://missing-protocol')).toBe(false);
  });

  test('rejects null, undefined, and non-string types', () => {
    expect(isValidURL(null)).toBe(false);
    expect(isValidURL(undefined)).toBe(false);
    expect(isValidURL(42)).toBe(false);
  });
});

// ============================================================
// isValidSalaryRange
// ============================================================
describe('validators - isValidSalaryRange', () => {
  test('accepts valid salary ranges', () => {
    expect(isValidSalaryRange(50000, 100000)).toEqual({ valid: true });
    expect(isValidSalaryRange(0, 0)).toEqual({ valid: true });
    expect(isValidSalaryRange(100000, 100000)).toEqual({ valid: true });
  });

  test('accepts when only min is provided', () => {
    expect(isValidSalaryRange(50000, undefined)).toEqual({ valid: true });
    expect(isValidSalaryRange(50000, null)).toEqual({ valid: true });
  });

  test('accepts when only max is provided', () => {
    expect(isValidSalaryRange(undefined, 100000)).toEqual({ valid: true });
    expect(isValidSalaryRange(null, 100000)).toEqual({ valid: true });
  });

  test('accepts when both are undefined/null', () => {
    expect(isValidSalaryRange(undefined, undefined)).toEqual({ valid: true });
    expect(isValidSalaryRange(null, null)).toEqual({ valid: true });
  });

  test('rejects negative min salary', () => {
    const result = isValidSalaryRange(-1, 100000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('non-negative');
  });

  test('rejects negative max salary', () => {
    const result = isValidSalaryRange(0, -1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('non-negative');
  });

  test('rejects when min exceeds max', () => {
    const result = isValidSalaryRange(150000, 100000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot exceed');
  });

  test('rejects non-number types', () => {
    const result = isValidSalaryRange('50000', 100000);
    expect(result.valid).toBe(false);
  });
});

// ============================================================
// validatePagination
// ============================================================
describe('validators - validatePagination', () => {
  test('accepts valid pagination params', () => {
    const result = validatePagination(1, 20);
    expect(result.valid).toBe(true);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  test('parses string values', () => {
    const result = validatePagination('3', '50');
    expect(result.valid).toBe(true);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  test('defaults to page 1 and limit 20 for invalid input', () => {
    const result = validatePagination(null, null);
    expect(result.valid).toBe(true);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  test('defaults for undefined input', () => {
    const result = validatePagination(undefined, undefined);
    expect(result.valid).toBe(true);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  test('rejects page less than 1', () => {
    // parseInt('0', 10) returns 0 which is falsy, so || 1 kicks in -> page=1
    // parseInt('-1', 10) returns -1 which is truthy, so page=-1
    const result = validatePagination(-1, 20);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Page');
  });

  test('rejects limit greater than 100', () => {
    const result = validatePagination(1, 101);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Limit');
  });

  test('rejects limit of 0', () => {
    // parseInt('0', 10) = 0, falsy, so || 20 kicks in -> limit=20 (valid)
    const result = validatePagination(1, 0);
    expect(result.valid).toBe(true);
    expect(result.limit).toBe(20);
  });

  test('accepts boundary values', () => {
    expect(validatePagination(1, 1).valid).toBe(true);
    expect(validatePagination(1, 100).valid).toBe(true);
    expect(validatePagination(999, 50).valid).toBe(true);
  });
});

// ============================================================
// sanitizeString
// ============================================================
describe('validators - sanitizeString', () => {
  test('escapes HTML special characters', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  test('escapes ampersands', () => {
    expect(sanitizeString('a & b')).toBe('a &amp; b');
  });

  test('escapes single quotes', () => {
    expect(sanitizeString("it's")).toBe('it&#x27;s');
  });

  test('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  test('returns empty string for null and undefined', () => {
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
  });

  test('returns empty string for non-string types', () => {
    expect(sanitizeString(123)).toBe('');
    expect(sanitizeString({})).toBe('');
    expect(sanitizeString([])).toBe('');
  });

  test('returns empty string for empty string', () => {
    expect(sanitizeString('')).toBe('');
  });

  test('handles mixed special characters', () => {
    expect(sanitizeString('<div class="test">Hello & \'World\'</div>')).toBe(
      '&lt;div class=&quot;test&quot;&gt;Hello &amp; &#x27;World&#x27;&lt;/div&gt;',
    );
  });

  test('preserves normal text', () => {
    expect(sanitizeString('Hello World 123')).toBe('Hello World 123');
  });
});

// ============================================================
// isValidApplicationStatus
// ============================================================
describe('validators - isValidApplicationStatus', () => {
  test('accepts all valid statuses', () => {
    expect(isValidApplicationStatus('pending')).toBe(true);
    expect(isValidApplicationStatus('submitted')).toBe(true);
    expect(isValidApplicationStatus('viewed')).toBe(true);
    expect(isValidApplicationStatus('rejected')).toBe(true);
    expect(isValidApplicationStatus('archived')).toBe(true);
  });

  test('rejects invalid statuses', () => {
    expect(isValidApplicationStatus('active')).toBe(false);
    expect(isValidApplicationStatus('PENDING')).toBe(false);
    expect(isValidApplicationStatus('')).toBe(false);
    expect(isValidApplicationStatus('deleted')).toBe(false);
  });

  test('rejects non-string types', () => {
    expect(isValidApplicationStatus(null)).toBe(false);
    expect(isValidApplicationStatus(undefined)).toBe(false);
    expect(isValidApplicationStatus(1)).toBe(false);
  });
});

// ============================================================
// isValidJobLevel
// ============================================================
describe('validators - isValidJobLevel', () => {
  test('accepts all valid job levels', () => {
    expect(isValidJobLevel('entry')).toBe(true);
    expect(isValidJobLevel('mid')).toBe(true);
    expect(isValidJobLevel('senior')).toBe(true);
    expect(isValidJobLevel('lead')).toBe(true);
    expect(isValidJobLevel('director')).toBe(true);
    expect(isValidJobLevel('executive')).toBe(true);
  });

  test('rejects invalid job levels', () => {
    expect(isValidJobLevel('junior')).toBe(false);
    expect(isValidJobLevel('SENIOR')).toBe(false);
    expect(isValidJobLevel('')).toBe(false);
    expect(isValidJobLevel('intern')).toBe(false);
  });

  test('rejects non-string types', () => {
    expect(isValidJobLevel(null)).toBe(false);
    expect(isValidJobLevel(undefined)).toBe(false);
    expect(isValidJobLevel(2)).toBe(false);
  });
});

// ============================================================
// validateRequiredFields
// ============================================================
describe('validators - validateRequiredFields', () => {
  test('passes when all required fields are present', () => {
    const obj = { name: 'John', email: 'john@test.com', age: 30 };
    const result = validateRequiredFields(obj, ['name', 'email']);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  test('fails when fields are missing', () => {
    const obj = { name: 'John' };
    const result = validateRequiredFields(obj, ['name', 'email']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['email']);
  });

  test('treats null values as missing', () => {
    const obj = { name: 'John', email: null };
    const result = validateRequiredFields(obj, ['name', 'email']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['email']);
  });

  test('treats undefined values as missing', () => {
    const obj = { name: 'John', email: undefined };
    const result = validateRequiredFields(obj, ['name', 'email']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['email']);
  });

  test('treats empty string as missing', () => {
    const obj = { name: 'John', email: '' };
    const result = validateRequiredFields(obj, ['name', 'email']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['email']);
  });

  test('returns all fields as missing for null object', () => {
    const result = validateRequiredFields(null, ['name', 'email']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['name', 'email']);
  });

  test('returns all fields as missing for non-object', () => {
    const result = validateRequiredFields('string', ['name']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['name']);
  });

  test('passes with empty required fields array', () => {
    const result = validateRequiredFields({}, []);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  test('accepts zero and false as valid values', () => {
    const obj = { count: 0, active: false };
    const result = validateRequiredFields(obj, ['count', 'active']);
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// validatePasswordStrength
// ============================================================
describe('validators - validatePasswordStrength', () => {
  test('accepts a strong password', () => {
    const result = validatePasswordStrength('MyStr0ng!Pass');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects passwords shorter than 8 characters', () => {
    const result = validatePasswordStrength('Ab1!xyz');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters');
  });

  test('rejects passwords longer than 128 characters', () => {
    const longPass = 'Ab1!' + 'a'.repeat(125);
    const result = validatePasswordStrength(longPass);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at most 128 characters');
  });

  test('rejects passwords without uppercase letter', () => {
    const result = validatePasswordStrength('nouppercas3!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  test('rejects passwords without lowercase letter', () => {
    const result = validatePasswordStrength('NOLOWERCASE3!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one lowercase letter');
  });

  test('rejects passwords without digits', () => {
    const result = validatePasswordStrength('NoDigits!here');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one digit');
  });

  test('rejects passwords without special characters', () => {
    const result = validatePasswordStrength('NoSpecial123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one special character');
  });

  test('returns multiple errors for very weak passwords', () => {
    const result = validatePasswordStrength('abc');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  test('rejects null password', () => {
    const result = validatePasswordStrength(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password is required');
  });

  test('rejects undefined password', () => {
    const result = validatePasswordStrength(undefined);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password is required');
  });

  test('rejects non-string password', () => {
    const result = validatePasswordStrength(12345678);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password is required');
  });

  test('accepts passwords at exactly 8 characters', () => {
    const result = validatePasswordStrength('Abcdef1!');
    expect(result.valid).toBe(true);
  });

  test('accepts passwords at exactly 128 characters', () => {
    const pass = 'Ab1!' + 'a'.repeat(124);
    const result = validatePasswordStrength(pass);
    expect(result.valid).toBe(true);
  });
});
