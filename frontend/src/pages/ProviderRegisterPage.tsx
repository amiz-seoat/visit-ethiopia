import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, ChevronRight } from 'lucide-react';
import {
  registerOrganization,
  setActiveOrganization,
  type ProviderType,
  type ProviderVerification,
} from '../api/organizations';
import { getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

const PROVIDER_TYPES: { value: ProviderType; label: string; description: string }[] = [
  {
    value: 'travel_company',
    label: 'Tour & Travel Company',
    description: 'Offer guided tours and travel packages across Ethiopia.',
  },
  {
    value: 'hotel',
    label: 'Hotel',
    description: 'List accommodations for travelers.',
  },
  {
    value: 'tour_bus_provider',
    label: 'Tour Bus Provider',
    description: 'Provide buses for tour operators and groups.',
  },
  {
    value: 'bus_company',
    label: 'Public Bus Company',
    description: 'Operate scheduled intercity bus routes.',
  },
];

const STEPS = ['Provider type', 'Company info', 'Verification', 'Review'];

export function ProviderRegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [providerTypes, setProviderTypes] = useState<ProviderType[]>(['travel_company']);
  const [name, setName] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [verification, setVerification] = useState<ProviderVerification>({
    legalName: '',
    registrationNumber: '',
    responsiblePerson: { name: '', phone: '', email: '' },
    businessDocuments: [],
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center">
          <p className="text-gray-600 mb-4">Sign in to register as a provider.</p>
          <Link to="/login" className="text-emerald-700 font-medium hover:underline">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  const toggleType = (type: ProviderType) => {
    setProviderTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await registerOrganization({
        name,
        providerTypes,
        shortDescription,
        description,
        verification,
      });
      localStorage.setItem('activeOrganizationId', result.organization._id);
      await setActiveOrganization(result.organization._id);
      navigate(`/provider/workspace/${result.organization._id}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Building2 className="text-emerald-700" size={32} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Provider registration</h1>
            <p className="text-gray-500 text-sm">Your listing stays private until admin approval.</p>
          </div>
        </div>

        <div className="flex gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`flex-1 text-center text-xs py-2 rounded ${
                i === step ? 'bg-emerald-700 text-white' : i < step ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
          )}

          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Select one or more provider types.</p>
              {PROVIDER_TYPES.map((pt) => (
                <label
                  key={pt.value}
                  className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer ${
                    providerTypes.includes(pt.value) ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={providerTypes.includes(pt.value)}
                    onChange={() => toggleType(pt.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">{pt.label}</div>
                    <div className="text-sm text-gray-500">{pt.description}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company name *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Short description</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full description</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Legal name *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={verification.legalName || ''}
                  onChange={(e) => setVerification((v) => ({ ...v, legalName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration number *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={verification.registrationNumber || ''}
                  onChange={(e) =>
                    setVerification((v) => ({ ...v, registrationNumber: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact name *</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={verification.responsiblePerson?.name || ''}
                    onChange={(e) =>
                      setVerification((v) => ({
                        ...v,
                        responsiblePerson: { ...v.responsiblePerson, name: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact phone *</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={verification.responsiblePerson?.phone || ''}
                    onChange={(e) =>
                      setVerification((v) => ({
                        ...v,
                        responsiblePerson: { ...v.responsiblePerson, phone: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business license URL *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="https://..."
                  onChange={(e) =>
                    setVerification((v) => ({
                      ...v,
                      businessDocuments: [
                        { type: 'business_license', url: e.target.value, status: 'pending' },
                      ],
                    }))
                  }
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2 text-sm text-gray-700">
              <p><strong>Types:</strong> {providerTypes.join(', ')}</p>
              <p><strong>Name:</strong> {name}</p>
              <p><strong>Legal name:</strong> {verification.legalName}</p>
              <p className="text-gray-500 mt-4">
                Submitting creates a draft version. You can edit and submit for admin approval from your workspace.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2 text-gray-600 disabled:opacity-40"
            >
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 && providerTypes.length === 0}
                className="flex items-center gap-1 bg-emerald-700 text-white px-5 py-2 rounded-lg disabled:opacity-50"
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !name.trim()}
                className="bg-emerald-700 text-white px-5 py-2 rounded-lg disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create draft'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
