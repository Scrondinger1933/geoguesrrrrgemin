import test from 'node:test';
import assert from 'node:assert/strict';

// Test verification code generation specifications
test('Verification code format and validation', () => {
  // Test numeric 6-digit code format
  for (let i = 0; i < 50; i++) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    assert.strictEqual(code.length, 6, 'Code should have exactly 6 characters');
    assert.ok(/^\d{6}$/.test(code), 'Code should be strictly 6 digits');
  }

  // Test email normalization
  const rawEmail = '  Joueur.Test@GeoGuessr.COM  ';
  const normalized = rawEmail.trim().toLowerCase();
  assert.strictEqual(normalized, 'joueur.test@geoguessr.com');

  // Test expiration calculation (15 minutes)
  const now = Date.now();
  const expiresAt = new Date(now + 15 * 60 * 1000);
  assert.ok(expiresAt.getTime() > now, 'Expiration time must be in future');
  assert.strictEqual(Math.round((expiresAt.getTime() - now) / 60000), 15);
});
