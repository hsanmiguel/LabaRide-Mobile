import { useRef, useState } from 'react';
import { Linking, Modal, Platform, ScrollView, View } from 'react-native';
import { Phone } from 'lucide-react-native';
import { Button, Card, Txt, styles, usePalette } from './ui';
import { dialablePhone, openPhoneApp } from './phone-call';
import { copyPhone } from './copyPhone';

export function CallContactButton({ name, phone }: { name?: string; phone: string }) {
  const palette = usePalette();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);
  const number = dialablePhone(phone);
  async function dial() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await openPhoneApp(phone, url => Linking.openURL(url));
      if (Platform.OS === 'web') setNotice('Phone app requested. If nothing opens, copy the number and call from your phone.');
    } catch {
      setVisible(true);
      setError(number ? 'Could not open a phone app on this device. Use the number below to call from another phone.' : 'This contact has an invalid phone number. Ask the customer or shop to update it.');
    } finally { pending.current = false; setBusy(false); }
  }
  function call() {
    setError(''); setNotice('');
    if (Platform.OS === 'web' || !number) setVisible(true);
    else void dial();
  }
  return <>
    <Button title="Call" compact outline onPress={call} busy={busy} />
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && setVisible(false)}>
      <View style={{ flex: 1, backgroundColor: '#00000066', padding: 20, justifyContent: 'center' }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}><Card style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: 16 }}>
        <Phone size={28} color={palette.primary} /><Txt accessibilityRole="header" style={styles.heading}>Call contact</Txt>
        {!!name && <Txt style={{ fontWeight: '600' }}>{name}</Txt>}
        <Txt selectable accessibilityLabel="Contact phone number" style={{ fontSize: 24, lineHeight: 32, fontWeight: '700', color: palette.primary }}>{phone}</Txt>
        <Txt style={styles.muted}>{Platform.OS === 'web' ? 'Calling requires a phone app configured on this device. You can copy the number and use your phone instead.' : 'Press and hold the number to copy it, or open your phone app below.'}</Txt>
        {!number && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>This phone number needs updating before it can be dialed.</Txt>}
        {!!error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{error}</Txt>}
        {!!notice && <Txt accessibilityLiveRegion="polite" style={{ color: palette.primary }}>{notice}</Txt>}
        <Button title="Open phone app" busy={busy} disabled={!number} onPress={() => { void dial(); }} />
        {Platform.OS === 'web' && <Button title="Copy number" outline onPress={async () => { setNotice(await copyPhone(number || phone) ? 'Phone number copied.' : 'Could not copy automatically. Select the number above and copy it manually.'); }} />}
        <Button title="Close contact" outline disabled={busy} onPress={() => setVisible(false)} />
      </Card></ScrollView></View>
    </Modal>
  </>;
}
