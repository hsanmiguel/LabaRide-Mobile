import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { API_URL } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { api, message, useOwnedShop } from './data';
import { Button, Card, Choice, Field, Section, Txt, styles, usePalette } from './ui';

const labels: Record<string, string> = { DTIRegistration: 'DTI business registration', SECRegistration: 'SEC business registration', TinProof: 'TIN ID / proof of TIN', MayorsPermit: 'Mayor’s Permit' };
type Document = { type: string; status: string; reviewReason?: string; updatedAt: string };
type Requirements = { approvalStatus: string; applicationVersion: number; requirementsVersion: number; documents: Document[]; missing: string[]; unverified: string[]; canApprove: boolean };
export function ShopRequirementsPanel({ shopId, admin = false, title = 'Shop verification documents', onReady }: { shopId: number; admin?: boolean; title?: string; onReady?: (ready: boolean, version: number) => void }) {
  const user = useAuthStore(state => state.user);
  const palette = usePalette();
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['shop-documents', shopId, user?.id], queryFn: () => api.get<Requirements>(`/shops/${shopId}/documents`), refetchInterval: 15000 });
  const [registration, setRegistration] = useState('DTIRegistration');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const data = query.data;
  const types = data?.documents.map(doc => doc.type).sort().join(',') || '';
  useEffect(() => { if (types.includes('SECRegistration') && !types.includes('DTIRegistration')) setRegistration('SECRegistration'); }, [types]);
  useEffect(() => { if (data) onReady?.(!busy && data.canApprove, data.applicationVersion); }, [data, busy, onReady]);
  async function refresh() {
    await Promise.all(['shop-documents', 'admin-shops', 'shop', 'shops'].map(key => cache.invalidateQueries({ queryKey: [key] })));
  }
  async function upload(type: string) {
    if (busy) return; setBusy(type); setError(''); setNotice('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 1, exif: false, allowsEditing: false });
      if (result.canceled) return;
      const imageBase64 = result.assets[0]?.base64;
      if (!imageBase64 || imageBase64.length > 8 * 1024 * 1024) throw new Error('Choose a clear JPG, PNG or WebP image smaller than 6 MB.');
      await api.put(`/shops/${shopId}/documents/${type}`, { imageBase64 });
      await refresh(); setNotice(`${labels[type]} uploaded privately. It needs admin verification.`);
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(''); }
  }
  async function review(doc: Document, status: string, reason?: string) {
    if (busy) return; setBusy(doc.type); setError(''); setNotice('');
    try {
      await api.put(`/shops/${shopId}/documents/${doc.type}/review`, { status, reason, expectedUpdatedAt: doc.updatedAt });
      await refresh(); setNotice(status === 'Verified' ? `${labels[doc.type]} verified.` : 'Correction request sent to the shop owner.');
    } catch (failure) { setError(message(failure)); await query.refetch(); }
    finally { setBusy(''); }
  }
  const editable = !!data && ['Pending', 'Rejected'].includes(data.approvalStatus);
  const registrations = admin ? data?.documents.filter(doc => ['DTIRegistration', 'SECRegistration'].includes(doc.type)).map(doc => doc.type) || [] : [registration];
  const visible = [...(registrations.length ? registrations : ['DTIRegistration']), 'TinProof', 'MayorsPermit'];
  return <Card><Section title={title} /><Txt style={styles.muted}>Required: DTI or SEC registration, TIN proof, and a Mayor’s Permit. Admins review these documents before a new shop can be enabled.</Txt><Txt style={{ fontSize: 12, lineHeight: 20, color: palette.muted }}>Documents are private to the owner and admins. Upload clear JPG, PNG or WebP images up to 6 MB. “Verified” means reviewed by LabaRide, not an automated government check.</Txt>
    {query.isLoading && <ActivityIndicator accessibilityLabel="Loading shop requirements" />}
    {!!query.error && <><Txt accessibilityRole="alert" style={{ color: palette.danger }}>{message(query.error)}</Txt><Button title="Retry shop requirements" compact outline onPress={() => { void query.refetch(); }} /></>}
    {data && <>
      {data.requirementsVersion === 0 && <Txt style={styles.muted}>This shop was approved before document checks were introduced. Approval does not mean these documents have been verified.</Txt>}
      <Txt accessibilityLiveRegion="polite" style={{ color: data.canApprove ? palette.successInk : palette.warning }}>{data.canApprove ? data.approvalStatus === 'Approved' ? 'Required documents verified. Shop approved.' : 'Required documents verified. The admin can approve shop access.' : data.approvalStatus === 'Rejected' ? 'Correct the flagged documents or shop details, then resubmit for review.' : data.missing.length ? `Still needed: ${data.missing.join(', ')}` : 'Documents uploaded. Waiting for admin verification.'}</Txt>
      {!admin && editable && <View><Txt style={{ fontWeight: '600' }}>Business registration (choose one)</Txt><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}><Choice label="DTI" selected={registration === 'DTIRegistration'} onPress={() => setRegistration('DTIRegistration')} /><Choice label="SEC" selected={registration === 'SECRegistration'} onPress={() => setRegistration('SECRegistration')} /></View></View>}
      {visible.map(type => <ShopDocumentRow key={type} shopId={shopId} type={type} doc={data.documents.find(doc => doc.type === type)} admin={admin} editable={editable} reviewable={data.approvalStatus === 'Pending'} busy={!!busy} upload={() => { void upload(type); }} review={review} />)}
    </>}
    {!!notice && <Txt accessibilityLiveRegion="polite" style={{ color: palette.successInk }}>{notice}</Txt>}
    {!!error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{error}</Txt>}
  </Card>;
}

