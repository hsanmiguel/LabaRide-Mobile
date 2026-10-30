import { useEffect, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { router, type Href, Redirect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Bike, Clock3 } from 'lucide-react-native';
import { api, message, useProfile, type Profile } from './data';
import { Button, Card, Field, Screen, Txt, styles, usePalette } from './ui';
import { useAuthStore } from '../store/authStore';
import { useLogout } from './useLogout';
import { RiderOnboardingDesign } from './RiderRequirementsScreens';

export function RiderSignupDesign() {
  const [values, setValues] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const auth = useAuthStore();
  const cache = useQueryClient();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  function field(key: keyof typeof values) {
    const labels = { name: 'Full name', email: 'Email address', phone: 'Contact number', password: 'Password', confirmPassword: 'Confirm password' };
    const placeholders = { name: 'Your full name', email: 'you@example.com', phone: '09XX XXX XXXX', password: 'At least 6 characters', confirmPassword: 'Re-enter your password' };
    return <Field label={labels[key]} placeholder={placeholders[key]} appearance="soft"
      value={values[key]} onChangeText={value => setValues(current => ({ ...current, [key]: value }))}
      password={key === 'password' || key === 'confirmPassword'} autoCapitalize={key === 'name' ? 'words' : 'none'}
      autoComplete={key === 'name' ? 'name' : key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'new-password'}
      keyboardType={key === 'email' ? 'email-address' : key === 'phone' ? 'phone-pad' : 'default'} editable={!busy} />;
  }
  async function submit() {
    if (busy) return;
    if (!values.name.trim() || !values.email.trim() || !values.phone.trim() || values.password.length < 6 || values.password !== values.confirmPassword) {
      setError('Enter your name, email and contact number, with matching passwords of at least 6 characters.'); return;
    }
    setBusy(true); setError('');
    try {
      const result = await api.post<{ user: Profile; token: string }>('/auth/rider-signup', { ...values, name: values.name.trim(), email: values.email.trim().toLowerCase(), phone: values.phone.trim() });
      cache.clear(); await auth.setAuth(result.user, result.token);
      router.replace('/rider-application' as Href);
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  return <Screen title="Apply as a Rider" brandedHeader><View style={{ width: '100%', maxWidth: wide ? 1040 : 560, alignSelf: 'center', flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: wide ? 32 : 20 }}>
    <View style={{ width: wide ? 320 : '100%', padding: wide ? 28 : 0, borderRadius: 24, backgroundColor: wide ? palette.soft : undefined, gap: wide ? 24 : 12 }}>
      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: wide ? 'white' : palette.soft, alignItems: 'center', justifyContent: 'center' }}><Bike size={28} color={palette.primary} /></View>
      <View style={{ gap: 8 }}><Txt accessibilityRole="header" style={{ fontSize: wide ? 32 : 26, lineHeight: wide ? 40 : 34, fontWeight: '700' }}>Ride with LabaRide</Txt><Txt style={styles.muted}>Help your community with laundry pickups and deliveries. Start with your rider application.</Txt></View>
      {wide && <View style={{ gap: 22, paddingTop: 8 }}>{[
        ['Create your account', 'Tell us how to reach you.'],
        ['Get reviewed', 'An admin checks your application.'],
        ['Start riding', 'Go online after approval.'],
      ].map(([title, detail], index) => <View key={title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}><View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }}><Txt style={{ color: palette.primary, fontWeight: '600', fontSize: 12 }}>{index + 1}</Txt></View><View style={{ flex: 1, gap: 3 }}><Txt style={{ fontWeight: '600' }}>{title}</Txt><Txt style={{ fontSize: 12, color: palette.muted }}>{detail}</Txt></View></View>)}</View>}
    </View>
    <Card style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', padding: wide ? 28 : 20, borderRadius: 20, gap: 0 }}>
      <View style={{ gap: 4, marginBottom: 22 }}><Txt accessibilityRole="header" style={styles.heading}>Create your rider account</Txt><Txt style={{ color: palette.muted, fontSize: 12 }}>All fields are required.</Txt></View>
      {field('name')}
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 16 : 0 }}><View style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>{field('email')}</View><View style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>{field('phone')}</View></View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 16 : 0 }}><View style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>{field('password')}</View><View style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>{field('confirmPassword')}</View></View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12, backgroundColor: palette.soft, marginBottom: 18 }}><Clock3 size={17} color={palette.primary} style={{ marginTop: 2, flexShrink: 0 }} /><Txt style={{ flex: 1, fontSize: 12, lineHeight: 19, color: palette.muted }}>Create an account first, then complete personal details, motorcycle details, and private document uploads before submitting for admin review.</Txt></View>
      {!!error && <Txt accessibilityRole="alert" style={{ color: palette.danger, marginBottom: 14 }}>{error}</Txt>}
      <Button title="Create rider account" busy={busy} onPress={submit} icon={<ArrowRight size={18} color="white" />} style={{ minHeight: 48 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 }}><Txt style={{ color: palette.muted, fontSize: 12 }}>Already have an account?</Txt><Pressable accessibilityRole="button" accessibilityLabel="Already registered? Sign in" disabled={busy} onPress={() => router.replace('/(auth)/login')} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}><Txt style={{ color: palette.primary, fontWeight: '600', fontSize: 13 }}>Sign in</Txt></Pressable></View>
    </Card>
  </View></Screen>;
}

