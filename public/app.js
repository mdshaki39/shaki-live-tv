// ============================================================
// WC26 TRACKER — frontend logic
// All match times from the API are UTC; we convert everything
// to Bangladesh Standard Time (UTC+6) for display.
// ============================================================

const BD_OFFSET_MIN = 6 * 60;

const BN_MONTHS = ['জানু','ফেব্রু','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্ট','অক্টো','নভে','ডিসে'];
const BN_DIGITS = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
function bnNum(n){ return String(n).split('').map(d => /\d/.test(d) ? BN_DIGITS[+d] : d).join(''); }

// Returns a Date whose UTC-getter values (getUTCHours, getUTCDate, ...) read
// as Bangladesh local time, regardless of the viewer's own browser timezone.
function toBD(utcDateStr){
  const d = new Date(utcDateStr);
  return new Date(d.getTime() + BD_OFFSET_MIN * 60000);
}

function fmtBDDateTime(utcDateStr){
  const bd = toBD(utcDateStr);
  const day = bd.getUTCDate();
  const month = BN_MONTHS[bd.getUTCMonth()];
  let h = bd.getUTCHours();
  const m = bd.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${bnNum(day)} ${month}, ${bnNum(h)}:${bnNum(String(m).padStart(2,'0'))} ${ampm}`;
}

function fmtBDDateShort(utcDateStr){
  const bd = toBD(utcDateStr);
  let h = bd.getUTCHours();
  const m = bd.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return { date: `${bnNum(bd.getUTCDate())} ${BN_MONTHS[bd.getUTCMonth()]}`, time: `${bnNum(h)}:${bnNum(String(m).padStart(2,'0'))} ${ampm}` };
}

function isSameBDDay(utcDateStr, refDate){
  const a = toBD(utcDateStr);
  const b = toBD(refDate.toISOString());
  return a.getUTCFullYear()===b.getUTCFullYear() && a.getUTCMonth()===b.getUTCMonth() && a.getUTCDate()===b.getUTCDate();
}

// ---------- Live BD clock in header ----------
function tickClock(){
  const el = document.getElementById('bdClockTime');
  const now = new Date();
  const bd = toBD(now.toISOString());
  let h = bd.getUTCHours(), m = bd.getUTCMinutes(), s = bd.getUTCSeconds();
  el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
setInterval(tickClock, 1000); tickClock();

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
  });
});

// ---------- State ----------
let ALL_MATCHES = [];
let STANDINGS = [];
let CHANNELS = { defaultLinks: [{ label:'কোথায় দেখা যাবে দেখুন', type:'link', url:'https://www.livesoccertv.com/' }], rules: [] };
let dataLive = false;
let CURRENT_COMP = 'WC';
let COMPETITIONS = [];

function teamName(t){ return t && t.name ? t.name : '—'; }

function statusBadge(status){
  if (status === 'IN_PLAY' || status === 'PAUSED' || status === 'LIVE') return '<span class="badge live">লাইভ</span>';
  if (status === 'FINISHED') return '<span class="badge finished">সমাপ্ত</span>';
  return '<span class="badge scheduled">নির্ধারিত</span>';
}

function scoreLabel(m){
  const ft = m.score && m.score.fullTime;
  if (ft && (ft.home !== null && ft.home !== undefined) && (ft.away !== null && ft.away !== undefined)){
    return `${ft.home} - ${ft.away}`;
  }
  return 'VS';
}

// Normalizes either the old single {label,type,url} shape or the new
// {links:[...]} shape into a plain array of {label,type,url}.
function linksOf(obj){
  if (!obj) return [];
  if (Array.isArray(obj.links)) return obj.links;
  if (obj.url) return [{ label: obj.label, type: obj.type, url: obj.url }];
  return [];
}

function resolveWatchLinks(match){
  const home = teamName(match.homeTeam), away = teamName(match.awayTeam);
  const compCode = (match.competition && match.competition.code) || CURRENT_COMP;
  for (const rule of (CHANNELS.rules || [])){
    const m = rule.match || {};
    if (m.competition && m.competition === compCode) return linksOf(rule);
    if (m.teamContains && m.teamContains.length){
      const hit = m.teamContains.some(t => home.toLowerCase().includes(t.toLowerCase()) || away.toLowerCase().includes(t.toLowerCase()));
      if (hit) return linksOf(rule);
    }
    if (m.stage && match.stage === m.stage) return linksOf(rule);
  }
  return CHANNELS.defaultLinks || linksOf(CHANNELS.defaultLink) || [];
}

function renderWatchBtn(match, big){
  const links = resolveWatchLinks(match);
  if (!links.length) return '';
  if (!big){
    // Compact card view: just the first (primary) source to save space.
    const link = links[0];
    const cls = link.type === 'link' ? 'is-link' : '';
    return `<a class="mini-watch ${cls}" href="${link.url}" target="_blank" rel="noopener">${link.label || 'দেখুন'}</a>`;
  }
  // Hero view: show every legitimate source as its own button so visitors
  // have a fallback if one broadcaster's site happens to be down.
  const buttons = links.map((link, i) => {
    const cls = link.type === 'link' ? 'is-link' : '';
    const sizeCls = i === 0 ? 'watch-btn' : 'watch-btn watch-btn-alt';
    return `<a class="${sizeCls} ${cls}" href="${link.url}" target="_blank" rel="noopener">${link.label || 'লাইভ দেখুন'}</a>`;
  }).join('');
  return `<div class="watch-links">${buttons}</div>`;
}

// ---------- Fetch helpers ----------
async function fetchJSON(url){
  const res = await fetch(url);
  return res.json();
}

function showBanner(text){
  const b = document.getElementById('statusBanner');
  b.textContent = text;
  b.hidden = false;
}

async function loadChannels(){
  try { CHANNELS = await fetchJSON('/api/channels'); } catch(e){ /* keep default */ }
}

async function loadCompetitions(){
  try {
    const res = await fetchJSON('/api/competitions');
    COMPETITIONS = res.competitions || [];
    renderCompSelector();
  } catch(e){ /* keep empty, selector just won't show */ }
}

function renderCompSelector(){
  const el = document.getElementById('compSelector');
  if (!COMPETITIONS.length){ el.innerHTML = ''; return; }
  el.innerHTML = COMPETITIONS.map(c =>
    `<button class="comp-pill ${c.code===CURRENT_COMP?'active':''}" data-comp="${c.code}" title="${c.nameEn}">${c.name}</button>`
  ).join('');
  el.querySelectorAll('.comp-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.comp === CURRENT_COMP) return;
      CURRENT_COMP = btn.dataset.comp;
      activeGroup = null;
      renderCompSelector();
      loadAll();
    });
  });
}

async function loadMatches(){
  const res = await fetchJSON(`/api/matches?comp=${CURRENT_COMP}`);
  dataLive = !!res.live;
  ALL_MATCHES = (res.data && res.data.matches) || [];
  if (res.source === 'fallback' || res.stale){
    const compName = (COMPETITIONS.find(c => c.code === CURRENT_COMP) || {}).name || CURRENT_COMP;
    showBanner(`⚠ ${compName} এর জন্য লাইভ API সংযোগ নেই — ডেমো/পুরনো ডেটা দেখানো হচ্ছে। README.md অনুসরণ করে ফ্রি API key যোগ করুন।`);
  } else {
    document.getElementById('statusBanner').hidden = true;
  }
  ALL_MATCHES.sort((a,b) => new Date(a.utcDate) - new Date(b.utcDate));
  return ALL_MATCHES;
}

async function loadStandings(){
  const res = await fetchJSON(`/api/standings?comp=${CURRENT_COMP}`);
  STANDINGS = (res.data && res.data.standings) || [];
  return STANDINGS;
}

// ---------- Hero countdown ----------
let countdownTimer = null;
function setupHero(){
  const now = new Date();
  const upcoming = ALL_MATCHES.filter(m => ['SCHEDULED','TIMED'].includes(m.status) && new Date(m.utcDate) > now);
  const live = ALL_MATCHES.find(m => ['IN_PLAY','PAUSED','LIVE'].includes(m.status));
  const target = live || upcoming[0];

  if (!target){
    document.getElementById('heroEyebrow').textContent = 'কোনো আসন্ন ম্যাচ পাওয়া যায়নি';
    document.getElementById('heroMeta').textContent = '';
    return;
  }

  document.querySelector('#heroTeamHome .hero-team-name').textContent = teamName(target.homeTeam);
  document.querySelector('#heroTeamAway .hero-team-name').textContent = teamName(target.awayTeam);
  document.getElementById('heroVenue').textContent = target.venue || '';
  document.getElementById('heroWatchLinks').innerHTML = renderWatchBtn(target, true);

  if (live){
    document.getElementById('heroEyebrow').textContent = '🔴 এখন চলছে';
    document.getElementById('flipClock').style.visibility = 'hidden';
    document.getElementById('heroMeta').textContent = scoreLabel(target);
    return;
  }

  document.getElementById('heroEyebrow').textContent = 'পরবর্তী ম্যাচ শুরু হতে বাকি';
  document.getElementById('flipClock').style.visibility = 'visible';
  document.getElementById('heroMeta').textContent = `কিকঅফ (BD সময়): ${fmtBDDateTime(target.utcDate)}`;

  if (countdownTimer) clearInterval(countdownTimer);
  function tick(){
    const diff = new Date(target.utcDate) - new Date();
    if (diff <= 0){ clearInterval(countdownTimer); loadAll(); return; }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    document.getElementById('fDays').textContent = String(days).padStart(2,'0');
    document.getElementById('fHours').textContent = String(hours).padStart(2,'0');
    document.getElementById('fMins').textContent = String(mins).padStart(2,'0');
    document.getElementById('fSecs').textContent = String(secs).padStart(2,'0');
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}

// ---------- Live ticker ----------
function setupTicker(){
  const relevant = ALL_MATCHES.filter(m => {
    const now = new Date();
    return ['IN_PLAY','PAUSED','LIVE'].includes(m.status) || isSameBDDay(m.utcDate, now);
  });
  const wrap = document.getElementById('tickerWrap');
  if (!relevant.length){ wrap.hidden = true; return; }
  wrap.hidden = false;
  const items = relevant.map(m => `<span class="ticker-item"><b>${teamName(m.homeTeam)} ${scoreLabel(m)} ${teamName(m.awayTeam)}</b> · ${fmtBDDateShort(m.utcDate).time}</span>`);
  const html = items.join(' &nbsp;|&nbsp; ');
  document.getElementById('tickerTrack').innerHTML = html + ' &nbsp;|&nbsp; ' + html;
}

// ---------- Today panel ----------
function renderToday(){
  const now = new Date();
  const todays = ALL_MATCHES.filter(m => isSameBDDay(m.utcDate, now));
  document.getElementById('todayDateLabel').textContent = `(${fmtBDDateShort(now.toISOString()).date})`;
  const grid = document.getElementById('todayGrid');
  if (!todays.length){ grid.innerHTML = '<div class="empty-state">আজ কোনো ম্যাচ নেই</div>'; return; }
  grid.innerHTML = todays.map(m => matchCard(m)).join('');
}

function matchCard(m){
  const bd = fmtBDDateShort(m.utcDate);
  return `
  <div class="match-card">
    <div class="match-card-top">
      <span>${bd.date}, ${bd.time}</span>
      ${statusBadge(m.status)}
    </div>
    <div class="match-teams">
      <span class="match-team home">${teamName(m.homeTeam)}</span>
      <span class="match-score">${scoreLabel(m)}</span>
      <span class="match-team away">${teamName(m.awayTeam)}</span>
    </div>
    <div class="match-card-bottom">
      <span class="match-venue">${m.venue || (m.group ? 'Group ' + m.group.replace('GROUP_','') : '')}</span>
      ${renderWatchBtn(m, false)}
    </div>
  </div>`;
}

// ---------- Fixtures panel ----------
function renderFixtures(){
  const stageFilter = document.getElementById('fixtureStageFilter').value;
  const teamFilter = document.getElementById('fixtureTeamFilter').value.trim().toLowerCase();
  let list = ALL_MATCHES.filter(m => m.status !== 'FINISHED');
  if (stageFilter) list = list.filter(m => m.stage === stageFilter);
  if (teamFilter) list = list.filter(m => teamName(m.homeTeam).toLowerCase().includes(teamFilter) || teamName(m.awayTeam).toLowerCase().includes(teamFilter));
  const el = document.getElementById('fixtureList');
  if (!list.length){ el.innerHTML = '<div class="empty-state">কোনো ফিকশ্চার পাওয়া যায়নি</div>'; return; }
  el.innerHTML = list.map(m => fixtureRow(m)).join('');
}

function fixtureRow(m){
  const bd = fmtBDDateShort(m.utcDate);
  return `
  <div class="fixture-row">
    <div class="fixture-date">${bd.date}<br>${bd.time}</div>
    <div>
      <div class="fixture-matchup">${teamName(m.homeTeam)} <span class="vs">vs</span> ${teamName(m.awayTeam)}</div>
      <div class="fixture-stage">${(m.stage||'').replace(/_/g,' ')}${m.group ? ' · ' + m.group.replace('GROUP_','Group ') : ''}</div>
    </div>
    ${renderWatchBtn(m, false)}
  </div>`;
}

// ---------- Results panel ----------
function renderResults(){
  const list = ALL_MATCHES.filter(m => m.status === 'FINISHED').sort((a,b) => new Date(b.utcDate) - new Date(a.utcDate));
  const el = document.getElementById('resultsList');
  if (!list.length){ el.innerHTML = '<div class="empty-state">এখনো কোনো ফলাফল নেই</div>'; return; }
  el.innerHTML = list.map(m => {
    const bd = fmtBDDateShort(m.utcDate);
    return `
    <div class="fixture-row">
      <div class="fixture-date">${bd.date}<br>${bd.time}</div>
      <div>
        <div class="fixture-matchup">${teamName(m.homeTeam)} <span class="vs">vs</span> ${teamName(m.awayTeam)}</div>
        <div class="fixture-stage">${(m.stage||'').replace(/_/g,' ')}</div>
      </div>
      <div class="fixture-score">${scoreLabel(m)}</div>
    </div>`;
  }).join('');
}

// ---------- Standings panel ----------
let activeGroup = null;
function renderStandingsTabs(){
  const groups = STANDINGS.filter(s => s.type === 'TOTAL' && s.group);
  const wrap = document.getElementById('standingsGroupTabs');
  if (!groups.length){
    document.getElementById('standingsTableWrap').innerHTML = '<div class="empty-state">গ্রুপ স্ট্যান্ডিংস এখনো পাওয়া যায়নি (লাইভ API সংযুক্ত করুন)</div>';
    wrap.innerHTML = '';
    return;
  }
  if (!activeGroup) activeGroup = groups[0].group;
  wrap.innerHTML = groups.map(g => `<button class="group-tab ${g.group===activeGroup?'active':''}" data-group="${g.group}">${g.group.replace('GROUP_','Group ')}</button>`).join('');
  wrap.querySelectorAll('.group-tab').forEach(btn => {
    btn.addEventListener('click', () => { activeGroup = btn.dataset.group; renderStandingsTabs(); });
  });
  renderStandingsTable(groups.find(g => g.group === activeGroup));
}

function renderStandingsTable(group){
  const el = document.getElementById('standingsTableWrap');
  if (!group){ el.innerHTML = '<div class="empty-state">কোনো ডেটা নেই</div>'; return; }
  el.innerHTML = `
  <table class="standings-table">
    <thead><tr><th>#</th><th style="text-align:left">দল</th><th>খেলা</th><th>জয়</th><th>ড্র</th><th>হার</th><th>GD</th><th>পয়েন্ট</th></tr></thead>
    <tbody>
      ${group.table.map(row => `
        <tr>
          <td>${row.position}</td>
          <td class="team-cell">${row.team.name}</td>
          <td>${row.playedGames}</td>
          <td>${row.won}</td>
          <td>${row.draw}</td>
          <td>${row.lost}</td>
          <td>${row.goalDifference}</td>
          <td><b>${row.points}</b></td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

// ---------- Groups panel (who plays whom) ----------
function renderGroups(){
  const groups = STANDINGS.filter(s => s.type === 'TOTAL' && s.group);
  const el = document.getElementById('groupsGrid');
  if (!groups.length){ el.innerHTML = '<div class="empty-state">গ্রুপ তথ্য এখনো পাওয়া যায়নি</div>'; return; }
  el.innerHTML = groups.map(g => `
    <div class="group-card">
      <h3>${g.group.replace('GROUP_','Group ')}</h3>
      <ul>${g.table.map(r => `<li>${r.team.name}</li>`).join('')}</ul>
    </div>`).join('');
}

// ---------- Filters wiring ----------
document.getElementById('fixtureStageFilter').addEventListener('change', renderFixtures);
document.getElementById('fixtureTeamFilter').addEventListener('input', renderFixtures);

// ---------- Boot ----------
async function loadAll(){
  await loadChannels();
  await Promise.all([loadMatches(), loadStandings()]);
  setupHero();
  setupTicker();
  renderToday();
  renderFixtures();
  renderResults();
  renderStandingsTabs();
  renderGroups();
}

(async function init(){
  await loadCompetitions();
  await loadAll();
})();
// Refresh live data periodically without a full page reload.
setInterval(loadAll, 60000);
