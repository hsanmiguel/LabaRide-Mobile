import { ListTree } from "lucide-react-native";
import { useFlowNavigation } from "./data";
import { Button } from "./ui";

export function LiveOperationsButton() {
  const { go } = useFlowNavigation();
  return <Button title="Live operations" icon={<ListTree size={20} color="white" />} onPress={() => go("shop-live-operations")} />;
}
