import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { api, message } from './data';
import { API_URL } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { Button, Card, Field, TabsRow, Txt, styles, usePalette } from './ui';
import { QueryState } from './UserScreens';

type Photo = { id: number; assignmentId: number; kind: string; note: string; workflowStatus: string; createdAt: string };
const names: Record<string, string> = { CustomerPickup: 'Received from customer', ShopDropoff: 'Handed over to shop', ShopCollection: 'Received from shop', CustomerDelivery: 'Handed over to customer' };
function SavedPhoto({ orderId, photo }: { orderId: number; photo: Photo }) {
  const token = useAuthStore(state => state.token);
  const [open, setOpen] = useState(false), [uri, setUri] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    if (!open || !token) return;
    let active = true; const controller = new AbortController(); setError('');
    void (async () => {
      try {
        const response = await fetch(`${API_URL}/api/delivery/orders/${orderId}/handover-photos/${photo.id}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load this handover photo. Close and reopen it to retry.');
        const reader = new FileReader(); reader.onloadend = () => { if (active) setUri(String(reader.result)); };
        reader.onerror = () => { if (active) setError('Unable to read the photo.'); }; reader.readAsDataURL(await response.blob());
      } catch (failure) { if (active) setError(message(failure)); }
    })();
    return () => { active = false; controller.abort(); };
  }, [open, orderId, photo.id, token]);
  return <View style={{ gap: 8 }}>
    <Txt style={{ fontWeight: '600' }}>{names[photo.kind] || photo.kind}</Txt>
    <Txt style={styles.muted}>{new Date(photo.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</Txt>
    {!!photo.note && <Txt>{photo.note}</Txt>}
    {open && (error ? <Txt accessibilityRole="alert">{error}</Txt> : uri ? <Image accessibilityLabel={names[photo.kind]} source={{ uri }} resizeMode="contain" style={{ height: 240, width: '100%', borderRadius: 12 }} /> : <ActivityIndicator accessibilityLabel="Loading handover photo" />)}
    <Button title={open ? 'Hide handover photo' : 'View handover photo'} compact outline onPress={() => setOpen(value => !value)} />
  </View>;
}

export function HandoverPhotos({ orderId, assignmentId, stage, canUpload = false }: { orderId: number; assignmentId?: number; stage?: string; canUpload?: boolean }) {
  const palette = usePalette(); const cache = useQueryClient();
  const query = useQuery({ queryKey: ['delivery', 'handover-photos', orderId], queryFn: () => api.get<Photo[]>(`/delivery/orders/${orderId}/handover-photos`), refetchInterval: 30000 });
  const choices = stage === 'Pickup' ? ['CustomerPickup', 'ShopDropoff'] : ['ShopCollection', 'CustomerDelivery'];
  const [kind, setKind] = useState(choices[1]), [note, setNote] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''); const lock = useRef(false);
  const [choosing, setChoosing] = useState(false);
  async function choose(camera = false) {
    if (lock.current || choosing) return;
    setChoosing(true); setError('');
    try {
      if (camera && (await ImagePicker.requestCameraPermissionsAsync()).status !== 'granted') throw new Error('Allow camera access or choose an existing laundry photo.');
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.85, exif: false };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) throw new Error('Choose a JPG, PNG or WebP photo.');
      if (asset.base64.length > 8 * 1024 * 1024) throw new Error('Choose a photo smaller than 6 MB.');
      setPhoto({ uri: asset.uri, base64: asset.base64 });
    } catch (failure) { setError(message(failure)); } finally { setChoosing(false); }
  }
  async function upload() {
    if (lock.current || !photo || !assignmentId) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await api.put(`/delivery/assignments/${assignmentId}/photos`, { kind, note: note.trim(), imageBase64: photo.base64 });
      setPhoto(null); setNote(''); await cache.invalidateQueries({ queryKey: ['delivery', 'handover-photos', orderId] });
    } catch (failure) { setError(message(failure)); } finally { lock.current = false; setBusy(false); }
  }
  return <Card style={{ gap: 14 }}>
    <Txt style={styles.heading}>Laundry handover photos</Txt>
    <Txt style={styles.muted}>{canUpload ? `Required to complete this trip: save a photo of the laundry handed over to the ${stage === 'Pickup' ? 'shop' : 'customer'}. Selecting a photo is not enough; tap Save handover photo after uploading.` : 'Saved proof of the physical laundry handover. Recipient receipt is confirmed separately.'}</Txt>
    <QueryState loading={query.isLoading} error={query.error} retry={() => query.refetch()} />
    {!query.isLoading && !query.error && !query.data?.length && <Txt style={styles.muted}>No handover photos yet.</Txt>}
    {query.data?.map(item => <SavedPhoto key={item.id} orderId={orderId} photo={item} />)}
    {canUpload && !!assignmentId && <View style={{ gap: 12 }}>
      <Txt style={{ fontWeight: '600' }}>Attach a handover photo</Txt>
      <TabsRow items={choices.map(value => names[value])} value={names[kind]} onChange={value => { if (!lock.current) setKind(choices.find(kind => names[kind] === value) || choices[0]); }} />
      <Field label="Photo note (optional)" value={note} onChangeText={setNote} maxLength={500} editable={!busy} multiline placeholder="For example: laundry bags received at the shop counter." />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button title="Choose laundry photo" outline compact busy={choosing} disabled={busy} onPress={() => { void choose(); }} />
        {Platform.OS !== 'web' && <Button title="Take laundry photo" outline compact disabled={busy || choosing} onPress={() => { void choose(true); }} />}
      </View>
      {photo && <><Image accessibilityLabel="Selected laundry photo" source={{ uri: photo.uri }} resizeMode="contain" style={{ width: '100%', height: 220, borderRadius: 12 }} />
        <Button title="Remove selected photo" compact outline disabled={busy} onPress={() => setPhoto(null)} /></>}
      {!!error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{error}</Txt>}
      <Button title="Save handover photo" busy={busy} disabled={!photo || choosing} onPress={() => { void upload(); }} />
      <Txt style={{ fontSize: 11, color: palette.muted }}>JPG, PNG or WebP · up to 6 MB · up to 3 photos per handover type</Txt>
    </View>}
  </Card>;
}
