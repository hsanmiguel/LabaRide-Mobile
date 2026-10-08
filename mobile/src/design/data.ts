import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Alert } from "react-native";
import apiClient from "../api/client";
import { useAuthStore } from "../store/authStore";

export interface Profile {
  id: number;
  name: string;
  email: string;
  isShopOwner: boolean;
  phone?: string;
  birthdate?: string;
  gender?: string;
  zone?: string;
  street?: string;
  barangay?: string;
  building?: string;
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
export interface Shop {
  id: number;
  userId: number;
  shopName: string;
  contactNumber?: string;
  zone?: string;
  street?: string;
  barangay?: string;
  building?: string;
  address?: string;
  openingTime?: string;
  closingTime?: string;
  latitude?: number;
  longitude?: number;
  services?: Service[];
  kiloPrices?: KiloPrice[];
  clothingTypes?: LaundryItem[];
  householdItems?: LaundryItem[];
}
export interface Order {
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
  zone?: string;
  street?: string;
  barangay?: string;
  building?: string;
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
  const e = error as { error?: { message?: string }; message?: string };
  return e?.error?.message || e?.message || "Please try again.";
}
export function fail(error: unknown) {
  Alert.alert("Something went wrong", message(error));
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
export const address = (
  value?: {
    zone?: string;
    street?: string;
    barangay?: string;
    building?: string;
    address?: string;
  } | null,
) =>
  value?.address ||
  [value?.building, value?.zone, value?.street, value?.barangay]
    .filter(Boolean)
    .join(", ");
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
