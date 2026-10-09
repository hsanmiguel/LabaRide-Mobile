import { Redirect, useLocalSearchParams, useSegments, router } from "expo-router";
import { flowTarget, legacyShopFlows } from "../navigation/flow-target";
import {
  OnboardingScreen,
  RecoveryDesign,
  SuccessDesign,
  UserDetailsDesign,
} from "./AuthScreens";
import { ShopsDesign, ShopInfoDesign, ShopMenuDesign } from "./UserScreens";
import {
  ActivitiesDesign,
  CancelOrderDesign,
  CheckoutDesign,
  LaundryCountDesign,
  OrderDetailsDesign,
  OrderSummaryDesign,
  PaymentDesign,
  ScheduleDesign,
  VouchersDesign,
} from "./OrderScreens";
import {
  AccountConfirmationDesign,
  AddressesDesign,
  ChangePasswordDesign,
  EditProfileDesign,
  LocationDesign,
  TwoFactorDesign,
} from "./ProfileScreens";
import {
  CustomersDesign,
  DeclineOrderDesign,
  RegisterShopDesign,
  ShopDetailsFormDesign,
  ShopOrderDetailsDesign,
} from "./ShopScreens";
import { NotificationsDesign } from "./NotificationsScreen";
import { Empty, Screen } from "./ui";
import type { Order } from "./data";
import { useFlowNavigation } from "./data";

export default function DesignFlow() {
  const segments = useSegments() as string[];
  const { replaceFlow, inShop } = useFlowNavigation();
  const params = useLocalSearchParams<{
    flow: string;
    id?: string;
    email?: string;
    status?: string;
    reason?: string;
    method?: string;
    checkout?: string;
  }>();
  const { flow: screen, email, reason, method } = params;
  const id = Number(params.id);
  const checkout = params.checkout === "true";
  const legacyTab = Object.prototype.hasOwnProperty.call(legacyShopFlows, screen)
    ? legacyShopFlows[screen]
    : undefined;
  if (segments[0] !== "shop" && legacyTab) {
    return <Redirect href={flowTarget(screen, params, ["shop", legacyTab])} />;
  }
  if (screen === "how-it-works") return <OnboardingScreen how />;
  if (screen === "user-details") return <UserDetailsDesign />;
  if (screen === "registration-complete")
    return (
      <SuccessDesign
        title="Registration Complete!"
        subtitle="Your account is ready."
        action="Continue"
        onPress={() => router.replace(segments[0] === "shop" ? "/shop/home" : "/(user)/home")}
      />
    );
  if (
    [
      "forgot-password",
      "verify-email",
      "password-reset",
      "new-password",
      "password-changed",
    ].includes(screen)
  )
    return <RecoveryDesign stage={screen} email={email} />;
  if (screen === "search") return <ShopsDesign search />;
  if (["map", "view-shops", "shop-location"].includes(screen))
    return <ShopsDesign map />;
  if (["shop-about", "shop-information"].includes(screen))
    return <ShopInfoDesign id={id} about={screen === "shop-about"} />;
  if (screen === "shop-menu") return <ShopMenuDesign id={id} />;
  if (screen === "order-summary") return <OrderSummaryDesign />;
  if (screen === "notifications") return <NotificationsDesign />;
  if (screen === "shop-notifications") return <NotificationsDesign shopMode />;
  if (screen === "history" || screen === "past-orders")
    return <ActivitiesDesign history past={screen === "past-orders"} />;
  if (screen === "laundries") return <LaundryCountDesign />;
  if (screen === "checkout") return <CheckoutDesign />;
  if (screen === "delivery-schedule") return <ScheduleDesign />;
  if (screen === "payment-method") return <PaymentDesign />;
  if (screen === "vouchers") return <VouchersDesign />;
  if (screen === "transaction-details" || screen === "order-delivered")
    return (
      <OrderDetailsDesign
        id={id}
        full
        delivered={screen === "order-delivered"}
      />
    );
  if (screen === "cancel-order" || screen === "cancel-order-confirm")
    return <CancelOrderDesign id={id} />;
  if (screen === "order-complete")
    return (
      <SuccessDesign
        title="Order Complete"
        subtitle="Thank you for your order! You can track the status in the Activity tab."
        action="Proceed"
        onPress={() =>
          inShop ? replaceFlow("history") : router.replace({
            pathname: "/(user)/home",
            params: { transactionId: String(id) },
          })
        }
      />
    );
  if (screen === "order-cancelled")
    return (
      <SuccessDesign
        title="Order Cancelled"
        action="Continue"
        onPress={() => inShop ? replaceFlow("history") : router.replace("/(user)/activities")}
      />
    );
  if (screen === "edit-profile" || screen === "account-information")
    return <EditProfileDesign account={screen === "account-information"} />;
  if (screen === "change-password" || screen === "security")
    return <ChangePasswordDesign security={screen === "security"} />;
  if (screen === "delete-account" || screen === "logout")
    return <AccountConfirmationDesign logout={screen === "logout"} />;
  if (screen === "account-deleted")
    return (
      <SuccessDesign
        title="Account Deleted"
        subtitle="We hope to see you again"
        action="Log In"
        onPress={() => router.replace("/(auth)/login")}
      />
    );
  if (["choose-2fa", "enter-2fa", "2fa-complete"].includes(screen))
    return <TwoFactorDesign stage={screen} method={method} />;
  if (screen === "addresses") return <AddressesDesign checkout={checkout} />;
  if (
    [
      "add-location",
      "current-location",
      "confirm-location",
      "add-address",
    ].includes(screen)
  )
    return <LocationDesign stage={screen} checkout={checkout} />;
  if (screen === "register-shop") return <RegisterShopDesign />;
  if (screen === "shop-details") return <ShopDetailsFormDesign />;
  if (screen === "shop-customers")
    return (
      <CustomersDesign
        filter={
          ["Pending", "Processing", "Completed", "Cancelled"].includes(
            params.status || "",
          )
            ? (params.status as Order["status"])
            : undefined
        }
      />
    );
  if (screen === "shop-transaction")
    return <ShopOrderDetailsDesign id={id} transaction />;
  if (
    [
      "decline-order",
      "decline-closed",
      "decline-busy",
      "decline-services",
    ].includes(screen)
  )
    return <DeclineOrderDesign id={id} stage={screen} reason={reason} />;
  if (screen === "order-declined")
    return (
      <SuccessDesign
        title="Order Cancelled"
        purple
        action="Continue"
        onPress={() => router.replace("/shop/customers")}
      />
    );
  return (
    <Screen title="LabaRide">
      <Empty
        title="Page not found"
        action="Go Home"
        onPress={() => router.replace(segments[0] === "shop" ? "/shop/home" : "/(user)/home")}
      />
    </Screen>
  );
}
