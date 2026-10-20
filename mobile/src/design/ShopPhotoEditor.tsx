import { useState, useRef } from "react";
import { View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, Trash2 } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { api, confirmAction, message, type Shop } from "./data";
import { Button, Card, Txt, usePalette, styles } from "./ui";
import { FormError } from "./AddressFields";
import { ShopPhoto } from "./ShopPhoto";

export function ShopPhotoEditor({ shop }: { shop: Shop }) {
  const palette = usePalette();
  const cache = useQueryClient();
  const active = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  async function refresh(photoUrl: string | null) {
    cache.setQueryData<Shop>(["shop", "owner", shop.userId], current => current ? { ...current, photoUrl } : current);
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["shop"] }),
      cache.invalidateQueries({ queryKey: ["shops"] }),
    ]);
  }
  async function upload() {
    if (active.current) return;
    active.current = true; setBusy(true); setError(null); setSuccess(null);
    try {
      // The system picker gives access only to the image the owner selects;
      // requesting broader photo-library access is unnecessary.
      const selected = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: false,
        allowsEditing: true, aspect: [4, 3], quality: 0.8, base64: true, exif: false });
      if (selected.canceled) return;
      const image = selected.assets[0];
      if (!image.base64) { setError("Unable to read that photo. Please choose a JPG, PNG or WebP image."); return; }
      if (image.base64.length > 8 * 1024 * 1024) { setError("Choose a photo smaller than 6 MB."); return; }
      const saved = await api.put<{ photoUrl: string }>(`/shops/${shop.id}/photo`, { imageBase64: image.base64 });
      await refresh(saved.photoUrl);
      setSuccess("Shop photo updated. Customers can now see it on your shop cards.");
    } catch (failure) { setError(message(failure)); }
    finally { active.current = false; setBusy(false); }
  }
  async function remove() {
    if (active.current) return;
    active.current = true; setError(null); setSuccess(null);
    try {
      if (!await confirmAction("Remove shop photo", "Customers will see the photo placeholder until you upload another photo.", { confirmLabel: "Remove Photo", destructive: true })) return;
      setBusy(true);
      await api.delete(`/shops/${shop.id}/photo`);
      await refresh(null);
      setSuccess("Shop photo removed.");
    } catch (failure) { setError(message(failure)); }
    finally { active.current = false; setBusy(false); }
  }
  return <Card>
    <Txt style={styles.heading}>Shop photo</Txt>
    <Txt style={styles.muted}>Show customers your storefront or laundry space. Choose a JPG, PNG or WebP photo up to 6 MB.</Txt>
    <ShopPhoto name={shop.shopName} photoUrl={shop.photoUrl} style={{ maxHeight: 280 }} />
    <View style={[styles.row, { flexWrap: "wrap" }]}>
      <Button title={shop.photoUrl ? "Change shop photo" : "Upload shop photo"} busy={busy} onPress={upload}
        icon={<Camera size={18} color="white" />} />
      {!!shop.photoUrl && <Button title="Remove photo" outline disabled={busy} color={palette.danger} onPress={remove}
        icon={<Trash2 size={18} color={palette.danger} />} />}
    </View>
    <FormError error={error} />
    {!!success && <Txt accessibilityLiveRegion="polite" style={{ color: palette.successInk }}>{success}</Txt>}
  </Card>;
}
