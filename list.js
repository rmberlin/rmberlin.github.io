// Small helpers for the gig lists. Runs only in your browser and sends nothing anywhere:
// the page's Content-Security-Policy allows no network requests from scripts at all.
// Without JavaScript the lists work as before; search and filters stay hidden.

// Berlin time as text, "2026-10-30 21:00", so it compares directly with a gig's date and time.
const berlin = (ms) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }).format(ms);
const now = berlin(Date.now());
const today = now.slice(0, 10);

// Days that are over go. The list is rebuilt once a night (sometimes late), and until 6:00 last night still counts.
const keepFrom = berlin(Date.now() - 6 * 36e5).slice(0, 10);
for (const d of document.querySelectorAll('[data-day]')) if (d.id.slice(2) < keepFrom) d.remove();
for (const p of document.querySelectorAll('[data-period]')) if (!p.querySelector('[data-day]')) p.remove();
for (const d of document.querySelectorAll('[data-strip-day]')) if (d.dataset.stripDay < keepFrom) d.remove();

// The "Heute Abend" poster (already trimmed by its own inline script, see src/lib/inline.ts): hidden while searching
const poster = document.querySelector('[data-tonight]');

// Gigs that started more than two hours ago: dimmed and marked "läuft schon".
const startedLabel = document.querySelector('[data-started-label]')?.dataset.startedLabel;
const twoHoursAgo = berlin(Date.now() - 2 * 36e5);
for (const g of document.querySelectorAll('li[data-time]')) {
  if (`${g.dataset.date} ${g.dataset.time}` > twoHoursAgo) continue;
  g.dataset.started = '';
  const mark = document.createElement('span');
  mark.className = 'started';
  mark.textContent = startedLabel;
  g.querySelector('[data-when]').after(mark);
}

// "Als App installieren" in the footer, only where it works and never inside the installed app. Android and other
// Chromium browsers offer their install dialog (beforeinstallprompt); iPhones and iPads have no such dialog, so the
// button shows how to do it via Share. Elsewhere (desktop Firefox and the like) it stays hidden.
const install = document.querySelector('[data-install]');
const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (install && !installed) {
  const button = install.querySelector('button');
  const help = install.querySelector('p');
  let offer; // the browser's install dialog, kept for the tap
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    offer = e;
    install.hidden = false;
  });
  addEventListener('appinstalled', () => { install.hidden = true; });
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  if (apple) install.hidden = false;
  button.addEventListener('click', async () => {
    if (offer) {
      offer.prompt();
      if ((await offer.userChoice).outcome === 'accepted') install.hidden = true;
      offer = undefined;
    } else {
      help.hidden = !help.hidden;
      button.setAttribute('aria-expanded', String(!help.hidden));
    }
  });
}

// The way to a place in the phone's own maps app (it finds your position itself; we pass on nothing but the venue):
// Apple Maps on iPhone, iPad and Mac (by public transport), the geo: link on Android (opens whichever maps app you
// use). place: "52.499,13.418" or an address. Anywhere else: undefined, the caller's OpenStreetMap link stays.
const mapsApp = (place, name) => {
  if (/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)) return `https://maps.apple.com/?daddr=${encodeURI(place)}&q=${encodeURIComponent(name)}&dirflg=r`;
  if (/Android/.test(navigator.userAgent)) return `geo:0,0?q=${encodeURI(place)}(${encodeURIComponent(name)})`;
};
for (const a of document.querySelectorAll('[data-maps]')) a.href = mapsApp(a.dataset.maps, a.dataset.mapsName) ?? a.href;

// "Back to top" floats in once you are more than a screen and a half down the list
const up = document.querySelector('.to-top');
if (up) {
  const toggle = () => { up.hidden = scrollY < innerHeight * 1.5; };
  addEventListener('scroll', toggle, { passive: true });
  toggle();
}

// A shared link to one gig (#g-<id>): open its month if folded, mark it and bring it into view.
const shared = location.hash.startsWith('#g-') && document.getElementById(location.hash.slice(1));
if (shared) {
  const month = shared.closest('details');
  if (month) month.open = true;
  shared.dataset.picked = '';
  shared.scrollIntoView(); // the browser jumps there too; scroll-margin-top keeps it below the pinned bars
}

