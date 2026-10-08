import { useLocalSearchParams } from "expo-router";
import { OrderDetailsDesign } from "../../../../src/design/OrderScreens";
export default function Screen() {
  const params = useLocalSearchParams<{ id: string }>();
  return <OrderDetailsDesign id={Number(params.id)} />;
}
