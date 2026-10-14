import { useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, MoreVertical, Trash2, UserRound } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "../api/client";
import { api, confirmAction, message, type Profile } from "./data";
import { Txt, usePalette } from "./ui";

function photoUri(userId: number, photoUrl?: string | null) {
  return photoUrl && new RegExp(`^/api/users/${userId}/photo\\?v=\\d+$`).test(photoUrl)
    ? `${API_URL.replace(/\/$/, "")}${photoUrl}` : undefined;
}

export function ProfilePhotoControl({ userId, photoUrl }: { userId: number; photoUrl?: string | null }) {
  const palette = usePalette();
  const cache = useQueryClient();
  const active = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string>();
  const uri = photoUri(userId, photoUrl);
  const showPhoto = !!uri && failedUrl !== uri;

  async function refresh(nextPhotoUrl: string | null) {
    cache.setQueryData<Profile>(["user", userId], current => current ? { ...current, photoUrl: nextPhotoUrl } : current);
    await cache.invalidateQueries({ queryKey: ["user", userId] });
  }

  async function upload() {
    if (active.current) return;
    active.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: false,
        allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true, exif: false });
      if (selection.canceled) return;
      const imageBase64 = selection.assets[0]?.base64;
      if (!imageBase64) { setError("Unable to read that photo. Please choose a JPG, PNG or WebP image."); return; }
      if (imageBase64.length > 8 * 1024 * 1024) { setError("Choose a photo smaller than 6 MB."); return; }
      const saved = await api.put<{ photoUrl: string }>(`/users/${userId}/photo`, { imageBase64 });
      await refresh(saved.photoUrl);
      setFailedUrl(undefined);
      setNotice("Profile photo updated.");
    } catch (failure) { setError(message(failure)); }
    finally { active.current = false; setBusy(false); }
  }

  async function remove() {
    if (active.current) return;
    if (!await confirmAction("Remove profile photo", "Your profile will show the default avatar again.")) return;
    active.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      await api.delete(`/users/${userId}/photo`);
      await refresh(null);
      setFailedUrl(undefined);
      setNotice("Profile photo removed.");
    } catch (failure) { setError(message(failure)); }
    finally { active.current = false; setBusy(false); }
  }

  return <View style={{ alignItems: "center", gap: 6 }}>
    <View style={{ width: 136, height: 136, alignItems: "center", justifyContent: "center" }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Profile photo options"
        accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => setMenuOpen(true)}
        style={({ pressed }) => ({ width: 132, height: 132, borderRadius: 66, backgroundColor: palette.soft, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.82 : 1 })}>
        {showPhoto ? <Image key={uri} source={{ uri }} accessibilityLabel="Profile photo" onError={() => setFailedUrl(uri)}
          style={{ width: 132, height: 132, borderRadius: 66 }} /> : <UserRound size={60} color={palette.primary} strokeWidth={1.7} />}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Profile photo options" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => setMenuOpen(true)}
        style={({ pressed }) => ({ position: "absolute", right: -1, bottom: -1, width: 38, height: 38, borderRadius: 19, backgroundColor: "white", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.line, opacity: pressed ? 0.78 : 1 })}>
        {busy ? <ActivityIndicator size="small" color={palette.primary} /> : <MoreVertical size={21} color={palette.primary} />}
      </Pressable>
    </View>
    {!!error && <Txt accessibilityLiveRegion="polite" style={{ maxWidth: 300, textAlign: "center", color: palette.danger, fontSize: 12 }}>{error}</Txt>}
    {!!notice && <Txt accessibilityLiveRegion="polite" style={{ color: palette.successInk, fontSize: 12 }}>{notice}</Txt>}
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(20, 28, 45, 0.28)" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close photo menu" onPress={() => setMenuOpen(false)} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
        <View onStartShouldSetResponder={() => true} style={{ width: "100%", maxWidth: 320, paddingVertical: 8, borderRadius: 18, backgroundColor: "white", borderWidth: 1, borderColor: palette.line, shadowColor: "#202033", shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Change photo" disabled={busy} onPress={() => { setMenuOpen(false); void upload(); }}
            style={({ pressed }) => ({ minHeight: 56, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: pressed ? palette.soft : "white" })}>
            <Camera size={19} color={palette.primary} /><Txt style={{ color: palette.ink, fontWeight: "500" }}>Change photo</Txt>
          </Pressable>
          <View style={{ height: 1, backgroundColor: palette.line, marginHorizontal: 16 }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" disabled={!photoUrl || busy} onPress={() => { setMenuOpen(false); void remove(); }}
            style={({ pressed }) => ({ minHeight: 56, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: pressed ? "#FEF2F2" : "white", opacity: !photoUrl || busy ? 0.5 : 1 })}>
            <Trash2 size={19} color={palette.danger} /><Txt style={{ color: palette.danger, fontWeight: "500" }}>Remove photo</Txt>
          </Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}
