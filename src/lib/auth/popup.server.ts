export async function handleAuthPopupRequest(_request: Request): Promise<Response> {
  return new Response("Auth popup unused when VITE_AUTH_ENABLED=false", { status: 404 });
}
