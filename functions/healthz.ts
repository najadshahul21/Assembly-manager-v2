export async function onRequest() {
  return new Response(
    JSON.stringify({
      status: 'OK',
      timestamp: new Date().toISOString(),
      platform: 'cloudflare-pages'
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    }
  );
}
