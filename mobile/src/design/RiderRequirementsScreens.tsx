import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, View, useWindowDimensions } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Bike, CheckCircle2, CircleAlert, FileCheck2, MapPin, ShieldCheck, UploadCloud, UserRound, type LucideIcon } from 'lucide-react-native';
import { api, message } from './data';
import { API_URL } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { Button, Card, Choice, Empty, Field, Screen, Txt, styles, usePalette } from './ui';
import PickerField from './PickerField';
import { useLogout } from './useLogout';

export const riderDocumentLabels: Record<string, string> = {
  ApplicantPhoto: '2×2 applicant photo',
  ProfessionalLicense: 'Professional driver’s license', Clearance: 'NBI or National Police Clearance', TinProof: 'Proof of TIN', OfficialReceipt: 'Motorcycle official receipt (OR)', RegistrationCertificate: 'Motorcycle registration certificate (CR)', OwnerAuthorization: 'Owner authorization / deed of sale',
};
type Document = { id: number; type: string; status: string; reviewReason?: string; updatedAt: string };
type Application = { userId: number; applicationStatus: string; registeredOwner: boolean; licenseNumber?: string; licenseExpiry?: string; motorcycleMake?: string; motorcycleModel?: string; motorcycleYear?: number; plateNumber?: string; documents: Document[]; missing: string[]; user: { name: string; email: string; phone: string; birthdate?: string; address_line_1?: string; city?: string; state_province?: string; postal_code?: string } };
const fields = { birthdate: '', address_line_1: '', city: '', state_province: '', postal_code: '', licenseNumber: '', licenseExpiry: '', motorcycleMake: '', motorcycleModel: '', motorcycleYear: '', plateNumber: '' };
const labels: Record<keyof typeof fields, string> = { birthdate: 'Birthdate (18 or older)', address_line_1: 'Street / barangay / house number', city: 'City or municipality', state_province: 'Province', postal_code: 'Postal code', licenseNumber: 'Professional license number', licenseExpiry: 'License expiry date', motorcycleMake: 'Motorcycle brand', motorcycleModel: 'Motorcycle model', motorcycleYear: 'Year model', plateNumber: 'Plate / registration' };
const documentHints: Record<string, string> = {
  ApplicantPhoto: 'Use a recent, front-facing photo with a plain background. Center your face; the photo is saved in a square 2×2 format.',
  ProfessionalLicense: 'Show your name, professional classification, photo, and expiry date clearly.',
  Clearance: 'Upload either an NBI Clearance or a National Police Clearance.',
  TinProof: 'Your name and tax identification number must be readable.',
  OfficialReceipt: 'Show the registration payment details and motorcycle identifiers.',
  RegistrationCertificate: 'Show the registered owner and motorcycle details clearly.',
  OwnerAuthorization: 'Provide the owner’s authorization or deed of sale for this motorcycle.',
};

function RiderFormSection({ title, description, icon: Icon, children }: { title: string; description?: string; icon: LucideIcon; children: React.ReactNode }) {
  const palette = usePalette();
  return <View style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 16, padding: 18, gap: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}><View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: palette.soft, alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={palette.primary} /></View><View style={{ flex: 1, minWidth: 0, gap: 4 }}><Txt style={{ fontWeight: '700' }}>{title}</Txt>{!!description && <Txt style={{ fontSize: 12, lineHeight: 19, color: palette.muted }}>{description}</Txt>}</View></View>
    {children}
  </View>;
}

