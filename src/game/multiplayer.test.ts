import { describe, it } from 'node:test';
import assert from 'node:assert';
import { WebSocket } from 'ws';

describe('Multiplayer WebSocket Protocol', () => {
  it('connects to WebSocket server and joins a room', async () => {
    const ws = new WebSocket('ws://localhost:3000/ws');

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', (err) => reject(err));
    });

    assert.strictEqual(ws.readyState, WebSocket.OPEN);

    // Send LOBBY_JOIN
    const receivedState = await new Promise<any>((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ROOM_STATE') {
          resolve(msg.payload);
        }
      });
      ws.send(
        JSON.stringify({
          type: 'LOBBY_JOIN',
          payload: { roomId: 'TESTROOM', playerName: 'TestHero', avatar: '⚡' },
        })
      );
    });

    assert.strictEqual(receivedState.roomId, 'TESTROOM');
    assert.strictEqual(receivedState.status, 'lobby');
    assert.strictEqual(receivedState.players.length, 1);
    assert.strictEqual(receivedState.players[0].name, 'TestHero');

    ws.close();
  });

  it('supports 2 players joining the same room and readying up', async () => {
    const p1 = new WebSocket('ws://localhost:3000/ws');
    const p2 = new WebSocket('ws://localhost:3000/ws');

    await Promise.all([
      new Promise<void>((r) => p1.on('open', () => r())),
      new Promise<void>((r) => p2.on('open', () => r())),
    ]);

    // P1 joins DUEL99
    p1.send(
      JSON.stringify({
        type: 'LOBBY_JOIN',
        payload: { roomId: 'DUEL99', playerName: 'P1_Alex', avatar: '👑' },
      })
    );

    // Wait for P1 state
    await new Promise((r) => setTimeout(r, 100));

    // P2 joins DUEL99
    p2.send(
      JSON.stringify({
        type: 'LOBBY_JOIN',
        payload: { roomId: 'DUEL99', playerName: 'P2_Rival', avatar: '🥷' },
      })
    );

    // P2 should receive state with 2 players
    const p2State = await new Promise<any>((resolve) => {
      p2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ROOM_STATE' && msg.payload.players.length === 2) {
          resolve(msg.payload);
        }
      });
    });

    assert.strictEqual(p2State.roomId, 'DUEL99');
    assert.strictEqual(p2State.players.length, 2);

    p1.close();
    p2.close();
  });
});
