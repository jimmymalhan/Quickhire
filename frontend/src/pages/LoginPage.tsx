import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const { isAuthenticated, login } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="card w-full max-w-md text-center">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
          Quickhire
        </h1>
        <p className="mb-8 text-gray-600 dark:text-gray-400">
          Automate your job applications on LinkedIn
        </p>
        <button
          onClick={login}
          className="btn-primary w-full gap-2 py-3 text-base"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          Sign in with LinkedIn
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
