export { RoomObject } from './room.js';

function corsHeaders(env, request) {
  const configured = env.ALLOWED_ORIGIN;
  const requestOrigin = request.headers.get('Origin');

  let allowOrigin = '*';
  if (configured && configured !== '*') {
    allowOrigin = requestOrigin === configured ? configured : configured;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(env, request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    if (url.pathname === '/') {
      return Response.json(
        { service: 'ballarena-chat', status: 'ok' },
        { headers }
      );
    }

    const match = url.pathname.match(/^\/room\/([a-zA-Z0-9_-]+)(\/status)?$/);
    if (!match) {
      return new Response('Not found', { status: 404 });
    }

    const matchId = match[1];
    const id = env.ROOMS.idFromName(matchId);
    const stub = env.ROOMS.get(id);
    const response = await stub.fetch(request);

    if (response.status !== 101) {
      const outHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(headers)) {
        outHeaders.set(key, value);
      }
      return new Response(response.body, { status: response.status, headers: outHeaders });
    }

    return response;
  }
};
