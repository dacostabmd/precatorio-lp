'use client';

import Link from 'next/link';
import { Badge, Table } from '@mantine/core';
import type { ChatSessionRow } from '@/lib/hubQueries';
import { PERSONA_LABELS, RESULTADO_COLORS, RESULTADO_LABELS } from '@/lib/hubLabels';

const BITRIX_PORTAL = process.env.NEXT_PUBLIC_BITRIX_PORTAL_URL;

function formatarData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function LinkDeal({ dealId }: { dealId: number }) {
  if (!BITRIX_PORTAL) return <>#{dealId}</>;
  return (
    <a
      href={`${BITRIX_PORTAL.replace(/\/$/, '')}/crm/deal/details/${dealId}/`}
      target="_blank"
      rel="noreferrer"
      className="text-blue-700 hover:underline"
    >
      #{dealId}
    </a>
  );
}

export default function SessionsTable({ sessions }: { sessions: ChatSessionRow[] }) {
  if (sessions.length === 0) {
    return <div className="text-sm text-gray-500 py-8 text-center">Nenhuma sessão encontrada.</div>;
  }

  return (
    <Table.ScrollContainer minWidth={800}>
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Início</Table.Th>
            <Table.Th>Persona</Table.Th>
            <Table.Th>Lead</Table.Th>
            <Table.Th>Deal Bitrix</Table.Th>
            <Table.Th>Resultado</Table.Th>
            <Table.Th>Última atividade</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sessions.map((session) => (
            <Table.Tr key={session.id}>
              <Table.Td>{formatarData(session.started_at)}</Table.Td>
              <Table.Td>{session.persona ? PERSONA_LABELS[session.persona] ?? session.persona : '—'}</Table.Td>
              <Table.Td>
                <Link href={`/dashboard/sessoes/${session.id}`} className="text-blue-700 hover:underline">
                  {session.lead_nome || 'Sem nome'}
                </Link>
                {session.lead_cpf ? <div className="text-xs text-gray-500">{session.lead_cpf}</div> : null}
              </Table.Td>
              <Table.Td>{session.bitrix_deal_id ? <LinkDeal dealId={session.bitrix_deal_id} /> : '—'}</Table.Td>
              <Table.Td>
                <Badge color={RESULTADO_COLORS[session.resultado || ''] || 'gray'} variant="light">
                  {RESULTADO_LABELS[session.resultado || ''] || session.resultado || '—'}
                </Badge>
              </Table.Td>
              <Table.Td>{formatarData(session.last_activity_at)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
