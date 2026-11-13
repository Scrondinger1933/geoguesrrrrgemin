import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRoomCode,
  generateReadableRoomCode,
  getRoundDurationForMode,
  canStartMultiplayerMatch,
  filterPublicRooms,
  pickQuickMatchRoom,
  computeMatchWinner,
  sanitizeChatMessage,
  PublicRoomSummary,
} from './lobbyRules.ts';

test('normalizeRoomCode strips invalid chars and uppercases', () => {
  assert.equal(normalizeRoomCode(' apex-42! '), 'APEX-42');
  assert.equal(normalizeRoomCode('paris_99'), 'PARIS99');
});

test('generateReadableRoomCode formats prefix-XXXX', () => {
  const code = generateReadableRoomCode('GEO');
  assert.match(code, /^GEO-\d{4}$/);
});

test('getRoundDurationForMode returns 30s for blitz and 60s otherwise', () => {
  assert.equal(getRoundDurationForMode('blitz'), 30);
  assert.equal(getRoundDurationForMode('duel'), 60);
  assert.equal(getRoundDurationForMode('classic'), 60);
});

test('canStartMultiplayerMatch enforces host role and 2 players minimum', () => {
  assert.equal(canStartMultiplayerMatch(2, false).ok, false);
  assert.equal(canStartMultiplayerMatch(1, true).ok, false);
  assert.equal(canStartMultiplayerMatch(2, true).ok, true);
});

test('filterPublicRooms hides private & finished rooms and puts joinable rooms first', () => {
  const rooms: PublicRoomSummary[] = [
    {
      id: 'R1',
      name: 'Salon Privé',
      mode: 'duel',
      region: 'world',
      playerCount: 1,
      maxPlayers: 2,
      hostName: 'Alex',
      hostAvatar: '👑',
      status: 'lobby',
      isPublic: false,
      createdAt: 100,
    },
    {
      id: 'R2',
      name: 'Europe Express',
      mode: 'blitz',
      region: 'world',
      playerCount: 2,
      maxPlayers: 2,
      hostName: 'Marc',
      hostAvatar: '⚡',
      status: 'playing',
      isPublic: true,
      createdAt: 200,
    },
    {
      id: 'R3',
      name: 'Arène Paris',
      mode: 'duel',
      region: 'france',
      playerCount: 1,
      maxPlayers: 2,
      hostName: 'Léa',
      hostAvatar: '🦊',
      status: 'lobby',
      isPublic: true,
      createdAt: 50,
    },
  ];

  const all = filterPublicRooms(rooms);
  assert.equal(all.length, 2);
  assert.equal(all[0].id, 'R3'); // Joinable comes before full playing room

  const filtered = filterPublicRooms(rooms, 'paris');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'R3');

  const match = pickQuickMatchRoom(rooms, 'duel');
  assert.equal(match?.id, 'R3');
});

test('computeMatchWinner uses HP in duel and score in classic/blitz', () => {
  const p1 = { id: 'p1', hp: 3000, score: 12000 };
  const p2 = { id: 'p2', hp: 1000, score: 15000 };

  assert.equal(computeMatchWinner([p1, p2], 'duel'), 'p1');
  assert.equal(computeMatchWinner([p1, p2], 'classic'), 'p2');
  assert.equal(computeMatchWinner([p1, p2], 'blitz'), 'p2');
});

test('sanitizeChatMessage collapses whitespace and bounds length', () => {
  assert.equal(sanitizeChatMessage('   Salut   les   amis !  '), 'Salut les amis !');
  assert.equal(sanitizeChatMessage('a'.repeat(300)).length, 200);
});
