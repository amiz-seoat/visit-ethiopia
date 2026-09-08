import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/auth';
import { getErrorMessage } from '../services/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devResetPath, setDevResetPath] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setDevResetPath('');
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      setSuccess(
        res.message ||
          'If that email exists, password reset instructions have been sent.'
      );
      if (res.resetToken) {
        setDevResetPath(`/reset-password/${res.resetToken}`);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to start password reset'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-8">
            <h1 className="text-3xl font-bold text-gray-800 text-center mb-2">
              Forgot Password
            </h1>
            <p className="text-gray-600 text-center mb-8">
              Enter your account email and we will send a reset link.
            </p>

            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 text-sm text-green-700 bg-green-50 p-3 rounded">
                <p>{success}</p>
                {devResetPath && (
                  <p className="mt-2">
                    Development reset link:{' '}
                    <Link to={devResetPath} className="underline font-medium">
                      Continue to reset password
                    </Link>
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                  placeholder="your@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-60"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <p className="mt-6 text-center text-gray-600">
              <Link to="/login" className="text-amber-600 hover:text-amber-800 font-medium">
                Back to Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
