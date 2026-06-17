export function buildRemoveMyImagesJobRequest(request: Request, jobId: string) {
  const headers = new Headers(request.headers);
  headers.set('content-type', 'application/json');

  return new Request(request, {
    method: 'POST',
    body: JSON.stringify({ jobId }),
    headers,
  });
}
