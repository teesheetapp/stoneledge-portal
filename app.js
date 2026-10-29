/* Builder client portal — app logic
   One codebase for every builder; branding and wording come from config.js. */
(() => {
'use strict';

/* ================= setup ================= */
const CFG = window.PORTAL;
const params = new URLSearchParams(location.search);
const SLUG = params.get('builder') || CFG.hosts[location.hostname] || CFG.defaultBuilder;
const B = CFG.builders[SLUG] || CFG.builders[CFG.defaultBuilder];
const L = B.labels;
const AUTH_FLOW = (/type=(invite|recovery|signup|magiclink)/.exec(location.hash) || [])[1] || null;
const BUCKET = 'project-files';

const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, detectSessionInUrl: true } });

const S = {
  me: null, builder: null, projects: [], homeStats: {}, pid: null, d: null,
  view: 'overview', urls: {}, draft: [], ui: { openPhase: null, openSel: null, thread: null, docFolder: 'All', docQ: '' },
  profiles: {}, lastSeen: null, poll: null
};

/* ================= brand ================= */
function applyBrand() {
  const c = B.colors, map = { bg:'--bg', surface:'--surface', surface2:'--surface-2', ink:'--ink', muted:'--muted', line:'--line',
    hero:'--navy', hero2:'--navy-2', heroInk:'--navy-ink', heroMuted:'--navy-muted', accent:'--brass', accentBright:'--brass-bright',
    accentSoft:'--brass-soft', btn:'--btn', btnInk:'--btn-ink' };
  const decl = o => Object.entries(map).map(([k,v]) => o[k] ? `${v}:${o[k]};` : '').join('');
  const st = document.createElement('style');
  st.textContent = `:root{${decl(c.light)}--f-display:${B.fonts.display};--f-body:${B.fonts.body};}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${decl(c.dark)}color-scheme:dark}}
:root[data-theme="dark"]{${decl(c.dark)}color-scheme:dark}`;
  document.head.appendChild(st);
  if (B.fonts.href) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = B.fonts.href; document.head.appendChild(l); }
  document.title = `${B.fullName} · ${L.client} portal`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.light.hero);
}
const logoImg = (cls = '') => `<span class="logo ${cls}"><img class="lg-d" src="${esc(B.logo.onLight)}" alt="${esc(B.fullName)}"><img class="lg-l" src="${esc(B.logo.onDark)}" alt="" aria-hidden="true"></span>`;
const wordmark = () => B.logo
  ? `<a class="wordmark" href="#overview">${logoImg()}</a>`
  : `<a class="wordmark" href="#overview"><b>${esc(B.name)}</b><span>${esc(B.wordmarkSub)}</span></a>`;

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const isoToday = () => { const t = today(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; };
const D = iso => { if (!iso) return null; const [y,m,d] = iso.slice(0,10).split('-').map(Number); return new Date(y, m-1, d); };
const addDays = (iso, n) => { const d = D(iso); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const fd = (iso, o = {month:'short', day:'numeric'}) => iso ? D(iso).toLocaleDateString('en-US', o) : '';
const fdL = iso => fd(iso, {month:'long', day:'numeric', year:'numeric'});
const ft = ts => { if (!ts) return ''; const d = new Date(ts), t = today(), diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - t) / 864e5);
  return diff === 0 ? 'Today · ' + d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'}) : diff === -1 ? 'Yesterday' : d.toLocaleDateString('en-US', {month:'short', day:'numeric'}); };
const daysTo = iso => iso ? Math.round((D(iso) - today()) / 864e5) : null;
const dueText = iso => { const d = daysTo(iso); if (d === null) return 'no date set'; return d < 0 ? `${-d} days past due` : d === 0 ? 'due today' : d === 1 ? 'due tomorrow' : `due in ${d} days`; };
const money = n => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(+n || 0)).toLocaleString('en-US');
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + '$' + Math.abs(Math.round(+n || 0)).toLocaleString('en-US');
const ini = n => (n || '?').split(/\s+/).map(w => w[0]).join('').slice(0,2).toUpperCase();
const ROM = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
const rom = i => ROM[i] || String(i + 1);
const short = n => (n || '').split(':')[0];
const val = id => ($('#' + id)?.value ?? '').trim();
const must = r => { if (r.error) throw r.error; return r.data; };
const isStaff = () => S.me && ['admin','staff'].includes(S.me.role);
const isAdmin = () => S.me?.role === 'admin';
const nameOf = id => S.profiles[id]?.full_name || S.profiles[id]?.email || (id === S.me?.id ? (S.me.full_name || 'You') : 'Team member');
const firstName = id => nameOf(id).split(' ')[0];
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

let tT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(tT); tT = setTimeout(() => el.hidden = true, 3200); }
function modal(html, wide) { const m = $('#modal'); m.innerHTML = `<div class="scrim" data-act="modal-close"></div><div class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`; m.hidden = false; m.querySelector('input,textarea,select')?.focus(); }
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; S.draft = []; }

async function compress(file, max = 2000, q = 0.84) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', q));
  } catch { return file; }
}
async function upload(path, blob, contentType) {
  must(await sb.storage.from(BUCKET).upload(path, blob, { contentType: contentType || blob.type || 'application/octet-stream', upsert: false }));
  return path;
}
async function signPaths(paths) {
  paths.filter(p => p && /^https?:\/\//.test(p)).forEach(p => { S.urls[p] = p; }); // images linked by web address are used as-is
  const need = [...new Set(paths.filter(p => p && !S.urls[p]))];
  if (!need.length) return;
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(need, 60 * 60 * 6);
  (data || []).forEach(x => { if (x.signedUrl) S.urls[x.path] = x.signedUrl; });
}
async function log(body, view) { if (S.pid) await sb.from('activity').insert({ project_id: S.pid, body, view }); }

/* ================= auth screens ================= */
function authShell(inner) {
  $('#app').innerHTML = `<div class="wrap auth"><div class="auth-card">${wordmark()}${inner}</div></div>`;
}
function renderLogin(msg) {
  authShell(`
    <h1>Welcome <span class="ital">home</span></h1>
    <p class="lead">Sign in to follow your home from first drawings to the day you receive your keys.</p>
    <form id="login-form">
      <div class="field"><label for="li-email">Email</label><input id="li-email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="li-pass">Password</label><input id="li-pass" type="password" autocomplete="current-password" required></div>
      ${msg ? `<p class="inline-err">${esc(msg)}</p>` : ''}
      <button class="btn primary" type="submit">Sign in</button>
    </form>
    <p class="auth-foot"><button class="linkbtn" data-act="forgot">Forgot your password?</button></p>
    <p class="auth-foot">Access is by invitation from ${esc(B.fullName)}.</p>`);
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing in';
    const { error } = await sb.auth.signInWithPassword({ email: val('li-email'), password: $('#li-pass').value });
    if (error) return renderLogin(error.message === 'Invalid login credentials' ? 'That email and password don’t match. Try again or reset your password.' : error.message);
    start();
  });
}
function renderSetPassword(reason) {
  authShell(`
    <h1>${reason === 'invite' ? 'Welcome. <span class="ital">Choose a password.</span>' : 'Choose a <span class="ital">new password</span>'}</h1>
    <p class="lead">${reason === 'invite' ? `${esc(B.fullName)} has invited you to your home’s private portal.` : 'Enter a new password for your account.'}</p>
    <form id="pw-form">
      <div class="field"><label for="pw1">Password (at least 8 characters)</label><input id="pw1" type="password" autocomplete="new-password" minlength="8" required></div>
      <div class="field"><label for="pw2">Confirm password</label><input id="pw2" type="password" autocomplete="new-password" minlength="8" required></div>
      <p class="inline-err" id="pw-err" hidden></p>
      <button class="btn primary" type="submit">Save and continue</button>
    </form>`);
  $('#pw-form').addEventListener('submit', async e => {
    e.preventDefault();
    const a = $('#pw1').value, b = $('#pw2').value, err = $('#pw-err');
    if (a.length < 8) { err.textContent = 'Use at least 8 characters.'; err.hidden = false; return; }
    if (a !== b) { err.textContent = 'The two passwords don’t match.'; err.hidden = false; return; }
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) { err.textContent = error.message; err.hidden = false; return; }
    history.replaceState(null, '', location.pathname + location.search);
    toast('Password saved'); start(true);
  });
}
function renderNoAccess() {
  authShell(`<h1>Almost <span class="ital">there</span></h1>
    <p class="lead">Your account isn’t connected to a home yet. Your ${esc(B.name)} ${esc(L.projectLead.toLowerCase())} will add you shortly.</p>
    <button class="btn" data-act="signout">Sign out</button>`);
}

/* ================= boot ================= */
async function start(skipFlow) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return renderLogin();
  if (!skipFlow && (AUTH_FLOW === 'invite' || AUTH_FLOW === 'recovery')) return renderSetPassword(AUTH_FLOW);

  const me = (await sb.from('profiles').select('*').eq('id', session.user.id).single()).data;
  if (!me || !me.builder_id) return renderNoAccess();
  S.me = me;
  S.builder = (await sb.from('builders').select('*').eq('id', me.builder_id).single()).data;
  await loadProjects();

  if (!S.projects.length && !isStaff()) return renderNoAccess();
  const remembered = store.get('portal.pid');
  const hash = location.hash.slice(1);
  if (S.projects.some(p => p.id === remembered)) S.pid = remembered;
  else if (!isStaff() || S.projects.length === 1) S.pid = S.projects[0]?.id || null;

  if (isStaff() && (!S.pid || hash === 'homes')) S.view = 'homes';
  else S.view = resolveView(hash);
  if (S.pid && S.view !== 'homes') await loadProject(S.pid);
  render();
  clearInterval(S.poll);
  S.poll = setInterval(() => { if (document.visibilityState === 'visible' && S.pid && S.view === 'messages') refresh(['messages']); }, 20000);
}

async function loadProjects() {
  S.projects = must(await sb.from('projects').select('*').eq('archived', false).order('created_at', { ascending: false }));
  if (isStaff() && S.projects.length) {
    const ids = S.projects.map(p => p.id);
    const [ph, qs, co] = await Promise.all([
      sb.from('phases').select('project_id,status,name,position').in('project_id', ids),
      sb.from('questions').select('project_id').eq('status', 'open').in('project_id', ids),
      sb.from('change_orders').select('project_id').eq('status', 'pending').in('project_id', ids)]);
    S.homeStats = {};
    ids.forEach(id => {
      const phases = (ph.data || []).filter(x => x.project_id === id).sort((a,b) => a.position - b.position);
      S.homeStats[id] = { progress: progressOf(phases), current: phases.find(x => x.status === 'current'),
        open: (qs.data || []).filter(x => x.project_id === id).length + (co.data || []).filter(x => x.project_id === id).length };
    });
  }
}

const TABLES = {
  phases: q => q.order('position'),
  updates: q => q.order('created_at', { ascending: false }),
  update_photos: q => q.order('position'),
  update_comments: q => q.order('created_at'),
  update_thanks: q => q,
  questions: q => q.order('created_at', { ascending: false }),
  selections: q => q.order('due_date', { ascending: true, nullsFirst: false }),
  selection_options: q => q.order('position'),
  change_orders: q => q.order('number', { ascending: false }),
  draws: q => q.order('position'),
  events: q => q.order('starts_on'),
  documents: q => q.order('created_at', { ascending: false }),
  notes: q => q.order('created_at', { ascending: false }),
  threads: q => q.order('position'),
  messages: q => q.order('created_at'),
  activity: q => q.order('created_at', { ascending: false }).limit(40),
  project_members: q => q,
};
async function loadProject(pid, only) {
  const keys = (only || Object.keys(TABLES)).filter(k => TABLES[k]);
  const res = await Promise.all(keys.map(t => TABLES[t](sb.from(t).select('*').eq('project_id', pid))));
  if (!only || !S.d) S.d = {};
  keys.forEach((t, i) => { if (res[i].error) throw res[i].error; S.d[t] = res[i].data; });
  if (!only || only.includes('project')) S.d.project = must(await sb.from('projects').select('*').eq('id', pid).single());
  const profs = must(await sb.from('profiles').select('id,full_name,title,phone,email,role,builder_id'));
  S.profiles = Object.fromEntries(profs.map(p => [p.id, p]));
  await signPaths([...(S.d.update_photos || []).map(p => p.path), ...(S.d.selection_options || []).map(o => o.image_path), S.d.project?.cover_path]);
  if (!only) {
    S.lastSeen = isStaff() ? store.get('portal.seen.' + pid) : S.d.project_members.find(m => m.user_id === S.me.id)?.last_seen_at;
    if (!S.ui.thread && S.d.threads[0]) S.ui.thread = S.d.threads[0].id;
  }
}
async function refresh(keys) { await loadProject(S.pid, keys); render(true); }

