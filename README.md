# Sitemaxxing — text it your site for a fit check on 9 screens, then get the fix

**Free · MIT · one-click on Plow · runs on the model Plow supplies**

Mog your competition with a fit check from our sitemaxxing AI agent.

Text it your website address. In about a minute it sends back a report card:
your page on a laptop, a tablet and a phone, a score for phones, tablets and
computers, the top problems measured on nine real screen sizes, how you look
as a Google result, and whether ChatGPT, Claude and Perplexity can read you.
With it comes a PDF with every screen and every finding. Reply "pages" and it
checks up to four more pages from your menu, one card and one PDF for all of
them. Reply "fix" and it sends the fix list as a prompt for your own coding
agent: paste it into Claude Code, Codex or Cursor, or reply "send to my
agent" with your agent's number and it texts the prompt straight to it. Text
the address again after you deploy and it tells you what got fixed, what's
still there, and what's new.

Nothing to connect. Nothing to install. No accounts, no keys. One text.

![The report card for sbeoc.com](docs/example-card.png)

## Install in one text

1. Deploy it on Plow (one click) and text the number it gives you.
2. Send your website address, like `https://sbeoc.com`.
3. That's the setup. It starts the check.

## How it works

1. **The fit check.** It opens your page in a real browser as a small Android (360×800), iPhone SE (375×667), iPhone 15 (393×852), iPhone Pro Max (430×932), iPad portrait (768×1024) and landscape (1024×768), laptop (1366×768), desktop (1920×1080) and ultrawide (2560×1080). Touch, pixel density and user agent are set like the real device.
2. **Measured issues.** On each screen it measures, not eyeballs: sideways scrolling, a headline cut off, a popup covering the first screen, broken images, text under 12px, tap targets under WCAG's 24px minimum, text clipped inside its box, page weight, oversized images, and whether the headline and main button are on the first screen. Each issue carries its evidence: the element, its text, the pixel numbers.
3. **Google and AI.** A drawn-to-scale Google result (labeled as a simulation) showing exactly where your title and description get cut off. Then: does robots.txt or your firewall turn away Googlebot, GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended or CCBot; how much of your text is visible without JavaScript; is there structured data, a sitemap, an llms.txt, alt text, one H1, a share image, a canonical link, a language.
4. **The report card.** One portrait image (1080×1350) that reads on a phone: the page on a laptop, a tablet and a phone, three scores, the top four problems, the Google result, and the AI crawlers that get in.
5. **The PDF.** Tap it and it opens full screen: the card, every finding with its evidence, the first screen on all nine sizes, the Google preview and crawler table, the whole page on an iPhone and on a laptop, and the fix list.
6. **The results text.** Written by code from the measurements, the same way every time: one line of scores by phones, tablets and computers, up to four problems with a colored dot each, how many smaller ones are in the report, and how to reply. The model sends it word for word.
7. **Your other pages.** Reply "pages". It takes up to four pages from your site's menu (same domain, normal web ports, no files or account, legal or archive pages), checks each on the nine screens, and sends one card with a row per page, one PDF with each page's findings and screens, and one fix list for every page. Site-wide findings (robots.txt, crawlers, sitemap, llms.txt) are reported once, with the page you checked first. A page behind a login or a bot check, one that redirects off the site or to a page already checked, or one that doesn't load is named as skipped, with the reason.
8. **The fix.** Reply "fix". It sends a prompt written for your coding agent: every issue, where it appears, what to change, ordered fix-first (page by page after a pages check). It arrives as text to paste and as a file. The prompt is assembled by code from the measurements, so it can only say what was measured.
9. **Straight to your agent.** If your coding agent has a Plow number, reply "send to my agent +1 555…" and it opens a thread with that agent and sends the fix prompt there. Owner only.
10. **Again, after you deploy.** Text the address again. It finds its last check of that page and the results say what changed: scores then and now, what got fixed, what's still there, what's new. Broken images are compared one by one, so fixing one of two counts.

## A real run, start to finish

Devin texts `https://sbeoc.com`.

> Fit check for sbeoc.com on 9 screens, plus Google and AI readability. About a minute.

Thirty-six seconds later, the report card (above), the PDF, and this text, built by code:

> sbeoc.com fit check: 75 on phones, 75–100 on tablets, 100 on computers.
> 🔴 "SBE Contracting" image missing on phones and iPad portrait
> 🔴 Almost no text on the page
> 🟡 No Google description
> 🟡 2 images missing alt text
> +3 smaller in the report.
>
> Report card and full PDF below. Reply fix for your coding agent's fix list, or pages to check /about, /projects, /solar and /electrical too.

"pages." Two minutes later, one card with a row per page, one PDF, and:

