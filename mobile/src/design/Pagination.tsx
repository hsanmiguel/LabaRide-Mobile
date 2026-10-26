import { View } from "react-native";
import { Button, Txt, styles } from "./ui";

export const ORDERS_PER_PAGE = 5;

export function PageControls({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / ORDERS_PER_PAGE));
  return <View style={{ gap: 12, paddingTop: 16 }}>
    <Txt style={styles.muted} accessibilityLiveRegion="polite">{total ? `Showing ${page * ORDERS_PER_PAGE + 1} - ${Math.min((page + 1) * ORDERS_PER_PAGE, total)} of ${total} orders` : "0 orders"}</Txt>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <Button title="Previous" outline compact disabled={page === 0} onPress={() => onChange(page - 1)} />
      <Txt style={{ fontSize: 12 }} accessibilityLiveRegion="polite">Page {page + 1} of {pages}</Txt>
      <Button title="Next" outline compact disabled={page >= pages - 1} onPress={() => onChange(page + 1)} />
    </View>
  </View>;
}

