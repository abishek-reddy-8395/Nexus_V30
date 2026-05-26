/**
 * Nexus V30 — WebSocket Protocol Tests
 *
 * Tests the WS message protocol: auth, subscribe, unsubscribe, error handling.
 * Uses ws library against an in-process HTTP server.
 */

import http from 'http';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../shared/constants/index';
import { startWebSocket } from '../bootstrap/websocket.bootstrap';

function makeToken() {
  return jwt.sign(
    { id: 'u1', email: 'test@nexus.local', tenantId: 't1', role: 'owner', plan: 'pro' },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

function connectWs(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function nextMessage(ws: WebSocket): Promise<any> {
  return new Promise((resolve) => {
    ws.once('message', (data) => resolve(JSON.parse(data.toString())));
  });
}

describe('WebSocket protocol', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer();
    await startWebSocket(server);
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    port = (server.address() as any).port;
  });

  afterAll(() => server.close());

  it('rejects subscription before auth', async () => {
    const ws = await connectWs(port);
    ws.send(JSON.stringify({ type: 'subscribe', sym: 'XAUUSD' }));
    const msg = await nextMessage(ws);
    expect(msg.type).toBe('error');
    ws.close();
  });

  it('auth with valid token returns auth_ok', async () => {
    const ws = await connectWs(port);
    ws.send(JSON.stringify({ type: 'auth', token: makeToken() }));
    const msg = await nextMessage(ws);
    expect(msg.type).toBe('auth_ok');
    expect(msg.userId).toBe('u1');
    ws.close();
  });

  it('auth with invalid token returns auth_error', async () => {
    const ws = await connectWs(port);
    ws.send(JSON.stringify({ type: 'auth', token: 'not.a.valid.token' }));
    const msg = await nextMessage(ws);
    expect(msg.type).toBe('auth_error');
    ws.close();
  });

  it('subscribe after auth returns subscribed', async () => {
    const ws = await connectWs(port);
    ws.send(JSON.stringify({ type: 'auth', token: makeToken() }));
    await nextMessage(ws); // auth_ok
    ws.send(JSON.stringify({ type: 'subscribe', sym: 'XAUUSD' }));
    const msg = await nextMessage(ws);
    expect(msg.type).toBe('subscribed');
    expect(msg.sym).toBe('XAUUSD');
    ws.close();
  });

  it('unknown message type returns error', async () => {
    const ws = await connectWs(port);
    ws.send(JSON.stringify({ type: 'auth', token: makeToken() }));
    await nextMessage(ws);
    ws.send(JSON.stringify({ type: 'unknown_type' }));
    const msg = await nextMessage(ws);
    expect(msg.type).toBe('error');
    ws.close();
  });

  it('invalid JSON returns error', async () => {
    const ws = await connectWs(port);
    ws.send('not valid json {{{{');
    const msg = await nextMessage(ws);
    expect(msg.type).toBe('error');
    ws.close();
  });
});
