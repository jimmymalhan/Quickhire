/**
 * Job Parser
 * Parses LinkedIn HTML search results and job detail pages
 * into structured job objects
 */
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Parse search results HTML into array of job objects
 */
const parseSearchResults = (html) => {
  if (!html || typeof html !== 'string') {return [];}

  const jobs = [];

  // Match job card patterns in LinkedIn search results HTML
  const cardPattern = /<li[^>]*class="[^"]*(?:job-search-card|result-card|jobs-search__results-list)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let cardMatch;

  while ((cardMatch = cardPattern.exec(html)) !== null) {
    const cardHtml = cardMatch[1];
    const job = _extractJobFromCard(cardHtml);
    if (job && job.title) {
      jobs.push(job);
    }
  }

  // Fallback: try data-entity-urn pattern
  if (jobs.length === 0) {
    const urnPattern = /data-entity-urn="urn:li:jobPosting:(\d+)"[\s\S]*?<\/div>/gi;
    let urnMatch;
    while ((urnMatch = urnPattern.exec(html)) !== null) {
      const jobId = urnMatch[1];
      const surroundingHtml = html.substring(
        Math.max(0, urnMatch.index - 200),
        Math.min(html.length, urnMatch.index + urnMatch[0].length + 500)
      );
      const job = _extractJobFromCard(surroundingHtml);
      if (job) {
        job.jobId = jobId;
        job.linkedinJobId = jobId;
        jobs.push(job);
      }
    }
  }

  // Fallback: try JSON-LD structured data
  if (jobs.length === 0) {
    const jsonLdJobs = _parseJsonLd(html);
    jobs.push(...jsonLdJobs);
  }

  logger.debug('Parsed search results', { jobCount: jobs.length });
  return jobs;
};

/**
 * Parse a single job listing page HTML
 */
const parseJobListing = (html, url = '') => {
  if (!html || typeof html !== 'string') {
    return { title: '', company: '', url };
  }

  // Try JSON-LD first (most reliable)
  const jsonLd = _parseJsonLd(html);
  if (jsonLd.length > 0) {
    const job = jsonLd[0];
    job.url = url;
    return job;
  }

  // Parse from HTML structure
  const title = _extractText(html, [
    /<h1[^>]*class="[^"]*top-card-layout__title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<title>([\s\S]*?)<\/title>/i,
  ]);

  const company = _extractText(html, [
    /<a[^>]*class="[^"]*topcard__org-name-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
    /<span[^>]*class="[^"]*company-name[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    /<a[^>]*data-tracking-control-name="public_jobs_topcard-org-name"[^>]*>([\s\S]*?)<\/a>/i,
  ]);

  const location = _extractText(html, [
    /<span[^>]*class="[^"]*topcard__flavor--bullet[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  ]);

  const description = _extractText(html, [
    /<div[^>]*class="[^"]*description__text[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ]);

  const salary = _extractText(html, [
    /<span[^>]*class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    /<span[^>]*class="[^"]*compensation[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  ]);

  const jobId = _extractJobId(html, url);

  return {
    jobId,
    linkedinJobId: jobId,
    title: _cleanText(title),
    company: _cleanText(company),
    location: _cleanText(location),
    description: _cleanText(description),
    salary: _cleanText(salary),
    url,
  };
};

/**
 * Normalize a raw job object into the database schema format
 */
const normalizeJob = (raw) => {
  const title = (raw.title || '').trim();
  const company = (raw.company || '').trim();
  const location = (raw.location || '').trim();
  const description = (raw.description || '').trim();
  const salary = _parseSalary(raw.salary || raw.salaryText || '');

  return {
    linkedinJobId: raw.jobId || raw.linkedinJobId || null,
    title,
    company,
    location,
    salaryMin: salary.min,
    salaryMax: salary.max,
    description,
    jobLevel: _detectJobLevel(title, description),
    experienceYears: _parseExperienceYears(description),
    postedAt: raw.postedAt ? new Date(raw.postedAt) : new Date(),
    scrapeDate: new Date(),
    url: raw.url || null,
    hash: _generateHash(title, company, location),
  };
};

// --- Internal helpers ---

