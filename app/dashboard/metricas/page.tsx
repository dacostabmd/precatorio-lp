import MetricasView from '@/components/hub/MetricasView';
import { getMetricasAgregadas } from '@/lib/hubQueries';

export default async function MetricasPage() {
  const metricas = await getMetricasAgregadas();
  return <MetricasView metricas={metricas} />;
}
