// =====================================================================
//  Stoneledge-only pages. Loaded after settings.js, before the engine.
//  Written from stoneledge.life (Our Process, Design Process, Meet the Team), in the portal's voice.
// =====================================================================
(function () {
  const IMG = 'https://stoneledge.life/wp-content/uploads/2023/11/';

  // The client journey as Stoneledge describes it. `phases` are the build phases (by position) that belong to each step.
  const JOURNEY = [
    { n: 'Homesite discovery', phases: [0], d: 'Our real estate and construction team helps you choose a homesite that fits your family, your views, and the home you have in mind.' },
    { n: 'Design services', phases: [0], d: 'A lifestyle interview, then design, construction, and architecture working as one team, from first concept through permit. One firm, one point of contact.' },
    { n: 'Construction begins', phases: [1, 2, 3], d: 'Site work, foundation, and framing. From here you follow every step in this portal: photographs from the site, decisions when we need you, and a note each Friday.' },
    { n: 'Walk-through & rough-ins', phases: [4, 5], d: 'Once the house is framed, we meet you on site to confirm electrical, mechanical, and plumbing details before the rough-ins begin. Then the systems go in, and every wall is photographed before it closes.' },
    { n: 'Selections & finishes', phases: [6, 7, 8], d: 'Selection meetings at the Design Center on dates that suit you. Not sure where to start? We assemble a few selections in your style, and you choose or build your own.' },
    { n: 'Pre-close tour', phases: [9], d: 'After our own quality inspections and punch lists, we walk the finished house with you: systems, performance, finishes, and craftsmanship. Anything you note is addressed before closing.' },
    { n: 'The Closing', phases: [], d: 'Your keys, along with your photo diary of the construction, your home information manual, and your warranty booklet. All of it stays here in your portal for as long as you own the home.' },
  ];

  const TEAM = [
    ['Meranda Bailey', 'CEO, Owner & Head of Design', 'Guides every client through design and selections; more than twenty years in homebuilding.'],
    ['Jackson Bailey', 'Chief Operating Officer', 'Grew up in custom homebuilding and advises clients from homesite to keys.'],
    ['John Staarmann', 'Builder, Director of Construction', 'Leads the field so every home is built to standard, on schedule, and on budget.'],
    ['Sonya Cosby', 'Design Coordinator', 'Two decades in design, and a long list of clients who became friends.'],
    ['McKenna Bailey', 'Design Coordinator', 'Designs spaces that feel personal to each family.'],
    ['Zack Earley', 'Field Operations Manager', 'Construction management training put to work on site every day.'],
    ['Justin Kelley', 'Field Operations Manager', 'Runs each job as if it were his own home.'],
    ['Wanda Sisk', 'Office Manager', 'Keeps the office, and the paperwork, running smoothly.'],
  ];

  function stepState(i, home) {
    if (!home || !home.phases || !home.phases.length) return '';
    const cur = home.phases.findIndex(p => p.status === 'current');
    const allDone = home.phases.every(p => p.status === 'done');
    if (allDone) return 'done';
    if (i === JOURNEY.length - 1) return '';
    const ph = JOURNEY[i].phases;
    if (cur < 0) return '';
    if (ph.includes(cur)) {
      // Homesite and design share phase I: show design as current once the homesite step is behind them
      if (cur === 0 && i === 0) return 'done';
      return 'current';
    }
    return Math.max(...ph) < cur ? 'done' : '';
  }

  const page = {
    id: 'stoneledge-way',
    label: 'The Stoneledge Way',
    where: 'more',
    who: 'all',
    eyebrow: 'Stoneledge Luxury Homes',
    title: 'The Stoneledge <span class="ital">way</span>',
    intro: 'A design/build firm and artisans of custom luxury homes, with more than thirty years of building in Greenville and across South Carolina. One team from homesite to keys, and a home that is complete the day you close.',
    render(P) {
      const home = P.data ? { phases: P.data.phases } : null, esc = P.esc;
      const steps = JOURNEY.map((s, i) => {
        const st = stepState(i, home);
        return `<li class="sw-step ${st}"><span class="sw-n">${['I','II','III','IV','V','VI','VII'][i]}</span>
          <div><h3>${esc(s.n)}${st === 'current' ? '<span class="sw-here">You are here</span>' : ''}</h3><p>${esc(s.d)}</p></div></li>`;
      }).join('');
      return `
      <section class="sw-journey"><span class="eyebrow">Your journey</span><h2>From homesite to <span class="ital">keys</span></h2>
        <ol class="sw-steps">${steps}</ol></section>

      <figure class="sw-figure"><img src="${IMG}luxury-home-details-7.jpg" alt="A curved staircase with an iron balustrade in a Stoneledge home" loading="lazy"></figure>

      <section class="sw-cols">
        <div><span class="eyebrow">Design</span><h2>Designed around <span class="ital">your life</span></h2>
          <p>Every home begins with a lifestyle analysis, an unhurried conversation about how your family lives, entertains, and rests. Your selection meetings are held at the Design Center on dates that fit your calendar, and if you’d rather not start from a blank page, we’ll assemble a few selections in your style to choose from or build on.</p>
          <p>Through <b>MB Interiors and Design</b>, you also have an interior design liaison and advocate for furniture, window treatments, and décor, with direct-purchase and wholesale pricing that makes furnishing the house simpler.</p>
          <p><a href="#selections" class="btn">See your selections</a></p></div>
        <div><span class="eyebrow">Our promise</span><h2>Complete on the day you <span class="ital">close</span></h2>
          <p>Before your pre-close tour, our own team inspects the house and works through a punch list. Then we walk it with you, system by system and finish by finish. Our standard is simple: “100% complete at closing.”</p>
          <p>At the closing you receive your keys, the photo diary of your home’s construction, your home information manual, and your warranty booklet. Here in your portal they never get lost.</p>
          <p class="sw-links"><a href="#diary">Photo diary →</a> <a href="#manual">Home manual →</a> <a href="#warranty">Warranty →</a></p></div>
      </section>

      <section class="sw-team"><span class="eyebrow">The people behind Stoneledge</span><h2>More than 147 years of <span class="ital">combined experience</span></h2>
        <div class="sw-team-grid">${TEAM.map(([n, t, b]) => `<div class="sw-person"><span class="av">${n.split(' ').map(w => w[0]).join('')}</span><div><b>${esc(n)}</b><span class="small muted">${esc(t)}</span><p class="small">${esc(b)}</p></div></div>`).join('')}</div>
        <p class="small muted">Your own project team, with direct contact details, is under <a href="#team">Your team</a>.</p></section>

      <section class="sw-office"><div><span class="eyebrow">Visit us</span><p>105 Regency Commons Drive, Greer, South Carolina · by appointment</p></div>
        <a class="btn" href="#messages">Arrange a visit</a></section>`;
    },
  };

  const B = window.PORTAL && window.PORTAL.builder;
  if (B) B.pages = [...(B.pages || []), page];
})();
