import api from '../services/api';
import { extractOne } from '../utils/apiHelpers';
import type { Hotel } from '../types';

export const createHotel = async (data: Record<string, unknown>) => {
  const res = await api.post('/hotels', data);
  return extractOne<Hotel>(res.data) ?? (res.data.data as Hotel);
};

export const updateHotel = async (id: string, data: Record<string, unknown>) => {
  const res = await api.patch(`/hotels/${id}`, data);
  return extractOne<Hotel>(res.data);
};

export const deleteHotel = async (id: string) => {
  await api.delete(`/hotels/${id}`);
};