function RiderReviewSummary({ application, values, owner, required, edit, disabled }: {
  application: Application; values: typeof fields; owner: boolean; required: string[]; edit: (step: number) => void; disabled: boolean;
}) {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  function date(value: string) {
    const parsed = new Date(`${value}T12:00:00Z`);
    return value && Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'Not provided';
  }
  function detail(title: string, value?: string) {
    return <View style={{ gap: 4, minWidth: 0 }}><Txt style={{ color: palette.muted, fontSize: 12 }}>{title}</Txt><Txt selectable style={{ fontWeight: '500', lineHeight: 22 }}>{value || 'Not provided'}</Txt></View>;
  }
  const uploaded = required.filter(type => application.documents.some(doc => doc.type === type && doc.status !== 'Rejected')).length;
  const applicantPhoto = application.documents.find(doc => doc.type === 'ApplicantPhoto');
  return <View style={{ gap: 20 }}>
    <Txt style={styles.muted}>Check your details and documents before sending them to our team. You can edit any section below.</Txt>
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, alignItems: 'stretch' }}>
      <View style={{ flex: wide ? 1 : undefined, minWidth: 0, borderWidth: 1, borderColor: palette.line, borderRadius: 16, padding: wide ? 20 : 16, gap: 18 }}>
        <View style={[styles.between, { alignItems: 'center', gap: 8 }]}><View style={[styles.row, { gap: 8 }]}><UserRound size={18} color={palette.primary} /><Txt style={{ fontWeight: '700' }}>Personal details</Txt></View><Button title="Edit personal details" compact outline disabled={disabled} onPress={() => edit(0)} /></View>
        {applicantPhoto && <PrivateRiderDocument userId={application.userId} type="ApplicantPhoto" version={applicantPhoto.updatedAt} initiallyOpen />}
        {detail('Full name', application.user.name)}
        {detail('Email address', application.user.email)}
        {detail('Contact number', application.user.phone)}
        {detail('Birthdate', date(values.birthdate))}
        {detail('Home address', [values.address_line_1, values.city, values.state_province, values.postal_code].filter(Boolean).join(', '))}
      </View>
      <View style={{ flex: wide ? 1 : undefined, minWidth: 0, borderWidth: 1, borderColor: palette.line, borderRadius: 16, padding: wide ? 20 : 16, gap: 18 }}>
        <View style={[styles.between, { alignItems: 'center', gap: 8 }]}><View style={[styles.row, { gap: 8 }]}><Bike size={19} color={palette.primary} /><Txt style={{ fontWeight: '700' }}>License & motorcycle</Txt></View><Button title="Edit motorcycle details" compact outline disabled={disabled} onPress={() => edit(1)} /></View>
        {detail('Professional license number', values.licenseNumber)}
        {detail('License valid until', date(values.licenseExpiry))}
        {detail('Motorcycle', [values.motorcycleMake, values.motorcycleModel].filter(Boolean).join(' '))}
        <View style={{ flexDirection: 'row', gap: 20 }}><View style={{ flex: 1, minWidth: 0 }}>{detail('Year model', values.motorcycleYear)}</View><View style={{ flex: 1, minWidth: 0 }}>{detail('Plate / registration', values.plateNumber)}</View></View>
        {detail('Ownership', owner ? 'Registered in my name' : 'Borrowed / purchased from another owner')}
      </View>
    </View>
    <View style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 16, padding: wide ? 20 : 16, gap: 16 }}>
      <View style={[styles.between, { gap: 8 }]}><View style={[styles.row, { gap: 8 }]}><FileCheck2 size={19} color={palette.primary} /><View><Txt style={{ fontWeight: '700' }}>Required documents</Txt><Txt style={{ color: palette.muted, fontSize: 12 }}>{uploaded} of {required.length} uploaded · pending admin review</Txt></View></View><Button title="Edit documents" compact outline disabled={disabled} onPress={() => edit(2)} /></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {required.map(type => {
          const doc = application.documents.find(item => item.type === type);
          const ready = !!doc && doc.status !== 'Rejected';
          const color = ready ? palette.successInk : palette.danger;
          const StatusIcon = ready ? CheckCircle2 : CircleAlert;
          return <View key={type} style={{ flexGrow: 1, flexBasis: wide ? '45%' : '100%', minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12, backgroundColor: palette.surface }}>
            <StatusIcon size={18} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Txt style={{ fontSize: 13, fontWeight: '500' }}>{riderDocumentLabels[type]}</Txt><Txt style={{ color, fontSize: 12 }}>{ready ? 'Uploaded' : doc ? 'Needs replacement' : 'Missing document'}</Txt></View>
          </View>;
        })}
      </View>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 14, backgroundColor: palette.soft }}><ShieldCheck size={21} color={palette.primary} style={{ flexShrink: 0, marginTop: 2 }} /><View style={{ flex: 1, minWidth: 0, gap: 5 }}><Txt style={{ fontWeight: '600', color: palette.primary }}>Your documents stay private</Txt><Txt style={{ fontSize: 12, lineHeight: 20, color: palette.muted }}>Only you and authorized admins can view these documents. Our team checks each requirement before approving rider access.</Txt></View></View>
  </View>;
}
export function useRiderApplication(userId?: number) {
  const user = useAuthStore(state => state.user);
  return useQuery({ queryKey: ['rider-application', user?.id, userId], enabled: !!user, queryFn: () => api.get<Application>(userId ? `/delivery/applications/${userId}` : '/delivery/application'), refetchInterval: 15000 });
}