/* ================= derived ================= */
function progressOf(phases) {
  if (!phases.length) return 0;
  const done = phases.filter(p => p.status === 'done').length, cur = phases.some(p => p.status === 'current') ? 0.4 : 0;
  return Math.round((done + cur) / phases.length * 100);
}
const P = () => S.d.project;
const curPhase = () => S.d.phases.find(p => p.status === 'current') || S.d.phases.find(p => p.status === 'upcoming') || S.d.phases[S.d.phases.length - 1];
const phaseById = id => S.d.phases.find(p => p.id === id);
const openQs = () => S.d.questions.filter(q => q.status === 'open');
const pendingCOs = () => S.d.change_orders.filter(c => c.status === 'pending');
const optionsOf = sid => S.d.selection_options.filter(o => o.selection_id === sid);
const chosen = s => S.d.selection_options.find(o => o.id === s.chosen_option_id);
const selDueSoon = () => S.d.selections.filter(s => s.status === 'open' && (daysTo(s.due_date) ?? 999) <= 30);
const approvedCOTotal = () => S.d.change_orders.filter(c => c.status === 'approved').reduce((a,c) => a + +c.amount, 0);
const allowanceVar = st => S.d.selections.filter(s => s.status === st && +s.allowance > 0 && chosen(s)).reduce((a,s) => a + +chosen(s).price - +s.allowance, 0);
const unseen = () => S.d.activity.filter(a => a.actor_id !== S.me.id && (!S.lastSeen || new Date(a.created_at) > new Date(S.lastSeen)));
const pm = () => P().pm_id ? S.profiles[P().pm_id] : Object.values(S.profiles).find(p => p.role !== 'client' && p.builder_id === S.me.builder_id);
const clients = () => S.d.project_members.map(m => S.profiles[m.user_id]).filter(Boolean);
const clientFirst = () => { const c = clients(); return c.length ? c.map(x => (x.full_name || x.email).split(' ')[0]).join(' & ') : 'the clients'; };

function actionItems() {
  const items = [];
  openQs().forEach(q => items.push({ sort: q.due_date || '2999-01-01', k: 'Decision', go: 'questions', t: q.question.split(/[:?]/)[0], d: `${dueText(q.due_date)} · from ${firstName(q.asked_by)}` }));
  pendingCOs().forEach(c => items.push({ sort: c.created_at.slice(0,10), k: 'Signature', go: 'changes', t: `CO-${String(c.number).padStart(2,'0')} · ${c.title}`, d: `${signed(c.amount)}${c.days ? ` · ${c.days} days added` : ''} · sent ${ft(c.created_at)}` }));
  selDueSoon().forEach(s => items.push({ sort: s.due_date, k: 'Selection', go: 'selections', t: s.category, d: `${dueText(s.due_date)} · ${fd(s.due_date)}` }));
  if (isStaff()) {
    S.d.selections.filter(s => s.status === 'submitted').forEach(s => items.push({ sort: s.due_date || '2999-01-01', k: 'Confirm', go: 'selections', t: s.category, d: `${clientFirst()} chose ${chosen(s)?.name || 'an option'}`, mine: true }));
    S.d.events.filter(e => e.status === 'requested').forEach(e => items.push({ sort: e.starts_on, k: 'Request', go: 'calendar', t: e.title.replace(' (requested)', ''), d: `${fd(e.starts_on)}${e.time_label ? ' · ' + e.time_label : ''}`, mine: true }));
    S.d.notes.filter(n => !n.reviewed).forEach(n => items.push({ sort: n.created_at.slice(0,10), k: 'Note', go: 'walkthrough', t: n.body.slice(0, 70), d: `${n.room || 'General'} · ${ft(n.created_at)}`, mine: true }));
  }
  return items.sort((a,b) => D(a.sort) - D(b.sort));
}

/* ================= chrome ================= */
const PRIMARY = [['overview','Overview'],['timeline','Timeline'],['updates','From the site'],['decisions','Decisions'],['messages','Messages']];
const MORE = [['diary','Photo diary'],['calendar','Calendar'],['budget','Financials'],['documents','Documents'],['walkthrough','Notes & aftercare'],['team','Your team']];
const DEC = [['questions','Questions'],['selections','Selections'],['changes','Change orders']];
const isDec = v => DEC.some(d => d[0] === v);
const ICONS = {
  overview: '<path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/>',
  updates: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  decisions: '<path d="M5 12l4 4 10-10"/>',
  messages: '<path d="M4 5h16v11H9l-5 4z"/>',
  more: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
};
const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;
function badgeFor(v) {
  if (!S.d) return 0;
  if (v === 'questions') return openQs().length;
  if (v === 'changes') return pendingCOs().length;
  if (v === 'selections') return isStaff() ? S.d.selections.filter(s => s.status === 'submitted').length : selDueSoon().length;
  if (v === 'decisions') return DEC.reduce((a, d) => a + badgeFor(d[0]), 0);
  if (v === 'walkthrough' && isStaff()) return S.d.notes.filter(n => !n.reviewed).length;
  if (v === 'calendar' && isStaff()) return S.d.events.filter(e => e.status === 'requested').length;
  if (v === 'more') return MORE.reduce((a, m) => a + badgeFor(m[0]), 0);
  return 0;
}
// Which page a link opens. "decisions" lands on the tab that needs attention first.
function resolveView(h) {
  if (h === 'decisions') return DEC.find(d => badgeFor(d[0]))?.[0] || 'questions';
  return VIEWS[h] ? h : 'overview';
}
const isCur = v => v === S.view || (v === 'decisions' && isDec(S.view));
function chrome() {
  const inHome = S.view !== 'homes' && S.d;
  const moreCur = MORE.find(m => m[0] === S.view);
  const link = ([v, l]) => { const b = badgeFor(v); return `<a href="#${v}" ${isCur(v) ? 'aria-current="page"' : ''}>${l}${b ? `<sup>${b}</sup>` : ''}</a>`; };
  const moreBadge = badgeFor('more');
  const nav = inHome ? `${isStaff() ? link(['homes','All homes']) : ''}${PRIMARY.map(link).join('')}
      <span class="more"><button class="more-btn" data-act="more" aria-haspopup="true" ${moreCur ? 'aria-current="page"' : ''}>${moreCur ? esc(moreCur[1]) : 'More'}${moreBadge ? `<sup>${moreBadge}</sup>` : ''}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>
      <div class="pop more-pop" id="more-pop" hidden>${MORE.map(([v, l]) => { const b = badgeFor(v); return `<a href="#${v}" class="pop-item">${l}${b ? `<sup>${b}</sup>` : ''}</a>`; }).join('')}</div></span>`
    : (isStaff() ? link(['homes','All homes']) : '');
  const tab = (v, l) => { const b = badgeFor(v); return `<a href="#${v}" ${isCur(v) ? 'aria-current="page"' : ''}>${icon(v)}<span>${l}</span>${b ? `<i class="tb-badge">${b}</i>` : ''}</a>`; };
  return `
  <header class="mast"><div class="wrap">
    <div class="mast-row">
      ${wordmark()}
      <div class="mast-right">
        ${inHome ? `<div style="position:relative"><button class="iconbtn" data-act="bell" aria-label="Notifications" id="bell"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>${unseen().length ? '<span class="dot"></span>' : ''}</button><div class="pop" id="pop" hidden></div></div>` : ''}
        <div class="acct"><button class="acct-btn" data-act="acct" aria-label="Your account"><span class="av ${isStaff() ? '' : 'owner'}">${ini(S.me.full_name || S.me.email)}</span></button><div class="pop" id="acct-pop" hidden></div></div>
      </div>
    </div>
    ${nav ? `<div class="navrow"><nav class="nav" aria-label="Sections">${nav}</nav></div>` : ''}
  </div></header>
  ${inHome ? `<nav class="tabbar" aria-label="Sections">${tab('overview','Home')}${tab('updates','Updates')}${tab('decisions','Decisions')}${tab('messages','Messages')}
    <button data-act="more-sheet" ${moreCur || S.view === 'timeline' ? 'aria-current="page"' : ''}>${icon('more')}<span>More</span>${moreBadge ? `<i class="tb-badge">${moreBadge}</i>` : ''}</button></nav>` : ''}`;
}
function pageHead(eyebrow, title, intro, aside = '') {
  if (S.embed) return aside ? `<div class="subhead"><span></span><div>${aside}</div></div>` : '';
  return `<div class="page-h"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1>${intro ? `<p>${intro}</p>` : ''}</div>${aside ? `<div>${aside}</div>` : ''}</div>`;
}
function vDecisions() {
  const waiting = badgeFor('decisions');
  const head = isStaff()
    ? pageHead('Decisions', `Waiting on <span class="ital">${esc(clientFirst())}</span>`, 'Questions, selections, and change orders for this home, in one place.')
    : pageHead('Decisions', waiting ? `${waiting === 1 ? 'One thing' : (['Two','Three','Four','Five','Six','Seven','Eight','Nine'][waiting - 2] || waiting) + ' things'} <span class="ital">${waiting === 1 ? 'needs' : 'need'} you</span>` : 'All caught <span class="ital">up</span>',
      'Every choice we need from you, with when it’s needed and why. Your answers are kept here as a permanent record.');
  const tabs = `<div class="dtabs" role="tablist">${DEC.map(([v, l]) => { const b = badgeFor(v); return `<a href="#${v}" role="tab" aria-selected="${S.view === v}" ${S.view === v ? 'aria-current="page"' : ''}>${l}${b ? `<sup>${b}</sup>` : ''}</a>`; }).join('')}</div>`;
  S.embed = true; let body; try { body = VIEWS[S.view](); } finally { S.embed = false; }
  return head + tabs + body;
}
const editBtn = (act, id, label = 'Edit') => isStaff() ? `<button class="edit-link" data-act="${act}" ${id ? `data-id="${id}"` : ''}>${label}</button>` : '';

