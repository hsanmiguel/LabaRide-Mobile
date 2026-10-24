import { useEffect, useMemo, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { riderTrackingMapHtml, type TrackingMapData } from './riderTrackingMapHtml';
export default function RiderTrackingMap({ data }: { data: TrackingMapData }) {
  const frame = useRef<WebView>(null);
  const html = useMemo(() => ({ html: riderTrackingMapHtml(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '') }), []);
  function update() { frame.current?.injectJavaScript(`window.updateTracking&&window.updateTracking(${JSON.stringify(data).replace(/</g, '\\u003c')});true;`); }
  useEffect(update, [data]);
  return <WebView ref={frame} source={html} originWhitelist={['*']} javaScriptEnabled onLoadEnd={update} onShouldStartLoadWithRequest={request => request.url === 'about:blank'} style={{ flex: 1, backgroundColor: '#EEF3F8' }} />;
}
