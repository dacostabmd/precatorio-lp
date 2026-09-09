import { Paper, SimpleGrid, Text, Title } from '@mantine/core';
import MetricCard from '@/components/hub/MetricCard';
import FunnelChart from '@/components/hub/FunnelChart';
import { getMetricasAgregadas } from '@/lib/hubQueries';
import { PERSONA_LABELS, SERVICE_LABELS } from '@/lib/hubLabels';

export default async function MetricasPage() {
  const metricas = await getMetricasAgregadas();

  return (
    <div>
      <Title order={3} mb="md">
        Métricas
      </Title>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
        <MetricCard label="Total de sessões" value={metricas.totalSessoes} />
        <MetricCard label="Últimos 7 dias" value={metricas.sessoes7dias} />
        <MetricCard label="Últimos 30 dias" value={metricas.sessoes30dias} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Paper withBorder radius="md" p="md">
          <Title order={5} mb="sm">
            Funil por resultado
          </Title>
          <FunnelChart dados={metricas.porResultado} />
        </Paper>

        <Paper withBorder radius="md" p="md">
          <Title order={5} mb="sm">
            Sessões por persona
          </Title>
          {Object.keys(metricas.porPersona).length === 0 ? (
            <Text size="sm" c="dimmed">
              Sem dados ainda.
            </Text>
          ) : (
            <ul className="text-sm space-y-1">
              {Object.entries(metricas.porPersona).map(([persona, total]) => (
                <li key={persona} className="flex justify-between">
                  <span>{PERSONA_LABELS[persona] || persona}</span>
                  <span className="text-gray-500">{total}</span>
                </li>
              ))}
            </ul>
          )}
        </Paper>

        <Paper withBorder radius="md" p="md">
          <Title order={5} mb="sm">
            Erros de integração (24h)
          </Title>
          {Object.keys(metricas.errosPorServico24h).length === 0 ? (
            <Text size="sm" c="dimmed">
              Nenhum erro registrado nas últimas 24h.
            </Text>
          ) : (
            <ul className="text-sm space-y-1">
              {Object.entries(metricas.errosPorServico24h).map(([service, total]) => (
                <li key={service} className="flex justify-between">
                  <span>{SERVICE_LABELS[service] || service}</span>
                  <span className="text-red-600">{total}</span>
                </li>
              ))}
            </ul>
          )}
        </Paper>
      </SimpleGrid>
    </div>
  );
}
