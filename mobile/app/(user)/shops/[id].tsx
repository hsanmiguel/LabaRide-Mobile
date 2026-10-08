import { useLocalSearchParams } from "expo-router";
import { ShopInfoDesign } from "../../../src/design/UserScreens";
export default function Screen() {
  const params = useLocalSearchParams<{ id: string }>();
  return <ShopInfoDesign id={Number(params.id)} />;
}
