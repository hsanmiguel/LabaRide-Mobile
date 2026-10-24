import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { message } from './data';
import { Button, Card, Field, Section, Txt, money, styles, usePalette } from './ui';

export type WeightEvidence = { id: number; kilos: string | number; totalAmount: string | number; note: string; createdAt: string; actor: { name: string } };

export function WeightUpdateForm({ kilos, busy, save }: { kilos: string; busy: boolean; save: (kilos: number, note: string, imageBase64: string) => Promise<boolean> }) {
  const palette = usePalette();
  const [weight, setWeight] = useState(String(kilos));
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [error, setError] = useState('');
  const [choosing, setChoosing] = useState(false);
  async function choose(camera = false) {
    setError(''); setChoosing(true);
    try {
      if (camera && (await ImagePicker.requestCameraPermissionsAsync()).status !== 'granted') throw new Error('Allow camera access or choose an existing scale photo.');
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.9, exif: false, allowsEditing: false };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) throw new Error('Could not read this photo. Choose a JPG, PNG or WebP image.');
      if (asset.base64.length > 8 * 1024 * 1024) throw new Error('Choose a photo smaller than 6 MB.');
      setPhoto({ uri: asset.uri, base64: asset.base64 });
    } catch (failure) { setError(message(failure)); }
    finally { setChoosing(false); }
  }
  async function submit() {
    setError('');
    const kilos = Number(weight);
    if (!Number.isFinite(kilos) || kilos <= 0 || kilos > 10000 || Math.abs(kilos * 100 - Math.round(kilos * 100)) > 0.00001) { setError('Enter a valid weight with up to two decimal places.'); return; }
    if (!photo) { setError('Add a scale photo before updating the weight.'); return; }
    if (note.trim().length < 5) { setError('Add a short explanation of the measured weight (at least 5 characters).'); return; }
    if (await save(kilos, note.trim(), photo.base64)) { setPhoto(null); setNote(''); }
  }
  return <View style={{ gap: 14, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 20 }}>
    <Txt style={{ fontSize: 17, fontWeight: '600' }}>Measured weight & scale photo</Txt>
    <Txt style={styles.muted}>Place the laundry on the scale. Show the laundry and a readable kilogram display in one clear photo. The customer will see it with the updated price.</Txt>
    <Field label="Measured weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" editable={!busy} />
    {photo ? <View style={{ gap: 10 }}><Image source={{ uri: photo.uri }} accessibilityLabel="Selected scale photo" resizeMode="contain" style={{ width: '100%', height: 240, borderRadius: 12, backgroundColor: palette.surface }} /><Button title="Remove selected photo" compact outline disabled={busy || choosing} onPress={() => setPhoto(null)} /></View> : <View style={{ padding: 20, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.line, gap: 6 }}><Txt style={{ fontWeight: '600' }}>Scale photo required</Txt><Txt style={styles.muted}>Keep the reading sharp and avoid including faces or other customers’ details.</Txt></View>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {Platform.OS !== 'web' && <Button title="Take scale photo" compact outline disabled={busy || choosing} onPress={() => { void choose(true); }} />}
      <Button title={photo ? 'Replace scale photo' : 'Choose scale photo'} compact outline busy={choosing} disabled={busy} onPress={() => { void choose(); }} />
    </View>
    <Field label="Weight explanation" value={note} onChangeText={setNote} editable={!busy} multiline maxLength={1000} placeholder="For example: weighed with the laundry basket removed." />
    {!!error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{error}</Txt>}
    <Button title="Save weight, photo & final price" busy={busy} disabled={choosing} onPress={() => { void submit(); }} />
  </View>;
}

function ScalePhoto({ orderId, evidence, initiallyOpen }: { orderId: number; evidence: WeightEvidence; initiallyOpen: boolean }) {
  const token = useAuthStore(state => state.token);
  const palette = usePalette();
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(initiallyOpen);
  const [uri, setUri] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [enlarged, setEnlarged] = useState(false);
  useEffect(() => {
    setUri(''); setError('');
    if (!open || !token) return;
    let live = true; const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`${API_URL}/api/delivery/orders/${orderId}/weight-evidence/${evidence.id}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load the scale photo. Please try again.');
        const reader = new FileReader();
        reader.onloadend = () => { if (live) setUri(String(reader.result)); };
        reader.onerror = () => { if (live) setError('Unable to read the scale photo.'); };
        reader.readAsDataURL(await response.blob());
      } catch (failure) { if (live) setError(message(failure)); }
    })();
    return () => { live = false; controller.abort(); };
  }, [open, token, orderId, evidence.id, attempt]);
  return <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 16 }}>
    <View style={styles.between}><Txt style={{ fontWeight: '700', fontSize: 18 }}>{Number(evidence.kilos).toFixed(2)} kg</Txt><Txt style={{ color: palette.primary, fontWeight: '600' }}>Order total: {money(evidence.totalAmount)}</Txt></View>
    <Txt style={styles.muted}>{evidence.actor.name} · {new Date(evidence.createdAt).toLocaleString([], { timeZone: 'Asia/Manila' })}</Txt>
    <Txt>{evidence.note}</Txt>
    {open && (error ? <View style={{ gap: 10 }}><Txt accessibilityRole="alert" style={{ color: palette.danger }}>{error}</Txt><Button title="Retry scale photo" compact outline onPress={() => setAttempt(value => value + 1)} /></View> : uri ? <><Image accessibilityLabel={`Shop scale photo for ${evidence.kilos} kilograms`} source={{ uri }} resizeMode="contain" style={{ width: '100%', height: width < 480 ? 240 : 320, backgroundColor: palette.surface, borderRadius: 12 }} /><Button title="Enlarge scale photo" compact outline onPress={() => setEnlarged(true)} /></> : <ActivityIndicator accessibilityLabel="Loading scale photo" />)}
    <Button title={open ? 'Hide scale photo' : 'View scale photo'} compact outline onPress={() => setOpen(value => !value)} />
    <Modal visible={enlarged && !!uri} transparent animationType="fade" onRequestClose={() => setEnlarged(false)}><View style={{ flex: 1, backgroundColor: '#000000DD', padding: 20, paddingTop: 50, justifyContent: 'center', gap: 14 }}><Button title="Close scale photo" onPress={() => setEnlarged(false)} /><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}><Image accessibilityLabel="Enlarged scale photo" source={{ uri }} resizeMode="contain" style={{ width: '100%', height: height - 180 }} /></ScrollView></View></Modal>
  </View>;
}

export function WeightEvidenceCard({ orderId, evidence }: { orderId: number; evidence: WeightEvidence[] }) {
  if (!evidence.length) return null;
  return <Card><Section title="Measured weight & scale photos" /><Txt style={styles.muted}>Photos and measurements submitted by the laundry shop. The latest measurement appears first; previous records stay available.</Txt>{evidence.map((item, index) => <ScalePhoto key={item.id} orderId={orderId} evidence={item} initiallyOpen={index === 0} />)}</Card>;
}
