/**
 * Replaces any <img> that fails to load (deleted upload, bad URL, offline CDN) with a neutral
 * placeholder, instead of the browser's broken-image icon. One capture-phase listener covers
 * every image in the app; each image is swapped at most once so the placeholder can't loop.
 */
export const IMAGE_PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">' +
      '<rect width="400" height="300" fill="#fef3c7"/>' +
      '<path d="M70 230 L160 120 L215 185 L260 140 L330 230 Z" fill="#f59e0b" opacity=".55"/>' +
      '<circle cx="290" cy="90" r="22" fill="#fbbf24" opacity=".8"/>' +
      '</svg>'
  );

export function installImageFallback(doc: Document = document) {
  const onError = (event: Event) => {
    const el = event.target;
    if (!(el instanceof HTMLImageElement) || el.dataset.fallback === '1') return;
    el.dataset.fallback = '1';
    el.removeAttribute('srcset');
    el.src = IMAGE_PLACEHOLDER;
  };
  doc.addEventListener('error', onError, true);
  return () => doc.removeEventListener('error', onError, true);
}