function ShopDocumentRow({ shopId, type, doc, admin, editable, reviewable, busy, upload, review }: { shopId: number; type: string; doc?: Document; admin: boolean; editable: boolean; reviewable: boolean; busy: boolean; upload: () => void; review: (doc: Document, status: string, reason?: string) => Promise<void> }) {
  const palette = usePalette(), token = useAuthStore(state => state.token);
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false), [enlarged, setEnlarged] = useState(false), [uri, setUri] = useState(''), [error, setError] = useState('');
  const [correcting, setCorrecting] = useState(false), [reason, setReason] = useState('');
  useEffect(() => { setUri(''); setError(''); if (!open || !doc || !token) return;
    let live = true; const controller = new AbortController();
    void (async () => { try {
      const response = await fetch(`${API_URL}/api/shops/${shopId}/documents/${type}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Could not open this private document. Close it and try again.');
      const reader = new FileReader(); reader.onloadend = () => { if (live) setUri(String(reader.result)); }; reader.onerror = () => { if (live) setError('Could not read document.'); }; reader.readAsDataURL(await response.blob());
    } catch (failure) { if (live) setError(message(failure)); } })();
    return () => { live = false; controller.abort(); };
  }, [open, doc?.updatedAt, token, shopId, type]);
  return <View testID={`shop-document-${type}`} style={{ borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 16, gap: 12 }}>
    <View style={styles.between}><Txt style={{ fontWeight: '600', flexShrink: 1 }}>{labels[type]}</Txt><Txt style={{ color: doc?.status === 'Verified' ? palette.successInk : doc?.status === 'Rejected' ? palette.danger : palette.muted }}>{!doc ? 'Not uploaded' : doc.status === 'Rejected' ? 'Needs correction' : doc.status === 'Verified' ? 'Verified ✓' : 'Pending review'}</Txt></View>
    {!!doc?.reviewReason && <Txt style={{ color: palette.danger }}>{doc.reviewReason}</Txt>}
    {doc && <Button title={open ? 'Hide private document' : 'View private document'} compact outline onPress={() => setOpen(value => !value)} />}
    {open && (error ? <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{error}</Txt> : uri ? <><Image accessibilityLabel={labels[type]} source={{ uri }} resizeMode="contain" style={{ width: '100%', height: 280, backgroundColor: palette.surface, borderRadius: 12 }} /><Button title="Enlarge document" compact outline onPress={() => setEnlarged(true)} /></> : <ActivityIndicator accessibilityLabel="Loading private shop document" />)}
    {!admin && editable && <Button title={doc ? 'Replace document' : 'Upload document'} compact outline busy={busy} onPress={upload} />}
    {admin && doc && reviewable && <><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{doc.status !== 'Verified' && <Button title="Verify document" compact disabled={!uri || !!error || busy} onPress={() => { void review(doc, 'Verified'); }} />}<Button title="Needs correction" compact outline disabled={busy} color={palette.danger} onPress={() => setCorrecting(value => !value)} /></View>{!uri && doc.status !== 'Verified' && <Txt style={{ fontSize: 12, color: palette.muted }}>Open and inspect the document to enable verification.</Txt>}{correcting && <><Field label="Document correction reason" value={reason} onChangeText={setReason} multiline maxLength={1000} /><Button title="Send correction request" compact disabled={reason.trim().length < 5 || busy} onPress={() => { void review(doc, 'Rejected', reason.trim()); }} /></>}</>}
    <Modal visible={enlarged && !!uri} transparent onRequestClose={() => setEnlarged(false)}><View style={{ flex: 1, backgroundColor: '#000D', padding: 20, paddingTop: 50, gap: 14 }}><Button title="Close document" onPress={() => setEnlarged(false)} /><Image accessibilityLabel="Enlarged private shop document" source={{ uri }} resizeMode="contain" style={{ width: '100%', height: height - 180 }} /></View></Modal>
  </View>;
}

export function ShopAccountCredibility() {
  const owned = useOwnedShop();
  if (owned.isLoading) return <Card><ActivityIndicator /></Card>;
  if (!owned.data) return <Card><Section title="Account Credibility" /><Txt>Shop verification documents are submitted with your shop application.</Txt><Button title="Open shop application" onPress={() => router.push('/register-shop' as Href)} /></Card>;
  return <ShopRequirementsPanel shopId={owned.data.id} title="Account Credibility" />;
}
