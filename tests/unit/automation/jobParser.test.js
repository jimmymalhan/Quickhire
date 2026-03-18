/**
 * Unit tests for jobParser module
 */
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { parseSearchResults, parseJobListing, normalizeJob } = require('../../../src/automation/jobParser');

describe('jobParser', () => {
  describe('parseSearchResults', () => {
    it('should return empty array for null input', () => {
      expect(parseSearchResults(null)).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(parseSearchResults('')).toEqual([]);
    });

    it('should return empty array for non-string input', () => {
      expect(parseSearchResults(123)).toEqual([]);
    });

    it('should parse job cards from search results HTML', () => {
      const html = `
        <li class="job-search-card">
          <h3 class="base-search-card__title">Software Engineer</h3>
          <h4 class="base-search-card__subtitle">TechCo</h4>
          <span class="job-search-card__location">San Francisco, CA</span>
          <a href="https://www.linkedin.com/jobs/view/12345">Link</a>
          <time datetime="2024-01-15">2 days ago</time>
        </li>
      `;
      const jobs = parseSearchResults(html);
      expect(jobs.length).toBeGreaterThanOrEqual(1);
      expect(jobs[0].title).toBe('Software Engineer');
      expect(jobs[0].company).toBe('TechCo');
    });

    it('should extract job IDs from URLs', () => {
      const html = `
        <li class="job-search-card">
          <h3 class="base-search-card__title">Dev</h3>
          <h4 class="base-search-card__subtitle">Corp</h4>
          <a href="https://www.linkedin.com/jobs/view/98765">Link</a>
        </li>
      `;
      const jobs = parseSearchResults(html);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].jobId).toBe('98765');
    });

    it('should parse JSON-LD structured data as fallback', () => {
      const html = `
        <html>
        <script type="application/ld+json">
        {
          "@type": "JobPosting",
          "title": "Backend Developer",
          "hiringOrganization": { "name": "StartupX" },
          "jobLocation": { "address": { "addressLocality": "Remote" } },
          "description": "Great opportunity"
        }
        </script>
        </html>
      `;
      const jobs = parseSearchResults(html);
      expect(jobs.length).toBe(1);
      expect(jobs[0].title).toBe('Backend Developer');
      expect(jobs[0].company).toBe('StartupX');
    });

    it('should handle malformed HTML gracefully', () => {
      const html = '<div>broken<span>html</div>';
      const jobs = parseSearchResults(html);
      expect(Array.isArray(jobs)).toBe(true);
    });

    it('should extract posted date from time element', () => {
      const html = `
        <li class="job-search-card">
          <h3 class="base-search-card__title">Engineer</h3>
          <h4 class="base-search-card__subtitle">Co</h4>
          <time datetime="2024-03-01">3 days ago</time>
        </li>
      `;
      const jobs = parseSearchResults(html);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].postedAt).toBe('2024-03-01');
    });

    it('should handle HTML with no job cards', () => {
      const html = '<html><body><p>No jobs here</p></body></html>';
      const jobs = parseSearchResults(html);
      expect(jobs).toEqual([]);
    });
  });

  describe('parseJobListing', () => {
    it('should return default object for null HTML', () => {
      const result = parseJobListing(null, 'http://test.com');
      expect(result.url).toBe('http://test.com');
    });

    it('should return default object for empty HTML', () => {
      const result = parseJobListing('', 'http://test.com');
      expect(result.title).toBe('');
    });

    it('should parse job from JSON-LD if available', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "JobPosting",
          "title": "Full Stack Developer",
          "hiringOrganization": { "name": "MegaCorp" },
          "description": "Build amazing products"
        }
        </script>
      `;
      const result = parseJobListing(html, 'https://linkedin.com/jobs/view/999');
      expect(result.title).toBe('Full Stack Developer');
      expect(result.company).toBe('MegaCorp');
      expect(result.url).toBe('https://linkedin.com/jobs/view/999');
    });

    it('should parse job from HTML elements', () => {
      const html = `
        <html>
          <h1 class="top-card-layout__title">DevOps Engineer</h1>
          <a class="topcard__org-name-link">CloudInc</a>
          <span class="topcard__flavor--bullet">Seattle, WA</span>
        </html>
      `;
      const result = parseJobListing(html);
      expect(result.title).toBe('DevOps Engineer');
      expect(result.company).toBe('CloudInc');
      expect(result.location).toBe('Seattle, WA');
    });

    it('should extract job ID from URL', () => {
      const html = '<html><h1>Test</h1></html>';
      const result = parseJobListing(html, 'https://linkedin.com/jobs/view/54321');
      expect(result.jobId).toBe('54321');
    });

    it('should handle non-string input', () => {
      const result = parseJobListing(123);
      expect(result.title).toBe('');
    });
  });

  describe('normalizeJob', () => {
    it('should normalize a complete job object', () => {
      const raw = {
        jobId: '12345',
        title: '  Senior Engineer  ',
        company: '  TechCo  ',
        location: '  NYC  ',
        description: 'Need 5 years of experience in JavaScript',
        salary: '$120,000 - $180,000',
        url: 'https://linkedin.com/jobs/view/12345',
        postedAt: '2024-01-15',
      };

      const result = normalizeJob(raw);

      expect(result.linkedinJobId).toBe('12345');
      expect(result.title).toBe('Senior Engineer');
      expect(result.company).toBe('TechCo');
      expect(result.location).toBe('NYC');
      expect(result.salaryMin).toBe(120000);
      expect(result.salaryMax).toBe(180000);
      expect(result.jobLevel).toBe('senior');
      expect(result.hash).toBeTruthy();
      expect(result.scrapeDate).toBeInstanceOf(Date);
    });

    it('should handle empty/missing fields', () => {
      const result = normalizeJob({});

      expect(result.title).toBe('');
      expect(result.company).toBe('');
      expect(result.location).toBe('');
      expect(result.salaryMin).toBeNull();
      expect(result.salaryMax).toBeNull();
      expect(result.linkedinJobId).toBeNull();
    });

    it('should detect job levels correctly', () => {
      expect(normalizeJob({ title: 'Senior Dev' }).jobLevel).toBe('senior');
      expect(normalizeJob({ title: 'Junior Dev' }).jobLevel).toBe('entry');
      expect(normalizeJob({ title: 'Staff Engineer' }).jobLevel).toBe('staff');
      expect(normalizeJob({ title: 'Software Engineer' }).jobLevel).toBe('mid');
    });

    it('should parse salary correctly', () => {
      const result = normalizeJob({ title: 'Dev', salary: '$80K - $120K' });
      expect(result.salaryMin).toBe(80000);
      expect(result.salaryMax).toBe(120000);
    });

    it('should parse experience years from description', () => {
      const result = normalizeJob({
        title: 'Dev',
        description: 'Requires 5 years of experience in Python',
      });
      expect(result.experienceYears).toBe(5);
    });

    it('should return null experienceYears when not found', () => {
      const result = normalizeJob({ title: 'Dev', description: 'Great role' });
      expect(result.experienceYears).toBeNull();
    });

    it('should generate hash from title, company, location', () => {
      const result1 = normalizeJob({ title: 'Dev', company: 'Co', location: 'NYC' });
      const result2 = normalizeJob({ title: 'Dev', company: 'Co', location: 'NYC' });
      expect(result1.hash).toBe(result2.hash);
    });

    it('should generate different hash for different jobs', () => {
      const result1 = normalizeJob({ title: 'Dev', company: 'CoA', location: 'NYC' });
      const result2 = normalizeJob({ title: 'Dev', company: 'CoB', location: 'NYC' });
      expect(result1.hash).not.toBe(result2.hash);
    });

    it('should set postedAt from raw data', () => {
      const result = normalizeJob({ title: 'Dev', postedAt: '2024-06-15' });
      expect(result.postedAt).toBeInstanceOf(Date);
    });

    it('should default postedAt to now when missing', () => {
      const before = Date.now();
      const result = normalizeJob({ title: 'Dev' });
      expect(result.postedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    });

    it('should use salaryText as fallback for salary', () => {
      const result = normalizeJob({ title: 'Dev', salaryText: '$100,000 - $150,000' });
      expect(result.salaryMin).toBe(100000);
      expect(result.salaryMax).toBe(150000);
    });

    it('should set url from raw data', () => {
      const result = normalizeJob({ title: 'Dev', url: 'https://test.com/job' });
      expect(result.url).toBe('https://test.com/job');
    });

    it('should set url to null when missing', () => {
      const result = normalizeJob({ title: 'Dev' });
      expect(result.url).toBeNull();
    });

    it('should use linkedinJobId from raw data', () => {
      const result = normalizeJob({ title: 'Dev', linkedinJobId: 'abc' });
      expect(result.linkedinJobId).toBe('abc');
    });

    it('should prefer jobId over linkedinJobId', () => {
      const result = normalizeJob({ title: 'Dev', jobId: 'j1', linkedinJobId: 'li1' });
      expect(result.linkedinJobId).toBe('j1');
    });
  });
});
