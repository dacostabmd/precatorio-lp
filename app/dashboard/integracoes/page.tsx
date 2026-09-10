import IntegrationHealthPanel from '@/components/hub/IntegrationHealthPanel';
import { getIntegrationsHealth } from '@/lib/hubQueries';

export default async function IntegracoesPage() {
  const integrations = await getIntegrationsHealth();

  return (
    <div>
      <h1 className="text-xl font-bold mb-4 text-ink">
        Saúde das integrações
      </h1>
      <IntegrationHealthPanel initialData={integrations} />
    </div>
  );
}
