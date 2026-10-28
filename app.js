(() => {
  'use strict';

  // Noms proposés par défaut — modifiez cette liste librement.
  const DEFAULT_NAMES = [
    'Lucien', 'Shazir', 'Jo', 'Owen', 'Clem', 'Thib', 'Gui G', 'Gui L', 'Sacha', 'Max', 'Elias'
  ];

  const PALETTE = [
    '#4f46e5', '#db2777', '#0d9488', '#d97706', '#7c3aed',
    '#0891b2', '#e11d48', '#16a34a', '#ea580c', '#2563eb',
  ];

  const TAU = Math.PI * 2;
  const STORAGE_KEY = 'roue-de-la-chance:v1';
  const MAX_COPIES = 10;

  const AVATAR_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.2" r="4.2"/>' +
    '<path d="M3.5 21c0-4.4 3.8-7.4 8.5-7.4s8.5 3 8.5 7.4z"/></svg>';

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const wrap = $('wheelWrap');
  const canvas = $('wheel');
  const ctx = canvas.getContext('2d');
  const pointer = $('pointer');
  const spinBtn = $('spinBtn');
  const currentEl = $('current');
  const listEl = $('list');
  const countEl = $('count');
  const addForm = $('addForm');
  const addInput = $('addInput');
  const durationInput = $('duration');
  const durationOut = $('durationOut');
  const teamOpt = $('teamOpt');
  const teamSizeOpt = $('teamSizeOpt');
  const teamSizeInput = $('teamSize');
  const teamSizeOut = $('teamSizeOut');
  const multiOpt = $('multiOpt');
  const soundOpt = $('soundOpt');
  const removeOpt = $('removeOpt');
  const teambar = $('teambar');
  const teamSlots = $('teamSlots');
  const modal = $('modal');
  const eyebrowEl = $('eyebrow');
  const winnerNameEl = $('winnerName');
  const removeBtn = $('removeBtn');
  const closeBtn = $('closeBtn');
  const match = $('match');
  const matchSub = $('matchSub');
  const matchSlots = $('matchSlots');
  const matchCount = $('matchCount');

  // ---------- State ----------
  const uid = () => Math.random().toString(36).slice(2, 10);

  const defaults = () => ({
    items: DEFAULT_NAMES.map((name) => ({ id: uid(), name, on: true, count: 1 })),
    duration: 6,
    sound: true,
    removeWinner: false,
    multi: false,
    teamMode: true,
    teamSize: 5,
    team: [],
  });

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.items)) {
        const s = { ...defaults(), ...saved };
        s.items.forEach((it) => { if (!it.count) it.count = 1; });
        return s;
      }
    } catch { /* ignore */ }
    return defaults();
  }

  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  };

  const state = load();
  let rotation = 0;
  let spinning = false;
  let highlight = null;
  let lastWinner = null;

  // En mode équipe, un joueur déjà sélectionné ne peut pas être tiré une seconde fois.
  function activeItems() {
    const inTeam = state.teamMode ? new Set(state.team.map((p) => p.id)) : null;
    return state.items.filter((it) => it.on && !(inTeam && inTeam.has(it.id)));
  }

  // Segments de la roue. En mode « entrées multiples », les exemplaires d'une même
  // personne sont répartis en tourniquet pour ne pas se retrouver côte à côte.
  function buildSegments() {
    const items = activeItems();
    if (!state.multi) return items;
    const segs = [];
    const max = Math.max(0, ...items.map((it) => it.count));
    for (let round = 0; round < max; round++) {
      for (const it of items) if (it.count > round) segs.push(it);
    }
    return segs;
  }

  function segmentColors(n) {
    const colors = [];
    for (let i = 0; i < n; i++) colors.push(PALETTE[i % PALETTE.length]);
    // Évite deux segments adjacents de la même couleur (dernier / premier).
    if (n > 1 && colors[n - 1] === colors[0]) colors[n - 1] = PALETTE[(n - 1 + 2) % PALETTE.length];
    return colors;
  }

  const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

  // ---------- Wheel rendering ----------
  function fitText(text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1);
    return s + '…';
  }

  function wedge(c, R, a0, seg) {
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, R, a0, a0 + seg);
    ctx.closePath();
  }

  function drawWheel() {
    const size = wrap.clientWidth;
    if (!size) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = Math.round(size * dpr);
    if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const c = size / 2;
    const R = c - 1;
    const segs = buildSegments();
    const n = segs.length;

    if (!n) {
      ctx.beginPath();
      ctx.arc(c, c, R, 0, TAU);
      ctx.fillStyle = '#141821';
      ctx.fill();
      ctx.setLineDash([4, 8]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#2a3042';
      for (const f of [0.85, 0.6]) {
        ctx.beginPath();
        ctx.arc(c, c, R * f, 0, TAU);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      return;
    }

    const seg = TAU / n;
    const colors = segmentColors(n);

    for (let i = 0; i < n; i++) {
      wedge(c, R, -Math.PI / 2 + i * seg, seg);
      ctx.fillStyle = colors[i];
      ctx.fill();
    }

    if (n > 1) {
      ctx.strokeStyle = 'rgba(11, 13, 18, .35)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + i * seg;
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
        ctx.stroke();
      }
    }

    // Subtle depth
    const g = ctx.createRadialGradient(c, c, R * 0.15, c, c, R);
    g.addColorStop(0, 'rgba(255,255,255,.07)');
    g.addColorStop(0.65, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.25)');
    ctx.beginPath();
    ctx.arc(c, c, R, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();

    // Dim non-winning segments after a spin
    if (highlight !== null && n > 1) {
      ctx.fillStyle = 'rgba(8, 10, 15, .62)';
      for (let i = 0; i < n; i++) {
        if (i === highlight) continue;
        wedge(c, R, -Math.PI / 2 + i * seg, seg);
        ctx.fill();
      }
    }

    // Labels
    const fontSize = Math.max(9, Math.min(R * seg * 0.32, R * 0.085));
    const outer = R * 0.92;
    const inner = R * 0.3;
    ctx.font = `600 ${fontSize}px Inter, ui-sans-serif, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(-Math.PI / 2 + (i + 0.5) * seg);
      ctx.globalAlpha = highlight === null || highlight === i ? 1 : 0.45;
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#fff';
      ctx.fillText(fitText(segs[i].name, outer - inner), outer, 0);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(c, c, R - 1, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const setRotation = (r) => { canvas.style.transform = `rotate(${r}rad)`; };

  // ---------- List rendering ----------
  function renderList() {
    const active = activeItems();
    const segs = buildSegments();
    const colors = segmentColors(segs.length);
    const colorById = new Map();
    segs.forEach((it, i) => { if (!colorById.has(it.id)) colorById.set(it.id, colors[i]); });
    const inTeam = new Set(state.team.map((p) => p.id));

    listEl.textContent = '';
    if (!state.items.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Aucun élément. Ajoutez-en un ci-dessus.';
      listEl.append(li);
    }

    for (const it of state.items) {
      const li = document.createElement('li');
      li.className = 'item' + (it.on ? ' on' : '');
      li.dataset.id = it.id;

      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = it.on;
      const check = document.createElement('span');
      check.className = 'check';
      const dot = document.createElement('span');
      dot.className = 'dot';
      if (colorById.has(it.id)) dot.style.background = colorById.get(it.id);
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = it.name;
      name.title = it.name;
      label.append(input, check, dot, name);
      if (state.teamMode && inTeam.has(it.id)) {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = 'Équipe';
        label.append(tag);
      }
      li.append(label);

      if (state.multi) {
        const stepper = document.createElement('div');
        stepper.className = 'stepper';
        const dec = document.createElement('button');
        dec.type = 'button';
        dec.dataset.act = 'dec';
        dec.textContent = '−';
        dec.disabled = it.count <= 1;
        dec.setAttribute('aria-label', `Retirer un exemplaire de ${it.name}`);
        const val = document.createElement('span');
        val.textContent = `×${it.count}`;
        const inc = document.createElement('button');
        inc.type = 'button';
        inc.dataset.act = 'inc';
        inc.textContent = '+';
        inc.disabled = it.count >= MAX_COPIES;
        inc.setAttribute('aria-label', `Ajouter un exemplaire de ${it.name}`);
        stepper.append(dec, val, inc);
        li.append(stepper);
      }

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'del';
      del.textContent = '×';
      del.setAttribute('aria-label', `Supprimer ${it.name}`);
      li.append(del);

      listEl.append(li);
    }

    countEl.textContent = `${active.length} / ${state.items.length}`;
    if (!spinning && highlight === null) {
      setCurrentHint(active.length ? 'Cliquez sur « Tourner » ou appuyez sur Espace' : 'Cochez ou ajoutez des participants');
    }
  }

  function renderTeam() {
    teambar.hidden = !state.teamMode;
    if (!state.teamMode) return;
    teamSlots.textContent = '';
    for (let i = 0; i < state.teamSize; i++) {
      const p = state.team[i];
      const slot = document.createElement('div');
      slot.className = 'tslot' + (p ? ' filled' : '');
      const av = document.createElement('div');
      av.className = 'tavatar';
      av.innerHTML = AVATAR_SVG;
      const nm = document.createElement('div');
      nm.className = 'tname';
      nm.textContent = p ? p.name : '—';
      if (p) nm.title = p.name;
      slot.append(av, nm);
      teamSlots.append(slot);
    }
  }

  function setCurrentHint(text) {
    currentEl.classList.add('hint');
    currentEl.textContent = text;
  }
  function setCurrent(text) {
    currentEl.classList.remove('hint');
    currentEl.textContent = text;
  }

  function update() {
    save();
    renderList();
    renderTeam();
    drawWheel();
  }

  // ---------- Sound ----------
  let audio = null;
  let lastTickAt = 0;

  function ensureAudio() {
    if (!audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audio = new AC();
    }
    if (audio && audio.state === 'suspended') audio.resume();
  }

  function tone(freq, start, length, type = 'sine', peak = 0.12) {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + length);
    o.connect(g).connect(audio.destination);
    o.start(start);
    o.stop(start + length + 0.05);
  }

  function tickSound() {
    if (!state.sound || !audio) return;
    const t = audio.currentTime;
    if (t - lastTickAt < 0.035) return;
    lastTickAt = t;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.03);
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + 0.06);
  }

  function winSound() {
    if (!state.sound || !audio) return;
    const t0 = audio.currentTime + 0.02;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(f, t0 + i * 0.09, i === 3 ? 0.9 : 0.3);
    });
  }

  function readySound(i) {
    if (!state.sound || !audio) return;
    const t = audio.currentTime + 0.01;
    tone(440 * Math.pow(2, (i * 2) / 12), t, 0.18, 'square', 0.05);
  }

  // ---------- Spin ----------
  // Décélération douce et naturelle (ease-out quartique).
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);

  function indexAt(r, n) {
    const seg = TAU / n;
    const local = ((-r % TAU) + TAU) % TAU;
    return Math.min(n - 1, Math.floor(local / seg));
  }

  function wiggle() {
    pointer.animate(
      [{ transform: 'rotate(-22deg)' }, { transform: 'rotate(0deg)' }],
      { duration: 140, easing: 'cubic-bezier(.2,.8,.3,1)' }
    );
  }

  function shake() {
    wrap.classList.remove('shake');
    void wrap.offsetWidth;
    wrap.classList.add('shake');
  }

  function spin() {
    if (spinning || match.classList.contains('open')) return;
    ensureAudio();

    if (state.teamMode) {
      if (state.team.length >= state.teamSize) { openMatch(); return; }
      // S'il reste au plus autant de personnes que de places, tout le monde joue.
      const people = activeItems();
      if (people.length && people.length <= state.teamSize - state.team.length) {
        for (const it of people) {
          state.team.push({ id: it.id, name: it.name });
          it.on = false;
        }
        highlight = null;
        update();
        openMatch();
        return;
      }
    }

    const segs = buildSegments();
    const n = segs.length;
    if (!n) { shake(); return; }

    if (highlight !== null) { highlight = null; drawWheel(); }

    spinning = true;
    document.body.classList.add('spinning');
    spinBtn.disabled = true;

    const seg = TAU / n;
    const winner = Math.floor(random() * n);
    // Point d'arrêt aléatoire à l'intérieur du segment (évite les bords).
    const landing = (winner + 0.1 + random() * 0.8) * seg;

    const start = rotation;
    const startMod = ((start % TAU) + TAU) % TAU;
    const targetMod = (TAU - landing) % TAU;
    const turns = Math.max(3, Math.round(state.duration * 0.9));
    const delta = ((targetMod - startMod + TAU) % TAU) + turns * TAU;

    const duration = state.duration * 1000;
    const t0 = performance.now();
    let lastIdx = indexAt(start, n);
    setCurrent(segs[lastIdx].name);

    function frame(now) {
      const t = Math.min(1, (now - t0) / duration);
      rotation = start + delta * easeOut(t);
      setRotation(rotation);

      const idx = indexAt(rotation, n);
      if (idx !== lastIdx) {
        lastIdx = idx;
        setCurrent(segs[idx].name);
        tickSound();
        wiggle();
      }

      if (t < 1) requestAnimationFrame(frame);
      else finish(segs, winner);
    }
    requestAnimationFrame(frame);
  }

  function finish(segs, winnerIdx) {
    rotation = ((rotation % TAU) + TAU) % TAU;
    setRotation(rotation);
    spinning = false;
    document.body.classList.remove('spinning');
    spinBtn.disabled = false;

    const winner = segs[winnerIdx];
    lastWinner = winner;
    highlight = winnerIdx;
    drawWheel();
    setCurrent(winner.name);

    const li = listEl.querySelector(`[data-id="${winner.id}"]`);
    if (li) {
      li.classList.remove('flash');
      void li.offsetWidth;
      li.classList.add('flash');
      li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    if (state.teamMode) {
      state.team.push({ id: winner.id, name: winner.name });
      save();
      renderTeam();
      renderList();
      if (state.team.length >= state.teamSize) {
        setTimeout(openMatch, 500);
        return;
      }
    }

    winSound();
    celebrate();
    setTimeout(() => openModal(winner), 350);
  }

  // Retire le dernier gagnant de la roue si nécessaire et efface la surbrillance.
  function consumeWinner(remove) {
    highlight = null;
    if (lastWinner && (remove || state.removeWinner || state.teamMode)) {
      const it = state.items.find((x) => x.id === lastWinner.id);
      if (it) it.on = false;
    }
    lastWinner = null;
    update();
  }

  // ---------- Winner modal ----------
  function openModal(winner) {
    eyebrowEl.textContent = state.teamMode
      ? `Joueur ${state.team.length} / ${state.teamSize} sélectionné`
      : 'Et le gagnant est…';
    winnerNameEl.textContent = winner.name;
    removeBtn.hidden = state.removeWinner || state.teamMode;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
  }

  function closeModal(remove) {
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    consumeWinner(remove);
    spinBtn.focus();
  }

  closeBtn.addEventListener('click', () => closeModal(false));
  removeBtn.addEventListener('click', () => closeModal(true));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(false); });

  // ---------- Match ready (CS2) ----------
  let matchTimers = [];

  function openMatch() {
    matchTimers.forEach(clearTimeout);
    matchTimers = [];
    ensureAudio();

    const size = state.teamSize;
    const team = state.team.slice(0, size);
    matchSub.textContent = `Counter-Strike 2 • ${size} joueurs`;
    matchSlots.textContent = '';
    const slots = [];
    for (let i = 0; i < size; i++) {
      const slot = document.createElement('div');
      slot.className = 'mslot';
      const av = document.createElement('div');
      av.className = 'mavatar';
      av.innerHTML = AVATAR_SVG;
      const nm = document.createElement('div');
      nm.className = 'mname';
      nm.textContent = team[i] ? team[i].name : '—';
      if (team[i]) nm.title = team[i].name;
      slot.append(av, nm);
      matchSlots.append(slot);
      slots.push(slot);
    }

    let ready = 0;
    const setCount = () => { matchCount.textContent = `${ready} / ${size} joueurs prêts`; };
    setCount();

    match.classList.remove('all-ready');
    match.classList.add('open');
    match.setAttribute('aria-hidden', 'false');
    $('matchClose').focus();

    const STEP = 420;
    team.forEach((_, i) => {
      matchTimers.push(setTimeout(() => {
        slots[i].classList.add('ready');
        ready = i + 1;
        setCount();
        readySound(i);
      }, 750 + i * STEP));
    });
    matchTimers.push(setTimeout(() => {
      if (team.length >= size) {
        match.classList.add('all-ready');
        winSound();
        celebrate();
      }
    }, 750 + team.length * STEP + 150));
  }

  function closeMatch(newDraw) {
    if (!match.classList.contains('open')) return;
    matchTimers.forEach(clearTimeout);
    matchTimers = [];
    match.classList.remove('open', 'all-ready');
    match.setAttribute('aria-hidden', 'true');
    consumeWinner(false);
    if (newDraw) resetTeam();
    spinBtn.focus();
  }

  function resetTeam() {
    const ids = new Set(state.team.map((p) => p.id));
    state.items.forEach((it) => { if (ids.has(it.id)) it.on = true; });
    state.team = [];
    highlight = null;
    update();
  }

  $('matchClose').addEventListener('click', () => closeMatch(false));
  $('matchNew').addEventListener('click', () => closeMatch(true));
  $('teamReset').addEventListener('click', () => { if (!spinning) resetTeam(); });

  // ---------- Confetti ----------
  const confCanvas = $('confetti');
  const cctx = confCanvas.getContext('2d');
  let particles = [];
  let confettiRunning = false;
  let cw = 0, ch = 0;

  function resizeConfetti() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = window.innerWidth;
    ch = window.innerHeight;
    confCanvas.width = Math.round(cw * dpr);
    confCanvas.height = Math.round(ch * dpr);
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const CONFETTI_COLORS = [...PALETTE, '#f4f5fa', '#fde047', '#a78bfa'];

  function emit(x, y, angle, spread, count, speedMin, speedMax) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = speedMin + Math.random() * (speedMax - speedMin);
      particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        w: 6 + Math.random() * 7,
        h: 4 + Math.random() * 5,
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 12,
        flip: Math.random() * TAU,
        vf: 6 + Math.random() * 8,
        sway: Math.random() * TAU,
        round: Math.random() < 0.25,
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
      });
    }
  }

  function celebrate() {
    resizeConfetti();
    const r = wrap.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    emit(0, ch * 0.75, -Math.PI / 3, 0.7, 110, 700, 1300);
    emit(cw, ch * 0.75, -Math.PI * 2 / 3, 0.7, 110, 700, 1300);
    emit(cx, cy, -Math.PI / 2, TAU, 90, 250, 750);
    setTimeout(() => {
      emit(cw * 0.25, -20, Math.PI / 2, 1.2, 60, 100, 300);
      emit(cw * 0.75, -20, Math.PI / 2, 1.2, 60, 100, 300);
    }, 300);
    if (!confettiRunning) {
      confettiRunning = true;
      let last = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        stepConfetti(dt);
        if (particles.length) requestAnimationFrame(loop);
        else { confettiRunning = false; cctx.clearRect(0, 0, cw, ch); }
      };
      requestAnimationFrame(loop);
    }
  }

  function stepConfetti(dt) {
    const gravity = 1100;
    const drag = Math.pow(0.985, dt * 60);
    cctx.clearRect(0, 0, cw, ch);
    const alive = [];
    for (const p of particles) {
      p.vx *= drag;
      p.vy = p.vy * drag + gravity * dt * 0.6;
      if (p.vy > 420) p.vy = 420; // vitesse terminale : chute flottante
      p.sway += dt * 3;
      p.x += (p.vx + Math.sin(p.sway) * 40) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.flip += p.vf * dt;
      if (p.y > ch + 30 || p.x < -60 || p.x > cw + 60) continue;
      alive.push(p);

      cctx.save();
      cctx.translate(p.x, p.y);
      cctx.rotate(p.rot);
      cctx.scale(1, Math.cos(p.flip));
      cctx.fillStyle = p.color;
      if (p.round) {
        cctx.beginPath();
        cctx.arc(0, 0, p.h * 0.7, 0, TAU);
        cctx.fill();
      } else {
        cctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      cctx.restore();
    }
    particles = alive;
  }

  // ---------- List interactions ----------
  const itemOf = (el) => state.items.find((x) => x.id === el.closest('.item').dataset.id);

  listEl.addEventListener('change', (e) => {
    if (spinning || e.target.type !== 'checkbox') return;
    const it = itemOf(e.target);
    if (it) { it.on = e.target.checked; update(); }
  });

  listEl.addEventListener('click', (e) => {
    if (spinning) return;
    const btn = e.target.closest('button');
    if (!btn) return;
    const it = itemOf(btn);
    if (!it) return;
    if (btn.classList.contains('del')) {
      state.items = state.items.filter((x) => x !== it);
      state.team = state.team.filter((p) => p.id !== it.id);
    } else if (btn.dataset.act === 'inc') {
      it.count = Math.min(MAX_COPIES, it.count + 1);
    } else if (btn.dataset.act === 'dec') {
      it.count = Math.max(1, it.count - 1);
    } else {
      return;
    }
    update();
  });

  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (spinning) return;
    const names = addInput.value.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    for (const name of names) {
      const existing = state.items.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        // Déjà présent : en mode entrées multiples, on ajoute un exemplaire.
        if (state.multi && existing.on) existing.count = Math.min(MAX_COPIES, existing.count + 1);
        existing.on = true;
      } else {
        state.items.push({ id: uid(), name: name.slice(0, 60), on: true, count: 1 });
      }
    }
    addInput.value = '';
    update();
    listEl.scrollTop = listEl.scrollHeight;
  });

  $('allBtn').addEventListener('click', () => {
    if (spinning) return;
    const inTeam = new Set(state.team.map((p) => p.id));
    state.items.forEach((x) => { x.on = !(state.teamMode && inTeam.has(x.id)); });
    update();
  });
  $('noneBtn').addEventListener('click', () => {
    if (spinning) return;
    state.items.forEach((x) => { x.on = false; });
    update();
  });
  $('shuffleBtn').addEventListener('click', () => {
    if (spinning) return;
    const a = state.items;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    update();
  });
  $('resetBtn').addEventListener('click', () => {
    if (spinning) return;
    if (!confirm('Restaurer la liste de noms par défaut ? Les éléments ajoutés et l\'équipe en cours seront supprimés.')) return;
    state.items = defaults().items;
    state.team = [];
    highlight = null;
    update();
  });

  // ---------- Options ----------
  function syncRange(input, out, suffix) {
    out.textContent = `${input.value}${suffix}`;
    const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--p', `${pct}%`);
  }

  durationInput.value = state.duration;
  teamSizeInput.value = state.teamSize;
  teamOpt.checked = state.teamMode;
  multiOpt.checked = state.multi;
  soundOpt.checked = state.sound;
  removeOpt.checked = state.removeWinner;
  teamSizeOpt.hidden = !state.teamMode;
  syncRange(durationInput, durationOut, ' s');
  syncRange(teamSizeInput, teamSizeOut, '');

  durationInput.addEventListener('input', () => {
    state.duration = Number(durationInput.value);
    syncRange(durationInput, durationOut, ' s');
    save();
  });
  teamSizeInput.addEventListener('input', () => {
    state.teamSize = Number(teamSizeInput.value);
    syncRange(teamSizeInput, teamSizeOut, '');
    save();
    renderTeam();
  });
  teamOpt.addEventListener('change', () => {
    state.teamMode = teamOpt.checked;
    teamSizeOpt.hidden = !state.teamMode;
    update();
  });
  multiOpt.addEventListener('change', () => {
    if (spinning) { multiOpt.checked = state.multi; return; }
    state.multi = multiOpt.checked;
    highlight = null;
    update();
  });
  soundOpt.addEventListener('change', () => { state.sound = soundOpt.checked; save(); });
  removeOpt.addEventListener('change', () => { state.removeWinner = removeOpt.checked; save(); });

  // ---------- Global ----------
  spinBtn.addEventListener('click', spin);

  document.addEventListener('keydown', (e) => {
    if (match.classList.contains('open')) {
      if (e.key === 'Escape') { e.preventDefault(); closeMatch(false); }
      return;
    }
    if (modal.classList.contains('open')) {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeModal(false); }
      return;
    }
    const tag = document.activeElement && document.activeElement.tagName;
    if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'BUTTON') {
      e.preventDefault();
      spin();
    }
  });

  new ResizeObserver(() => drawWheel()).observe(wrap);
  window.addEventListener('resize', () => { if (confettiRunning) resizeConfetti(); });

  update();
})();
