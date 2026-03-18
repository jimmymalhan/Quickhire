/**
 * Resume Customizer - Tailor resumes for specific job applications
 * Extracts keywords, matches skills, reorders sections, and generates summaries
 */
const logger = require('../utils/logger');
const { AppError, ERROR_CODES } = require('../utils/errorCodes');

// Common skill categories for keyword extraction
const SKILL_CATEGORIES = {
  programming: [
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go',
    'rust', 'swift', 'kotlin', 'php', 'scala', 'r', 'sql', 'html', 'css',
  ],
  frameworks: [
    'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask',
    'spring', 'rails', 'next.js', 'nuxt', 'svelte', 'fastapi', 'nestjs',
  ],
  databases: [
    'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb',
    'cassandra', 'sqlite', 'oracle', 'sql server',
  ],
  cloud: [
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins',
    'ci/cd', 'github actions', 'circleci',
  ],
  soft: [
    'leadership', 'communication', 'teamwork', 'problem-solving',
    'agile', 'scrum', 'project management', 'mentoring',
  ],
};

class ResumeCustomizer {
  constructor(options = {}) {
    this.mockMode = options.mockMode !== undefined ? options.mockMode : true;
    this.skillCategories = options.skillCategories || SKILL_CATEGORIES;
  }

  /**
   * Customize a resume for a specific job posting
   * @param {Object} resume - Parsed resume object
   * @param {Object} job - Job posting details
   * @returns {Object} Customized resume with fit score
   */
  customize(resume, job) {
    if (!resume || typeof resume !== 'object') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Resume is required and must be an object');
    }

