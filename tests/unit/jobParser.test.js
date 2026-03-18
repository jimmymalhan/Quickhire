/**
 * Unit Tests: Job Parser
 */
const { JobParser } = require('../../src/automation/jobParser');
const { ScraperError } = require('../../src/utils/errorCodes');

describe('JobParser', () => {
  let parser;

  beforeEach(() => {
    parser = new JobParser();
  });

  // --- parseJobListing ---
  describe('parseJobListing', () => {
    it('should parse a basic job listing HTML', () => {
      const html = `
        <html>
          <h1 class="top-card-layout__title">Senior Software Engineer</h1>
          <a class="topcard__org-name-link">Google</a>
          <span class="topcard__flavor--bullet">Mountain View, CA</span>
          <div class="description__text">Build amazing things</div>
        </html>
      `;
      const job = parser.parseJobListing(html, 'https://linkedin.com/jobs/view/123');
      expect(job.title).toBe('Senior Software Engineer');
      expect(job.company).toBe('Google');
      expect(job.location).toBe('Mountain View, CA');
      expect(job.description).toBe('Build amazing things');
      expect(job.hash).toBeDefined();
      expect(job.hash.length).toBe(16);
    });

    it('should extract job ID from URL', () => {
      const html = `
        <html>
          <h1>Developer</h1>
          <a class="topcard__org-name-link">Meta</a>
        </html>
      `;
      const job = parser.parseJobListing(html, 'https://linkedin.com/jobs/view/456789');
      expect(job.linkedinJobId).toBe('456789');
    });

    it('should extract job ID from data attribute', () => {
      const html = `
        <html>
          <div data-job-id="789012">
            <h1>PM</h1>
            <a class="topcard__org-name-link">Apple</a>
          </div>
        </html>
      `;
      const job = parser.parseJobListing(html);
      expect(job.linkedinJobId).toBe('789012');
    });

    it('should throw PARSE_MISSING_FIELD for missing title', () => {
      const html = '<html><a class="topcard__org-name-link">Company</a></html>';
      expect(() => parser.parseJobListing(html)).toThrow(ScraperError);
    });

    it('should throw PARSE_MISSING_FIELD for missing company', () => {
      const html = '<html><h1>Title</h1></html>';
      expect(() => parser.parseJobListing(html)).toThrow(ScraperError);
    });

    it('should handle alternate selectors', () => {
      const html = `
        <html>
          <h1 class="job-details-jobs-unified-top-card__job-title">Engineer</h1>
          <span class="job-details-jobs-unified-top-card__company-name">Amazon</span>
          <span class="job-details-jobs-unified-top-card__bullet">Seattle, WA</span>
        </html>
      `;
      const job = parser.parseJobListing(html);
      expect(job.title).toBe('Engineer');
      expect(job.company).toBe('Amazon');
      expect(job.location).toBe('Seattle, WA');
    });

    it('should parse relative date from text', () => {
      const html = `
        <html>
          <h1>Dev</h1>
          <a class="topcard__org-name-link">Corp</a>
          <span class="posted-time">3 days ago</span>
        </html>
      `;
      const job = parser.parseJobListing(html);
      expect(job.postedAt).toBeInstanceOf(Date);
    });

    it('should parse datetime attribute from time element', () => {
      const html = `
        <html>
          <h1>Dev</h1>
          <a class="topcard__org-name-link">Corp</a>
          <time datetime="2026-03-01T10:00:00Z">1 week ago</time>
        </html>
      `;
      const job = parser.parseJobListing(html);
      expect(job.postedAt.toISOString()).toContain('2026-03-01');
    });
  });

  // --- parseSearchResults ---
  describe('parseSearchResults', () => {
    it('should parse multiple job cards', () => {
      const html = `
        <html>
          <ul class="jobs-search__results-list">
            <li>
              <div class="base-search-card__title"><h3>Engineer</h3></div>
              <div class="base-search-card__subtitle"><h4>Google</h4></div>
              <div class="job-search-card__location">NYC</div>
              <a href="/jobs/view/111">Link</a>
            </li>
            <li>
              <div class="base-search-card__title"><h3>Designer</h3></div>
              <div class="base-search-card__subtitle"><h4>Apple</h4></div>
              <div class="job-search-card__location">SF</div>
              <a href="/jobs/view/222">Link</a>
            </li>
          </ul>
        </html>
      `;
      const jobs = parser.parseSearchResults(html);
      expect(jobs.length).toBe(2);
      expect(jobs[0].title).toBe('Engineer');
      expect(jobs[1].title).toBe('Designer');
    });

    it('should parse data-job-id cards', () => {
      const html = `
        <html>
          <div data-job-id="100">
            <h3>Role A</h3>
            <h4>Company A</h4>
            <a href="/jobs/100">link</a>
          </div>
          <div data-job-id="200">
            <h3>Role B</h3>
            <h4>Company B</h4>
            <a href="/jobs/200">link</a>
          </div>
        </html>
      `;
      const jobs = parser.parseSearchResults(html);
      expect(jobs.length).toBe(2);
      expect(jobs[0].linkedinJobId).toBe('100');
    });

    it('should return empty array for no results', () => {
      const html = '<html><div>No jobs found</div></html>';
      const jobs = parser.parseSearchResults(html);
      expect(jobs).toEqual([]);
    });

    it('should skip cards without title', () => {
      const html = `
        <html>
          <ul class="jobs-search__results-list">
            <li><div class="base-search-card__subtitle"><h4>Company</h4></div></li>
          </ul>
        </html>
      `;
      const jobs = parser.parseSearchResults(html);
      expect(jobs.length).toBe(0);
    });

    it('should generate hashes for parsed jobs', () => {
      const html = `
        <html>
          <div class="base-card">
            <h3>SWE</h3>
            <h4>Google</h4>
            <a href="/j/1">l</a>
          </div>
        </html>
      `;
      const jobs = parser.parseSearchResults(html);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].hash).toBeDefined();
    });
  });

  // --- parseApiResponse ---
  describe('parseApiResponse', () => {
    it('should parse API response with elements array', () => {
      const data = {
        elements: [
          {
            jobId: '12345',
            title: 'Backend Dev',
            companyName: 'Stripe',
            formattedLocation: 'Remote',
            description: { text: 'Build payment systems' },
          },
        ],
      };
      const jobs = parser.parseApiResponse(data);
      expect(jobs.length).toBe(1);
      expect(jobs[0].title).toBe('Backend Dev');
      expect(jobs[0].company).toBe('Stripe');
      expect(jobs[0].linkedinJobId).toBe('12345');
    });

    it('should parse API response with results array', () => {
      const data = {
        results: [
          { id: '111', title: 'PM', companyName: 'Meta', formattedLocation: 'NYC' },
        ],
      };
      const jobs = parser.parseApiResponse(data);
      expect(jobs.length).toBe(1);
      expect(jobs[0].linkedinJobId).toBe('111');
    });

    it('should handle direct array input', () => {
      const data = [
        { id: '1', title: 'Dev', companyName: 'Co', formattedLocation: 'LA' },
        { id: '2', title: 'QA', companyName: 'Corp', formattedLocation: 'SF' },
      ];
      const jobs = parser.parseApiResponse(data);
      expect(jobs.length).toBe(2);
    });

    it('should filter out entries without title or company', () => {
      const data = {
        elements: [
          { id: '1', title: 'Dev', companyName: 'Co' },
          { id: '2', title: '', companyName: 'Corp' },
          { id: '3', title: 'QA' },
        ],
      };
      const jobs = parser.parseApiResponse(data);
      expect(jobs.length).toBe(1);
    });

    it('should throw on null input', () => {
      expect(() => parser.parseApiResponse(null)).toThrow(ScraperError);
    });

    it('should parse salary data', () => {
      const data = {
        elements: [{
          id: '1',
          title: 'Dev',
          companyName: 'Co',
          formattedLocation: 'SF',
          salaryInsights: { min: 100000, max: 150000 },
        }],
      };
      const jobs = parser.parseApiResponse(data);
      expect(jobs[0].salaryMin).toBe(100000);
      expect(jobs[0].salaryMax).toBe(150000);
    });

    it('should parse nested company object', () => {
      const data = {
        elements: [{
          id: '1',
          title: 'Dev',
          company: { name: 'Nested Co' },
          formattedLocation: 'LA',
        }],
      };
      const jobs = parser.parseApiResponse(data);
      expect(jobs[0].company).toBe('Nested Co');
    });
  });

  // --- computeHash ---
  describe('computeHash', () => {
    it('should produce consistent hashes', () => {
      const job = { title: 'Engineer', company: 'Google', location: 'NYC' };
      const hash1 = parser.computeHash(job);
      const hash2 = parser.computeHash(job);
      expect(hash1).toBe(hash2);
    });

    it('should be case insensitive', () => {
      const job1 = { title: 'ENGINEER', company: 'GOOGLE', location: 'NYC' };
      const job2 = { title: 'engineer', company: 'google', location: 'nyc' };
      expect(parser.computeHash(job1)).toBe(parser.computeHash(job2));
    });

    it('should ignore leading/trailing whitespace', () => {
      const job1 = { title: '  Engineer  ', company: ' Google ', location: ' NYC ' };
      const job2 = { title: 'Engineer', company: 'Google', location: 'NYC' };
      expect(parser.computeHash(job1)).toBe(parser.computeHash(job2));
    });

    it('should produce different hashes for different jobs', () => {
      const job1 = { title: 'Engineer', company: 'Google', location: 'NYC' };
      const job2 = { title: 'Designer', company: 'Apple', location: 'SF' };
      expect(parser.computeHash(job1)).not.toBe(parser.computeHash(job2));
    });

    it('should handle missing fields', () => {
      const job = { title: 'Engineer' };
      expect(() => parser.computeHash(job)).not.toThrow();
    });

    it('should produce 16 character hashes', () => {
      const job = { title: 'Test', company: 'Co', location: 'LA' };
      expect(parser.computeHash(job).length).toBe(16);
    });
  });

  // --- normalizeJob ---
  describe('normalizeJob', () => {
    it('should trim string fields', () => {
      const job = {
        title: '  Engineer  ',
        company: ' Google ',
        location: ' NYC ',
        description: ' Build stuff ',
      };
      const normalized = parser.normalizeJob(job);
      expect(normalized.title).toBe('Engineer');
      expect(normalized.company).toBe('Google');
      expect(normalized.location).toBe('NYC');
    });

    it('should set null for non-numeric salary', () => {
      const job = { title: 'Dev', company: 'Co', salaryMin: 'unknown' };
      const normalized = parser.normalizeJob(job);
      expect(normalized.salaryMin).toBeNull();
    });

    it('should preserve numeric salary', () => {
      const job = { title: 'Dev', company: 'Co', salaryMin: 100000, salaryMax: 150000 };
      const normalized = parser.normalizeJob(job);
      expect(normalized.salaryMin).toBe(100000);
      expect(normalized.salaryMax).toBe(150000);
    });

    it('should convert string dates to Date objects', () => {
      const job = { title: 'Dev', company: 'Co', postedAt: '2026-01-01' };
      const normalized = parser.normalizeJob(job);
      expect(normalized.postedAt).toBeInstanceOf(Date);
    });

    it('should compute hash if missing', () => {
      const job = { title: 'Dev', company: 'Co', location: 'LA' };
      const normalized = parser.normalizeJob(job);
      expect(normalized.hash).toBeDefined();
      expect(normalized.hash.length).toBe(16);
    });

    it('should preserve existing hash', () => {
      const job = { title: 'Dev', company: 'Co', hash: 'existinghash12345' };
      const normalized = parser.normalizeJob(job);
      expect(normalized.hash).toBe('existinghash12345');
    });

    it('should convert linkedinJobId to string', () => {
      const job = { title: 'Dev', company: 'Co', linkedinJobId: 12345 };
      const normalized = parser.normalizeJob(job);
      expect(typeof normalized.linkedinJobId).toBe('string');
    });

    it('should handle completely empty job', () => {
      const normalized = parser.normalizeJob({});
      expect(normalized.title).toBe('');
      expect(normalized.company).toBe('');
      expect(normalized.hash).toBeDefined();
    });
  });

  // --- _parseExperience (via API parsing) ---
  describe('experience level parsing', () => {
    it('should parse entry level', () => {
      const data = {
        elements: [{ id: '1', title: 'Dev', companyName: 'Co', formattedLocation: 'LA', experienceLevel: 'Entry Level' }],
      };
      const jobs = parser.parseApiResponse(data);
      expect(jobs[0].experienceYears).toBe(0);
    });

    it('should parse senior level', () => {
      const data = {
        elements: [{ id: '1', title: 'Dev', companyName: 'Co', formattedLocation: 'LA', experienceLevel: 'Senior' }],
      };
      const jobs = parser.parseApiResponse(data);
      expect(jobs[0].experienceYears).toBe(7);
    });

    it('should return null for unknown level', () => {
      const data = {
        elements: [{ id: '1', title: 'Dev', companyName: 'Co', formattedLocation: 'LA', experienceLevel: 'Unknown' }],
      };
      const jobs = parser.parseApiResponse(data);
      expect(jobs[0].experienceYears).toBeNull();
    });
  });
});
