import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useAuthStore } from "../store/authStore";
import { connectionErrorMessage, resolveApiUrl } from "./api-address";

// Native development can use Metro's LAN host when .env is absent or still
// contains localhost. Explicit LAN and hosted backend URLs remain authoritative.
export const API_URL = resolveApiUrl({
  configuredUrl: process.env.EXPO_PUBLIC_API_URL,
  platform: Platform.OS,
  development: __DEV__,
  expoHostUri: Constants.expoConfig?.hostUri,
});

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
    if (!error.response && ["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT"].includes(error.code)) {
      return Promise.reject(connectionErrorMessage(API_URL, error.code !== "ERR_NETWORK", Platform.OS));
    }
    return Promise.reject(error.response?.data || error.message);
  },
);

export default apiClient;
