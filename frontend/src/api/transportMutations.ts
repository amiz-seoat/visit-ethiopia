import api from '../services/api';
import { extractOne } from '../utils/apiHelpers';
import type { Transport } from '../types';

export const createTransport = async (data: Record<string, unknown>) => {
  const res = await api.post('/transports', data);
  return extractOne<Transport>(res.data) ?? (res.data.data as Transport);
};

export const updateTransport = async (
  id: string,
  data: Record<string, unknown>
) => {
  const res = await api.patch(`/transports/${id}`, data);
  return extractOne<Transport>(res.data);
};

export const deleteTransport = async (id: string) => {
  await api.delete(`/transports/${id}`);
};
