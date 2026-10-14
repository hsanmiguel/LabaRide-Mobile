export type InterfaceRole = "customer" | "shop";

const shared = {
  ink: "#202033", white: "#FFFFFF", muted: "#626B7D",
  success: "#16865C", successInk: "#126B49", warning: "#9A5700", danger: "#BC3030",
};

export const themes = {
  customer: {
    ...shared, role: "customer" as const,
    primary: "#2457AD", hover: "#19458F", accent: "#3867FF",
    soft: "#EDF4FF", surface: "#F6F8FC", line: "#E4E9F2",
  },
  shop: {
    ...shared, role: "shop" as const,
    primary: "#321078", hover: "#4520A0", accent: "#6842D9",
    soft: "#F3EEFF", surface: "#F7F7FB", line: "#E8E8F0",
  },
};

// The route group represents the active interface. A shop owner can deliberately
// switch into customer mode; ownership alone must never override that choice.
export function interfaceRole(segments: readonly string[]): InterfaceRole {
  return segments[0] === "shop" ? "shop" : "customer";
}

export function rolePalette(role: InterfaceRole) {
  const theme = themes[role];
  return {
    ...theme,
    // Compatibility aliases for the migrated screens, always scoped to context.
    navy: theme.primary, blue: theme.primary, purple: theme.primary,
    welcome: theme.primary, lavender: theme.soft,
  };
}
