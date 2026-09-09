import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Group, Paper, Text, Title } from '@mantine/core';
import ConversationTimeline from '@/components/hub/ConversationTimeline';
import { getChatSessionDetail } from '@/lib/hubQueries';
import { PERSONA_LABELS, RESULTADO_COLORS, RESULTADO_LABELS } from '@/lib/hubLabels';

interface PageProps {
  params: Promise<{ id: string }>;
}

const BITRIX_PORTAL = process.env.NEXT_PUBLIC_BITRIX_PORTAL_URL;

function CampoDetalhe({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text size="sm">{children}</Text>
    </div>
  );
}

export default async function SessaoDetalhePage({ params }: PageProps) {
  const { id } = await params;
  const { session, messages, events } = await getChatSessionDetail(id);

  if (!session) {
    notFound();
  }

  return (
    <div>
      <Link href="/dashboard/sessoes" className="text-sm text-blue-700 hover:underline">
        ← Voltar para sessões
      </Link>
      <Title order={3} mt="xs" mb="md">
        {session.lead_nome || 'Sessão sem lead identificado'}
      </Title>

      <Paper withBorder radius="md" p="md" mb="md">
        <Group gap="xl" wrap="wrap">
          <CampoDetalhe label="Persona">
            {session.persona ? PERSONA_LABELS[session.persona] ?? session.persona : '—'}
          </CampoDetalhe>
          <CampoDetalhe label="CPF">{session.lead_cpf || '—'}</CampoDetalhe>
          <CampoDetalhe label="Telefone">{session.lead_telefone || '—'}</CampoDetalhe>
          <CampoDetalhe label="Deal Bitrix">
            {session.bitrix_deal_id ? (
              BITRIX_PORTAL ? (
                <a
                  href={`${BITRIX_PORTAL.replace(/\/$/, '')}/crm/deal/details/${session.bitrix_deal_id}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:underline"
                >
                  #{session.bitrix_deal_id}
                </a>
              ) : (
                `#${session.bitrix_deal_id}`
              )
            ) : (
              '—'
            )}
          </CampoDetalhe>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase">
              Resultado
            </Text>
            <Badge color={RESULTADO_COLORS[session.resultado || ''] || 'gray'} variant="light">
              {RESULTADO_LABELS[session.resultado || ''] || session.resultado || '—'}
            </Badge>
          </div>
          <CampoDetalhe label="Origem">{session.source}</CampoDetalhe>
        </Group>
      </Paper>

      <Title order={5} mb="sm">
        Conversa e eventos
      </Title>
      <ConversationTimeline messages={messages} events={events} />
    </div>
  );
}
