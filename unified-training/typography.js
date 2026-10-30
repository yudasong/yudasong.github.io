/* TeX paragraph layout. Article text stays editable in index.html. */
(() => {
  const article = document.querySelector('article');
  const candidates = article ? Array.from(article.querySelectorAll(
    'p:not(.training-panel-heading):not(.training-animation-phase), li, figcaption'
  )) : [];
  // Typeset prose only. Skip empty paragraphs and parents whose child prose
  // blocks are already selected, so nested lists/captions are not processed twice.
  const paragraphs = candidates.filter(p => p.textContent.trim() &&
    !p.querySelector('p, li, ul, ol, figure, table'));
  const engine = window.texLineBreak_lib;
  if (!article || !paragraphs.length || !engine) return;

  // Comparison modes: ?typesetting=browser or ?typesetting=nohyphens.
  const mode = new URLSearchParams(location.search).get('typesetting');
  if (mode === 'browser') return;

  const patterns = window['texLineBreak_hyphens_en-us'];
  const hyphenate = patterns && engine.createHyphenator({
    ...patterns,
    leftmin: 3,
    rightmin: 3,
  });
  function conservativeHyphenation(word, minimumLength = 9) {
    // Keep short words, abbreviations, and existing compounds intact.
    const match = word.match(/^([a-z]{9,})([.,;:!?]?)$/);
    if (!match || match[1].length < minimumLength || !hyphenate) return [word];
    const parts = hyphenate(match[1]);
    parts[parts.length - 1] += match[2];
    return parts;
  }

  function tooManyHyphenatedLines(p) {
    const range = document.createRange();
    range.selectNodeContents(p);
    const breaks = p.querySelectorAll('br');
    // Narrow columns have more lines. Allow occasional hyphenation without
    // forcing long phone paragraphs into widely spaced whole-word layouts.
    const limit = Math.max(2, Math.ceil((breaks.length + 1) / 5));
    const consecutiveLimit = p.clientWidth < 400 ? 2 : 1;
    let consecutive = 0;
    let count = 0;
    for (const br of breaks) {
      range.setEndBefore(br);
      const hyphenated = range.toString().trimEnd().endsWith('-');
      consecutive = hyphenated ? consecutive + 1 : 0;
      if (hyphenated && (++count > limit || consecutive > consecutiveLimit)) return true;
      range.setStartAfter(br);
    }
    return false;
  }

  const originalWhiteSpace = paragraphs.map(p => ({
    value: p.style.getPropertyValue('white-space'),
    priority: p.style.getPropertyPriority('white-space'),
  }));
  let frame = 0;
  let lastWidth = -1;
  let printing = false;

  function restore() {
    paragraphs.forEach((p, i) => {
      engine.unjustifyContent(p);
      const original = originalWhiteSpace[i];
      if (original.value) {
        p.style.setProperty('white-space', original.value, original.priority);
      } else {
        p.style.removeProperty('white-space');
      }
      p.classList.remove('tex-linebreak-active');
    });
  }

  function layout() {
    frame = 0;
    lastWidth = article.getBoundingClientRect().width;
    if (printing || lastWidth === 0) {
      restore();
      return;
    }
    try {
      paragraphs.forEach(p => p.classList.add('tex-linebreak-active'));
      // The engine first attempts whole-word layout. It considers hyphenation
      // only if that cannot meet its spacing constraint, and cleans up its
      // previous layout before each recalculation.
      engine.justifyContent(paragraphs, mode === 'nohyphens' ? undefined : conservativeHyphenation);
      // Try fewer hyphenation candidates before dropping hyphens altogether.
      // This avoids large word gaps in long paragraphs on narrow screens.
      if (mode !== 'nohyphens') {
        paragraphs.filter(tooManyHyphenatedLines).forEach(p => {
          engine.justifyContent(p, word => conservativeHyphenation(word, 12));
          if (tooManyHyphenatedLines(p)) engine.justifyContent(p);
        });
      }
    } catch (error) {
      restore();
      console.warn('Paragraph typesetting fell back to browser layout.', error);
    }
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(layout);
  }

  async function start() {
    if (document.fonts) await document.fonts.ready;
    layout();
    if ('ResizeObserver' in window) {
      new ResizeObserver(entries => {
        if (Math.abs(entries[0].contentRect.width - lastWidth) > 0.5) schedule();
      }).observe(article);
    }
    window.addEventListener('resize', schedule);
    document.fonts?.addEventListener('loadingdone', schedule);
    window.addEventListener('beforeprint', () => {
      printing = true;
      cancelAnimationFrame(frame);
      restore();
    });
    window.addEventListener('afterprint', () => {
      printing = false;
      schedule();
    });
  }
  start();
})();
