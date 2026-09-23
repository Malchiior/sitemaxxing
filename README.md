# Sitemaxxing — text it your site for a fit check on 9 screens, then get the fix

**Free · MIT · one-click on Plow · runs on the model Plow supplies**

Mog your competition with a fit check from our sitemaxxing AI agent.

Text it your website address. In about a minute it sends back one picture:
your homepage on nine real screen sizes, from a small Android phone to an
ultrawide monitor, with what's broken on each one measured, not guessed. It
also shows how your site looks as a Google result and whether Google, ChatGPT,
Claude and Perplexity can read it at all. Reply "fix" and it sends the fix
list as a prompt for your own coding agent. Paste it into Claude Code, Codex
or Cursor, or reply "send to my agent" with your agent's number and it texts
the prompt straight to it.

Nothing to connect. Nothing to install. No accounts, no keys. One text.

## Install in one text

1. Deploy it on Plow (one click) and text the number it gives you.
2. Send your website address, like `https://sbeoc.com`.
3. That's the setup. It starts the check.

## How it works

1. **The fit check.** It opens your homepage in a real browser as a small Android (360×800), iPhone SE (375×667), iPhone 15 (393×852), iPhone Pro Max (430×932), iPad portrait (768×1024) and landscape (1024×768), laptop (1366×768), desktop (1920×1080) and ultrawide (2560×1080). Touch, pixel density and user agent are set like the real device.
2. **Measured issues.** On each screen it measures, not eyeballs: sideways scrolling, a headline cut off, a popup covering the first screen, broken images, text under 12px, tap targets under WCAG's 24px minimum, text clipped inside its box, page weight, oversized images, and whether the headline and main button are on the first screen. Each issue carries its evidence: the element, its text, the pixel numbers.
3. **One grid.** Nine screenshots in one image, labeled, with a score per screen.
4. **Google and AI.** A drawn-to-scale Google result (labeled as a simulation) showing exactly where your title and description get cut off. Then: does robots.txt or your firewall turn away Googlebot, GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended or CCBot; how much of your text is visible without JavaScript; is there structured data, a sitemap, an llms.txt, alt text, one H1, a share image, a canonical link, a language.
5. **The fix.** Reply "fix". It sends a prompt written for your coding agent: every issue, where it appears, what to change, ordered fix-first. It arrives as text to paste and as a file. The prompt is assembled by code from the measurements, so it can only say what was measured.
6. **Straight to your agent.** If your coding agent has a Plow number, reply "send to my agent +1 555…" and it opens a thread with that agent and sends the fix prompt there. Owner only.
7. **Again, after you deploy.** Text the address again and it re-checks. One page per check: the page you send, or the homepage if you send just the domain. One check at a time, up to 12 an hour.

## A real run, start to finish

Devin texts `https://sbeoc.com`.

> Checking sbeoc.com on 9 screens, plus Google and AI readability. About a minute.

A minute later, the grid and the Google preview, then:

> sbeoc.com on 9 screens. Scores: phones 50–65, tablets 75, laptop and up 90.
> Fix first:
> 1. The logo doesn't load on any phone. Its URL has "https://sbeoc.com/" pasted into the middle of the path. The same logo loads fine on desktop from a different URL; that one is in the fix.
> 2. The page scrolls sideways by 38px on Small Android and iPhone SE (the hero image is fixed at 420px wide).
> Then: 6 buttons under 24px on phones; 11% of text under 12px.
> Google: your title is 74 characters and gets cut off. No meta description, so Google picks its own snippet.
> AI: ChatGPT and Claude are allowed; 92% of your text is readable without JavaScript; no structured data.
> Reply fix and I'll write the fix list for your coding agent.

"fix."

> Here's the fix list for sbeoc.com, written for your coding agent. Paste the whole thing into Claude Code, Codex or Cursor in the site's repo, or reply "send to my agent" with its number and I'll text it there. Text me the address again after you deploy and I'll re-check.
> [FIX-PROMPT.md follows as text, and as a file]

On Fluidic Systems the same check found the homepage downloading a 14.9 MB video on big phones and iPads. Real sites, real findings.

## Every claim maps to something real

