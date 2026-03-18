jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { FormFiller, FIELD_MAPPINGS } = require('../../../src/automation/formFiller');

describe('FormFiller', () => {
  const mockProfile = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '555-1234',
    location: 'San Francisco, CA',
    linkedinUrl: 'https://linkedin.com/in/johndoe',
    portfolio: 'https://johndoe.dev',
    yearsExperience: 5,
    currentCompany: 'TechCorp',
    currentTitle: 'Software Engineer',
    salaryExpectation: 150000,
    startDate: '2026-04-01',
    coverLetter: 'Dear Hiring Manager...',
    workAuthorization: 'yes',
    willingToRelocate: true,
  };

  describe('constructor', () => {
    it('creates instance with profile', () => {
      const filler = new FormFiller(mockProfile);
      expect(filler.userProfile).toBe(mockProfile);
      expect(filler.filledFields).toEqual([]);
      expect(filler.skippedFields).toEqual([]);
    });

    it('creates instance with empty profile', () => {
      const filler = new FormFiller();
      expect(filler.userProfile).toEqual({});
    });
  });

  describe('resolveFieldName', () => {
    it('resolves canonical field names', () => {
      const filler = new FormFiller(mockProfile);
      expect(filler.resolveFieldName('first_name')).toBe('first_name');
      expect(filler.resolveFieldName('email')).toBe('email');
    });

    it('resolves aliases', () => {
      const filler = new FormFiller(mockProfile);
      expect(filler.resolveFieldName('firstName')).toBe('first_name');
      expect(filler.resolveFieldName('fname')).toBe('first_name');
      expect(filler.resolveFieldName('emailAddress')).toBe('email');
      expect(filler.resolveFieldName('phoneNumber')).toBe('phone');
    });

    it('returns null for unknown fields', () => {
      const filler = new FormFiller(mockProfile);
      expect(filler.resolveFieldName('unknown_field')).toBeNull();
      expect(filler.resolveFieldName('favorite_color')).toBeNull();
    });

    it('handles null input', () => {
      const filler = new FormFiller(mockProfile);
      expect(filler.resolveFieldName(null)).toBeNull();
    });

    it('is case insensitive', () => {
      const filler = new FormFiller(mockProfile);
      expect(filler.resolveFieldName('FIRST_NAME')).toBe('first_name');
      expect(filler.resolveFieldName('Email')).toBe('email');
    });

    it('handles hyphens and spaces', () => {
      const filler = new FormFiller(mockProfile);
      expect(filler.resolveFieldName('first-name')).toBe('first_name');
      expect(filler.resolveFieldName('last name')).toBe('last_name');
    });
  });

  describe('getFieldValue', () => {
    it('returns profile values for known fields', () => {
      const filler = new FormFiller(mockProfile);
      expect(filler.getFieldValue('first_name')).toBe('John');
      expect(filler.getFieldValue('email')).toBe('john@example.com');
      expect(filler.getFieldValue('years_experience')).toBe(5);
    });

    it('returns null for fields not in profile', () => {
      const filler = new FormFiller({ firstName: 'John' });
      expect(filler.getFieldValue('email')).toBeNull();
      expect(filler.getFieldValue('phone')).toBeNull();
    });

    it('returns boolean values correctly', () => {
      const filler = new FormFiller(mockProfile);
      expect(filler.getFieldValue('willing_to_relocate')).toBe(true);
    });

    it('returns number values correctly', () => {
      const filler = new FormFiller(mockProfile);
      expect(filler.getFieldValue('salary_expectation')).toBe(150000);
    });
  });

  describe('fillField', () => {
    it('fills a recognized field with value', () => {
      const filler = new FormFiller(mockProfile);
      const result = filler.fillField('first_name');
      expect(result.filled).toBe(true);
      expect(result.value).toBe('John');
      expect(result.canonicalName).toBe('first_name');
    });

    it('returns not filled for unrecognized field', () => {
      const filler = new FormFiller(mockProfile);
      const result = filler.fillField('unknown_field');
      expect(result.filled).toBe(false);
      expect(result.reason).toBe('unrecognized');
    });

    it('returns not filled when no value available', () => {
      const filler = new FormFiller({ firstName: 'John' });
      const result = filler.fillField('email');
      expect(result.filled).toBe(false);
      expect(result.reason).toBe('no_value');
    });

    it('tracks filled fields', () => {
      const filler = new FormFiller(mockProfile);
      filler.fillField('first_name');
      filler.fillField('email');
      expect(filler.filledFields).toHaveLength(2);
    });

    it('tracks skipped fields', () => {
      const filler = new FormFiller({});
      filler.fillField('first_name');
      filler.fillField('unknown_xyz');
      expect(filler.skippedFields).toHaveLength(2);
    });

    it('formats number type', () => {
      const filler = new FormFiller(mockProfile);
      const result = filler.fillField('years_experience', 'number');
      expect(result.value).toBe(5);
    });

    it('formats boolean type', () => {
      const filler = new FormFiller({ ...mockProfile, willingToRelocate: 'true' });
      const result = filler.fillField('willing_to_relocate', 'checkbox');
      expect(result.value).toBe(true);
    });

    it('formats date type', () => {
      const filler = new FormFiller({ ...mockProfile, startDate: new Date('2026-04-01') });
      const result = filler.fillField('start_date', 'date');
      expect(result.value).toBe('2026-04-01');
    });
  });

  describe('fillForm', () => {
    it('fills multiple fields', () => {
      const filler = new FormFiller(mockProfile);
      const result = filler.fillForm([
        { name: 'first_name', type: 'text' },
        { name: 'last_name', type: 'text' },
        { name: 'email', type: 'text' },
      ]);
      expect(result.filled).toHaveLength(3);
      expect(result.skipped).toHaveLength(0);
      expect(result.summary.completionRate).toBe(1);
    });

    it('handles mixed filled and skipped', () => {
      const filler = new FormFiller({ firstName: 'John' });
      const result = filler.fillForm([
        { name: 'first_name', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'unknown_field', type: 'text' },
      ]);
      expect(result.filled).toHaveLength(1);
      expect(result.skipped).toHaveLength(2);
      expect(result.summary.completionRate).toBeCloseTo(0.333, 2);
    });

    it('accepts string array', () => {
      const filler = new FormFiller(mockProfile);
      const result = filler.fillForm(['first_name', 'email']);
      expect(result.filled).toHaveLength(2);
    });

    it('throws for non-array input', () => {
      const filler = new FormFiller(mockProfile);
      expect(() => filler.fillForm('first_name')).toThrow('fields must be an array');
    });

    it('handles empty array', () => {
      const filler = new FormFiller(mockProfile);
      const result = filler.fillForm([]);
      expect(result.filled).toHaveLength(0);
      expect(result.summary.completionRate).toBe(0);
    });

    it('returns summary with correct totals', () => {
      const filler = new FormFiller(mockProfile);
      const result = filler.fillForm(['first_name', 'last_name', 'email', 'phone', 'unknown']);
      expect(result.summary.total).toBe(5);
      expect(result.summary.filledCount).toBe(4);
      expect(result.summary.skippedCount).toBe(1);
    });
  });

  describe('generatePayload', () => {
    it('generates payload for known fields', () => {
      const filler = new FormFiller(mockProfile);
      const payload = filler.generatePayload(['first_name', 'email', 'phone']);
      expect(payload).toEqual({
        first_name: 'John',
        email: 'john@example.com',
        phone: '555-1234',
      });
    });

    it('skips fields without values', () => {
      const filler = new FormFiller({ firstName: 'John' });
      const payload = filler.generatePayload(['first_name', 'email']);
      expect(payload).toEqual({ first_name: 'John' });
      expect(payload.email).toBeUndefined();
    });

    it('returns empty object for empty fields', () => {
      const filler = new FormFiller(mockProfile);
      expect(filler.generatePayload([])).toEqual({});
    });
  });

  describe('validateRequiredFields', () => {
    it('validates all fields present', () => {
      const filler = new FormFiller(mockProfile);
      const result = filler.validateRequiredFields(['first_name', 'email']);
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.completeness).toBe(1);
    });

    it('reports missing values', () => {
      const filler = new FormFiller({ firstName: 'John' });
      const result = filler.validateRequiredFields(['first_name', 'email']);
      expect(result.valid).toBe(false);
      expect(result.missing).toHaveLength(1);
      expect(result.missing[0].canonicalName).toBe('email');
    });

    it('reports unrecognized fields', () => {
      const filler = new FormFiller(mockProfile);
      const result = filler.validateRequiredFields(['first_name', 'xyz_unknown']);
      expect(result.valid).toBe(false);
      expect(result.missing[0].reason).toBe('unrecognized');
    });

    it('handles empty required fields', () => {
      const filler = new FormFiller(mockProfile);
      const result = filler.validateRequiredFields([]);
      expect(result.valid).toBe(true);
      expect(result.completeness).toBe(1);
    });
  });

  describe('getStats', () => {
    it('returns stats after filling', () => {
      const filler = new FormFiller(mockProfile);
      filler.fillField('first_name');
      filler.fillField('unknown');
      const stats = filler.getStats();
      expect(stats.filledCount).toBe(1);
      expect(stats.skippedCount).toBe(1);
      expect(stats.filledFields).toContain('first_name');
    });
  });

  describe('reset', () => {
    it('clears tracking state', () => {
      const filler = new FormFiller(mockProfile);
      filler.fillField('first_name');
      filler.fillField('unknown');
      filler.reset();
      expect(filler.filledFields).toHaveLength(0);
      expect(filler.skippedFields).toHaveLength(0);
    });
  });

  describe('FIELD_MAPPINGS', () => {
    it('exports field mappings constant', () => {
      expect(FIELD_MAPPINGS).toBeDefined();
      expect(FIELD_MAPPINGS.first_name).toContain('firstName');
      expect(FIELD_MAPPINGS.email).toContain('emailAddress');
    });

    it('has mappings for all standard fields', () => {
      const expectedFields = [
        'first_name',
        'last_name',
        'email',
        'phone',
        'location',
        'linkedin_url',
        'portfolio',
        'years_experience',
        'current_company',
        'current_title',
        'salary_expectation',
        'start_date',
        'cover_letter',
        'work_authorization',
        'willing_to_relocate',
      ];
      for (const field of expectedFields) {
        expect(FIELD_MAPPINGS).toHaveProperty(field);
      }
    });
  });
});
