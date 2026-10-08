import { useLocalSearchParams } from "expo-router";
import { ShopOrderDetailsDesign } from "../../../src/design/ShopScreens";
export default function Screen() {
  const params = useLocalSearchParams<{ id: string }>();
  return <ShopOrderDetailsDesign id={Number(params.id)} />;
}
