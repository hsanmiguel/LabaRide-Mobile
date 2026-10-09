export const shopTabs = ["home", "transactions", "services", "customers", "profile"] as const;
export type ShopTab = (typeof shopTabs)[number];

const shopFlowPaths = {
  home: "/shop/home/[flow]",
  transactions: "/shop/transactions/[flow]",
  services: "/shop/services/[flow]",
  customers: "/shop/customers/[flow]",
  profile: "/shop/profile/[flow]",
} as const;

export const legacyShopFlows: Record<string, ShopTab> = {
  "shop-notifications": "home",
  "shop-location": "home",
  "shop-customers": "customers",
  "shop-transaction": "transactions",
  "shop-details": "profile",
  "account-information": "profile",
  security: "profile",
  "decline-order": "customers",
  "decline-closed": "customers",
  "decline-busy": "customers",
  "decline-services": "customers",
  "order-declined": "customers",
};

export function flowTarget(
  screen: string,
  params: Record<string, string> = {},
  segments: readonly string[] = [],
): {
  pathname: (typeof shopFlowPaths)[ShopTab] | "/(flows)/[flow]";
  params: Record<string, string> & { flow: string };
} {
  const tab = shopTabs.find((tab) => tab === segments[1]);
  // Account deletion ends the signed-in session and returns to the public flow.
  const pathname = segments[0] === "shop" && tab && screen !== "account-deleted"
    ? shopFlowPaths[tab]
    : "/(flows)/[flow]";
  return { pathname, params: { ...params, flow: screen } };
}
