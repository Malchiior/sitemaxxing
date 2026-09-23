# Fix list for anyaiagent.xyz

You're working on the website https://www.anyaiagent.xyz/. On 2026-09-23, an automated check opened its homepage on 9 screen sizes (360 to 2560 wide) and checked its SEO and how well AI tools can read it. Every item below was measured, not guessed.

Fix them in this codebase. For each one, find the code responsible and make the smallest change that fixes it. Don't change the copy, routes, forms or tracking unless the fix says to. When you're done, check the page at 375px and 1440px wide.

## Then

- **12% of the text is smaller than 12px** (all 9 screens)
  Fix: Text smaller than 12px: el: div.tsub, text: AI coding agent, px: 9; el: div.tsub, text: OpenAI agent, px: 9; el: div.tsub, text: Agent runtime, px: 9; el: div.mono, text: BEFORE, px: 9.5. Set a floor of 12px, and 16px for body text on phones.

## When there's time

- **7 buttons or links are under Apple's 44px tap size** (Small Android 360×800, iPhone SE 375×667, iPhone 15 393×852, iPhone Pro Max 430×932, iPad portrait 768×1024, iPad landscape 1024×768)
  Fix: Buttons or links under Apple's 44px tap size: el: a, text: AnyAIAgent, w: 144, h: 32; el: a.btn.btn-accent, text: Get started free, w: 128, h: 40; el: button.nav-burger, text: Open menu, w: 40, h: 40. Add padding so each is at least 44px tall on touch screens.
- **Google cuts the title off (76 characters)**
  Fix: Google cuts the title off: "AnyAIAgent — Claude Code in the Cloud and Your Pocket | AI Agent Marketplace". Shorten it to under 60 characters, keeping the most important words first.
- **Google cuts the description off (296 characters)**
  Fix: Google cuts the description off: "Run the genuine Claude Code CLI in a cloud workspace you can reach from your iPhone. Start at your desk, continue from your phone, and schedule work that runs while you sleep. Plus Codex, Antigravity, OpenClaw and 750+ pre-built agents in the same AI agent marketplace. Free tier, no credit card.". Shorten it to under 155 characters.

Screens checked: Small Android 360×800, iPhone SE 375×667, iPhone 15 393×852, iPhone Pro Max 430×932, iPad 768×1024 and 1024×768, laptop 1366×768, desktop 1920×1080, ultrawide 2560×1080.
