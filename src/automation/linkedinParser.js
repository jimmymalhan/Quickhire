/**
 * LinkedIn Job Page Parser
 * Extracts structured job data from LinkedIn job listing HTML
 */
const crypto = require('crypto');

/**
 * Parse salary text into min/max numbers
 */
const parseSalary = (salaryText) => {
  if (!salaryText) {
    return { min: null, max: null };
  }

  const cleaned = salaryText.replace(/,/g, '').replace(/\s+/g, ' ').trim();

  // Match patterns like "$80,000 - $120,000" or "$80K - $120K"
  const rangeMatch = cleaned.match(/\$?([\d.]+)\s*[kK]?\s*[-–to]+\s*\$?([\d.]+)\s*[kK]?/);
  if (rangeMatch) {
    let min = parseFloat(rangeMatch[1]);
    let max = parseFloat(rangeMatch[2]);

    // Handle K notation
    if (cleaned.toLowerCase().includes('k') || min < 1000) {
      if (min < 1000) {
        min *= 1000;
      }
      if (max < 1000) {
        max *= 1000;
      }
    }

    return { min: Math.round(min), max: Math.round(max) };
  }

  // Single salary like "$100,000/yr"
  const singleMatch = cleaned.match(/\$?([\d.]+)\s*[kK]?/);
  if (singleMatch) {
    let amount = parseFloat(singleMatch[1]);
    const isHourly =
      cleaned.toLowerCase().includes('/hr') || cleaned.toLowerCase().includes('hour');
    // Handle hourly rates first (before K notation check, since hourly values are small numbers)
    if (isHourly) {
      amount = Math.round(amount * 2080); // 40hrs * 52 weeks
    } else if (cleaned.toLowerCase().includes('k') || amount < 1000) {
      amount *= 1000;
    }
    return { min: Math.round(amount), max: Math.round(amount) };
  }

  return { min: null, max: null };
};

/**
 * Extract experience years from description text
 */
const parseExperienceYears = (text) => {
  if (!text) {
    return null;
  }

  const patterns = [
    /(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)/i,
    /(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)/i,
    /(?:experience|exp)(?:\s+of)?\s*:?\s*(\d+)\+?\s*(?:years?|yrs?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return null;
};

/**
 * Determine job level from title and description
 */
const parseJobLevel = (title, description) => {
  const combined = `${title || ''} ${description || ''}`.toLowerCase();

  if (/\b(principal|staff|distinguished|fellow)\b/.test(combined)) {
    return 'staff';
  }
  if (/\b(senior|sr\.?|lead|iii)\b/.test(combined)) {
    return 'senior';
  }
  if (/\b(mid[- ]?level|intermediate|ii)\b/.test(combined)) {
    return 'mid';
  }
  if (/\b(junior|jr\.?|entry[- ]?level|associate|i\b|intern)\b/.test(combined)) {
    return 'entry';
  }

  return 'mid'; // default
};

/**
 * Extract requirements from job description
 */
const parseRequirements = (descriptionText) => {
  if (!descriptionText) {
    return [];
  }

  const requirements = [];
  const lines = descriptionText.split(/\n/);
  let inRequirementsSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect requirements section headers
    if (/^(requirements|qualifications|what you.?ll need|must have|skills)/i.test(trimmed)) {
      inRequirementsSection = true;
      continue;
    }

    // Detect end of requirements section
    if (
      inRequirementsSection &&
      /^(responsibilities|about|benefits|what we offer|nice to have)/i.test(trimmed)
    ) {
      inRequirementsSection = false;
      continue;
    }

    // Collect bullet points in requirements section
    if (inRequirementsSection && /^[•\-*▪]\s*(.+)/.test(trimmed)) {
      const match = trimmed.match(/^[•\-*▪]\s*(.+)/);
      if (match) {
        requirements.push(match[1].trim());
      }
    }
  }

  return requirements;
};

/**
 * Extract skills/technologies from description text
 */
const parseSkills = (text) => {
  if (!text) {
    return [];
  }

  const knownSkills = [
    'javascript',
    'typescript',
    'python',
    'java',
    'c\\+\\+',
    'c#',
    'go',
    'rust',
    'ruby',
    'react',
    'angular',
    'vue',
    'node\\.?js',
    'express',
    'django',
    'flask',
    'spring',
    'aws',
    'azure',
    'gcp',
    'docker',
    'kubernetes',
    'terraform',
    'sql',
    'postgresql',
    'mysql',
    'mongodb',
    'redis',
    'elasticsearch',
    'git',
    'ci/cd',
    'jenkins',
    'github actions',
    'rest',
    'graphql',
    'grpc',
    'microservices',
    'agile',
    'scrum',
    'kanban',
    'machine learning',
    'deep learning',
    'nlp',
    'computer vision',
    'html',
    'css',
    'sass',
    'tailwind',
    'linux',
    'unix',
    'bash',
  ];

  const found = [];
  const lower = text.toLowerCase();

  for (const skill of knownSkills) {
    const regex = new RegExp(`\\b${skill}\\b`, 'i');
    if (regex.test(lower)) {
      const match = lower.match(regex);
      if (match) {
        found.push(match[0]);
      }
    }
  }

  return [...new Set(found)];
};

/**
 * Generate a deterministic hash for deduplication
 */
const generateJobHash = (title, company, location) => {
  const normalized = [
    (title || '').toLowerCase().trim(),
    (company || '').toLowerCase().trim(),
    (location || '').toLowerCase().trim(),
  ].join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

/**
 * Parse a raw job listing object (from page scrape) into structured format
 */
const parseJobListing = (raw) => {
  const title = (raw.title || '').trim();
  const company = (raw.company || '').trim();
  const location = (raw.location || '').trim();
  const description = (raw.description || '').trim();
  const salary = parseSalary(raw.salary || raw.salaryText || '');
  const experienceYears = parseExperienceYears(description);
  const jobLevel = parseJobLevel(title, description);
  const requirements = parseRequirements(description);
  const skills = parseSkills(description);
  const hash = generateJobHash(title, company, location);

  return {
    linkedinJobId: raw.jobId || raw.linkedinJobId || null,
    title,
    company,
    location,
    salaryMin: salary.min,
    salaryMax: salary.max,
    description,
    jobLevel,
    experienceYears,
    requirements,
    skills,
    postedAt: raw.postedAt ? new Date(raw.postedAt) : new Date(),
    scrapeDate: new Date(),
    url: raw.url || null,
    hash,
  };
};

/**
 * Parse multiple job listings
 */
const parseJobListings = (rawJobs) => {
  return rawJobs.map(parseJobListing).filter((job) => job.title && job.company);
};

module.exports = {
  parseSalary,
  parseExperienceYears,
  parseJobLevel,
  parseRequirements,
  parseSkills,
  generateJobHash,
  parseJobListing,
  parseJobListings,
};
