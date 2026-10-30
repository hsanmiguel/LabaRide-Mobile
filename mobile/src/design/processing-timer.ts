export interface ProcessingTimingOrder {
  status: string;
  workflowStatus?: string | null;
  washingMinutes?: number | null;
  dryingMinutes?: number | null;
  processingStartedAt?: string | null;
  washingStartedAt?: string | null;
  dryingStartedAt?: string | null;
  processingTimingSource?: "snapshot" | "current-service";
}
export type TimerPhase = {
  name: "Wash" | "Dry";
  state: "running" | "waiting" | "elapsed" | "done" | "unavailable";
  seconds: number | null;
  progress: number;
};
export function processingIsActive(order: ProcessingTimingOrder) {
  return order.workflowStatus ? ["Washing", "Drying", "Folding"].includes(order.workflowStatus) : order.status === "Processing";
}
export function processingTimers(order: ProcessingTimingOrder, now: number) {
  if (!processingIsActive(order)) return null;
  const timestamp = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  const washStart = timestamp(order.washingStartedAt || (order.workflowStatus ? order.processingStartedAt : null));
  const washDuration = Number.isFinite(order.washingMinutes) && Number(order.washingMinutes) > 0 ? Number(order.washingMinutes) * 60 : null;
  const dryDuration = Number.isFinite(order.dryingMinutes) && Number(order.dryingMinutes) > 0 ? Number(order.dryingMinutes) * 60 : null;
  const phase = (name: TimerPhase["name"], duration: number | null, start: number | null, done = false, waiting = false): TimerPhase => {
    if (done) return { name, state: "done", seconds: 0, progress: 1 };
    if (waiting) return { name, state: "waiting", seconds: duration, progress: 0 };
    if (duration === null) return { name, state: "unavailable", seconds: null, progress: 0 };
    if (start === null) return { name, state: "unavailable", seconds: duration, progress: 0 };
    const elapsed = Math.max(0, (now - start) / 1000);
    return { name, state: elapsed >= duration ? "elapsed" : "running", seconds: Math.max(0, Math.ceil(duration - elapsed)), progress: Math.min(1, elapsed / duration) };
  };
  if (order.workflowStatus) return {
    phases: [phase("Wash", washDuration, washStart, ["Drying", "Folding"].includes(order.workflowStatus)),
      phase("Dry", dryDuration, timestamp(order.dryingStartedAt), order.workflowStatus === "Folding", order.workflowStatus === "Washing")],
  };
  const dryStart = timestamp(order.dryingStartedAt);
  // Processing is an order status, not proof that either machine was started.
  // Both original-order timers wait for their own explicit owner action.
  return { phases: [phase("Wash", washDuration, washStart, dryStart !== null, washStart === null),
    phase("Dry", dryDuration, dryStart, false, dryStart === null)] };
}
export function timerClock(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole % 3600 / 60);
  const rest = String(whole % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}
export function timerPhaseText(phase: TimerPhase) {
  if (phase.state === "done") return "Finished";
  if (phase.state === "unavailable") return phase.seconds === null ? "Duration not set" : "Start time unavailable";
  if (phase.state === "elapsed") return "0:00 · Time elapsed";
  if (phase.state === "waiting") return phase.seconds === null ? "Not started" : `${timerClock(phase.seconds)} · Not started`;
  return `${timerClock(phase.seconds!)} · remaining`;
}
