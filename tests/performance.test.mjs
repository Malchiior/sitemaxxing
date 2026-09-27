import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { PAGE_FACTS } from '../render/seo.mjs';
import { checkPerformance, parsePerformance, performanceIssues } from '../render/performance.mjs';
import { diffRuns, fixSections } from '../render/summarize.mjs';
import { performanceHtml } from '../render/report.mjs';

const data = (value = 3400) => ({ lighthouseResult: { fetchTime: '2026-09-27T12:00:00Z', categories: { performance: { score: 0.72 } }, audits: { 'largest-contentful-paint': { numericValue: value }, 'cumulative-layout-shift': { numericValue: 0 }, 'total-blocking-time': { numericValue: null } } } });
test('lab metrics preserve zero, reject missing values and generate measured fixes', () => {
  const result = parsePerformance(data());
  assert.equal(result.score, 72);
  assert.equal(result.metrics.length, 2);
  const issues = performanceIssues(result);
  assert.equal(issues.length, 1);
  const fix = fixSections({ audit: { screens: [] }, seo: { issues } });
  assert.match(fix, /3400 ms/);
  assert.match(fix, /Identify the LCP element/);
  assert.match(performanceHtml(result), /not real-user/);
  assert.equal(performanceIssues(parsePerformance(data(2500))).length, 0);
  for (const score of [null, '0.7', NaN, -1, 2]) {
    const invalid = data(); invalid.lighthouseResult.categories.performance.score = score;
    assert.equal(parsePerformance(invalid).status, 'unavailable');
  }
});
test('API uses mobile category, key header, guard and graceful quota failures', async () => {
  let validated = false;
  const result = await checkPerformance('https://example.com/', { enabled: true, apiKey: 'test-secret', validate: async () => { validated = true; }, fetcher: async (url, init) => {
    assert.ok(validated);
    assert.equal(url.searchParams.get('strategy'), 'mobile');
    assert.equal(init.headers['X-Goog-Api-Key'], 'test-secret');
    assert.ok(!url.href.includes('test-secret'));
    return { ok: false, status: 429 };
  } });
  assert.equal(result.status, 'unavailable');
  assert.deepEqual(performanceIssues(result), []);
  assert.match(performanceHtml(result), /No performance score/);
  const blocked = await checkPerformance('http://localhost/', { enabled: true, validate: async () => { throw Error('private'); }, fetcher: () => assert.fail('must not fetch') });
  assert.equal(blocked.status, 'unavailable');
  const disabled = await checkPerformance('https://example.com/', { enabled: false, fetcher: () => assert.fail('disabled') });
  assert.equal(disabled.status, 'disabled');
  const timeout = await checkPerformance('https://example.com/', { enabled: true, validate: async () => {}, fetcher: async () => { throw Error('timeout secret'); } });
  assert.ok(!JSON.stringify(timeout).includes('secret'));
});
test('unavailable performance results never claim previous performance issues are fixed', () => {
  const good = parsePerformance(data());
  const run = perf => ({ audit: { screens: [] }, seo: { performance: perf, issues: performanceIssues(perf) } });
  assert.equal(diffRuns(run(good), run({ status: 'unavailable' })).fixed.length, 0);
  assert.equal(diffRuns(run(good), run({ ...good, metrics: [] })).fixed.length, 0);
  assert.equal(diffRuns(run({ status: 'unavailable' }), run(good)).added.length, 0);
  assert.equal(diffRuns(run(good), run(parsePerformance(data(1800)))).fixed.length, 1);
});
test('page extraction distinguishes intentionally empty alt from an absent attribute', () => {
  const img = attrs => ({ hasAttribute: k => k in attrs, getAttribute: k => attrs[k] ?? null, getBoundingClientRect: () => ({ width: 100 }), src: 'https://example.com/image.png' });
  const document = { title: 'Test', images: [img({ alt: '' }), img({ alt: 'Logo' }), img({}), img({ role: 'presentation' })], body: { innerText: 'Hello' }, documentElement: { getAttribute: () => 'en' }, querySelector: () => null, querySelectorAll: () => [] };
  const facts = runInNewContext(PAGE_FACTS, { document, location: { hostname: 'example.com' }, URL });
  assert.equal(facts.images, 4);
  assert.equal(facts.missingAlt.length, 1);
});
