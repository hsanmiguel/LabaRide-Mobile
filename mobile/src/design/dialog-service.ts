export interface DialogOptions {
  title: string;
  message: string;
  kind: "confirm" | "notice";
  confirmLabel?: string;
  destructive?: boolean;
}

interface DialogRequest extends DialogOptions {
  id: number;
  resolve: (accepted: boolean) => void;
}

let nextId = 0;
let queue: DialogRequest[] = [];
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());

export const getDialog = () => queue[0] || null;
export function subscribeToDialogs(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function showDialog(options: DialogOptions): Promise<boolean> {
  return new Promise(resolve => {
    queue.push({ ...options, id: ++nextId, resolve });
    publish();
  });
}

export function settleDialog(id: number, accepted: boolean) {
  // Ignore repeated clicks and callbacks belonging to a previous dialog.
  if (queue[0]?.id !== id) return;
  const request = queue.shift()!;
  publish();
  request.resolve(accepted);
}

export function dismissAllDialogs() {
  const dismissed = queue;
  queue = [];
  publish();
  dismissed.forEach(request => request.resolve(false));
}

export function dismissConfirmations() {
  const dismissed = queue.filter(request => request.kind === "confirm");
  queue = queue.filter(request => request.kind === "notice");
  publish();
  dismissed.forEach(request => request.resolve(false));
}
