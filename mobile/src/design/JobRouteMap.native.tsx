import { useEffect, useMemo, useRef } from 'react';
import { Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { jobRouteMapHtml } from './jobRouteMapHtml';
import type { JobRouteMapData } from './job-route';
export default function JobRouteMap({ data }: { data: JobRouteMapData }) {
  const frame = useRef<WebView>(null);
  const html = useMemo(() => ({ html: jobRouteMapHtml(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '') }), []);
  function update() { frame.current?.injectJavaScript(`window.updateJobRoute&&window.updateJobRoute(${JSON.stringify(data).replace(/</g, '\\u003c')});true;`); }
  useEffect(update, [data]);
  return <WebView ref={frame} source={html} originWhitelist={['*']} javaScriptEnabled onLoadEnd={update} scrollEnabled={false}
    onShouldStartLoadWithRequest={request => {
      if (request.url === 'about:blank') return true;
      if (request.navigationType === 'click' && /^https:\/\/(?:www\.)?(?:mapbox\.com|leafletjs\.com)\//.test(request.url)) void Linking.openURL(request.url);
      return false;
    }} style={{ flex: 1, backgroundColor: '#EDF4FF' }} />;
}
