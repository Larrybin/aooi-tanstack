import { handleAuthApiRequest } from '@/server/api/auth/auth-action';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleAuthApiRequest(request);
}

export async function POST(request: Request) {
  return handleAuthApiRequest(request);
}
