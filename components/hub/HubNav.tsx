'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavLink, Stack } from '@mantine/core';

const LINKS = [
  { href: '/dashboard/sessoes', label: 'Sessões' },
  { href: '/dashboard/metricas', label: 'Métricas' },
  { href: '/dashboard/integracoes', label: 'Integrações' },
];

export default function HubNav() {
  const pathname = usePathname();

  return (
    <Stack gap={4}>
      {LINKS.map((link) => (
        <NavLink
          key={link.href}
          component={Link}
          href={link.href}
          label={link.label}
          active={pathname?.startsWith(link.href)}
        />
      ))}
    </Stack>
  );
}