export function RiderApplicationDesign() {
  const auth = useAuthStore();
  const profile = useProfile();
  const logout = useLogout();
  const palette = usePalette();
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const status = profile.data?.riderApplicationStatus || auth.user?.riderApplicationStatus;
  async function checkStatus() {
    setError(''); setLastCheckedAt(null);
    try {
      const result = await profile.refetch({ throwOnError: true });
      if (!result.data) throw new Error('Could not retrieve your application status. Please try again.');
      setLastCheckedAt(Date.now());
    } catch (failure) { setError(message(failure)); }
  }
  useEffect(() => { const timer = setInterval(() => { void profile.refetch(); }, 15000); return () => clearInterval(timer); }, [profile.refetch]);
  useEffect(() => {
    if (profile.data?.isRider && auth.token) {
      void auth.setAuth(profile.data, auth.token).then(() => router.replace('/rider')).catch(failure => setError(message(failure)));
    }
  }, [profile.data?.isRider, auth.token]);
  if (!auth.user) return <Redirect href="/(auth)/login" />;
  if (status === 'Draft' || editing) return <RiderOnboardingDesign onSubmitted={() => { setEditing(false); void profile.refetch(); }} />;
  const pending = status === 'Pending';
  return <Screen title="Rider application" brandedHeader back={false}><View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', gap: 20 }}>
    <Card style={{ padding: 28, gap: 20 }}>
      {pending ? <Clock3 size={40} color={palette.primary} /> : <Bike size={40} color={palette.primary} />}
      <Txt accessibilityRole="header" style={styles.title}>{pending ? 'Application submitted' : status === 'Rejected' ? 'Application not approved' : status === 'Disabled' ? 'Rider access is paused' : 'Checking rider access'}</Txt>
      <Txt style={styles.muted}>{pending ? 'Your rider account is ready for review. An administrator must approve your application before you can go online or receive jobs.' : 'Review the feedback below or contact your LabaRide administrator.'}</Txt>
      <Txt>{auth.user.name}</Txt><Txt selectable style={styles.muted}>{auth.user.email}</Txt>
      {!!profile.data?.riderReviewReason && <Txt>{profile.data.riderReviewReason}</Txt>}
      {pending && <View style={{ gap: 10 }}><Txt>1. Application received</Txt><Txt>2. Admin reviews your details</Txt><Txt>3. Start accepting jobs after approval</Txt></View>}
      {!!profile.error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{message(profile.error)}</Txt>}
      {!!error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{error}</Txt>}
      {(status === 'Pending' || status === 'Rejected' || status === 'Disabled') && <Button title="Complete or edit requirements" outline onPress={() => setEditing(true)} />}
      {status === 'Pending' && <Txt style={styles.muted}>Your details and all required documents must be complete before approval.</Txt>}
      <Button title="Check application status" busy={profile.isFetching} onPress={checkStatus} />
      {lastCheckedAt !== null && !profile.error && <View style={{ padding: 14, borderRadius: 12, backgroundColor: palette.soft, gap: 6 }}>
        <Txt accessibilityLiveRegion="polite" style={{ color: palette.primary, fontWeight: '600' }}>{status === 'Pending' ? 'Status checked: still waiting for admin review.' : profile.data?.isRider ? 'Approved. Opening your rider dashboard…' : status === 'Rejected' ? 'Status checked: corrections are needed. See the feedback above.' : status === 'Disabled' ? 'Status checked: rider access is paused.' : 'Application status updated.'}</Txt>
        {status === 'Pending' && <Txt style={{ fontSize: 12, lineHeight: 19, color: palette.muted }}>Checking does not submit or approve your application. An admin must review your documents and approve access.</Txt>}
        <Txt style={{ fontSize: 12, color: palette.muted }}>Last checked at {new Date(lastCheckedAt).toLocaleTimeString()}</Txt>
      </View>}
      <Txt style={{ fontSize: 12, color: palette.muted }}>This page checks for approval automatically every 15 seconds.</Txt>
      <Button title="Sign Out" outline onPress={logout} />
    </Card>
  </View></Screen>;
}
