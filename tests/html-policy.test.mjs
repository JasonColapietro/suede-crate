import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyInlineCode } from '../lib/html-policy.mjs';

test('accepts inert JSON-LD and external script references', () => {
  assert.doesNotThrow(() => verifyInlineCode('<script type="application/ld+json">{"@type":"Organization","name":"Suede AI"}</script><script src="/app.js"></script>'));
});
test('rejects inline executable code even alongside JSON-LD', () => {
  assert.throws(() => verifyInlineCode('<script type="application/ld+json">{}</script><script>alert(1)</script>'), /content security policy/);
  assert.throws(() => verifyInlineCode('<script type="text/javascript">alert(1)</script>'), /content security policy/);
});
test('rejects malformed data blocks and inline event handlers', () => {
  assert.throws(() => verifyInlineCode('<script type="application/ld+json">alert(1)</script>'));
  assert.throws(() => verifyInlineCode('<button onclick="alert(1)">Open</button>'), /content security policy/);
});
