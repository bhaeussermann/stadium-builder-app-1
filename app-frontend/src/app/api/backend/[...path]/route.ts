import type { NextRequest } from 'next/server';

const REQUEST_HEADERS_NOT_FORWARDED = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
  'upgrade',
  'expect',
  'accept-encoding',
]);

// fetch() has already decompressed the body, so the backend's encoding and
// length no longer describe it; Set-Cookie is copied one by one below.
const RESPONSE_HEADERS_NOT_RETURNED = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'set-cookie',
]);

interface ForwardingRouteContext {
  params: Promise<{ path: string[] }>;
}

// Read here rather than through constants.ts: a project converted from stadium-8
// keeps its own constants.ts, which has no backend address.
const DEFAULT_BACKEND_URL = 'http://localhost:8042';

function parseBackendUrl(): URL | null {
  try {
    const url = new URL(
      process.env.SETTING__BackendUrl || DEFAULT_BACKEND_URL,
    );
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

async function forwardToBackend(
  request: NextRequest,
  { params }: ForwardingRouteContext,
): Promise<Response> {
  const { path } = await params;
  if (path.some((segment) => segment === '.' || segment === '..')) {
    return Response.json({ message: 'Invalid API path.' }, { status: 400 });
  }

  const target = parseBackendUrl();
  if (!target) {
    return Response.json(
      {
        message:
          'SETTING__BackendUrl must be a full address that starts with http:// or https://, such as http://localhost:8042.',
      },
      { status: 500 },
    );
  }
  const basePath = target.pathname.replace(/\/$/, '');
  target.pathname = `${basePath}/${path.map(encodeURIComponent).join('/')}`;
  target.search = request.nextUrl.search;

  const forwardedHeaders = new Headers();
  request.headers.forEach((value, name) => {
    if (!REQUEST_HEADERS_NOT_FORWARDED.has(name)) {
      forwardedHeaders.set(name, value);
    }
  });

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let backendResponse: Response;
  try {
    backendResponse = await fetch(target, {
      method: request.method,
      headers: forwardedHeaders,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return Response.json(
      {
        message: `The backend isn't answering at ${target.origin}. Is it running?`,
      },
      { status: 502 },
    );
  }

  const returnedHeaders = new Headers();
  backendResponse.headers.forEach((value, name) => {
    if (!RESPONSE_HEADERS_NOT_RETURNED.has(name)) {
      returnedHeaders.set(name, value);
    }
  });
  for (const cookie of backendResponse.headers.getSetCookie()) {
    returnedHeaders.append('set-cookie', cookie);
  }

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: returnedHeaders,
  });
}

export {
  forwardToBackend as GET,
  forwardToBackend as POST,
  forwardToBackend as PUT,
  forwardToBackend as PATCH,
  forwardToBackend as DELETE,
};
