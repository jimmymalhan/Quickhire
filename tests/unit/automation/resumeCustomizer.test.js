jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { ResumeCustomizer } = require('../../../src/automation/resumeCustomizer');

describe('ResumeCustomizer', () => {
  let customizer;
  let resume;
  let job;

  beforeEach(() => {
    customizer = new ResumeCustomizer();
    resume = {
      summary: 'Backend engineer focused on APIs.',
      contact: { name: 'Jimmy' },
      skills: ['Node.js', 'React', 'PostgreSQL'],
      experience: [
        {
          title: 'Senior Backend Engineer',
          company: 'Acme',
          duration: '2019 - Present',
          description: ['Built Node.js services', 'Led PostgreSQL migrations'],
        },
        {
          title: 'Frontend Engineer',
          company: 'Beta',
          duration: '2016 - 2019',
          description: ['Built React dashboards'],
        },
      ],
      education: [{ degree: 'Bachelor of Science' }],
    };
    job = {
      id: 'job-1',
      title: 'Backend Engineer',
      company: 'Example',
      description: 'Looking for Node.js, PostgreSQL, Docker and leadership experience',
      requirements: ['Leadership', 'REST APIs'],
      skills: ['Node.js', 'PostgreSQL', 'Docker'],
      job_level: 'senior',
    };
  });

  it('customizes a resume with keywords, summary and fit score', () => {
    const result = customizer.customize(resume, job);

    expect(result.summary).toContain('Backend Engineer');
    expect(result.customization.jobId).toBe('job-1');
    expect(result.customization.matchedSkills).toContain('node.js');
    expect(result.customization.fitScore.overall).toBeGreaterThan(0);
  });

  it('rejects invalid resume and job inputs', () => {
    expect(() => customizer.customize(null, job)).toThrow('Resume is required');
    expect(() => customizer.customize(resume, null)).toThrow('Job posting is required');
  });

  it('extracts keywords from description, requirements and skills', () => {
    const keywords = customizer.extractKeywords(job);

    expect(keywords).toEqual(
      expect.arrayContaining(['node.js', 'postgresql', 'docker', 'leadership', 'rest apis']),
    );
  });

  it('matches skills using resume skills and experience text', () => {
    const match = customizer.matchSkills(resume, ['Node.js', 'Docker', 'leadership']);

    expect(match.matched).toContain('Node.js');
    expect(match.missing).toContain('Docker');
    expect(match.score).toBeGreaterThan(0);
  });

  it('returns zero match score for empty inputs', () => {
    expect(customizer.matchSkills(null, ['Node.js'])).toEqual({
      matched: [],
      missing: [],
      score: 0,
    });
  });

  it('reorders experience and matched skills to the front', () => {
    const reordered = customizer.reorderSections(resume, job, {
      matched: ['Node.js', 'PostgreSQL'],
    });

    expect(reordered.experience[0].title).toBe('Senior Backend Engineer');
    expect(reordered.skills[0]).toBe('Node.js');
  });

  it('generates a fallback summary when no summary or matched skills exist', () => {
    const result = customizer.generateSummary(
      { summary: '', experience: [], education: [] },
      { title: 'Platform Engineer', company: 'Acme' },
      { matched: [] },
    );

    expect(result).toBe('Experienced professional seeking Platform Engineer role at Acme.');
  });

  it('estimates years of experience from durations', () => {
    const years = customizer._estimateYears(resume.experience);
    expect(years).toBeGreaterThanOrEqual(8);
  });

  it('scores fit using skills, experience and education', () => {
    const score = customizer.scoreFit(resume, job, { score: 70 });

    expect(score.skills).toBe(70);
    expect(score.experience).toBe(100);
    expect(score.education).toBe(90);
    expect(score.overall).toBeGreaterThan(70);
  });

  it('returns zero scores when resume or job is missing', () => {
    expect(customizer.scoreFit(null, job, null)).toEqual({
      overall: 0,
      skills: 0,
      experience: 0,
      education: 0,
    });
  });

  it('generates a professional cover letter and a casual variant', () => {
    const professional = customizer.generateCoverLetter(resume, job);
    const casual = customizer.generateCoverLetter(resume, job, { tone: 'casual' });

    expect(professional).toContain('Dear Hiring Manager,');
    expect(professional).toContain('Backend Engineer');
    expect(casual).toContain('Hi there,');
    expect(casual).toContain('Jimmy');
  });

  it('rejects invalid cover letter inputs', () => {
    expect(() => customizer.generateCoverLetter(null, job)).toThrow('Resume is required');
    expect(() => customizer.generateCoverLetter(resume, null)).toThrow('Job posting is required');
  });
});