> sbeoc.com, 4 more pages checked: /about 65–100, /projects 51–76, /solar 75–96, /electrical 65–86.
> 🔴 "SBE Contracting" image missing on phones and iPad portrait (/about, /projects, /solar, /electrical)
> 🔴 Almost no text on the page (/projects, /solar, /electrical)
> 🟡 No Google description (/about, /projects, /solar, /electrical)
> 🟡 5 images missing alt text (/about, /projects, /solar, /electrical)
> +7 smaller in the report.
>
> Report card and full PDF below, covering 5 pages including the homepage. Reply fix for your coding agent's fix list.

![The pages card for sbeoc.com](docs/example-pages-card.png)

"fix."

> Here's the fix list for sbeoc.com, 5 pages, written for your coding agent. Paste the whole thing into Claude Code, Codex or Cursor in the site's repo. It's also attached as a file. Or reply "send to my agent" with your agent's number and I'll text it there.
>
> [the fix list, page by page: see docs/example-fix-prompt.md for a one-page one]
>
> Text me the site again after you deploy and I'll show you what changed.

The logo finding is a real one: its URL has `https://sbeoc.com/` pasted into the middle of the path, and the fix names the working image with the same alt text, which it fetched and got an image back. After a deploy, the same address again gives the re-check text:

> anyaiagent.xyz again, 9 screens, compared with Sep 23. Scores unchanged: 86 on phones, 86 on tablets, 90 on computers.
> Fixed: nothing yet.
> Still there: the tiny text, plus 3 small things in the report.
> New: nothing.
> Google and AI unchanged.
>
> Report card and full PDF below. Reply fix for what's left, or pages to check /explore, /industries, /pricing and /docs too.

