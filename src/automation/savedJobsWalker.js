/**
 * Saved Jobs Walker
 * Navigates LinkedIn's saved jobs page, paginates via infinite scroll,
 * extracts job metadata, and upserts records via the SavedJob model.
 *
 * Use LINKEDIN_MOCK=true (or options.mockMode=true) for dev/test — returns
 * 3 fixture jobs without touching the network.
 */
const logger = require('../utils/logger');

const SAVED_JOBS_URL = 'https://www.linkedin.com/my-items/saved-jobs/';

const MOCK_SAVED_JOBS = [
  {
    linkedinJobId: 'mock_job_001',
    title: 'Senior Software Engineer',
    company: 'Acme Corp',
    location: 'San Francisco, CA',
    applyUrl: 'https://www.linkedin.com/jobs/view/mock_job_001',
    easyApply: true,
  },
  {
    linkedinJobId: 'mock_job_002',
    title: 'Product Manager',
    company: 'StartupXYZ',
    location: 'Remote',
    applyUrl: 'https://www.linkedin.com/jobs/view/mock_job_002',
    easyApply: true,
  },
  {
    linkedinJobId: 'mock_job_003',
    title: 'Data Scientist',
    company: 'BigData Inc',
    location: 'New York, NY',
    applyUrl: 'https://www.linkedin.com/jobs/view/mock_job_003',
    easyApply: false,
  },
];

/**
 * Parse a single job card DOM element into a structured job object.
 * All selectors are marked TODO for verification against live LinkedIn DOM.
 *
 * @param {Object} cardData - Plain object extracted via page.evaluate()
 * @returns {Object} parsed job fields
 */
function parseJobCard(cardData) {
  if (!cardData || typeof cardData !== 'object') {
    return null;
  }

  const {
    linkedinJobId = null,
    title = '',
    company = '',
    location = '',
    applyUrl = '',
    easyApply = false,
  } = cardData;

  if (!linkedinJobId && !title) {
    return null;
  }

  return {
    linkedinJobId: linkedinJobId ? String(linkedinJobId) : null,
    title: title.trim(),
    company: company.trim(),
    location: location.trim(),
    applyUrl: applyUrl.trim(),
    easyApply: Boolean(easyApply),
  };
}

/**
 * Walk all pages of the LinkedIn saved jobs list by scrolling to trigger
 * infinite load, up to maxPages scroll iterations.
 *
 * @param {Object} page - Playwright/Puppeteer page
 * @param {BrowserManager} browserManager
 * @param {number} maxPages - Maximum scroll-load cycles (default 10)
 * @returns {Array<Object>} raw job card data objects
 */
async function walkAllPages(page, browserManager, maxPages = 10) {
  const allJobs = [];
  const seenIds = new Set();

  for (let cycle = 0; cycle < maxPages; cycle++) {
    // Extract all currently-visible job cards via page.evaluate
    // TODO: verify selectors — LinkedIn frequently changes its class names
    const cards = await page.evaluate(() => {
      const results = [];

      // TODO: verify selector — job cards may be .job-card-container or [data-job-id]
      const cardEls = Array.from(
        document.querySelectorAll('.job-card-container, [data-job-id]'),
      );

      for (const el of cardEls) {
        // TODO: verify selector — job ID may be in data-job-id or data-entity-urn
        const jobId =
          el.getAttribute('data-job-id') ||
          el.getAttribute('data-entity-urn') ||
          null;

        // TODO: verify selector — title may be .job-card-list__title or .artdeco-entity-lockup__title
        const titleEl = el.querySelector(
          '.job-card-list__title, .artdeco-entity-lockup__title',
        );

        // TODO: verify selector — company may be .job-card-container__company-name
        const companyEl = el.querySelector('.job-card-container__company-name');

        // TODO: verify selector — location may be .job-card-container__metadata-item
        const locationEl = el.querySelector('.job-card-container__metadata-item');

        // TODO: verify selector — apply URL may live on an anchor tag within the card
        const linkEl = el.querySelector('a[href*="/jobs/view/"]');

        // TODO: verify selector — Easy Apply badge may be .job-card-container__apply-method
        const applyMethodEl = el.querySelector('.job-card-container__apply-method');
        const isEasyApply = applyMethodEl
          ? applyMethodEl.textContent.toLowerCase().includes('easy apply')
          : false;

        results.push({
          linkedinJobId: jobId,
          title: titleEl ? titleEl.textContent.trim() : '',
          company: companyEl ? companyEl.textContent.trim() : '',
          location: locationEl ? locationEl.textContent.trim() : '',
          applyUrl: linkEl ? linkEl.href : '',
          easyApply: isEasyApply,
        });
      }

      return results;
    });

    let newFound = 0;
    for (const raw of cards) {
      const job = parseJobCard(raw);
      if (!job) {
        continue;
      }
      const dedupKey = job.linkedinJobId || `${job.title}__${job.company}`;
      if (!seenIds.has(dedupKey)) {
        seenIds.add(dedupKey);
        allJobs.push(job);
        newFound++;
      }
    }

    logger.debug('SavedJobsWalker: scroll cycle complete', {
      cycle: cycle + 1,
      newFound,
      total: allJobs.length,
    });

    if (newFound === 0) {
      // No new jobs after scrolling — we have reached the end
      logger.info('SavedJobsWalker: no new jobs found, stopping pagination');
      break;
    }

    // Scroll to bottom to trigger next batch of infinite-scroll results
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Rate-limit: wait 2-4 seconds between scroll loads
    await browserManager.humanDelay(2000, 4000);
  }

  return allJobs;
}