export function RiderOnboardingDesign({ onSubmitted }: { onSubmitted: () => void }) {
  const query = useRiderApplication();
  const logout = useLogout();
  const cache = useQueryClient();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(fields);
  const [owner, setOwner] = useState(true);
  const [acknowledge, setAcknowledge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const application = query.data;
  const wide = width >= 1000;
  useEffect(() => {
    if (!application) return;
    const saved: Record<string, unknown> = { ...application, ...application.user };
    setValues(Object.fromEntries(Object.keys(fields).map(key => {
      const value = saved[key];
      return [key, value == null ? '' : String(value).slice(0, key === 'birthdate' || key === 'licenseExpiry' ? 10 : undefined)];
    })) as typeof fields);
    setOwner(application.registeredOwner);
  }, [application?.userId]);
  const required = Object.keys(riderDocumentLabels).filter(type => type !== 'OwnerAuthorization' || !owner);
  async function refresh() {
    await query.refetch();
    await Promise.all(['user', 'delivery', 'rider-application'].map(key => cache.invalidateQueries({ queryKey: [key] })));
  }
  async function save(next = false) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const keys = step === 0 ? ['birthdate', 'address_line_1', 'city', 'state_province', 'postal_code'] : ['licenseNumber', 'licenseExpiry', 'motorcycleMake', 'motorcycleModel', 'motorcycleYear', 'plateNumber'];
      if (next && keys.some(key => !values[key as keyof typeof fields].trim())) throw new Error('Complete all fields in this step before continuing.');
      const body: Record<string, unknown> = Object.fromEntries(keys.filter(key => next || values[key as keyof typeof fields].trim()).map(key => [key, key === 'motorcycleYear' ? Number(values.motorcycleYear) : values[key as keyof typeof fields].trim()]));
      if (step === 1) body.registeredOwner = owner;
      await api.put('/delivery/application', body); await refresh(); setNotice('Draft saved.'); if (next) setStep(step + 1);
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  async function upload(type: string) {
    if (busy) return;
    setBusy(true); setUploading(type); setError(''); setNotice('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 1, exif: false, allowsMultipleSelection: false, allowsEditing: type === 'ApplicantPhoto', ...(type === 'ApplicantPhoto' ? { aspect: [1, 1] as [number, number] } : {}) });
      if (result.canceled) return;
      const imageBase64 = result.assets[0]?.base64;
      if (!imageBase64 || imageBase64.length > 8 * 1024 * 1024) throw new Error('Choose a clear document photo smaller than 6 MB.');
      await api.put(`/delivery/application/documents/${type}`, { imageBase64 }); await refresh(); setNotice('Document uploaded privately.');
    } catch (failure) { setError(message(failure)); }
    finally { setUploading(null); setBusy(false); }
  }
  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try { await api.post('/delivery/application/submit', { acknowledge }); await refresh(); onSubmitted(); }
    catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  function field(key: keyof typeof fields) {
    if (key === 'birthdate' || key === 'licenseExpiry') return <PickerField key={key} label={labels[key]} mode="date" value={values[key]} initialValue={key === 'licenseExpiry' ? new Date().toISOString().slice(0, 10) : '2000-01-01'} onChange={value => setValues(current => ({ ...current, [key]: value }))} maximumDate={key === 'birthdate' ? new Date(new Date().getFullYear() - 18, new Date().getMonth(), new Date().getDate()) : undefined} />;
    const placeholders: Partial<Record<keyof typeof fields, string>> = { address_line_1: 'House number, street and barangay', city: 'e.g. Naga', state_province: 'e.g. Camarines Sur', postal_code: 'e.g. 4400', licenseNumber: 'As shown on your professional license', motorcycleMake: 'e.g. Honda', motorcycleModel: 'e.g. Click 125', motorcycleYear: 'e.g. 2022', plateNumber: 'As shown on your OR/CR' };
    return <Field key={key} label={labels[key]} placeholder={placeholders[key]} value={values[key]} onChangeText={value => setValues(current => ({ ...current, [key]: value }))} editable={!busy} appearance="soft" keyboardType={key === 'motorcycleYear' || key === 'postal_code' ? 'number-pad' : 'default'} />;
  }
  function pair(first: keyof typeof fields, second: keyof typeof fields) {
    return <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 14 : 0 }}><View style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>{field(first)}</View><View style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>{field(second)}</View></View>;
  }
  return <Screen title="Rider application" brandedHeader back={false} right={<Button title="Sign Out" outline compact onPress={logout} />}><View style={{ maxWidth: 1000, width: '100%', alignSelf: 'center', gap: 20 }}>
    <Txt style={styles.title}>Complete your rider application</Txt>
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{['Personal details', 'Motorcycle details', 'Documents', 'Review & submit'].map((title, index) => <View key={title} style={{ flexGrow: 1, flexBasis: width < 600 ? '45%' : 0, minWidth: width < 600 ? 110 : 130, padding: 12, borderRadius: 12, backgroundColor: index === step ? palette.primary : palette.soft }}><Txt style={{ color: index === step ? 'white' : palette.primary, fontSize: 12, fontWeight: '600' }}>{index + 1}. {title}</Txt></View>)}</View>
    {query.isLoading && <ActivityIndicator accessibilityLabel="Loading application" />}
    {!!query.error && <Empty title="Unable to load application" message={message(query.error)} action="Retry" onPress={() => query.refetch()} />}
    {application && <Card style={{ padding: width >= 768 ? 28 : 20 }}>
      <Txt accessibilityRole="header" style={styles.heading}>{['Your personal details', 'License & motorcycle', 'Upload your requirements', 'Review before submitting'][step]}</Txt>
      {step === 0 && <>
        <Txt style={styles.muted}>Tell us a little about yourself. You can save your progress and return later.</Txt>
        <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: 16 }}>
          <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', minWidth: 0 }}><RiderFormSection title="Account & eligibility" description="Your registered contact details" icon={UserRound}>
            <View style={{ padding: 14, borderRadius: 12, backgroundColor: palette.surface, gap: 8 }}><Txt style={{ fontWeight: '600' }}>{application.user.name}</Txt><Txt selectable style={{ color: palette.muted, fontSize: 13 }}>{application.user.email}</Txt><Txt selectable style={{ color: palette.muted, fontSize: 13 }}>{application.user.phone}</Txt></View>
            {field('birthdate')}<View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}><ShieldCheck size={17} color={palette.primary} style={{ flexShrink: 0, marginTop: 2 }} /><Txt style={{ flex: 1, fontSize: 12, color: palette.muted, lineHeight: 20 }}>You must be 18 or older to apply as a rider.</Txt></View>
          </RiderFormSection></View>
          <View style={{ flex: wide ? 1.25 : undefined, width: wide ? undefined : '100%', minWidth: 0 }}><RiderFormSection title="Home address" description="Enter your complete current address." icon={MapPin}>{field('address_line_1')}{field('city')}{pair('state_province', 'postal_code')}</RiderFormSection></View>
        </View>
      </>}
      {step === 1 && <>
        <Txt style={styles.muted}>Enter the details exactly as they appear on your license and motorcycle registration.</Txt>
        <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: 16 }}>
          <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', minWidth: 0 }}><RiderFormSection title="Professional driver’s license" description="A valid professional license is required." icon={ShieldCheck}>{field('licenseNumber')}{field('licenseExpiry')}<Txt style={{ color: palette.muted, fontSize: 12, lineHeight: 20 }}>Check the expiry date on your card. You’ll upload a clear license photo in the next step.</Txt></RiderFormSection></View>
          <View style={{ flex: wide ? 1.25 : undefined, width: wide ? undefined : '100%', minWidth: 0 }}><RiderFormSection title="Motorcycle registration" description="Use the information shown on your OR/CR." icon={Bike}>{pair('motorcycleMake', 'motorcycleModel')}{pair('motorcycleYear', 'plateNumber')}
            <View style={{ backgroundColor: palette.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 }}><Choice label="This motorcycle is registered in my name" selected={owner} onPress={() => !busy && setOwner(!owner)} square /></View>
            {!owner && <Txt style={{ color: palette.primary, fontSize: 12, lineHeight: 20 }}>You’ll also need the owner’s authorization or a deed of sale in the Documents step.</Txt>}
          </RiderFormSection></View>
        </View>
      </>}
      {step === 2 && <>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 14, backgroundColor: palette.soft }}><ShieldCheck size={22} color={palette.primary} style={{ marginTop: 2, flexShrink: 0 }} /><View style={{ flex: 1, minWidth: 0, gap: 5 }}><Txt style={{ color: palette.primary, fontWeight: '600' }}>Private document uploads</Txt><Txt style={{ color: palette.muted, fontSize: 12, lineHeight: 20 }}>Only you and authorized admins can view these photos. Keep all text and document edges visible.</Txt><Txt style={{ color: palette.primary, fontSize: 12 }}>JPG, PNG or WebP · up to 6 MB per photo</Txt></View></View>
        <View style={styles.between}><Txt style={{ fontWeight: '600' }}>{required.filter(type => application.documents.some(doc => doc.type === type && doc.status !== 'Rejected')).length} of {required.length} documents uploaded</Txt><Txt style={{ color: palette.muted, fontSize: 12 }}>All listed documents are required</Txt></View>
        <View style={{ height: 5, borderRadius: 3, backgroundColor: palette.line, overflow: 'hidden' }}><View style={{ height: 5, borderRadius: 3, backgroundColor: palette.primary, width: `${required.filter(type => application.documents.some(doc => doc.type === type && doc.status !== 'Rejected')).length / required.length * 100}%` }} /></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 }}>{required.map(type => {
          const doc = application.documents.find(item => item.type === type);
          const rejected = doc?.status === 'Rejected';
          const color = rejected ? palette.danger : doc ? palette.successInk : palette.muted;
          const StatusIcon = rejected ? CircleAlert : doc ? CheckCircle2 : UploadCloud;
          return <View key={type} style={{ flexGrow: 1, flexBasis: wide ? '45%' : '100%', minWidth: 0, borderWidth: 1, borderColor: rejected ? palette.danger : palette.line, borderRadius: 16, padding: wide ? 20 : 16, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}><View style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 11, backgroundColor: palette.soft, alignItems: 'center', justifyContent: 'center' }}><StatusIcon size={19} color={color} /></View><View style={{ flex: 1, minWidth: 0, gap: 5 }}><Txt style={{ fontWeight: '600' }}>{riderDocumentLabels[type]}</Txt><Txt style={{ fontSize: 12, color }}>{rejected ? 'Needs correction' : doc?.status === 'Verified' ? 'Verified by admin' : doc ? 'Uploaded · awaiting review' : 'Not uploaded yet'}</Txt></View></View>
            <Txt style={{ color: palette.muted, fontSize: 12, lineHeight: 20 }}>{documentHints[type]}</Txt>
            {!!doc?.reviewReason && <Txt style={{ color: palette.danger, fontSize: 12 }}>{doc.reviewReason}</Txt>}
            <Button title={doc ? 'Replace photo' : 'Upload photo'} outline icon={<UploadCloud size={16} color={palette.primary} />} disabled={busy && uploading !== type} busy={uploading === type} onPress={() => upload(type)} />
            {doc && <PrivateRiderDocument userId={application.userId} type={type} version={doc.updatedAt} initiallyOpen={type === 'ApplicantPhoto'} />}
          </View>;
        })}</View>
      </>}
      {step === 3 && <><RiderReviewSummary application={application} values={values} owner={owner} required={required} disabled={busy} edit={next => { setError(''); setNotice(''); setStep(next); }} /><View style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: acknowledge ? palette.primary : palette.line, backgroundColor: acknowledge ? palette.soft : 'white' }}><Choice label="I confirm my details and documents are accurate and authorize LabaRide admins to review my application." selected={acknowledge} onPress={() => !busy && setAcknowledge(!acknowledge)} square /></View></>}
      {!!error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{error}</Txt>}{!!notice && step !== 3 && <Txt accessibilityLiveRegion="polite" style={{ color: palette.success }}>{notice}</Txt>}
      <View style={{ flexDirection: width >= 600 ? 'row' : 'column', justifyContent: step === 3 ? 'space-between' : 'flex-start', gap: 10, ...(step === 3 ? { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 18, marginTop: 4 } : {}) }}>
        {step > 0 && <Button title="Back" outline disabled={busy} onPress={() => { setError(''); setStep(step - 1); }} />}
        {step < 2 && <><Button title="Save draft" outline busy={busy} onPress={() => save()} /><Button title="Save & continue" busy={busy} onPress={() => save(true)} /></>}
        {step === 2 && <Button title="Review application" disabled={busy || required.some(type => !application.documents.some(doc => doc.type === type && doc.status !== 'Rejected'))} onPress={() => { setError(''); setNotice(''); setStep(3); }} />}
        {step === 3 && <Button title="Submit for admin review" disabled={!acknowledge} busy={busy} onPress={submit} />}
      </View>
    </Card>}
  </View></Screen>;
}

