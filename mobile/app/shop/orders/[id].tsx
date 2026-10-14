import { Redirect, useLocalSearchParams } from "expo-router";
export default function Screen() {
  const params = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: "/shop/customers/orders/[id]", params }} />;
}
