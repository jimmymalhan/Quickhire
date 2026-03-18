/**
 * Resume Upload Handler
 * Manages resume file validation, selection, and upload preparation
 */
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

class ResumeUploadHandler {
  constructor(options = {}) {
    this.allowedExtensions = options.allowedExtensions || ALLOWED_EXTENSIONS;
    this.maxFileSizeBytes = options.maxFileSizeBytes || MAX_FILE_SIZE_BYTES;
    this.resumeDirectory = options.resumeDirectory || null;
  }

  /**
   * Validate a resume file
   * @param {string} filePath - Path to the resume file
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateFile(filePath) {
    const errors = [];

    if (!filePath) {
      errors.push('File path is required');
      return { valid: false, errors };
    }

    // Check extension
    const ext = path.extname(filePath).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      errors.push(`Invalid file type: ${ext}. Allowed: ${this.allowedExtensions.join(', ')}`);
    }

    // Check file exists
    if (!fs.existsSync(filePath)) {
      errors.push(`File not found: ${filePath}`);
      return { valid: false, errors };
    }

    // Check file size
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      errors.push('File is empty');
    }
    if (stats.size > this.maxFileSizeBytes) {
      errors.push(
        `File too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB. Max: ${(this.maxFileSizeBytes / 1024 / 1024).toFixed(2)}MB`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Select the best resume for a job application
   * @param {Array<{path: string, version: number, tags: string[]}>} resumes
   * @param {Object} job - Job details for matching
   * @returns {Object|null} Selected resume or null
   */
  selectResume(resumes, job = {}) {
    if (!resumes || resumes.length === 0) {
      logger.warn('No resumes available for selection');
      return null;
    }

    // Filter to valid resumes
    const validResumes = resumes.filter((r) => {
      const validation = this.validateFile(r.path);
      return validation.valid;
    });

    if (validResumes.length === 0) {
      logger.warn('No valid resumes found');
      return null;
    }

    // If job has tags/keywords, try to find a matching tagged resume
    if (job.title && validResumes.some((r) => r.tags && r.tags.length > 0)) {
      const jobTitleLower = job.title.toLowerCase();
      const tagged = validResumes.find(
        (r) => r.tags && r.tags.some((tag) => jobTitleLower.includes(tag.toLowerCase())),
      );
      if (tagged) {
        logger.debug('Selected tagged resume', { path: tagged.path, tags: tagged.tags });
        return tagged;
      }
    }

    // Default: return highest version
    const sorted = [...validResumes].sort((a, b) => (b.version || 0) - (a.version || 0));
    const selected = sorted[0];
    logger.debug('Selected resume by version', { path: selected.path, version: selected.version });
    return selected;
  }

  /**
   * Prepare resume for upload (read file, build metadata)
   * @param {string} filePath
   * @returns {Object} Upload payload
   */
  prepareUpload(filePath) {
    const validation = this.validateFile(filePath);
    if (!validation.valid) {
      throw new Error(`Resume validation failed: ${validation.errors.join('; ')}`);
    }

    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    return {
      filePath,
      fileName: path.basename(filePath),
      mimeType: mimeTypes[ext] || 'application/octet-stream',
      size: stats.size,
      extension: ext,
      readStream: () => fs.createReadStream(filePath),
    };
  }

  /**
   * Get resume metadata without reading file content
   * @param {string} filePath
   * @returns {Object} metadata
   */
  getMetadata(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    return {
      filePath,
      fileName: path.basename(filePath),
      extension: path.extname(filePath).toLowerCase(),
      size: stats.size,
      sizeFormatted: `${(stats.size / 1024).toFixed(1)}KB`,
      lastModified: stats.mtime,
    };
  }
}

module.exports = { ResumeUploadHandler, ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES };
