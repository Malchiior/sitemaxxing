FIX LIST FOR SBEOC.COM

You're working on the website https://sbeoc.com/. On 2026-09-23, an automated check opened the page on 9 screen sizes (360 to 2560 wide) and checked its SEO and how well AI tools can read it. Every item below was measured, not guessed.

Fix them in this codebase. For each one, find the code responsible and make the smallest change that fixes it. Don't change the copy, routes, forms or tracking unless the fix says to. When you're done, check the page at 375px and 1440px wide.

FIX FIRST

1. 1 image(s) don't load (Small Android 360×800, iPhone SE 375×667, iPhone 15 393×852, iPhone Pro Max 430×932, iPad portrait 768×1024)
Fix: These images fail to load: src: wp-contehttps://sbeoc.com/nt/uploads/SBE-LOGO-No-Inc-WEB.jpg, alt: SBE Contracting. Likely correct URLs (checked, they load): wp-contehttps://sbeoc.com/nt/uploads/SBE-LOGO-No-Inc-WEB.jpg -> https://sbeoc.com/wp-content/themes/yootheme/cache/SBE-Electrical-Contracting-Inc-1aeaa06d.png (the working image with the same alt text, "SBE Contracting").

2. The homepage has only 32 characters of text, so Google and AI tools have almost nothing to read
Fix: The page has almost no readable text. Add a real headline that says what the business does, plus a few sentences on who it serves, where, and how to get in touch, using the owner's own information.

THEN

1. No meta description, so Google picks its own snippet
Fix: Add <meta name="description"> of 140-155 characters, using the site's own wording about what it does, for whom and where.

2. 2 of 3 images have no alt text
Fix: Images without alt text: Artboard-1.png-60ft.png; SBE-Electrical-Contracting-Inc-with-blue-cloud-c07dc011.png. Describe each in a few words (what it shows).

3. No structured data, so AI and Google have to guess what your business is
Fix: Add JSON-LD structured data (<script type="application/ld+json">): Organization or LocalBusiness with the name, URL, logo, address, phone and social links shown on the site.

WHEN THERE'S TIME

1. No share image, so links posted on social show no picture
Fix: Add <meta property="og:image"> with a 1200×630 image so shared links show a picture.

2. No llms.txt (a short guide to your site for AI tools)
Fix: Add /llms.txt: a short plain-text summary of the business and links to its key pages, for AI tools (format: llmstxt.org).

Screens checked: Small Android 360×800, iPhone SE 375×667, iPhone 15 393×852, iPhone Pro Max 430×932, iPad 768×1024 and 1024×768, laptop 1366×768, desktop 1920×1080, ultrawide 2560×1080.
