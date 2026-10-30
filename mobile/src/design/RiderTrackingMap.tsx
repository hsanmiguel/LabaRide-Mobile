import { View } from 'react-native';
import { Txt } from './ui';
import type { TrackingMapData } from './riderTrackingMapHtml';
export default function RiderTrackingMap(_props: { data: TrackingMapData }) {
  return <View><Txt>The rider map is available on mobile and web.</Txt></View>;
}
