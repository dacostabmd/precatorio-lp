import { NextRequest, NextResponse } from 'next/server';
import { verifyHubSession } from '@/lib/hubSession';

export const config = {
  matcher: ['/dashboard/:path*', '/api/hub/:path*'],
};

export async function proxy(request: NextRequest) {
  const token = request.cookies.get('hub_session')?.value;
  const session = token ? await verifyHubSession(token) : null;

  if (!session) {
    if (request.nextUrl.pathname.startsWith('/api/hub')) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}
