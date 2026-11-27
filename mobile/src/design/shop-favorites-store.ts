import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Platform } from "react-native";

type FavoritesState = {
  byOwner: Record<string, number[]>;
  toggle: (owner: string, shopId: number) => void;
};
export const emptyFavoriteIds: number[] = [];

const storage = createJSONStorage(() => Platform.OS === "web" ? {
  getItem: key => typeof window === "undefined" ? null : window.localStorage.getItem(key),
  setItem: (key, value) => { if (typeof window !== "undefined") window.localStorage.setItem(key, value); },
  removeItem: key => { if (typeof window !== "undefined") window.localStorage.removeItem(key); },
} : AsyncStorage);

export const useShopFavoritesStore = create<FavoritesState>()(persist(set => ({
  byOwner: {},
  toggle: (owner, shopId) => set(state => {
    const current = state.byOwner[owner] || [];
    const next = current.includes(shopId) ? current.filter(id => id !== shopId) : [...current, shopId];
    return { byOwner: { ...state.byOwner, [owner]: next } };
  }),
}), {
  name: "labaride-shop-favorites",
  storage,
  partialize: state => ({ byOwner: state.byOwner }),
  merge: (saved, current) => {
    const stored = (saved as Partial<FavoritesState> | undefined)?.byOwner;
    const byOwner: Record<string, number[]> = {};
    for (const [owner, ids] of Object.entries(stored || {})) {
      if (Array.isArray(ids)) byOwner[owner] = [...new Set(ids.filter(id => Number.isSafeInteger(id) && id > 0))];
    }
    return { ...current, byOwner };
  },
}));
