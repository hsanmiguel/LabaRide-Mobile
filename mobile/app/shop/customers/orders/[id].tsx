import { Redirect, useLocalSearchParams } from "expo-router";

export default function OrderDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: "/shop/transactions/[flow]", params: { flow: "shop-transaction", id } }} />;
}
