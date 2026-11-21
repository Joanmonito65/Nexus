import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHTML, slug, localInputValue } from '../src/utils/helpers.js';
import { SCHEMA } from '../src/database/schema.js';

test('HTML escaping encodes markup-sensitive characters', () => {
  assert.equal(escapeHTML(`<tag a="b">'&</tag>`), '&lt;tag a=&quot;b&quot;&gt;&#39;&amp;&lt;/tag&gt;');
});

test('slug creates stable lowercase identifiers', () => {
  assert.equal(slug('School Project — Week 2'), 'school-project-week-2');
});

test('localInputValue produces a datetime-local value', () => {
  const result = localInputValue(new Date(2026, 10, 21, 9, 7));
  assert.equal(result, '2026-11-21T09:07');
});

test('database schema includes core local workspace tables', () => {
  for (const name of ['items','notes','bookmarks','calendars','events','tasks','reminders','collections','collection_items']) {
    assert.match(SCHEMA, new RegExp(`CREATE TABLE IF NOT EXISTS ${name}\\s*\\(`));
  }
});

test('database schema uses local SQLite foreign-key relationships', () => {
  assert.match(SCHEMA, /PRAGMA foreign_keys = ON/);
  assert.match(SCHEMA, /REFERENCES calendars\(id\)/);
  assert.match(SCHEMA, /REFERENCES tasks\(id\)/);
});
