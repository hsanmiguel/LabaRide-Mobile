import { View } from 'react-native';
import { Txt } from './ui';
import type { JobRouteMapData } from './job-route';
export default function JobRouteMap(_props: { data: JobRouteMapData }) {
  return <View><Txt>Route maps are available on Android, iOS and web.</Txt></View>;
}
