import { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, message } from './data';
import { useAuthStore } from '../store/authStore';
import { Button, Txt, usePalette } from './ui';
import JobRouteMap from './JobRouteMap';
import { directionsUrl, parseRoadRoute, validRoutePoint, type JobRouteEndpoints } from './job-route';

const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
export function JobRoutePreview({ orderId }: { orderId: number }) {
  const palette = usePalette();
  const userId = useAuthStore(state => state.user?.id);
  const preview = useQuery({ queryKey: ['delivery', 'route-preview', userId, orderId], queryFn: () => api.get<JobRouteEndpoints>(`/delivery/orders/${orderId}/route-preview`), retry: false, gcTime: 0, refetchInterval: 15000 });
  const endpoints = preview.data;
  const ready = !!endpoints && validRoutePoint(endpoints.origin) && validRoutePoint(endpoints.destination) && !preview.isError;
  const route = useQuery({ queryKey: ['job-road-route', userId, orderId, endpoints?.origin, endpoints?.destination], enabled: ready && !!token,
    queryFn: async ({ signal }) => {
      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal.addEventListener('abort', cancel);
      const timeout = setTimeout(cancel, 10000);
      try {
        const response = await fetch(directionsUrl(endpoints!.origin!, endpoints!.destination!, token), { signal: controller.signal });
        if (!response.ok) throw new Error('Road route could not load. Check the map configuration or retry.');
        return parseRoadRoute(await response.json());
      } catch (error) {
        if (controller.signal.aborted) throw new Error('Road route request stopped or timed out. Retry when connected.');
        throw error;
      } finally { clearTimeout(timeout); signal.removeEventListener('abort', cancel); }
    }, retry: false, staleTime: 600000, gcTime: 0,
  });
  const mapData = useMemo(() => ({ origin: endpoints?.origin || null, destination: endpoints?.destination || null, coordinates: route.data?.coordinates || [] }), [endpoints, route.data]);
  if (preview.isLoading) return <View style={{ padding: 24, alignItems: 'center', gap: 8 }}><ActivityIndicator accessibilityLabel="Loading route preview" color={palette.primary} /><Txt style={{ fontSize: 12, color: palette.muted }}>Loading saved locations…</Txt></View>;
  if (preview.error || !endpoints) return <View accessibilityRole="alert" style={{ gap: 8 }}><Txt style={{ fontSize: 12, color: palette.danger }}>{message(preview.error) || 'Route preview is unavailable.'}</Txt><Button title="Retry route preview" outline compact onPress={() => { void preview.refetch(); }} /></View>;
  return <View style={{ gap: 8 }}>
    <Txt style={{ fontWeight: '700' }}>{endpoints.stage === 'Pickup' ? 'Customer → laundry shop' : 'Laundry shop → customer'}</Txt>
    {!!token && (validRoutePoint(endpoints.origin) || validRoutePoint(endpoints.destination)) && <View testID="job-route-map" style={{ height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: palette.soft }}><JobRouteMap data={mapData} /></View>}
    {!token && <Txt style={{ color: palette.warning, fontSize: 12 }}>Mapbox is not configured. Add the public map access token and rebuild the app.</Txt>}
    {!!endpoints.missingPins.length && <Txt style={{ color: palette.warning, fontSize: 12 }}>Route unavailable: {endpoints.missingPins.map(pin => pin === 'customer' ? 'customer' : 'shop').join(' and ')} map {endpoints.missingPins.length === 1 ? 'pin is' : 'pins are'} missing. Saved location pins are needed for a road route.</Txt>}
    {ready && token && route.isFetching && !route.data && <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><ActivityIndicator size="small" color={palette.primary} /><Txt style={{ color: palette.muted, fontSize: 12 }}>Finding the road route…</Txt></View>}
    {!!route.data && ready && <Txt testID="job-route-summary" style={{ color: palette.primary, fontSize: 12, fontWeight: '600' }}>{(route.data.distanceMeters / 1000).toFixed(1)} km · about {Math.max(1, Math.ceil(route.data.durationSeconds / 60))} min driving</Txt>}
    {!!route.error && ready && <View style={{ gap: 6 }}><Txt accessibilityRole="alert" style={{ color: palette.warning, fontSize: 12 }}>{message(route.error)} Only saved pins are shown.</Txt><Button title="Retry road route" compact outline onPress={() => { void route.refetch(); }} /></View>}
    <View style={{ flexDirection: 'row', gap: 14 }}><Txt style={{ color: '#126B49', fontSize: 11 }}>A · Collect from</Txt><Txt style={{ color: palette.primary, fontSize: 11 }}>B · Destination</Txt></View>
  </View>;
}
