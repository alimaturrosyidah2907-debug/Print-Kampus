import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './authCrypto';

test('hashPassword produces salted scrypt hash and verifies correctly', () => {
  const hash1 = hashPassword('KampusPrint2026!');
  const hash2 = hashPassword('KampusPrint2026!');
  assert.notEqual(hash1, hash2);
  assert.equal(verifyPassword('KampusPrint2026!', hash1), true);
  assert.equal(verifyPassword('WrongPassword', hash1), false);
  assert.equal(verifyPassword('KampusPrint2026!', 'malformed'), false);
});

test('signSessionToken and verifySessionToken validate integrity and expiry', () => {
  const token = signSessionToken({
    sub: 'admin-1',
    role: 'admin',
    email: 'admin@printkampus.id',
  });
  const verified = verifySessionToken(token);
  assert.ok(verified);
  assert.equal(verified.sub, 'admin-1');
  assert.equal(verified.role, 'admin');

  const tampered = `${token.slice(0, -3)}xxx`;
  assert.equal(verifySessionToken(tampered), null);

  const expired = signSessionToken(
    { sub: 'mitra-1', role: 'mitra', email: 'm@kampus.id' },
    -10,
  );
  assert.equal(verifySessionToken(expired), null);
});