// The share button beside the calendar icon: the phone's own share sheet, or the link copied where there is
// none (most desktop browsers). The link leads back to the gig on this page. Nothing is sent from here.
const copiedLabel = document.querySelector('[data-copied-label]')?.dataset.copiedLabel;
document.addEventListener('click', async (e) => {
  const button = e.target.closest('[data-share]');
  if (!button) return;
  const g = button.closest('li');
  const title = g.querySelector('a').textContent;
  const day = new Date(`${g.dataset.date}T12:00:00Z`)
    .toLocaleDateString(document.documentElement.lang, { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  const text = [day, g.dataset.time, g.querySelector('[data-where]').firstElementChild.textContent].filter(Boolean).join(' · ');
  const url = `${location.origin}${location.pathname}#${g.id}`;
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // closed without sharing: nothing to do
      // the share sheet refused (some in-app browsers): copy the link instead
    }
  }
  await navigator.clipboard?.writeText(`${title}\n${text}\n${url}`);
  const label = button.getAttribute('aria-label');
  button.dataset.copied = '';
  button.setAttribute('aria-label', copiedLabel);
  button.title = copiedLabel;
  setTimeout(() => {
    delete button.dataset.copied;
    button.setAttribute('aria-label', label);
    button.title = label.split(':')[0];
  }, 2000);
});

// The calendar icon: a small sheet to pick how, because a downloaded file alone leaves many people stuck. Google's
// page gets the gig through the link, only when you tap it; the file works everywhere else. Without JavaScript the
// icon is a plain link to the file.
const sheet = document.querySelector('[data-calendar-sheet]');
if (sheet?.showModal) {
  const google = sheet.querySelector('[data-calendar-google]');
  const file = sheet.querySelector('[data-calendar-file]');
  // iPhones and iPads open the file straight in their calendar, so there it comes first
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) google.before(file);
  const stamp = (ms) => new Date(ms).toISOString().slice(0, 16).replace(/[-:]/g, '');
  // "20261104T2000" + "00": Berlin wall-clock time (ctz says so), three hours long as in the file; no time: all day
  const googleDates = ({ date, time }) => {
    const start = Date.parse(`${date}T${time ?? '00:00'}:00Z`);
    if (!time) return `${stamp(start).slice(0, 8)}/${stamp(start + 864e5).slice(0, 8)}`;
    return `${stamp(start)}00/${stamp(start + 3 * 36e5)}00`;
  };
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-calendar]');
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    const g = link.closest('li');
    const title = g.querySelector('a');
    sheet.querySelector('[data-calendar-title]').textContent = title.textContent;
    google.href = `https://calendar.google.com/calendar/render?${new URLSearchParams({
      action: 'TEMPLATE',
      text: title.textContent,
      dates: googleDates(g.dataset),
      ctz: 'Europe/Berlin',
      location: g.dataset.place,
      details: title.href,
    })}`;
    file.href = link.href;
    sheet.showModal();
  });
  sheet.addEventListener('click', (e) => { // a tap on an option, on Cancel, or beside the sheet
    if (e.target === sheet || e.target.closest('a, button')) sheet.close();
  });
}

