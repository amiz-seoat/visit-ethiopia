import api from "../services/api";

export interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export const submitContact = async (payload: ContactPayload) => {
  const res = await api.post("/contacts", payload);
  return res.data;
};

export const getContacts = async () => {
  const res = await api.get("/contacts");
  return res.data;
};

export const updateContactStatus = async (id: string, status: string) => {
  const res = await api.patch(`/contacts/${id}`, { status });
  return res.data;
};
