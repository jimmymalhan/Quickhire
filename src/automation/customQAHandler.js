/**
 * Custom Q&A Handler
 * Matches LinkedIn Easy Apply custom questions to user-provided answers.
 * Answers loaded from config/qa-answers.json (user-editable).
 */
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '../../config/qa-answers.json');

class CustomQAHandler {
  constructor(options = {}) {
    this.configPath = options.configPath || DEFAULT_CONFIG_PATH;
    this.answers = [];
    this.fallback = 'skip';
    this._loaded = false;
  }

  /**
   * Load answers from config file. Silently skips if file missing.
   * @param {string} [filePath] - Override config path
   */
  loadFromFile(filePath) {
    const target = filePath || this.configPath;
    try {
      const raw = fs.readFileSync(target, 'utf8');
      const config = JSON.parse(raw);
      this.answers = Array.isArray(config.answers) ? config.answers : [];
      this.fallback = config.fallback || 'skip';
      this._loaded = true;
      logger.debug('Q&A answers loaded', { count: this.answers.length, path: target });
    } catch (err) {
      logger.warn('Q&A config not loaded, using empty answers', { path: target, error: err.message });
      this.answers = [];
      this._loaded = true;
    }
  }

  /**
   * Find the best matching answer entry for a question.
   * @param {string} questionText
   * @returns {Object|null} matched answer entry or null
   */
  findAnswer(questionText) {
    if (!this._loaded) {
      this.loadFromFile();
    }

    if (!questionText || !Array.isArray(this.answers) || this.answers.length === 0) {
      return null;
    }

    const q = questionText.toLowerCase().trim();

    for (const entry of this.answers) {
      if (!entry.pattern) continue;
      const mode = entry.matchMode || 'contains';

      if (mode === 'exact' && q === entry.pattern.toLowerCase().trim()) {
        return entry;
      }

      if (mode === 'contains' && q.includes(entry.pattern.toLowerCase().trim())) {
        return entry;
      }

      if (mode === 'regex') {
        try {
          const re = new RegExp(entry.pattern, 'i');
          if (re.test(questionText)) {
            return entry;
          }
        } catch (err) {
          logger.warn('Invalid regex in Q&A config', { pattern: entry.pattern });
        }
      }
    }

    return null;
  }

  /**
   * Answer a LinkedIn question.
   * @param {string} questionText
   * @param {string} [fieldType] - 'text'|'numeric'|'boolean'|'select'
   * @returns {string|boolean|null} formatted answer or null if no match
   */
  answerQuestion(questionText, fieldType) {
    const entry = this.findAnswer(questionText);

    if (!entry) {
      if (this.fallback === 'skip') {
        return null;
      }
      return null;
    }

    const type = fieldType || entry.type || 'text';
    const raw = entry.value;

    if (type === 'boolean') {
      return raw === 'yes' || raw === 'true' || raw === true;
    }

    if (type === 'numeric') {
      return String(parseInt(raw, 10) || raw);
    }

    return String(raw);
  }
}

module.exports = { CustomQAHandler };
