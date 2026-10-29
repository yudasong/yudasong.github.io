(() => {
  const links = [...document.querySelectorAll('.article-contents a')];
  const sections = links.map(link => document.querySelector(link.hash)).filter(Boolean);
  let scheduled = false;
  function update() {
    scheduled = false;
    let current = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= 160) current = section;
    }
    for (const link of links) {
      if (current && link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  window.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();