const input = document.getElementById('search');
if (input) {
  // Same rules as norm() in shared.ts: "Großstadt", "GROSSSTADT" and "grossstadt!" match.
  const norm = (s) =>
    s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const gigs = [...document.querySelectorAll('[data-search]')];
  const days = [...document.querySelectorAll('[data-day]')];
  const periods = [...document.querySelectorAll('[data-period]')];
  const count = document.getElementById('search-count'); // wording in the page's language: data-hits="# Treffer"
  const clear = document.getElementById('search-clear');
  const touch = matchMedia('(pointer: coarse)');
  // Phones: the filters fold away behind "Filter" (CSS), a tap opens them
  const toggle = document.getElementById('filter-toggle');
  const filterCount = toggle.querySelector('.filter-count');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', open);
    input.closest('.tools').toggleAttribute('data-filters-open', open);
  });
  const kinds = [...document.querySelectorAll('input[name="kind"]')]; // Was: exactly one ("" = Alles)
  const onlys = [...document.querySelectorAll('input[name="only"]')]; // Nur: any combination
  const tests = {
    concert: (g) => g.dataset.kind === 'concert',
    party: (g) => g.dataset.kind === 'party',
    open: (g) => 'open' in g.dataset, // frei / Spende
    late: (g) => 'late' in g.dataset, // from 23:00
  };

  // "In der Nähe": the browser asks you before it gives your position, and it stays in this page; the distance
  // to each venue (coordinates in data-geo) is worked out right here. Nothing is stored or sent, nor put in the URL.
  // The map's zoom is the radius: − / + step through these, the gig list and the map follow.
  const RADII_KM = [1, 2, 3, 5, 8, 15];
  let level = 2; // 3 km
  const radius = () => RADII_KM[level];
  let here; // [lat, lon], once you allowed it
  const locate = () => new Promise((ok, fail) => navigator.geolocation
    ? navigator.geolocation.getCurrentPosition((p) => ok([p.coords.latitude, p.coords.longitude]), fail, { timeout: 15000, maximumAge: 300000 })
    : fail());
  const km = (g) => {
    if (!here || !g.dataset.geo) return Infinity; // venue without coordinates: never "near"
    const [lat, lon] = g.dataset.geo.split(',').map(Number);
    const rad = Math.PI / 180;
    const a = Math.sin(((lat - here[0]) * rad) / 2) ** 2 + Math.cos(here[0] * rad) * Math.cos(lat * rad) * Math.sin(((lon - here[1]) * rad) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a)); // haversine; 12742 km = the Earth's diameter
  };
  tests.near = (g) => km(g) <= radius();
  const kmText = new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 1 });

  // Scrolls to a gig and marks it (a tap in the "Heute in deiner Nähe" list).
  const show = (g) => {
    const month = g.closest('details');
    if (month) month.open = true;
    document.querySelector('[data-picked]')?.removeAttribute('data-picked');
    g.dataset.picked = '';
    g.scrollIntoView({ block: 'center', behavior: 'smooth' });
    g.querySelector('a')?.focus({ preventScroll: true });
  };

  // The map under the filters (NearMap.tsx), zoomed in on you: today's gigs still to come as dots, one per place,
  // the five closest numbered and listed below it. Sizes are in % of the visible width, so they hold at any zoom.
  const near = document.querySelector('.near');
  const svg = near?.querySelector('svg');
  const el = (name, attrs) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const titleOf = (g) => g.querySelector('a').textContent;
  const venueOf = (g) => g.querySelector('[data-where]').firstElementChild.textContent;
  const routeTo = (g) => {
    const [lat, lon] = g.dataset.geo.split(',');
    return mapsApp(g.dataset.geo, venueOf(g)) ?? `https://www.openstreetmap.org/directions?route=%3B${lat}%2C${lon}#map=16/${lat}/${lon}`;
  };
  const drawMap = (on) => {
    if (!near) return;
    near.hidden = !on;
    if (!on) return;
    const [west, south, east, north] = svg.dataset.bbox.split(',').map(Number);
    const [w, h] = svg.dataset.size.split(',').map(Number);
    const at = ([lat, lon]) => [((lon - west) / (east - west)) * w, ((north - lat) / (north - south)) * h];
    const perKm = w / ((east - west) * 111.32 * Math.cos((52.5 * Math.PI) / 180));
    const [cx, cy] = at(here);
    const half = (radius() * 1.15 + 0.4) * perKm; // the circle plus a margin
    svg.setAttribute('viewBox', `${cx - half} ${cy - half * 0.75} ${2 * half} ${1.5 * half}`); // 4:3
    const far = radius() > 5; // zoomed out: no district names (they'd overlap), smaller dots
    svg.classList.toggle('far', far);
    const u = (half / 50) * (far ? 0.7 : 1);
    svg.querySelector('.m-labels').setAttribute('font-size', (3.4 * half) / 50);
    const tower = svg.querySelector('.m-tower');
    tower.setAttribute('transform', `translate(${tower.dataset.x} ${tower.dataset.y}) scale(${u})`);
    near.querySelector('.near-radius').textContent = `${kmText.format(radius())} km`;
    for (const b of near.querySelectorAll('[data-zoom]')) b.disabled = !RADII_KM[level + Number(b.dataset.zoom)];
    for (const [sel, r] of [['.m-you', 1.8 * u], ['.m-radius', radius() * perKm]]) {
      for (const [k, v] of Object.entries({ cx, cy, r })) svg.querySelector(sel).setAttribute(k, v);
    }
    for (const [k, v] of Object.entries({ x: cx, y: cy - 3 * u, 'font-size': 3.2 * u })) { // "DU" above your dot
      svg.querySelector('.m-you-label').setAttribute(k, v);
    }
    const todays = gigs
      .filter((g) => g.isConnected && !g.hidden && g.dataset.date === today && g.dataset.geo && !('started' in g.dataset))
      .sort((a, b) => km(a) - km(b));
    const top = todays.slice(0, 5);
    const few = u < 1.2; // zoomed in: dots can be bigger
    const places = new Map();
    for (const g of todays) places.set(g.dataset.geo, [...(places.get(g.dataset.geo) ?? []), g]);
    const dots = [...places].map(([geo, list]) => {
      const [x, y] = at(geo.split(',').map(Number));
      const nums = list.map((g) => top.indexOf(g) + 1).filter(Boolean); // "2 3": two of the five at one place
      const dot = el('g', { class: nums.length ? 'm-dot top' : 'm-dot' });
      // Tap a dot: jump to its gig. Hover / long-press: where and what.
      dot.append(Object.assign(el('title', {}), { textContent: `${venueOf(list[0])}: ${list.map(titleOf).join(', ')}` }));
      dot.addEventListener('click', () => show(list[0]));
      dot.append(el('circle', { cx: x, cy: y, r: (nums.length ? 2.4 : few ? 1.4 : 1) * u }));
      if (nums.length) dot.append(Object.assign(el('text', { x, y, 'font-size': 2.4 * u }), { textContent: nums.join(' ') }));
      return dot;
    });
    svg.querySelector('.m-dots').replaceChildren(...dots.filter((d) => !d.classList.contains('top')), ...dots.filter((d) => d.classList.contains('top')));
    const list = near.querySelector('.near-list');
    list.replaceChildren(...top.map((g) => {
      // Title, then "21:00 · Köpi · 1,1 km"; a tap jumps to the gig. Beside it: the way there in your maps app.
      const button = Object.assign(document.createElement('button'), { type: 'button' });
      button.append(
        Object.assign(document.createElement('strong'), { textContent: titleOf(g) }),
        Object.assign(document.createElement('span'), { textContent: [g.dataset.time, venueOf(g), `${kmText.format(km(g))} km`].filter(Boolean).join(' · ') }),
      );
      button.addEventListener('click', () => show(g));
      const route = Object.assign(document.createElement('a'), {
        className: 'route',
        href: routeTo(g),
        textContent: list.dataset.route,
        rel: 'noreferrer',
      });
      route.setAttribute('aria-label', list.dataset.routeLabel.replace('#', venueOf(g)));
      const li = document.createElement('li');
      li.append(button, route);
      return li;
    }));
    if (!top.length) list.replaceChildren(Object.assign(document.createElement('li'), { className: 'empty', textContent: list.dataset.empty }));
  };
  const folded = periods.filter((p) => 'folded' in p.dataset);
  for (const p of folded) {
    p.addEventListener('toggle', () => {
      if (!p.open && 'auto' in p.dataset) { delete p.dataset.auto; p.dataset.shut = ''; } // closed by hand
    });
  }

  const apply = () => {
    const words = norm(input.value).split(' ').filter(Boolean); // every word must match: "punk schokoladen"
    const filters = [...kinds, ...onlys].filter((i) => i.checked && i.value).map((i) => i.value); // "concert", "open", ...
    let hits = 0;
    for (const g of gigs) {
      g.hidden = !words.every((w) => g.dataset.search.includes(w)) || !filters.every((f) => tests[f](g));
      if (!g.hidden) hits++;
    }
    // With "In der Nähe" on, each gig shows how far away it is: "1,3 km"
    for (const g of gigs) {
      let label = g.querySelector('.distance');
      if (filters.includes('near') && !g.hidden) {
        label ??= g.querySelector('[data-where]').appendChild(Object.assign(document.createElement('span'), { className: 'distance' }));
        label.textContent = `${kmText.format(km(g))} km`;
      } else label?.remove();
    }
    for (const d of days) d.hidden = !d.querySelector('[data-search]:not([hidden])');
    for (const p of periods) p.hidden = !p.querySelector('[data-day]:not([hidden])');
    // Folded months open while searching or filtering, and fold again afterwards (unless you opened them yourself).
    // One you close yourself during a search stays closed until the search is cleared.
    const active = words.length || filters.length;
    for (const p of folded) {
      if (active && !p.hidden && !p.open && !('shut' in p.dataset)) { p.open = true; p.dataset.auto = ''; }
      if (!active) {
        if ('auto' in p.dataset) { p.open = false; delete p.dataset.auto; }
        delete p.dataset.shut;
      }
    }
    count.textContent = active ? (hits ? count.dataset.hits.replace('#', hits) : count.dataset.none) : '';
    filterCount.textContent = filters.filter((f) => f !== 'near').length || ''; // on the folded "Filter" button: how many are on (near has its own)
    if (poster?.isConnected) poster.hidden = !!active; // while searching, the list below is the answer
    clear.hidden = !input.value; // the × only shows when there is something to clear
    drawMap(filters.includes('near') && !!here);
    // Keep search and filters in the address, so they can be shared or bookmarked: /?q=punk&f=open
    const url = new URL(location.href);
    for (const [key, value] of [['q', words.length && input.value], ['f', filters.filter((f) => f !== 'near').join(',')]]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url);
  };

  for (const k of kinds) k.addEventListener('change', apply);
  for (const c of onlys) {
    c.addEventListener('change', async () => {
      if (c.checked && c.value === 'near' && !here) {
        // Finding the position can take a few seconds: open the map right away (whole city, pulsing, "Suche deinen
        // Standort …") and bring it into view, so nothing looks stuck.
        c.closest('label').dataset.busy = '';
        near.hidden = false;
        near.dataset.loading = '';
        near.scrollIntoView({ block: 'start', behavior: 'smooth' }); // scroll-margin keeps it below the header
        try {
          here = await locate();
        } catch {
          near.hidden = true;
          c.checked = false;
          count.textContent = count.dataset.noLocation; // refused, or no GPS / Wi-Fi fix
          return;
        } finally {
          delete c.closest('label').dataset.busy;
          delete near.dataset.loading;
        }
      }
      apply();
    });
  }

  for (const b of near?.querySelectorAll('[data-zoom]') ?? []) {
    b.addEventListener('click', () => {
      level = Math.min(RADII_KM.length - 1, Math.max(0, level + Number(b.dataset.zoom)));
      apply();
    });
  }

  // The search shows before this script runs, so keep whatever was typed or tapped meanwhile; the address wins.
  const params = new URLSearchParams(location.search);
  input.value = params.get('q') ?? input.value;
  const fromUrl = params.get('f')?.split(',');
  if (fromUrl) for (const k of kinds) k.checked = fromUrl.includes(k.value) || (!k.value && !kinds.some((o) => o.value && fromUrl.includes(o.value)));
  for (const c of onlys) c.checked = c.value !== 'near' && (fromUrl ? fromUrl.includes(c.value) : c.checked); // never ask for your location on load
  input.addEventListener('input', apply);
  const reset = () => { input.value = ''; apply(); input.focus(); };
  clear.addEventListener('click', reset);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) reset();
    if (e.key !== 'Enter') return;
    // The keyboard's search key: on touch screens the keyboard closes, and the first result comes into view
    if (touch.matches) input.blur();
    const first = gigs.find((g) => !g.hidden); // lands below the pinned bars (its scroll-margin-top)
    if (!input.value || !first) return;
    // Twice: the first jump shrinks the header, which moves the list up under the pinned bars
    const jump = () => first.scrollIntoView();
    setTimeout(() => { jump(); requestAnimationFrame(() => requestAnimationFrame(jump)); }, 100); // once the keyboard is going
  });
  // Dragging the list with the keyboard open means you are reading the results: it closes, as in phone apps
  addEventListener('touchmove', () => { if (document.activeElement === input) input.blur(); }, { passive: true });
  if (input.value || [...kinds, ...onlys].some((i) => i.checked && i.value)) apply();
}
