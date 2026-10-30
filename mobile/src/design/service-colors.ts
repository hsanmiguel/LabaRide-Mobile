export const serviceColorOptions = [
  { color: "#321078", name: "Deep Purple" }, { color: "#6842D9", name: "Violet" },
  { color: "#886AB8", name: "Lavender" }, { color: "#D0C1E8", name: "Pale Lavender" },
  { color: "#7EA8BE", name: "Steel Blue" }, { color: "#28536B", name: "Charcoal Blue" },
  { color: "#5C374C", name: "Mauve Shadow" }, { color: "#052F5F", name: "Oxford Navy" },
];

export function normalizeServiceColor(color?: string | null) {
  const value = (color || "").trim().toUpperCase();
  return /^#[\dA-F]{3}$/.test(value) ? "#" + value.slice(1).split("").map(part => part + part).join("") : value;
}

export function serviceColorTaken(services: { id: number; color?: string | null }[], color: string, editingId?: number) {
  return services.some(service => service.id !== editingId && normalizeServiceColor(service.color || "#321078") === normalizeServiceColor(color));
}

function luminance(hex: string) {
  const digits = hex.slice(1);
  const full = digits.length === 3 ? digits.split("").map(value => value + value).join("") : digits;
  const channels = [0, 2, 4].map(offset => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function serviceCardColors(color?: string | null, fallback = "#321078") {
  const valid = (value?: string | null): value is string => /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value || "");
  const background = valid(color) ? color : valid(fallback) ? fallback : "#321078";
  const lightness = luminance(background);
  // Service titles, prices and units are large bold text. Mid-tone purples
  // therefore use white too; small supporting text sits on a darker chip.
  const foreground = 1.05 / (lightness + 0.05) >= 3 ? "#FFFFFF"
    : (lightness + 0.05) / (luminance("#202033") + 0.05) >= 4.5 ? "#202033" : "#000000";
  return { background, foreground, detailBackground: foreground === "#FFFFFF" ? "#00000048" : "#FFFFFF55" };
}
