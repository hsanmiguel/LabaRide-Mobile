import { useLocalSearchParams } from "expo-router";
import { ShopMenuDesign } from "../../../src/design/UserScreens";
export default function Screen() {
  const params = useLocalSearchParams<{ shopId: string }>();
  return <ShopMenuDesign id={Number(params.shopId)} />;
}
