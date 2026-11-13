import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  requestRegisterCode,
  confirmRegisterWithCode,
  requestPasswordResetCode,
  confirmPasswordResetWithCode,
  loginWithPassword,
} from '../src/lib/passwordAuth.ts';

test('Password hashing and verification with scrypt', () => {
  const password = 'SecretPassword123!';
  const hash = hashPassword(password);
  assert.ok(hash.includes(':'), 'Hash must contain salt delimiter');
  assert.equal(verifyPassword(password, hash), true, 'Password verification must succeed');
  assert.equal(verifyPassword('WrongPassword', hash), false, 'Wrong password must fail');
});

test('Account creation 2-step verification flow', async () => {
  const testEmail = `testplayer_${Date.now()}@example.com`;
  const testPass = 'PlayerPass2026!';

  // Step 1: Request code
  const requestRes = await requestRegisterCode(testEmail, testPass, 'TestPlayer');
  assert.equal(requestRes.success, true);
  assert.ok(requestRes.message.length > 10);

  // We fetch the generated code from Cloud SQL or the response
  const code = requestRes.code || '123456';
  assert.ok(code.length === 6, 'Verification code must be 6 digits');

  // Step 2: Confirm code
  const confirmRes = await confirmRegisterWithCode(testEmail, code);
  assert.ok(confirmRes.user);
  assert.equal(confirmRes.user.email, testEmail);
  assert.equal(confirmRes.user.displayName, 'TestPlayer');

  // Step 3: Verify login works with the new credentials
  const loginRes = await loginWithPassword(testEmail, testPass);
  assert.ok(loginRes.user);
  assert.equal(loginRes.user.email, testEmail);
});

test('Password change / reset 2-step verification flow', async () => {
  const testEmail = `resetplayer_${Date.now()}@example.com`;
  const initialPass = 'InitialPass123!';
  const newPass = 'BrandNewPass456!';

  // First create the account
  const regRes = await requestRegisterCode(testEmail, initialPass, 'ResetPlayer');
  const regCode = regRes.code || '123456';
  await confirmRegisterWithCode(testEmail, regCode);

  // Step 1: Request password reset security code
  const resetReq = await requestPasswordResetCode(testEmail);
  assert.equal(resetReq.success, true);
  const resetCode = resetReq.code || '123456';
  assert.ok(resetCode.length === 6, 'Reset code must be 6 digits');

  // Step 2: Confirm reset with security code & new password
  const confirmRes = await confirmPasswordResetWithCode(testEmail, resetCode, newPass);
  assert.ok(confirmRes.user);

  // Step 3: Login with old password must FAIL
  await assert.rejects(
    async () => {
      await loginWithPassword(testEmail, initialPass);
    },
    /Mot de passe incorrect/
  );

  // Step 4: Login with new password must SUCCEED
  const newLoginRes = await loginWithPassword(testEmail, newPass);
  assert.ok(newLoginRes.user);
  assert.equal(newLoginRes.user.email, testEmail);
});
