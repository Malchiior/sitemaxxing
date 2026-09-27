# URL-to-redesign integration evaluation

Checked September 27, 2026. This is an integration-feasibility review, not a hands-on design-quality benchmark. No accounts were created, purchases made, redesign jobs submitted, or sales requests sent.

## Recommendation

Use **v0 as the first programmable pilot**, with an optional operator-provided credential and explicit generation budget. It has documented API and MCP support, code access, and running previews. Keep redesign optional: the normal Sitemaxxing audit must work without a v0 account or paid credits. Do not market free unlimited redesigns.

For a no-integration workflow today, users can publish a Repaint preview themselves and text its public URL to Sitemaxxing. That permits an ordinary nine-screen audit, but does not prove that Repaint preserves application behavior or improves the original.

## Candidates

| Provider | Verified capability | Integration/export constraints | Decision |
| --- | --- | --- | --- |
| [Riggy](https://riggywebsites.com/) | Homepage fetch failed in this research environment. | No working first-party API documentation or executable redesign workflow verified. | Do not build a dependency on it or call it an automated tool yet. |
| [Repaint](https://repaint.com/help/import-site) | Imports a public URL, recreates editable pages, and can publish to a free `sites.repaint.com` address. | Requires an account. [Code export is explicitly unavailable](https://repaint.com/help/export-code). No public generation API found in reviewed first-party material. | Useful manual preview source; weak fit for an automated coding-agent handoff. |
| [Rewebly](https://rewebly.com/) | Advertises three free redesign previews and downloadable HTML on paid plans. | Listed one-time prices: $49.99 for up to five pages, $199.99 for up to ten pages per job. No public API found. Public preview accessibility was not tested. | Manual comparison candidate; not an established integration. |
| [v0](https://v0.app/docs/api/v2) | Documented app generation, code operations, running previews, API and remote MCP. | API credential or MCP OAuth; usage billed against account credits. Secure v2 previews require authenticated handling. | Best documented programmable candidate, pending a bounded real pilot. |

Repaint's [free plan](https://repaint.com/pricing) has limited weekly AI usage and branding. Import documentation explicitly says existing logins, checkout systems, and forms do not transfer as functioning backends. A redesign must be called a proposed frontend until functional equivalence is tested.

## Concrete v0 integration path

The current [agent integration guide](https://v0.app/docs/api/v2/guides/integrating-v0-into-agents) documents remote MCP at `https://v0.app/api/mcp`, authenticated through OAuth. Its server-side SDK alternative uses `V0_API_KEY`. Expose only creation, reading, iteration, and preview operations; do not give a redesign command deployment or infrastructure-management privileges.

The [v1 quickstart](https://v0.app/docs/api/v1/quickstart) explicitly documents generated file content and `latestVersion.demoUrl`. Current [v2 preview documentation](https://v0.app/docs/api/v2/guides/accessing-previews) instead requires short-lived preview tokens and a controlled preview proxy. Do not assume that a v1 public demo URL exists in a v2 response. Search-index snippets were stale relative to documentation dated September 26; pin the chosen SDK/API version and validate its schema before implementation.

Recommended flow:

1. User requests `redesign` in the same conversation as their report.
2. Construct a brief from that conversation's URL, actual visible content, screenshots, and measured findings. Preserve business claims and links; forbid invented testimonials, metrics, or working-backend claims.
3. Submit one preview generation with a bounded budget and timeout; store the provider chat ID under the conversation's report state.
4. Retrieve generated files and preview. For v2, use a separate isolated preview site and short-lived server-side authentication; never place the provider API key in browser requests or report files.
5. Audit the preview using the same nine viewport settings. Compare measured findings; call it an improvement only where the checks support that conclusion. Exclude preview authentication/proxy behavior from claims about production SEO.
6. Return the proposed preview, remaining issues, and coding-agent handoff. Production replacement remains a separate user action.

## Pilot acceptance criteria

Use three owned fixture sites: a brochure site, a deliberately broken responsive layout, and a page with a form whose backend must remain untouched. Keep baseline screenshots and expected content. Record generation time, actual credit spend, export availability, content preservation, findings introduced/fixed, and whether all nine views load.

Pass only if the artifact is retrievable, no essential content is invented or lost, baseline defects improve without new high-severity layout defects, and the conversation boundary remains intact. Generated source is untrusted: inspect it before running builds or dependencies. A screenshots-only mockup is not a runnable redesign and cannot satisfy this benchmark.

## Remaining dependency

No authorized v0 credential or connected OAuth session was supplied to this evaluation, so no generation quality or end-to-end API success is claimed. The next concrete step is one credentialed, budgeted pilot, not brittle automation of free-preview signup screens. Pricing and plan availability must be checked in the account before committing spend; see [v0 pricing](https://v0.app/docs/pricing).