(That one is a real re-check of a site that hadn't changed. When a deploy fixed things, the Fixed line names them: the "Logo" image, the sideways scroll, buttons too small to tap.)

## Every claim maps to something real

| Claim | Where it lives |
|---|---|
| Nine real screen sizes with device touch, density and user agent | `render/audit.mjs` `SCREENS`, Chromium over CDP |
| Sideways scroll, cut headline, covering popup, broken images, tiny text, tap targets, clipped text, page weight, oversized images, headline/action on first screen | `render/measure.js` (runs in the page, returns numbers and elements), `render/audit.mjs` `issuesFor` |
| A score per screen | `render/audit.mjs` `scoreOf`: 100 minus 25 per high, 10 per medium, 4 per low |
| The report card | `render/card.mjs` `cardHtml`, `pagesCardHtml`; Chromium screenshots it |
| The PDF | `render/report.mjs` `reportHtml`, `pagesReportHtml`; Chromium prints it |
| Results text built by code, the same shape every time | `render/summarize.mjs` `resultMessage`; `render/pages.mjs` `pagesMessage`; short titles in `render/labels.mjs` |
| Google result drawn to Google's measurements, labeled as a simulation | `render/seo.mjs` `serpHtml` |
| Crawler access for Google, ChatGPT, Claude, Perplexity and others, via robots.txt rules and a real fetch as each crawler | `render/seo.mjs` `CRAWLERS`, `robotsAllows`, firewall detection |
| Text visible without JavaScript | `render/seo.mjs` `htmlText` vs rendered text |
| Title, description, H1, alt text, share image, canonical, sitemap, structured data, llms.txt, language | `render/seo.mjs` issue list |
| "pages": up to four more pages from the menu, same domain and normal ports only, one card, one PDF, one fix list | `render/pages.mjs` `mainPages`, `render/check-pages.mjs`, `plugins/ro` `ro_check_pages` |
| Site-wide findings reported once, not again per page | `render/seo.mjs` `SITE_WIDE` |
| Re-check after a deploy: fixed, still there, new, compared with the last check of that page | `plugins/ro/runs.ts` `previousRun`; `render/summarize.mjs` `diffRuns`, `recheckMessage` |
| Broken-image repairs offered only when proven: a same-alt image that loads on another screen, else the URL with the pasted-in domain removed, only if it returns an image | `render/repairs.mjs`, `measure.js` `images.working` |
| Public sites only; one check at a time; 12 an hour (a pages check counts once) | `plugins/ro` `url-guard.ts`, `ro_check`, `ro_check_pages` |
| Fix prompt assembled from measurements, not written by a model | `render/summarize.mjs` `fixPrompt`, `FIX` table; `render/pages.mjs` `pagesFixPrompt` |
| Fix prompt delivered word for word, as text and as a file, ending with the re-check invitation | `plugins/ro/replies.ts` `fixReply`, `ro_fix_prompt` |
| "send to my agent" is owner-only | `plugins/ro` before-tool-call hook, owner recognised by the host |
| Read-only, polite: one page load per screen, a few GETs, no forms, no clicks | `render/audit.mjs`, `render/seo.mjs` |
| A check stopped for taking too long takes its browser down with it | `render/cdp.mjs` SIGTERM handler |

Tests: `tests/` (URL guard, texts, pages, re-check, fix reply, contact card, usage bridge), run on every push with the image build and an offline probe that renders nine screens and boots the gateway with the plugin.

## What's included

✅ Your homepage, or any page you send, on nine screen sizes, scored, as a report card and a PDF
✅ Every issue with its evidence: element, text, pixels
✅ Google result preview showing where the title and description get cut
✅ AI-readability: which crawlers get in, what they can read, structured data, llms.txt
✅ "pages": up to four more pages from your menu, one card and one PDF for all of them
✅ A fix prompt for your own coding agent, ordered fix-first, as text and as a file
✅ "send to my agent": the prompt texted straight to your coding agent's Plow number
✅ Verified image repairs when a broken image can be proven fixable
✅ Re-check after a deploy: what got fixed, what's still there, what's new

❌ Does not change your site; it hands your coding agent the fix
❌ Does not crawl the whole site: a page you send, or up to four more from the menu
❌ Does not click, log in, fill forms or test flows; it looks at the page as a visitor arriving
❌ Does not run a full accessibility audit; it checks the parts a screen size changes (tap size, text size, overflow)
❌ Does not measure real Google rankings; the result preview is a simulation of how the snippet is cut
❌ Does not test sites behind a login or a bot wall, private addresses, or non-standard ports; it says so and stops
❌ Does not re-check on a schedule or host a report page; it measures and hands off
❌ Does not need or accept any API key

## What it will NOT do

- **Guess.** Every issue is a measurement with the element and the numbers. If it can't measure it, it doesn't report it.
- **Write your results in prose.** The results text, the re-check text and the fix prompt are assembled by code from the measurements. The model sends them; it doesn't invent findings.
- **Touch your site.** Read-only. One load per screen, a few polite GETs for robots.txt, sitemap and llms.txt. No forms, no clicks.
- **Offer a repair it didn't check.** A replacement image URL is suggested only after it fetched it and got an image back.
- **Pretend the Google preview is Google.** It's drawn to Google's measurements and labeled a simulation.
- **Nag.** It texts when you text it. Nothing on a schedule.
- **Ask for keys.** Ever.

## What you can text

| Text | What happens |
|---|---|
| `https://yoursite.com` | The full check of the homepage: 9 screens, Google, AI. About a minute. |
| `https://yoursite.com/pricing` | The same check on that page |
| `pages` | Up to four more pages from the site's menu, on the same 9 screens. About a minute per page. |
| `fix` | The fix prompt for your coding agent, for the last check, as text and as a file |
| `send to my agent +1 555 000 0000` | Texts the fix prompt to your coding agent's Plow number (owner only) |
| the same URL again | Re-check after a deploy: fixed, still there, new |
| `status` | The last check's results |

## Who it's for

Anyone with a website who has only ever looked at it on their own phone and their own laptop. Founders about to launch. Agencies before a client review. Teams wondering why ChatGPT never mentions them. Especially useful the day after a deploy.

Not for: apps behind a login, flows that need clicks, or anyone wanting a ranking report.

## Trust

- Findings are measurements, and every one carries evidence you can check yourself.
- The results text, the re-check and the fix prompt are built by code from those measurements. They can only say what was measured.
- Read-only. It never logs in, submits, or clicks.
- Nothing runs on a schedule and nothing is sent to anyone but you.

## FAQ

**Does it need my code or any account?** No. A public URL is the whole setup.

**What's a fit check?** Your site, tried on nine screens, like an outfit tried on before you go out. Does it fit, or is something hanging off the edge?

**Why nine screens?** Because "looks fine on my phone" hides the 360px Android, the iPad in landscape, and the ultrawide where your hero stretches. The nine cover the sizes people actually use.

**Is the score a Google score?** No. It's 100 minus the weight of what was measured on that screen, so you can see which screens are worst and whether a fix helped.

**What does "readable without JavaScript" mean?** Many AI crawlers don't run JavaScript. If your text only appears after scripts run, they see a blank page. It measures the share of your text that's in the raw HTML.

**Will it tell me if ChatGPT can see my site?** Yes: whether robots.txt allows GPTBot and OAI-SearchBot, and whether your server actually lets them in when they ask (some firewalls turn them away).

**Can it fix the site itself?** No, on purpose. It writes the fix for the coding agent you already use, in your codebase, so nothing changes without you. If that agent has a Plow number, "send to my agent" texts the prompt straight to it.

**Can it check my pricing page too?** Yes. Text that page's address, or reply "pages" after a check and it does up to four pages from your menu in one go.

**How do I know a fix worked?** Text the address again after you deploy. The results compare with the last check of that page: what got fixed, what's still there, what's new.

**How long does it take?** About a minute for a page, and about a minute per page for "pages". One check runs at a time, up to 12 an hour; a pages check counts as one.

**Why is it free?** It's open source (MIT) and an entry in the AI Worth Using × OpenClaw 2.0 hackathon. Plow supplies the model.

## Privacy

Screenshots and reports live in your own container. Nothing is shared with anyone, including the people who built this.
