/* Animate the original Figure 1 SVG; its curve geometry is never reconstructed. */
(() => {
  'use strict';
  const root = document.getElementById('training-animation');
  if (!root) return;
  const NS = 'http://www.w3.org/2000/svg';
  const PRETRAINING = 1.4830489990487605e19;
  // Earliest pre-RL checkpoints represented by the two method envelopes.
  // The staged anchor is the one-epoch midtraining configuration.
  const UNIFIED_RL_START = 1.4929468941938983e19;
  const STAGED_RL_START = 1.520862473448405e19;
  const MAX_COMPUTE = 2.1533828137184055e19;
  const INTRO_FRACTION = .12;
  const UNIFIED_RL_FRACTION = .23;
  const STAGED_RL_FRACTION = .28;
  const DURATION = 10000;
  const FIRST_STAGE_END = 400 / 3;
  const UNIFIED_RL_X = 235;
  // Coordinates from the unmodified pdftocairo conversion of teaser_reasoning.pdf.
  const PLOT = { left: 33.421875, end: 215.925034, top: 3.972656, bottom: 90.699219 };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const plotHost = root.querySelector('[data-training-plot]');
  const toggle = root.querySelector('[data-training-toggle]');
  const restart = root.querySelector('[data-training-restart]');
  const slider = root.querySelector('[data-training-progress]');
  const computeLabel = root.querySelector('[data-training-compute]');
  const phaseLabel = root.querySelector('[data-training-phase]');
  const mixtureClip = root.querySelector('[data-mixture-reveal]');
  const mixtureCursor = root.querySelector('[data-mixture-cursor]');
  let revealRect, plotCursor;
  let progress = reducedMotion.matches ? 1 : 0;
  let playing = false, visible = false, autoStarted = false, explicitlyPaused = false;
  let animationFrame = 0, previousTime = 0;

  function element(name, attrs) {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function logFraction(value, start, end) {
    return Math.log(value / start) / Math.log(end / start);
  }

  function timing(value) {
    const p = Math.max(0, Math.min(1, value));
    // Allocate readable animation time to each interval. Both panels use the
    // same compute budget even though time and schematic stage widths differ.
    const compute = p < INTRO_FRACTION
      ? PRETRAINING * p / INTRO_FRACTION
      : p < UNIFIED_RL_FRACTION
        ? PRETRAINING * Math.pow(UNIFIED_RL_START / PRETRAINING,
          (p - INTRO_FRACTION) / (UNIFIED_RL_FRACTION - INTRO_FRACTION))
        : p < STAGED_RL_FRACTION
          ? UNIFIED_RL_START * Math.pow(STAGED_RL_START / UNIFIED_RL_START,
            (p - UNIFIED_RL_FRACTION) / (STAGED_RL_FRACTION - UNIFIED_RL_FRACTION))
          : STAGED_RL_START * Math.pow(MAX_COMPUTE / STAGED_RL_START,
            (p - STAGED_RL_FRACTION) / (1 - STAGED_RL_FRACTION));
    const plotFraction = compute <= PRETRAINING ? 0 : logFraction(compute, PRETRAINING, MAX_COMPUTE);
    const mixtureX = compute < PRETRAINING
      ? FIRST_STAGE_END * compute / PRETRAINING
      : compute < UNIFIED_RL_START
        ? FIRST_STAGE_END + (UNIFIED_RL_X - FIRST_STAGE_END)
          * logFraction(compute, PRETRAINING, UNIFIED_RL_START)
        : compute < STAGED_RL_START
          ? UNIFIED_RL_X + (2 * FIRST_STAGE_END - UNIFIED_RL_X)
            * logFraction(compute, UNIFIED_RL_START, STAGED_RL_START)
          : FIRST_STAGE_END * (2 + logFraction(compute, STAGED_RL_START, MAX_COMPUTE));
    return { compute, plotX: PLOT.left + plotFraction * (PLOT.end - PLOT.left), mixtureX };
  }

  function render(value) {
    progress = Math.max(0, Math.min(1, value));
    const { compute, plotX, mixtureX } = timing(progress);
    revealRect.setAttribute('width', progress === 1 ? 222.23622 : plotX);
    plotCursor.setAttribute('x1', plotX);
    plotCursor.setAttribute('x2', plotX);
    plotCursor.setAttribute('visibility', progress >= INTRO_FRACTION && progress < 1 ? 'visible' : 'hidden');
    mixtureClip.setAttribute('width', mixtureX);
    mixtureCursor.setAttribute('x1', mixtureX);
    mixtureCursor.setAttribute('x2', mixtureX);
    mixtureCursor.setAttribute('visibility', progress > 0 && progress < 1 ? 'visible' : 'hidden');
    slider.value = String(Math.round(progress * 1000));
    computeLabel.value = `${(compute / 1e19).toFixed(2)} × 10¹⁹ FLOPs`;
    slider.setAttribute('aria-valuetext', `${Math.round(progress * 100)} percent; cumulative compute ${(compute / 1e19).toFixed(2)} times ten to the nineteenth FLOPs`);
    phaseLabel.textContent = progress < INTRO_FRACTION
      ? 'Pretraining (shown at accelerated speed)'
      : compute < UNIFIED_RL_START
        ? 'Staged: midtraining · Unified: pretraining and midtraining data'
        : compute < STAGED_RL_START
          ? 'Staged: midtraining · Unified: RL with midtraining data'
          : progress < 1
            ? 'Staged: RL · Unified: RL with midtraining data'
            : 'The full compute range shown in Figure 1';
  }

  function setPlaying(next) {
    playing = next;
    toggle.textContent = next ? 'Pause' : progress === 1 ? 'Replay' : 'Play';
    toggle.setAttribute('aria-label', `${next ? 'Pause' : progress === 1 ? 'Replay' : 'Play'} training animation`);
    cancelAnimationFrame(animationFrame);
    previousTime = 0;
    if (next) animationFrame = requestAnimationFrame(tick);
  }

  function tick(time) {
    if (!playing) return;
    if (previousTime) render(progress + Math.min(time - previousTime, 100) / DURATION);
    previousTime = time;
    if (progress >= 1) setPlaying(false);
    else animationFrame = requestAnimationFrame(tick);
  }

  function begin() {
    explicitlyPaused = false;
    autoStarted = true;
    if (progress >= 1) render(0);
    setPlaying(true);
  }

  async function initialize() {
    const response = await fetch('assets/teaser_reasoning.svg');
    if (!response.ok) throw new Error('The original teaser plot could not be loaded.');
    const documentSVG = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
    if (documentSVG.querySelector('parsererror')) throw new Error('Invalid teaser SVG.');
    const svg = document.importNode(documentSVG.documentElement, true);
    // Four long plot paths; the short legend swatches must remain fully visible.
    const curves = Array.from(svg.querySelectorAll('path[stroke-width="1.35"]'))
      .filter(path => (path.getAttribute('d') || '').length > 150);
    if (curves.length !== 4) throw new Error('Unexpected original teaser curve count.');
    const defs = svg.querySelector('defs');
    const clip = element('clipPath', { id: 'teaser-curve-reveal', clipPathUnits: 'userSpaceOnUse' });
    revealRect = element('rect', { x: 0, y: 0, width: 222.23622, height: 133.2 });
    clip.appendChild(revealRect);
    defs.appendChild(clip);
    curves.forEach(path => {
      const wrapper = element('g', { 'clip-path': 'url(#teaser-curve-reveal)', 'data-original-curve': '' });
      path.parentNode.insertBefore(wrapper, path);
      wrapper.appendChild(path);
    });
    // Start below the original legend so the guide cannot obscure its labels.
    plotCursor = element('line', { x1: PLOT.left, x2: PLOT.left, y1: 29, y2: PLOT.bottom,
      stroke: '#434b54', 'stroke-width': '.55', 'stroke-dasharray': '1.7 1.7',
      'pointer-events': 'none', visibility: 'hidden', 'aria-hidden': 'true' });
    svg.appendChild(plotCursor);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Original Figure 1: best observed reasoning accuracy and coverage within each compute budget. Solid curves show accuracy; dashed curves show coverage. Blue is unified training; gray is staged training.');
    plotHost.replaceChildren(svg);
    root.querySelector('.training-animation-controls').hidden = false;
    phaseLabel.hidden = false;
    render(progress);
    setPlaying(false);

    toggle.addEventListener('click', () => {
      if (playing) { explicitlyPaused = true; setPlaying(false); }
      else begin();
    });
    restart.addEventListener('click', () => { render(0); begin(); });
    slider.addEventListener('input', () => {
      explicitlyPaused = true;
      autoStarted = true;
      render(Number(slider.value) / 1000);
      setPlaying(false);
    });
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (!visible) { if (playing) setPlaying(false); return; }
      if (document.hidden || reducedMotion.matches || explicitlyPaused) return;
      if (!autoStarted) begin();
      else if (progress < 1) setPlaying(true);
    }, { threshold: .15 });
    observer.observe(root);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) setPlaying(false);
      else if (visible && autoStarted && progress < 1 && !explicitlyPaused && !reducedMotion.matches) setPlaying(true);
    });
    reducedMotion.addEventListener('change', event => {
      if (event.matches) { setPlaying(false); render(1); setPlaying(false); }
    });
    // A printed page should contain the complete original figure.
    let beforePrint = null;
    window.addEventListener('beforeprint', () => { beforePrint = { progress, playing }; setPlaying(false); render(1); });
    window.addEventListener('afterprint', () => {
      if (!beforePrint) return;
      render(beforePrint.progress);
      setPlaying(beforePrint.playing && visible && !reducedMotion.matches);
      beforePrint = null;
    });
  }
  initialize().catch(error => {
    // Progressive enhancement: retain the complete paper figure if animation is unavailable.
    console.warn('Training animation:', error.message);
  });
})();
