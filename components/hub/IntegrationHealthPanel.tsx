'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, Group, SimpleGrid, Text } from '@mantine/core';
import { SERVICE_LABELS } from '@/lib/hubLabels';
import type { IntegrationHealth } from '@/lib/hubQueries';

const POLL_INTERVAL_MS = 30000;

function corPorSaude(item: IntegrationHealth): 'gray' | 'green' | 'yellow' | 'red' {
  if (item.totalChamadas24h === 0) return 'gray';
  if (item.taxaErro24h >= 0.5) return 'red';
  if (item.taxaErro24h > 0) return 'yellow';
  return 'green';
}

function rotuloSaude(cor: ReturnType<typeof corPorSaude>) {
  switch (cor) {
    case 'green':
      return 'saudável';
    case 'yellow':
      return 'instável';
    case 'red':
      return 'crítico';
    default:
      return 'sem dados';
  }
}

export default function IntegrationHealthPanel({ initialData }: { initialData: IntegrationHealth[] }) {
  const [dados, setDados] = useState<IntegrationHealth[]>(initialData);

  useEffect(() => {
    const intervalo = setInterval(async () => {
      try {
        const res = await fetch('/api/hub/integracoes', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.integrations)) setDados(json.integrations);
        }
      } catch {
        // silencioso: mantem os ultimos dados exibidos ate a proxima tentativa
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
      {dados.map((item) => {
        const cor = corPorSaude(item);
        return (
          <Card key={item.service} withBorder radius="md" p="md">
            <Group justify="space-between" mb="xs">
              <Text fw={600}>{SERVICE_LABELS[item.service] || item.service}</Text>
              <Badge color={cor} variant="filled">
                {rotuloSaude(cor)}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {item.totalChamadas24h} chamada(s) nas últimas 24h · {item.totalErros24h} erro(s)
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Última chamada:{' '}
              {item.ultimaChamada
                ? new Date(item.ultimaChamada).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                : '—'}
            </Text>
          </Card>
        );
      })}
    </SimpleGrid>
  );
}
