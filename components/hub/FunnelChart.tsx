import { Progress, Stack, Group, Text } from '@mantine/core';
import { RESULTADO_COLORS, RESULTADO_LABELS } from '@/lib/hubLabels';

export default function FunnelChart({ dados }: { dados: Record<string, number> }) {
  const total = Object.values(dados).reduce((acc, v) => acc + v, 0);
  const entradas = Object.entries(dados).sort((a, b) => b[1] - a[1]);

  if (total === 0) {
    return (
      <Text size="sm" c="dimmed">
        Sem dados ainda.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {entradas.map(([chave, valor]) => {
        const pct = Math.round((valor / total) * 100);
        return (
          <div key={chave}>
            <Group justify="space-between" mb={4}>
              <Text size="sm">{RESULTADO_LABELS[chave] || chave}</Text>
              <Text size="sm" c="dimmed">
                {valor} ({pct}%)
              </Text>
            </Group>
            <Progress value={pct} color={RESULTADO_COLORS[chave] || 'gray'} />
          </div>
        );
      })}
    </Stack>
  );
}
