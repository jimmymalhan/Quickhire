const {
  parseSalary,
  parseExperienceYears,
  parseJobLevel,
  parseRequirements,
  parseSkills,
  generateJobHash,
  parseJobListing,
  parseJobListings,
} = require('../../../src/automation/linkedinParser');

describe('linkedinParser', () => {
  describe('parseSalary', () => {
    it('should parse range format "$80,000 - $120,000"', () => {
      const result = parseSalary('$80,000 - $120,000');
      expect(result).toEqual({ min: 80000, max: 120000 });
    });

    it('should parse range with K notation "$80K - $120K"', () => {
      const result = parseSalary('$80K - $120K');
      expect(result).toEqual({ min: 80000, max: 120000 });
    });

    it('should parse range with lowercase k "$80k - $120k"', () => {
      const result = parseSalary('$80k - $120k');
      expect(result).toEqual({ min: 80000, max: 120000 });
    });

    it('should parse range with en-dash "$90,000–$150,000"', () => {
      const result = parseSalary('$90,000–$150,000');
      expect(result).toEqual({ min: 90000, max: 150000 });
    });

    it('should parse single salary "$100,000/yr"', () => {
      const result = parseSalary('$100,000/yr');
      expect(result).toEqual({ min: 100000, max: 100000 });
    });

    it('should parse hourly rate "$50/hr"', () => {
      const result = parseSalary('$50/hr');
      expect(result).toEqual({ min: 104000, max: 104000 });
    });

    it('should parse hourly rate with "hour"', () => {
      const result = parseSalary('$60 per hour');
      expect(result).toEqual({ min: 124800, max: 124800 });
    });

    it('should return nulls for empty string', () => {
      expect(parseSalary('')).toEqual({ min: null, max: null });
    });

    it('should return nulls for null input', () => {
      expect(parseSalary(null)).toEqual({ min: null, max: null });
    });

    it('should return nulls for undefined input', () => {
      expect(parseSalary(undefined)).toEqual({ min: null, max: null });
    });

    it('should return nulls for non-salary text', () => {
      expect(parseSalary('Competitive salary')).toEqual({ min: null, max: null });
    });

    it('should parse range with "to" separator', () => {
      const result = parseSalary('$80,000 to $120,000');
      expect(result).toEqual({ min: 80000, max: 120000 });
    });

    it('should handle extra whitespace', () => {
      const result = parseSalary('  $80,000   -   $120,000  ');
      expect(result).toEqual({ min: 80000, max: 120000 });
    });

    it('should parse decimal K notation "$80.5K"', () => {
      const result = parseSalary('$80.5K');
      expect(result).toEqual({ min: 80500, max: 80500 });
    });
  });

  describe('parseExperienceYears', () => {
    it('should parse "5 years of experience"', () => {
      expect(parseExperienceYears('5 years of experience required')).toBe(5);
    });

    it('should parse "3+ years experience"', () => {
      expect(parseExperienceYears('3+ years experience')).toBe(3);
    });

    it('should parse "experience: 7 years"', () => {
      expect(parseExperienceYears('experience: 7 years')).toBe(7);
    });

    it('should parse "2 yrs experience"', () => {
      expect(parseExperienceYears('2 yrs experience')).toBe(2);
    });

    it('should parse range "3-5 years"', () => {
      expect(parseExperienceYears('3-5 years of experience')).toBe(3);
    });

    it('should return null for no match', () => {
      expect(parseExperienceYears('No experience mentioned')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(parseExperienceYears(null)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseExperienceYears('')).toBeNull();
    });

    it('should parse "10+ years of exp"', () => {
      expect(parseExperienceYears('10+ years of exp')).toBe(10);
    });

    it('should parse "exp of 8 yrs"', () => {
      expect(parseExperienceYears('exp of 8 yrs')).toBe(8);
    });
  });

  describe('parseJobLevel', () => {
    it('should detect senior level', () => {
      expect(parseJobLevel('Senior Software Engineer', '')).toBe('senior');
    });

    it('should detect senior from "Sr."', () => {
      expect(parseJobLevel('Sr. Developer', '')).toBe('senior');
    });

    it('should detect senior from "Lead"', () => {
      expect(parseJobLevel('Lead Backend Engineer', '')).toBe('senior');
    });

    it('should detect entry level', () => {
      expect(parseJobLevel('Junior Developer', '')).toBe('entry');
    });

    it('should detect entry from "Entry-Level"', () => {
      expect(parseJobLevel('Entry-Level Software Engineer', '')).toBe('entry');
    });

    it('should detect entry from "Jr."', () => {
      expect(parseJobLevel('Jr. Frontend Developer', '')).toBe('entry');
    });

    it('should detect entry from "Intern"', () => {
      expect(parseJobLevel('Software Engineering Intern', '')).toBe('entry');
    });

    it('should detect staff level', () => {
      expect(parseJobLevel('Staff Engineer', '')).toBe('staff');
    });

    it('should detect staff from "Principal"', () => {
      expect(parseJobLevel('Principal Software Engineer', '')).toBe('staff');
    });

    it('should detect staff from "Distinguished"', () => {
      expect(parseJobLevel('Distinguished Engineer', '')).toBe('staff');
    });

    it('should detect mid level from description', () => {
      expect(parseJobLevel('Software Engineer', 'mid-level position')).toBe('mid');
    });

    it('should default to mid level', () => {
      expect(parseJobLevel('Software Engineer', 'Great job opportunity')).toBe('mid');
    });

    it('should handle null title', () => {
      expect(parseJobLevel(null, 'senior position')).toBe('senior');
    });

    it('should handle null description', () => {
      expect(parseJobLevel('Junior Dev', null)).toBe('entry');
    });
  });

  describe('parseRequirements', () => {
    it('should extract requirements from bullet list', () => {
      const text = `About the role

Requirements
- 5 years of JavaScript experience
- Strong knowledge of React
- Experience with Node.js

Responsibilities
- Build features`;

      const result = parseRequirements(text);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe('5 years of JavaScript experience');
      expect(result[1]).toBe('Strong knowledge of React');
      expect(result[2]).toBe('Experience with Node.js');
    });

    it('should handle "Qualifications" header', () => {
      const text = `Qualifications
- BS in Computer Science
- 3+ years experience

Benefits
- Health insurance`;

      const result = parseRequirements(text);
      expect(result).toHaveLength(2);
    });

    it('should handle bullet points with different markers', () => {
      const text = `Requirements
* Python proficiency
• Cloud experience`;

      const result = parseRequirements(text);
      expect(result).toHaveLength(2);
    });

    it('should return empty array for no requirements', () => {
      expect(parseRequirements('Just a general description')).toEqual([]);
    });

    it('should return empty array for null input', () => {
      expect(parseRequirements(null)).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(parseRequirements('')).toEqual([]);
    });

    it('should handle "What you\'ll need" header', () => {
      const text = `What you'll need
- Strong coding skills
- Team player`;

      const result = parseRequirements(text);
      expect(result).toHaveLength(2);
    });
  });

  describe('parseSkills', () => {
    it('should extract known skills from text', () => {
      const text = 'We need someone with JavaScript, React, and Node.js experience';
      const skills = parseSkills(text);
      expect(skills).toContain('javascript');
      expect(skills).toContain('react');
    });

    it('should extract Python', () => {
      const skills = parseSkills('Python and Django required');
      expect(skills).toContain('python');
      expect(skills).toContain('django');
    });

    it('should extract cloud providers', () => {
      const skills = parseSkills('Experience with AWS and Docker');
      expect(skills).toContain('aws');
      expect(skills).toContain('docker');
    });

    it('should extract databases', () => {
      const skills = parseSkills('PostgreSQL, MongoDB, and Redis');
      expect(skills).toContain('postgresql');
      expect(skills).toContain('mongodb');
      expect(skills).toContain('redis');
    });

    it('should return empty array for null', () => {
      expect(parseSkills(null)).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(parseSkills('')).toEqual([]);
    });

    it('should deduplicate skills', () => {
      const skills = parseSkills('JavaScript javascript JAVASCRIPT');
      const jsCount = skills.filter((s) => s === 'javascript').length;
      expect(jsCount).toBe(1);
    });

    it('should extract multiple skill categories', () => {
      const text = 'Need: Python, AWS, Kubernetes, SQL, Git, Agile, REST, Linux';
      const skills = parseSkills(text);
      expect(skills.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('generateJobHash', () => {
    it('should generate consistent hash for same inputs', () => {
      const hash1 = generateJobHash('Engineer', 'Corp', 'NYC');
      const hash2 = generateJobHash('Engineer', 'Corp', 'NYC');
      expect(hash1).toBe(hash2);
    });

    it('should be case-insensitive', () => {
      const hash1 = generateJobHash('Engineer', 'Corp', 'NYC');
      const hash2 = generateJobHash('ENGINEER', 'CORP', 'NYC');
      expect(hash1).toBe(hash2);
    });

    it('should trim whitespace', () => {
      const hash1 = generateJobHash('Engineer', 'Corp', 'NYC');
      const hash2 = generateJobHash('  Engineer  ', '  Corp  ', '  NYC  ');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = generateJobHash('Engineer', 'CorpA', 'NYC');
      const hash2 = generateJobHash('Engineer', 'CorpB', 'NYC');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty strings', () => {
      const hash = generateJobHash('', '', '');
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    it('should handle null-like inputs', () => {
      const hash = generateJobHash(null, undefined, '');
      expect(hash).toBeTruthy();
    });

    it('should produce hex string', () => {
      const hash = generateJobHash('Test', 'Company', 'Location');
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('parseJobListing', () => {
    it('should parse a complete raw job listing', () => {
      const raw = {
        jobId: '12345',
        title: 'Senior Software Engineer',
        company: 'TechCo',
        location: 'San Francisco, CA',
        salary: '$120,000 - $180,000',
        description: 'We need 5 years of experience in JavaScript and React.',
        url: 'https://linkedin.com/jobs/view/12345',
        postedAt: '2024-01-15',
      };

      const result = parseJobListing(raw);

      expect(result.linkedinJobId).toBe('12345');
      expect(result.title).toBe('Senior Software Engineer');
      expect(result.company).toBe('TechCo');
      expect(result.location).toBe('San Francisco, CA');
      expect(result.salaryMin).toBe(120000);
      expect(result.salaryMax).toBe(180000);
      expect(result.jobLevel).toBe('senior');
      expect(result.experienceYears).toBe(5);
      expect(result.hash).toBeTruthy();
      expect(result.url).toBe('https://linkedin.com/jobs/view/12345');
    });

    it('should handle minimal raw data', () => {
      const raw = { title: 'Developer', company: 'Co' };
      const result = parseJobListing(raw);

      expect(result.title).toBe('Developer');
      expect(result.company).toBe('Co');
      expect(result.location).toBe('');
      expect(result.salaryMin).toBeNull();
      expect(result.salaryMax).toBeNull();
      expect(result.hash).toBeTruthy();
    });

    it('should handle empty raw data', () => {
      const result = parseJobListing({});
      expect(result.title).toBe('');
      expect(result.company).toBe('');
    });

    it('should set scrapeDate', () => {
      const result = parseJobListing({ title: 'Test', company: 'Co' });
      expect(result.scrapeDate).toBeInstanceOf(Date);
    });

    it('should extract skills from description', () => {
      const raw = {
        title: 'Dev',
        company: 'Co',
        description: 'Must know JavaScript, Python, and AWS',
      };
      const result = parseJobListing(raw);
      expect(result.skills.length).toBeGreaterThan(0);
    });

    it('should use linkedinJobId if jobId not present', () => {
      const raw = { title: 'Dev', company: 'Co', linkedinJobId: 'abc123' };
      const result = parseJobListing(raw);
      expect(result.linkedinJobId).toBe('abc123');
    });

    it('should use salaryText field as fallback', () => {
      const raw = { title: 'Dev', company: 'Co', salaryText: '$90K - $130K' };
      const result = parseJobListing(raw);
      expect(result.salaryMin).toBe(90000);
      expect(result.salaryMax).toBe(130000);
    });
  });

  describe('parseJobListings', () => {
    it('should parse multiple listings', () => {
      const raw = [
        { title: 'Engineer', company: 'A', location: 'NYC' },
        { title: 'Developer', company: 'B', location: 'LA' },
      ];
      const result = parseJobListings(raw);
      expect(result).toHaveLength(2);
    });

    it('should filter out listings without title', () => {
      const raw = [
        { title: 'Engineer', company: 'A' },
        { title: '', company: 'B' },
      ];
      const result = parseJobListings(raw);
      expect(result).toHaveLength(1);
    });

    it('should filter out listings without company', () => {
      const raw = [
        { title: 'Engineer', company: 'A' },
        { title: 'Dev', company: '' },
      ];
      const result = parseJobListings(raw);
      expect(result).toHaveLength(1);
    });

    it('should return empty array for empty input', () => {
      expect(parseJobListings([])).toEqual([]);
    });

    it('should handle mixed valid and invalid entries', () => {
      const raw = [
        { title: 'Valid', company: 'Co' },
        { title: '', company: '' },
        { title: 'Also Valid', company: 'Corp' },
        { company: 'NoTitle' },
      ];
      const result = parseJobListings(raw);
      expect(result).toHaveLength(2);
    });
  });
});
