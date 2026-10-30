import { useEffect, useMemo, useRef } from 'react';
import { jobRouteMapHtml } from './jobRouteMapHtml';
import type { JobRouteMapData } from './job-route';
export default function JobRouteMap({ data }: { data: JobRouteMapData }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => jobRouteMapHtml(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || ''), []);
  function update() { frame.current?.contentWindow?.postMessage({ type: 'labaride-job-route', payload: data }, window.location.origin); }
  useEffect(update, [data]);
  return <iframe ref={frame} title="Job route map" srcDoc={html} onLoad={update} style={{ border: 0, width: '100%', height: '100%' }} />;
}
