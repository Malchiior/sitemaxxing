import { existsSync } from 'node:fs';
import { pageKey } from './pages.mjs';

/** Paired captures, never inferred proof that a visual change fixed a defect. */
export function comparisonScreens(previous, current) {
  if (pageKey(previous.finalUrl ?? previous.url) !== pageKey(current.finalUrl ?? current.url)) return [];
  return current.screens.flatMap(now => {
    const before = previous.screens.find(s => s.id === now.id && s.width === now.width && s.height === now.height);
    if (!before?.foldJpeg || !now.foldJpeg || !existsSync(before.foldJpeg) || !existsSync(now.foldJpeg)) return [];
    return [{ id: now.id, label: now.label, width: now.width, height: now.height,
      before: before.foldJpeg, after: now.foldJpeg, beforeScore: before.score, afterScore: now.score }];
  });
}
