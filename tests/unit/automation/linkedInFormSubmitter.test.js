jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../src/utils/config', () => ({
  features: { mockLinkedIn: true },
  application: { maxPerDay: 50, retryAttempts: 3, retryDelayMs: 1, minIntervalSeconds: 0 },
}));

const {
  LinkedInFormSubmitter,
  SUBMISSION_STATES,
  LINKEDIN_ERRORS,
} = require('../../../src/automation/linkedInFormSubmitter');

describe('LinkedInFormSubmitter', () => {
  let submitter;

  const mockJob = {
    id: 'job-1',
    linkedinJobId: 'li_123',
    title: 'Software Engineer',
    company: 'TechCorp',
    location: 'San Francisco, CA',
  };

  const mockProfile = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '555-1234',
    location: 'San Francisco, CA',
    linkedinUrl: 'https://linkedin.com/in/johndoe',
    currentCompany: 'OldCorp',
    currentTitle: 'Developer',
  };

  beforeEach(() => {
    submitter = new LinkedInFormSubmitter({
      mockMode: true,
      mockDelay: 0,
      mockFailRate: 0,
    });
  });

  describe('constructor', () => {
    it('creates with default mock mode from config', () => {
      const s = new LinkedInFormSubmitter();
      expect(s.mockMode).toBe(true);
    });

    it('accepts explicit mock mode', () => {
      const s = new LinkedInFormSubmitter({ mockMode: false });
      expect(s.mockMode).toBe(false);
    });

    it('sets submission timeout', () => {
      const s = new LinkedInFormSubmitter({ submissionTimeout: 60000 });
      expect(s.submissionTimeout).toBe(60000);
    });
  });

  describe('submit', () => {
    it('successfully submits in mock mode', async () => {
      const result = await submitter.submit({
        job: mockJob,
        userProfile: mockProfile,
      });
      expect(result.success).toBe(true);
      expect(result.submissionId).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('includes timeline in result', async () => {
      const result = await submitter.submit({
        job: mockJob,
        userProfile: mockProfile,
      });
      expect(result.timeline).toBeDefined();
      expect(result.timeline.length).toBeGreaterThan(0);
      expect(result.timeline[0].state).toBe(SUBMISSION_STATES.PENDING);
    });

    it('fails when minimum profile data missing', async () => {
      const result = await submitter.submit({
        job: mockJob,
        userProfile: {},
      });
      expect(result.success).toBe(false);
      expect(result.errorType).toBe('form_fill_failed');
    });

    it('handles cover letter', async () => {
      const result = await submitter.submit({
        job: mockJob,
        userProfile: mockProfile,
        coverLetter: 'Dear Hiring Manager...',
      });
      expect(result.success).toBe(true);
    });

    it('tracks resume upload step', async () => {
      const result = await submitter.submit({
        job: mockJob,
        userProfile: mockProfile,
        resumePath: '/fake/resume.pdf',
      });
      // Resume validation will fail but submission continues
      expect(result.success).toBe(true);
    });

    it('handles mock failures', async () => {
      const failSubmitter = new LinkedInFormSubmitter({
        mockMode: true,
        mockDelay: 0,
        mockFailRate: 1.0, // always fail
      });
      const result = await failSubmitter.submit({
        job: mockJob,
        userProfile: mockProfile,
      });
      expect(result.success).toBe(false);
    });

    it('fails in non-mock mode without browser', async () => {
      const realSubmitter = new LinkedInFormSubmitter({
        mockMode: false,
        mockDelay: 0,
      });
      const result = await realSubmitter.submit({
        job: mockJob,
        userProfile: mockProfile,
      });
      expect(result.success).toBe(false);
    });

    it('generates unique submission IDs', async () => {
      const r1 = await submitter.submit({ job: mockJob, userProfile: mockProfile });
      const r2 = await submitter.submit({ job: mockJob, userProfile: mockProfile });
      expect(r1.submissionId).not.toBe(r2.submissionId);
    });
  });

  describe('submitWithRetry', () => {
    it('succeeds on first attempt', async () => {
      const result = await submitter.submitWithRetry({
        job: mockJob,
        userProfile: mockProfile,
        maxRetries: 3,
      });
      expect(result.success).toBe(true);
    });

    it('returns failure result for non-retryable errors', async () => {
      const failSubmitter = new LinkedInFormSubmitter({
        mockMode: true,
        mockDelay: 0,
        mockFailRate: 0,
      });
      // Simulate always-fail form (no profile data)
      const result = await failSubmitter.submitWithRetry({
        job: mockJob,
        userProfile: {},
        maxRetries: 2,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('_classifyError', () => {
    it('classifies session errors', () => {
      const type = submitter._classifyError(new Error('session expired'));
      expect(type).toBe(LINKEDIN_ERRORS.SESSION_EXPIRED);
    });

    it('classifies auth errors', () => {
      const type = submitter._classifyError(new Error('authentication required'));
      expect(type).toBe(LINKEDIN_ERRORS.SESSION_EXPIRED);
    });

    it('classifies validation errors', () => {
      const type = submitter._classifyError(new Error('validation failed'));
      expect(type).toBe(LINKEDIN_ERRORS.FORM_VALIDATION);
    });

    it('classifies already applied', () => {
      const type = submitter._classifyError(new Error('already applied'));
      expect(type).toBe(LINKEDIN_ERRORS.ALREADY_APPLIED);
    });

    it('classifies job closed', () => {
      const type = submitter._classifyError(new Error('job closed'));
      expect(type).toBe(LINKEDIN_ERRORS.JOB_CLOSED);
    });

    it('classifies rate limited', () => {
      const type = submitter._classifyError(new Error('rate limited'));
      expect(type).toBe(LINKEDIN_ERRORS.RATE_LIMITED);
    });

    it('classifies network errors', () => {
      const type = submitter._classifyError(new Error('network timeout'));
      expect(type).toBe(LINKEDIN_ERRORS.NETWORK_ERROR);
    });

    it('classifies unknown errors', () => {
      const type = submitter._classifyError(new Error('something weird'));
      expect(type).toBe(LINKEDIN_ERRORS.UNKNOWN);
    });

    it('handles errors without message', () => {
      const type = submitter._classifyError(new Error());
      expect(type).toBe(LINKEDIN_ERRORS.UNKNOWN);
    });
  });

  describe('_isNonRetryableError', () => {
    it('marks already applied as non-retryable', () => {
      expect(submitter._isNonRetryableError(LINKEDIN_ERRORS.ALREADY_APPLIED)).toBe(true);
    });

    it('marks job closed as non-retryable', () => {
      expect(submitter._isNonRetryableError(LINKEDIN_ERRORS.JOB_CLOSED)).toBe(true);
    });

    it('marks form validation as non-retryable', () => {
      expect(submitter._isNonRetryableError(LINKEDIN_ERRORS.FORM_VALIDATION)).toBe(true);
    });

    it('allows retry for session expired', () => {
      expect(submitter._isNonRetryableError(LINKEDIN_ERRORS.SESSION_EXPIRED)).toBe(false);
    });

    it('allows retry for rate limited', () => {
      expect(submitter._isNonRetryableError(LINKEDIN_ERRORS.RATE_LIMITED)).toBe(false);
    });

    it('allows retry for network error', () => {
      expect(submitter._isNonRetryableError(LINKEDIN_ERRORS.NETWORK_ERROR)).toBe(false);
    });
  });

  describe('_fillForm', () => {
    it('fills form with complete profile', () => {
      const result = submitter._fillForm(mockProfile, mockJob);
      expect(result.success).toBe(true);
      expect(result.payload.first_name).toBe('John');
      expect(result.payload.email).toBe('john@example.com');
    });

    it('fails with incomplete profile', () => {
      const result = submitter._fillForm({}, mockJob);
      expect(result.success).toBe(false);
    });

    it('includes cover letter in profile', () => {
      const result = submitter._fillForm(mockProfile, mockJob, 'My cover letter');
      expect(result.success).toBe(true);
    });
  });

  describe('constants', () => {
    it('exports SUBMISSION_STATES', () => {
      expect(SUBMISSION_STATES.PENDING).toBe('pending');
      expect(SUBMISSION_STATES.SUBMITTED).toBe('submitted');
      expect(SUBMISSION_STATES.FAILED).toBe('failed');
    });

    it('exports LINKEDIN_ERRORS', () => {
      expect(LINKEDIN_ERRORS.SESSION_EXPIRED).toBeDefined();
      expect(LINKEDIN_ERRORS.ALREADY_APPLIED).toBeDefined();
      expect(LINKEDIN_ERRORS.NETWORK_ERROR).toBeDefined();
    });
  });
});
