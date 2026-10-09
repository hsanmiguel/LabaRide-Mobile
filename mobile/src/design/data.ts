import { useQuery } from "@tanstack/react-query";
import { router, useSegments } from "expo-router";
import { Alert, Platform } from "react-native";
import apiClient from "../api/client";
import { useAuthStore } from "../store/authStore";

import { formatAddress, type AddressData } from "./address";
import { flowTarget } from "../navigation/flow-target";

export interface Profile extends AddressData {
  id: number;
  name: string;
  email: string;
  isShopOwner: boolean;
  phone?: string;
  birthdate?: string;
  gender?: string;
}
export interface Service {
  id: number;
  serviceName: string;
  price: string | number;
  color?: string;
}
export interface LaundryItem {
  id?: number;
  itemName?: string;
  typeName?: string;
  price?: string | number;
}
export interface KiloPrice {
  id: number;
  minKilo: string | number;
  maxKilo: string | number;
  pricePerKilo: string | number;
}
export interface Shop extends AddressData {
  id: number;
  userId: number;
  shopName: string;
  contactNumber?: string;
  address?: string;
  openingTime?: string;
  closingTime?: string;
  services?: Service[];
  kiloPrices?: KiloPrice[];
  clothingTypes?: LaundryItem[];
  householdItems?: LaundryItem[];
}
export interface Order extends AddressData {
  id: number;
  userId: number;
  shopId: number;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  serviceName: string;
  kiloAmount: string | number;
  subtotal: string | number;
  deliveryFee: string | number;
  voucherDiscount: string | number;
  totalAmount: string | number;
  deliveryType: string;
  scheduledDate: string;
  scheduledTime: string;
  paymentMethod: string;
  notes?: string;
  status: "Pending" | "Processing" | "Completed" | "Cancelled";
  createdAt: string;
  items?: { itemName: string; quantity: number }[];
  shop?: { shopName: string; address?: string; contactNumber?: string };
}
interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}
export const api = {
  async get<T>(path: string) {
    return (await apiClient.get<unknown, Envelope<T>>(path)).data;
  },
  async post<T>(path: string, body: unknown) {
    return (await apiClient.post<unknown, Envelope<T>>(path, body)).data;
  },
  async put<T>(path: string, body: unknown) {
    return (await apiClient.put<unknown, Envelope<T>>(path, body)).data;
  },
  async delete(path: string) {
    return apiClient.delete(path);
  },
};
export function message(error: unknown) {
  if (typeof error === "string") return error;
  const e = error as { error?: { message?: string; details?: { path?: (string | number)[]; message?: string }[] }; message?: string };
  if (Array.isArray(e?.error?.details)) {
    return e.error.details.map(detail => [detail.path?.filter(key => key !== "body").join("."), detail.message].filter(Boolean).join(": ")).join("\n");
  }
  return e?.error?.message || e?.message || "Please try again.";
}
export function notify(title: string, text: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") window.alert(title + "\n" + text);
  else Alert.alert(title, text);
}
export function fail(error: unknown) {
  notify("Something went wrong", message(error));
}
export function unavailable(feature: string) {
  Alert.alert(
    feature,
    "This service is currently unavailable. Please try again later.",
  );
}
export function go(screen: string, params: Record<string, string> = {}) {
  router.push({
    pathname: "/(flows)/[flow]",
    params: { ...params, flow: screen },
  });
}
export function replaceFlow(
  screen: string,
  params: Record<string, string> = {},
) {
  router.replace({
    pathname: "/(flows)/[flow]",
    params: { ...params, flow: screen },
  });
}
export function useFlowNavigation() {
  const segments = useSegments() as string[];
  return {
    inShop: segments[0] === "shop",
    flowHref: (screen: string, params: Record<string, string> = {}) =>
      flowTarget(screen, params, segments),
    go: (screen: string, params: Record<string, string> = {}) =>
      router.push(flowTarget(screen, params, segments)),
    replaceFlow: (screen: string, params: Record<string, string> = {}) =>
      router.replace(flowTarget(screen, params, segments)),
  };
}
export const address = formatAddress;
export function useProfile() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: ["user", user?.id],
    enabled: !!user,
    queryFn: () => api.get<Profile>(`/users/${user!.id}`),
  });
}
export function useShops() {
  return useQuery({
    queryKey: ["shops"],
    queryFn: () => api.get<Shop[]>("/shops"),
  });
}
export function useOwnedShop() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: ["shop", "owner", user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        return await api.get<Shop>(`/shops/user/${user!.id}`);
      } catch (e) {
        if ((e as { error?: { code?: string } })?.error?.code === "NOT_FOUND")
          return null;
        throw e;
      }
    },
  });
}
export function useShop(id: number) {
  const user = useAuthStore((state) => state.user);
  const shops = useShops();
  return useQuery({
    queryKey: ["shop", id, !!user],
    enabled: !!id && (!!user || !!shops.data),
    queryFn: async () =>
      user
        ? api.get<Shop>(`/shops/${id}`)
        : shops.data?.find((s) => s.id === id) || null,
  });
}
export function useOrders(shopMode = false) {
  const user = useAuthStore((state) => state.user);
  const owned = useOwnedShop();
  const ownerId = shopMode ? owned.data?.id : user?.id;
  return useQuery({
    queryKey: [shopMode ? "shop-orders" : "user-orders", ownerId],
    enabled: !!ownerId,
    queryFn: () =>
      api.get<Order[]>(
        `/transactions/${shopMode ? "shop" : "user"}/${ownerId}`,
      ),
  });
}