function usePrivateRiderImage(userId: number, type: string, version: string | undefined, enabled: boolean) {
  const token = useAuthStore(state => state.token);
  const [uri, setUri] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled || !token) return;
    let live = true; const controller = new AbortController(); setUri(''); setError('');
    void (async () => {
      try {
        const response = await fetch(`${API_URL}/api/delivery/applications/${userId}/documents/${type}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to open this document. Check your access and try again.');
        const blob = await response.blob(); const reader = new FileReader();
        reader.onloadend = () => { if (live) setUri(String(reader.result)); }; reader.onerror = () => { if (live) setError('Could not read document.'); }; reader.readAsDataURL(blob);
      } catch (failure) { if (live) setError(message(failure)); }
    })();
    return () => { live = false; controller.abort(); };
  }, [enabled, token, userId, type, version]);
  return { uri, error };
}

export function RiderApplicantPhoto({ userId }: { userId: number }) {
  const application = useRiderApplication(userId);
  const photo = application.data?.documents.find(doc => doc.type === 'ApplicantPhoto');
  const { uri, error } = usePrivateRiderImage(userId, 'ApplicantPhoto', photo?.updatedAt, !!photo);
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const size = width >= 1000 ? 84 : 64;
  return <View testID="rider-applicant-photo" style={{ width: size, height: size, flexShrink: 0, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: palette.line, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }}>
    {photo && !!uri && !error ? <Image accessibilityLabel="Rider’s 2×2 applicant photo" resizeMode="cover" source={{ uri }} style={{ width: '100%', height: '100%' }} /> : application.isLoading || photo && !uri && !error ? <ActivityIndicator accessibilityLabel="Loading applicant photo" color={palette.primary} /> : <View accessible accessibilityLabel={photo ? 'Applicant photo unavailable' : 'No applicant photo uploaded'} style={{ alignItems: 'center', gap: 3 }}><UserRound size={size >= 84 ? 28 : 23} color={palette.primary} /><Txt style={{ fontSize: 9, lineHeight: 13, color: palette.muted }}>{photo ? 'Unavailable' : 'No photo'}</Txt></View>}
  </View>;
}

export function PrivateRiderDocument({ userId, type, version, initiallyOpen = false }: { userId: number; type: string; version: string; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const palette = usePalette();
  const { uri, error } = usePrivateRiderImage(userId, type, version, open);
  return <View style={{ gap: 8 }}><Button title={open ? 'Hide document' : 'View private document'} compact outline onPress={() => setOpen(!open)} />{open && !uri && !error && <ActivityIndicator accessibilityLabel="Loading private document" />}{open && !!uri && <Image accessibilityLabel={riderDocumentLabels[type]} resizeMode="contain" source={{ uri }} style={type === 'ApplicantPhoto' ? { width: 200, height: 200, maxWidth: '100%', alignSelf: 'center', borderRadius: 12, backgroundColor: palette.soft } : { width: '100%', height: 340, backgroundColor: palette.soft }} />}{!!error && <Txt style={{ color: palette.danger }}>{error}</Txt>}</View>;
}

export function AdminRiderRequirements({ userId, onReviewState, onStatusChange }: { userId: number; onReviewState?: (ready: boolean) => void; onStatusChange?: (status: string) => void }) {
  const query = useRiderApplication(userId);
  const cache = useQueryClient();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const [busy, setBusy] = useState(false), [reason, setReason] = useState(''), [error, setError] = useState('');
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  async function review(doc: Document, status: string) {
    if (busy) return;
    if (status === 'Rejected' && reason.trim().length < 5) { setError('Explain what the applicant needs to correct (at least 5 characters).'); return; }
    setBusy(true); setReviewing(doc.type); setError(''); setNotice('');
    try {
      await api.put(`/delivery/applications/${userId}/documents/${doc.type}/review`, { status, reason: status === 'Rejected' ? reason.trim() : undefined, expectedUpdatedAt: doc.updatedAt });
      await cache.invalidateQueries({ queryKey: ['rider-application'] });
      setNotice(status === 'Verified' ? `${riderDocumentLabels[doc.type]} verified.` : 'Correction request sent. The rider can replace this document and resubmit.');
      setCorrecting(null); setReason('');
    }
    catch (failure) { setError(message(failure)); }
    finally { setBusy(false); setReviewing(null); }
  }
  const app = query.data;
  const required = Object.keys(riderDocumentLabels).filter(type => type !== 'OwnerAuthorization' || !app?.registeredOwner);
  const verifiedCount = required.filter(type => app?.documents.some(doc => doc.type === type && doc.status === 'Verified')).length;
  function detail(label: string, value?: string | number | null) {
    return <View style={{ gap: 4, minWidth: 0 }}><Txt style={{ fontSize: 12, color: palette.muted }}>{label}</Txt><Txt selectable style={{ fontWeight: '500', lineHeight: 22 }}>{value || 'Not provided'}</Txt></View>;
  }
  function date(value?: string) {
    return value ? new Date(value).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'Not provided';
  }
  useEffect(() => {
    const required = Object.keys(riderDocumentLabels).filter(type => type !== 'OwnerAuthorization' || !app?.registeredOwner);
    onReviewState?.(!busy && !!app && app.applicationStatus === 'Pending' && !app.missing.length && required.every(type => app.documents.some(doc => doc.type === type && doc.status === 'Verified')));
    onStatusChange?.(app?.applicationStatus || 'Loading');
  }, [app, busy, onReviewState, onStatusChange]);
  return <View style={{ gap: 12 }}>
    <View style={{ padding: 14, borderRadius: 12, backgroundColor: palette.soft, gap: 8 }}>
      <Txt style={{ color: palette.primary, fontWeight: '700' }}>{app?.applicationStatus === 'Pending' ? 'Submitted · ready for document review' : app?.applicationStatus === 'Draft' ? 'Draft · not submitted' : app?.applicationStatus === 'Rejected' ? 'Returned for correction' : app ? `Application status: ${app.applicationStatus}` : 'Checking application status'}</Txt>
      <Txt style={{ color: palette.muted, fontSize: 12, lineHeight: 20 }}>{app?.applicationStatus === 'Pending' ? 'Open each document, then verify it or request a correction. Approval unlocks after every required document is verified.' : 'The rider must open their application, go to step 4 (Review & submit), tick the confirmation, and tap Submit for admin review. Uploaded documents marked Pending do not mean the application has been submitted.'}</Txt>
      <Button title="Refresh application status" compact outline style={{ alignSelf: 'flex-start' }} busy={query.isFetching} onPress={() => { void query.refetch(); }} />
    </View>
    {query.isLoading && <ActivityIndicator />}{!!query.error && <Txt style={{ color: palette.danger }}>{message(query.error)}</Txt>}
    {app && <>
      <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: 14 }}>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', minWidth: 0 }}><RiderFormSection title="Personal details" icon={UserRound}>
          {detail('Birthdate', date(app.user.birthdate))}{detail('Home address', [app.user.address_line_1, app.user.city, app.user.state_province, app.user.postal_code].filter(Boolean).join(', '))}
        </RiderFormSection></View>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', minWidth: 0 }}><RiderFormSection title="License & motorcycle" icon={Bike}>
          {detail('Professional license number', app.licenseNumber)}{detail('License valid until', date(app.licenseExpiry))}{detail('Motorcycle', [app.motorcycleMake, app.motorcycleModel].filter(Boolean).join(' '))}
          <View style={{ flexDirection: 'row', gap: 16 }}><View style={{ flex: 1, minWidth: 0 }}>{detail('Year model', app.motorcycleYear)}</View><View style={{ flex: 1, minWidth: 0 }}>{detail('Plate / registration', app.plateNumber)}</View></View>
          {detail('Ownership', app.registeredOwner ? 'Registered in applicant’s name' : 'Borrowed / purchased from another owner')}
        </RiderFormSection></View>
      </View>
      <View style={{ padding: 16, borderRadius: 14, backgroundColor: verifiedCount === required.length ? '#EFF9F3' : palette.surface, gap: 8 }}>
        <View style={[styles.row, { gap: 8 }]}><FileCheck2 size={20} color={palette.primary} /><Txt accessibilityLiveRegion="polite" style={{ flexShrink: 1, fontWeight: '700' }}>{verifiedCount} of {required.length} documents verified</Txt></View>
        <Txt style={{ color: palette.muted, fontSize: 12, lineHeight: 20 }}>{verifiedCount === required.length ? 'Document checks are complete. Review the application details, then use Approve rider below to grant access.' : 'Open a photo, check its contents, and verify it. Verified documents do not need to be checked again.'}</Txt>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: required.length, now: verifiedCount }} style={{ height: 5, borderRadius: 3, backgroundColor: palette.line, overflow: 'hidden' }}><View style={{ height: 5, width: `${verifiedCount / required.length * 100}%`, backgroundColor: palette.success, borderRadius: 3 }} /></View>
      </View>
      {!!notice && <Txt accessibilityLiveRegion="polite" style={{ color: palette.successInk, fontSize: 13 }}>{notice}</Txt>}
      {!!error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{error}</Txt>}
      {required.map(type => {
        const doc = app.documents.find(item => item.type === type);
        const verified = doc?.status === 'Verified';
        const rejected = doc?.status === 'Rejected';
        const color = verified ? palette.successInk : rejected ? palette.danger : palette.warning;
        const StatusIcon = verified ? CheckCircle2 : rejected ? CircleAlert : FileCheck2;
        return <View key={type} testID={`rider-document-review-${type}`} style={{ padding: 16, borderWidth: 1, borderColor: verified ? '#CBE5D6' : palette.line, borderRadius: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}><StatusIcon size={21} color={color} style={{ flexShrink: 0, marginTop: 2 }} /><View style={{ flex: 1, minWidth: 0, gap: 5 }}><Txt style={{ fontWeight: '600' }}>{riderDocumentLabels[type]}</Txt><Txt style={{ color, fontSize: 12, fontWeight: '600' }}>{verified ? 'Verified — review complete' : rejected ? 'Correction requested' : doc ? 'Awaiting your review' : 'Document missing'}</Txt></View></View>
          {doc && <>
            <PrivateRiderDocument userId={userId} type={type} version={doc.updatedAt} initiallyOpen={type === 'ApplicantPhoto'} />
            {!!doc.reviewReason && <Txt style={{ color: palette.danger, fontSize: 12 }}>{doc.reviewReason}</Txt>}
            {verified ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, backgroundColor: '#EFF9F3' }}><CheckCircle2 size={16} color={palette.successInk} /><Txt style={{ flex: 1, fontSize: 12, color: palette.successInk }}>Verification saved. No further action needed for this document.</Txt></View> : <Txt style={{ color: palette.muted, fontSize: 12, lineHeight: 19 }}>{documentHints[type]}</Txt>}
            {app.applicationStatus === 'Pending' && correcting !== type && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {!verified && <Button title="Verify document" compact busy={reviewing === type} disabled={busy} onPress={() => review(doc, 'Verified')} />}
              <Button title={verified ? 'Change review decision' : 'Request correction'} compact outline color={verified ? palette.primary : palette.danger} disabled={busy} onPress={() => { setCorrecting(type); setReason(''); setError(''); }} />
            </View>}
            {correcting === type && app.applicationStatus === 'Pending' && <View style={{ backgroundColor: palette.surface, borderRadius: 12, padding: 14, gap: 10 }}>
              <Txt style={{ fontWeight: '600' }}>Request a replacement document</Txt><Txt style={{ color: palette.muted, fontSize: 12, lineHeight: 19 }}>Explain what needs fixing. Sending this request returns the application to the rider for correction.</Txt>
              <Field label="What needs to be corrected?" value={reason} onChangeText={setReason} editable={!busy} multiline maxLength={1000} />
              <Button title="Send correction request" color={palette.danger} compact busy={reviewing === type} onPress={() => review(doc, 'Rejected')} /><Button title="Keep current decision" compact outline disabled={busy} onPress={() => { setCorrecting(null); setReason(''); setError(''); }} />
            </View>}
          </>}
        </View>;
      })}
    </>}
  </View>;
}
