import { useState, useRef } from 'react';
import { settingsService } from '../../services/settingsService';

function ResumeUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!validTypes.includes(file.type)) {
      setMessage('Please upload a PDF or Word document.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage('File size must be under 5MB.');
      return;
    }

    setIsUploading(true);
    setMessage('');
    try {
      const result = await settingsService.uploadResume(file);
      setMessage(`Resume uploaded (version ${result.version}).`);
    } catch {
      setMessage('Failed to upload resume.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="card">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Resume / CV
      </h3>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        Upload your resume (PDF or Word, max 5MB).
      </p>
      <label className="btn-secondary inline-flex cursor-pointer items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleUpload}
          className="sr-only"
          disabled={isUploading}
        />
        {isUploading ? 'Uploading...' : 'Upload Resume'}
      </label>
      {message && (
        <p className={`mt-3 text-sm ${message.includes('Failed') || message.includes('Please') ? 'text-red-600' : 'text-green-600'}`} role="status">
          {message}
        </p>
      )}
    </div>
  );
}

export default ResumeUpload;
