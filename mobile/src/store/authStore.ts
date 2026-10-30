import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Expo SecureStore is native only. Web sessions stay in this browser tab.
const storage = {
  async get(key: string) {
    return Platform.OS === "web"
      ? typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem(key)
      : SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === "web") window.sessionStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  async delete(key: string) {
    if (Platform.OS === "web") window.sessionStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};

interface User {
  id: number;
  name: string;
  email: string;
  isShopOwner: boolean;
  isAdmin?: boolean;
  isRider?: boolean;
  riderApplicationStatus?: string;
  riderReviewReason?: string | null;
  photoUrl?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isGuest: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => Promise<void>;
  setGuest: () => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  token: null,
  isGuest: false,
  isLoading: true,

  setAuth: async (user, token) => {
    await storage.set("auth_token", token);
    await storage.set("auth_user", JSON.stringify(user));
    set({ user, token, isGuest: false });
  },

  setGuest: () => {
    set({ user: null, token: null, isGuest: true });
  },

  logout: async () => {
    const previous = get();
    try {
      await storage.delete("auth_token");
      await storage.delete("auth_user");
    } catch (error) {
      // Keep a failed secure-storage logout from leaving half a saved session.
      await Promise.allSettled([
        previous.token ? storage.set("auth_token", previous.token) : Promise.resolve(),
        previous.user ? storage.set("auth_user", JSON.stringify(previous.user)) : Promise.resolve(),
      ]);
      throw error;
    }
    set({ user: null, token: null, isGuest: false });
  },

  checkAuth: async () => {
    try {
      const token = await storage.get("auth_token");
      const userStr = await storage.get("auth_user");

      if (token && userStr) {
        set({ token, user: JSON.parse(userStr), isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error("Error restoring auth state", error);
      set({ isLoading: false });
    }
  },
}));
