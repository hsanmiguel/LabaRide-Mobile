import { useQuery } from "@tanstack/react-query";
import { router, useSegments } from "expo-router";
import { showDialog } from "./dialog-service";
import apiClient from "../api/client";
import { useAuthStore } from "../store/authStore";

import { formatAddress, type AddressData } from "./address";
import { flowTarget } from "../navigation/flow-target";

export interface Profile extends AddressData {
  id: number;
  name: string;
  email: string;
  isShopOwner: boolean;
  isAdmin?: boolean;
  isRider?: boolean;
  riderApplicationStatus?: string;
  riderReviewReason?: string | null;
  photoUrl?: string | null;
  phone?: string;
  birthdate?: string;
  gender?: string;
}
export interface Service {
  id: number;
  serviceName: string;
  price: string | number;
  packageKilos?: string | number | null;
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
  approvalStatus: "Pending" | "Approved" | "Rejected" | "Suspended";
  applicationVersion: number;
  requirementsVersion?: number;
  reviewReason?: string | null;
  reviewedAt?: string | null;
  id: number;
  userId: number;
  shopName: string;
  photoUrl?: string | null;
  contactNumber?: string;
  address?: string;
  openingTime?: string;
  closingTime?: string;
  acceptingOrders?: boolean;
  deliveryMinKm?: string | number | null;
  deliveryMaxKm?: string | number | null;
  pickupMinKm?: string | number | null;
  pickupMaxKm?: string | number | null;
  pickupEnabled?: boolean;
  services?: Service[];
  kiloPrices?: KiloPrice[];
  clothingTypes?: LaundryItem[];
  householdItems?: LaundryItem[];
}
export interface Order extends AddressData {
  workflowStatus?: string | null;
  workflowVersion?: number;
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
  collectionMethod?: "Dropoff" | "ShopPickup";
  collectionAddress?: AddressData | null;
  requestedPickupAt?: string | null;
  confirmedPickupAt?: string | null;
  receivedAt?: string | null;
  processingStartedAt?: string | null;
  estimatedReadyAt?: string | null;
  estimateUpdatedAt?: string | null;
  estimateReason?: string | null;
  readyAt?: string | null;
  updatedAt?: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  paymentMethod: string;
  notes?: string;
  status: "Pending" | "Accepted" | "Queued" | "Processing" | "Ready" | "Completed" | "Cancelled";
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
  type Detail = { path?: (string | number)[]; message?: string };
  const e = error as { error?: { message?: string; details?: Detail[] }; details?: Detail[]; message?: string };
  // The Axios interceptor unwraps response.error; both shapes can reach this helper.
  const details = e?.error?.details || e?.details;
  if (Array.isArray(details) && details.length) {
    return details.map(detail => [detail.path?.filter(key => key !== "body").join("."), detail.message].filter(Boolean).join(": ")).join("\n");
  }
  return e?.error?.message || e?.message || "Please try again.";
}
export function notify(title: string, text: string) {
  void showDialog({ title, message: text, kind: "notice" });
}
export function confirmAction(title: string, text: string, options: { confirmLabel?: string; destructive?: boolean } = {}): Promise<boolean> {
  return showDialog({ title, message: text, kind: "confirm", ...options });
}
export function fail(error: unknown) {
  notify("Something went wrong", message(error));
}
export function unavailable(feature: string) {
  notify(
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
    refetchInterval: 15000,
    queryFn: async () => {
      try {
        return await api.get<Shop>(`/shops/user/${user!.id}`);
      } catch (e) {
        const code = (e as { code?: string; error?: { code?: string } })?.code ||
          (e as { code?: string; error?: { code?: string } })?.error?.code;
        const msg = (e as { message?: string; error?: { message?: string } })?.message ||
          (e as { message?: string; error?: { message?: string } })?.error?.message;
        if (code === "NOT_FOUND" || msg === "Shop not found")
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
    refetchInterval: 15000,
    queryFn: () =>
      api.get<Order[]>(
        `/transactions/${shopMode ? "shop" : "user"}/${ownerId}`,
      ),
  });
}
