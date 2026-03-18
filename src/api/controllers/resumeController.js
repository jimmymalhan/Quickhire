/**
 * Resume Controller - API endpoints for resume management
 * Handles upload, retrieval, customization, and deletion of resumes
 */
const logger = require('../../utils/logger');
const { AppError, ERROR_CODES } = require('../../utils/errorCodes');
const { ResumeParser } = require('../../automation/resumeParser');
const { ResumeCustomizer } = require('../../automation/resumeCustomizer');

const parser = new ResumeParser();
const customizer = new ResumeCustomizer();

// In-memory store for mock mode (would be database in production)
const resumeStore = new Map();

/**
 * Upload a resume
 * POST /api/resumes
 */
const uploadResume = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { content, format, name } = req.body;

    if (!content) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Resume content is required');
    }

    if (!name) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Resume name is required');
    }

    const parsedFormat = format || 'json';
    const parsed = parser.parse(content, parsedFormat);
    const validation = parser.validate(parsed);

    if (!validation.valid) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, `Invalid resume: ${validation.errors.join(', ')}`);
    }

    const resumeId = `resume-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const resume = {
      id: resumeId,
      userId,
      name,
      format: parsedFormat,
      content: parsed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store resume
    if (!resumeStore.has(userId)) {
      resumeStore.set(userId, []);
    }
    resumeStore.get(userId).push(resume);

    logger.info('Resume uploaded', { userId, resumeId, name });

    res.status(201).json({
      status: 'success',
      code: 201,
      data: resume,
      traceId: req.headers['x-request-id'] || null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all resumes for authenticated user
 * GET /api/resumes
 */
const getResumes = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const resumes = resumeStore.get(userId) || [];

    res.json({
      status: 'success',
      code: 200,
      data: resumes,
      meta: { total: resumes.length },
      traceId: req.headers['x-request-id'] || null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Customize a resume for a specific job
 * POST /api/resumes/:id/customize
 */
const customizeForJob = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { job } = req.body;

    if (!job) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Job posting data is required');
    }

    const userResumes = resumeStore.get(userId) || [];
    const resume = userResumes.find((r) => r.id === id);

    if (!resume) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Resume not found');
    }

    const customized = customizer.customize(resume.content, job);

    logger.info('Resume customized for job', {
      userId,
      resumeId: id,
      jobTitle: job.title,
      fitScore: customized.customization.fitScore.overall,
    });

    res.json({
      status: 'success',
      code: 200,
      data: customized,
      traceId: req.headers['x-request-id'] || null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Preview customization without saving
 * POST /api/resumes/:id/preview
 */
const previewCustomization = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { job } = req.body;

    if (!job) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Job posting data is required');
    }

    const userResumes = resumeStore.get(userId) || [];
    const resume = userResumes.find((r) => r.id === id);

    if (!resume) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Resume not found');
    }

    const jobKeywords = customizer.extractKeywords(job);
    const skillMatch = customizer.matchSkills(resume.content, jobKeywords);
    const fitScore = customizer.scoreFit(resume.content, job, skillMatch);

    res.json({
      status: 'success',
      code: 200,
      data: {
        resumeId: id,
        jobTitle: job.title,
        keywords: jobKeywords,
        matchedSkills: skillMatch.matched,
        missingSkills: skillMatch.missing,
        skillMatchScore: skillMatch.score,
        fitScore,
      },
      traceId: req.headers['x-request-id'] || null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a resume
 * DELETE /api/resumes/:id
 */
const deleteResume = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const userResumes = resumeStore.get(userId) || [];
    const index = userResumes.findIndex((r) => r.id === id);

    if (index === -1) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Resume not found');
    }

    userResumes.splice(index, 1);

    logger.info('Resume deleted', { userId, resumeId: id });

    res.json({
      status: 'success',
      code: 200,
      data: { deleted: true, id },
      traceId: req.headers['x-request-id'] || null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Generate a cover letter for a job
 * POST /api/resumes/:id/cover-letter
 */
const generateCoverLetter = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { job, options } = req.body;

    if (!job) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Job posting data is required');
    }

    const userResumes = resumeStore.get(userId) || [];
    const resume = userResumes.find((r) => r.id === id);

    if (!resume) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Resume not found');
    }

    const coverLetter = customizer.generateCoverLetter(resume.content, job, options || {});

    logger.info('Cover letter generated', { userId, resumeId: id, jobTitle: job.title });

    res.json({
      status: 'success',
      code: 200,
      data: { coverLetter, resumeId: id, jobTitle: job.title },
      traceId: req.headers['x-request-id'] || null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reset store (for testing)
 */
const _resetStore = () => {
  resumeStore.clear();
};

module.exports = {
  uploadResume,
  getResumes,
  customizeForJob,
  previewCustomization,
  deleteResume,
  generateCoverLetter,
  _resetStore,
};
