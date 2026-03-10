const logger = require('../utils/logger');

const calculateMatchScore = (job, preferences) => {
  let score = 0;
  let maxScore = 0;

  // Role matching (40 points)
  maxScore += 40;
  if (preferences.target_roles && preferences.target_roles.length > 0) {
    const roleMatch = preferences.target_roles.some((role) =>
      job.title.toLowerCase().includes(role.toLowerCase()),
    );
    if (roleMatch) {
      score += 40;
    }
  } else {
    score += 20; // Neutral if no preference
  }

  // Location matching (20 points)
  maxScore += 20;
  if (preferences.target_locations && preferences.target_locations.length > 0) {
    const locationMatch = preferences.target_locations.some(
      (loc) =>
        job.location &&
        (job.location.toLowerCase().includes(loc.toLowerCase()) ||
          loc.toLowerCase() === 'remote'),
    );
    if (locationMatch) {
      score += 20;
    }
  } else {
    score += 10;
  }

  // Salary matching (25 points)
  maxScore += 25;
  if (preferences.min_salary || preferences.max_salary) {
    const salaryFits =
      (!preferences.min_salary || !job.salary_max || job.salary_max >= preferences.min_salary) &&
      (!preferences.max_salary || !job.salary_min || job.salary_min <= preferences.max_salary);
    if (salaryFits) {
      score += 25;
    }
  } else {
    score += 12;
  }

  // Experience level matching (15 points)
  maxScore += 15;
  if (preferences.experience_level && preferences.experience_level.length > 0) {
    if (job.job_level && preferences.experience_level.includes(job.job_level)) {
      score += 15;
    }
  } else {
    score += 7;
  }

  // Excluded companies check (-100 points)
  if (preferences.excluded_companies && preferences.excluded_companies.length > 0) {
    const isExcluded = preferences.excluded_companies.some(
      (company) => job.company.toLowerCase() === company.toLowerCase(),
    );
    if (isExcluded) {
      return { score: 0, maxScore, matched: false, reason: 'Company excluded' };
    }
  }

  const normalizedScore = Math.round((score / maxScore) * 100);
  return {
    score: normalizedScore,
    maxScore: 100,
    matched: normalizedScore >= 50,
    reason: normalizedScore >= 50 ? 'Good match' : 'Below threshold',
  };
};

const matchJobsForUser = (jobs, preferences) => {
  const results = jobs
    .map((job) => ({
      job,
      match: calculateMatchScore(job, preferences),
    }))
    .filter((r) => r.match.matched)
    .sort((a, b) => b.match.score - a.match.score);

  logger.debug(`Matched ${results.length}/${jobs.length} jobs for user`);
  return results;
};

module.exports = { calculateMatchScore, matchJobsForUser };