    if (!job || typeof job !== 'object') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Job posting is required and must be an object');
    }

    logger.info('Customizing resume for job', {
      jobTitle: job.title,
      company: job.company,
    });

    const jobKeywords = this.extractKeywords(job);
    const skillMatch = this.matchSkills(resume, jobKeywords);
    const reorderedResume = this.reorderSections(resume, job, skillMatch);
    const summary = this.generateSummary(resume, job, skillMatch);
    const fitScore = this.scoreFit(resume, job, skillMatch);

    const customized = {
      ...reorderedResume,
      summary,
      customization: {
        jobId: job.id || null,
        jobTitle: job.title || '',
        company: job.company || '',
        keywords: jobKeywords,
        matchedSkills: skillMatch.matched,
        missingSkills: skillMatch.missing,
        fitScore,
        customizedAt: new Date().toISOString(),
      },
    };

    logger.info('Resume customized', {
      fitScore: fitScore.overall,
      matchedSkills: skillMatch.matched.length,
      missingSkills: skillMatch.missing.length,
    });

    return customized;
  }

  /**
   * Extract relevant keywords from a job posting
   * @param {Object} job - Job posting
   * @returns {string[]} Extracted keywords
   */
  extractKeywords(job) {
    if (!job || typeof job !== 'object') {
      return [];
    }

    const text = [
      job.title || '',
      job.description || '',
      ...(Array.isArray(job.requirements) ? job.requirements : []),
      ...(Array.isArray(job.skills) ? job.skills : []),
    ]
      .join(' ')
      .toLowerCase();

    const keywords = new Set();

    // Extract from skill categories
    for (const [, skills] of Object.entries(this.skillCategories)) {
      for (const skill of skills) {
        if (text.includes(skill.toLowerCase())) {
          keywords.add(skill);
        }
      }
    }

    // Extract from explicit skills/requirements arrays
    if (Array.isArray(job.skills)) {
      job.skills.forEach((s) => keywords.add(s.toLowerCase().trim()));
    }

    if (Array.isArray(job.requirements)) {
      job.requirements.forEach((r) => {
        const trimmed = r.toLowerCase().trim();
        if (trimmed.length < 50) {
          keywords.add(trimmed);
        }
      });
    }

    return [...keywords];
  }

  /**
   * Match resume skills against job keywords
   * @param {Object} resume - Parsed resume
   * @param {string[]} jobKeywords - Keywords from job posting
   * @returns {{ matched: string[], missing: string[], score: number }}
   */
  matchSkills(resume, jobKeywords) {
    if (!resume || !Array.isArray(jobKeywords) || jobKeywords.length === 0) {
      return { matched: [], missing: [], score: 0 };
    }

    const resumeSkills = (Array.isArray(resume.skills) ? resume.skills : []).map((s) =>
      s.toLowerCase().trim(),
    );

    // Also extract skills from experience descriptions
    const experienceText = (Array.isArray(resume.experience) ? resume.experience : [])
      .map((exp) => {
        const desc = Array.isArray(exp.description) ? exp.description.join(' ') : exp.description || '';
        return `${exp.title || ''} ${desc}`.toLowerCase();
      })
      .join(' ');

    const matched = [];
    const missing = [];

    for (const keyword of jobKeywords) {
      const keywordLower = keyword.toLowerCase().trim();
      const found =
        resumeSkills.some((s) => s.includes(keywordLower) || keywordLower.includes(s)) ||
        experienceText.includes(keywordLower);

      if (found) {
        matched.push(keyword);
      } else {
        missing.push(keyword);
      }
    }

    const score = jobKeywords.length > 0 ? Math.round((matched.length / jobKeywords.length) * 100) : 0;

    return { matched, missing, score };
  }

  /**
   * Reorder resume sections to prioritize relevant experience
   * @param {Object} resume - Parsed resume
   * @param {Object} job - Job posting
   * @param {Object} skillMatch - Skill match results
   * @returns {Object} Resume with reordered experience
   */
  reorderSections(resume, job, skillMatch) {
    if (!resume || typeof resume !== 'object') {
      return resume || {};
    }

    const reordered = { ...resume };

    // Reorder experience entries by relevance to job
    if (Array.isArray(resume.experience) && resume.experience.length > 1 && job) {
      const jobTitle = (job.title || '').toLowerCase();
      const matchedSkillsLower = (skillMatch?.matched || []).map((s) => s.toLowerCase());

      reordered.experience = [...resume.experience].sort((a, b) => {
        const scoreA = this._relevanceScore(a, jobTitle, matchedSkillsLower);
        const scoreB = this._relevanceScore(b, jobTitle, matchedSkillsLower);
        return scoreB - scoreA;
      });
    }

    // Reorder skills: matched skills first
    if (Array.isArray(resume.skills) && skillMatch?.matched?.length > 0) {
      const matchedLower = new Set(skillMatch.matched.map((s) => s.toLowerCase()));
      const matchedFirst = [];
      const rest = [];

      for (const skill of resume.skills) {
        if (matchedLower.has(skill.toLowerCase())) {
          matchedFirst.push(skill);
        } else {
          rest.push(skill);
        }
      }

      reordered.skills = [...matchedFirst, ...rest];
    }

    return reordered;
  }

  /**
   * Calculate relevance score for an experience entry
   * @param {Object} entry - Experience entry
   * @param {string} jobTitle - Job title (lowercase)
   * @param {string[]} matchedSkills - Matched skills (lowercase)
   * @returns {number} Relevance score
   */
  _relevanceScore(entry, jobTitle, matchedSkills) {
    let score = 0;
    const title = (entry.title || '').toLowerCase();
    const desc = Array.isArray(entry.description)
      ? entry.description.join(' ').toLowerCase()
      : (entry.description || '').toLowerCase();

    // Title similarity
    if (title.includes(jobTitle) || jobTitle.includes(title)) {
      score += 50;
    }

    // Skill mentions in description
    for (const skill of matchedSkills) {
      if (desc.includes(skill) || title.includes(skill)) {
        score += 10;
      }
    }

    return score;
  }

  /**
   * Generate a tailored professional summary
   * @param {Object} resume - Parsed resume
   * @param {Object} job - Job posting
   * @param {Object} skillMatch - Skill match results
   * @returns {string} Tailored summary
   */
  generateSummary(resume, job, skillMatch) {
    if (!resume || !job) {
      return resume?.summary || '';
    }

    const jobTitle = job.title || 'the position';
    const company = job.company || 'your organization';
    const yearsExp = this._estimateYears(resume.experience);
    const topSkills = (skillMatch?.matched || []).slice(0, 5);

    if (topSkills.length === 0 && !resume.summary) {
      return `Experienced professional seeking ${jobTitle} role at ${company}.`;
    }

    const skillsText = topSkills.length > 0 ? ` with expertise in ${topSkills.join(', ')}` : '';
    const yearsText = yearsExp > 0 ? `${yearsExp}+ years of experience` : 'Experienced';

    return `${yearsText} professional${skillsText}, seeking to contribute as ${jobTitle} at ${company}. ${resume.summary || ''}`.trim();
  }

  /**
   * Estimate years of experience from experience entries
   * @param {Array} experience - Experience entries
   * @returns {number} Estimated years
   */
  _estimateYears(experience) {
    if (!Array.isArray(experience) || experience.length === 0) {
      return 0;
    }

    let totalYears = 0;
    const currentYear = new Date().getFullYear();

    for (const exp of experience) {
      const duration = exp.duration || '';
      const yearMatch = duration.match(/(\d{4})\s*[-–]\s*(\d{4}|present|current)/i);
      if (yearMatch) {
        const startYear = parseInt(yearMatch[1], 10);
        const endYear = yearMatch[2].match(/\d{4}/)
          ? parseInt(yearMatch[2], 10)
          : currentYear;
        totalYears += Math.max(0, endYear - startYear);
      }
    }

    return totalYears;
  }

  /**
   * Score how well a resume fits a job posting
   * @param {Object} resume - Parsed resume
   * @param {Object} job - Job posting
   * @param {Object} skillMatch - Skill match results
   * @returns {{ overall: number, skills: number, experience: number, education: number }}
   */
  scoreFit(resume, job, skillMatch) {
    if (!resume || !job) {
      return { overall: 0, skills: 0, experience: 0, education: 0 };
    }

    // Skills score (50% weight)
    const skillsScore = skillMatch?.score || 0;

    // Experience score (30% weight)
    let experienceScore = 0;
    const yearsExp = this._estimateYears(resume.experience);
    const requiredLevel = (job.job_level || job.level || '').toLowerCase();

    const levelYears = { entry: 0, junior: 1, mid: 3, senior: 5, lead: 7, executive: 10 };
    const requiredYears = levelYears[requiredLevel] || 0;

    if (yearsExp >= requiredYears) {
      experienceScore = 100;
    } else if (requiredYears > 0) {
      experienceScore = Math.round((yearsExp / requiredYears) * 100);
    } else {
      experienceScore = yearsExp > 0 ? 100 : 50;
    }

    // Education score (20% weight)
    let educationScore = 50; // Default neutral score
    if (Array.isArray(resume.education) && resume.education.length > 0) {
      educationScore = 80; // Has education
      const degrees = resume.education.map((e) => (e.degree || '').toLowerCase());
      if (degrees.some((d) => d.includes('master') || d.includes('phd') || d.includes('doctorate'))) {
        educationScore = 100;
      } else if (degrees.some((d) => d.includes('bachelor') || d.includes('bs') || d.includes('ba'))) {
        educationScore = 90;
      }
    }

    const overall = Math.round(skillsScore * 0.5 + experienceScore * 0.3 + educationScore * 0.2);

    return {
      overall: Math.min(100, Math.max(0, overall)),
      skills: Math.min(100, skillsScore),
      experience: Math.min(100, experienceScore),
      education: Math.min(100, educationScore),
    };
  }

  /**
   * Generate a cover letter tailored to a job posting
   * @param {Object} resume - Parsed resume
   * @param {Object} job - Job posting
   * @param {Object} options - Options (tone, length)
   * @returns {string} Generated cover letter
   */
  generateCoverLetter(resume, job, options = {}) {
    if (!resume || typeof resume !== 'object') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Resume is required for cover letter generation');
    }

    if (!job || typeof job !== 'object') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Job posting is required for cover letter generation');
    }

    const name = resume.contact?.name || 'Applicant';
    const jobTitle = job.title || 'the open position';
    const company = job.company || 'your company';
    const tone = options.tone || 'professional';
    const matchResult = this.matchSkills(resume, this.extractKeywords(job));
    const topSkills = matchResult.matched.slice(0, 3);
    const yearsExp = this._estimateYears(resume.experience);

    let greeting;
    if (tone === 'casual') {
      greeting = `Hi there,`;
    } else {
      greeting = `Dear Hiring Manager,`;
    }

    const intro = `I am writing to express my interest in the ${jobTitle} position at ${company}.`;

    let body;
    if (topSkills.length > 0 && yearsExp > 0) {
      body = `With ${yearsExp}+ years of experience and strong proficiency in ${topSkills.join(', ')}, I am confident I would be a valuable addition to your team.`;
    } else if (yearsExp > 0) {
      body = `With ${yearsExp}+ years of relevant experience, I am confident I would be a valuable addition to your team.`;
    } else {
      body = `I am eager to bring my skills and enthusiasm to your team.`;
    }

    const experienceHighlight =
      Array.isArray(resume.experience) && resume.experience.length > 0
        ? `In my most recent role as ${resume.experience[0].title || 'a professional'} at ${resume.experience[0].company || 'my previous company'}, I developed expertise directly applicable to this position.`
        : '';

    const closing = `I would welcome the opportunity to discuss how my background aligns with your needs. Thank you for considering my application.`;

    const signoff = `Sincerely,\n${name}`;

    const parts = [greeting, '', intro, '', body];
    if (experienceHighlight) {
      parts.push('', experienceHighlight);
    }
    parts.push('', closing, '', signoff);

    return parts.join('\n');
  }
}

module.exports = { ResumeCustomizer, SKILL_CATEGORIES };
