import api from "../services/api";
import { extractOne } from "../utils/apiHelpers";
import type { User } from "../types";

export const signupUser = async (userData: {
  FirstName: string;
  LastName: string;
  email: string;
  password: string;
  passwordConfirm: string;
  role?: string;
}) => {
  const res = await api.post("/users/signup", userData);
  return res.data;
};

export const loginUser = async (credentials: { email: string; password: string }) => {
  const res = await api.post("/users/login", credentials);
  if (res.data.token) {
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("user", JSON.stringify(res.data.data.user));
  }
  return res.data;
};

export const verifyEmail = async (token: string) => {
  const res = await api.get(`/users/verify/${token}`);
  return res.data;
};

export const logoutUser = async () => {
  try {
    await api.post("/users/logout");
  } finally {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
};

export const getMyProfile = async (): Promise<User | null> => {
  const res = await api.get("/users/profile");
  return extractOne<User>(res.data);
};

export const updateMyProfile = async (updates: {
  FirstName?: string;
  LastName?: string;
  email?: string;
  favorites?: string[];
}) => {
  const res = await api.patch("/users/profile", updates);
  const user = res.data?.data?.user ?? res.data?.data;
  if (user) localStorage.setItem("user", JSON.stringify(user));
  return res.data;
};

export const updatePassword = async (payload: {
  passwordCurrent: string;
  password: string;
  passwordConfirm: string;
}) => {
  const res = await api.patch("/users/updatePassword", payload);
  if (res.data.token) {
    localStorage.setItem("token", res.data.token);
  }
  return res.data;
};

export const getAllUsers = async () => {
  const res = await api.get("/users");
  return res.data;
};

export const forgotPassword = async (email: string) => {
  const res = await api.post("/users/forgotPassword", { email });
  return res.data;
};

export const resetPassword = async (token: string, payload: {
  password: string;
  passwordConfirm: string;
}) => {
  const res = await api.patch(`/users/resetPassword/${token}`, payload);
  if (res.data.token) {
    localStorage.setItem("token", res.data.token);
    if (res.data.data?.user) {
      localStorage.setItem("user", JSON.stringify(res.data.data.user));
    }
  }
  return res.data;
};
