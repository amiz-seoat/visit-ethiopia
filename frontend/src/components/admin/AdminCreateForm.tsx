import React, { useState } from 'react';
import { createTour } from '../../api/tours';
import { createHotel } from '../../api/hotelMutations';
import { createTransport } from '../../api/transportMutations';
import {
  createDestination,
  createNewsArticle,
  createRestaurant,
} from '../../api/contentMutations';
import { getErrorMessage } from '../../services/api';

type ResourceKind =
  | 'tour'
  | 'hotel'
  | 'transport'
  | 'restaurant'
  | 'destination'
  | 'news';

interface Props {
  kind: ResourceKind;
  onCreated: () => void;
  onCancel: () => void;
}

const inputClass =
  'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

export function AdminCreateForm({ kind, onCreated, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (kind === 'tour') {
        await createTour({
          title: form.title,
          description: form.description,
          shortDescription: form.shortDescription,
          duration: {
            days: Number(form.days || 1),
            nights: Number(form.nights || 0),
          },
          destinations: (form.destinations || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          categories: [(form.category || 'cultural') as never],
          difficulty: (form.difficulty || 'easy') as never,
          price: Number(form.price || 0),
          coverImage: form.coverImage,
          maxGroupSize: Number(form.maxGroupSize || 10),
          availableDates: form.startDate ? [form.startDate] : [],
          itinerary: [
            {
              day: 1,
              title: form.itineraryTitle || 'Day 1',
              description: form.itineraryDesc || form.description || 'Details',
            },
          ],
          inclusions: (form.inclusions || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          status: 'active',
        });
      } else if (kind === 'hotel') {
        await createHotel({
          name: form.name,
          description: form.description,
          shortDescription: form.shortDescription,
          location: {
            address: form.address,
            city: form.city,
            region: form.region,
          },
          stars: Number(form.stars || 3),
          coverImage: form.coverImage,
          contact: {
            phone: form.phone,
            email: form.email,
          },
          roomTypes: [
            {
              type: form.roomType || 'Standard',
              description: form.roomDesc || 'Standard room',
              price: Number(form.roomPrice || 0),
              capacity: Number(form.roomCapacity || 2),
              availableRooms: Number(form.availableRooms || 5),
            },
          ],
          amenities: (form.amenities || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          status: 'active',
        });
      } else if (kind === 'transport') {
        await createTransport({
          name: form.name,
          description: form.description,
          type: form.type || 'bus',
          contact: { phone: form.phone, email: form.email },
          vehicleDetails: {
            model: form.model || 'Standard',
            capacity: Number(form.capacity || 20),
          },
          routes: [
            {
              from: form.from,
              to: form.to,
              departureTime: form.departureTime || '08:00',
              arrivalTime: form.arrivalTime || '12:00',
              duration: form.duration || '4h',
              price: Number(form.price || 0),
              availableSeats: Number(form.availableSeats || 20),
            },
          ],
          status: 'active',
        });
      } else if (kind === 'restaurant') {
        await createRestaurant({
          name: form.name,
          description: form.description,
          shortDescription: form.shortDescription,
          cuisineType: (form.cuisine || 'Ethiopian')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          location: {
            address: form.address,
            city: form.city,
            region: form.region,
          },
          coverImage: form.coverImage,
          contact: { phone: form.phone, email: form.email },
          priceRange: form.priceRange || '$$',
          menu: [
            {
              category: form.menuCategory || 'Mains',
              items: [
                {
                  name: form.menuItem || 'Signature dish',
                  description: form.menuItemDesc || '',
                  price: Number(form.menuPrice || 100),
                },
              ],
            },
          ],
          status: 'active',
        });
      } else if (kind === 'destination') {
        await createDestination({
          name: form.name,
          description: form.description,
          shortDescription: form.shortDescription,
          region: form.region,
          location: {
            coordinates: {
              lat: Number(form.lat || 9),
              lng: Number(form.lng || 38),
            },
            address: form.address || form.name,
          },
          coverImage: form.coverImage,
          attractions: (form.attractions || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          status: 'active',
          isFeatured: form.isFeatured === 'true',
        });
      } else if (kind === 'news') {
        await createNewsArticle({
          title: form.title,
          summary: form.summary,
          content: form.content,
          coverImage: form.coverImage,
          category: form.category || 'tourism',
          tags: (form.tags || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          isFeatured: form.isFeatured === 'true',
          status: 'published',
        });
      }
      onCreated();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create resource'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-amber-200 bg-amber-50/40 rounded-lg p-4 mb-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 capitalize">
          Create {kind}
        </h3>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500">
          Cancel
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>
      )}

      {kind === 'tour' && (
        <>
          <Field label="Title" value={form.title} onChange={(v) => set('title', v)} required />
          <Field label="Short description" value={form.shortDescription} onChange={(v) => set('shortDescription', v)} required />
          <Field label="Description" value={form.description} onChange={(v) => set('description', v)} required textarea />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Days" value={form.days} onChange={(v) => set('days', v)} type="number" required />
            <Field label="Nights" value={form.nights} onChange={(v) => set('nights', v)} type="number" />
          </div>
          <Field label="Destinations (comma-separated)" value={form.destinations} onChange={(v) => set('destinations', v)} required />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              value={form.category || 'cultural'}
              onChange={(v) => set('category', v)}
              options={['cultural', 'adventure', 'nature', 'historical', 'religious']}
            />
            <Select
              label="Difficulty"
              value={form.difficulty || 'easy'}
              onChange={(v) => set('difficulty', v)}
              options={['easy', 'moderate', 'challenging']}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (ETB)" value={form.price} onChange={(v) => set('price', v)} type="number" required />
            <Field label="Max group size" value={form.maxGroupSize} onChange={(v) => set('maxGroupSize', v)} type="number" required />
          </div>
          <Field label="Cover image URL" value={form.coverImage} onChange={(v) => set('coverImage', v)} required />
          <Field label="Available date" value={form.startDate} onChange={(v) => set('startDate', v)} type="date" />
          <Field label="Itinerary day 1 title" value={form.itineraryTitle} onChange={(v) => set('itineraryTitle', v)} />
          <Field label="Itinerary day 1 description" value={form.itineraryDesc} onChange={(v) => set('itineraryDesc', v)} textarea />
          <Field label="Inclusions (comma-separated)" value={form.inclusions} onChange={(v) => set('inclusions', v)} />
        </>
      )}

      {kind === 'hotel' && (
        <>
          <Field label="Name" value={form.name} onChange={(v) => set('name', v)} required />
          <Field label="Short description" value={form.shortDescription} onChange={(v) => set('shortDescription', v)} required />
          <Field label="Description" value={form.description} onChange={(v) => set('description', v)} required textarea />
          <Field label="Address" value={form.address} onChange={(v) => set('address', v)} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" value={form.city} onChange={(v) => set('city', v)} required />
            <Field label="Region" value={form.region} onChange={(v) => set('region', v)} required />
          </div>
          <Field label="Stars (1-5)" value={form.stars} onChange={(v) => set('stars', v)} type="number" />
          <Field label="Cover image URL" value={form.coverImage} onChange={(v) => set('coverImage', v)} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" value={form.phone} onChange={(v) => set('phone', v)} required />
            <Field label="Email" value={form.email} onChange={(v) => set('email', v)} required />
          </div>
          <Field label="Room type" value={form.roomType} onChange={(v) => set('roomType', v)} />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Room price" value={form.roomPrice} onChange={(v) => set('roomPrice', v)} type="number" required />
            <Field label="Capacity" value={form.roomCapacity} onChange={(v) => set('roomCapacity', v)} type="number" />
            <Field label="Available rooms" value={form.availableRooms} onChange={(v) => set('availableRooms', v)} type="number" />
          </div>
          <Field label="Amenities (comma-separated)" value={form.amenities} onChange={(v) => set('amenities', v)} />
        </>
      )}

      {kind === 'transport' && (
        <>
          <Field label="Name" value={form.name} onChange={(v) => set('name', v)} required />
          <Field label="Description" value={form.description} onChange={(v) => set('description', v)} required textarea />
          <Select
            label="Type"
            value={form.type || 'bus'}
            onChange={(v) => set('type', v)}
            options={['air', 'bus', 'train', 'private_vehicle', 'boat']}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" value={form.from} onChange={(v) => set('from', v)} required />
            <Field label="To" value={form.to} onChange={(v) => set('to', v)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Departure (HH:MM)" value={form.departureTime} onChange={(v) => set('departureTime', v)} required />
            <Field label="Arrival (HH:MM)" value={form.arrivalTime} onChange={(v) => set('arrivalTime', v)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price" value={form.price} onChange={(v) => set('price', v)} type="number" required />
            <Field label="Available seats" value={form.availableSeats} onChange={(v) => set('availableSeats', v)} type="number" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" value={form.phone} onChange={(v) => set('phone', v)} required />
            <Field label="Email" value={form.email} onChange={(v) => set('email', v)} />
          </div>
          <Field label="Vehicle model" value={form.model} onChange={(v) => set('model', v)} />
        </>
      )}

      {kind === 'restaurant' && (
        <>
          <Field label="Name" value={form.name} onChange={(v) => set('name', v)} required />
          <Field label="Short description" value={form.shortDescription} onChange={(v) => set('shortDescription', v)} required />
          <Field label="Description" value={form.description} onChange={(v) => set('description', v)} required textarea />
          <Field label="Cuisine types (comma-separated)" value={form.cuisine} onChange={(v) => set('cuisine', v)} required />
          <Field label="Address" value={form.address} onChange={(v) => set('address', v)} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" value={form.city} onChange={(v) => set('city', v)} required />
            <Field label="Region" value={form.region} onChange={(v) => set('region', v)} required />
          </div>
          <Field label="Cover image URL" value={form.coverImage} onChange={(v) => set('coverImage', v)} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" value={form.phone} onChange={(v) => set('phone', v)} required />
            <Select label="Price range" value={form.priceRange || '$$'} onChange={(v) => set('priceRange', v)} options={['$', '$$', '$$$', '$$$$']} />
          </div>
          <Field label="Menu item name" value={form.menuItem} onChange={(v) => set('menuItem', v)} required />
          <Field label="Menu item price" value={form.menuPrice} onChange={(v) => set('menuPrice', v)} type="number" required />
        </>
      )}

      {kind === 'destination' && (
        <>
          <Field label="Name" value={form.name} onChange={(v) => set('name', v)} required />
          <Field label="Short description" value={form.shortDescription} onChange={(v) => set('shortDescription', v)} required />
          <Field label="Description" value={form.description} onChange={(v) => set('description', v)} required textarea />
          <Field label="Region" value={form.region} onChange={(v) => set('region', v)} required />
          <Field label="Cover image URL" value={form.coverImage} onChange={(v) => set('coverImage', v)} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" value={form.lat} onChange={(v) => set('lat', v)} type="number" required />
            <Field label="Longitude" value={form.lng} onChange={(v) => set('lng', v)} type="number" required />
          </div>
          <Field label="Attractions (comma-separated)" value={form.attractions} onChange={(v) => set('attractions', v)} />
          <Select label="Featured" value={form.isFeatured || 'false'} onChange={(v) => set('isFeatured', v)} options={['false', 'true']} />
        </>
      )}

      {kind === 'news' && (
        <>
          <Field label="Title" value={form.title} onChange={(v) => set('title', v)} required />
          <Field label="Summary" value={form.summary} onChange={(v) => set('summary', v)} required />
          <Field label="Content" value={form.content} onChange={(v) => set('content', v)} required textarea />
          <Field label="Cover image URL" value={form.coverImage} onChange={(v) => set('coverImage', v)} required />
          <Select
            label="Category"
            value={form.category || 'tourism'}
            onChange={(v) => set('category', v)}
            options={['tourism', 'culture', 'event', 'business', 'general']}
          />
          <Field label="Tags (comma-separated)" value={form.tags} onChange={(v) => set('tags', v)} />
          <Select label="Featured" value={form.isFeatured || 'false'} onChange={(v) => set('isFeatured', v)} options={['false', 'true']} />
        </>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-60"
      >
        {loading ? 'Creating...' : `Create ${kind}`}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
  textarea,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {textarea ? (
        <textarea
          className={inputClass}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          rows={3}
        />
      ) : (
        <input
          className={inputClass}
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
