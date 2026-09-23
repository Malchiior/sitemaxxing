// Runs inside the page (via CDP Runtime.evaluate) on one screen size and
// returns measurements, not opinions. Every issue carries the evidence a person
// can check: the element, its text, and the numbers.
//
// Evaluated as an expression: `(${source})(options)`.
async ({ touch, dpr }) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const doc = document.documentElement;
  const body = document.body || doc;

  const short = el => {
    if (!el || !el.tagName) return "";
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`.slice(0, 80);
  };
  const text = el => (el.innerText || el.getAttribute("alt") || el.getAttribute("aria-label") || el.value || "")
    .trim().replace(/\s+/g, " ").slice(0, 70);
  const shown = el => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const all = [...body.querySelectorAll("*")].filter(el => !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "svg", "path"].includes(el.tagName));
  const visible = all.filter(shown);

  // 1. Sideways scrolling, and the innermost elements that stick out.
  const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
  const sticking = visible.filter(el => el.getBoundingClientRect().right > vw + 2 && getComputedStyle(el).position !== "fixed");
  const innermost = sticking.filter(el => !sticking.some(other => other !== el && el.contains(other)));
  const overflow = {
    px: Math.max(0, scrollWidth - vw),
    elements: innermost.slice(0, 4).map(el => ({ el: short(el), text: text(el), right: Math.round(el.getBoundingClientRect().right), width: Math.round(el.getBoundingClientRect().width) })),
  };

  // 2. Text size: characters of visible text by rendered font size.
  let chars = 0, under12 = 0, under14 = 0;
  const smallText = [];
  for (const el of visible) {
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(" ").trim();
    if (!own) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    chars += own.length;
    if (size < 12) { under12 += own.length; if (smallText.length < 4) smallText.push({ el: short(el), text: own.slice(0, 50), px: size }); }
    if (size < 14) under14 += own.length;
  }

  // 3. Tap targets on touch screens, not counting links inside a sentence.
  //    Under 24px fails WCAG 2.2's minimum target size (2.5.8); 24-43px is
  //    below Apple's 44px guideline, worth fixing but not broken.
  const controls = visible.filter(el => el.matches("a[href], button, input:not([type=hidden]), select, textarea, [role=button], [onclick]"));
  const inSentence = el => el.tagName === "A" && el.parentElement && getComputedStyle(el).display.startsWith("inline")
    && (el.parentElement.innerText || "").trim().length > text(el).length + 30;
  const targets = touch ? controls.filter(el => !inSentence(el)) : [];
  const dims = el => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; };
  const undersized = targets.filter(el => { const d = dims(el); return d.w < 24 || d.h < 24; });
  // WCAG's spacing exception: an undersized target passes if a 24px circle on
  // its center touches no other target and no other undersized target's circle.
  const center = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const distToRect = (p, el) => {
    const r = el.getBoundingClientRect();
    const dx = Math.max(r.left - p.x, 0, p.x - r.right), dy = Math.max(r.top - p.y, 0, p.y - r.bottom);
    return Math.hypot(dx, dy);
  };
  const failing = undersized.filter(el => {
    const c = center(el);
    return targets.some(other => other !== el && !other.contains(el) && !el.contains(other) && (
      distToRect(c, other) < 12 ||
      (undersized.includes(other) && Math.hypot(c.x - center(other).x, c.y - center(other).y) < 24)));
  });
  const cramped = targets.filter(el => { const d = dims(el); return (d.w < 44 || d.h < 44) && d.w >= 24 && d.h >= 24; });
  const smallTargets = failing;

  // 4. First screen: is the headline and a way to act visible without scrolling?
  const h1 = [...document.querySelectorAll("h1")].find(shown);
  const h1Rect = h1 && h1.getBoundingClientRect();
  const cta = controls.find(el => el.matches("a, button") && /contact|quote|call|book|start|get|buy|shop|demo|talk|sign|order|request/i.test(text(el)));
  const ctaRect = cta && cta.getBoundingClientRect();
  const firstScreen = {
    headline: h1 ? text(h1) : null,
    headlineVisible: Boolean(h1Rect && h1Rect.top < vh && h1Rect.bottom > 0),
    headlineCut: Boolean(h1Rect && (h1Rect.right > vw + 2 || h1Rect.left < -2)),
    action: cta ? text(cta) : null,
    actionVisible: Boolean(ctaRect && ctaRect.top < vh && ctaRect.bottom > 0),
  };

  // 5. Things covering the page on arrival (pop-ups, cookie walls, sticky bars).
  const covering = visible.filter(el => {
    const s = getComputedStyle(el);
    if (s.position !== "fixed" && s.position !== "sticky") return false;
    const r = el.getBoundingClientRect();
    const area = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    return area / (vw * vh) > 0.3;
  }).map(el => ({ el: short(el), text: text(el), share: Math.round(100 * (el.getBoundingClientRect().width * el.getBoundingClientRect().height) / (vw * vh)) }));

  // 6. Text visibly cut off: the element's own text runs past its box, which
  //    clips it. Visually-hidden text (screen-reader headings) doesn't count.
  const clipped = visible.filter(el => {
    const box = el.getBoundingClientRect();
    if (box.width <= 2 || box.height <= 2) return false;
    const s = getComputedStyle(el);
    if (!/(hidden|clip)/.test(s.overflowX + s.overflow) && s.textOverflow !== "ellipsis") return false;
    return [...el.childNodes].some(n => {
      if (n.nodeType !== 3 || !n.textContent.trim()) return false;
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      return r.right > box.right + 2 || r.bottom > box.bottom + 2;
    });
  }).slice(0, 4).map(el => ({ el: short(el), text: text(el) }));

  // 7. Images: broken, and far larger than this screen can show, counting the
  //    device's real pixel density (a phone at 3x needs 3x the pixels).
  const imgs = [...document.images].filter(shown);
  const broken = imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute("src"));
  const oversized = imgs.filter(i => i.naturalWidth > 2 * i.getBoundingClientRect().width * dpr && i.naturalWidth > 800)
    .slice(0, 4).map(i => ({ src: (i.currentSrc || i.src).split("/").pop().slice(0, 60), natural: i.naturalWidth, shown: Math.round(i.getBoundingClientRect().width), needed: Math.round(i.getBoundingClientRect().width * dpr) }));

  // 8. Speed: largest paint, bytes and requests.
  const lcp = await new Promise(resolve => {
    let last = null;
    try {
      new PerformanceObserver(list => { const e = list.getEntries(); last = e[e.length - 1]; })
        .observe({ type: "largest-contentful-paint", buffered: true });
    } catch { /* not supported */ }
    setTimeout(() => resolve(last ? Math.round(last.startTime) : null), 300);
  });
  const resources = performance.getEntriesByType("resource");
  const nav = performance.getEntriesByType("navigation")[0];
  const bytes = resources.reduce((sum, r) => sum + (r.transferSize || r.encodedBodySize || 0), nav ? (nav.transferSize || 0) : 0);

  return {
    viewport: { width: vw, height: vh },
    pageHeight: Math.round(doc.scrollHeight),
    viewportMeta: document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? null,
    overflow,
    text: { chars, under12Pct: chars ? Math.round(100 * under12 / chars) : 0, under14Pct: chars ? Math.round(100 * under14 / chars) : 0, examples: smallText },
    tapTargets: {
      total: targets.length, small: smallTargets.length, cramped: cramped.length,
      examples: smallTargets.slice(0, 4).map(el => ({ el: short(el), text: text(el), w: Math.round(dims(el).w), h: Math.round(dims(el).h) })),
      crampedExamples: cramped.slice(0, 3).map(el => ({ el: short(el), text: text(el), w: Math.round(dims(el).w), h: Math.round(dims(el).h) })),
    },
    firstScreen,
    covering,
    clipped,
    images: { total: imgs.length, broken, oversized },
    speed: {
      lcpMs: lcp, loadMs: nav ? Math.round(nav.loadEventEnd) : null, kb: Math.round(bytes / 1024), requests: resources.length + 1,
      heaviest: [...resources].sort((a, b) => (b.transferSize || b.encodedBodySize || 0) - (a.transferSize || a.encodedBodySize || 0)).slice(0, 3)
        .map(r => ({ file: r.name.split("?")[0].split("/").pop().slice(0, 60), kb: Math.round((r.transferSize || r.encodedBodySize || 0) / 1024), type: r.initiatorType })),
    },
  };
}
