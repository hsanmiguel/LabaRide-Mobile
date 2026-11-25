import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Bike, FileCheck2, ShieldCheck } from 'lucide-react-native';
import { address, useProfile } from './data';
import { useAuthStore } from '../store/authStore';
import { Button, Card, Screen, Txt, styles, usePalette } from './ui';
import { RiderHeader } from './RiderHeader';
import { PrivateRiderDocument, RiderApplicantPhoto, riderDocumentLabels, useRiderApplication } from './RiderRequirementsScreens';
import { QueryState } from './UserScreens';
import { ProfileFact } from './CustomerProfileFrame';
import { useLogout } from './useLogout';

function date(value?: string | null, includeTime = false) {
  if (!value) return 'Not provided';
  const parsed = new Date(includeTime ? value : value.slice(0, 10) + 'T12:00:00Z');
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: includeTime ? 'Asia/Manila' : 'UTC',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } as const : {}),
  }) : 'Not provided';
}
function Status({ value }: { value: string }) {
  const palette = usePalette();
  const good = ['Approved', 'Verified'].includes(value);
  const bad = ['Rejected', 'Disabled'].includes(value);
  return <View style={{ alignSelf: 'flex-start', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: good ? '#ECFDF5' : bad ? '#FFF1F2' : palette.soft }}><Txt style={{ fontSize: 12, fontWeight: '600', color: good ? '#047857' : bad ? palette.danger : palette.primary }}>{value === 'Pending' ? 'Pending review' : value}</Txt></View>;
}

