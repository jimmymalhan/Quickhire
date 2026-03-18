jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { ResumeParser } = require('../../../src/automation/resumeParser');

describe('ResumeParser', () => {
  let parser;

  beforeEach(() => {
    parser = new ResumeParser();
  });

  describe('parse', () => {
    it('parses json strings and objects', () => {
      expect(
        parser.parse(
          JSON.stringify({
            contact: { name: 'Jimmy' },
            experience: [{ title: 'Engineer' }],
            skills: ['Node.js'],
          }),
          'json',
        ),
      ).toEqual(
        expect.objectContaining({
          contact: { name: 'Jimmy' },
          experience: [{ title: 'Engineer' }],
          skills: ['Node.js'],
        }),
      );

      expect(
        parser.parse(
          { contact: { name: 'Jimmy' }, experience: [], skills: [] },
          'json',
        ),
      ).toEqual(
        expect.objectContaining({
          contact: { name: 'Jimmy' },
        }),
      );
    });

    it('parses text resumes into sections', () => {
      const text = `
CONTACT
Jimmy Malhan
jimmy@example.com
+1 555 111 2222
linkedin.com/in/jimmymalhan

PROFESSIONAL SUMMARY
Backend engineer building APIs.

EXPERIENCE
Senior Backend Engineer
Acme
2019 - Present
- Built Node.js services

EDUCATION
Bachelor of Science
State University
2016

SKILLS
Node.js, PostgreSQL, Docker

CERTIFICATIONS
- AWS Certified Developer
`;

      const result = parser.parse(text, 'text');

      expect(result.contact).toEqual(
        expect.objectContaining({
          name: 'Jimmy Malhan',
          email: 'jimmy@example.com',
          linkedin: 'linkedin.com/in/jimmymalhan',
        }),
      );
      expect(result.summary).toContain('Backend engineer');
      expect(result.experience[0]).toEqual(
        expect.objectContaining({
          title: 'Senior Backend Engineer',
          company: 'Acme',
        }),
      );
      expect(result.skills).toEqual(
        expect.arrayContaining(['Node.js', 'PostgreSQL', 'Docker']),
      );
      expect(result.certifications).toContain('AWS Certified Developer');
    });

    it('rejects missing content and unsupported formats', () => {
      expect(() => parser.parse('', 'json')).toThrow('Resume content is required');
      expect(() => parser.parse('{}', 'pdf')).toThrow('Unsupported resume format');
    });

    it('rejects invalid json content and bad text input', () => {
      expect(() => parser.parse('{bad json}', 'json')).toThrow('Invalid JSON format');
      expect(() => parser._parseText({})).toThrow('Text format requires a string input');
      expect(() => parser._parseJSON(42)).toThrow('Resume content must be a JSON string or object');
    });
  });

  describe('section helpers', () => {
    it('detects known section headers', () => {
      expect(parser._detectSection('Contact Information')).toBe('contact');
      expect(parser._detectSection('Professional Summary')).toBe('summary');
      expect(parser._detectSection('Work Experience')).toBe('experience');
      expect(parser._detectSection('Technical Skills')).toBe('skills');
      expect(parser._detectSection('a very long line that is definitely not a section header because it exceeds the supported size')).toBeNull();
      expect(parser._detectSection('')).toBeNull();
    });

    it('parses contact text blocks', () => {
      const result = parser._parseContactText(
        'Jimmy Malhan\njimmy@example.com\n+1 555 111 2222\nlinkedin.com/in/jimmymalhan',
      );
      expect(result).toEqual(
        expect.objectContaining({
          name: 'Jimmy Malhan',
          email: 'jimmy@example.com',
          phone: '+1 555 111 2222',
          linkedin: 'linkedin.com/in/jimmymalhan',
        }),
      );
    });

    it('parses experience, education, skills, and certifications text', () => {
      expect(
        parser._parseExperienceText(
          'Senior Engineer\nAcme\n2019 - Present\n- Built APIs\nMentored team',
        )[0],
      ).toEqual(
        expect.objectContaining({
          title: 'Senior Engineer',
          company: 'Acme',
          duration: '2019 - Present',
          description: ['Built APIs', 'Mentored team'],
        }),
      );

      expect(
        parser._parseEducationText('Bachelor of Science\nState University\n2016')[0],
      ).toEqual(
        expect.objectContaining({
          degree: 'Bachelor of Science',
          institution: 'State University',
          year: '2016',
        }),
      );

      expect(parser._parseSkillsText('Node.js, PostgreSQL\nDocker|Node.js')).toEqual([
        'Node.js',
        'PostgreSQL',
        'Docker',
      ]);

      expect(parser._parseCertificationsText('- AWS\n* GCP')).toEqual(['AWS', 'GCP']);
    });
  });

  describe('normalization and conversion', () => {
    it('normalizes missing fields into standard shape', () => {
      expect(parser._normalize({})).toEqual({
        contact: {},
        summary: '',
        experience: [],
        education: [],
        skills: [],
        certifications: [],
      });
    });

    it('converts resumes to json and text', () => {
      const resume = {
        contact: {
          name: 'Jimmy',
          email: 'jimmy@example.com',
          location: 'Remote',
        },
        summary: 'Backend engineer',
        experience: [
          {
            title: 'Engineer',
            company: 'Acme',
            duration: '2019 - Present',
            description: ['Built APIs'],
          },
        ],
        education: [{ degree: 'BS', institution: 'State', year: '2016' }],
        skills: ['Node.js', 'Docker'],
        certifications: ['AWS'],
      };

      expect(parser.toJSON(resume)).toEqual(expect.objectContaining({ skills: ['Node.js', 'Docker'] }));

      const text = parser.toText(resume);
      expect(text).toContain('CONTACT');
      expect(text).toContain('PROFESSIONAL SUMMARY');
      expect(text).toContain('EXPERIENCE');
      expect(text).toContain('EDUCATION');
      expect(text).toContain('SKILLS');
      expect(text).toContain('CERTIFICATIONS');
    });

    it('rejects invalid objects for conversion', () => {
      expect(() => parser.toJSON(null)).toThrow('Invalid resume object');
      expect(() => parser.toText(null)).toThrow('Invalid resume object');
    });
  });

  describe('validate', () => {
    it('accepts a valid resume', () => {
      expect(
        parser.validate({
          contact: { name: 'Jimmy' },
          experience: [{ title: 'Engineer' }],
          skills: ['Node.js'],
        }),
      ).toEqual({ valid: true, errors: [] });
    });

    it('rejects invalid resume shapes and missing required sections', () => {
      expect(parser.validate(null)).toEqual({
        valid: false,
        errors: ['Resume must be a valid object'],
      });

      const result = parser.validate({
        contact: {},
        experience: [],
        skills: [],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Contact section must contain at least one field (name, email, phone)',
          'Experience section must contain at least one entry',
          'Skills section must contain at least one skill',
        ]),
      );
    });
  });
});
