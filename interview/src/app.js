/*
 * Raj's Clone Stack: the UI. The rules (XP, richness, fidelity, badges, export format) live in
 * StackCore, compiled from lib/interview/core.ts, so the server validates exactly what this exports.
 * Plain browser JS on purpose: this file has to run from file:// with no network and no build step
 * on Raj's side.
 */
;(function () {
  'use strict'

  var C = window.StackCore
  var DATA = JSON.parse(document.getElementById('stack-data').textContent)
  var BANK = DATA.questions
  var TOPICS = DATA.topics
  var TOPIC_BY_ID = {}
  TOPICS.forEach(function (t) { TOPIC_BY_ID[t.id] = t })
  var STORAGE_KEY = 'raj-clone-stack:v1'
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)')
  var IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  var SAVE_KEYS = IS_MAC ? '⌘↵' : 'Ctrl+↵'
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null
  var LIGHTNING_SECONDS = 30
  var LIGHTNING_CARDS = 12

  // ── Utilities ─────────────────────────────────────────────────────────────

  function $(sel, root) { return (root || document).querySelector(sel) }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)) }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    })
  }
  function nowIso() { return new Date().toISOString() }
  function today() { return C.localDayKey(new Date()) }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')) }
  function pct(x) { return Math.round(x * 100) + '%' }
  function shuffle(arr) {
    var a = arr.slice()
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1))
      var t = a[i]; a[i] = a[j]; a[j] = t
    }
    return a
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) { try { return crypto.randomUUID() } catch (e) { /* insecure context */ } }
    var b = new Uint8Array(16)
    crypto.getRandomValues(b)
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1) }).join('')
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20)
  }
  function fmtDate(iso) {
    if (!iso) return 'never'
    var d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }

  // ── Pixel art: 1-bit bitmaps drawn as SVG paths ───────────────────────────

  var PX = {
    cloud: ['............', '............', '....###.....', '...#...#....', '..#.....###.', '.##........#', '#..........#', '#..........#', '.##########.', '............', '............', '............'],
    card: ['.########...', '.#......##..', '.#......#.#.', '.#.####.####', '.#.........#', '.#.######..#', '.#.........#', '.#.#####...#', '.#.........#', '.#.######..#', '.#.........#', '.###########'],
    book: ['............', '.####..####.', '#....##....#', '#.##.##.##.#', '#....##....#', '#.##.##.##.#', '#....##....#', '#.##.##.##.#', '#....##....#', '#####..#####', '.....##.....', '............'],
    speech: ['.##########.', '#..........#', '#....##....#', '#....##....#', '#....##....#', '#....##....#', '#..........#', '#....##....#', '.####.#####.', '....#.#.....', '....##......', '............'],
    anchor: ['.....##.....', '....#..#....', '....#..#....', '.....##.....', '..########..', '.....##.....', '.....##.....', '.#...##...#.', '.##..##..##.', '..##.##.##..', '...######...', '.....##.....'],
    bolt: ['.......###..', '......###...', '.....###....', '....###.....', '...########.', '......####..', '.....####...', '....###.....', '...###......', '..##........', '.##.........', '.#..........'],
    sign: ['.....##.....', '.#########..', '.#.......##.', '.#########..', '.....##.....', '..#########.', '.##.......#.', '..#########.', '.....##.....', '.....##.....', '.....##.....', '...######...'],
    column: ['############', '.##########.', '..#.#..#.#..', '..#.#..#.#..', '..#.#..#.#..', '..#.#..#.#..', '..#.#..#.#..', '..#.#..#.#..', '..#.#..#.#..', '.##########.', '############', '............'],
    layers: ['..########..', '..#......#..', '..########..', '............', '.##########.', '.#........#.', '.##########.', '............', '############', '#..........#', '############', '............'],
    moon: ['....####....', '..###.......', '.###.....#..', '.##.....###.', '###......#..', '###.........', '###.........', '###.........', '.###.......#', '.####....##.', '..#########.', '....####....'],
    sun: ['.....##.....', '.#...##...#.', '..#......#..', '....####....', '...#....#...', '##.#....#.##', '##.#....#.##', '...#....#...', '....####....', '..#......#..', '.#...##...#.', '.....##.....'],
    books: ['............', '.#########..', '.#.#.....#..', '.#########..', '..#########.', '..#.#.....#.', '..#########.', '.##########.', '.#.#......#.', '.##########.', '............', '............'],
    flame: ['.....#......', '....##......', '....###.....', '...####..#..', '...#####.##.', '..#########.', '..####.####.', '.####...###.', '.###.....##.', '.###.....##.', '..###...##..', '...######...'],
    half: ['....####....', '..##..####..', '.#....#####.', '.#....#####.', '#.....######', '#.....######', '#.....######', '#.....######', '.#....#####.', '.#....#####.', '..##..####..', '....####....'],
    floppy: ['###########.', '#.#......#.#', '#.#......#.#', '#.#......#.#', '#.########.#', '#..........#', '#.########.#', '#.#......#.#', '#.#.####.#.#', '#.#......#.#', '#.#......#.#', '############'],
    seed: ['..##....##..', '.####..####.', '.#####.####.', '..####.###..', '....##.#....', '.....##.....', '.....#......', '.....#......', '.....#......', '..########..', '.#........#.', '############'],
    gear: ['.....##.....', '..#.####.#..', '.##########.', '..###..###..', '.###....###.', '####....####', '####....####', '.###....###.', '..###..###..', '.##########.', '..#.####.#..', '.....##.....'],
    chip: ['...#..#..#..', '...#..#..#..', '.##########.', '.#........#.', '##.######.##', '.#.#....#.#.', '##.#.##.#.##', '.#.#....#.#.', '##.######.##', '.#........#.', '.##########.', '...#..#..#..'],
    flag: ['.##.........', '.#######....', '.#########..', '.##########.', '.#########..', '.#######....', '.##.........', '.##.........', '.##.........', '.##.........', '.##.........', '####........'],
    swords: ['#..........#', '.#........#.', '..#......#..', '...#....#...', '....#..#....', '.....##.....', '.....##.....', '....#..#....', '..###..###..', '..##....##..', '.#.#....#.#.', '#..........#'],
    bomb: ['.........#..', '........#.#.', '.......#....', '....####....', '..########..', '.####.#####.', '.###.######.', '############', '############', '.##########.', '..########..', '....####....'],
    cup: ['...#..#.....', '....#..#....', '...#..#.....', '............', '#########...', '#.......####', '#.......#..#', '#.......#..#', '#.......####', '.#.....#....', '..#####.....', '############'],
    up: ['.....##.....', '....####....', '...######...', '..########..', '.##########.', '....####....', '....####....', '....####....', '....####....', '....####....', '............', '############'],
    heart: ['............', '.###....###.', '#####..#####', '############', '############', '############', '.##########.', '..########..', '...######...', '....####....', '.....##.....', '............'],
    pencil: ['.........##.', '........#..#', '.......#..#.', '......#..#..', '.....#..#...', '....#..#....', '...#..#.....', '..#..#......', '.#.##.......', '.##.........', '###.........', '............'],
    star: ['.....##.....', '.....##.....', '....####....', '############', '.##########.', '..########..', '...######...', '..###..###..', '..##....##..', '.##......##.', '............', '............'],
    staro: ['.....##.....', '....#..#....', '....#..#....', '####....####', '#..........#', '.#........#.', '..#......#..', '..#..##..#..', '.#..#..#..#.', '.#.#....#.#.', '.##......##.', '............'],
    mic: ['....####....', '...#....#...', '...#....#...', '...#....#...', '...#....#...', '.#.#....#.#.', '.#..####..#.', '..#......#..', '...######...', '.....##.....', '.....##.....', '...######...'],
    lock: ['............', '....####....', '...#....#...', '...#....#...', '..########..', '..#......#..', '..#..##..#..', '..#..##..#..', '..#......#..', '..########..', '............', '............'],
    left: ['............', '.....#......', '....##......', '...#.#######', '..#........#', '.#.........#', '..#........#', '...#.#######', '....##......', '.....#......', '............', '............'],
    home: ['.....##.....', '....####....', '...#....#...', '..#......#..', '.#........#.', '############', '.#........#.', '.#.##..##.#.', '.#.##..##.#.', '.#........#.', '.#....##..#.', '.##########.'],
    dice: ['############', '#..........#', '#.##....##.#', '#.##....##.#', '#..........#', '#....##....#', '#....##....#', '#..........#', '#.##....##.#', '#.##....##.#', '#..........#', '############'],
    lens: ['..####......', '.#....#.....', '#......#....', '#......#....', '#......#....', '#......#....', '.#....##....', '..#####.#...', '.......#.#..', '........#.#.', '.........#.#', '..........#.'],
    mail: ['............', '############', '##........##', '#.#......#.#', '#..#....#..#', '#...#..#...#', '#....##....#', '#..........#', '#..........#', '############', '............', '............'],
    clock: ['...######...', '..#......#..', '.#...#....#.', '#....#.....#', '#....#.....#', '#....####..#', '#..........#', '#..........#', '.#........#.', '..#......#..', '...######...', '............'],
    plus: ['............', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '.##########.', '.##########.', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '............'],
    mac: ['..########..', '..#......#..', '..#.####.#..', '..#.#..#.#..', '..#.#..#.#..', '..#.####.#..', '..#......#..', '..#.##...#..', '..#......#..', '..########..', '..#......#..', '..########..'],
    disk: ['............', '............', '############', '#..........#', '#..........#', '#.##.......#', '#..........#', '############', '.#........#.', '............', '............', '............'],
    printer: ['...######...', '...#....#...', '...#....#...', '############', '#..........#', '#........#.#', '#..........#', '############', '..#......#..', '..########..', '............', '............'],
    mainframe: ['############', '#.##.#..#..#', '#.##.#..#..#', '#....#..#..#', '#.##.#..#..#', '#.##.#..#..#', '#....#..#..#', '#.##.#..#..#', '#....#..#..#', '############', '.#........#.', '............'],
    check: ['............', '..........##', '.........##.', '........##..', '.......##...', '##....##....', '.##..##.....', '..####......', '...##.......', '............', '............', '............'],
  }
  PX.right = PX.left.map(function (r) { return r.split('').reverse().join('') })

  var HAND = [
    '.....##.........', '....#oo#........', '....#oo#........', '....#oo#........', '....#oo###......', '....#oo#oo###...',
    '....#oo#oo#oo##.', '.##.#oo#oo#oo#o#', '#oo##oooooooooo#', '#ooo#oooooooooo#', '.#oooooooooooo#.', '..#ooooooooooo#.',
    '..#oooooooooo#..', '...#ooooooooo#..', '....#oooooooo#..', '....##########..',
  ]

  function pathFor(rows, ch) {
    var d = ''
    rows.forEach(function (row, y) {
      var x = 0
      while (x < row.length) {
        if (row[x] === ch) {
          var e = x
          while (e < row.length && row[e] === ch) e++
          d += 'M' + x + ' ' + y + 'h' + (e - x) + 'v1h' + (x - e) + 'z'
          x = e
        } else x++
      }
    })
    return d
  }

  var PX_CACHE = {}
  function pix(name, cls) {
    var key = name + '|' + (cls || '')
    if (PX_CACHE[key]) return PX_CACHE[key]
    var rows = PX[name]
    if (!rows) return ''
    var svg = '<svg class="px ' + (cls || '') + '" viewBox="0 0 ' + rows[0].length + ' ' + rows.length + '" aria-hidden="true" focusable="false"><path d="' + pathFor(rows, '#') + '"/></svg>'
    PX_CACHE[key] = svg
    return svg
  }

  ;(function installHandCursor() {
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 16 16' shape-rendering='crispEdges'>" +
      "<path fill='white' d='" + pathFor(HAND, 'o') + "'/><path d='" + pathFor(HAND, '#') + "'/></svg>"
    document.documentElement.style.setProperty('--cursor-hand', 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") 8 0, pointer')
  })()

  var TOPIC_ICON = {
    origins: 'seed', principles: 'column', decisions: 'sign', engineering: 'gear', ai: 'chip', leadership: 'flag',
    conflict: 'swords', failure: 'bomb', 'work-style': 'cup', career: 'up', stories: 'book', life: 'heart',
    lightning: 'bolt', notes: 'pencil',
  }
  var BADGE_ICON = {
    'first-card': 'card', storyteller: 'book', opinionated: 'speech', 'deep-diver': 'anchor', 'lightning-rod': 'bolt',
    'scenario-solver': 'sign', philosopher: 'column', 'full-stack': 'layers', 'night-owl': 'moon', 'early-bird': 'sun',
    bookworm: 'books', 'on-a-roll': 'flame', 'half-raj': 'half', 'fed-the-clone': 'floppy',
  }
  var LEVEL_ICON = ['card', 'floppy', 'disk', 'mac', 'printer', 'mainframe', 'chip', 'gear', 'column', 'half']
  var TYPE_LABEL = { open: 'Open', story: 'Story', scenario: 'Scenario', 'this-or-that': 'This or that', scale: 'Scale', rapid: 'Rapid' }

  // ── State ─────────────────────────────────────────────────────────────────

  var storageOk = true
  try {
    localStorage.setItem('raj-clone-stack:probe', '1')
    localStorage.removeItem('raj-clone-stack:probe')
  } catch (e) { storageOk = false }

  function readStored() {
    if (!storageOk) return C.emptyState(nowIso())
    try {
      var raw = localStorage.getItem(STORAGE_KEY)
      return C.normalizeState(raw ? JSON.parse(raw) : null, nowIso())
    } catch (e) {
      return C.emptyState(nowIso())
    }
  }

  var S = readStored()
  var CARDS = []
  var CARD_BY_ID = {}
  function refreshCards() {
    CARDS = C.allCards(BANK, S)
    CARD_BY_ID = {}
    CARDS.forEach(function (c) { CARD_BY_ID[c.id] = c })
  }
  refreshCards()

  var saveTimer = null
  var lastWrite = ''
  function persistNow() {
    clearTimeout(saveTimer)
    saveTimer = null
    if (!storageOk) { setAutosave('blocked'); return }
    try {
      lastWrite = JSON.stringify(S)
      localStorage.setItem(STORAGE_KEY, lastWrite)
      setAutosave('saved')
    } catch (e) {
      storageOk = false
      $('#storage-warning').hidden = false
      setAutosave('blocked')
    }
  }
  function persist() {
    clearTimeout(saveTimer)
    setAutosave('saving')
    saveTimer = setTimeout(persistNow, 350)
  }
  window.addEventListener('pagehide', persistNow)
  document.addEventListener('visibilitychange', function () { if (document.hidden) persistNow() })
  window.addEventListener('storage', function (e) {
    if (e.key !== STORAGE_KEY || !e.newValue || e.newValue === lastWrite) return
    try {
      S = C.normalizeState(JSON.parse(e.newValue), nowIso())
      refreshCards()
      toast({ title: 'Updated from another tab', body: 'The stack is open in two tabs. Showing the latest answers.', icon: 'cloud' })
      if (route.view !== 'card' && route.view !== 'lightning') render()
      renderStatus()
    } catch (err) { /* ignore a half-written value */ }
  })

  function xpNow() { return C.totalXp(S, CARDS) }
  function answered(id) { return C.isAnswered(S, id) }
  function flags(id) { return S.flags[id] || {} }
  function setFlag(id, patch) { S.flags[id] = Object.assign({}, S.flags[id] || {}, patch) }
  function addActiveDay() {
    var d = today()
    if (S.activeDays.indexOf(d) < 0) S.activeDays.push(d)
  }

  // ── Toasts and feedback ──────────────────────────────────────────────────

  function toast(opts) {
    var box = $('#toasts')
    var el = document.createElement('div')
    el.className = 'toast' + (opts.big ? ' big' : '')
    el.innerHTML = (opts.icon ? '<div class="toast-art">' + pix(opts.icon, 'lg') + '</div>' : '') +
      '<div><div class="toast-title">' + esc(opts.title) + '</div>' + (opts.body ? '<div class="toast-body">' + esc(opts.body) + '</div>' : '') + '</div>'
    box.appendChild(el)
    while (box.children.length > 4) box.removeChild(box.firstChild)
    setTimeout(function () {
      el.classList.add('leaving')
      setTimeout(function () { el.remove() }, REDUCED.matches ? 0 : 240)
    }, opts.ms || 4800)
  }

  function floatXp(n, anchor) {
    if (!n || REDUCED.matches) return
    var r = anchor ? anchor.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0 }
    var el = document.createElement('div')
    el.className = 'xp-float'
    el.setAttribute('aria-hidden', 'true')
    el.textContent = '+' + n + ' XP'
    el.style.left = Math.max(8, r.left + r.width / 2 - 36) + 'px'
    el.style.top = Math.max(40, r.top - 34) + 'px'
    document.body.appendChild(el)
    setTimeout(function () { el.remove() }, 1200)
  }

  function stamp(text) {
    var win = $('#view .window')
    if (!win || REDUCED.matches) return
    var el = document.createElement('div')
    el.className = 'stamp'
    el.setAttribute('aria-hidden', 'true')
    el.textContent = text
    win.appendChild(el)
    setTimeout(function () { el.remove() }, 950)
  }

  /** After anything that can earn XP: badges, level-ups, status. */
  function celebrate(xpBefore, ctx) {
    var gained = xpNow() - xpBefore
    var lvBefore = C.levelFor(xpBefore)
    var lvAfter = C.levelFor(xpNow())
    ctx = Object.assign({ today: today() }, ctx || {})
    var fresh = C.newBadges(S, CARDS, ctx)
    fresh.forEach(function (id) {
      S.badges[id] = nowIso()
      var def = C.BADGES.filter(function (b) { return b.id === id })[0]
      toast({ title: 'Badge: ' + def.name, body: def.desc, icon: BADGE_ICON[id], ms: 6000 })
    })
    if (lvAfter.index > lvBefore.index) {
      toast({ title: 'Level up! You are now ' + lvAfter.name, body: lvAfter.tagline, icon: LEVEL_ICON[lvAfter.index], big: true, ms: 7000 })
    }
    if (fresh.length) persistNow()
    renderStatus()
    return gained
  }

  // ── Status bar ────────────────────────────────────────────────────────────

  var statusTimer = null
  function renderStatusSoon() {
    if (statusTimer) return
    statusTimer = setTimeout(function () { statusTimer = null; renderStatus() }, 250)
  }
  function renderStatus() {
    var xp = xpNow()
    var lv = C.levelFor(xp)
    var streak = C.currentStreak(S.activeDays, today())
    var un = C.unexportedIds(S, CARDS).length
    $('#status').innerHTML =
      '<span class="stat hide-sm" title="Clone fidelity">' + pix('half', 'sm') + pct(C.fidelity(S, CARDS)) + '</span>' +
      '<span class="stat hide-sm" title="Level">' + pix(LEVEL_ICON[lv.index], 'sm') + esc(lv.name) + ' · ' + xp + ' XP</span>' +
      '<span class="stat hide-sm" title="Daily streak">' + pix('flame', 'sm') + plural(streak, 'day') + '</span>' +
      '<button type="button" class="unexported-btn' + (un ? '' : ' zero') + '" data-action="export" title="Answers not yet exported">' +
      (un ? un + ' unexported' : 'All exported') + '</button>'
  }

  // ── Routing and HyperCard visual effects ─────────────────────────────────

  var route = { view: 'home' }

  function show(html, effect) {
    var view = $('#view')
    view.innerHTML = html
    var el = view.firstElementChild
    if (el && effect && !REDUCED.matches) {
      el.classList.add('fx-' + effect)
      el.addEventListener('animationend', function () { el.classList.remove('fx-' + effect) }, { once: true })
    }
  }

  function go(next, effect) {
    leaveCard()
    stopLightning()
    route = next
    render(effect)
    window.scrollTo(0, 0)
  }

  function render(effect) {
    closeMenus()
    if (route.view === 'home') show(viewHome(), effect)
    else if (route.view === 'card') { show(viewCard(), effect); enterCard() }
    else if (route.view === 'done') show(viewDone(), effect)
    else if (route.view === 'revisit') show(viewRevisit(), effect)
    else if (route.view === 'lightning') show(viewLightning(), effect)
    renderStatus()
    updateCardMenu()
    if (route.view === 'card' && document.activeElement && $('#view').contains(document.activeElement)) return
    var focusTarget = $('#view [data-autofocus]') || (route.view === 'card' ? $('#card-prompt') : null) || $('#main')
    if (focusTarget) focusTarget.focus({ preventScroll: true })
  }

  function titlebar(title, pos, closeAction) {
    return '<div class="titlebar">' +
      (closeAction ? '<button type="button" class="close-box" data-action="' + closeAction + '" aria-label="Close, back to Home"></button>' : '') +
      '<div class="stripes"><span class="title">' + esc(title) + (pos ? '<span class="pos">' + esc(pos) + '</span>' : '') + '</span></div></div>'
  }

  // ── Home ──────────────────────────────────────────────────────────────────

  function gauge(f) {
    var cx = 60, cy = 58, R = 50, r = 34
    var a = Math.PI * (1 - Math.min(1, Math.max(0, f)))
    function pt(rad, ang) { return (cx + rad * Math.cos(ang)).toFixed(2) + ' ' + (cy - rad * Math.sin(ang)).toFixed(2) }
    var band = f > 0
      ? '<path d="M' + pt(R, Math.PI) + ' A' + R + ' ' + R + ' 0 0 1 ' + pt(R, a) + ' L' + pt(r, a) + ' A' + r + ' ' + r + ' 0 0 0 ' + pt(r, Math.PI) + ' Z" fill="url(#chk)" stroke="#000" stroke-width="1"/>'
      : ''
    var ticks = ''
    for (var i = 0; i <= 4; i++) {
      var t = Math.PI * (1 - i / 4)
      ticks += '<line x1="' + (cx + (R + 2) * Math.cos(t)).toFixed(2) + '" y1="' + (cy - (R + 2) * Math.sin(t)).toFixed(2) + '" x2="' + (cx + (R + 7) * Math.cos(t)).toFixed(2) + '" y2="' + (cy - (R + 7) * Math.sin(t)).toFixed(2) + '" stroke="#000" stroke-width="2"/>'
    }
    return '<svg viewBox="0 0 120 86" role="img" aria-label="Clone fidelity ' + pct(f) + '">' +
      '<defs><pattern id="chk" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="1" height="1"/><rect x="1" y="1" width="1" height="1"/></pattern></defs>' +
      '<path d="M' + pt(R, Math.PI) + ' A' + R + ' ' + R + ' 0 0 1 ' + pt(R, 0) + ' L' + pt(r, 0) + ' A' + r + ' ' + r + ' 0 0 0 ' + pt(r, Math.PI) + ' Z" fill="#fff" stroke="#000" stroke-width="1"/>' +
      band + ticks +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + pt(R - 4, a).split(' ')[0] + '" y2="' + pt(R - 4, a).split(' ')[1] + '" stroke="#000" stroke-width="3"/>' +
      '<rect x="' + (cx - 5) + '" y="' + (cy - 5) + '" width="10" height="10" fill="#fff" stroke="#000" stroke-width="2"/>' +
      '<text x="' + cx + '" y="' + (cy + 24) + '" text-anchor="middle" font-size="14">' + pct(f) + '</text></svg>'
  }

  function cardsIn(topic) { return CARDS.filter(function (c) { return c.topic === topic }) }

  function depthBars(cards) {
    var out = ''
    for (var d = 1; d <= 3; d++) {
      var ofDepth = cards.filter(function (c) { return c.depth === d })
      var done = ofDepth.filter(function (c) { return answered(c.id) }).length
      var h = 5 + d * 3
      out += '<i class="' + (ofDepth.length && done === ofDepth.length ? 'on' : '') + '" style="height:' + h + 'px" title="Depth ' + d + ': ' + done + '/' + ofDepth.length + '"></i>'
    }
    return '<span class="depth-bars" aria-hidden="true">' + out + '</span>'
  }

  function topicTile(t) {
    var cards = cardsIn(t.id)
    var cov = C.coverage(S, cards)
    var fresh = cards.filter(function (c) { return c.source === 'pack' && !answered(c.id) }).length
    var isNotes = t.id === 'notes'
    var done = cov.total > 0 && cov.answered === cov.total
    var sub = isNotes ? (cards.length ? plural(cards.length, 'card') + ' you wrote' : 'Write your own card') : cov.answered + ' / ' + cov.total + ' answered'
    return '<button type="button" class="topic' + (done ? ' done' : '') + '" data-action="' + (isNotes && !cards.length ? 'add-card' : 'topic') + '" data-topic="' + t.id + '" ' +
      'aria-label="' + esc(t.label) + ': ' + sub + (isNotes ? '' : ', ' + pct(cov.weighted) + ' depth-weighted coverage') + (fresh ? ', ' + fresh + ' new' : '') + '">' +
      '<span class="topic-head">' + pix(TOPIC_ICON[t.id] || 'card') + '<span class="topic-name">' + esc(t.label) + '</span>' +
      (fresh ? '<span class="new-dot">' + fresh + ' new</span>' : '') + (isNotes ? pix('plus', 'sm') : depthBars(cards)) + '</span>' +
      '<span class="topic-blurb">' + esc(isNotes ? 'Things we didn’t ask. Write a prompt and answer it in your own words.' : t.blurb) + '</span>' +
      '<span class="topic-foot">' +
      (isNotes ? '' : '<span class="meter thin" aria-hidden="true"><span class="' + (cov.weighted >= 1 ? 'full' : '') + '" style="width:' + pct(cov.weighted) + '"></span></span>') +
      '<span class="topic-stats"><span>' + esc(sub) + '</span><span>' + (isNotes ? '' : pct(cov.weighted)) + '</span></span></span></button>'
  }

  function viewHome() {
    var xp = xpNow()
    var lv = C.levelFor(xp)
    var f = C.fidelity(S, CARDS)
    var streak = C.currentStreak(S.activeDays, today())
    var answeredToday = S.activeDays.indexOf(today()) >= 0
    var un = C.unexportedIds(S, CARDS).length
    var total = CARDS.filter(function (c) { return c.source !== 'custom' }).length
    var nAnswered = CARDS.filter(function (c) { return answered(c.id) }).length
    var unansweredNonRapid = CARDS.filter(function (c) { return !answered(c.id) && c.type !== 'rapid' }).length
    var deepLeft = CARDS.filter(function (c) { return c.depth === 3 && !answered(c.id) && c.type !== 'rapid' }).length
    var rapidCount = CARDS.filter(function (c) { return c.type === 'rapid' }).length
    var revisitCount = CARDS.filter(function (c) { return answered(c.id) || flags(c.id).starred }).length
    var newCount = CARDS.filter(function (c) { return c.source === 'pack' && !answered(c.id) }).length
    var snoozedCount = CARDS.filter(function (c) { return flags(c.id).snoozedAt && !answered(c.id) }).length
    var levelSpan = lv.next === null ? 1 : (xp - lv.min) / (lv.next - lv.min)

    var modes =
      mode('mode-shuffle', 'dice', 'Shuffle', unansweredNonRapid ? 'A random card you haven’t answered (' + unansweredNonRapid + ' left)' : 'Everything answered. Wow.', false) +
      mode('mode-deep', 'anchor', 'Deep dive', deepLeft ? 'Only the hardest, depth-3 cards (' + deepLeft + ' left)' : 'All deep cards answered', false) +
      mode('mode-lightning', 'bolt', 'Lightning round', rapidCount + ' rapid cards, 30 seconds each. Keep the streak.', false) +
      mode('mode-revisit', 'lens', 'Revisit', revisitCount ? plural(revisitCount, 'answered or starred card') + ' to refine' : 'Answers you’ve given show up here', false) +
      (newCount ? mode('mode-new', 'mail', 'New cards', plural(newCount, 'follow-up') + ' from the agent', true) : '') +
      (snoozedCount ? mode('mode-snoozed', 'clock', 'Snoozed', plural(snoozedCount, 'card') + ' waiting for you', false) : '') +
      mode('add-card', 'plus', 'Add your own card', 'Something we didn’t ask? Write the prompt and the answer.', false)

    var badges = C.BADGES.map(function (b) {
      var got = !!S.badges[b.id]
      return '<li class="badge' + (got ? '' : ' locked') + '"><span class="medal" aria-hidden="true">' + pix(got ? BADGE_ICON[b.id] : 'lock', 'lg') + '</span>' +
        '<span class="badge-name">' + esc(b.name) + '<span class="sr-only">' + (got ? ', earned' : ', locked') + '</span></span><span class="badge-desc">' + esc(b.desc) + '</span></li>'
    }).join('')
    var earned = C.BADGES.filter(function (b) { return S.badges[b.id] }).length

    return '<div class="home">' +
      '<section class="window" aria-labelledby="home-title">' + titlebar('Raj’s Clone Stack') +
      '<div class="hero-body"><div class="hero-intro">' +
      '<h1 id="home-title" tabindex="-1" data-autofocus>Teach the clone how you think.</h1>' +
      '<p>Every card you answer becomes something your AI clone knows: your principles, your stories, your gut calls. Specifics make it sound like you.</p>' +
      '<p>Answer at your own pace. Everything saves as you type and stays on this computer until you export it.</p>' +
      '<div class="counts"><span>' + nAnswered + ' / ' + total + ' cards answered</span><span>' + plural(C.BADGES.length - earned, 'badge') + ' to find</span></div>' +
      '</div><div class="gauges">' +
      '<figure class="panel gauge"><span class="label">Clone fidelity</span>' + gauge(f) + '<figcaption class="small">Depth-weighted, and specific answers count more.</figcaption></figure>' +
      '<div class="panel level"><span class="label">Level ' + (lv.index + 1) + '</span>' + pix(LEVEL_ICON[lv.index], 'xl') +
      '<span class="level-name">' + esc(lv.name) + '</span><span class="small">' + esc(lv.tagline) + '</span>' +
      '<span class="meter" role="img" aria-label="' + xp + ' XP"><span style="width:' + pct(levelSpan) + '"></span></span>' +
      '<span class="small">' + (lv.next === null ? xp + ' XP. Max level.' : xp + ' / ' + lv.next + ' XP to ' + esc(C.LEVELS[lv.index + 1].name)) + '</span></div>' +
      '<div class="panel streak"><span class="label">Streak</span>' + pix('flame', 'xl') + '<span class="big">' + streak + '</span><span>' + (streak === 1 ? 'day' : 'days') + '</span>' +
      '<span class="small">' + (answeredToday ? 'Done for today. Nice.' : streak ? 'Answer one card today to keep it.' : 'Answer a card today to start one.') + '</span></div>' +
      '</div></div></section>' +
      (un >= 10 ? '<div class="reminder" role="note">' + pix('floppy', 'lg') + '<p><b>' + un + ' answers haven’t reached the clone yet.</b> Export them, then tell the agent you’re done answering.</p><button type="button" class="btn default" data-action="export">Export now</button></div>' : '') +
      '<section aria-labelledby="modes-h"><h2 class="section-h" id="modes-h"><span class="h-text">Play</span></h2><div class="mode-row">' + modes + '</div></section>' +
      '<section aria-labelledby="topics-h"><h2 class="section-h" id="topics-h"><span class="h-text">The stack</span></h2><div class="topic-grid">' + TOPICS.map(topicTile).join('') + '</div></section>' +
      '<section aria-labelledby="badges-h"><h2 class="section-h" id="badges-h"><span class="h-text">Badges <span class="count">' + earned + ' / ' + C.BADGES.length + '</span></span></h2><ul class="badges">' + badges + '</ul></section>' +
      '<section class="window" aria-labelledby="files-h">' + titlebar('File cabinet') + '<div class="files-body">' +
      '<h2 id="files-h" class="sr-only">Export, import and backup</h2>' +
      '<div class="files-row">' +
      '<button type="button" class="btn default" data-action="export">' + pix('floppy', 'sm') + 'Export answers…' + (un ? '<span class="count-badge">' + un + '</span>' : '') + '</button>' +
      '<button type="button" class="btn" data-action="import-pack">' + pix('mail', 'sm') + 'Import question pack…</button>' +
      '<button type="button" class="btn" data-action="backup">' + pix('disk', 'sm') + 'Backup all data</button>' +
      '<button type="button" class="btn" data-action="restore">Restore backup…</button></div>' +
      '<p class="privacy">' + pix('lock') + '<span>Your answers stay on this computer until you export them. Nothing is sent anywhere, and this page never loads anything from the internet. The export lands in Downloads; the agent moves it into the repo’s private folder, which is never committed.</span></p>' +
      '<div class="foot-meta"><span>Last export: ' + esc(fmtDate(S.lastExportAt)) + '</span><span>Question bank ' + esc(DATA.bankVersion) + ' · ' + BANK.length + ' questions</span>' +
      (S.packs.length ? '<span>' + plural(S.packs.length, 'pack') + ' imported</span>' : '') + '</div>' +
      '</div></section></div>'

    function mode(action, icon, name, sub, hot) {
      return '<button type="button" class="mode' + (hot ? ' hot' : '') + '" data-action="' + action + '">' + pix(icon) +
        '<span class="mode-name">' + esc(name) + '</span><span class="mode-sub">' + esc(sub) + '</span></button>'
    }
  }

  // ── Decks ─────────────────────────────────────────────────────────────────

  function buildDeck(mode) {
    var notRapid = function (c) { return c.type !== 'rapid' }
    var open = function (c) { return !answered(c.id) && !flags(c.id).snoozedAt }
    switch (mode.kind) {
      case 'topic': {
        var cards = cardsIn(mode.topic)
        var awake = cards.filter(function (c) { return !(flags(c.id).snoozedAt && !answered(c.id)) })
        var snoozed = cards.filter(function (c) { return flags(c.id).snoozedAt && !answered(c.id) })
        return awake.concat(snoozed).map(function (c) { return c.id })
      }
      case 'shuffle':
        return shuffle(CARDS.filter(function (c) { return notRapid(c) && open(c) })).map(function (c) { return c.id })
      case 'deep': {
        var deep = CARDS.filter(function (c) { return c.depth === 3 && notRapid(c) })
        return shuffle(deep.filter(open)).concat(deep.filter(function (c) { return !open(c) })).map(function (c) { return c.id })
      }
      case 'new':
        return CARDS.filter(function (c) { return c.source === 'pack' && !answered(c.id) }).map(function (c) { return c.id })
      case 'snoozed':
        return CARDS.filter(function (c) { return flags(c.id).snoozedAt && !answered(c.id) }).map(function (c) { return c.id })
      default:
        return mode.ids || []
    }
  }

  var MODE_TITLE = { shuffle: 'Shuffle', deep: 'Deep dive', new: 'New cards', snoozed: 'Snoozed', revisit: 'Revisit', single: 'Card' }
  function modeTitle(mode) {
    if (mode.kind === 'topic') return TOPIC_BY_ID[mode.topic] ? TOPIC_BY_ID[mode.topic].label : mode.topic
    return MODE_TITLE[mode.kind] || 'Stack'
  }

  function startDeck(mode, startId) {
    var deck = buildDeck(mode)
    if (!deck.length) {
      var empty = { shuffle: 'Every card is answered or snoozed. Try Revisit or a lightning round.', deep: 'No deep cards left.', new: 'No new cards. Import a question pack from the agent to get more.', snoozed: 'Nothing is snoozed.' }
      toast({ title: 'Nothing here yet', body: empty[mode.kind] || 'This stack is empty.', icon: 'cloud' })
      return
    }
    var idx = 0
    if (startId) idx = Math.max(0, deck.indexOf(startId))
    else if (mode.kind === 'topic') {
      var first = deck.findIndex(function (id) { return !answered(id) && !flags(id).snoozedAt })
      idx = first < 0 ? 0 : first
    }
    go({ view: 'card', mode: mode, deck: deck, idx: idx }, mode.kind === 'topic' ? 'iris' : 'wipe-left')
  }

  // ── Card view ─────────────────────────────────────────────────────────────

  var cardSession = null // { id, xpBefore, dirty }
  var digOpen = false
  var lastField = null

  function currentCard() {
    return route.view === 'card' ? CARD_BY_ID[route.deck[route.idx]] : null
  }

  function inputFor(card, a) {
    var t = card.type
    if (t === 'this-or-that') {
      var opts = card.options || ['', '']
      return '<fieldset class="tot"><legend class="sr-only">Pick one</legend>' +
        '<button type="button" class="choice" data-action="choose" data-choice="0" aria-pressed="' + (a.choice === opts[0]) + '">' + esc(opts[0]) + '</button>' +
        '<span class="or" aria-hidden="true">or</span>' +
        '<button type="button" class="choice" data-action="choose" data-choice="1" aria-pressed="' + (a.choice === opts[1]) + '">' + esc(opts[1]) + '</button></fieldset>' +
        '<div><label class="field-label" for="f-text">Why? The reason is the interesting part.</label>' +
        '<textarea id="f-text" class="answer why" data-field="text" aria-describedby="card-prompt" placeholder="Because…">' + esc(a.text) + '</textarea></div>'
    }
    if (t === 'scale') {
      var s = card.scale || { min: 1, max: 5, minLabel: 'Low', maxLabel: 'High' }
      var has = typeof a.value === 'number'
      var val = has ? a.value : Math.round((s.min + s.max) / 2)
      var ticks = ''
      for (var v = s.min; v <= s.max; v++) ticks += '<button type="button" class="tick" data-action="rate" data-value="' + v + '" aria-pressed="' + (has && a.value === v) + '" aria-label="Rate ' + v + '">' + v + '</button>'
      return '<div class="scale-box"><div class="scale-labels" aria-hidden="true"><span>' + s.min + ' · ' + esc(s.minLabel) + '</span><span>' + esc(s.maxLabel) + ' · ' + s.max + '</span></div>' +
        '<div class="scale-row"><div><label class="sr-only" for="f-value">Your rating from ' + s.min + ' (' + esc(s.minLabel) + ') to ' + s.max + ' (' + esc(s.maxLabel) + ')</label>' +
        '<input type="range" id="f-value" data-field="value" class="' + (has ? '' : 'unset') + '" min="' + s.min + '" max="' + s.max + '" step="1" value="' + val + '"></div>' +
        '<output id="scale-out" class="scale-out' + (has ? '' : ' unset') + '" for="f-value" aria-live="polite">' + (has ? a.value : '?') + '</output></div>' +
        '<div class="ticks">' + ticks + '</div></div>' +
        '<div><label class="field-label" for="f-text">Why that number?</label>' +
        '<textarea id="f-text" class="answer why" data-field="text" aria-describedby="card-prompt" placeholder="Because…">' + esc(a.text) + '</textarea></div>'
    }
    if (t === 'rapid') {
      return '<div><label class="field-label" for="f-text">Quick answer (Enter saves)</label>' +
        '<input type="text" id="f-text" class="answer" data-field="text" aria-describedby="card-prompt" autocomplete="off" maxlength="400" value="' + esc(a.text) + '"></div>'
    }
    var label = t === 'scenario' ? 'What would you do? Walk through it.' : t === 'story' ? 'Your story, in your words' : 'Your answer'
    var ph = t === 'story' ? 'It was…' : t === 'scenario' ? 'First, I would…' : ''
    var main = '<div><label class="field-label" for="f-text">' + label + '</label>' +
      '<textarea id="f-text" class="answer" data-field="text" aria-describedby="card-prompt" placeholder="' + ph + '">' + esc(a.text) + '</textarea></div>'
    if (t !== 'story') return main
    var parts = a.parts || {}
    var hasParts = C.STORY_PART_KEYS.some(function (k) { return parts[k] })
    var fields = C.STORY_PART_KEYS.map(function (k) {
      return '<label class="field-label">' + esc(C.STORY_PART_LABELS[k]) +
        '<textarea class="answer" data-field="part" data-part="' + k + '">' + esc(parts[k] || '') + '</textarea></label>'
    }).join('')
    return main + '<details class="scaffold"' + (hasParts ? ' open' : '') + '><summary>Stuck? Use the scaffold: situation · what you did · what happened · what you’d change</summary>' +
      '<div class="scaffold-grid">' + fields + '</div></details>'
  }

  function viewCard() {
    var card = currentCard()
    if (!card) return viewDone()
    var a = S.answers[card.id] || { text: '' }
    var topic = TOPIC_BY_ID[card.topic] || { label: card.topic }
    var fl = flags(card.id)
    var isNew = card.source === 'pack' && !answered(card.id)
    var pips = ''
    for (var d = 1; d <= 3; d++) pips += '<i class="' + (d <= card.depth ? 'on' : '') + '"></i>'
    var dig = (card.hint || (card.followUps && card.followUps.length) || card.why)
      ? '<div class="dig"><button type="button" class="link-btn" data-action="dig" aria-expanded="' + digOpen + '" aria-controls="dig-panel">' + (digOpen ? 'Dig deeper ▾' : 'Dig deeper ▸') + '</button>' +
        '<div id="dig-panel" class="dig-panel"' + (digOpen ? '' : ' hidden') + '>' +
        (card.hint ? '<p>' + esc(card.hint) + '</p>' : '') +
        (card.followUps && card.followUps.length ? '<p class="fu-h">If you want to go further:</p><ul>' + card.followUps.map(function (f) { return '<li>' + esc(f) + '</li>' }).join('') + '</ul>' : '') +
        (card.why ? '<p class="why"><b>Why we ask:</b> ' + esc(card.why) + '</p>' : '') +
        '</div></div>'
      : ''
    var atEnd = route.idx >= route.deck.length - 1
    return '<div class="page narrow"><div class="stack-wrap"><section class="window" aria-labelledby="card-prompt">' +
      titlebar(modeTitle(route.mode), 'card ' + (route.idx + 1) + ' of ' + route.deck.length, 'home') +
      '<div class="card-body">' +
      '<div class="card-meta"><span class="topic-chip">' + pix(TOPIC_ICON[card.topic] || 'card', 'sm') + esc(topic.label) + '</span>' +
      '<span class="type-badge">' + esc(TYPE_LABEL[card.type] || card.type) + '</span>' +
      '<span class="depth" role="img" aria-label="Depth ' + card.depth + ' of 3" title="Depth ' + card.depth + ' of 3">' + pips + '</span>' +
      (isNew ? '<span class="tag new">New</span>' : '') +
      (card.source === 'custom' ? '<span class="tag">Your card</span>' : '') +
      (fl.snoozedAt && !answered(card.id) ? '<span class="tag">Snoozed</span>' : '') +
      '<span class="grow"></span>' +
      '<button type="button" class="star" data-action="star" aria-pressed="' + !!fl.starred + '">' + pix(fl.starred ? 'star' : 'staro', 'sm') + (fl.starred ? 'Starred' : 'Star') + '</button>' +
      '</div>' +
      '<h1 class="prompt" id="card-prompt" tabindex="-1">' + esc(card.prompt) + '</h1>' + dig +
      '<div class="answer-area">' + inputFor(card, a) + '</div>' +
      '<div class="live" aria-live="off">' +
      '<span id="wc">0 words</span>' +
      (card.type === 'rapid' ? '' : '<span class="richness" id="rich"></span>') +
      '<span class="xp-preview" id="xp-preview" title="XP for this answer so far">+0 XP</span></div>' +
      '<div class="actions">' +
      (SR ? '<button type="button" class="btn mic" data-action="mic" aria-pressed="false">' + pix('mic', 'sm') + '<span>Dictate</span></button>' : '') +
      (card.source === 'custom' ? '<button type="button" class="btn small" data-action="delete-custom">Delete card</button>' : '') +
      '<span class="spacer"></span><span class="inline-msg" id="inline-msg" role="status"></span>' +
      '<button type="button" class="btn" data-action="skip">Skip</button>' +
      '<button type="button" class="btn" data-action="snooze">Snooze</button>' +
      '<button type="button" class="btn default" data-action="save-next">Save &amp; next<kbd aria-hidden="true">' + SAVE_KEYS + '</kbd></button>' +
      '</div></div>' +
      '<nav class="card-nav" aria-label="Card navigation">' +
      '<button type="button" class="nav-arrow" data-action="prev" aria-label="Previous card"' + (route.idx === 0 ? ' disabled' : '') + '>' + pix('left') + '</button>' +
      '<span class="mid"><span class="autosave" id="autosave">' + (storageOk ? 'Saved on this computer' : 'Not saved: storage is blocked') + '</span>' +
      '<button type="button" class="link-btn" data-action="home">' + pix('home', 'sm') + ' Home</button></span>' +
      '<button type="button" class="nav-arrow" data-action="next" aria-label="Next card"' + (atEnd ? ' disabled' : '') + '>' + pix('right') + '</button>' +
      '</nav></section></div></div>'
  }

  function enterCard() {
    var card = currentCard()
    if (!card) return
    cardSession = { id: card.id, xpBefore: xpNow(), dirty: false }
    lastField = $('#f-text')
    updateLive()
    var f = $('#f-text')
    if (f && window.matchMedia('(pointer: fine)').matches) {
      f.focus({ preventScroll: true })
      if (f.setSelectionRange) { try { f.setSelectionRange(f.value.length, f.value.length) } catch (e) { /* range input */ } }
    }
  }

  /** Called whenever we leave a card: counts the day, checks badges, shows XP. */
  function leaveCard(opts) {
    stopMic()
    if (!cardSession) return 0
    var sess = cardSession
    cardSession = null
    if (!sess.dirty) return 0
    var isAnswered = answered(sess.id)
    if (isAnswered) {
      addActiveDay()
      if (flags(sess.id).snoozedAt) setFlag(sess.id, { snoozedAt: null })
    }
    var gained = celebrate(sess.xpBefore, isAnswered ? { savedAtHour: new Date().getHours() } : {})
    persistNow()
    if (opts && opts.feedback && gained > 0) floatXp(gained, opts.anchor)
    return gained
  }

  function updateAnswer(patch) {
    var card = currentCard()
    if (!card) return
    var prev = S.answers[card.id]
    var next = Object.assign({ text: '' }, prev || {}, patch)
    if (C.isAnswerEmpty(next)) delete S.answers[card.id]
    else {
      var t = nowIso()
      next.answeredAt = (prev && prev.answeredAt) || t
      next.updatedAt = t
      S.answers[card.id] = next
    }
    if (cardSession) cardSession.dirty = true
    persist()
    updateLive()
  }

  function updateLive() {
    var card = currentCard()
    if (!card) return
    var a = S.answers[card.id]
    var words = C.answerWordCount(a)
    var wc = $('#wc')
    if (wc) wc.textContent = plural(words, 'word')
    var rich = $('#rich')
    if (rich) {
      var r = C.richness(C.answerProse(a))
      var segs = ''
      for (var i = 0; i < 5; i++) segs += '<i class="' + (words && i < r.level + 1 ? (i === r.level && r.level < 4 ? 'half' : 'on') : '') + '"></i>'
      rich.innerHTML = '<span>Richness</span><span class="segs" role="img" aria-label="Richness: ' + (words ? r.label : 'empty') + '">' + segs + '</span><span>' + (words ? esc(r.label) : '') + '</span>' +
        (r.tip ? '<span class="rich-tip">' + esc(r.tip) + '</span>' : '')
    }
    var xp = $('#xp-preview')
    if (xp) xp.textContent = '+' + C.xpFor(card, a) + ' XP'
    renderStatusSoon()
  }

  function setAutosave(state) {
    var el = $('#autosave')
    if (!el) return
    el.textContent = state === 'saving' ? 'Saving…' : state === 'blocked' ? 'Not saved: storage is blocked' : 'Saved on this computer'
  }

  function inlineMsg(text) {
    var el = $('#inline-msg')
    if (el) el.textContent = text
  }

  function nextIndex(preferUnanswered) {
    var deck = route.deck
    if (preferUnanswered) {
      for (var step = 1; step <= deck.length; step++) {
        var i = route.idx + step
        if (route.mode.kind !== 'topic' && i >= deck.length) break
        i = i % deck.length
        if (i === route.idx) break
        if (!answered(deck[i]) && !flags(deck[i]).snoozedAt) return i
      }
      if (route.mode.kind === 'topic') return -1
    }
    return route.idx + 1 < deck.length ? route.idx + 1 : -1
  }

  function moveTo(i, effect, feedback) {
    var anchor = $('[data-action="save-next"]')
    leaveCard({ feedback: feedback, anchor: anchor })
    if (i < 0) {
      route = { view: 'done', mode: route.mode, deck: route.deck }
      render('dissolve')
      return
    }
    route.idx = i
    render(effect)
  }

  function saveAndNext() {
    var card = currentCard()
    if (!card) return
    if (!answered(card.id)) {
      inlineMsg('Write something first, or Skip.')
      var f = $('#f-text')
      if (f) f.focus()
      return
    }
    stamp('SAVED')
    var anchor = $('[data-action="save-next"]')
    leaveCard({ feedback: true, anchor: anchor })
    var i = nextIndex(true)
    var delay = REDUCED.matches ? 0 : 420
    setTimeout(function () {
      if (i < 0) { route = { view: 'done', mode: route.mode, deck: route.deck }; render('dissolve') }
      else { route.idx = i; render('wipe-left') }
    }, delay)
  }

  function skipCard() {
    var card = currentCard()
    if (!card) return
    if (!answered(card.id)) { setFlag(card.id, { skippedAt: nowIso() }); persist() }
    moveTo(nextIndex(true), 'wipe-left')
  }

  function snoozeCard() {
    var card = currentCard()
    if (!card) return
    setFlag(card.id, { snoozedAt: nowIso() })
    persist()
    toast({ title: 'Snoozed', body: 'It’ll wait at the back of the stack. Find it under Go › Snoozed cards.', icon: 'clock' })
    moveTo(nextIndex(true), 'wipe-left')
  }

  function toggleStar() {
    var card = currentCard()
    if (!card) return
    var on = !flags(card.id).starred
    setFlag(card.id, { starred: on })
    if (answered(card.id)) S.answers[card.id].updatedAt = nowIso()
    persist()
    var b = $('[data-action="star"]', $('#view'))
    if (b) {
      b.setAttribute('aria-pressed', String(on))
      b.innerHTML = pix(on ? 'star' : 'staro', 'sm') + (on ? 'Starred' : 'Star')
    }
  }

  function toggleDig() {
    var panel = $('#dig-panel')
    var btn = $('[data-action="dig"]', $('#view'))
    if (!panel || !btn) return
    digOpen = panel.hidden
    panel.hidden = !digOpen
    btn.setAttribute('aria-expanded', String(digOpen))
    btn.textContent = digOpen ? 'Dig deeper ▾' : 'Dig deeper ▸'
  }

  function choose(i) {
    var card = currentCard()
    var opt = card.options[i]
    var cur = (S.answers[card.id] || {}).choice
    updateAnswer({ choice: cur === opt ? null : opt })
    $$('.choice').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.choice === String(i) && cur !== opt)) })
  }

  function rate(v) {
    updateAnswer({ value: v })
    var r = $('#f-value')
    if (r) { r.value = String(v); r.classList.remove('unset') }
    var out = $('#scale-out')
    if (out) { out.textContent = String(v); out.classList.remove('unset') }
    $$('.tick').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.value) === v)) })
  }

  // ── Voice dictation ───────────────────────────────────────────────────────

  var rec = null
  function stopMic() {
    if (rec) { try { rec.stop() } catch (e) { /* already stopped */ } }
  }
  function toggleMic() {
    if (!SR) return
    if (rec) { stopMic(); return }
    var field = lastField && document.body.contains(lastField) && lastField.tagName !== 'INPUT' ? lastField : $('#f-text')
    if (!field || field.type === 'range') field = $('#f-text')
    if (!field) return
    var btn = $('[data-action="mic"]')
    var base = field.value
    var sep = base && !/\s$/.test(base) ? ' ' : ''
    var finals = ''
    rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = navigator.language || 'en-US'
    rec.onresult = function (e) {
      var interim = ''
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var r = e.results[i]
        if (r.isFinal) finals += r[0].transcript
        else interim += r[0].transcript
      }
      field.value = base + sep + (finals + interim).replace(/^\s+/, '')
      field.dispatchEvent(new Event('input', { bubbles: true }))
    }
    rec.onerror = function (e) {
      var msg = e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'The microphone is blocked. Allow it in the browser’s site settings, or type instead.'
        : e.error === 'network' ? 'Dictation needs the browser’s speech service, which is offline right now.' : 'Dictation stopped (' + e.error + ').'
      toast({ title: 'Dictation', body: msg, icon: 'mic' })
    }
    rec.onend = function () {
      rec = null
      var b = $('[data-action="mic"]')
      if (b) { b.setAttribute('aria-pressed', 'false'); b.querySelector('span').textContent = 'Dictate' }
    }
    try {
      rec.start()
      if (btn) { btn.setAttribute('aria-pressed', 'true'); btn.querySelector('span').textContent = 'Listening… click to stop' }
    } catch (err) {
      rec = null
      toast({ title: 'Dictation', body: 'Couldn’t start the microphone.', icon: 'mic' })
    }
  }

  // ── Done ──────────────────────────────────────────────────────────────────

  function viewDone() {
    var mode = route.mode || { kind: 'shuffle' }
    var cards = (route.deck || []).map(function (id) { return CARD_BY_ID[id] }).filter(Boolean)
    var cov = C.coverage(S, cards)
    return '<div class="page narrow"><div class="stack-wrap"><section class="window" aria-labelledby="done-h">' + titlebar(modeTitle(mode), '', 'home') +
      '<div class="done-body">' + pix('check', 'xl') +
      '<h1 id="done-h" tabindex="-1" data-autofocus>End of this stack</h1>' +
      '<p>' + cov.answered + ' of ' + cov.total + ' cards here are answered. The clone is at ' + pct(C.fidelity(S, CARDS)) + ' fidelity.</p>' +
      '<div class="files-row">' +
      '<button type="button" class="btn default" data-action="home">' + pix('home', 'sm') + 'Home</button>' +
      '<button type="button" class="btn" data-action="mode-shuffle">Shuffle</button>' +
      '<button type="button" class="btn" data-action="mode-lightning">Lightning round</button>' +
      '<button type="button" class="btn" data-action="export">Export answers…</button></div>' +
      '</div></section></div></div>'
  }

  // ── Revisit ───────────────────────────────────────────────────────────────

  function revisitCards() {
    var filter = route.filter || 'all'
    var q = (route.q || '').toLowerCase()
    var list = CARDS.filter(function (c) {
      var fl = flags(c.id)
      if (filter === 'starred' && !fl.starred) return false
      if (filter === 'all' && !answered(c.id) && !fl.starred) return false
      if (filter === 'thin' && (!answered(c.id) || c.type === 'rapid' || C.richness(C.answerProse(S.answers[c.id])).level > 1)) return false
      if (!q) return true
      var a = S.answers[c.id]
      return (c.prompt + ' ' + (a ? C.answerProse(a) + ' ' + (a.choice || '') : '')).toLowerCase().indexOf(q) >= 0
    })
    list.sort(function (x, y) {
      var sx = flags(x.id).starred ? 1 : 0
      var sy = flags(y.id).starred ? 1 : 0
      if (sx !== sy) return sy - sx
      var ux = (S.answers[x.id] || {}).updatedAt || ''
      var uy = (S.answers[y.id] || {}).updatedAt || ''
      return ux < uy ? 1 : ux > uy ? -1 : 0
    })
    return list
  }

  function revisitRows() {
    var list = revisitCards()
    if (!list.length) return '<div class="empty">Nothing here yet. Answer a few cards, or star the ones you want to come back to.</div>'
    return '<ul class="rows">' + list.map(function (c) {
      var a = S.answers[c.id]
      var t = TOPIC_BY_ID[c.topic] || { label: c.topic }
      return '<li><button type="button" class="row-btn" data-action="open-revisit" data-id="' + esc(c.id) + '">' +
        pix(flags(c.id).starred ? 'star' : TOPIC_ICON[c.topic] || 'card', 'sm') +
        '<span class="row-topic">' + esc(t.label) + '</span><span class="row-prompt">' + esc(c.prompt) + '</span>' +
        '<span class="row-meta">' + (a ? plural(C.answerWordCount(a), 'word') + ' · ' + esc(fmtDate(a.updatedAt)) : 'unanswered') + '</span></button></li>'
    }).join('') + '</ul>'
  }

  function viewRevisit() {
    var f = route.filter || 'all'
    function fb(id, label) { return '<button type="button" class="btn small" data-action="revisit-filter" data-filter="' + id + '" aria-pressed="' + (f === id) + '">' + label + '</button>' }
    return '<div class="page"><section class="window" aria-labelledby="rv-h">' + titlebar('Revisit', '', 'home') +
      '<h1 id="rv-h" class="sr-only" tabindex="-1" data-autofocus>Revisit your answers</h1>' +
      '<div class="filters" role="group" aria-label="Filter">' + fb('all', 'Answered &amp; starred') + fb('starred', 'Starred') + fb('thin', 'Could be richer') +
      '<label class="sr-only" for="revisit-q">Search answers</label><input type="search" id="revisit-q" placeholder="Search prompts and answers" value="' + esc(route.q || '') + '"></div>' +
      '<div id="revisit-rows">' + revisitRows() + '</div></section></div>'
  }

  // ── Lightning round ───────────────────────────────────────────────────────

  var LR = null

  function viewLightning() {
    if (!LR || LR.phase === 'intro') {
      var rapid = CARDS.filter(function (c) { return c.type === 'rapid' })
      var left = rapid.filter(function (c) { return !answered(c.id) }).length
      return '<div class="page narrow"><div class="stack-wrap"><section class="window" aria-labelledby="lr-h">' + titlebar('Lightning round', '', 'home') +
        '<div class="card-body"><h1 class="lr-prompt" id="lr-h">' + pix('bolt', 'xl') + ' Lightning round</h1>' +
        '<div class="lr-intro"><ul><li>Up to ' + LIGHTNING_CARDS + ' rapid questions, ' + LIGHTNING_SECONDS + ' seconds each.</li><li>First instinct, a few words. <b>Enter</b> saves and moves on, <b>Esc</b> skips.</li>' +
        '<li>Three in a row starts a streak: +2 bonus XP per answer while it lasts.</li><li>' + (left ? left + ' of ' + rapid.length + ' still unanswered.' : 'You’ve answered them all; this round lets you change your mind.') + '</li></ul></div>' +
        '<div class="actions"><span class="spacer"></span><button type="button" class="btn" data-action="topic" data-topic="lightning">Browse them one by one</button>' +
        '<button type="button" class="btn default" data-action="lr-start" data-autofocus>Start the clock</button></div></div></section></div></div>'
    }
    if (LR.phase === 'done') {
      return '<div class="page narrow"><div class="stack-wrap"><section class="window" aria-labelledby="lr-done-h">' + titlebar('Lightning round', '', 'home') +
        '<div class="card-body lr-result">' + pix('bolt', 'xl') + '<h1 id="lr-done-h" class="sr-only">Round over</h1><span class="big">' + LR.answered + '</span><span>answered · best streak ' + LR.bestStreak + ' · +' + LR.bonus + ' bonus XP</span>' +
        '<div class="files-row"><button type="button" class="btn default" data-action="lr-again" data-autofocus>Another round</button><button type="button" class="btn" data-action="home">Home</button></div></div></section></div></div>'
    }
    var card = CARD_BY_ID[LR.deck[LR.idx]]
    return '<div class="page narrow"><div class="stack-wrap"><section class="window" aria-labelledby="lr-q">' + titlebar('Lightning round', (LR.idx + 1) + ' of ' + LR.deck.length, 'home') +
      '<div class="card-body"><div class="lr-top"><div class="lr-clock" id="lr-clock" aria-hidden="true">' + LIGHTNING_SECONDS + '</div>' +
      '<div class="timer" aria-hidden="true"><span id="lr-bar" style="width:100%"></span></div>' +
      '<div class="lr-streak" title="Streak">' + pix('flame') + '<span id="lr-streak">' + LR.streak + '</span></div></div>' +
      '<h1 class="lr-prompt" id="lr-q">' + esc(card.prompt) + '</h1>' +
      '<div class="lr-row"><label class="sr-only" for="lr-input">Your quick answer. Enter saves, Escape skips. ' + LIGHTNING_SECONDS + ' seconds.</label>' +
      '<input type="text" id="lr-input" class="answer" autocomplete="off" maxlength="300" data-autofocus>' +
      '<button type="button" class="btn default" data-action="lr-submit">Go</button></div>' +
      '<div class="lr-flash" id="lr-flash" role="status"></div>' +
      '<div class="actions"><span>' + LR.answered + ' answered</span><span class="spacer"></span><button type="button" class="btn small" data-action="lr-skip">Skip (Esc)</button><button type="button" class="btn small" data-action="lr-end">End round</button></div>' +
      '</div></section></div></div>'
  }

  function startLightning() {
    var rapid = CARDS.filter(function (c) { return c.type === 'rapid' })
    var fresh = shuffle(rapid.filter(function (c) { return !answered(c.id) }))
    var old = shuffle(rapid.filter(function (c) { return answered(c.id) }))
    LR = { phase: 'play', deck: fresh.concat(old).slice(0, LIGHTNING_CARDS).map(function (c) { return c.id }), idx: 0, answered: 0, streak: 0, bestStreak: 0, bonus: 0, xpBefore: xpNow(), deadline: 0, remaining: LIGHTNING_SECONDS * 1000, timer: null }
    if (!LR.deck.length) { toast({ title: 'No rapid cards', body: 'Nothing to play yet.', icon: 'bolt' }); return }
    render('dissolve')
    armTimer()
  }

  function armTimer() {
    clearInterval(LR.timer)
    LR.remaining = LIGHTNING_SECONDS * 1000
    LR.deadline = Date.now() + LR.remaining
    LR.timer = setInterval(tick, 100)
    tick()
  }

  function tick() {
    if (!LR || LR.phase !== 'play') return
    if (document.hidden) { LR.deadline = Date.now() + LR.remaining; return }
    LR.remaining = Math.max(0, LR.deadline - Date.now())
    var secs = Math.ceil(LR.remaining / 1000)
    var clock = $('#lr-clock')
    var bar = $('#lr-bar')
    if (clock) { clock.textContent = String(secs); clock.classList.toggle('hurry', secs <= 5) }
    if (bar) bar.style.width = (LR.remaining / (LIGHTNING_SECONDS * 10)).toFixed(1) + '%'
    if (LR.remaining <= 0) lightningAnswer(true)
  }

  function lightningAnswer(timedOut) {
    if (!LR || LR.phase !== 'play') return
    var input = $('#lr-input')
    var text = input ? input.value.trim() : ''
    var id = LR.deck[LR.idx]
    var flash = ''
    if (text) {
      var prev = S.answers[id]
      var t = nowIso()
      S.answers[id] = { text: text, answeredAt: (prev && prev.answeredAt) || t, updatedAt: t }
      LR.answered++
      LR.streak++
      LR.bestStreak = Math.max(LR.bestStreak, LR.streak)
      if (LR.streak >= 3) { S.bonusXp += 2; LR.bonus += 2 }
      flash = LR.streak >= 3 ? 'Streak ' + LR.streak + '! +' + (5 + 2) + ' XP' : '+5 XP'
      persist()
    } else {
      LR.streak = 0
      flash = timedOut ? 'Time!' : 'Skipped'
    }
    LR.idx++
    if (LR.idx >= LR.deck.length) { endLightning(); return }
    render(REDUCED.matches ? null : 'wipe-left')
    var f = $('#lr-flash')
    if (f) f.textContent = flash
    armTimer()
  }

  function endLightning() {
    if (!LR) return
    clearInterval(LR.timer)
    LR.phase = 'done'
    S.lightning.rounds++
    S.lightning.best = Math.max(S.lightning.best, LR.answered)
    if (LR.answered) addActiveDay()
    if (LR.answered >= LIGHTNING_CARDS && LR.answered === LR.deck.length) { S.bonusXp += 20; LR.bonus += 20 }
    persistNow()
    render('dissolve')
    celebrate(LR.xpBefore, { lightningRun: LR.answered, savedAtHour: LR.answered ? new Date().getHours() : undefined })
    persistNow()
  }

  function stopLightning() {
    if (LR && LR.timer) clearInterval(LR.timer)
    if (LR && LR.phase === 'play' && LR.answered) {
      LR.phase = 'done'
      S.lightning.rounds++
      S.lightning.best = Math.max(S.lightning.best, LR.answered)
      addActiveDay()
      celebrate(LR.xpBefore, { lightningRun: LR.answered, savedAtHour: new Date().getHours() })
      persistNow()
    }
    LR = null
  }

  // ── Dialogs ───────────────────────────────────────────────────────────────

  function openDialog(title, body, opts) {
    var d = $('#dlg')
    d.className = opts && opts.wide ? 'wide' : ''
    d.innerHTML = '<div class="dlg-frame"><h2 class="dlg-title" id="dlg-title">' + (opts && opts.icon ? pix(opts.icon, 'lg') : '') + esc(title) + '</h2>' + body + '</div>'
    if (!d.open) d.showModal()
    var f = $('[autofocus]', d) || $('.dlg-actions .default', d) || $('button', d)
    if (f) f.focus()
  }
  function closeDialog() { var d = $('#dlg'); if (d.open) d.close() }

  function aboutDialog() {
    openDialog('About Raj’s Clone Stack',
      '<p class="dlg-text">A HyperCard-style stack of questions for teaching an AI clone how you think. Answers save in this browser as you type. Nothing leaves this computer until you export.</p>' +
      '<table class="shortcut-table"><tbody>' +
      '<tr><td><kbd>' + SAVE_KEYS + '</kbd></td><td>Save &amp; next card</td></tr>' +
      '<tr><td><kbd>Enter</kbd></td><td>Save a rapid answer (and in lightning rounds)</td></tr>' +
      '<tr><td><kbd>Esc</kbd></td><td>Skip in a lightning round; close a dialog or menu</td></tr>' +
      '<tr><td><kbd>Tab</kbd></td><td>Move between everything; menus open with Enter or ↓</td></tr></tbody></table>' +
      '<p class="dlg-text">Question bank ' + esc(DATA.bankVersion) + ' · ' + BANK.length + ' questions · ' + plural(S.custom.length, 'card') + ' you wrote · ' + plural(S.packCards.length, 'card') + ' from packs.</p>' +
      '<div class="dlg-actions"><button type="button" class="btn default" data-action="close-dialog">OK</button></div>', { icon: 'cloud' })
  }

  function howExportDialog() {
    openDialog('How answers reach the clone',
      '<ol class="dlg-list"><li><b>Export answers…</b> downloads <code>raj-clone-answers-YYYY-MM-DD.json</code> to Downloads.</li>' +
      '<li>In the repo, tell the agent <i>“I’m done answering”</i>. The <code>ingest-answers</code> skill moves the file to <code>private/answers/</code> (never committed), loads it into the clone and rebuilds its persona.</li>' +
      '<li>The agent reads what you said and writes a follow-up <b>question pack</b> to <code>private/question-packs/</code>.</li>' +
      '<li>Here, <b>File › Import question pack…</b> adds those cards, marked New.</li></ol>' +
      '<p class="dlg-text">Backups are separate: <b>Backup all data</b> saves everything (answers, stars, badges, packs) so you can restore it in another browser.</p>' +
      '<div class="dlg-actions"><button type="button" class="btn default" data-action="close-dialog">Got it</button></div>', { icon: 'floppy', wide: true })
  }

  function exportDialog() {
    var all = CARDS.filter(function (c) { return answered(c.id) }).length
    var un = C.unexportedIds(S, CARDS).length
    if (!all) {
      openDialog('Nothing to export yet', '<p class="dlg-text">Answer a card or two first. The export only includes answered cards.</p><div class="dlg-actions"><button type="button" class="btn default" data-action="close-dialog">OK</button></div>', { icon: 'floppy' })
      return
    }
    var sinceOk = !!S.lastExportAt && un > 0
    openDialog('Export answers',
      '<p class="dlg-text">Downloads a file for the agent: every answer with its question, type and metadata. Keep it out of email and chat; the agent moves it into the repo’s private folder.</p>' +
      '<div class="choice-list" role="radiogroup" aria-label="What to export">' +
      '<label class="radio"><input type="radio" name="scope" value="since-last-export"' + (sinceOk ? ' checked' : ' disabled') + '><span>Only new or changed since the last export<small>' +
      (S.lastExportAt ? un + ' of ' + all + ' answers · last export ' + esc(fmtDate(S.lastExportAt)) : 'Available after your first export') + '</small></span></label>' +
      '<label class="radio"><input type="radio" name="scope" value="all"' + (sinceOk ? '' : ' checked') + '><span>Everything<small>' + plural(all, 'answer') + '. Safe to re-import: unchanged answers are skipped.</small></span></label></div>' +
      '<p class="dlg-text">File: <code>' + esc(C.exportFileName(today())) + '</code></p>' +
      '<div class="dlg-actions"><button type="button" class="btn" data-action="close-dialog">Cancel</button><button type="button" class="btn default" data-action="do-export">' + pix('floppy', 'sm') + 'Download</button></div>', { icon: 'floppy' })
  }

  function download(filename, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2) + '\n'], { type: 'application/json' })
    var url = URL.createObjectURL(blob)
    var a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(function () { URL.revokeObjectURL(url) }, 10000)
  }

  function doExport() {
    var picked = $('#dlg input[name="scope"]:checked')
    var scope = picked ? picked.value : 'all'
    var xpBefore = xpNow()
    var data = C.buildExport(S, CARDS, { scope: scope, now: nowIso(), bankVersion: DATA.bankVersion, today: today() })
    if (!data.answers.length) { toast({ title: 'Nothing new', body: 'No answers changed since the last export.', icon: 'floppy' }); closeDialog(); return }
    download(C.exportFileName(today()), data)
    S.lastExportAt = data.exportedAt
    S.exports++
    persistNow()
    closeDialog()
    toast({ title: 'Exported ' + plural(data.answers.length, 'answer'), body: 'Check Downloads for ' + C.exportFileName(today()) + '. Now tell the agent you’re done answering.', icon: 'floppy', ms: 8000 })
    celebrate(xpBefore, {})
    if (route.view === 'home') render()
  }

  function doBackup() {
    download(C.exportFileName(today(), 'backup'), C.buildBackup(S, nowIso(), DATA.bankVersion))
    toast({ title: 'Backup saved', body: C.exportFileName(today(), 'backup') + ' is in Downloads. It holds everything, so keep it private.', icon: 'disk' })
  }

  function readJsonFile(input, cb) {
    var file = input.files && input.files[0]
    input.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { errorDialog('That file is too big', ['Question packs and backups are small JSON files. This one is over 5 MB.']); return }
    var reader = new FileReader()
    reader.onload = function () {
      var json
      try { json = JSON.parse(String(reader.result)) } catch (e) { errorDialog('That isn’t JSON', ['"' + file.name + '" couldn’t be read as JSON. Pick the .json file the agent wrote.']); return }
      cb(json, file.name)
    }
    reader.onerror = function () { errorDialog('Couldn’t read the file', [file.name]) }
    reader.readAsText(file)
  }

  function errorDialog(title, errors) {
    openDialog(title, '<ul class="errors">' + errors.map(function (e) { return '<li>' + esc(e) + '</li>' }).join('') + '</ul>' +
      '<div class="dlg-actions"><button type="button" class="btn default" data-action="close-dialog">OK</button></div>', { icon: 'bomb' })
  }

  function importPack(json, name) {
    var check = C.checkPack(json, DATA.topicIds, DATA.types)
    if (!check.ok) { errorDialog('This pack has problems', check.errors.slice(0, 20)); return }
    var res = C.packToCards(check.pack, new Set(CARDS.map(function (c) { return c.id })))
    res.cards.forEach(function (c) { S.packCards.push(c) })
    var known = S.packs.filter(function (pk) { return pk.packId === check.pack.packId })[0]
    if (known) { known.added += res.cards.length; known.importedAt = nowIso() }
    else S.packs.push({ packId: check.pack.packId, title: check.pack.title, note: check.pack.note, importedAt: nowIso(), added: res.cards.length })
    refreshCards()
    persistNow()
    var body = '<p class="dlg-text"><b>' + plural(res.cards.length, 'new card') + '</b> from “' + esc(check.pack.title) + '”' +
      (res.duplicates.length ? ' (' + plural(res.duplicates.length, 'card') + ' you already had were skipped)' : '') + '.</p>' +
      (check.pack.note ? '<p class="dlg-text"><b>A note from the agent:</b> ' + esc(check.pack.note) + '</p>' : '') +
      '<div class="dlg-actions"><button type="button" class="btn" data-action="close-dialog">Later</button>' +
      (res.cards.length ? '<button type="button" class="btn default" data-action="mode-new">Start the new cards</button>' : '') + '</div>'
    openDialog('Question pack imported', body, { icon: 'mail' })
    if (route.view === 'home') render()
    renderStatus()
    void name
  }

  var pendingRestore = null
  function restorePrompt(json, name) {
    var res = C.checkBackup(json, nowIso())
    if (!res.ok) { errorDialog('That isn’t a stack backup', [res.error]); return }
    pendingRestore = res.state
    var n = Object.keys(res.state.answers).length
    openDialog('Replace everything with this backup?',
      '<p class="dlg-text">“' + esc(name) + '” has ' + plural(n, 'answer') + '. Restoring replaces all answers, stars, badges and packs in this browser. Take a backup of the current data first if you’re not sure.</p>' +
      '<div class="dlg-actions"><button type="button" class="btn" data-action="backup">Backup current first</button><button type="button" class="btn" data-action="close-dialog">Cancel</button>' +
      '<button type="button" class="btn default" data-action="do-restore">Restore</button></div>', { icon: 'disk' })
  }

  function addCardDialog() {
    var current = currentCard()
    var defTopic = current ? current.topic : route.mode && route.mode.topic ? route.mode.topic : 'notes'
    var topicOpts = TOPICS.map(function (t) { return '<option value="' + t.id + '"' + (t.id === defTopic ? ' selected' : '') + '>' + esc(t.label) + '</option>' }).join('')
    openDialog('Add your own card',
      '<form id="custom-form" class="form-grid">' +
      '<p class="dlg-text">Something we didn’t ask? Write the question the way you’d want someone to ask it, then answer it.</p>' +
      '<label>Topic<select name="topic">' + topicOpts + '</select></label>' +
      '<label>Kind<select name="type"><option value="open">Open answer</option><option value="story">Story</option></select></label>' +
      '<label>The question<textarea name="prompt" rows="2" required maxlength="1000" autofocus placeholder="What’s something people always get wrong about you?"></textarea></label>' +
      '<label>Your answer<textarea name="answer" rows="7" maxlength="40000" required></textarea></label>' +
      '<div class="dlg-actions"><button type="button" class="btn" data-action="close-dialog">Cancel</button><button type="submit" class="btn default">' + pix('plus', 'sm') + 'Add card</button></div>' +
      '</form>', { icon: 'pencil', wide: true })
  }

  function saveCustomCard(form) {
    var fd = new FormData(form)
    var prompt = String(fd.get('prompt') || '').trim()
    var text = String(fd.get('answer') || '').trim()
    if (!prompt || !text) return
    var xpBefore = xpNow()
    var t = nowIso()
    var id = 'custom-' + uuid()
    var topic = String(fd.get('topic') || 'notes')
    var type = fd.get('type') === 'story' ? 'story' : 'open'
    S.custom.push({ id: id, topic: topic, type: type, prompt: prompt, depth: 2, why: 'Something Raj chose to add in his own words.', source: 'custom', createdAt: t })
    S.answers[id] = { text: text, answeredAt: t, updatedAt: t }
    addActiveDay()
    refreshCards()
    persistNow()
    closeDialog()
    var gained = celebrate(xpBefore, { savedAtHour: new Date().getHours() })
    toast({ title: 'Card added to ' + (TOPIC_BY_ID[topic] || { label: topic }).label, body: '+' + gained + ' XP. You can edit it any time from Revisit.', icon: 'pencil' })
    if (route.view === 'home') render()
  }

  function deleteCustomPrompt() {
    var card = currentCard()
    if (!card || card.source !== 'custom') return
    openDialog('Delete this card?', '<p class="dlg-text">“' + esc(card.prompt) + '” and its answer will be removed from this browser. If you already exported it, the clone keeps its copy until you delete it in the studio.</p>' +
      '<div class="dlg-actions"><button type="button" class="btn" data-action="close-dialog">Cancel</button><button type="button" class="btn default" data-action="do-delete-custom">Delete</button></div>', { icon: 'bomb' })
  }

  // ── Menus ─────────────────────────────────────────────────────────────────

  function closeMenus(except) {
    $$('.menu-title').forEach(function (b) {
      if (b === except) return
      b.setAttribute('aria-expanded', 'false')
      var list = document.getElementById(b.dataset.menu)
      if (list) list.hidden = true
    })
  }
  function openMenu(btn, focusFirst) {
    closeMenus(btn)
    btn.setAttribute('aria-expanded', 'true')
    var list = document.getElementById(btn.dataset.menu)
    list.hidden = false
    if (focusFirst) { var first = $('button:not(:disabled)', list); if (first) first.focus() }
  }
  function updateCardMenu() {
    var onCard = route.view === 'card'
    $$('[data-needs-card]').forEach(function (b) { b.disabled = !onCard })
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  function act(name, el) {
    switch (name) {
      case 'home': closeDialog(); go({ view: 'home' }, 'iris'); break
      case 'topic':
        if (el.dataset.topic === 'lightning' && route.view !== 'lightning') { go({ view: 'lightning' }, 'dissolve'); break }
        startDeck({ kind: 'topic', topic: el.dataset.topic })
        break
      case 'mode-shuffle': closeDialog(); startDeck({ kind: 'shuffle' }); break
      case 'mode-deep': startDeck({ kind: 'deep' }); break
      case 'mode-new': closeDialog(); startDeck({ kind: 'new' }); break
      case 'mode-snoozed': startDeck({ kind: 'snoozed' }); break
      case 'mode-lightning': closeDialog(); go({ view: 'lightning' }, 'dissolve'); break
      case 'mode-revisit': go({ view: 'revisit', filter: 'all', q: '' }, 'wipe-left'); break
      case 'revisit-filter': route.filter = el.dataset.filter; render(); break
      case 'open-revisit': {
        var ids = revisitCards().map(function (c) { return c.id })
        go({ view: 'card', mode: { kind: 'revisit', ids: ids }, deck: ids, idx: Math.max(0, ids.indexOf(el.dataset.id)) }, 'wipe-left')
        break
      }
      case 'save-next': saveAndNext(); break
      case 'skip': skipCard(); break
      case 'snooze': snoozeCard(); break
      case 'star': toggleStar(); break
      case 'dig': toggleDig(); break
      case 'choose': choose(Number(el.dataset.choice)); break
      case 'rate': rate(Number(el.dataset.value)); break
      case 'mic': toggleMic(); break
      case 'prev': if (route.idx > 0) moveTo(route.idx - 1, 'wipe-right'); break
      case 'next': if (route.idx < route.deck.length - 1) moveTo(route.idx + 1, 'wipe-left'); break
      case 'add-card': addCardDialog(); break
      case 'delete-custom': deleteCustomPrompt(); break
      case 'do-delete-custom': {
        var card = currentCard()
        closeDialog()
        if (!card) break
        cardSession = null
        S.custom = S.custom.filter(function (c) { return c.id !== card.id })
        delete S.answers[card.id]
        delete S.flags[card.id]
        refreshCards()
        persistNow()
        route.deck = route.deck.filter(function (id) { return id !== card.id })
        if (!route.deck.length) go({ view: 'home' }, 'iris')
        else { route.idx = Math.min(route.idx, route.deck.length - 1); render('dissolve') }
        toast({ title: 'Card deleted', icon: 'pencil' })
        break
      }
      case 'export': exportDialog(); break
      case 'do-export': doExport(); break
      case 'backup': doBackup(); break
      case 'restore': $('#file-restore').click(); break
      case 'do-restore':
        if (pendingRestore) {
          cardSession = null
          S = pendingRestore
          pendingRestore = null
          refreshCards()
          persistNow()
          closeDialog()
          go({ view: 'home' }, 'iris')
          toast({ title: 'Backup restored', body: plural(Object.keys(S.answers).length, 'answer') + ' loaded.', icon: 'disk' })
        }
        break
      case 'import-pack': $('#file-pack').click(); break
      case 'about': aboutDialog(); break
      case 'how-export': howExportDialog(); break
      case 'close-dialog': closeDialog(); break
      case 'lr-start': startLightning(); break
      case 'lr-again': LR = null; startLightning(); break
      case 'lr-submit': lightningAnswer(false); break
      case 'lr-skip': { var inp = $('#lr-input'); if (inp) inp.value = ''; lightningAnswer(false); break }
      case 'lr-end': endLightning(); break
    }
  }

  document.addEventListener('click', function (e) {
    var menuBtn = e.target.closest('[data-menu]')
    if (menuBtn) {
      if (menuBtn.getAttribute('aria-expanded') === 'true') closeMenus()
      else openMenu(menuBtn, false)
      return
    }
    var a = e.target.closest('[data-action]')
    if (!e.target.closest('.menu-list')) closeMenus()
    if (a && !a.disabled) {
      closeMenus()
      e.preventDefault()
      act(a.dataset.action, a)
    }
  })

  document.addEventListener('mouseover', function (e) {
    var t = e.target.closest('[data-menu]')
    if (t && $('.menu-title[aria-expanded="true"]') && t.getAttribute('aria-expanded') !== 'true') openMenu(t, false)
  })

  document.addEventListener('keydown', function (e) {
    var titleBtn = e.target.closest && e.target.closest('[data-menu]')
    var inList = e.target.closest && e.target.closest('.menu-list')
    if (titleBtn && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openMenu(titleBtn, true); return }
    if (inList || titleBtn) {
      var titles = $$('.menu-title')
      var owner = inList ? $('[data-menu="' + inList.id + '"]') : titleBtn
      if (e.key === 'Escape') { e.preventDefault(); closeMenus(); owner.focus(); return }
      if (inList && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault()
        var items = $$('button:not(:disabled)', inList)
        var i = items.indexOf(document.activeElement)
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus()
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        var j = titles.indexOf(owner)
        var nextTitle = titles[(j + (e.key === 'ArrowRight' ? 1 : -1) + titles.length) % titles.length]
        if (inList) openMenu(nextTitle, true)
        else nextTitle.focus()
        return
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && route.view === 'card' && !$('#dlg').open) { e.preventDefault(); saveAndNext(); return }
    if (e.target.id === 'f-text' && e.target.tagName === 'INPUT' && e.key === 'Enter') { e.preventDefault(); saveAndNext(); return }
    if (e.target.id === 'lr-input') {
      if (e.key === 'Enter') { e.preventDefault(); lightningAnswer(false) }
      else if (e.key === 'Escape') { e.preventDefault(); e.target.value = ''; lightningAnswer(false) }
    }
  })

  document.addEventListener('focusout', function (e) {
    var menu = e.target.closest && e.target.closest('.menu')
    if (!menu) return
    setTimeout(function () { if (!menu.contains(document.activeElement)) { var b = $('[data-menu]', menu); if (b && b.getAttribute('aria-expanded') === 'true' && !menu.matches(':hover')) closeMenus() } }, 0)
  })

  document.addEventListener('focusin', function (e) {
    if (e.target.matches && e.target.matches('[data-field="text"], [data-field="part"]')) lastField = e.target
  })

  document.getElementById('view').addEventListener('input', function (e) {
    var t = e.target
    if (t.id === 'revisit-q') {
      route.q = t.value
      $('#revisit-rows').innerHTML = revisitRows()
      return
    }
    var field = t.dataset && t.dataset.field
    if (!field) return
    var card = currentCard()
    if (!card) return
    if (field === 'text') updateAnswer({ text: t.value })
    else if (field === 'value') {
      var v = Number(t.value)
      t.classList.remove('unset')
      var out = $('#scale-out')
      if (out) { out.textContent = String(v); out.classList.remove('unset') }
      $$('.tick').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.value) === v)) })
      updateAnswer({ value: v })
    } else if (field === 'part') {
      var parts = Object.assign({}, (S.answers[card.id] || {}).parts || {})
      parts[t.dataset.part] = t.value
      updateAnswer({ parts: parts })
    }
  })

  document.addEventListener('submit', function (e) {
    if (e.target.id === 'custom-form') { e.preventDefault(); saveCustomCard(e.target) }
  })

  $('#file-pack').addEventListener('change', function () { readJsonFile(this, importPack) })
  $('#file-restore').addEventListener('change', function () { readJsonFile(this, restorePrompt) })
  $('#dlg').addEventListener('close', function () { pendingRestore = null })

  // ── Boot ──────────────────────────────────────────────────────────────────

  if (!storageOk) $('#storage-warning').hidden = false
  render('iris')

  // A tiny test hook for the verification script; exposes nothing private beyond this page.
  window.__stack = { state: function () { return S }, cards: function () { return CARDS } }
})()