| Claim | Where it lives |
|---|---|
| Nine real screen sizes with device touch, density and user agent | `render/audit.mjs` `SCREENS`, Chromium over CDP |
| Sideways scroll, cut headline, covering popup, broken images, tiny text, tap targets, clipped text, page weight, oversized images, headline/action on first screen | `render/measure.js` (runs in the page, returns numbers and elements), `render/audit.mjs` `issuesFor` |
| A score per screen | `render/audit.mjs` `scoreOf`: 100 minus 25 per high, 10 per medium, 4 per low |
| One labeled grid | `render/grid.mjs` |
| Google result drawn to Google's measurements, labeled as a simulation | `render/seo.mjs` `serpHtml` |
| Crawler access for Google, ChatGPT, Claude, Perplexity and others, via robots.txt rules and a real fetch as each crawler | `render/seo.mjs` `CRAWLERS`, `robotsAllows`, firewall detection |
| Text visible without JavaScript | `render/seo.mjs` `htmlText` vs rendered text |
| Title, description, H1, alt text, share image, canonical, sitemap, structured data, llms.txt, language | `render/seo.mjs` issue list |
| Broken-image repairs offered only when proven: a same-alt image that loads on another screen, else the URL with the pasted-in domain removed, only if it returns an image | `render/check.mjs`, `measure.js` `images.working` |
| Public sites only; one check at a time; 12 an hour | `plugins/ro` `ro_check` |
| Fix prompt delivered word for word, as text and as a file | `plugins/ro` `ro_fix_prompt` |
| "send to my agent" is owner-only | `plugins/ro` before-tool-call hook, owner recognised by the host |
| Fix prompt assembled from measurements, not written by a model | `render/summarize.mjs` `fixPrompt`, `FIX` table |
| Read-only, polite: one page load per screen, a few GETs, no forms, no clicks | `render/audit.mjs`, `render/seo.mjs` |

## What's included

✅ Your homepage, or any page you send, on nine screen sizes, in one image, scored
✅ Every issue with its evidence: element, text, pixels
✅ Google result preview showing where the title and description get cut
✅ AI-readability: which crawlers get in, what they can read, structured data, llms.txt
✅ A fix prompt for your own coding agent, ordered fix-first, as text and as a file
✅ "send to my agent": the prompt texted straight to your coding agent's Plow number
✅ Verified image repairs when a broken image can be proven fixable
✅ Re-check after a deploy by texting the address again

❌ Does not change your site; it hands your coding agent the fix
❌ One page per check; it doesn't crawl the rest of the site
❌ Does not click, log in, fill forms or test flows; it looks at the page as a visitor arriving
❌ Does not run a full accessibility audit; it checks the parts a screen size changes (tap size, text size, overflow)
❌ Does not measure real Google rankings; the result preview is a simulation of how the snippet is cut
❌ Does not test sites behind a login or a bot wall, private addresses, or non-standard ports; it says so and stops
❌ Does not re-check on a schedule, host a report page, or generate anything; it measures and hands off
❌ Does not need or accept any API key

## What it will NOT do

- **Guess.** Every issue is a measurement with the element and the numbers. If it can't measure it, it doesn't report it.
- **Write your fix in prose.** The fix prompt is assembled by code from the measurements. The model explains; it doesn't invent findings.
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
| `fix` | The fix prompt for your coding agent, for the last check, as text and as a file |
| `send to my agent +1 555 000 0000` | Texts the fix prompt to your coding agent's Plow number (owner only) |
| the same URL again | Re-check after a deploy |
| `status` | The last check's scores and what's open |

## Who it's for

Anyone with a website who has only ever looked at it on their own phone and their own laptop. Founders about to launch. Agencies before a client review. Teams wondering why ChatGPT never mentions them. Especially useful the day after a deploy.

Not for: apps behind a login, flows that need clicks, or anyone wanting a ranking report.

## Trust

- Findings are measurements, and every one carries evidence you can check yourself.
- The fix prompt is built by code from those measurements. It can only say what was measured.
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

**Can it check my pricing page too?** Yes. Text that page's address. One page per check; a bare domain means the homepage.

**How long does it take?** About a minute. One check runs at a time, up to 12 an hour.

**Why is it free?** It's open source (MIT) and an entry in the AI Worth Using × OpenClaw 2.0 hackathon. Plow supplies the model.

## Privacy

Screenshots and reports live in your own container. Nothing is shared with anyone, including the people who built this.
