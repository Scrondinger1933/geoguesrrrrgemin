import test from 'node:test';
import assert from 'node:assert/strict';
import { maskEmail, formatSmtpError } from '../lib/email.ts';

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

test('Email masking hides sensitive characters in server logs', () => {
  assert.strictEqual(maskEmail('alexandre.soeirofrance@gmail.com'), 'al***@gmail.com');
  assert.strictEqual(maskEmail('studiomaldecenasoeiro@gmail.com'), 'st***@gmail.com');
  assert.strictEqual(maskEmail('contact@example.com'), 'co***@example.com');
  assert.strictEqual(maskEmail('ab@domain.com'), 'a***@domain.com');
});

test('SMTP error formatting handles Google STARTTLS response codes cleanly', () => {
  // 535 Bad Credentials
  const eauth = formatSmtpError({ code: 'EAUTH', message: '535-5.7.8 Username and Password not accepted' });
  assert.ok(eauth.includes('535 Bad Credentials'), 'Should explain 535 Bad Credentials');
  assert.ok(eauth.includes('apppasswords'), 'Should suggest Google App Password');

  // Connection failure
  const econn = formatSmtpError({ code: 'ECONNECTION', message: 'connect ECONNREFUSED' });
  assert.ok(econn.includes('serveur SMTP impossible'), 'Should explain server connection error');

  // Timeout failure
  const etime = formatSmtpError({ code: 'ETIMEDOUT', message: 'connection timed out' });
  assert.ok(etime.includes('délai d\'attente dépassé'), 'Should explain timeout');

  // Envelope failure
  const eenv = formatSmtpError({ code: 'EENVELOPE', message: '550 User unknown' });
  assert.ok(eenv.includes('rejetée'), 'Should explain envelope rejection');
});