function _extractJobFromCard(cardHtml) {
  const title = _extractText(cardHtml, [
    /<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i,
    /<h3[^>]*>([\s\S]*?)<\/h3>/i,
    /<span[^>]*class="[^"]*job-title[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  ]);

  const company = _extractText(cardHtml, [
    /<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i,
    /<h4[^>]*>([\s\S]*?)<\/h4>/i,
    /<a[^>]*class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
  ]);

  const location = _extractText(cardHtml, [
    /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    /<span[^>]*class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  ]);

  const urlMatch = cardHtml.match(/href="(https?:\/\/[^"]*\/jobs\/view\/[^"]*)"/i);
  const url = urlMatch ? urlMatch[1] : '';

  const jobIdMatch = url.match(/\/jobs\/view\/(\d+)/);
  const jobId = jobIdMatch ? jobIdMatch[1] : null;

  const dateMatch = cardHtml.match(/<time[^>]*datetime="([^"]*)"[^>]*>/i);
  const postedAt = dateMatch ? dateMatch[1] : null;

  if (!_cleanText(title)) {return null;}

  return {
    jobId,
    linkedinJobId: jobId,
    title: _cleanText(title),
    company: _cleanText(company),
    location: _cleanText(location),
    url,
    postedAt,
  };
}

function _parseJsonLd(html) {
  const jobs = [];
  const pattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (item['@type'] === 'JobPosting') {
          jobs.push({
            title: item.title || '',
            company: item.hiringOrganization?.name || '',
            location: item.jobLocation?.address?.addressLocality || '',
            description: item.description || '',
            salary: item.baseSalary
              ? `${item.baseSalary.value?.minValue || ''}-${item.baseSalary.value?.maxValue || ''}`
              : '',
            postedAt: item.datePosted || null,
            jobId: item.identifier?.value || null,
            linkedinJobId: item.identifier?.value || null,
            url: item.url || '',
          });
        }
      }
    } catch (e) {
      // Invalid JSON-LD, skip
    }
  }

  return jobs;
}

function _extractText(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return '';
}

function _cleanText(text) {
  if (!text) {return '';}
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _extractJobId(html, url) {
  // Try URL first
  const urlMatch = (url || '').match(/\/jobs\/view\/(\d+)/);
  if (urlMatch) {return urlMatch[1];}

  // Try data attributes
  const dataMatch = html.match(/data-job-id="(\d+)"/i);
  if (dataMatch) {return dataMatch[1];}

  const urnMatch = html.match(/urn:li:jobPosting:(\d+)/);
  if (urnMatch) {return urnMatch[1];}

  return null;
}

function _parseSalary(salaryText) {
  if (!salaryText) {return { min: null, max: null };}

  const cleaned = salaryText.replace(/,/g, '').replace(/\s+/g, ' ').trim();

  const rangeMatch = cleaned.match(/\$?([\d.]+)\s*[kK]?\s*[-–to]+\s*\$?([\d.]+)\s*[kK]?/);
  if (rangeMatch) {
    let min = parseFloat(rangeMatch[1]);
    let max = parseFloat(rangeMatch[2]);
    if (cleaned.toLowerCase().includes('k') || min < 1000) {
      if (min < 1000) {min *= 1000;}
      if (max < 1000) {max *= 1000;}
    }
    return { min: Math.round(min), max: Math.round(max) };
  }

  const singleMatch = cleaned.match(/\$?([\d.]+)\s*[kK]?/);
  if (singleMatch) {
    let amount = parseFloat(singleMatch[1]);
    if (cleaned.toLowerCase().includes('k') || amount < 1000) {
      amount *= 1000;
    }
    return { min: Math.round(amount), max: Math.round(amount) };
  }

  return { min: null, max: null };
}

function _detectJobLevel(title, description) {
  const combined = `${title || ''} ${description || ''}`.toLowerCase();
  if (/\b(principal|staff|distinguished|fellow)\b/.test(combined)) {return 'staff';}
  if (/\b(senior|sr\.?|lead|iii)\b/.test(combined)) {return 'senior';}
  if (/\b(mid[- ]?level|intermediate|ii)\b/.test(combined)) {return 'mid';}
  if (/\b(junior|jr\.?|entry[- ]?level|associate|intern)\b/.test(combined)) {return 'entry';}
  return 'mid';
}

function _parseExperienceYears(text) {
  if (!text) {return null;}
  const match = text.match(/(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)/i);
  if (match) {return parseInt(match[1], 10);}
  return null;
}

function _generateHash(title, company, location) {
  const normalized = [
    (title || '').toLowerCase().trim(),
    (company || '').toLowerCase().trim(),
    (location || '').toLowerCase().trim(),
  ].join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

module.exports = {
  parseSearchResults,
  parseJobListing,
  normalizeJob,
};
