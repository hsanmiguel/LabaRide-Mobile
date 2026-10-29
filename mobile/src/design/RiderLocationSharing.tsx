import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { api, message } from './data';
import { Button, Card, Txt, styles, usePalette } from './ui';

const travellingStages = ['PickupAccepted', 'PickupEnRoute', 'LaundryPickedUp', 'DeliveryAccepted', 'CleanLaundryCollected', 'OutForDelivery'];
type SharingState = { enabled: boolean; busy: boolean; activeJobs: number; paused: boolean; lastSent: string; error: string; start: () => Promise<void>; stop: () => void };
const SharingContext = createContext<SharingState | null>(null);

export function RiderLocationSharingProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const jobs = useQuery({ queryKey: ['delivery', 'rider', user?.id], queryFn: () => api.get<{ rider: { online: boolean }; jobs: { id: number; status: string; order: { status: string } }[] }>('/delivery/rider'), enabled: !!user?.isRider, refetchInterval: 15000 });
  const active = jobs.data?.jobs.filter(job => job.status === 'Accepted' && travellingStages.includes(job.order.status)) || [];
  const assignmentKey = active.map(job => job.id).sort((a, b) => a - b).join(',');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [lastSent, setLastSent] = useState('');
  const [error, setError] = useState('');
  const starting = useRef(false);
  useEffect(() => { const listener = AppState.addEventListener('change', state => setForeground(state === 'active')); return () => listener.remove(); }, []);
  useEffect(() => { setEnabled(false); setLastSent(''); setError(''); }, [user?.id]);
  useEffect(() => { if (enabled && jobs.isSuccess && !assignmentKey) { setEnabled(false); setLastSent(''); } }, [enabled, jobs.isSuccess, assignmentKey]);
  async function start() {
    if (starting.current || !active.length) return;
    starting.current = true; setBusy(true); setError('');
    try {
      if (Platform.OS === 'web' && !window.isSecureContext) throw new Error('Browser location sharing needs HTTPS or localhost. Use the mobile app when testing over an HTTP Wi-Fi address.');
      if ((await Location.requestForegroundPermissionsAsync()).status !== 'granted') throw new Error('Allow location access to share your position with customers. You can enable it in your device or browser settings.');
      setEnabled(true);
    } catch (failure) { setError(message(failure)); }
    finally { starting.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!enabled || !foreground || !assignmentKey || !token) return;
    let live = true, gpsPending = false, lastAttempt = 0;
    let subscription: Location.LocationSubscription | undefined;
    let uploading: Promise<void> | null = null;
    const sessionId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    async function send(body: object) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(`${API_URL}/api/delivery/location`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: controller.signal, ...(Platform.OS === 'web' ? { keepalive: true } : {}) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || 'Could not share location. Check your connection.');
        return result.data;
      } finally { clearTimeout(timeout); }
    }
    function publish(position: Location.LocationObject) {
      if (!live || uploading || Date.now() - lastAttempt < 10000) return;
      lastAttempt = Date.now();
      uploading = (async () => {
        try {
          const result = await send({ sharing: true, sessionId, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: Math.round(position.timestamp) });
          if (live && result.sharedJobs > 0) { setLastSent(result.receivedAt); setError(''); }
        } catch (failure) { if (live) setError(`Location was not shared. ${message(failure)}`); }
        finally { uploading = null; }
      })();
    }
    async function sample() {
      if (!live || gpsPending || uploading) return;
      gpsPending = true;
      try { const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }); if (live) publish(position); }
      catch (failure) { if (live) setError(`Could not get a current GPS reading. ${message(failure)}`); }
      finally { gpsPending = false; }
    }
    void Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 }, publish, reason => { if (live) setError(`GPS updates paused. ${reason}`); })
      .then(result => { if (live) subscription = result; else result.remove(); })
      .catch(failure => { if (live) setError(message(failure)); });
    void sample();
    const timer = setInterval(() => { void sample(); }, 15000);
    return () => {
      live = false; subscription?.remove(); clearInterval(timer);
      // Stop after the last upload; a session-scoped stop cannot erase a newer watcher.
      void (async () => { try { await uploading; await send({ sharing: false, sessionId }); } catch {} })();
    };
  }, [enabled, foreground, assignmentKey, token]);
  const state: SharingState = { enabled, busy, activeJobs: active.length, paused: !foreground || !active.length, lastSent, error, start, stop: () => { setEnabled(false); setLastSent(''); setError(''); } };
  return <SharingContext.Provider value={state}>{children}</SharingContext.Provider>;
}

export function RiderLocationSharingControl() {
  const sharing = useContext(SharingContext);
  const palette = usePalette();
  if (!sharing) return null;
  return <Card><View style={styles.between}><View style={{ flex: 1, minWidth: 160, gap: 6 }}><Txt style={{ fontWeight: '700', color: palette.primary }}>Customer location tracking</Txt><Txt style={styles.muted}>{!sharing.enabled ? 'Location sharing is off.' : sharing.paused ? 'Location sharing is paused.' : sharing.error ? 'Location updates need attention.' : sharing.lastSent ? 'Sharing your position with active-job customers.' : 'Getting your first GPS position…'}</Txt></View><Button title={sharing.enabled ? 'Stop sharing location' : 'Start sharing location'} compact outline busy={sharing.busy} disabled={!sharing.enabled && !sharing.activeJobs} onPress={() => { if (sharing.enabled) sharing.stop(); else void sharing.start(); }} /></View>
    <Txt style={{ fontSize: 12, lineHeight: 20, color: palette.muted }}>Shares with customers for your {sharing.activeJobs} active {sharing.activeJobs === 1 ? 'job' : 'jobs'}. Keep LabaRide open in the foreground. Switching to another app or locking the phone pauses updates. Sharing ends when your jobs finish.</Txt>
    {!!sharing.lastSent && sharing.enabled && <Txt style={{ fontSize: 12, color: palette.muted }}>Last sent {new Date(sharing.lastSent).toLocaleTimeString()}</Txt>}
    {!!sharing.error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{sharing.error}</Txt>}
  </Card>;
}
