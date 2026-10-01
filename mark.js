/* a68.ca — the A68 mark.
 *
 * Each of the three glyphs is set in its own typeface, and each position has a small pool to
 * draw from. The pools are category-locked: the A is always a serif, the 6 always a heavy or
 * condensed sans, the 8 always a monospace. That is what keeps an arbitrary combination from
 * reading as a mistake rather than a choice.
 *
 * Every face carries its own em size and weight, because equal point sizes do not look equal —
 * Bebas Neue at 1em next to Instrument Serif sits quite differently. Those numbers are the
 * difference between one composed mark and three adjacent fonts, so they are hand-tuned.
 *
 * TWO behaviours, deliberately different in character:
 *
 *   GLITCH  — every few seconds. One or two combinations, held for a fraction of a second, then
 *             gone. Fonts only; the colours hold still, so it reads as a typeface flickering
 *             rather than the whole mark changing. Every second to fourth one is smaller again:
 *             a single letter, there and back.
 *   RIFFLE  — rare. Faces AND colours, a dozen steps, fast at first and slowing to a stop. The
 *             big version, and the one a click triggers.
 *
 * Index 0 of each pool is the resting mark, and matches style.css, so there is no flash of a
 * different face before this script runs, and both behaviours always end back there.
 */

(function () {
  "use strict";

  // --- tuning -------------------------------------------------------------------------------
  // The glitch: frequent, brief, fonts only.
  var GLITCH_MIN   = 5000;   // ms between glitches, randomised across this window
  var GLITCH_MAX   = 10000;
  var HOLD_MIN     = 60;     // ms a glitched combination is held before moving on
  var HOLD_MAX     = 130;
  var SINGLE_EVERY = [2, 4]; // every Nth glitch is a single letter, N drawn from this range

  // The riffle: rare, bigger, fonts and colours.
  var IDLE_MIN  = 20000;
  var IDLE_MAX  = 90000;
  var FIRST_MIN = 15000;     // the first comes sooner, while someone is still looking at it
  var FIRST_MAX = 25000;
  var STEPS     = 11;        // swaps per riffle
  var FAST      = 55;        // ms between the first swaps
  var SLOW      = 380;       // ms between the last. The gap between these two is the effect.
  var ON_LOAD   = true;
  // ------------------------------------------------------------------------------------------

  /* The three inks, by name only — style.css holds the actual colours, including the Display P3
     and dark-theme variants, so none of that has to be repeated here. A riffle deals these out
     as a PERMUTATION rather than picking each independently, so all three are always on screen
     and the mark never lands on a repeated colour. */
  var INKS = ["var(--ink-gold)", "var(--ink-grey)", "var(--ink-brass)"];

  var POOLS = {
    a: [
      { family: '"Instrument Serif", Georgia, serif', size: 1.08, weight: 400 },
      { family: '"Bodoni Moda", Georgia, serif',      size: 1.00, weight: 400 },
      { family: '"Playfair Display", Georgia, serif', size: 1.00, weight: 700 },
      { family: '"Lora", Georgia, serif',             size: 0.97, weight: 600 }
    ],
    s: [
      { family: '"Bebas Neue", Helvetica, sans-serif',    size: 1.06, weight: 400 },
      { family: '"Archivo Black", Helvetica, sans-serif', size: 0.86, weight: 400 },
      { family: '"Anton", Helvetica, sans-serif',         size: 0.92, weight: 400 },
      { family: '"Oswald", Helvetica, sans-serif',        size: 1.00, weight: 600 }
    ],
    e: [
      { family: '"Space Mono", "Courier New", monospace',    size: 0.88, weight: 400 },
      { family: '"IBM Plex Mono", "Courier New", monospace', size: 0.92, weight: 400 },
      { family: '"DM Mono", "Courier New", monospace',       size: 0.94, weight: 400 },
      { family: '"Azeret Mono", "Courier New", monospace',   size: 0.88, weight: 500 }
    ]
  };

  var mark = document.querySelector(".mark-hero");
  if (!mark) return;

  var KEYS = ["a", "s", "e"];
  var glyphs = {};
  for (var i = 0; i < KEYS.length; i++) {
    glyphs[KEYS[i]] = mark.querySelector("." + KEYS[i]);
    if (!glyphs[KEYS[i]]) return;
  }

  // Someone who has asked for less motion gets the mark and nothing else.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var current  = { a: 0, s: 0, e: 0 };
  var rTimer   = null, gTimer = null;   // riffle and glitch are scheduled independently
  var riffling = false, glitching = false, hadFirst = false;

  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
  function pick(n) { return Math.floor(Math.random() * n); }

  function apply(key, idx) {
    var f = POOLS[key][idx];
    var el = glyphs[key];
    el.style.fontFamily = f.family;
    el.style.fontSize   = f.size + "em";
    el.style.fontWeight = f.weight;
  }

  /// Always land on a different face, so no step is ever invisible.
  function jump(key) {
    var n = POOLS[key].length, next = current[key];
    while (next === current[key]) next = pick(n);
    current[key] = next;
    apply(key, next);
  }

  /// One glyph back to its resting face. Clearing the inline fill rather than setting one hands
  /// the colour back to the stylesheet, which is what keeps a theme change working afterwards.
  function restOne(key) {
    current[key] = 0;
    apply(key, 0);
    glyphs[key].style.fill = "";
  }

  function rest() { KEYS.forEach(restOne); }

  /// Deal the three inks out in a random order, one per glyph. Riffle only.
  function shuffleInks() {
    var deck = INKS.slice();
    for (var i = deck.length - 1; i > 0; i--) {      // Fisher-Yates
      var j = pick(i + 1), t = deck[i];
      deck[i] = deck[j]; deck[j] = t;
    }
    KEYS.forEach(function (k, i) { glyphs[k].style.fill = deck[i]; });
  }

  // ---------------------------------------------------------------- the glitch

  var sinceSingle = 0;
  var singleAt = Math.round(rand(SINGLE_EVERY[0], SINGLE_EVERY[1]));

  function scheduleGlitch() {
    clearTimeout(gTimer);
    if (document.hidden) return;
    gTimer = setTimeout(glitch, rand(GLITCH_MIN, GLITCH_MAX));
  }

  function glitch() {
    // Never interrupt a riffle — it is the bigger event and gets right of way.
    if (riffling || glitching) { scheduleGlitch(); return; }
    glitching = true;

    var single = ++sinceSingle >= singleAt;
    if (single) {
      sinceSingle = 0;
      singleAt = Math.round(rand(SINGLE_EVERY[0], SINGLE_EVERY[1]));
    }

    // A single letter is one flash. A full glitch is one or two combinations in a row, which is
    // what gives it a stutter rather than one clean swap.
    var frames = single ? 1 : 1 + pick(2);
    var key = KEYS[pick(KEYS.length)];
    var n = 0;

    (function frame() {
      if (n >= frames) {
        if (single) restOne(key); else rest();
        glitching = false;
        scheduleGlitch();
        return;
      }
      if (single) jump(key); else KEYS.forEach(jump);
      n++;
      gTimer = setTimeout(frame, rand(HOLD_MIN, HOLD_MAX));
    })();
  }

  // ---------------------------------------------------------------- the riffle

  function scheduleRiffle() {
    clearTimeout(rTimer);
    if (document.hidden) return;
    var lo = hadFirst ? IDLE_MIN : FIRST_MIN;
    var hi = hadFirst ? IDLE_MAX : FIRST_MAX;
    rTimer = setTimeout(riffle, rand(lo, hi));
  }

  function riffle() {
    if (riffling) return;
    riffling = true;
    hadFirst = true;
    var step = 0;

    (function next() {
      if (step >= STEPS) {
        riffling = false;
        rest();
        scheduleRiffle();
        return;
      }
      KEYS.forEach(jump);
      shuffleInks();
      // Squaring the progress makes the delay grow slowly at first and steeply at the end, so it
      // reads as coming to a decision rather than simply stopping.
      var t = step / (STEPS - 1);
      step++;
      rTimer = setTimeout(next, FAST + (SLOW - FAST) * (t * t));
    })();
  }

  // ---------------------------------------------------------------- lifecycle

  // A background tab should not be burning timers, and nobody is watching anyway.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (!riffling)  clearTimeout(rTimer);
      if (!glitching) clearTimeout(gTimer);
    } else {
      if (!riffling)  scheduleRiffle();
      if (!glitching) scheduleGlitch();
    }
  });

  // Click or tap for a riffle now, rather than waiting for one.
  mark.style.cursor = "pointer";
  mark.addEventListener("click", function () {
    if (riffling) return;
    clearTimeout(rTimer);
    riffle();
  });

  // Wait for the faces, or the first swaps happen against fallbacks and read as a size jitter
  // rather than as different typefaces.
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () {
    if (ON_LOAD) riffle(); else scheduleRiffle();
    scheduleGlitch();
  });
})();
