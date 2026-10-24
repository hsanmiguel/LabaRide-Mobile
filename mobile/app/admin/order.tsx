import { useLocalSearchParams } from 'expo-router';
import { DeliveryOrderDesign } from '../../src/design/DeliveryScreens';
export default function Order() { const { id } = useLocalSearchParams<{ id: string }>(); return <DeliveryOrderDesign id={Number(id)} />; }