/**
 * Fetch all saved jobs from LinkedIn and upsert them into the database.
 * In mock mode, returns 3 fixture jobs without touching LinkedIn.
 *
 * @param {Object} sessionManager - LinkedInSessionManager instance (for auth)
 * @param {BrowserManager} browserManager - BrowserManager instance (must be launched)
 * @param {Object} options
 * @param {boolean} options.mockMode - Skip real scraping, return fixtures
 * @param {boolean} options.refreshAfterApply - Re-fetch page after applying (default false)
 * @param {number} options.maxPages - Max scroll cycles (default 10)
 * @param {Object|null} options.savedJobModel - SavedJob model for upsert (optional)
 * @param {string|null} options.userId - User ID for DB upsert (required if savedJobModel provided)
 * @returns {Array<Object>} list of parsed job objects
 */
async function fetchSavedJobs(sessionManager, browserManager, options = {}) {
  const {
    mockMode = process.env.LINKEDIN_MOCK === 'true',
    refreshAfterApply = false,
    maxPages = 10,
    savedJobModel = null,
    userId = null,
  } = options;

  if (mockMode) {
    logger.info('SavedJobsWalker: mock mode — returning fixture jobs');
    return MOCK_SAVED_JOBS.map((j) => ({ ...j }));
  }

  const page = browserManager.page;
  if (!page) {
    throw new Error('BrowserManager must be launched before calling fetchSavedJobs()');
  }

  // Restore session before navigating
  await sessionManager.restoreSession(browserManager);

  logger.info('SavedJobsWalker: navigating to saved jobs page', { url: SAVED_JOBS_URL });
  await page.goto(SAVED_JOBS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for first job card to appear
  // TODO: verify selector — primary job card container
  await page
    .waitForSelector('.job-card-container, [data-job-id]', { timeout: 15000 })
    .catch(() => logger.warn('SavedJobsWalker: job card selector not found — page may be empty'));

  // Rate-limit: initial page load pause
  await browserManager.humanDelay(2000, 4000);

  const jobs = await walkAllPages(page, browserManager, maxPages);

  logger.info('SavedJobsWalker: extracted saved jobs', { count: jobs.length });

  // Optionally refresh after apply batch
  if (refreshAfterApply) {
    logger.debug('SavedJobsWalker: refreshing saved jobs page post-apply');
    await page.goto(SAVED_JOBS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await browserManager.humanDelay(1500, 3000);
  }

  // Upsert into DB if model and userId provided
  // NOTE: SavedJob model uses job_id as FK to jobs table — direct upsert by
  // linkedinJobId is not supported without first creating a jobs record.
  // This is marked as a BLOCKER below.
  if (savedJobModel && userId) {
    logger.warn(
      'SavedJobsWalker: DB upsert by linkedinJobId requires jobs table record — ' +
        'BLOCKED until jobScraper/linkedinParser creates jobs rows first. Skipping DB write.',
    );
    // TODO: BLOCKED — SavedJob.save() requires a jobs.id FK.
    // Unlock condition: jobScraper must upsert job records and return their IDs before
    // savedJobsWalker can persist SavedJob rows. Wire via: jobId = await upsertLinkedInJob(job);
    // then: await savedJobModel.save(userId, jobId, { notes: '', priority: 'medium' });
  }

  return jobs;
}

module.exports = {
  fetchSavedJobs,
  walkAllPages,
  parseJobCard,
  SAVED_JOBS_URL,
  MOCK_SAVED_JOBS,
};
