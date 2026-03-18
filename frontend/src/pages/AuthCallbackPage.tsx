import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { handleAuthCallback } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('LinkedIn authentication was denied');
      return;
    }

    if (!code) {
      setError('No authorization code received');
      return;
    }

    handleAuthCallback(code)
      .then(() => navigate('/', { replace: true }))
      .catch(() => setError('Authentication failed. Please try again.'));
  }, [searchParams, handleAuthCallback, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900" role="alert">
        <div className="card max-w-md text-center">
          <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
            Authentication Error
          </h1>
          <p className="mb-4 text-gray-600 dark:text-gray-400">{error}</p>
          <button className="btn-primary" onClick={() => navigate('/login')}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Completing sign in...
        </p>
      </div>
    </div>
  );
}

export default AuthCallbackPage;
