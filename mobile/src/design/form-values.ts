export function localDateString(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")].join("-");
}

export function validBirthdate(value: string, today = localDateString(new Date())) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDateString(date) === value && value <= today;
}

// Retain compatibility with existing business hours such as "8:00 AM" and "18:30".
export function timeInputValue(value: string) {
  const clock = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!clock) return "";
  let hour = Number(clock[1]);
  const minute = Number(clock[2]);
  if (minute > 59) return "";
  if (clock[3]) {
    if (hour < 1 || hour > 12) return "";
    hour = hour % 12 + (clock[3].toUpperCase() === "PM" ? 12 : 0);
  } else if (hour > 23) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function displayTime(value: string) {
  const time = timeInputValue(value);
  if (!time) return "";
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export function signupError(values: { name: string; email: string; password: string; confirmPassword: string }) {
  if (values.name.trim().length < 2) return "Enter your full name (at least 2 characters).";
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) return "Enter a valid email address.";
  if (values.password.length < 6) return "Password must contain at least 6 characters.";
  if (!values.confirmPassword) return "Please confirm your password.";
  if (values.password !== values.confirmPassword) return "Passwords do not match.";
  return null;
}
