import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { newAccountDecision } from './registration-gate';

test('public signup is closed when the mode is missing or paused', () => {
  for (const registrationMode of [undefined, '', 'paused', 'false', 'true']) {
    const decision = newAccountDecision({
      registrationMode,
      allowlist: '',
      email: 'new@example.com',
    });
    assert.equal(decision.allow, false);
    assert.equal(decision.reason, 'paused');
  }
});

test('an invite code is not an approval and a direct API signup stays denied', () => {
  const decision = newAccountDecision({
    registrationMode: 'paused',
    allowlist: 'invite-code-ABCD',
    email: 'new@example.com',
  });
  assert.equal(decision.allow, false);
});

test('only an explicitly listed email may be created, for email or first OAuth', () => {
  const listed = newAccountDecision({
    registrationMode: 'paused',
    allowlist: 'Owner@Example.com, other@example.com',
    email: ' owner@example.com ',
  });
  assert.equal(listed.allow, true);
  assert.equal(listed.reason, 'approved');

  const stranger = newAccountDecision({
    registrationMode: 'paused',
    allowlist: 'owner@example.com',
    email: 'stranger@example.com',
  });
  assert.equal(stranger.allow, false);
  assert.equal(stranger.reason, 'paused');
});

test('a site-wide open flag does not admit an unlisted email', () => {
  const decision = newAccountDecision({
    registrationMode: 'open',
    allowlist: '',
    email: 'new@example.com',
  });
  assert.equal(decision.allow, false);
  assert.equal(decision.reason, 'paused');
});

test('email signup and a first OAuth or One Tap login use the same decision', () => {
  const input = {
    allowlist: 'approved@example.com',
    email: 'approved@example.com',
  };
  assert.deepEqual(newAccountDecision(input), newAccountDecision(input));
  assert.equal(newAccountDecision(input).reason, 'approved');
  assert.equal(
    newAccountDecision({ ...input, email: 'other@example.com' }).allow,
    false
  );
});

test('the auth hook blocks account creation and leaves email sign-in enabled', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /user:\s*\{[\s\S]*create:\s*\{[\s\S]*before:/);
  assert.match(source, /newAccountDecision\(/);
  assert.match(source, /message: '注册暂时关闭'/);
  assert.doesNotMatch(source, /disableSignUp:\s*true/);
  assert.match(
    source,
    /emailAndPassword:\s*\{[\s\S]*enabled:\s*emailAndPasswordEnabled/
  );
});

test('public config stays closed and does not publish the approval list', () => {
  const source = readFileSync(
    new URL('../../app/api/config/public/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(source, /registration_open = 'false'/);
  assert.doesNotMatch(source, /registration_allowlist/);
});

test('an empty approval list does not admit anyone', () => {
  assert.equal(
    newAccountDecision({
      registrationMode: undefined,
      allowlist: ' , ; ',
      email: 'new@example.com',
    }).allow,
    false
  );
});
