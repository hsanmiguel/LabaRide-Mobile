import { View } from 'react-native';
import { router } from 'expo-router';
import { RiderHeader } from './RiderHeader';
import { Button, Card, Screen, Txt, styles } from './ui';
import { RiderPerformanceOverview } from './RiderPerformanceOverview';

export function RiderOverviewDashboardDesign() {
  return <Screen header={<RiderHeader />} back={false}>
    <View style={styles.stack}>
      <RiderPerformanceOverview />
      <Card style={{ gap: 12 }}>
        <Txt style={styles.heading}>Ready for your next trip?</Txt>
        <Txt style={styles.muted}>Go online, accept a pickup or delivery, and follow the trip steps in My deliveries. Each trip ends at its destination; you do not wait while laundry is washed.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Button title="Browse order requests" onPress={() => router.push('/rider/available')} />
          <Button title="Open my deliveries" outline onPress={() => router.push('/rider/jobs')} />
        </View>
      </Card>
    </View>
  </Screen>;
}
