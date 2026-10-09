import axios from "axios";
import { useAuthStore } from "../store/authStore";

// Adjust this URL for your local development environment
// For Android emulator, use 10.0.2.2 instead of localhost
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 45000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized (e.g., clear token)
      useAuthStore.getState().logout();
    }
    return Promise.reject(error.response?.data || error.message);
  },
);

export default apiClient;
