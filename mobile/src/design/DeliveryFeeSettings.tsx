import { useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, message } from './data';
import { Button, Card, Field, Txt, styles } from './ui';
import { FormError } from './AddressFields';

type Policy = { baseFee: string; ratePerKm: string; minimumFee: string; commissionPercent: string; revision: number };
const initial = { baseFee: '30', ratePerKm: '10', minimumFee: '30', commissionPercent: '15', revision: 0 };
export function DeliveryFeeSettings() {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const query = useQuery({ queryKey: ['admin-delivery-fees'], queryFn: () => api.get<Policy | null>('/admin/delivery-fees') });
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (query.data) setValues(query.data); }, [query.data]);
  async function save() {
    if (busy) return;
    const { revision, ...fields } = values;
    if (Object.values(fields).some(value => !String(value).trim() || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) || Number(values.commissionPercent) > 100) {
      setError('Enter non-negative amounts with up to two decimal places and a commission from 0 to 100%.'); return;
    }
    setBusy(true); setError(''); setSaved(false);
    try {
      const policy = await api.put<Policy>('/admin/delivery-fees', { revision, ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, Number(value)])) });
      setValues(policy); setSaved(true); await query.refetch();
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  return <Card testID="admin-delivery-fee-settings" style={{ gap: desktop ? 16 : 12, padding: desktop ? 28 : 20 }}>
    <View style={{ gap: 6, maxWidth: 820 }}>
      <Txt style={styles.heading}>Delivery fee settings</Txt>
      <Txt style={styles.muted}>Combined fee = base fee + total road kilometers × rate, subject to the minimum. The base and minimum apply once per booking. Only selected rider trips are charged.</Txt>
    </View>
    {!query.isLoading && !query.data && !query.error && <Txt>Save rates to enable delivery quotes. Suggested amounts below are not active until saved.</Txt>}
    <View testID="delivery-fee-fields" style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: desktop ? 4 : 0, maxWidth: desktop ? 1080 : undefined }}>
      {(['baseFee', 'ratePerKm', 'minimumFee', 'commissionPercent'] as const).map((key, index) => <View key={key} style={{ width: desktop ? '47%' : '100%', minWidth: 0, flexGrow: desktop ? 0 : 1 }}><Field label={['Base fee (PHP)', 'Rate per kilometer (PHP)', 'Minimum combined fee (PHP)', 'Platform commission (%)'][index]} keyboardType="decimal-pad" value={String(values[key])} onChangeText={value => { setSaved(false); setValues(current => ({ ...current, [key]: value })); }} /></View>)}
    </View>
    <Txt style={[styles.muted, desktop ? { maxWidth: 1080 } : undefined]}>Riders receive the balance, divided between pickup and return by road distance. Confirmed bookings and unexpired customer quotes keep their saved rates.</Txt>
    <FormError error={error || (query.error ? message(query.error) : null)} />
    {saved && <Txt accessibilityLiveRegion="polite">Delivery rates saved.</Txt>}
    <View style={{ maxWidth: desktop ? 360 : undefined }}><Button title="Save delivery rates" busy={busy} disabled={query.isLoading || !!query.error} onPress={save} /></View>
    {!!query.error && <Button title="Retry loading rates" outline onPress={() => { void query.refetch(); }} />}
  </Card>;
}
