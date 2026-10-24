import { useEffect, useMemo, useRef } from 'react';
import { riderTrackingMapHtml, type TrackingMapData } from './riderTrackingMapHtml';
export default function RiderTrackingMap({ data }: { data: TrackingMapData }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => riderTrackingMapHtml(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || ''), []);
  function update() { frame.current?.contentWindow?.postMessage({ type: 'labaride-tracking', payload: data }, window.location.origin); }
  useEffect(update, [data]);
  return <iframe ref={frame} title="Rider location map" srcDoc={html} onLoad={update} style={{ border: 0, width: '100%', height: '100%', borderRadius: 12 }} />;
}
