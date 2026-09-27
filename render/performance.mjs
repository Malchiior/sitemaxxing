// Google PageSpeed Insights: optional external lab measurement, never a field-data claim.
import { assertPublic } from './guard.mjs';

const METRICS = {
  'largest-contentful-paint': ['Largest Contentful Paint', 'ms', 2500],
  'cumulative-layout-shift': ['Layout shift', 'unitless', 0.1],
  'total-blocking-time': ['Total Blocking Time', 'ms', 200],
};

export function parsePerformance(data) {
  const lab = data?.lighthouseResult;
  const score = lab?.categories?.performance?.score;
  if (lab?.runtimeError || typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1)
    return { status: 'unavailable', reason: 'Google did not return a complete Lighthouse result.' };
  const metrics = Object.entries(METRICS).flatMap(([id, [label, unit, target]]) => {
    const value = lab.audits?.[id]?.numericValue;
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? [{ id, label, unit, value, target }] : [];
  });
  return { status: 'ok', source: 'Google PageSpeed Insights', kind: 'lab', strategy: 'mobile',
    score: Math.round(score * 100), checkedAt: lab.fetchTime ?? null,
    finalUrl: lab.finalUrl ?? null, metrics, warnings: lab.runWarnings ?? [],
    note: 'One simulated mobile Lighthouse run. Results vary; this is not real-user Core Web Vitals or a search ranking score.' };
}

export async function checkPerformance(url, { fetcher = fetch, validate = assertPublic,
  apiKey = process.env.PAGESPEED_API_KEY, enabled = process.env.SITEMAXXING_PAGESPEED !== '0', timeoutMs = 25000 } = {}) {
  if (!enabled) return { status: 'disabled', reason: 'External performance checks are disabled.' };
  try {
    await validate(new URL(url));
    const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    endpoint.searchParams.set('url', url);
    endpoint.searchParams.set('strategy', 'mobile');
    endpoint.searchParams.set('category', 'performance');
    const headers = apiKey ? { 'X-Goog-Api-Key': apiKey } : {};
    const response = await fetcher(endpoint, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { status: 'unavailable', reason: `Google performance check unavailable (HTTP ${response.status}).` };
    return parsePerformance(await response.json());
  } catch {
    // Never persist request URLs, API keys or provider error bodies.
    return { status: 'unavailable', reason: 'Google performance check could not finish.' };
  }
}

export function performanceIssues(result) {
  if (result?.status !== 'ok') return [];
  return result.metrics.filter(m => m.value > m.target).map(m => ({
    key: `performance-${m.id}`, area: 'performance', severity: 'medium',
    title: `${m.label}: ${m.unit === 'ms' ? Math.round(m.value) + ' ms' : m.value.toFixed(3)} in the mobile lab test`,
    evidence: { ...m, source: result.source, checkedAt: result.checkedAt, kind: 'lab' },
  }));
}
