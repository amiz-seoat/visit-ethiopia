import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';

export function RegisterPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    }
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {
      name,
      value
    } = e.target;
    // Handle nested address fields
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await signup({
        FirstName: formData.firstName,
        LastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        passwordConfirm: formData.confirmPassword,
      });
      setSuccess(res.message || 'Account created! Please check your email to verify your account.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };
  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    if (!password) return {
      strength: 0,
      label: ''
    };
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    let label = '';
    let color = '';
    if (strength === 1) {
      label = 'Weak';
      color = 'bg-red-500';
    } else if (strength === 2) {
      label = 'Fair';
      color = 'bg-orange-500';
    } else if (strength === 3) {
      label = 'Good';
      color = 'bg-yellow-500';
    } else if (strength === 4) {
      label = 'Strong';
      color = 'bg-green-500';
    }
    return {
      strength,
      label,
      color
    };
  };
  const passwordStrength = getPasswordStrength(formData.password);
  const passwordsMatch = formData.password === formData.confirmPassword && formData.password !== '';
  return <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800">
                Create an Account
              </h1>
              <p className="text-gray-600 mt-2">
                Join Visit Ethiopia to book tours and manage your trips
              </p>
            </div>
            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>
            )}
            {success && (
              <div className="mb-4 text-sm text-green-700 bg-green-50 p-3 rounded">{success}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input id="firstName" name="firstName" type="text" value={formData.firstName} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none" required />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input id="lastName" name="lastName" type="text" value={formData.lastName} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none" required />
                </div>
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none" placeholder="your@email.com" required />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input id="password" name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none" placeholder="••••••••" required />
                  <button type="button" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formData.password && <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex-grow flex space-x-1">
                        {[1, 2, 3, 4].map(level => <div key={level} className={`h-1 flex-grow rounded-full ${level <= passwordStrength.strength ? passwordStrength.color : 'bg-gray-200'}`}></div>)}
                      </div>
                      <span className="text-xs ml-2">
                        {passwordStrength.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Password should be at least 8 characters with uppercase,
                      numbers, and special characters.
                    </p>
                  </div>}
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none" placeholder="••••••••" required />
                  <button type="button" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formData.confirmPassword && <div className="flex items-center mt-1">
                    {passwordsMatch ? <>
                        <Check size={16} className="text-green-500 mr-1" />
                        <span className="text-xs text-green-500">
                          Passwords match
                        </span>
                      </> : <span className="text-xs text-red-500">
                        Passwords do not match
                      </span>}
                  </div>}
              </div>
              <div className="flex items-center">
                <input id="agree-terms" type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded" required />
                <label htmlFor="agree-terms" className="ml-2 block text-sm text-gray-700">
                  I agree to the{' '}
                  <Link to="/terms" className="text-amber-600 hover:text-amber-800">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-amber-600 hover:text-amber-800">
                    Privacy Policy
                  </Link>
                </label>
              </div>
              <div>
                <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-60" disabled={!agreeTerms || !passwordsMatch || loading}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="text-amber-600 hover:text-amber-800 font-medium">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>;
}