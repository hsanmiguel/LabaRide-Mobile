import { create } from "zustand";
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
interface Draft {
  shop: Shop | null;
  service: Service | null;
  serviceIds: number[];
  deliveryType: "Deliver" | "Pickup";
  kilos: string;
  counts: Record<string, number>;
  notes: string;
  schedule: string;
  paymentMethod: string;
  address: Partial<Profile> | null;
  searchHistory: string[];
  set: (value: Partial<Omit<Draft, "set" | "start">>) => void;
  start: (shop: Shop, service: Service, serviceIds: number[]) => void;
}
export const useLaundryDraft = create<Draft>()((set) => ({
  shop: null,
  service: null,
  serviceIds: [],
  deliveryType: "Deliver",
  kilos: "",
  counts: {},
  notes: "",
  schedule: "",
  paymentMethod: "Cash on Delivery",
  address: null,
  searchHistory: [],
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
      paymentMethod: "Cash on Delivery",
      address: null,
    }),
}));
