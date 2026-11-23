// @vitest-environment node
/**
 * Integration Test: API forwarding
 *
 * The browser sends API calls to the frontend's own /api/backend route, which
 * passes them on to the backend at SETTING__BackendUrl.
 */

import { vi } from 'vitest';
import { NextRequest } from 'next/server';
import * as forwardingRoute from '@/app/api/backend/[...path]/route';

const backendFetch = vi.fn<typeof fetch>();

interface ForwardedCall {
  headers?: Record<string, string>;
  body?: string;
}

function forward(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  path: string[],
  call: ForwardedCall = {},
): Promise<Response> {
  const request = new NextRequest(url, { method, ...call });
  return forwardingRoute[method](request, {
    params: Promise.resolve({ path }),
  });
}

function callReceivedByBackend(): { target: string; init: RequestInit } {
  const [target, init] = backendFetch.mock.calls[0];
  return { target: String(target), init: init ?? {} };
}

beforeEach(() => {
  backendFetch.mockReset();
  vi.stubGlobal('fetch', backendFetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Forwarding API calls to the backend', () => {
  it('passes a call on to the local backend by default, with its path, query string and cookie', async () => {
    backendFetch.mockResolvedValueOnce(Response.json({ orders: [] }));

    const response = await forward(
      'GET',
      'http://localhost:3000/api/backend/orders?status=open',
      ['orders'],
      { headers: { cookie: 'session=abc' } },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ orders: [] });
    const { target, init } = callReceivedByBackend();
    expect(target).toBe('http://localhost:8042/orders?status=open');
    expect(new Headers(init.headers).get('cookie')).toBe('session=abc');
  });

  it('uses the backend address given when the app starts', async () => {
    vi.stubEnv('SETTING__BackendUrl', 'https://backend.example.com/api');
    backendFetch.mockResolvedValueOnce(Response.json({ orders: [] }));

    await forward('GET', 'http://localhost:3000/api/backend/orders', [
      'orders',
    ]);

    expect(callReceivedByBackend().target).toBe(
      'https://backend.example.com/api/orders',
    );
  });

  it('passes the method, body and content type on', async () => {
    backendFetch.mockResolvedValueOnce(Response.json({ shipped: true }));

    await forward(
      'POST',
      'http://localhost:3000/api/backend/orders/7/ship',
      ['orders', '7', 'ship'],
      {
        headers: { 'content-type': 'application/json' },
        body: '{"shipped":true}',
      },
    );

    const { init } = callReceivedByBackend();
    expect(init.method).toBe('POST');
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe(
      '{"shipped":true}',
    );
    expect(new Headers(init.headers).get('content-type')).toBe(
      'application/json',
    );
  });

  it.each(['PUT', 'PATCH', 'DELETE'] as const)(
    'passes a %s call on',
    async (method) => {
      backendFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

      const response = await forward(
        method,
        'http://localhost:3000/api/backend/orders/7',
        ['orders', '7'],
      );

      expect(response.status).toBe(204);
      const { target, init } = callReceivedByBackend();
      expect(target).toBe('http://localhost:8042/orders/7');
      expect(init.method).toBe(method);
    },
  );

  it("returns the backend's status, body and cookies", async () => {
    backendFetch.mockResolvedValueOnce(
      new Response('{"message":"Order not found"}', {
        status: 404,
        headers: {
          'content-type': 'application/json',
          'content-encoding': 'gzip',
          'set-cookie': 'session=renewed; Path=/; HttpOnly',
        },
      }),
    );

    const response = await forward(
      'GET',
      'http://localhost:3000/api/backend/orders/99',
      ['orders', '99'],
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: 'Order not found' });
    expect(response.headers.getSetCookie()).toEqual([
      'session=renewed; Path=/; HttpOnly',
    ]);
    expect(response.headers.get('content-encoding')).toBeNull();
  });

  it('refuses a path that steps outside the API', async () => {
    const response = await forward(
      'GET',
      'http://localhost:3000/api/backend/x',
      ['..', 'admin'],
    );

    expect(response.status).toBe(400);
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it("says the backend isn't answering when it can't be reached", async () => {
    backendFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    const response = await forward(
      'GET',
      'http://localhost:3000/api/backend/orders',
      ['orders'],
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      message:
        "The backend isn't answering at http://localhost:8042. Is it running?",
    });
  });

  it.each(['localhost:8042', 'my backend'])(
    'explains that the backend address %j must start with http:// or https://',
    async (backendAddress) => {
      vi.stubEnv('SETTING__BackendUrl', backendAddress);

      const response = await forward(
        'GET',
        'http://localhost:3000/api/backend/orders',
        ['orders'],
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        message:
          'SETTING__BackendUrl must be a full address that starts with http:// or https://, such as http://localhost:8042.',
      });
      expect(backendFetch).not.toHaveBeenCalled();
    },
  );
});
