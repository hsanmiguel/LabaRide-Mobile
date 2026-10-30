import { useRef } from "react";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { socketService } from "../services/socket.service";
import { showDialog } from "./dialog-service";

export function useLogout() {
  const cache = useQueryClient();
  const pending = useRef(false);
  return async function requestLogout() {
    if (pending.current) return;
    pending.current = true;
    try {
      await showDialog({
        title: "Log out?", message: "Are you sure you want to log out?", kind: "confirm",
        confirmLabel: "Log Out", icon: "logout", backdrop: "blur",
        onConfirm: async () => {
          try { await useAuthStore.getState().logout(); }
          catch { throw new Error("We couldn't log you out. Please try again."); }
          await cache.cancelQueries();
          cache.clear();
          socketService.disconnect();
          router.replace("/(auth)/login");
        },
      });
    } finally { pending.current = false; }
  };
}
