import { cookies } from 'next/headers';
import HubNav from '@/components/hub/HubNav';
import { verifyHubSession } from '@/lib/hubSession';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('hub_session')?.value;
  const session = token ? await verifyHubSession(token) : null;

  return (
    <div className="min-h-screen flex bg-mist text-ink">
      <aside className="w-60 shrink-0 border-r border-black/10 bg-white p-4 flex flex-col">
        <div className="mb-6 text-lg font-semibold">Premium Office</div>
        <HubNav />
        <div className="mt-auto pt-4 border-t border-black/10 text-xs text-gray-500">
          {session ? <div className="mb-2 truncate">{session.domain}</div> : null}
          <a href="/api/auth/bitrix/logout" className="text-blue-700 hover:underline">
            Sair
          </a>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  );
}
