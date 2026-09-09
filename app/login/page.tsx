import { Button, Paper, Stack, Text, Title } from '@mantine/core';

const ERRO_LABELS: Record<string, string> = {
  state_invalido: 'Sessão de login expirada ou inválida. Tente novamente.',
  portal_nao_autorizado: 'Este portal Bitrix24 não está autorizado a acessar o hub.',
  falha_token: 'Não foi possível concluir o login com o Bitrix24. Tente novamente.',
  oauth_nao_configurado: 'O login com Bitrix24 ainda não foi configurado. Peça ao administrador para concluir o cadastro do app OAuth.',
};

interface PageProps {
  searchParams: Promise<{ erro?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { erro } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-mist">
      <Paper withBorder radius="md" p="xl" className="max-w-sm w-full text-center">
        <Stack gap="md" align="center">
          <Title order={3}>Premium Office</Title>
          <Text size="sm" c="dimmed">
            Acesse o painel do chatbot com sua conta Bitrix24.
          </Text>
          {erro ? (
            <Text size="sm" c="red">
              {ERRO_LABELS[erro] || 'Não foi possível fazer login.'}
            </Text>
          ) : null}
          <Button component="a" href="/api/auth/bitrix/login" fullWidth>
            Entrar com Bitrix24
          </Button>
        </Stack>
      </Paper>
    </div>
  );
}