function render(keepScroll) {
  const y = window.scrollY;
  const v = S.view === 'homes' ? vHomes() : !S.d ? '' : isDec(S.view) ? vDecisions() : VIEWS[S.view]();
  $('#app').innerHTML = chrome() + `<main class="wrap" id="view">${v}</main>` +
    (isStaff() && S.d && S.view !== 'homes' ? `<button class="fab" data-act="post-open" aria-label="Post an update"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span>Post update</span></button>` : '');
  if (keepScroll) window.scrollTo(0, y);
  const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight;
  $('#nav [aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/* ================= shared bits ================= */
function photoBtn(p) {
  const url = S.urls[p.path];
  return `<button class="ph" data-act="ph-open" data-id="${p.id}" aria-label="Open photo${p.caption ? ': ' + esc(p.caption) : ''}">${url ? `<img src="${esc(url)}" alt="${esc(p.caption)}" loading="lazy">` : ''}${p.caption ? `<span class="cap">${esc(p.caption)}</span>` : ''}</button>`;
}
function mosaic(photos) {
  const ps = photos.slice(0, 3);
  if (!ps.length) return '';
  return `<div class="mosaic ${ps.length === 1 ? 'one' : ps.length === 2 ? 'two' : ''}">${ps.map(photoBtn).join('')}</div>`;
}
const photosOf = uid => S.d.update_photos.filter(p => p.update_id === uid);
const ELEV = `<svg class="elev" viewBox="0 0 960 270" role="img" aria-label="Front elevation drawing">
  <line class="t" x1="0" y1="226" x2="960" y2="226"/><circle class="t" cx="56" cy="168" r="40"/><circle class="t" cx="92" cy="186" r="28"/><line class="t" x1="62" y1="208" x2="62" y2="226"/>
  <rect class="s" x="130" y="146" width="190" height="80"/><polyline class="s" points="122,146 225,98 328,146"/>
  <rect class="s" x="150" y="170" width="44" height="56"/><rect class="s" x="204" y="170" width="44" height="56"/><rect class="s" x="258" y="170" width="44" height="56"/>
  <line class="t" x1="150" y1="184" x2="194" y2="184"/><line class="t" x1="204" y1="184" x2="248" y2="184"/><line class="t" x1="258" y1="184" x2="302" y2="184"/><rect class="s" x="212" y="114" width="26" height="22"/>
  <rect class="s" x="320" y="160" width="60" height="66"/><rect class="s" x="334" y="176" width="32" height="38"/>
  <rect class="s" x="380" y="96" width="300" height="130"/><polyline class="s" points="366,96 530,22 694,96"/><rect class="s" x="602" y="34" width="28" height="56"/><line class="s" x1="598" y1="34" x2="634" y2="34"/>
  <circle class="s" cx="530" cy="66" r="13"/><line class="t" x1="530" y1="53" x2="530" y2="79"/><line class="t" x1="517" y1="66" x2="543" y2="66"/>
  <rect class="s" x="404" y="114" width="34" height="46"/><rect class="s" x="458" y="114" width="34" height="46"/><rect class="s" x="568" y="114" width="34" height="46"/><rect class="s" x="622" y="114" width="34" height="46"/>
  <line class="t" x1="421" y1="114" x2="421" y2="160"/><line class="t" x1="475" y1="114" x2="475" y2="160"/><line class="t" x1="585" y1="114" x2="585" y2="160"/><line class="t" x1="639" y1="114" x2="639" y2="160"/>
  <path class="s" d="M508 226 V186 a22 22 0 0 1 44 0 V226"/><line class="t" x1="530" y1="164" x2="530" y2="226"/><polyline class="s" points="494,164 530,140 566,164"/><line class="s" x1="494" y1="164" x2="566" y2="164"/>
  <rect class="s" x="404" y="176" width="34" height="50"/><rect class="s" x="458" y="176" width="34" height="50"/><rect class="s" x="568" y="176" width="34" height="50"/><rect class="s" x="622" y="176" width="34" height="50"/>
  <rect class="s" x="680" y="132" width="170" height="94"/><line class="s" x1="672" y1="132" x2="858" y2="132"/>
  <line class="t" x1="708" y1="132" x2="708" y2="226"/><line class="t" x1="736" y1="132" x2="736" y2="226"/><line class="t" x1="765" y1="132" x2="765" y2="226"/><line class="t" x1="794" y1="132" x2="794" y2="226"/><line class="t" x1="822" y1="132" x2="822" y2="226"/>
  <circle class="t" cx="908" cy="160" r="44"/><line class="t" x1="908" y1="204" x2="908" y2="226"/></svg>`;

/* ================= views ================= */
function vHomes() {
  return pageHead(esc(B.fullName), 'Your <span class="ital">homes</span>', `Every home in progress. Open one to post updates, ask for decisions, and keep ${esc(L.client.toLowerCase())}s informed.`, `<button class="btn primary" data-act="home-new">New home</button>`) +
  (S.projects.length ? `<div class="homes">${S.projects.map(p => { const st = S.homeStats[p.id] || {}; return `
    <button class="home-card" data-act="home-open" data-id="${p.id}">
      <span class="eyebrow">${esc(p.lot || p.address || 'New home')}</span>
      <h3>${esc(p.name)}</h3>
      <span class="small muted">${esc(p.client_names || 'No clients invited yet')}</span>
      <div class="meter" style="margin:6px 0 0"><i style="width:${st.progress || 0}%;background:var(--brass)"></i></div>
      <div class="spread small"><span>${st.current ? esc(short(st.current.name)) : 'Not started'}</span><span class="num muted">${st.progress || 0}%</span></div>
      <div class="spread small muted"><span>${p.closing_date ? 'Closing ' + fd(p.closing_date, {month:'short', day:'numeric', year:'numeric'}) : 'Closing date not set'}</span>${st.open ? `<span class="tag brass">${st.open} waiting</span>` : ''}</div>
    </button>`; }).join('')}</div>`
  : `<div class="empty">No homes yet. Add your first one to get started.</div>`);
}

function vOverview() {
  const p = P(), cp = curPhase(), dm = daysTo(p.closing_date);
  const items = actionItems().filter(i => isStaff() || !i.mine);
  const latest = S.d.updates[0];
  const upcoming = S.d.events.filter(e => (daysTo(e.starts_on) ?? -1) >= 0 && e.status !== 'done').slice(0, 4);
  const h = new Date().getHours(), firstN = (S.me.full_name || '').split(' ')[0];
  const greet = isStaff() ? [B.fullName, p.client_names].filter(Boolean).map(esc).join(' · ') : `Good ${h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'}${firstN ? ', ' + esc(firstN) : ''}`;
  const nameParts = p.name.split(' '), last = nameParts.pop();
  const lead = pm();
  return `
  <section class="hero">
    <div class="hero-top">
      <div><span class="eyebrow">${greet}</span>
        <h1>${esc(nameParts.join(' '))} <em>${esc(last)}</em></h1>
        <p class="sub">${[p.lot || p.address, p.summary].filter(Boolean).map(esc).join(' · ')}</p>
        ${isStaff() ? `<div class="row" style="margin-top:14px;gap:18px">${editBtn('home-edit', null, 'Edit details')}<label class="edit-link" for="cover-up">${p.cover_path ? 'Replace rendering' : 'Add a rendering'}<input type="file" id="cover-up" accept="image/*" hidden></label></div>` : ''}</div>
      ${dm !== null ? `<div class="count"><div class="n num">${Math.max(dm, 0)}</div><div class="l">${esc(L.daysUntil)}</div><div class="d">${fdL(p.closing_date)}</div></div>` : ''}
    </div>
    ${p.cover_path && S.urls[p.cover_path] ? `<img class="cover-img" src="${esc(S.urls[p.cover_path])}" alt="Rendering of ${esc(p.name)}">` : ELEV}
    <div class="rail" style="grid-template-columns:repeat(${S.d.phases.length || 1},minmax(0,1fr))" aria-label="Build progress by phase">${S.d.phases.map(ph => `<div class="${ph.status === 'current' ? 'cur' : ph.status}" title="${esc(ph.name)}"><i></i></div>`).join('')}</div>
    <div class="rail-foot"><span>${cp ? `<span class="ital now">${rom(S.d.phases.indexOf(cp))}</span> ${esc(short(cp.name))}${cp.end_date ? ` <span class="muted-h">· through ${fd(cp.end_date)}</span>` : ''}` : 'Schedule to be set'}</span><a href="#timeline" class="rail-link"><b class="num">${progressOf(S.d.phases)}%</b> complete →</a></div>
  </section>

  <div class="grid2">
    <section>
      <div class="sec-h"><h2>${isStaff() ? 'Needs attention' : 'Awaiting your attention'}</h2><span class="aside">${items.length} item${items.length === 1 ? '' : 's'}</span></div>
      ${items.length ? `<div class="todo">${items.map(i => `<a href="#${i.go}"><span class="k">${i.k}</span><span><span class="t">${esc(i.t)}</span><div class="d">${esc(i.d)}</div></span><span class="go" aria-hidden="true">→</span></a>`).join('')}</div>` : `<div class="empty">Nothing is waiting right now.</div>`}
    </section>
    ${!isStaff() ? `
    <aside class="concierge">
      <span class="eyebrow">Your ${esc(L.projectLead.toLowerCase())}</span>
      ${lead ? `<div class="who"><span class="av">${ini(lead.full_name)}</span><div><h3>${esc(lead.full_name || lead.email)}</h3><div class="small muted">${esc(lead.title || L.projectLead)}</div></div></div>` : ''}
      <p class="small muted">Arrange a private visit or a ${esc(L.designCenter)} session. We’ll take care of the details.</p>
      <div class="btns">${B.requestKinds.map((k, i) => `<button class="btn ${i ? '' : 'primary'}" data-act="request" data-k="${esc(k)}">Request a ${esc(k.toLowerCase())}</button>`).join('')}<a class="btn ghost" href="#messages">Send a message</a></div>
    </aside>` : `
    <aside class="concierge">
      <span class="eyebrow">Builder tools</span>
      <div class="btns"><button class="btn primary" data-act="post-open">Post a photo update</button><a class="btn" href="#questions">Ask for a decision</a><a class="btn" href="#changes">Prepare a change order</a><a class="btn ghost" href="#team">Invite ${esc(L.client.toLowerCase())}s</a></div>
      ${clients().length ? `<p class="small muted">${esc(clients().map(c => c.full_name || c.email).join(', '))} ${clients().length > 1 ? 'have' : 'has'} access to this home.</p>` : `<p class="small" style="color:var(--brass)">No ${esc(L.client.toLowerCase())}s invited yet.</p>`}
    </aside>`}
  </div>

  ${latest ? `<section style="margin-top:64px">
    <div class="sec-h"><h2>From the site</h2><a href="#updates">All updates →</a></div>
    <div class="grid2" style="gap:36px">
      ${mosaic(photosOf(latest.id)) || '<div></div>'}
      <div class="stack" style="gap:14px">
        <span class="eyebrow">${ft(latest.created_at)}${phaseById(latest.phase_id) ? ' · ' + esc(short(phaseById(latest.phase_id).name)) : ''}</span>
        <p style="font-family:var(--f-display);font-size:22px;line-height:1.45">${esc(latest.body)}</p>
        <span class="small muted">${esc(nameOf(latest.author_id))}</span>
      </div>
    </div></section>` : ''}

  <div class="grid2" style="margin-top:64px">
    <section>
      <div class="sec-h"><h2>In the weeks ahead</h2><a href="#calendar">Calendar →</a></div>
      ${upcoming.length ? `<div class="month">${upcoming.map(e => eventRow(e, true)).join('')}</div>` : '<div class="empty">Nothing scheduled yet.</div>'}
    </section>
    ${cp ? `<section class="card" style="background:var(--surface-2);border-color:transparent">
      <span class="eyebrow">This phase, explained</span>
      <h3 style="font-size:26px;margin:10px 0 14px">${esc(cp.name)}</h3>
      ${cp.what ? `<p style="margin-bottom:12px">${esc(cp.what)}</p>` : ''}
      ${cp.decisions ? `<p class="small"><span class="eyebrow" style="letter-spacing:.16em">Your decisions</span><br>${esc(cp.decisions)}</p>` : ''}
      <a href="#timeline" class="small" style="display:inline-block;margin-top:16px">Every phase, explained</a>
    </section>` : ''}
  </div>`;
}

function vTimeline() {
  return pageHead('The build', `${S.d.phases.length} phases, <span class="ital">from drawings to keys</span>`, 'Open any phase to see what happens, what to look for when you visit, and the decisions that belong to it.', `<span class="big-figure num">${progressOf(S.d.phases)}%</span><div class="small muted">complete</div>`) +
  `<div>${S.d.phases.map((ph, i) => {
    const open = S.ui.openPhase === ph.id, ups = S.d.updates.filter(u => u.phase_id === ph.id);
    const tag = ph.status === 'done' ? '<span class="tag good">Complete</span>' : ph.status === 'current' ? '<span class="tag solid">Underway</span>' : '<span class="tag">Ahead</span>';
    const pics = ups.flatMap(u => photosOf(u.id)).slice(0, 6);
    return `<div class="phase ${ph.status === 'current' ? 'cur' : ph.status}"><div class="numr">${rom(i)}</div><div class="body">
      <button class="phase-head" data-act="ph-toggle" data-id="${ph.id}" aria-expanded="${open}"><span><h3>${esc(ph.name)}</h3><span class="dates">${ph.start_date ? fd(ph.start_date) + ' – ' + fd(ph.end_date) : 'Dates to be scheduled'}${ups.length ? ` · ${ups.length} update${ups.length > 1 ? 's' : ''}` : ''}</span></span>${tag}</button>
      ${open ? `<div class="phase-detail">
        <div class="explain"><div><span class="eyebrow">What happens</span>${esc(ph.what || '—')}</div><div><span class="eyebrow">When you visit</span>${esc(ph.look || '—')}</div><div><span class="eyebrow">Your decisions</span>${esc(ph.decisions || '—')}</div></div>
        ${pics.length ? `<div class="photos">${pics.map(photoBtn).join('')}</div>` : ''}
        ${isStaff() ? `<div class="row">${ph.status === 'current' ? `<button class="btn primary sm" data-act="ph-complete" data-id="${ph.id}">Mark complete & start next</button>` : ph.status === 'upcoming' ? `<button class="btn sm" data-act="ph-start" data-id="${ph.id}">Start this phase</button>` : ''}<button class="btn sm ghost" data-act="ph-edit" data-id="${ph.id}">Edit phase</button></div>` : ''}
      </div>` : ''}
    </div></div>`; }).join('')}</div>`;
}

function vUpdates() {
  return pageHead('From the site', 'The house, <span class="ital">week by week</span>', 'Every update from the site, photographed and written by your project team.', `<span class="small muted num">${S.d.updates.length} updates · ${S.d.update_photos.length} photographs</span>${isStaff() ? `<div style="margin-top:12px"><button class="btn primary" data-act="post-open">Post update</button></div>` : ''}`) +
  `<div style="max-width:900px"><div class="stack" style="gap:40px">
  ${S.d.updates.length ? S.d.updates.map(u => {
    const ph = photosOf(u.id), cm = S.d.update_comments.filter(c => c.update_id === u.id), th = S.d.update_thanks.filter(t => t.update_id === u.id), mine = th.some(t => t.user_id === S.me.id);
    return `<article class="post">
      <div class="post-h"><span class="av">${ini(nameOf(u.author_id))}</span><div class="who"><b>${esc(nameOf(u.author_id))}</b><span class="meta">${ft(u.created_at)}</span></div>${phaseById(u.phase_id) ? `<span class="tag">${esc(short(phaseById(u.phase_id).name))}</span>` : ''}</div>
      ${u.body ? `<p class="text">${esc(u.body)}</p>` : ''}
      ${mosaic(ph)}
      ${ph.length > 3 ? `<div class="photos">${ph.slice(3).map(photoBtn).join('')}</div>` : ''}
      <div class="post-f"><button class="btn sm ${mine ? 'primary' : 'ghost'}" data-act="thanks" data-id="${u.id}">${mine ? 'Thanked' : 'Thank the team'}${th.length ? ` · ${th.length}` : ''}</button><span>${cm.length} comment${cm.length === 1 ? '' : 's'}</span>${isStaff() ? `<span style="flex:1"></span><button class="edit-link" data-act="up-del" data-id="${u.id}">Delete</button>` : ''}</div>
      <div class="comments">${cm.map(c => `<div class="comment"><span class="av ${S.profiles[c.author_id]?.role === 'client' ? 'owner' : ''}">${ini(nameOf(c.author_id))}</span><div><b>${esc(nameOf(c.author_id))}</b>${esc(c.body)}</div></div>`).join('')}
        <div class="inline-form"><input class="input" id="c-${u.id}" placeholder="Add a comment" aria-label="Add a comment"><button class="btn sm" data-act="c-send" data-id="${u.id}">Send</button></div></div>
    </article>`; }).join('') : `<div class="empty">${isStaff() ? 'No updates yet. Tap Post update to share the first photographs.' : 'Your first update from the site will appear here.'}</div>`}
  </div></div>`;
}

function vQuestions() {
  const open = openQs(), done = S.d.questions.filter(q => q.status === 'answered');
  const form = isStaff() ? `
    <section class="card composer"><span class="eyebrow">Ask ${esc(clientFirst())} for a decision</span>
      <div class="field"><label for="nq-text">Question</label><textarea id="nq-text" placeholder="Library: would you like a concealed outlet inside the bar cabinet?"></textarea></div>
      <div class="row" style="align-items:flex-end"><div class="field"><label for="nq-opts">Suggested answers, separated by commas</label><input id="nq-opts" placeholder="Yes, No, Let's discuss on site"></div>
        <div class="field" style="flex:0 1 190px"><label for="nq-due">Needed by</label><input type="date" id="nq-due" value="${addDays(isoToday(), 7)}"></div></div>
      <div class="field"><label for="nq-why">Why it matters</label><input id="nq-why" placeholder="Needed before insulation"></div>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="q-new">Send</button></div></section>` : '';
  return pageHead('Decisions', 'Questions <span class="ital">for you</span>', 'Each decision your team needs, when it’s needed, and why. Answers are kept here as a permanent record.') +
  `<div class="stack" style="max-width:900px;gap:28px">${form}
    <div class="sec-h" style="margin:0"><h2>Open</h2><span class="aside">${open.length}</span></div>
    ${open.length ? open.map(q => `
      <article class="card q">
        <div class="spread"><span class="small muted">${esc(nameOf(q.asked_by))} · ${ft(q.created_at)}</span><span class="tag ${(daysTo(q.due_date) ?? 99) <= 3 ? 'brass' : ''}">Answer ${dueText(q.due_date)}</span></div>
        <p class="qtext">${esc(q.question)}</p>
        ${q.why ? `<div class="blocker">${esc(q.why)}</div>` : ''}
        ${!isStaff() ? `
          ${q.options?.length ? `<div class="quick">${q.options.map(o => `<button data-act="q-quick" data-id="${q.id}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>` : ''}
          <div class="field"><label for="qa-${q.id}">Your answer</label><textarea id="qa-${q.id}" placeholder="Choose above or write your own"></textarea></div>
          <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="q-send" data-id="${q.id}">Send answer</button></div>`
        : `<div class="row"><span class="small muted" style="flex:1">Awaiting an answer</span><button class="edit-link" data-act="q-del" data-id="${q.id}">Withdraw</button></div>`}
      </article>`).join('') : `<div class="empty">No decisions are waiting.</div>`}
    ${done.length ? `<div class="sec-h" style="margin:20px 0 0"><h2>Decided</h2><span class="aside">${done.length}</span></div>
    ${done.map(q => `<article class="q" style="padding-bottom:22px;border-bottom:1px solid var(--line)"><span class="small muted">${esc(nameOf(q.asked_by))} · ${ft(q.created_at)}</span><p class="qtext" style="font-size:19px">${esc(q.question)}</p>
      <div class="answer"><b>${esc(q.answer)}</b><div class="small muted">${esc(nameOf(q.answered_by))} · ${ft(q.answered_at)}</div></div></article>`).join('')}` : ''}
  </div>`;
}

function vMessages() {
  if (!S.d.threads.length) return pageHead('Messages', 'Your <span class="ital">project team</span>', '') + '<div class="empty">No conversations yet.</div>';
  const th = S.d.threads.find(t => t.id === S.ui.thread) || S.d.threads[0];
  const msgs = S.d.messages.filter(m => m.thread_id === th.id);
  const lastOf = t => { const m = S.d.messages.filter(x => x.thread_id === t.id).pop(); return m ? m.body : 'No messages yet'; };
  return pageHead('Messages', 'Your <span class="ital">project team</span>', 'Every conversation about your home in one place, instead of scattered across texts and email.') + `
  <div class="chat">
    <div class="threads">${S.d.threads.map(t => `<button data-act="thread" data-id="${t.id}" aria-pressed="${t.id === th.id}"><b>${esc(t.name)}</b><span>${esc(lastOf(t))}</span></button>`).join('')}</div>
    <div class="convo">
      <div class="convo-h"><b>${esc(th.name)}</b></div>
      <div class="msgs" id="msgs">${msgs.length ? msgs.map(m => `<div class="msg ${m.author_id === S.me.id ? 'me' : ''}"><span class="av ${S.profiles[m.author_id]?.role === 'client' ? 'owner' : ''}">${ini(nameOf(m.author_id))}</span><div class="bub"><div class="meta">${esc(nameOf(m.author_id))} · ${ft(m.created_at)}</div>${esc(m.body)}</div></div>`).join('') : '<div class="empty">Start the conversation.</div>'}</div>
      <div class="convo-f"><input class="input" id="msg-in" placeholder="Write a message" aria-label="Write a message"><button class="btn primary" data-act="msg-send">Send</button></div>
    </div>
  </div>`;
}

function vSelections() {
  const sels = S.d.selections, order = { open: 0, submitted: 1, later: 2, approved: 3 };
  const list = [...sels].sort((a,b) => order[a.status] - order[b.status] || (D(a.due_date) || 0) - (D(b.due_date) || 0));
  const count = st => sels.filter(s => s.status === st).length;
  return pageHead(esc(L.designCenter), 'Selections', 'Each finish, its date, and how it compares to your allowance. Dates are set so materials arrive before the craftsmen do.', isStaff() ? `<button class="btn primary" data-act="sel-new">Add a selection</button>` : '') + `
  <div class="summary">
    <div class="stat"><div class="v num">${count('open')}</div><div class="l">To choose</div></div>
    <div class="stat"><div class="v num">${count('submitted')}</div><div class="l">With the ${esc(L.designCenter)}</div></div>
    <div class="stat"><div class="v num">${count('approved')}</div><div class="l">Approved</div></div>
    <div class="stat"><div class="v num" style="font-size:30px">${signed(allowanceVar('approved'))}</div><div class="l">Allowance difference</div></div>
  </div>
  ${list.length ? `<div>${list.map(s => {
    const isOpen = S.ui.openSel === s.id, pick = chosen(s), opts = optionsOf(s.id);
    const tag = s.status === 'approved' ? '<span class="tag good">Approved</span>' : s.status === 'submitted' ? `<span class="tag brass">With the ${esc(L.designCenter)}</span>` : s.status === 'later' ? `<span class="tag">Opens later${s.due_date ? ' · ' + fd(s.due_date) : ''}</span>` : `<span class="tag ${(daysTo(s.due_date) ?? 99) <= 14 ? 'solid' : ''}">Due ${s.due_date ? fd(s.due_date) : 'soon'}</span>`;
    return `<section class="sel">
      <button class="sel-head" data-act="sel-toggle" data-id="${s.id}" aria-expanded="${isOpen}">
        <span><h3>${esc(s.category)}</h3><span class="small muted">${esc(s.area || '')}${+s.allowance ? ` · allowance <span class="num">${money(s.allowance)}</span>` : ''}${pick && !isOpen ? ` · <span class="ital">${esc(pick.name)}</span>` : ''}</span></span>${tag}</button>
      ${isOpen ? `${s.note ? `<p class="muted" style="margin-top:14px;font-family:var(--f-display);font-style:italic;font-size:17px">${esc(s.note)}</p>` : ''}
        ${opts.length ? `<div class="opts">${opts.map(o => {
          const diff = +s.allowance ? +o.price - +s.allowance : 0, locked = s.status !== 'open' || isStaff();
          const sw = o.image_path && S.urls[o.image_path] ? `<span class="sw"><img src="${esc(S.urls[o.image_path])}" alt="" style="width:100%;height:100%;object-fit:cover"></span>` : `<span class="sw">${(o.swatches.length ? o.swatches : ['#ccc']).map(c => `<i style="background:${esc(c)}"></i>`).join('')}</span>`;
          return `<button class="opt" ${locked ? 'disabled style="cursor:default"' : ''} data-act="sel-pick" data-id="${s.id}" data-o="${o.id}" aria-pressed="${(S.ui.pick?.[s.id] || s.chosen_option_id) === o.id}">
            ${sw}<b>${esc(o.name)}</b><span class="small muted">${esc(o.detail || '')}</span>
            <span class="price num">${+s.allowance ? `${money(o.price)} · <span class="${diff > 0 ? 'over' : 'under'}">${diff > 0 ? signed(diff) + ' over' : money(-diff) + ' under'}</span>` : (+o.price ? money(o.price) : 'Included')}</span></button>`; }).join('')}</div>`
        : `<p class="muted" style="margin-top:14px">${isStaff() ? 'No options yet. Add the first one below.' : 'Options will be posted here.'}</p>`}
        <div class="row" style="margin-top:18px;justify-content:flex-end">
          ${!isStaff() && s.status === 'open' ? `<span class="small muted" style="flex:1">${S.ui.pick?.[s.id] ? 'Ready to submit.' : 'Select an option to continue.'}</span><button class="btn primary" data-act="sel-submit" data-id="${s.id}" ${S.ui.pick?.[s.id] ? '' : 'disabled'}>Submit selection</button>` : ''}
          ${!isStaff() && s.status === 'submitted' ? `<span class="small muted" style="flex:1">Submitted. The ${esc(L.designCenter)} will confirm pricing and lead time.</span>` : ''}
          ${isStaff() ? `<span style="flex:1"></span><button class="edit-link" data-act="opt-new" data-id="${s.id}">Add option</button><button class="edit-link" data-act="sel-edit" data-id="${s.id}">Edit</button>
            ${s.status === 'submitted' ? `<button class="btn sm ghost" data-act="sel-reopen" data-id="${s.id}">Reopen</button><button class="btn primary sm" data-act="sel-confirm" data-id="${s.id}">Confirm & order</button>` : ''}
            ${s.status === 'later' ? `<button class="btn primary sm" data-act="sel-open" data-id="${s.id}">Open for choosing</button>` : ''}` : ''}
          ${!isStaff() && s.status === 'approved' ? `<span class="small muted" style="flex:1">Ordered. Any change from here is handled through a change order.</span>` : ''}
        </div>` : ''}
    </section>`; }).join('')}</div>` : `<div class="empty">${isStaff() ? 'Add the first selection category, such as plumbing fixtures or countertops.' : 'Your selections will appear here.'}</div>`}`;
}

function vChanges() {
  const pend = pendingCOs().reduce((a,c) => a + +c.amount, 0);
  const form = isStaff() ? `
    <section class="card composer" style="margin-bottom:32px"><span class="eyebrow">Prepare a change order</span>
      <div class="field"><label for="co-title">Change</label><input id="co-title" placeholder="Pendant lighting over the island, three fixtures"></div>
      <div class="field"><label for="co-details">Details</label><textarea id="co-details" placeholder="What changes, what's included, and what isn't"></textarea></div>
      <div class="row" style="align-items:flex-end"><div class="field"><label for="co-amount">Price change ($)</label><input id="co-amount" type="number" inputmode="decimal" placeholder="4800"></div>
        <div class="field"><label for="co-days">Days added to schedule</label><input id="co-days" type="number" inputmode="numeric" value="0"></div></div>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="co-new">Send for signature</button></div></section>` : '';
  return pageHead('Agreements', 'Change orders', 'Every change to the plan, price, or schedule, in writing. Nothing proceeds until it’s signed here.',
    `<div class="small muted">Signed to date</div><span class="big-figure num">${signed(approvedCOTotal())}</span>${pend ? `<div class="small" style="color:var(--brass)">${signed(pend)} awaiting signature</div>` : ''}`) +
  `<div style="max-width:960px">${form}
  ${S.d.change_orders.length ? S.d.change_orders.map(c => `
    <article class="co">
      <div class="stack" style="gap:8px;min-width:0">
        <div class="row" style="gap:10px"><span class="eyebrow" style="color:var(--muted)">CO-${String(c.number).padStart(2,'0')}</span>${c.status === 'approved' ? '<span class="tag good">Signed</span>' : c.status === 'declined' ? '<span class="tag bad">Declined</span>' : '<span class="tag solid">Awaiting signature</span>'}</div>
        <h3>${esc(c.title)}</h3>
        ${c.details ? `<p class="muted" style="max-width:60ch">${esc(c.details)}</p>` : ''}
        <span class="small muted">Prepared by ${esc(nameOf(c.created_by))} · ${ft(c.created_at)}${c.signature ? ` · signed <span class="ital" style="color:var(--ink);font-size:16px">${esc(c.signature)}</span> by ${esc(nameOf(c.signed_by))}, ${ft(c.signed_at)}` : ''}${c.decline_note ? ` · “${esc(c.decline_note)}”` : ''}</span>
      </div>
      <div class="amt">
        <span class="v num">${signed(c.amount)}</span><span class="small muted">${c.days ? `${c.days} day${c.days > 1 ? 's' : ''} added` : 'No schedule change'}</span>
        ${c.status === 'pending' && !isStaff() ? `<div class="row" style="gap:8px"><button class="btn sm ghost" data-act="co-decline" data-id="${c.id}">Decline</button><button class="btn sm primary" data-act="co-approve" data-id="${c.id}">Review & sign</button></div>` : ''}
        ${c.status === 'pending' && isStaff() ? `<span class="small muted">Awaiting ${esc(clientFirst())}</span><button class="edit-link" data-act="co-del" data-id="${c.id}">Withdraw</button>` : ''}
      </div>
    </article>`).join('') : '<div class="empty">No change orders.</div>'}</div>`;
}

function vBudget() {
  const p = P(), contract = +p.contract_amount, co = approvedCOTotal(), av = allowanceVar('approved'), total = contract + co + av;
  const paid = S.d.draws.filter(d => d.status === 'paid').reduce((a,d) => a + contract * d.percent / 100, 0);
  const next = S.d.draws.find(d => d.status === 'next');
  return pageHead('Financials', 'Your investment, <span class="ital">clearly kept</span>', 'Where the agreement stands today and when each draw is due. Change orders and allowance differences are reconciled at closing.', isStaff() ? editBtn('home-edit', null, 'Edit contract amount') : '') + `
  <div class="grid2">
    <section>
      <div class="sec-h"><h2>Draw schedule</h2><span class="aside num">${money(paid)} of ${money(contract)}</span></div>
      <div class="meter" aria-label="Paid versus remaining"><i style="width:${contract ? paid / contract * 100 : 0}%;background:var(--ink)"></i>${next ? `<i style="width:${next.percent}%;background:var(--brass)"></i>` : ''}</div>
      <div class="row small muted" style="margin:6px 0 18px;gap:20px"><span><i style="display:inline-block;width:14px;height:2px;background:var(--ink);vertical-align:middle"></i> Paid</span><span><i style="display:inline-block;width:14px;height:2px;background:var(--brass);vertical-align:middle"></i> Next draw</span></div>
      <div class="tablewrap"><table><thead><tr><th></th><th>Milestone</th><th class="n">Share</th><th class="n">Amount</th><th class="n">Status</th></tr></thead><tbody>
      ${S.d.draws.map((d,i) => `<tr><td class="ital muted" style="font-size:17px">${rom(i)}</td><td><b>${esc(d.name)}</b><div class="small muted">${d.status === 'paid' ? (d.paid_date ? 'Paid ' + fd(d.paid_date) : 'Paid') : (d.due_date ? 'Anticipated ' + fd(d.due_date) : '')}</div></td><td class="n">${+d.percent}%</td><td class="n">${money(contract * d.percent / 100)}</td>
        <td class="n">${isStaff() ? `<select class="input" style="width:auto;font-size:13px" data-change="draw-status" data-id="${d.id}" aria-label="Status of ${esc(d.name)}">${['scheduled','next','paid'].map(s => `<option value="${s}" ${d.status === s ? 'selected' : ''}>${s === 'scheduled' ? 'Scheduled' : s === 'next' ? 'Next' : 'Paid'}</option>`).join('')}</select>`
          : d.status === 'paid' ? '<span class="tag good">Paid</span>' : d.status === 'next' ? '<span class="tag brass">Next</span>' : '<span class="tag">Scheduled</span>'}</td></tr>`).join('')}
      </tbody></table></div>
    </section>
    <div class="stack" style="gap:28px">
      <section class="card">
        <span class="eyebrow">Agreement today</span>
        <div class="ledger" style="margin-top:12px">
          <div><span>Base agreement</span><span>${money(contract)}</span></div>
          <div><span>Signed change orders</span><span>${signed(co)}</span></div>
          <div><span>Allowance differences</span><span>${signed(av)}</span></div>
          <div class="total"><span>Current total</span><span>${money(total)}</span></div>
        </div>
        ${pendingCOs().length || allowanceVar('submitted') ? `<p class="small muted" style="margin-top:12px">Not yet reflected: ${pendingCOs().length} unsigned change order${pendingCOs().length === 1 ? '' : 's'} (${signed(pendingCOs().reduce((a,c) => a + +c.amount, 0))})${allowanceVar('submitted') ? ` and submitted selections (${signed(allowanceVar('submitted'))})` : ''}.</p>` : ''}
      </section>
      ${next ? `<section class="card" style="background:var(--navy);color:var(--navy-ink);border-color:transparent">
        <span class="eyebrow" style="color:var(--brass-bright)">Next draw</span>
        <div class="big-figure num" style="margin:10px 0 6px">${money(contract * next.percent / 100)}</div>
        <p style="color:var(--navy-muted)">${esc(next.name)}${next.due_date ? `, anticipated ${fdL(next.due_date)}` : ''}.</p>
      </section>` : ''}
    </div>
  </div>`;
}

function eventRow(e, compact) {
  const past = (daysTo(e.starts_on) ?? 0) < 0 || e.status === 'done';
  return `<div class="event ${e.is_key ? 'key' : ''} ${past ? 'past' : ''}">
    <div class="date"><div class="d num">${D(e.starts_on).getDate()}</div><div class="w">${fd(e.starts_on, {month:'short'})} · ${fd(e.starts_on, {weekday:'short'})}</div></div>
    <div style="min-width:0"><div class="row" style="gap:10px"><b>${esc(e.title)}</b>${e.status === 'requested' ? '<span class="tag brass">Requested</span>' : ''}</div>
      <div class="small muted">${[e.kind, e.time_label, e.location].filter(Boolean).map(esc).join(' · ')}</div>${e.note ? `<div class="small" style="margin-top:3px">${esc(e.note)}</div>` : ''}</div>
    ${!compact && isStaff() ? `<div class="act row" style="gap:10px">${e.status === 'requested' ? `<button class="btn sm primary" data-act="ev-confirm" data-id="${e.id}">Confirm</button>` : ''}<button class="edit-link" data-act="ev-edit" data-id="${e.id}">Edit</button></div>` : '<div></div>'}
  </div>`;
}
function vCalendar() {
  const groups = {};
  S.d.events.forEach(e => { const k = fd(e.starts_on, {month:'long', year:'numeric'}); (groups[k] = groups[k] || []).push(e); });
  return pageHead('Calendar', 'Visits, inspections <span class="ital">&amp; dates to hold</span>', 'Private visits, design appointments, inspections, and decision dates. Highlighted dates are the ones not to miss.',
    isStaff() ? `<button class="btn primary" data-act="ev-new">Add a date</button>` : B.requestKinds.map(k => `<button class="btn sm ghost" style="margin:0 0 6px 6px" data-act="request" data-k="${esc(k)}">Request a ${esc(k.toLowerCase())}</button>`).join('')) +
  (S.d.events.length ? `<div class="stack" style="max-width:900px;gap:40px">${Object.entries(groups).map(([m, evs]) => `<section class="month"><span class="eyebrow">${m}</span>${evs.map(e => eventRow(e)).join('')}</section>`).join('')}</div>` : '<div class="empty">No dates scheduled yet.</div>');
}

function docRows() {
  const q = S.ui.docQ.trim().toLowerCase();
  const rows = S.d.documents.filter(d => (S.ui.docFolder === 'All' || d.folder === S.ui.docFolder) && (!q || d.name.toLowerCase().includes(q)));
  if (!rows.length) return `<tr><td colspan="4" class="muted" style="text-align:center;padding:28px">${S.d.documents.length ? `No documents match.` : 'No documents yet.'}</td></tr>`;
  const kb = b => !b ? '' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  return rows.map(d => `<tr><td><div class="file"><span class="ext">${esc((d.name.split('.').pop() || 'file').toUpperCase().slice(0,4))}</span><button data-act="doc-open" data-id="${d.id}">${esc(d.name.replace(/\.[a-z0-9]+$/i, ''))}</button>${(Date.now() - new Date(d.created_at)) < 7 * 864e5 ? '<span class="tag brass">New</span>' : ''}</div></td>
    <td class="muted small">${esc(d.folder)}</td><td class="n small">${ft(d.created_at)}</td><td class="n small muted">${kb(d.size_bytes)}${isStaff() ? ` <button class="edit-link" data-act="doc-del" data-id="${d.id}" style="margin-left:8px">Delete</button>` : ''}</td></tr>`).join('');
}
function vDocuments() {
  const folders = ['All', ...new Set([...B.documentFolders.filter(f => S.d.documents.some(d => d.folder === f)), ...S.d.documents.map(d => d.folder)])];
  return pageHead('Archive', 'Documents', 'Drawings, permits, inspections, agreements, and invoices, kept for you long after closing.',
    isStaff() ? `<div class="row" style="align-items:flex-end"><div class="field"><label for="doc-folder">Folder</label><select id="doc-folder">${B.documentFolders.map(f => `<option>${esc(f)}</option>`).join('')}</select></div><label class="btn primary" for="doc-up">Upload<input type="file" id="doc-up" multiple hidden></label></div>` : '') + `
  <div class="folders">${folders.map(f => `<button data-act="doc-folder" data-f="${esc(f)}" aria-pressed="${S.ui.docFolder === f}">${esc(f)}</button>`).join('')}</div>
  <div class="field" style="max-width:480px;margin-bottom:18px"><input class="input" id="doc-q" type="search" placeholder="Search documents" value="${esc(S.ui.docQ)}" aria-label="Search documents"></div>
  <div class="tablewrap"><table><thead><tr><th>Name</th><th>Folder</th><th class="n">Added</th><th class="n">Size</th></tr></thead><tbody id="doc-rows">${docRows()}</tbody></table></div>`;
}

function vWalkthrough() {
  return pageHead('Notes & aftercare', 'Notice something? <span class="ital">Note it here.</span>', `Anything you’d like adjusted, captured as you visit. Your ${esc(L.projectLead.toLowerCase())} reviews each note, and open notes carry into your ${esc(L.finalTour.toLowerCase())}.`) + `
  <div class="grid2">
    <div class="stack" style="gap:40px">
      <section>
        <div class="sec-h"><h2>${isStaff() ? 'Client notes' : 'My notes'}</h2><span class="aside">${S.d.notes.length}</span></div>
        <div class="row" style="align-items:flex-end;margin-bottom:20px">
          <div class="field" style="flex:0 1 170px"><label for="note-room">Room</label><input id="note-room" placeholder="Library"></div>
          <div class="field" style="flex:1 1 240px"><label for="note-text">${isStaff() ? 'Note' : 'What you noticed'}</label><input id="note-text" placeholder="Shelf spacing for the art books"></div>
          <button class="btn primary" data-act="note-add">Add note</button></div>
        ${S.d.notes.map(n => `<div class="spread" style="padding:16px 0;border-top:1px solid var(--line);flex-wrap:nowrap;align-items:flex-start">
          <div style="min-width:0"><span class="eyebrow">${esc(n.room || 'General')}</span><div style="font-family:var(--f-display);font-size:18px;margin-top:4px">${esc(n.body)}</div><div class="small muted">${esc(nameOf(n.author_id))} · ${ft(n.created_at)}</div></div>
          <div class="row" style="gap:6px;flex-wrap:nowrap">${n.reviewed ? '<span class="tag good">Reviewed</span>' : isStaff() ? `<button class="btn sm" data-act="note-ack" data-id="${n.id}">Mark reviewed</button>` : `<span class="tag">With ${esc(firstName(pm()?.id))}</span>`}
          ${n.author_id === S.me.id ? `<button class="edit-link" data-act="note-del" data-id="${n.id}">Remove</button>` : ''}</div></div>`).join('')}
      </section>
    </div>
    <div class="stack" style="gap:28px">
      <section class="card"><span class="eyebrow">Coverage</span>
        <div class="ledger" style="margin-top:12px">${B.warranty.map(([k,v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div></section>
      <section class="card" style="background:var(--navy);color:var(--navy-ink);border-color:transparent">
        <span class="eyebrow" style="color:var(--brass-bright)">${esc(L.closing)} and after</span>
        <p style="font-family:var(--f-display);font-size:20px;line-height:1.45;margin-top:10px">${esc(B.aftercare)}</p>
        <a href="#diary" class="btn" style="margin-top:18px;border-color:var(--brass-bright);color:var(--navy-ink)">Open your photo diary</a>
      </section>
    </div>
  </div>`;
}

function vTeam() {
  const staff = Object.values(S.profiles).filter(p => p.role !== 'client' && p.builder_id === S.me.builder_id);
  return pageHead('Your team', 'The people <span class="ital">building your home</span>', 'One point of contact for everything, so nothing is lost between conversations.') + `
  <div class="people">${staff.map(p => `<section class="card person"><span class="av">${ini(p.full_name || p.email)}</span><div><h3>${esc(p.full_name || p.email)}</h3><span class="eyebrow">${esc(p.title || (p.role === 'admin' ? 'Principal' : 'Team'))}</span></div>
    ${p.phone ? `<div class="copyline"><span>${esc(p.phone)}</span><button class="btn sm ghost" data-act="copy" data-v="${esc(p.phone)}">Copy</button></div>` : ''}
    ${p.email ? `<div class="copyline small muted"><span>${esc(p.email)}</span></div>` : ''}
    ${p.id === P().pm_id ? `<span class="tag brass" style="align-self:flex-start">${esc(L.projectLead)} for this home</span>` : isStaff() ? `<button class="edit-link" style="align-self:flex-start" data-act="set-pm" data-id="${p.id}">Make ${esc(L.projectLead.toLowerCase())} for this home</button>` : ''}
  </section>`).join('')}</div>
  <div class="grid2" style="margin-top:56px">
    <section>
      <div class="sec-h"><h2>${isStaff() ? `${esc(L.client)}s on this home` : 'Visiting the site'}</h2></div>
      ${isStaff() ? `${clients().map(c => `<div class="spread" style="padding:12px 0;border-bottom:1px solid var(--line)"><span>${esc(c.full_name || c.email)}</span><span class="small muted">${esc(c.email || '')}</span></div>`).join('') || '<p class="muted">No one yet.</p>'}
        <div class="composer" style="margin-top:22px"><span class="eyebrow">Invite a ${esc(L.client.toLowerCase())}</span>
          <div class="form-grid"><div class="field"><label for="iv-name">Full name</label><input id="iv-name" placeholder="Lauren Morgan"></div><div class="field"><label for="iv-email">Email</label><input id="iv-email" type="email" placeholder="lauren@example.com"></div></div>
          <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="invite" data-role="client">Send invitation</button></div></div>
        ${isAdmin() ? `<div class="composer" style="margin-top:32px"><span class="eyebrow">Add a team member</span>
          <div class="form-grid"><div class="field"><label for="is-name">Full name</label><input id="is-name"></div><div class="field"><label for="is-email">Email</label><input id="is-email" type="email"></div>
          <div class="field"><label for="is-title">Title</label><input id="is-title" placeholder="${esc(L.projectLead)}"></div><div class="field"><label for="is-phone">Phone</label><input id="is-phone" type="tel"></div></div>
          <div class="row" style="justify-content:flex-end"><button class="btn" data-act="invite" data-role="staff">Invite team member</button></div></div>` : ''}`
      : `<p>${esc(P().site_access || 'You’re welcome during working hours. Please check with your project manager before visiting.')}</p>`}
    </section>
    <section class="card"><span class="eyebrow">${esc(B.fullName)}</span>
      <p style="margin:12px 0 6px">${esc(B.office.address)}</p><p class="small muted">${esc(B.office.hours)}</p>
      ${P().address ? `<div class="copyline" style="margin-top:14px"><span class="muted caps">Site</span><span>${esc(P().address)}</span></div>` : ''}
      ${P().permit ? `<div class="copyline" style="margin-top:14px"><span class="muted caps">Permit</span><span>${esc(P().permit)}</span></div>` : ''}
      ${isStaff() ? `<div style="margin-top:16px">${editBtn('home-edit', null, 'Edit site access & permit')}</div>` : ''}</section>
  </div>`;
}

function vDiary() {
  const p = P(), byDate = (a, b) => new Date(a.created_at) - new Date(b.created_at);
  const chapters = S.d.phases.map((ph, i) => ({ ph, i, ups: S.d.updates.filter(u => u.phase_id === ph.id).sort(byDate) })).filter(c => c.ups.length);
  const loose = S.d.updates.filter(u => !phaseById(u.phase_id)).sort(byDate);
  if (loose.length) chapters.push({ ph: { name: 'Along the way' }, i: null, ups: loose });
  const nPhotos = S.d.update_photos.length;
  const nameParts = p.name.split(' '), last = nameParts.pop();
  const img = ph => S.urls[ph.path] ? `<figure><img src="${esc(S.urls[ph.path])}" alt="${esc(ph.caption || '')}">${ph.caption ? `<figcaption>${esc(ph.caption)}</figcaption>` : ''}</figure>` : '';
  const entry = u => { const ps = photosOf(u.id); return `<article class="entry">
      <span class="eyebrow">${fdL(u.created_at.slice(0, 10))}</span>
      ${u.body ? `<p class="entry-text">${esc(u.body)}</p>` : ''}
      ${ps.length ? `<div class="entry-photos n${Math.min(ps.length, 3)}">${ps.map(img).join('')}</div>` : ''}
    </article>`; };
  return `
  <div class="diary-tools">
    <div><span class="eyebrow">Photo diary</span><p class="muted small" style="margin-top:4px">${S.d.updates.length} entries · ${nPhotos} photograph${nPhotos === 1 ? '' : 's'} · grows with every update from the site</p></div>
    <div class="row"><button class="btn primary" data-act="print">Save as PDF or print</button></div>
  </div>
  <div class="diary">
    <section class="diary-cover">
      ${B.logo ? `<img class="diary-logo" src="${esc(B.logo.onDark)}" alt="${esc(B.fullName)}">` : `<span class="eyebrow">${esc(B.fullName)}</span>`}
      <h1>${esc(nameParts.join(' '))} <em>${esc(last)}</em></h1>
      <p class="sub">${[p.lot, p.address].filter(Boolean).map(esc).join(' · ')}</p>
      ${p.cover_path && S.urls[p.cover_path] ? `<img class="cover-img" src="${esc(S.urls[p.cover_path])}" alt="">` : ELEV}
      <div class="diary-cover-foot"><span class="ital">A photo diary of construction</span><span>${p.start_date ? fd(p.start_date, {month:'long', year:'numeric'}) : ''}${p.closing_date ? ' – ' + fd(p.closing_date, {month:'long', year:'numeric'}) : ''}</span></div>
    </section>
    ${chapters.length ? chapters.map(c => `
    <section class="chapter">
      <header class="ch-head">${c.i !== null ? `<span class="ch-num">${rom(c.i)}</span>` : ''}<div><h2>${esc(c.ph.name)}</h2>${c.ph.start_date ? `<span class="small muted">${fd(c.ph.start_date, {month:'long', day:'numeric'})} – ${fd(c.ph.end_date, {month:'long', day:'numeric', year:'numeric'})}</span>` : ''}</div></header>
      ${c.ph.what ? `<p class="ch-intro">${esc(c.ph.what)}</p>` : ''}
      ${c.ups.map(entry).join('')}
    </section>`).join('') : `<div class="empty" style="margin-top:40px">The diary fills itself as updates are posted from the site.</div>`}
    <section class="diary-end">
      <span class="eyebrow">${esc(L.closing)}</span>
      <h2>Welcome <span class="ital">home</span></h2>
      ${p.closing_date ? `<p class="muted">${fdL(p.closing_date)}</p>` : ''}
      <p class="muted small" style="margin-top:28px">${esc(B.fullName)}${B.tagline ? ' · ' + esc(B.tagline) : ''}</p>
    </section>
  </div>`;
}

const VIEWS = { diary: vDiary, overview: vOverview, timeline: vTimeline, updates: vUpdates, questions: vQuestions, messages: vMessages, selections: vSelections, changes: vChanges, budget: vBudget, calendar: vCalendar, documents: vDocuments, walkthrough: vWalkthrough, team: vTeam };

/* ================= forms in modals ================= */
function homeForm(p = {}) {
  const f = (id, label, v, type = 'text', cls = '') => `<div class="field ${cls}"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(v ?? '')}"></div>`;
  return `<span class="eyebrow">${p.id ? 'Home details' : 'New home'}</span><h2>${p.id ? esc(p.name) : 'Add a home'}</h2>
    <div class="form-grid">
      ${f('h-name', 'Name', p.name || '', 'text', 'full')}
      ${f('h-clients', `${L.client} names`, p.client_names)}${f('h-lot', 'Lot or community', p.lot)}
      ${f('h-address', 'Address', p.address, 'text', 'full')}
      ${f('h-summary', 'Summary (size, bedrooms, features)', p.summary, 'text', 'full')}
      ${f('h-start', 'Start date', p.start_date, 'date')}${f('h-closing', `${L.closing} date`, p.closing_date, 'date')}
      ${f('h-contract', 'Contract amount ($)', p.contract_amount ? +p.contract_amount : '', 'number')}${f('h-permit', 'Permit number', p.permit)}
      ${f('h-access', 'Site access instructions', p.site_access, 'text', 'full')}
    </div>
    ${p.id ? '' : `<p class="small muted">The ${B.phases.length} ${esc(B.name)} build phases, the draw schedule, and message threads are set up automatically.</p>`}
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary" data-act="${p.id ? 'home-save' : 'home-create'}">${p.id ? 'Save' : 'Create home'}</button></div>`;
}
const homeVals = () => ({ name: val('h-name'), client_names: val('h-clients') || null, lot: val('h-lot') || null, address: val('h-address') || null, summary: val('h-summary') || null,
  start_date: val('h-start') || null, closing_date: val('h-closing') || null, contract_amount: +val('h-contract') || 0, permit: val('h-permit') || null, site_access: val('h-access') || null });

function postSheet() {
  const cp = curPhase();
  return `<span class="eyebrow">Post an update</span><h2>From the site</h2>
    <label class="drop" for="post-files" style="position:relative">${S.draft.length ? `${S.draft.length} photo${S.draft.length > 1 ? 's' : ''} ready · add more` : 'Take or choose photos'}<input type="file" id="post-files" accept="image/*" multiple></label>
    ${S.draft.length ? `<div class="thumbs">${S.draft.map((d, i) => `<div class="ph" style="cursor:default"><img src="${d.preview}" alt=""><button class="edit-link" data-act="draft-del" data-i="${i}" style="position:absolute;top:4px;right:6px;color:#fff;z-index:2">✕</button></div>`).join('')}</div>` : ''}
    <div class="field"><label for="post-text">What happened</label><textarea id="post-text" placeholder="Short and specific. What got done, what's next.">${esc(S.postText || '')}</textarea></div>
    <div class="field"><label for="post-phase">Phase</label><select id="post-phase">${S.d.phases.map((p, i) => `<option value="${p.id}" ${cp && p.id === cp.id ? 'selected' : ''}>${rom(i)}. ${esc(short(p.name))}</option>`).join('')}</select></div>
    <p class="inline-err" id="post-err" hidden></p>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary" data-act="post-send">Post</button></div>`;
}

/* ================= actions ================= */
async function act(a, el) {
  const id = el.dataset.id;
  switch (a) {
    case 'modal-close': closeModal(); break;
    case 'print': window.print(); break;
    case 'more': { const pop = $('#more-pop'); pop.hidden = !pop.hidden; break; }
    case 'more-sheet': {
      const items = [['timeline','Timeline'], ...MORE, ...(isStaff() ? [['homes','All homes']] : [])];
      modal(`<span class="eyebrow">${esc(P().name)}</span><nav class="sheet-list">${items.map(([v, l]) => { const b = badgeFor(v); return `<a href="#${v}" ${isCur(v) ? 'aria-current="page"' : ''}><span>${l}</span>${b ? `<sup>${b}</sup>` : '<span class="go">→</span>'}</a>`; }).join('')}</nav>`);
      $('#modal .dialog').classList.add('sheet'); break; }
    case 'signout': await sb.auth.signOut(); location.hash = ''; location.reload(); break;
    case 'forgot': {
      const email = val('li-email'); if (!email) { toast('Enter your email first'); $('#li-email').focus(); break; }
      await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + location.search });
      toast('If that email has an account, a reset link is on its way.'); break; }
    case 'acct': {
      const pop = $('#acct-pop'); if (!pop.hidden) { pop.hidden = true; break; }
      pop.innerHTML = `<div style="padding:8px"><b>${esc(S.me.full_name || '')}</b><div class="small muted">${esc(S.me.email || '')}</div></div>
        ${!isStaff() && S.projects.length > 1 ? S.projects.map(p => `<button class="pop-item" style="width:100%;border-left:0;border-right:0;border-bottom:0;background:none;cursor:pointer;text-align:left" data-act="home-open" data-id="${p.id}">${esc(p.name)}</button>`).join('') : ''}
        <button class="pop-item" style="width:100%;border-left:0;border-right:0;border-bottom:0;background:none;cursor:pointer;text-align:left" data-act="me-edit">Your details</button>
        <button class="pop-item" style="width:100%;border-left:0;border-right:0;border-bottom:0;background:none;cursor:pointer;text-align:left" data-act="signout">Sign out</button>`;
      pop.hidden = false; break; }
    case 'me-edit':
      modal(`<span class="eyebrow">Your details</span><h2>${esc(S.me.full_name || 'Your details')}</h2>
        <div class="field"><label for="me-name">Full name</label><input id="me-name" value="${esc(S.me.full_name || '')}"></div>
        <div class="field"><label for="me-phone">Phone</label><input id="me-phone" type="tel" value="${esc(S.me.phone || '')}"></div>
        ${isStaff() ? `<div class="field"><label for="me-title">Title</label><input id="me-title" value="${esc(S.me.title || '')}"></div>` : ''}
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary" data-act="me-save">Save</button></div>`); break;
    case 'me-save': {
      const upd = { full_name: val('me-name') || null, phone: val('me-phone') || null }; if (isStaff()) upd.title = val('me-title') || null;
      must(await sb.from('profiles').update(upd).eq('id', S.me.id)); Object.assign(S.me, upd); closeModal();
      if (S.pid && S.view !== 'homes') await refresh(['project_members']); else render(); toast('Saved'); break; }
    case 'bell': {
      const pop = $('#pop'); if (!pop.hidden) { pop.hidden = true; break; }
      const items = S.d.activity.filter(x => x.actor_id !== S.me.id).slice(0, 10), fresh = new Set(unseen().map(x => x.id));
      pop.innerHTML = `<div class="spread" style="padding:6px 8px 10px"><span class="eyebrow">Recent activity</span></div>` +
        (items.length ? items.map(n => `<a href="#${esc(n.view || 'overview')}" class="pop-item"><span class="pip" style="${fresh.has(n.id) ? '' : 'opacity:.25'}"></span><span><span>${esc(nameOf(n.actor_id))} ${esc(n.body)}</span><br><span class="when">${ft(n.created_at)}</span></span></a>`).join('') : '<div class="pop-item muted">Nothing yet.</div>');
      pop.hidden = false;
      const now = new Date().toISOString(); S.lastSeen = now;
      if (isStaff()) store.set('portal.seen.' + S.pid, now); else await sb.from('project_members').update({ last_seen_at: now }).eq('project_id', S.pid).eq('user_id', S.me.id);
      $('#bell .dot')?.remove(); break; }
    case 'copy': navigator.clipboard?.writeText(el.dataset.v).then(() => toast('Copied ' + el.dataset.v)).catch(() => toast(el.dataset.v)); break;

    /* homes */
    case 'home-open': S.pid = id; store.set('portal.pid', id); S.ui.thread = null; $('#app').querySelector('main').innerHTML = '<div class="boot">Loading</div>'; await loadProject(id); S.view = 'overview'; location.hash = '#overview'; render(); break;
    case 'home-new': modal(homeForm(), true); break;
    case 'home-create': {
      const v = homeVals(); if (!v.name) { toast('Give the home a name'); $('#h-name').focus(); break; }
      const proj = must(await sb.from('projects').insert({ ...v, builder_id: S.me.builder_id, pm_id: S.me.id }).select().single());
      let d = v.start_date || isoToday();
      const phases = B.phases.map((ph, i) => { const s = d, e = addDays(d, ph.days || 30); d = addDays(e, 1);
        return { project_id: proj.id, position: i, name: ph.name, start_date: v.start_date ? s : null, end_date: v.start_date ? e : null, status: i === 0 ? 'current' : 'upcoming', what: ph.what, look: ph.look, decisions: ph.decisions }; });
      must(await sb.from('phases').insert(phases));
      must(await sb.from('draws').insert(B.draws.map((x, i) => ({ project_id: proj.id, position: i, name: x.name, percent: x.percent, status: i === 0 ? 'next' : 'scheduled' }))));
      must(await sb.from('threads').insert(B.threads.map((n, i) => ({ project_id: proj.id, name: n, position: i }))));
      await sb.from('activity').insert({ project_id: proj.id, body: 'created this home', view: 'overview' });
      closeModal(); await loadProjects(); S.pid = proj.id; store.set('portal.pid', proj.id); S.ui.thread = null; await loadProject(proj.id); S.view = 'team'; location.hash = '#team'; render();
      toast(`${proj.name} created. Invite the ${L.client.toLowerCase()}s next.`); break; }
    case 'home-edit': modal(homeForm(P()), true); break;
    case 'home-save': {
      const v = homeVals(); if (!v.name) { toast('Name is required'); break; }
      must(await sb.from('projects').update(v).eq('id', S.pid)); closeModal(); await refresh(['project']); await loadProjects(); toast('Saved'); break; }

    /* phases */
    case 'ph-toggle': S.ui.openPhase = S.ui.openPhase === id ? null : id; render(true); break;
    case 'ph-complete': {
      const i = S.d.phases.findIndex(p => p.id === id), next = S.d.phases[i + 1];
      must(await sb.from('phases').update({ status: 'done' }).eq('id', id));
      if (next) { must(await sb.from('phases').update({ status: 'current' }).eq('id', next.id)); S.ui.openPhase = next.id; }
      await log(`completed ${short(S.d.phases[i].name)}`, 'timeline'); await refresh(['phases','activity']); toast('Phase complete'); break; }
    case 'ph-start': {
      const i = S.d.phases.findIndex(p => p.id === id);
      for (const [j, p] of S.d.phases.entries()) { const st = j < i ? 'done' : j === i ? 'current' : 'upcoming'; if (p.status !== st) must(await sb.from('phases').update({ status: st }).eq('id', p.id)); }
      await log(`started ${short(S.d.phases[i].name)}`, 'timeline'); await refresh(['phases','activity']); break; }
    case 'ph-edit': {
      const p = S.d.phases.find(x => x.id === id);
      modal(`<span class="eyebrow">Phase</span><h2>${esc(p.name)}</h2>
        <div class="form-grid"><div class="field full"><label for="pe-name">Name</label><input id="pe-name" value="${esc(p.name)}"></div>
        <div class="field"><label for="pe-start">Start</label><input type="date" id="pe-start" value="${p.start_date || ''}"></div><div class="field"><label for="pe-end">End</label><input type="date" id="pe-end" value="${p.end_date || ''}"></div>
        <div class="field full"><label for="pe-what">What happens</label><textarea id="pe-what">${esc(p.what || '')}</textarea></div>
        <div class="field full"><label for="pe-look">When you visit</label><textarea id="pe-look">${esc(p.look || '')}</textarea></div>
        <div class="field full"><label for="pe-dec">Your decisions</label><textarea id="pe-dec">${esc(p.decisions || '')}</textarea></div></div>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary" data-act="ph-save" data-id="${id}">Save</button></div>`, true); break; }
    case 'ph-save':
      must(await sb.from('phases').update({ name: val('pe-name'), start_date: val('pe-start') || null, end_date: val('pe-end') || null, what: val('pe-what'), look: val('pe-look'), decisions: val('pe-dec') }).eq('id', id));
      closeModal(); await refresh(['phases']); toast('Saved'); break;

    /* updates */
    case 'post-open': S.draft = []; S.postText = ''; modal(postSheet()); break;
    case 'draft-del': S.postText = val('post-text'); S.draft.splice(+el.dataset.i, 1); modal(postSheet()); break;
    case 'post-send': {
      const body = val('post-text'), phase = val('post-phase');
      if (!body && !S.draft.length) { const e = $('#post-err'); e.textContent = 'Add a photo or a few words.'; e.hidden = false; break; }
      el.textContent = S.draft.length ? 'Uploading' : 'Posting';
      const up = must(await sb.from('updates').insert({ project_id: S.pid, phase_id: phase || null, author_id: S.me.id, body: body || null }).select().single());
      const rows = [];
      for (const [i, d] of S.draft.entries()) { const path = `${S.pid}/photos/${crypto.randomUUID()}.jpg`; await upload(path, d.blob, 'image/jpeg'); rows.push({ update_id: up.id, project_id: S.pid, path, position: i }); }
      if (rows.length) must(await sb.from('update_photos').insert(rows));
      await log(rows.length ? `shared ${rows.length} new photo${rows.length > 1 ? 's' : ''}` : 'posted an update', 'updates');
      closeModal(); S.view = 'updates'; location.hash = '#updates'; await refresh(['updates','update_photos','activity']); toast('Posted'); break; }
    case 'up-del':
      if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Tap again to delete'; setTimeout(() => { if (el.isConnected) { el.dataset.confirm = ''; el.textContent = 'Delete'; } }, 3000); break; }
      { const paths = photosOf(id).map(p => p.path); if (paths.length) await sb.storage.from(BUCKET).remove(paths); must(await sb.from('updates').delete().eq('id', id)); await refresh(['updates','update_photos','update_comments','update_thanks']); toast('Deleted'); } break;
    case 'ph-open': {
      const p = S.d.update_photos.find(x => x.id === id); const u = S.d.updates.find(x => x.id === p.update_id);
      modal(`<div class="spread"><div><span class="eyebrow">${ft(u?.created_at)}</span>${p.caption ? `<h3 style="margin-top:6px">${esc(p.caption)}</h3>` : ''}</div><div class="row"><a class="btn sm ghost" href="${esc(S.urls[p.path])}" target="_blank" rel="noopener">Full size</a><button class="btn sm ghost" data-act="modal-close">Close</button></div></div>
        <img src="${esc(S.urls[p.path])}" alt="${esc(p.caption)}" style="width:100%;max-height:75vh;object-fit:contain;background:var(--surface-2)">`, true); break; }
    case 'thanks': {
      const mine = S.d.update_thanks.some(t => t.update_id === id && t.user_id === S.me.id);
      if (mine) must(await sb.from('update_thanks').delete().eq('update_id', id).eq('user_id', S.me.id));
      else { must(await sb.from('update_thanks').insert({ update_id: id, project_id: S.pid })); await log('thanked the team for an update', 'updates'); }
      await refresh(['update_thanks','activity']); break; }
    case 'c-send': {
      const body = val('c-' + id); if (!body) break;
      must(await sb.from('update_comments').insert({ update_id: id, project_id: S.pid, body })); await log('commented on an update', 'updates');
      await refresh(['update_comments','activity']); break; }

    /* questions */
    case 'q-quick': $('#qa-' + id).value = el.dataset.v; break;
    case 'q-send': {
      const v = val('qa-' + id); if (!v) { toast('Choose an answer or write your own'); break; }
      must(await sb.rpc('answer_question', { qid: id, answer_text: v })); await refresh(['questions','activity']); toast('Thank you. Your answer has been sent.'); break; }
    case 'q-new': {
      const q = val('nq-text'); if (!q) { toast('Write the question first'); $('#nq-text').focus(); break; }
      must(await sb.from('questions').insert({ project_id: S.pid, phase_id: curPhase()?.id || null, asked_by: S.me.id, question: q, why: val('nq-why') || null,
        options: val('nq-opts').split(',').map(s => s.trim()).filter(Boolean), due_date: val('nq-due') || null }));
      await log('asked for a decision', 'questions'); await refresh(['questions','activity']); toast(`Sent to ${clientFirst()}`); break; }
    case 'q-del': must(await sb.from('questions').delete().eq('id', id)); await refresh(['questions']); break;

    /* messages */
    case 'thread': S.ui.thread = id; render(true); break;
    case 'msg-send': await sendMsg(); break;

    /* selections */
    case 'sel-toggle': S.ui.openSel = S.ui.openSel === id ? null : id; render(true); break;
    case 'sel-pick': S.ui.pick = { ...(S.ui.pick || {}), [id]: el.dataset.o }; render(true); break;
    case 'sel-submit': {
      const s = S.d.selections.find(x => x.id === id), o = S.ui.pick?.[id]; if (!o) break;
      must(await sb.rpc('choose_selection', { sid: id, oid: o })); delete S.ui.pick[id];
      await refresh(['selections','activity']); toast(`Submitted to the ${L.designCenter}`); break; }
    case 'sel-confirm': must(await sb.from('selections').update({ status: 'approved' }).eq('id', id)); await log('confirmed and ordered a selection', 'selections'); await refresh(['selections','activity']); toast('Confirmed'); break;
    case 'sel-reopen': must(await sb.from('selections').update({ status: 'open', chosen_option_id: null }).eq('id', id)); await refresh(['selections']); break;
    case 'sel-open': must(await sb.from('selections').update({ status: 'open' }).eq('id', id)); await log('opened a selection for choosing', 'selections'); await refresh(['selections','activity']); break;
    case 'sel-new': case 'sel-edit': {
      const s = a === 'sel-edit' ? S.d.selections.find(x => x.id === id) : {};
      modal(`<span class="eyebrow">${esc(L.designCenter)}</span><h2>${s.id ? esc(s.category) : 'Add a selection'}</h2>
        <div class="form-grid"><div class="field full"><label for="se-cat">Category</label><input id="se-cat" value="${esc(s.category || '')}" placeholder="Plumbing fixtures"></div>
        <div class="field full"><label for="se-area">Where</label><input id="se-area" value="${esc(s.area || '')}" placeholder="All baths, kitchen, and bar"></div>
        <div class="field"><label for="se-due">Due</label><input type="date" id="se-due" value="${s.due_date || ''}"></div><div class="field"><label for="se-allow">Allowance ($, 0 if included)</label><input type="number" id="se-allow" value="${s.allowance ? +s.allowance : ''}"></div>
        <div class="field full"><label for="se-note">Note to the ${esc(L.client.toLowerCase())}</label><input id="se-note" value="${esc(s.note || '')}"></div>
        ${s.id ? '' : `<div class="field"><label for="se-status">Status</label><select id="se-status"><option value="open">Open for choosing</option><option value="later">Opens later</option></select></div>`}</div>
        <div class="row" style="justify-content:flex-end">${s.id ? `<button class="edit-link" data-act="sel-del" data-id="${s.id}" style="margin-right:auto">Delete</button>` : ''}<button class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary" data-act="sel-save" data-id="${s.id || ''}">Save</button></div>`, true); break; }
    case 'sel-save': {
      const v = { category: val('se-cat'), area: val('se-area') || null, due_date: val('se-due') || null, allowance: +val('se-allow') || 0, note: val('se-note') || null };
      if (!v.category) { toast('Category is required'); break; }
      if (id) must(await sb.from('selections').update(v).eq('id', id));
      else { const r = must(await sb.from('selections').insert({ ...v, project_id: S.pid, status: val('se-status') || 'open' }).select().single()); S.ui.openSel = r.id; }
      closeModal(); await refresh(['selections']); toast('Saved'); break; }
    case 'sel-del': must(await sb.from('selections').delete().eq('id', id)); closeModal(); await refresh(['selections','selection_options']); break;
    case 'opt-new':
      modal(`<span class="eyebrow">Add an option</span><h2>${esc(S.d.selections.find(x => x.id === id).category)}</h2>
        <div class="form-grid"><div class="field full"><label for="op-name">Name</label><input id="op-name" placeholder="Unlacquered brass"></div>
        <div class="field full"><label for="op-detail">Detail</label><input id="op-detail" placeholder="Develops a living patina over time"></div>
        <div class="field"><label for="op-price">Price ($)</label><input type="number" id="op-price"></div><div class="field"><label for="op-sw">Swatch colors (optional)</label><input id="op-sw" placeholder="#B48A4E, #8E6A36"></div>
        <div class="field full"><span>Photo (optional)</span><label class="drop" for="op-img" style="position:relative" id="op-img-l">Choose a photo<input type="file" id="op-img" accept="image/*"></label></div></div>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary" data-act="opt-save" data-id="${id}">Add option</button></div>`, true); break;
    case 'opt-save': {
      const name = val('op-name'); if (!name) { toast('Name is required'); break; }
      let image_path = null; const f = $('#op-img').files[0];
      if (f) { image_path = `${S.pid}/options/${crypto.randomUUID()}.jpg`; await upload(image_path, await compress(f, 1400), 'image/jpeg'); }
      must(await sb.from('selection_options').insert({ selection_id: id, project_id: S.pid, name, detail: val('op-detail') || null, price: +val('op-price') || 0,
        swatches: val('op-sw').split(',').map(s => s.trim()).filter(s => /^#[0-9a-f]{3,8}$/i.test(s)), image_path, position: optionsOf(id).length }));
      closeModal(); await refresh(['selection_options']); toast('Option added'); break; }

    /* change orders */
    case 'co-new': {
      const title = val('co-title'), amount = parseFloat(val('co-amount'));
      if (!title || isNaN(amount)) { toast('Add the change and its price'); break; }
      const number = (S.d.change_orders.reduce((m, c) => Math.max(m, c.number), 0)) + 1;
      must(await sb.from('change_orders').insert({ project_id: S.pid, number, title, details: val('co-details') || null, amount, days: parseInt(val('co-days')) || 0, created_by: S.me.id }));
      await log(`sent change order CO-${String(number).padStart(2,'0')} for signature`, 'changes'); await refresh(['change_orders','activity']); toast('Sent for signature'); break; }
    case 'co-del': must(await sb.from('change_orders').delete().eq('id', id)); await refresh(['change_orders']); break;
    case 'co-approve': {
      const c = S.d.change_orders.find(x => x.id === id);
      modal(`<span class="eyebrow">CO-${String(c.number).padStart(2,'0')} · Change order</span><h2>${esc(c.title)}</h2>${c.details ? `<p class="muted">${esc(c.details)}</p>` : ''}
        <div class="ledger"><div><span>Price change</span><span>${signed(c.amount)}</span></div><div><span>Schedule</span><span>${c.days ? `${c.days} days added` : 'No change'}</span></div></div>
        <div class="field"><label for="sig">Initial to sign</label><input id="sig" maxlength="4" autocomplete="off" style="font-family:var(--f-display);font-style:italic;font-size:26px;max-width:160px;text-transform:uppercase"></div>
        <p class="small muted">By initialing, you approve this change to your agreement.</p>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary" data-act="co-sign" data-id="${c.id}">Sign & approve</button></div>`); break; }
    case 'co-sign': {
      const v = val('sig'); if (!v) { toast('Add your initials to sign'); $('#sig').focus(); break; }
      must(await sb.rpc('sign_change_order', { cid: id, initials: v })); closeModal(); await refresh(['change_orders','activity']); toast('Signed. Thank you.'); break; }
    case 'co-decline':
      modal(`<h2>Decline this change?</h2><div class="field"><label for="dec-note">Note to your team</label><textarea id="dec-note"></textarea></div>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary" data-act="co-decline-yes" data-id="${id}">Decline</button></div>`); break;
    case 'co-decline-yes': must(await sb.rpc('decline_change_order', { cid: id, note: val('dec-note') })); closeModal(); await refresh(['change_orders','activity']); toast('Declined. Your team has been notified.'); break;

    /* calendar */
    case 'request':
      modal(`<span class="eyebrow">${esc(el.dataset.k)}</span><h2>When would suit you?</h2>
        <div class="row" style="align-items:flex-end"><div class="field" style="flex:1 1 180px"><label for="rq-date">Preferred date</label><input type="date" id="rq-date" value="${addDays(isoToday(), 4)}"></div>
          <div class="field" style="flex:1 1 160px"><label for="rq-time">Time of day</label><select id="rq-time"><option>Morning</option><option selected>Afternoon</option><option>Evening</option></select></div></div>
        <div class="field"><label for="rq-note">Anything we should prepare</label><textarea id="rq-note"></textarea></div>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary" data-act="request-send" data-k="${esc(el.dataset.k)}">Send request</button></div>`); break;
    case 'request-send':
      must(await sb.rpc('request_visit', { pid: S.pid, kind: el.dataset.k, on_date: val('rq-date') || isoToday(), time_label: val('rq-time'), note: val('rq-note') }));
      closeModal(); await refresh(['events','activity']); toast('Request sent. Your team will confirm shortly.'); break;
    case 'ev-confirm': {
      const e = S.d.events.find(x => x.id === id);
      must(await sb.from('events').update({ status: 'scheduled', title: e.title.replace(' (requested)', '') }).eq('id', id));
      await log(`confirmed: ${e.title.replace(' (requested)', '')} on ${fd(e.starts_on)}`, 'calendar'); await refresh(['events','activity']); toast('Confirmed'); break; }
    case 'ev-new': case 'ev-edit': {
      const e = a === 'ev-edit' ? S.d.events.find(x => x.id === id) : {};
      modal(`<span class="eyebrow">Calendar</span><h2>${e.id ? esc(e.title) : 'Add a date'}</h2>
        <div class="form-grid"><div class="field full"><label for="ev-title">Title</label><input id="ev-title" value="${esc(e.title || '')}" placeholder="Pre-insulation walkthrough"></div>
        <div class="field"><label for="ev-date">Date</label><input type="date" id="ev-date" value="${e.starts_on || ''}"></div><div class="field"><label for="ev-time">Time</label><input id="ev-time" value="${esc(e.time_label || '')}" placeholder="9:00 AM"></div>
        <div class="field"><label for="ev-kind">Type</label><select id="ev-kind">${['Private visit','Inspection','Decision','Design appointment','Milestone'].map(k => `<option ${e.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
        <div class="field"><label for="ev-loc">Where</label><input id="ev-loc" value="${esc(e.location || '')}"></div>
        <div class="field full"><label for="ev-note">Note</label><input id="ev-note" value="${esc(e.note || '')}"></div>
        <label class="row small full" style="gap:8px"><input type="checkbox" id="ev-key" ${e.is_key ? 'checked' : ''}> Highlight as a date not to miss</label></div>
        <div class="row" style="justify-content:flex-end">${e.id ? `<button class="edit-link" data-act="ev-del" data-id="${e.id}" style="margin-right:auto">Delete</button>` : ''}<button class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary" data-act="ev-save" data-id="${e.id || ''}">Save</button></div>`, true); break; }
    case 'ev-save': {
      const v = { title: val('ev-title'), starts_on: val('ev-date'), time_label: val('ev-time') || null, kind: val('ev-kind'), location: val('ev-loc') || null, note: val('ev-note') || null, is_key: $('#ev-key').checked };
      if (!v.title || !v.starts_on) { toast('Title and date are required'); break; }
      if (id) must(await sb.from('events').update(v).eq('id', id)); else { must(await sb.from('events').insert({ ...v, project_id: S.pid })); await log(`added ${v.title} on ${fd(v.starts_on)}`, 'calendar'); }
      closeModal(); await refresh(['events','activity']); toast('Saved'); break; }
    case 'ev-del': must(await sb.from('events').delete().eq('id', id)); closeModal(); await refresh(['events']); break;

    /* documents */
    case 'doc-folder': S.ui.docFolder = el.dataset.f; render(true); break;
    case 'doc-open': {
      const d = S.d.documents.find(x => x.id === id);
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(d.path, 600, { download: d.name });
      if (error) throw error;
      modal(`<span class="eyebrow">${esc(d.folder)}</span><h2>${esc(d.name)}</h2><div class="row"><a class="btn primary" href="${esc(data.signedUrl)}" target="_blank" rel="noopener">Download</a><button class="btn ghost" data-act="modal-close">Close</button></div>`); break; }
    case 'doc-del': {
      const d = S.d.documents.find(x => x.id === id);
      if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Confirm'; break; }
      await sb.storage.from(BUCKET).remove([d.path]); must(await sb.from('documents').delete().eq('id', id)); await refresh(['documents']); break; }

    /* notes */
    case 'note-add': {
      const body = val('note-text'); if (!body) { toast('Write a note first'); $('#note-text').focus(); break; }
      must(await sb.from('notes').insert({ project_id: S.pid, room: val('note-room') || null, body }));
      await log('added a note', 'walkthrough'); await refresh(['notes','activity']); toast('Noted'); break; }
    case 'note-del': must(await sb.from('notes').delete().eq('id', id)); await refresh(['notes']); break;
    case 'note-ack': must(await sb.from('notes').update({ reviewed: true, reviewed_by: S.me.id }).eq('id', id)); await refresh(['notes']); break;

    /* team */
    case 'set-pm': must(await sb.from('projects').update({ pm_id: id }).eq('id', S.pid)); await refresh(['project']); toast('Updated'); break;
    case 'invite': {
      const staff = el.dataset.role === 'staff', pre = staff ? 'is' : 'iv';
      const body = { email: val(pre + '-email'), full_name: val(pre + '-name'), role: staff ? 'staff' : 'client', project_id: staff ? undefined : S.pid,
        title: staff ? val('is-title') : undefined, phone: staff ? val('is-phone') : undefined, redirect_to: location.origin + location.pathname + location.search };
      if (!body.email) { toast('Enter an email address'); break; }
      el.textContent = 'Sending';
      const { data, error } = await sb.functions.invoke('invite', { body });
      if (error) { let msg = error.message; try { msg = (await error.context.json()).error || msg; } catch {} throw new Error(msg); }
      if (!staff) await log(`invited ${body.full_name || body.email}`, 'team');
      await refresh(['project_members','activity']);
      toast(data.invited ? `Invitation sent to ${body.email}` : `${body.full_name || body.email} now has access`); break; }
  }
}
async function sendMsg() {
  const body = val('msg-in'); if (!body) return;
  const th = S.ui.thread || S.d.threads[0]?.id;
  must(await sb.from('messages').insert({ thread_id: th, project_id: S.pid, body }));
  await refresh(['messages']); $('#msg-in')?.focus();
}

/* ================= events ================= */
document.addEventListener('click', async e => {
  if (e.target.closest('.sheet-list a')) closeModal();
  const el = e.target.closest('[data-act]');
  [['#pop','#bell'], ['#acct-pop','.acct-btn'], ['#more-pop','.more-btn']].forEach(([s, t]) => { const p = $(s); if (p && !p.hidden && !e.target.closest(s) && !e.target.closest(t)) p.hidden = true; });
  if (!el || el.disabled || el.dataset.busy) return;
  if (el.tagName === 'A') return;
  el.dataset.busy = '1'; if (el.tagName === 'BUTTON') el.disabled = true;
  const label = el.textContent;
  try { await act(el.dataset.act, el); }
  catch (err) { console.error(err); toast(err.message || 'Something went wrong. Please try again.'); if (el.isConnected) el.textContent = label; }
  finally { if (el.isConnected) { delete el.dataset.busy; el.disabled = false; } }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'msg-in') { e.preventDefault(); sendMsg().catch(err => toast(err.message)); }
  if (e.key === 'Enter' && !e.shiftKey && e.target.id?.startsWith('c-')) { e.preventDefault(); act('c-send', { dataset: { id: e.target.id.slice(2) } }).catch(err => toast(err.message)); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'doc-q') { S.ui.docQ = e.target.value; $('#doc-rows').innerHTML = docRows(); }
});
document.addEventListener('change', async e => {
  const t = e.target;
  try {
    if (t.id === 'post-files') {
      S.postText = val('post-text');
      for (const f of [...t.files].slice(0, 20)) { const blob = await compress(f); S.draft.push({ blob, preview: URL.createObjectURL(blob) }); }
      modal(postSheet());
    }
    if (t.id === 'op-img' && t.files[0]) $('#op-img-l').firstChild.textContent = t.files[0].name;
    if (t.id === 'cover-up' && t.files[0]) {
      toast('Uploading rendering');
      const path = `${S.pid}/cover/${crypto.randomUUID()}.jpg`;
      await upload(path, await compress(t.files[0], 2400, 0.86), 'image/jpeg');
      must(await sb.from('projects').update({ cover_path: path }).eq('id', S.pid));
      await refresh(['project']); toast('Rendering updated');
    }
    if (t.id === 'doc-up') {
      const folder = val('doc-folder') || 'General', files = [...t.files]; toast(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}`);
      for (const f of files) {
        const path = `${S.pid}/docs/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
        await upload(path, f, f.type);
        must(await sb.from('documents').insert({ project_id: S.pid, folder, name: f.name, path, size_bytes: f.size, uploaded_by: S.me.id }));
      }
      await log(`added ${files.length} document${files.length > 1 ? 's' : ''} to ${folder}`, 'documents');
      S.ui.docFolder = 'All'; await refresh(['documents','activity']); toast('Uploaded');
    }
    if (t.dataset.change === 'draw-status') {
      const upd = { status: t.value }; if (t.value === 'paid') upd.paid_date = isoToday();
      must(await sb.from('draws').update(upd).eq('id', t.dataset.id)); await refresh(['draws']); toast('Updated');
    }
  } catch (err) { console.error(err); toast(err.message || 'Upload failed. Please try again.'); }
});
window.addEventListener('hashchange', async () => {
  const h = location.hash.slice(1);
  if (h.includes('access_token') || !S.me) return;
  if (h === 'homes' && isStaff()) { S.view = 'homes'; await loadProjects(); render(); window.scrollTo(0, 0); return; }
  if (!VIEWS[h] && h !== 'decisions') return;
  if (!S.d && S.pid) await loadProject(S.pid);
  if (!S.d) return;
  closeModal(); S.view = resolveView(h); render(); window.scrollTo(0, 0);
  if (h === 'messages') refresh(['messages']);
});

/* ================= go ================= */
applyBrand();
if (CFG.supabaseUrl.startsWith('SUPABASE')) {
  $('#app').innerHTML = `<div class="wrap auth"><div class="auth-card">${wordmark()}<p class="lead">Add your Supabase URL and key to config.js to finish setup.</p></div></div>`;
} else {
  start().catch(err => { console.error(err); $('#app').innerHTML = `<div class="wrap auth"><div class="auth-card">${wordmark()}<p class="inline-err">${esc(err.message || 'Could not load the portal.')}</p><button class="btn" data-act="signout">Sign out</button></div></div>`; });
}
})();
