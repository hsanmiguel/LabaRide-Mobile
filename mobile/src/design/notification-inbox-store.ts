import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type InboxScope = { archived: number[]; pinned: number[] };
type InboxState = {
  byScope: Record<string, InboxScope>;
  togglePin: (scope: string, id: number) => void;
  setArchived: (scope: string, id: number, archived: boolean) => void;
};

export const useNotificationInboxStore = create<InboxState>()(persist((set) => ({
  byScope: {},
  togglePin: (scope, id) => set(state => {
    const current = state.byScope[scope] || { archived: [], pinned: [] };
    const pinned = current.pinned.includes(id) ? current.pinned.filter(value => value !== id) : [...current.pinned, id];
    return { byScope: { ...state.byScope, [scope]: { ...current, pinned } } };
  }),
  setArchived: (scope, id, archived) => set(state => {
    const current = state.byScope[scope] || { archived: [], pinned: [] };
    const ids = archived ? [...new Set([...current.archived, id])] : current.archived.filter(value => value !== id);
    return { byScope: { ...state.byScope, [scope]: { ...current, archived: ids } } };
  }),
}), {
  name: "labaride-notification-inbox",
  storage: createJSONStorage(() => AsyncStorage),
  partialize: state => ({ byScope: state.byScope }),
}));
