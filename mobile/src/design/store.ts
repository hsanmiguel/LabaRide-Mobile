import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { Profile, Service, Shop } from "./data";

export const clothingNames = [
  "Shirts",
  "Pants",
  "Dresses",
  "Jackets",
  "Uniforms",
  "Undergarments",
  "Socks",
];
export const householdNames = [
  "Blankets",
  "Bed sheets",
  "Pillowcases",
  "Curtains",
  "Tablecloths",
];
interface DraftData {
  shop: Shop | null;
  service: Service | null;
  serviceIds: number[];
  deliveryType: "Deliver" | "Pickup";
  collectionMethod: "Dropoff" | "ShopPickup";
  kilos: string;
  counts: Record<string, number>;
  notes: string;
  schedule: string;
  requestedPickupAt: string;
  paymentMethod: string;
  address: Partial<Profile> | null;
  searchHistory: string[];
}
interface Draft extends DraftData {
  set: (value: Partial<DraftData>) => void;
  start: (shop: Shop, service: Service, serviceIds: number[]) => void;
  clearOrder: () => void;
}
const emptyDraft: DraftData = {
  shop: null,
  service: null,
  serviceIds: [],
  deliveryType: "Deliver",
  collectionMethod: "Dropoff",
  kilos: "",
  counts: {},
  notes: "",
  schedule: "",
  requestedPickupAt: "",
  paymentMethod: "Cash on Delivery",
  address: null,
  searchHistory: [],
};

const storage = createJSONStorage<DraftData>(() => Platform.OS === "web" ? {
  getItem: key => typeof window === "undefined" ? null : window.sessionStorage.getItem(key),
  setItem: (key, value) => { if (typeof window !== "undefined") window.sessionStorage.setItem(key, value); },
  removeItem: key => { if (typeof window !== "undefined") window.sessionStorage.removeItem(key); },
} : AsyncStorage);

function draftData(state: Partial<DraftData>): DraftData {
  return Object.fromEntries(Object.keys(emptyDraft).map(key => [key,
    state[key as keyof DraftData] ?? emptyDraft[key as keyof DraftData],
  ])) as unknown as DraftData;
}

export const useLaundryDraft = create<Draft>()(persist((set, get) => ({
  ...emptyDraft,
  set: (value) => set(value),
  start: (shop, service, serviceIds) =>
    set({
      shop,
      service,
      serviceIds,
      counts: {},
      notes: "",
      kilos: "",
      schedule: "",
  requestedPickupAt: "",
      collectionMethod: "Dropoff",
      paymentMethod: "Cash on Delivery",
      address: null,
    }),
  clearOrder: () => set({ ...emptyDraft, searchHistory: get().searchHistory }),
}), {
  name: "labaride-draft:guest",
  version: 1,
  storage,
  skipHydration: true,
  partialize: state => draftData(state),
  merge: (saved, current) => ({ ...current, ...draftData((saved || {}) as Partial<DraftData>) }),
}));

let restoredOwner: string | null = null;
let restoration = Promise.resolve();

// Serializing restores prevents a slow native read for one account from
// overwriting a more recent login. The root layout waits before showing routes.
export function restoreLaundryDraft(owner: string) {
  const pending = restoration.then(async () => {
    if (restoredOwner === owner) return;
    const guestDraft = restoredOwner === "guest" && owner !== "guest"
      ? draftData(useLaundryDraft.getState()) : null;
    let failed = false;
    useLaundryDraft.persist.setOptions({
      name: `labaride-draft:${owner}`,
      storage,
      onRehydrateStorage: () => (_state, error) => { failed = !!error; },
    });
    await useLaundryDraft.persist.rehydrate();
    if (failed) {
      // Keep checkout usable in memory when browser/device storage is blocked
      // or corrupted, and do not retain another account's in-memory basket.
      useLaundryDraft.persist.setOptions({ storage: {
        getItem: () => null, setItem: () => {}, removeItem: () => {},
      } });
      useLaundryDraft.setState({ ...emptyDraft });
    }
    if (!failed && guestDraft?.service && !useLaundryDraft.getState().service) {
      useLaundryDraft.setState(guestDraft);
      try { await storage?.removeItem("labaride-draft:guest"); } catch { /* The signed-in draft is already restored. */ }
    }
    restoredOwner = owner;
  });
  restoration = pending.catch(() => {});
  return pending;
}
