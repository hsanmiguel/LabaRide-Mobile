import { useLocalSearchParams } from "expo-router";
import { ShopOrderDetailsDesign } from "../../../../src/design/ShopScreens";

export default function OrderDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ShopOrderDetailsDesign id={Number(id)} />;
}
