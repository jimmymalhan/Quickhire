jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const path = require('path');
const fs = require('fs');
const os = require('os');
const { ResumeUploadHandler, ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES } = require('../../../src/automation/resumeUploadHandler');

describe('ResumeUploadHandler', () => {
  let handler;
  let tempDir;
  let tempFile;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-test-'));
    tempFile = path.join(tempDir, 'test-resume.pdf');
    fs.writeFileSync(tempFile, 'fake pdf content for testing');
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    handler = new ResumeUploadHandler();
  });

  describe('constructor', () => {
    it('uses default options', () => {
      expect(handler.allowedExtensions).toEqual(ALLOWED_EXTENSIONS);
      expect(handler.maxFileSizeBytes).toBe(MAX_FILE_SIZE_BYTES);
    });

    it('accepts custom options', () => {
      const custom = new ResumeUploadHandler({
        allowedExtensions: ['.pdf'],
        maxFileSizeBytes: 1024,
      });
      expect(custom.allowedExtensions).toEqual(['.pdf']);
      expect(custom.maxFileSizeBytes).toBe(1024);
    });
  });

  describe('validateFile', () => {
    it('validates a valid PDF file', () => {
      const result = handler.validateFile(tempFile);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects null path', () => {
      const result = handler.validateFile(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File path is required');
    });

    it('rejects non-existent file', () => {
      const result = handler.validateFile('/nonexistent/file.pdf');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('File not found');
    });

    it('rejects invalid extension', () => {
      const txtFile = path.join(tempDir, 'resume.txt');
      fs.writeFileSync(txtFile, 'text content');
      const result = handler.validateFile(txtFile);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid file type');
    });

    it('rejects empty file', () => {
      const emptyFile = path.join(tempDir, 'empty.pdf');
      fs.writeFileSync(emptyFile, '');
      const result = handler.validateFile(emptyFile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });

    it('rejects file over max size', () => {
      const smallHandler = new ResumeUploadHandler({ maxFileSizeBytes: 5 });
      const result = smallHandler.validateFile(tempFile);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('File too large');
    });

    it('accepts .doc extension', () => {
      const docFile = path.join(tempDir, 'resume.doc');
      fs.writeFileSync(docFile, 'doc content');
      const result = handler.validateFile(docFile);
      expect(result.valid).toBe(true);
    });

    it('accepts .docx extension', () => {
      const docxFile = path.join(tempDir, 'resume.docx');
      fs.writeFileSync(docxFile, 'docx content');
      const result = handler.validateFile(docxFile);
      expect(result.valid).toBe(true);
    });
  });

  describe('selectResume', () => {
    it('returns null for empty array', () => {
      expect(handler.selectResume([])).toBeNull();
    });

    it('returns null for null input', () => {
      expect(handler.selectResume(null)).toBeNull();
    });

    it('selects highest version resume', () => {
      const resumes = [
        { path: tempFile, version: 1 },
        { path: tempFile, version: 3 },
        { path: tempFile, version: 2 },
      ];
      const selected = handler.selectResume(resumes);
      expect(selected.version).toBe(3);
    });

    it('selects tagged resume matching job title', () => {
      const resumes = [
        { path: tempFile, version: 1, tags: ['backend'] },
        { path: tempFile, version: 2, tags: ['frontend'] },
      ];
      const selected = handler.selectResume(resumes, { title: 'Frontend Engineer' });
      expect(selected.tags).toContain('frontend');
    });

    it('falls back to version when no tag matches', () => {
      const resumes = [
        { path: tempFile, version: 1, tags: ['backend'] },
        { path: tempFile, version: 3, tags: ['design'] },
      ];
      const selected = handler.selectResume(resumes, { title: 'Data Scientist' });
      expect(selected.version).toBe(3);
    });

    it('skips invalid files', () => {
      const resumes = [
        { path: '/nonexistent.pdf', version: 5 },
        { path: tempFile, version: 1 },
      ];
      const selected = handler.selectResume(resumes);
      expect(selected.version).toBe(1);
    });
  });

  describe('prepareUpload', () => {
    it('prepares valid file for upload', () => {
      const upload = handler.prepareUpload(tempFile);
      expect(upload.filePath).toBe(tempFile);
      expect(upload.fileName).toBe('test-resume.pdf');
      expect(upload.mimeType).toBe('application/pdf');
      expect(upload.size).toBeGreaterThan(0);
      expect(upload.extension).toBe('.pdf');
      expect(typeof upload.readStream).toBe('function');
    });

    it('throws for invalid file', () => {
      expect(() => handler.prepareUpload('/nonexistent.pdf')).toThrow('validation failed');
    });

    it('returns correct mime type for .doc', () => {
      const docFile = path.join(tempDir, 'resume.doc');
      fs.writeFileSync(docFile, 'doc content');
      const upload = handler.prepareUpload(docFile);
      expect(upload.mimeType).toBe('application/msword');
    });

    it('returns correct mime type for .docx', () => {
      const docxFile = path.join(tempDir, 'resume.docx');
      fs.writeFileSync(docxFile, 'docx content');
      const upload = handler.prepareUpload(docxFile);
      expect(upload.mimeType).toContain('openxmlformats');
    });
  });

  describe('getMetadata', () => {
    it('returns metadata for existing file', () => {
      const meta = handler.getMetadata(tempFile);
      expect(meta.filePath).toBe(tempFile);
      expect(meta.fileName).toBe('test-resume.pdf');
      expect(meta.extension).toBe('.pdf');
      expect(meta.size).toBeGreaterThan(0);
      expect(meta.sizeFormatted).toContain('KB');
      expect(meta.lastModified.getTime).toBeDefined();
    });

    it('returns null for non-existent file', () => {
      expect(handler.getMetadata('/nonexistent.pdf')).toBeNull();
    });

    it('returns null for null path', () => {
      expect(handler.getMetadata(null)).toBeNull();
    });
  });

  describe('constants', () => {
    it('exports ALLOWED_EXTENSIONS', () => {
      expect(ALLOWED_EXTENSIONS).toEqual(['.pdf', '.doc', '.docx']);
    });

    it('exports MAX_FILE_SIZE_BYTES', () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
    });
  });
});
