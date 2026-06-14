import { searchPublicDocsIndex } from './search-index';

export async function getDocsSearch(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') ?? '';
  const locale = url.searchParams.get('locale')?.trim() || null;

  return Response.json(
    await searchPublicDocsIndex({
      query,
      locale,
    })
  );
}
