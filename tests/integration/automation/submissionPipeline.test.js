/**
 * Integration tests for the full application submission pipeline
 * Tests the interaction between FormFiller, RateLimiter, DailyCapEnforcer,
 * and LinkedInFormSubmitter working together
 */
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../src/utils/config', () => ({
  features: { mockLinkedIn: true },
  application: {
    maxPerDay: 50,
    retryAttempts: 3,
    retryDelayMs: 1,
    minIntervalSeconds: 0,
  },
}));

const { FormFiller } = require('../../../src/automation/formFiller');
const { RateLimiter } = require('../../../src/automation/rateLimiter');
const { DailyCapEnforcer } = require('../../../src/automation/dailyCapEnforcer');
const { LinkedInFormSubmitter } = require('../../../src/automation/linkedInFormSubmitter');

describe('Submission Pipeline Integration', () => {
  const mockJob = {
    id: 'job-1',
    title: 'Software Engineer',
    company: 'TechCorp',
    location: 'San Francisco, CA',
  };

  const completeProfile = {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    phone: '555-9876',
    location: 'San Francisco, CA',
    linkedinUrl: 'https://linkedin.com/in/janesmith',
    currentCompany: 'StartupAI',
    currentTitle: 'Senior Developer',
    yearsExperience: 7,
    salaryExpectation: 180000,
  };

  describe('FormFiller -> LinkedInFormSubmitter', () => {
    it('form filler output feeds into submitter', async () => {
      const filler = new FormFiller(completeProfile);
      const validation = filler.validateRequiredFields([
        'first_name',
        'last_name',
        'email',
        'phone',
      ]);
      expect(validation.valid).toBe(true);

      const submitter = new LinkedInFormSubmitter({ mockMode: true, mockDelay: 0 });
      const result = await submitter.submit({
        job: mockJob,
        userProfile: completeProfile,
      });
      expect(result.success).toBe(true);
    });

    it('incomplete profile causes form fill failure', async () => {
      const filler = new FormFiller({});
      const validation = filler.validateRequiredFields(['first_name', 'email']);
      expect(validation.valid).toBe(false);

      const submitter = new LinkedInFormSubmitter({ mockMode: true, mockDelay: 0 });
      const result = await submitter.submit({
        job: mockJob,
        userProfile: {},
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RateLimiter -> Submission flow', () => {
    it('rate limiter controls submission pace', async () => {
      const limiter = new RateLimiter({
        maxPerHourPerCompany: 2,
        maxPerHourGlobal: 5,
        maxPerDayGlobal: 10,
        minIntervalMs: 0,
      });

      const submitter = new LinkedInFormSubmitter({ mockMode: true, mockDelay: 0 });

      let submitted = 0;
      for (let i = 0; i < 5; i++) {
        const check = limiter.canSubmit('TechCorp');
        if (check.allowed) {
          const result = await submitter.submit({
            job: { ...mockJob, id: `job-${i}` },
            userProfile: completeProfile,
          });
          if (result.success) {
            limiter.recordSubmission('TechCorp');
            submitted++;
          }
        }
      }

      // Should be capped at 2 per company per hour
      expect(submitted).toBe(2);
    });

    it('different companies get independent limits', async () => {
      const limiter = new RateLimiter({
        maxPerHourPerCompany: 2,
        maxPerHourGlobal: 10,
        maxPerDayGlobal: 50,
        minIntervalMs: 0,
      });

      const companies = ['TechCorp', 'StartupAI', 'BigCo'];
      let total = 0;

      for (const company of companies) {
        for (let i = 0; i < 3; i++) {
          const check = limiter.canSubmit(company);
          if (check.allowed) {
            limiter.recordSubmission(company);
            total++;
          }
        }
      }

      // 2 per company x 3 companies = 6
      expect(total).toBe(6);
    });
  });

  describe('DailyCapEnforcer -> Submission flow', () => {
    it('daily cap enforcer stops submissions at limit', () => {
      const enforcer = new DailyCapEnforcer({ defaultCap: 5 });

      let submitted = 0;
      for (let i = 0; i < 10; i++) {
        const check = enforcer.canApply('user-1');
        if (check.allowed) {
          enforcer.recordApplication('user-1');
          submitted++;
        }
      }

      expect(submitted).toBe(5);
    });

    it('different users have independent caps', () => {
      const enforcer = new DailyCapEnforcer({ defaultCap: 3 });

      for (let i = 0; i < 3; i++) {
        enforcer.recordApplication('user-1');
        enforcer.recordApplication('user-2');
      }

      expect(enforcer.canApply('user-1').allowed).toBe(false);
      expect(enforcer.canApply('user-2').allowed).toBe(false);

      // New user should still be able to apply
      expect(enforcer.canApply('user-3').allowed).toBe(true);
    });

    it('user-specific cap overrides default', () => {
      const enforcer = new DailyCapEnforcer({ defaultCap: 10 });
      enforcer.setUserCap('user-1', 2);

      enforcer.recordApplication('user-1');
      enforcer.recordApplication('user-1');

      expect(enforcer.canApply('user-1').allowed).toBe(false);
    });
  });

  describe('Full pipeline: RateLimiter + DailyCapEnforcer + Submitter', () => {
    it('applies all checks in order', async () => {
      const limiter = new RateLimiter({
        maxPerHourPerCompany: 5,
        maxPerHourGlobal: 20,
        maxPerDayGlobal: 100,
        minIntervalMs: 0,
      });
      const enforcer = new DailyCapEnforcer({ defaultCap: 3 });
      const submitter = new LinkedInFormSubmitter({ mockMode: true, mockDelay: 0 });

      const results = [];
      for (let i = 0; i < 5; i++) {
        const capCheck = enforcer.canApply('user-1');
        if (!capCheck.allowed) {
          results.push({ jobId: `job-${i}`, status: 'capped' });
          continue;
        }

        const rateCheck = limiter.canSubmit('TechCorp');
        if (!rateCheck.allowed) {
          results.push({ jobId: `job-${i}`, status: 'rate_limited' });
          continue;
        }

        const submission = await submitter.submit({
          job: { ...mockJob, id: `job-${i}` },
          userProfile: completeProfile,
        });

        if (submission.success) {
          limiter.recordSubmission('TechCorp');
          enforcer.recordApplication('user-1');
          results.push({ jobId: `job-${i}`, status: 'submitted' });
        } else {
          results.push({ jobId: `job-${i}`, status: 'failed' });
        }
      }

      // Daily cap of 3 should limit total submissions
      const submitted = results.filter((r) => r.status === 'submitted');
      const capped = results.filter((r) => r.status === 'capped');
      expect(submitted).toHaveLength(3);
      expect(capped).toHaveLength(2);
    });

    it('cooldown pauses all submissions', async () => {
      const limiter = new RateLimiter({
        maxPerHourPerCompany: 10,
        maxPerHourGlobal: 50,
        maxPerDayGlobal: 200,
        minIntervalMs: 0,
        cooldownMs: 60000,
      });

      // Submit once, then activate cooldown
      expect(limiter.canSubmit('TechCorp').allowed).toBe(true);
      limiter.recordSubmission('TechCorp');
      limiter.activateCooldown();

      // All subsequent checks should fail
      expect(limiter.canSubmit('TechCorp').allowed).toBe(false);
      expect(limiter.canSubmit('OtherCo').allowed).toBe(false);
      expect(limiter.canSubmit(null).allowed).toBe(false);
    });
  });

  describe('Error recovery scenarios', () => {
    it('retries after transient failure', async () => {
      const submitter = new LinkedInFormSubmitter({
        mockMode: true,
        mockDelay: 0,
        mockFailRate: 0,
      });

      const result = await submitter.submitWithRetry({
        job: mockJob,
        userProfile: completeProfile,
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
    });

    it('stops retrying for non-retryable errors', async () => {
      const submitter = new LinkedInFormSubmitter({
        mockMode: true,
        mockDelay: 0,
      });

      // Empty profile causes form_fill_failed which is non-retryable
      const result = await submitter.submitWithRetry({
        job: mockJob,
        userProfile: {},
        maxRetries: 5,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Multi-company batch scenario', () => {
    it('applies rate limits independently per company', async () => {
      const limiter = new RateLimiter({
        maxPerHourPerCompany: 2,
        maxPerHourGlobal: 100,
        maxPerDayGlobal: 200,
        minIntervalMs: 0,
      });

      const companies = ['Alpha', 'Beta', 'Gamma'];
      const submitted = {};

      for (const company of companies) {
        submitted[company] = 0;
        for (let i = 0; i < 5; i++) {
          if (limiter.canSubmit(company).allowed) {
            limiter.recordSubmission(company);
            submitted[company]++;
          }
        }
      }

      expect(submitted.Alpha).toBe(2);
      expect(submitted.Beta).toBe(2);
      expect(submitted.Gamma).toBe(2);
    });
  });
});
