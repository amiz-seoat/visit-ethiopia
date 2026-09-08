import api from '../services/api';
import { extractList } from '../utils/apiHelpers';
import type { Booking, User } from '../types';

export interface PlatformStats {
  users: {
    total: number;
    byRole: Record<string, number>;
  };
  tours: { total: number; active: number; draft: number };
  hotels: { total: number; active: number };
  transports: { total: number; active: number };
  restaurants: { total: number; active: number };
  bookings: {
    total: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    completed: number;
  };
  reviews: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  destinations: { total: number };
  contacts: { total: number; new: number };
}

export const getStats = async (): Promise<PlatformStats> => {
  const res = await api.get('/stats');
  return res.data as PlatformStats;
};

export const getAdminUsers = async (): Promise<User[]> => {
  const res = await api.get('/users');
  return extractList<User>(res.data);
};

export const updateUserRole = async (id: string, role: string) => {
  const res = await api.patch(`/users/${id}`, { role });
  return res.data;
};

export const deleteUser = async (id: string) => {
  await api.delete(`/users/${id}`);
};

export const getAdminContacts = async () => {
  const res = await api.get('/contacts');
  return extractList(res.data);
};
