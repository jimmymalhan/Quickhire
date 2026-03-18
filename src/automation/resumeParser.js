/**
 * Resume Parser - Parse and convert resume data between formats
 * Supports JSON and plain text formats with validation
 */
const logger = require('../utils/logger');
const { AppError, ERROR_CODES } = require('../utils/errorCodes');

const REQUIRED_SECTIONS = ['contact', 'experience', 'skills'];

const SECTION_HEADERS = {
  contact: /^(contact\s*(info(rmation)?)?|personal\s*(info(rmation)?)?)/i,
  summary: /^(summary|professional\s*summary|objective|profile|about)/i,
  experience: /^(experience|work\s*experience|employment|work\s*history|professional\s*experience)/i,
  education: /^(education|academic|qualifications)/i,
  skills: /^(skills|technical\s*skills|core\s*competencies|competencies|technologies)/i,
  certifications: /^(certifications?|licenses?|credentials)/i,
};

class ResumeParser {
  /**
   * Parse resume content into standard JSON format
   * @param {string|Object} content - Resume content (text string or JSON object)
   * @param {string} format - Content format: 'json' or 'text'
   * @returns {Object} Parsed resume in standard JSON format
   */
  parse(content, format = 'json') {
    if (!content) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Resume content is required');
    }

    const normalizedFormat = format.toLowerCase().trim();

    if (normalizedFormat === 'json') {
      return this._parseJSON(content);
    }