export function RiderProfileDesign() {
  const user = useAuthStore(state => state.user);
  const profile = useProfile();
  const application = useRiderApplication();
  const logout = useLogout();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const [tab, setTab] = useState('overview');
  const data = profile.data;
  const app = application.data;
  const docs = app?.documents || [];
  const required = Object.keys(riderDocumentLabels).filter(type => type !== 'OwnerAuthorization' || app?.registeredOwner === false);
  const types = [...new Set([...required, ...docs.map(doc => doc.type)])];
  const verified = docs.filter(doc => doc.status === 'Verified').length;
  const pending = docs.filter(doc => doc.status === 'Pending').length;
  const rejected = docs.filter(doc => doc.status === 'Rejected').length;
  const status = app?.applicationStatus || data?.riderApplicationStatus || user?.riderApplicationStatus;
  const name = data?.name || app?.user.name || user?.name || 'Rider';
  const contact = data?.phone || app?.user.phone || 'Not provided';
  const homeAddress = address(data) || (app ? address(app.user) : '') || 'No address saved';
  const personal = <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 22 }}>
    <ProfileFact label="Full name" value={name} /><ProfileFact label="Email address" value={data?.email || app?.user.email || user?.email || 'Not provided'} />
    <ProfileFact label="Contact number" value={contact} /><ProfileFact label="Birthdate" value={date(data?.birthdate || app?.user.birthdate)} />
    <ProfileFact label="Gender" value={data?.gender || 'Not provided'} /><ProfileFact label="Primary address" value={homeAddress} wide />
  </View>;
  const vehicle = app && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 22 }}>
    <ProfileFact label="Professional license number" value={app.licenseNumber || 'Not provided'} /><ProfileFact label="License valid until" value={date(app.licenseExpiry)} />
    <ProfileFact label="Motorcycle brand" value={app.motorcycleMake || 'Not provided'} /><ProfileFact label="Motorcycle model" value={app.motorcycleModel || 'Not provided'} />
    <ProfileFact label="Year model" value={app.motorcycleYear ? String(app.motorcycleYear) : 'Not provided'} /><ProfileFact label="Plate / registration" value={app.plateNumber || 'Not provided'} />
    <ProfileFact label="Motorcycle ownership" value={app.registeredOwner ? 'Registered in my name' : 'Borrowed / purchased from another owner'} wide />
  </View>;
  return <Screen header={<RiderHeader />} back={false}>
    <View testID="rider-profile-page" style={{ gap: 20 }}>
      <View style={{ gap: 5 }}><Txt style={{ color: palette.primary, fontSize: 10, letterSpacing: 1.1, fontWeight: '700' }}>RIDER ACCOUNT / SETTINGS</Txt><Txt accessibilityRole="header" style={styles.title}>Your rider profile</Txt><Txt style={styles.muted}>Your personal details, motorcycle information and submitted documents in one place.</Txt></View>
      <View accessibilityRole="tablist" accessibilityLabel="Rider profile sections" style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: palette.line }}>
        {[['overview', 'Overview'], ['personal', 'Personal information'], ['documents', 'Submitted documents']].map(([id, title]) => <Pressable key={id} accessibilityRole="tab" accessibilityLabel={`Rider profile: ${title}`} accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 3, borderBottomColor: tab === id ? palette.primary : 'transparent', backgroundColor: pressed ? palette.soft : 'transparent' })}><Txt style={{ fontSize: width < 480 ? 11 : 14, fontWeight: tab === id ? '600' : '500', textAlign: 'center', color: tab === id ? palette.primary : palette.muted }}>{title}</Txt></Pressable>)}
      </View>
      <QueryState loading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} />
      <Card style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 18, padding: wide ? 24 : 18 }}>
        {user && <RiderApplicantPhoto userId={user.id} />}
        <View style={{ flex: 1, minWidth: 150, gap: 5 }}><Txt style={{ fontSize: 22, fontWeight: '700' }}>{name}</Txt><Txt selectable style={styles.muted}>{data?.email || user?.email}</Txt><Txt style={{ fontSize: 12, color: palette.muted }}>Rider account · #{user?.id}</Txt>{!!status && <Status value={status} />}</View>
        <Button title={tab === 'documents' ? 'Refresh documents' : 'View submitted documents'} compact outline onPress={() => { if (tab === 'documents') void application.refetch(); else setTab('documents'); }} />
      </Card>
      {tab !== 'documents' && <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'stretch', gap: 18 }}>
        <View style={{ flex: wide ? 1.8 : undefined, minWidth: 0, gap: 18 }}>
          <Card style={{ gap: 18 }}><View style={{ gap: 4 }}><Txt style={styles.heading}>Personal details</Txt><Txt style={styles.muted}>The information linked to your rider account.</Txt></View>{personal}</Card>
          <Card style={{ gap: 18 }}><View style={styles.row}><Bike size={20} color={palette.primary} /><Txt style={styles.heading}>License & motorcycle</Txt></View><QueryState loading={application.isLoading} error={application.error} retry={() => application.refetch()} />{vehicle}</Card>
          {tab === 'personal' && app && <Card style={{ gap: 12 }}><Txt style={styles.heading}>Application record</Txt><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}><ProfileFact label="Last application review" value={date(app.reviewedAt, true)} />{!!app.reviewReason && <ProfileFact label="Review feedback" value={app.reviewReason} wide />}</View><Txt style={styles.muted}>License, motorcycle and verification records reflect your submitted application. Contact an administrator if these details need correction.</Txt></Card>}
        </View>
        <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 18 }}>
          <Card style={{ gap: 14 }}><View style={styles.row}><ShieldCheck size={20} color={palette.primary} /><Txt style={styles.heading}>Rider status</Txt></View>{!!status && <Status value={status} />}{app && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}><ProfileFact label="Rider access" value={app.active ? 'Active' : 'Inactive'} /><ProfileFact label="Availability" value={app.online ? 'Online' : 'Offline'} /></View>}{!!app?.reviewReason && <Txt style={{ color: palette.warning }}>{app.reviewReason}</Txt>}</Card>
          <Card style={{ gap: 14 }}><View style={styles.row}><FileCheck2 size={20} color={palette.primary} /><Txt style={styles.heading}>Submitted documents</Txt></View><Txt>{docs.length} uploaded · {verified} verified</Txt><Txt style={styles.muted}>{pending} pending review · {rejected} need correction</Txt><Button title="Open document records" outline onPress={() => setTab('documents')} /></Card>
          <Card style={{ gap: 12 }}><Txt style={styles.heading}>Your deliveries</Txt><Button title="My deliveries" outline onPress={() => router.push('/rider/jobs')} /><Button title="Job history" outline onPress={() => router.push('/rider/history')} /></Card>
          <Card style={{ gap: 10 }}><Txt style={styles.heading}>Session</Txt><Txt style={styles.muted}>Sign out of your rider account.</Txt><Button title="Sign Out" compact outline color={palette.danger} onPress={logout} /></Card>
        </View>
      </View>}
      {tab === 'documents' && <View style={{ gap: 16 }}>
        <View style={{ gap: 5 }}><Txt style={styles.heading}>Submitted documents</Txt><Txt style={styles.muted}>Open each document to view your submitted image, verification status and review feedback.</Txt></View>
        <QueryState loading={application.isLoading} error={application.error} retry={() => application.refetch()} />
        {app && <>
          {!docs.length && <Card><Txt style={styles.muted}>No submitted documents are recorded for this account yet.</Txt></Card>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            {types.map(type => { const doc = docs.find(item => item.type === type); return <Card key={`${user?.id}:${type}:${doc?.updatedAt || 'missing'}`} testID={`rider-profile-document-${type}`} style={{ width: wide ? '48.8%' : '100%', gap: 12 }}>
              <Txt style={{ fontWeight: '700' }}>{riderDocumentLabels[type] || type}</Txt><Status value={doc?.status || 'Not submitted'} />
              {doc ? <><Txt style={{ fontSize: 12, color: palette.muted }}>Uploaded / updated {date(doc.updatedAt, true)}</Txt>{!!doc.reviewReason && <Txt style={{ color: palette.danger }}>Review feedback: {doc.reviewReason}</Txt>}<PrivateRiderDocument userId={app.userId} type={doc.type} version={doc.updatedAt} /></> : <Txt style={styles.muted}>No document has been submitted for this requirement.</Txt>}
            </Card>; })}
          </View>
          <Txt style={styles.muted}>Document images are private and visible only to you and authorized administrators. Contact an administrator for corrections to approved records.</Txt>
        </>}
      </View>}
    </View>
  </Screen>;
}
