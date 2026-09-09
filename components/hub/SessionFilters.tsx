'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Select, TextInput, Button, Group } from '@mantine/core';
import { useState } from 'react';
import { PERSONA_LABELS, RESULTADO_LABELS } from '@/lib/hubLabels';

interface SessionFiltersProps {
  persona?: string;
  resultado?: string;
  busca?: string;
}

export default function SessionFilters({ persona, resultado, busca }: SessionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [buscaValor, setBuscaValor] = useState(busca || '');

  function navegarComFiltro(chave: 'persona' | 'resultado' | 'busca', valor: string | null) {
    const atuais: Record<string, string | undefined> = { persona, resultado, busca };
    atuais[chave] = valor || undefined;

    const params = new URLSearchParams();
    Object.entries(atuais).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });

    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <Group align="flex-end" wrap="wrap" gap="sm" className="mb-4">
      <Select
        label="Persona"
        placeholder="Todas"
        clearable
        data={Object.entries(PERSONA_LABELS).map(([value, label]) => ({ value, label }))}
        defaultValue={persona}
        onChange={(valor) => navegarComFiltro('persona', valor)}
        w={180}
      />
      <Select
        label="Resultado"
        placeholder="Todos"
        clearable
        data={Object.entries(RESULTADO_LABELS).map(([value, label]) => ({ value, label }))}
        defaultValue={resultado}
        onChange={(valor) => navegarComFiltro('resultado', valor)}
        w={200}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navegarComFiltro('busca', buscaValor || null);
        }}
        className="flex items-end gap-2"
      >
        <TextInput
          label="Buscar por nome ou CPF"
          placeholder="Ex: João ou 123.456.789-00"
          value={buscaValor}
          onChange={(e) => setBuscaValor(e.currentTarget.value)}
          w={220}
        />
        <Button type="submit" variant="light">
          Buscar
        </Button>
      </form>
    </Group>
  );
}
