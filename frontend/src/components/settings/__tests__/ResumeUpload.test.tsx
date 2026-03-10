import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/testUtils';
import ResumeUpload from '../ResumeUpload';

vi.mock('../../../services/settingsService', () => ({
  settingsService: {
    uploadResume: vi.fn(),
  },
}));

import { settingsService } from '../../../services/settingsService';

const mockedUpload = vi.mocked(settingsService.uploadResume);

describe('ResumeUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders heading', () => {
    render(<ResumeUpload />);
    expect(screen.getByText('Resume / CV')).toBeInTheDocument();
  });

  it('renders upload description', () => {
    render(<ResumeUpload />);
    expect(screen.getByText(/Upload your resume/)).toBeInTheDocument();
  });

  it('renders Upload Resume button', () => {
    render(<ResumeUpload />);
    expect(screen.getByText('Upload Resume')).toBeInTheDocument();
  });

  it('accepts pdf files', () => {
    render(<ResumeUpload />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('.pdf,.doc,.docx');
  });

  it('shows error for invalid file type', async () => {
    render(<ResumeUpload />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Please upload a PDF or Word document.')).toBeInTheDocument();
    });
  });

  it('shows error for oversized file', async () => {
    render(<ResumeUpload />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const largeContent = new Uint8Array(6 * 1024 * 1024);
    const file = new File([largeContent], 'resume.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('File size must be under 5MB.')).toBeInTheDocument();
    });
  });

  it('uploads valid PDF file', async () => {
    mockedUpload.mockResolvedValue({ url: '/uploads/resume.pdf', version: 3 });
    render(<ResumeUpload />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Resume uploaded (version 3).')).toBeInTheDocument();
    });
  });

  it('shows error on upload failure', async () => {
    mockedUpload.mockRejectedValue(new Error('network'));
    render(<ResumeUpload />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Failed to upload resume.')).toBeInTheDocument();
    });
  });

  it('accepts Word documents', async () => {
    mockedUpload.mockResolvedValue({ url: '/uploads/resume.docx', version: 1 });
    render(<ResumeUpload />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['docx'], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Resume uploaded (version 1).')).toBeInTheDocument();
    });
  });
});
