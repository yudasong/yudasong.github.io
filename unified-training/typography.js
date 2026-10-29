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
  function conservativeHyphenation(word) {
    // Keep short words, abbreviations, and existing compounds intact.
    const match = word.match(/^([a-z]{9,})([.,;:!?]?)$/);
    if (!match || !hyphenate) return [word];
    const parts = hyphenate(match[1]);
    parts[parts.length - 1] += match[2];
    return parts;
  }

  function tooManyHyphenatedLines(p) {
    const range = document.createRange();
    range.selectNodeContents(p);
    let previousHyphenated = false;
    let count = 0;
    for (const br of p.querySelectorAll('br')) {
      range.setEndBefore(br);
      const hyphenated = range.toString().trimEnd().endsWith('-');
      if (hyphenated && (++count > 2 || previousHyphenated)) return true;
      previousHyphenated = hyphenated;
      range.setStartAfter(br);
    }
    return false;
  }

  const desktop = matchMedia('(min-width: 761px)');
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
    if (printing || !desktop.matches || lastWidth === 0) {
      restore();
      return;
    }
    try {
      paragraphs.forEach(p => p.classList.add('tex-linebreak-active'));
      // The engine first attempts whole-word layout. It considers hyphenation
      // only if that cannot meet its spacing constraint, and cleans up its
      // previous layout before each recalculation.
      engine.justifyContent(paragraphs, mode === 'nohyphens' ? undefined : conservativeHyphenation);
      // Prefer whole-word layout if hyphenation becomes visually repetitive.
      paragraphs.filter(tooManyHyphenatedLines).forEach(p => engine.justifyContent(p));
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
    desktop.addEventListener('change', schedule);
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
