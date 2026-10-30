export type RoutePoint = { latitude: number; longitude: number };
export type JobRouteEndpoints = { orderId: number; workflowVersion: number; stage: 'Pickup' | 'Delivery'; origin: RoutePoint | null; destination: RoutePoint | null; missingPins: ('customer' | 'shop')[] };
export type RoadRoute = { coordinates: [number, number][]; distanceMeters: number; durationSeconds: number };
export type JobRouteMapData = { origin: RoutePoint | null; destination: RoutePoint | null; coordinates: [number, number][] };

export function validRoutePoint(value: RoutePoint | null): value is RoutePoint {
  return !!value && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;
}
export function directionsUrl(origin: RoutePoint, destination: RoutePoint, token: string) {
  if (!validRoutePoint(origin) || !validRoutePoint(destination)) throw new Error('Saved location pins are invalid.');
  return `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(token)}`;
}
export function parseRoadRoute(value: unknown): RoadRoute {
  const response = value as { code?: string; routes?: { distance?: number; duration?: number; geometry?: { type?: string; coordinates?: unknown[] } }[] };
  const route = response?.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (response?.code !== 'Ok' || route?.geometry?.type !== 'LineString' || !Array.isArray(coordinates) || coordinates.length < 2 || coordinates.length > 100000 ||
    !coordinates.every(point => Array.isArray(point) && point.length >= 2 && validRoutePoint({ longitude: point[0], latitude: point[1] })) ||
    !Number.isFinite(route.distance) || route.distance! < 0 || !Number.isFinite(route.duration) || route.duration! < 0) throw new Error('No driving route is available between these pins.');
  return { coordinates: coordinates.map(point => [(point as number[])[0], (point as number[])[1]]), distanceMeters: route.distance!, durationSeconds: route.duration! };
}
