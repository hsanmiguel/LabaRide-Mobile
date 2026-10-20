export interface DialogOptions {
  title: string;
  message: string;
  kind: "confirm" | "notice";
  confirmLabel?: string;
  destructive?: boolean;
  icon?: "logout";
  backdrop?: "blur";
  onConfirm?: () => Promise<void>;
}

interface DialogRequest extends DialogOptions {
  id: number;
  resolve: (accepted: boolean) => void;
  busy?: boolean;
  error?: string;
}

let nextId = 0;
let queue: DialogRequest[] = [];
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());

export const getDialog = (): DialogRequest | null => queue[0] || null;
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
  if (queue[0]?.id !== id || queue[0].busy) return;
  if (accepted && queue[0].onConfirm) { void runDialogAction(id); return; }
  finishDialog(id, accepted);
}

function finishDialog(id: number, accepted: boolean) {
  if (queue[0]?.id !== id) return;
  const request = queue.shift()!;
  publish();
  request.resolve(accepted);
}

async function runDialogAction(id: number) {
  const request = queue[0];
  queue[0] = { ...request, busy: true, error: undefined };
  publish();
  try {
    await request.onConfirm!();
    finishDialog(id, true);
  } catch (error) {
    if (queue[0]?.id !== id) return;
    queue[0] = { ...request, busy: false, error: error instanceof Error ? error.message : "Unable to finish this action. Please try again." };
    publish();
  }
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
