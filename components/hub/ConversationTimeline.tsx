import { Badge, Group, Paper, Stack, Text } from '@mantine/core';
import type { ChatMessageRow, IntegrationEventRow } from '@/lib/hubQueries';
import { SERVICE_LABELS } from '@/lib/hubLabels';

type TimelineItem = { tipo: 'mensagem'; data: ChatMessageRow } | { tipo: 'evento'; data: IntegrationEventRow };

function formatarHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

interface ConversationTimelineProps {
  messages: ChatMessageRow[];
  events: IntegrationEventRow[];
}

export default function ConversationTimeline({ messages, events }: ConversationTimelineProps) {
  const itens: TimelineItem[] = [
    ...messages.map((m) => ({ tipo: 'mensagem' as const, data: m })),
    ...events.map((e) => ({ tipo: 'evento' as const, data: e })),
  ].sort((a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime());

  if (itens.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Nenhuma mensagem ou evento registrado para esta sessão.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {itens.map((item) => {
        if (item.tipo === 'mensagem') {
          const m = item.data;
          const isUser = m.role === 'user';
          return (
            <Paper
              key={`msg-${m.id}`}
              withBorder
              radius="md"
              p="sm"
              className={isUser ? 'mr-12 bg-blue-50' : 'ml-12 bg-gray-50'}
            >
              <Group justify="space-between" mb={4}>
                <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                  {m.role === 'user' ? 'Usuário' : m.role === 'assistant' ? 'Assistente' : 'Sistema'}
                  {m.kind !== 'text' ? ` · ${m.kind}` : ''}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatarHora(m.created_at)}
                </Text>
              </Group>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {m.content}
              </Text>
            </Paper>
          );
        }

        const evento = item.data;
        return (
          <Group key={`evt-${evento.id}`} gap="xs" className="pl-2">
            <Badge color={evento.status === 'success' ? 'green' : 'red'} variant="light" size="sm">
              {SERVICE_LABELS[evento.service] || evento.service}
            </Badge>
            <Text size="xs" c="dimmed">
              {evento.operation} · {evento.status === 'success' ? 'ok' : 'erro'}
              {evento.latency_ms != null ? ` · ${evento.latency_ms}ms` : ''}
              {evento.error_message ? ` · ${evento.error_message}` : ''} · {formatarHora(evento.created_at)}
            </Text>
          </Group>
        );
      })}
    </Stack>
  );
}
