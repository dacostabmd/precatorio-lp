import { NextResponse } from 'next/server';
import { getIntegrationsHealth } from '@/lib/hubQueries';

export async function GET() {
  const integrations = await getIntegrationsHealth();
  return NextResponse.json({ integrations });
}