    if (normalizedFormat === 'text') {
      return this._parseText(content);
    }

    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      `Unsupported resume format: ${format}. Supported formats: json, text`,
    );
  }

  /**
   * Parse JSON resume content
   * @param {string|Object} content - JSON string or object
   * @returns {Object} Standardized resume object
   */
  _parseJSON(content) {
    let data;
    if (typeof content === 'string') {
      try {
        data = JSON.parse(content);
      } catch (err) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid JSON format in resume content');
      }
    } else if (typeof content === 'object' && content !== null) {
      data = content;
    } else {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Resume content must be a JSON string or object');
    }

    return this._normalize(data);
  }

  /**
   * Parse plain text resume into structured format
   * @param {string} content - Plain text resume
   * @returns {Object} Standardized resume object
   */
  _parseText(content) {
    if (typeof content !== 'string') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Text format requires a string input');
    }

    const lines = content.split('\n').map((line) => line.trim());
    const resume = {
      contact: {},
      summary: '',
      experience: [],
      education: [],
      skills: [],
      certifications: [],
    };

    let currentSection = null;
    let currentBuffer = [];

    const flushBuffer = () => {
      if (!currentSection || currentBuffer.length === 0) {
        currentBuffer = [];
        return;
      }

      const text = currentBuffer.join('\n').trim();

      if (currentSection === 'contact') {
        resume.contact = this._parseContactText(text);
      } else if (currentSection === 'summary') {
        resume.summary = text;
      } else if (currentSection === 'experience') {
        resume.experience = this._parseExperienceText(text);
      } else if (currentSection === 'education') {
        resume.education = this._parseEducationText(text);
      } else if (currentSection === 'skills') {
        resume.skills = this._parseSkillsText(text);
      } else if (currentSection === 'certifications') {
        resume.certifications = this._parseCertificationsText(text);
      }

      currentBuffer = [];
    };

    for (const line of lines) {
      const detectedSection = this._detectSection(line);
      if (detectedSection) {
        flushBuffer();
        currentSection = detectedSection;
        continue;
      }

      if (currentSection && line.length > 0) {
        currentBuffer.push(line);
      }
    }

    flushBuffer();

    logger.debug('Parsed text resume', {
      sections: Object.keys(resume).filter((k) => {
        const val = resume[k];
        if (Array.isArray(val)) {return val.length > 0;}
        if (typeof val === 'object') {return Object.keys(val).length > 0;}
        return val && val.length > 0;
      }),
    });

    return resume;
  }

  /**
   * Detect which section a line represents
   * @param {string} line - A line of text
   * @returns {string|null} Section name or null
   */
  _detectSection(line) {
    const cleaned = line.replace(/[:#\-=_*]/g, '').trim();
    if (cleaned.length === 0 || cleaned.length > 50) {return null;}

    for (const [section, pattern] of Object.entries(SECTION_HEADERS)) {
      if (pattern.test(cleaned)) {
        return section;
      }
    }

    return null;
  }

  /**
   * Parse contact info from text block
   * @param {string} text - Contact section text
   * @returns {Object} Contact info
   */
  _parseContactText(text) {
    const contact = {};
    const lines = text.split('\n');

    const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
    if (emailMatch) {contact.email = emailMatch[0];}

    const phoneMatch = text.match(/[\+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,}/);
    if (phoneMatch) {contact.phone = phoneMatch[0].trim();}

    const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);
    if (linkedinMatch) {contact.linkedin = linkedinMatch[0];}

    // First non-empty line that is not email/phone is likely the name
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.length > 0 &&
        !trimmed.includes('@') &&
        !/^[+]?[(]?[0-9]/.test(trimmed) &&
        !/linkedin/i.test(trimmed) &&
        !/http/i.test(trimmed)
      ) {
        contact.name = trimmed;
        break;
      }
    }

    return contact;
  }

  /**
   * Parse experience entries from text
   * @param {string} text - Experience section text
   * @returns {Array} Experience entries
   */
  _parseExperienceText(text) {
    const entries = [];
    const blocks = text.split(/\n(?=\S)/).filter((b) => b.trim().length > 0);

    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length === 0) {continue;}

      const entry = {
        title: lines[0] || '',
        company: lines.length > 1 ? lines[1] : '',
        duration: '',
        description: [],
      };

      for (let i = 1; i < lines.length; i++) {
        const dateMatch = lines[i].match(/\d{4}\s*[-–]\s*(\d{4}|present|current)/i);
        if (dateMatch) {
          entry.duration = lines[i];
        } else if (lines[i].startsWith('-') || lines[i].startsWith('*')) {
          entry.description.push(lines[i].replace(/^[-*]\s*/, ''));
        } else if (!entry.company) {
          entry.company = lines[i];
        } else {
          entry.description.push(lines[i]);
        }
      }

      entries.push(entry);
    }

    return entries;
  }

  /**
   * Parse education entries from text
   * @param {string} text - Education section text
   * @returns {Array} Education entries
   */
  _parseEducationText(text) {
    const entries = [];
    const blocks = text.split(/\n(?=\S)/).filter((b) => b.trim().length > 0);

    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length === 0) {continue;}

      entries.push({
        degree: lines[0] || '',
        institution: lines.length > 1 ? lines[1] : '',
        year: lines.length > 2 ? lines[2] : '',
      });
    }

    return entries;
  }

  /**
   * Parse skills from text (comma, pipe, or newline separated)
   * @param {string} text - Skills section text
   * @returns {Array<string>} Skills list
   */
  _parseSkillsText(text) {
    const skills = text
      .split(/[,|\n]/)
      .map((s) => s.replace(/^[-*]\s*/, '').trim())
      .filter((s) => s.length > 0 && s.length < 100);

    return [...new Set(skills)];
  }

  /**
   * Parse certifications from text
   * @param {string} text - Certifications section text
   * @returns {Array<string>} Certifications list
   */
  _parseCertificationsText(text) {
    return text
      .split('\n')
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter((line) => line.length > 0);
  }

  /**
   * Normalize a resume object into standard format
   * @param {Object} data - Raw resume data
   * @returns {Object} Normalized resume
   */
  _normalize(data) {
    return {
      contact: data.contact || {},
      summary: data.summary || '',
      experience: Array.isArray(data.experience) ? data.experience : [],
      education: Array.isArray(data.education) ? data.education : [],
      skills: Array.isArray(data.skills) ? data.skills : [],
      certifications: Array.isArray(data.certifications) ? data.certifications : [],
    };
  }

  /**
   * Convert resume to standard JSON format
   * @param {Object} resume - Resume object
   * @returns {Object} JSON-serializable resume
   */
  toJSON(resume) {
    if (!resume || typeof resume !== 'object') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid resume object');
    }

    return this._normalize(resume);
  }

  /**
   * Convert resume to plain text format
   * @param {Object} resume - Resume object
   * @returns {string} Plain text resume
   */
  toText(resume) {
    if (!resume || typeof resume !== 'object') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid resume object');
    }

    const sections = [];

    // Contact
    if (resume.contact && Object.keys(resume.contact).length > 0) {
      const contactLines = [];
      if (resume.contact.name) {contactLines.push(resume.contact.name);}
      if (resume.contact.email) {contactLines.push(resume.contact.email);}
      if (resume.contact.phone) {contactLines.push(resume.contact.phone);}
      if (resume.contact.linkedin) {contactLines.push(resume.contact.linkedin);}
      if (resume.contact.location) {contactLines.push(resume.contact.location);}
      if (contactLines.length > 0) {
        sections.push('CONTACT\n' + contactLines.join('\n'));
      }
    }

    // Summary
    if (resume.summary) {
      sections.push('PROFESSIONAL SUMMARY\n' + resume.summary);
    }

    // Experience
    if (Array.isArray(resume.experience) && resume.experience.length > 0) {
      const expLines = resume.experience.map((exp) => {
        const parts = [];
        if (exp.title) {parts.push(exp.title);}
        if (exp.company) {parts.push(exp.company);}
        if (exp.duration) {parts.push(exp.duration);}
        if (Array.isArray(exp.description)) {
          exp.description.forEach((d) => parts.push(`- ${d}`));
        } else if (exp.description) {
          parts.push(`- ${exp.description}`);
        }
        return parts.join('\n');
      });
      sections.push('EXPERIENCE\n' + expLines.join('\n\n'));
    }

    // Education
    if (Array.isArray(resume.education) && resume.education.length > 0) {
      const eduLines = resume.education.map((edu) => {
        const parts = [];
        if (edu.degree) {parts.push(edu.degree);}
        if (edu.institution) {parts.push(edu.institution);}
        if (edu.year) {parts.push(edu.year);}
        return parts.join('\n');
      });
      sections.push('EDUCATION\n' + eduLines.join('\n\n'));
    }

    // Skills
    if (Array.isArray(resume.skills) && resume.skills.length > 0) {
      sections.push('SKILLS\n' + resume.skills.join(', '));
    }

    // Certifications
    if (Array.isArray(resume.certifications) && resume.certifications.length > 0) {
      sections.push('CERTIFICATIONS\n' + resume.certifications.map((c) => `- ${c}`).join('\n'));
    }

    return sections.join('\n\n');
  }

  /**
   * Validate that a resume has required fields
   * @param {Object} resume - Resume object to validate
   * @returns {{ valid: boolean, errors: string[] }} Validation result
   */
  validate(resume) {
    const errors = [];

    if (!resume || typeof resume !== 'object') {
      return { valid: false, errors: ['Resume must be a valid object'] };
    }

    // Check required sections exist and have content
    for (const section of REQUIRED_SECTIONS) {
      if (!resume[section]) {
        errors.push(`Missing required section: ${section}`);
        continue;
      }

      if (section === 'contact') {
        if (typeof resume.contact !== 'object' || Object.keys(resume.contact).length === 0) {
          errors.push('Contact section must contain at least one field (name, email, phone)');
        }
      }

      if (section === 'experience') {
        if (!Array.isArray(resume.experience) || resume.experience.length === 0) {
          errors.push('Experience section must contain at least one entry');
        }
      }

      if (section === 'skills') {
        if (!Array.isArray(resume.skills) || resume.skills.length === 0) {
          errors.push('Skills section must contain at least one skill');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

module.exports = { ResumeParser };
