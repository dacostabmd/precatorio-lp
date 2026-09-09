import { Title } from '@mantine/core';
import IntegrationHealthPanel from '@/components/hub/IntegrationHealthPanel';
import { getIntegrationsHealth } from '@/lib/hubQueries';

export default async function IntegracoesPage() {
  const integrations = await getIntegrationsHealth();

  return (
    <div>
      <Title order={3} mb="md">
        Saúde das integrações
      </Title>
      <IntegrationHealthPanel initialData={integrations} />
    </div>
  );
}
