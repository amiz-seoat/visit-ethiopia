import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/api";
import { isEmailNotVerifiedError } from "../api/auth";
import { VerifyEmailNotice } from "../components/auth/VerifyEmailNotice";

const inputCls =
  "w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const params = new URLSearchParams(location.search);
  const redirectParam = params.get("redirect");
  // Only allow same-site relative paths (prevent open redirects).
  const safeRedirect =
    redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : null;
  // After sign-in, go back to where the user came from, otherwise the home page.
  const from = (location.state as { from?: string })?.from || safeRedirect || "/";
  const verifiedParam = params.get("verified");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setUnverifiedEmail("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (isEmailNotVerifiedError(err)) {
        setUnverifiedEmail(email.trim());
      } else {
        setError(getErrorMessage(err, "Something went wrong. Try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-md mx-auto bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-hidden border border-transparent dark:border-gray-800">
          <div className="px-6 py-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Welcome Back</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Sign in to your Visit Ethiopia account</p>
            </div>

            {verifiedParam === "1" && !error && !unverifiedEmail && (
              <div className="mb-4 text-sm text-green-800 bg-green-100 dark:bg-green-950/50 dark:text-green-200 p-3 rounded" role="status">
                Your email is verified. You can now sign in.
              </div>
            )}
            {verifiedParam === "0" && !error && !unverifiedEmail && (
              <div className="mb-4 text-sm text-red-700 bg-red-100 dark:bg-red-950/50 dark:text-red-200 p-3 rounded" role="alert">
                That verification link is invalid or has expired. Enter your email and password below to request a new one.
              </div>
            )}

            {unverifiedEmail && (
              <VerifyEmailNotice
                email={unverifiedEmail}
                title="Please verify your email first"
                intro="Your account isn't activated yet. We sent a verification link to"
              />
            )}

            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-100 dark:bg-red-950/50 dark:text-red-200 p-3 rounded" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-sm text-amber-600 hover:text-amber-800 dark:text-amber-400">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Remember me
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Don't have an account?{" "}
                <Link to="/register" className="text-amber-600 hover:text-amber-800 dark:text-amber-400 font-medium">
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
