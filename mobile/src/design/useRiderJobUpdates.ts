import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "./data";
import { useAuthStore } from "../store/authStore";
import { toast } from "./toast-service";
import { riderJobKey, unseenRiderJobs } from "./rider-job-updates";
import { useRiderJobSeenStore } from "../store/riderJobSeenStore";
import type { JobBoard } from "./RiderAvailableJobs";

export function useAvailableRiderJobs(enabled = true, poll = false) {
  const userId = useAuthStore(state => state.user?.id);
  return useQuery({ queryKey: ['delivery', 'available-jobs', userId], enabled: enabled && !!userId,
    queryFn: () => api.get<JobBoard>('/delivery/available-jobs'), refetchInterval: poll ? 15000 : false, refetchIntervalInBackground: false });
}

export function useRiderJobUpdates(enabled: boolean) {
  const userId = useAuthStore(state => state.user?.id);
  const seen = useRiderJobSeenStore(state => userId ? state.seenByRider[userId] : undefined);
  const announced = useRiderJobSeenStore(state => userId ? state.announcedByRider[userId] : undefined);
  const hydrated = useRiderJobSeenStore(state => state.hydrated);
  const markAnnounced = useRiderJobSeenStore(state => state.markAnnounced);
  const query = useAvailableRiderJobs(enabled, true);
  const resuming = useRef(false);
  const [revision, setRevision] = useState(0);
  const foreground = () => AppState.currentState === "active" && (Platform.OS !== "web" || document.visibilityState !== "hidden");
  useEffect(() => { resuming.current = false; toast.dismiss("rider-new-jobs"); }, [userId, enabled]);
  useEffect(() => {
    let live = true;
    const update = () => {
      if (!foreground() || !enabled) return;
      resuming.current = true;
      void query.refetch().finally(() => {
        if (live) { resuming.current = false; setRevision(value => value + 1); }
      });
    };
    const subscription = AppState.addEventListener("change", update);
    if (Platform.OS === "web") document.addEventListener("visibilitychange", update);
    return () => { live = false; subscription.remove(); if (Platform.OS === "web") document.removeEventListener("visibilitychange", update); };
  }, [enabled, userId, query.refetch]);
  useEffect(() => {
    if (!enabled || !userId || !hydrated || !query.data?.rider.online || query.isError || query.isFetching || resuming.current || !foreground()) return;
    const fresh = unseenRiderJobs(query.data.jobs, seen).filter(job => !announced?.[riderJobKey(job)]);
    if (!fresh.length) return;
    const open = () => router.push("/rider/available");
    markAnnounced(userId, fresh);
    toast.info({ key: "rider-new-jobs", title: fresh.length === 1 ? "New job available" : `${fresh.length} new jobs available`,
      message: fresh.length === 1 ? `${fresh[0].stage} at ${fresh[0].shopName}.` : "New jobs are ready to claim in Order requests.",
      onPress: open, action: { label: "View jobs", onPress: open } });
  }, [enabled, userId, hydrated, seen, announced, markAnnounced, query.data, query.dataUpdatedAt, query.isError, query.isFetching, revision]);
  return hydrated && query.data?.rider.online && !query.isError ? unseenRiderJobs(query.data.jobs, seen).length : 0;
}
