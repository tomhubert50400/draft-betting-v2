import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectMatchSocket } from '../src/hooks/matchSocket.js';
test('socket cleanup cancels retries and ignores malformed frames', () => {
  const sockets = [], tasks = new Map();
  let invalidations = 0, nextId = 0;
  class FakeSocket {
    constructor(url) { this.url = url; sockets.push(this); }
    close() { this.closed = true; this.onclose?.(); }
  }
  const cleanup = connectMatchSocket({ invalidateQueries() { invalidations++; } }, {
    WebSocketClass: FakeSocket, location: { protocol: 'https:', host: 'example.test' },
    storage: { getItem: () => null }, schedule(fn) { tasks.set(++nextId, fn); return nextId; }, cancel(id) { tasks.delete(id); },
  });
  assert.equal(sockets.length, 1);
  assert.equal(sockets[0].url, 'wss://example.test/ws');
  for (const data of ['bad json', 'null', '{}']) sockets[0].onmessage({ data });
  assert.equal(invalidations, 0);
  sockets[0].onmessage({ data: '{"type":"match_updated"}' });
  assert.equal(invalidations, 1);
  sockets[0].onclose();
  assert.equal(tasks.size, 1);
  const queued = [...tasks.values()][0];
  cleanup();
  assert.equal(tasks.size, 0);
  assert.equal(sockets[0].closed, true);
  queued();
  assert.equal(sockets.length, 1);
});
