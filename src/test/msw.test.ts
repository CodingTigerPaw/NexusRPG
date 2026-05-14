import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './msw';

describe('msw test server', () => {
  it('przechwytuje requesty HTTP w testach', async () => {
    server.use(
      http.get('https://api.example.test/health', () => {
        return HttpResponse.json({ status: 'ok' });
      })
    );

    const response = await fetch('https://api.example.test/health');

    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
