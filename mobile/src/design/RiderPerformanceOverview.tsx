import { View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Package, TrendingUp } from 'lucide-react-native';
import { api } from './data';
import { useAuthStore } from '../store/authStore';
import { Button, Card, Txt, styles, usePalette, money } from './ui';
import { QueryState } from './UserScreens';

type Performance = { pickupEarnings: number; returnEarnings: number; periodDays: number; completed: number; failed: number; completionRate: number | null; active: number;
  averagePickup: { minutes: number | null; samples: number }; averageDelivery: { minutes: number | null; samples: number };
  averageJobsPerDay: number; averageKilosPerJob: number | null; pickups: number; deliveries: number;
  week: { date: string; label: string; completed: number }[];
  recent: { id: number; orderId: number; stage: string; status: string; shopName: string; updatedAt: string; minutes: number | null }[] };
const minutes = (value: number | null) => value == null ? '—' : `${value.toFixed(1)} min`;

export function RiderPerformanceOverview() {
  const user = useAuthStore(state => state.user);
  const palette = usePalette(); const { width } = useWindowDimensions();
  const query = useQuery({ queryKey: ['delivery', 'rider-performance', user?.id], enabled: !!user?.isRider,
    queryFn: () => api.get<Performance>('/delivery/rider/performance'), refetchInterval: 30000 });
  const data = query.data;
  if (!data) return <QueryState loading={query.isLoading} error={query.error} retry={() => query.refetch()} />;
  const cards = [
    { label: 'Pickup earnings', value: money(data.pickupEarnings), detail: 'Completed pickup trips, after commission', Icon: Package, color: '#059669', tint: '#ECFDF5' },
    { label: 'Return earnings', value: money(data.returnEarnings), detail: 'Completed return deliveries, after commission', Icon: TrendingUp, color: '#2563EB', tint: '#EFF6FF' },
    { label: 'Completed jobs', value: String(data.completed), detail: `${data.pickups} pickups · ${data.deliveries} deliveries`, Icon: Package, color: '#2563EB', tint: '#EFF6FF' },
    { label: 'Completion rate', value: data.completionRate == null ? '—' : `${data.completionRate}%`, detail: `${data.completed} completed · ${data.failed} unsuccessful`, Icon: CheckCircle2, color: '#059669', tint: '#ECFDF5' },
    { label: 'Average pickup time', value: minutes(data.averagePickup.minutes), detail: `${data.averagePickup.samples} timed pickup jobs`, Icon: Clock3, color: '#7C3AED', tint: '#F5F3FF' },
    { label: 'Average delivery time', value: minutes(data.averageDelivery.minutes), detail: `${data.averageDelivery.samples} timed delivery jobs`, Icon: TrendingUp, color: '#D97706', tint: '#FFFBEB' },
  ];
  const max = Math.max(1, ...data.week.map(day => day.completed));
  return <View style={{ gap: 16 }}>
    <View style={styles.between}><View><Txt style={styles.heading}>Your rider performance</Txt><Txt style={styles.muted}>Last 30 days · your jobs only</Txt></View>
      <Button title="Refresh performance" compact outline onPress={() => { void query.refetch(); }} busy={query.isFetching} />
    </View>
    <QueryState loading={false} error={query.error} retry={() => query.refetch()} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {cards.map(({ label, value, detail, Icon, color, tint }) => <Card key={label} style={{ flexGrow: 1, flexBasis: width < 600 ? '46%' : '22%', gap: 12, padding: width < 480 ? 14 : 22 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}><Icon size={21} color={color} /></View>
        <Txt style={{ fontSize: width < 480 ? 25 : 30, fontWeight: '700', color: palette.ink }}>{value}</Txt>
        <View style={{ gap: 5 }}><Txt style={{ fontWeight: '600' }}>{label}</Txt><Txt style={{ color: palette.muted, fontSize: 11 }}>{detail}</Txt></View>
      </Card>)}
    </View>
    <View style={{ flexDirection: width >= 1100 ? 'row' : 'column', gap: 16, alignItems: 'stretch' }}>
      <Card style={{ flex: width >= 1100 ? 1.25 : undefined, gap: 16 }}>
        <Txt style={styles.heading}>Completed jobs this week</Txt>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', height: 150 }}>
          {data.week.map(day => <View key={day.date} accessibilityLabel={`${day.date}: ${day.completed} completed jobs`} style={{ flex: 1, gap: 8, alignItems: 'center' }}>
            <Txt style={{ fontSize: 12, fontWeight: '600' }}>{day.completed}</Txt>
            <View style={{ height: 100, width: '100%', backgroundColor: palette.soft, borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' }}>
              <View style={{ height: day.completed ? Math.max(6, day.completed / max * 100) : 0, backgroundColor: palette.primary, borderRadius: 7 }} />
            </View><Txt style={{ fontSize: 10, color: palette.muted }}>{day.label}</Txt>
          </View>)}
        </View>
        <Txt style={styles.muted}>{data.active} active jobs · {data.averageJobsPerDay} completed/day · {data.averageKilosPerJob == null ? 'No recorded weight yet' : `${data.averageKilosPerJob} kg/job on average`}</Txt>
        <Txt style={{ color: palette.muted, fontSize: 11 }}>Trip times run from job acceptance to confirmed completion. Averages use jobs with recorded timing; completion rate excludes expired, declined, cancelled and reassigned offers. Pickup and delivery count as separate jobs. Days use Philippine time.</Txt>
      </Card>
      <Card style={{ flex: width >= 1100 ? 1 : undefined, gap: 14 }}>
        <Txt style={styles.heading}>Recent job activity</Txt>
        {!data.recent.length && <Txt style={styles.muted}>Your job activity will appear here after your first assignment.</Txt>}
        {data.recent.map(job => <View key={job.id} style={{ borderLeftWidth: 3, borderLeftColor: job.status === 'Completed' ? '#10B981' : palette.primary, paddingLeft: 12, gap: 5 }}>
          <Txt style={{ fontWeight: '600' }}>{job.stage} · Order #{job.orderId}</Txt>
          <Txt style={styles.muted}>{job.shopName} · {job.status}</Txt>
          <Txt style={{ fontSize: 11, color: palette.muted }}>{new Date(job.updatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{job.minutes == null ? '' : ` · ${job.minutes.toFixed(1)} min`}</Txt>
        </View>)}
      </Card>
    </View>
  </View>;
}
