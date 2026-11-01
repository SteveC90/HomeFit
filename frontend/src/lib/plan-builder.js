// Builds a weekly plan from the equipment you have. Offline, deterministic, no model behind it.
//
// The starter plans (lib/starter.js) take a fixed barbell programme and swap out what you cannot
// do. This starts from the other end: a split for the days you train, each session a list of
// movement patterns (a squat, a hinge, a horizontal push...), and every pattern filled with the
// best exercise the equipment list allows. Pure: no store, no UI, no i18n. Routine names stay
// English because they become ordinary, editable routines, which are not translated.
import { uid } from './format.js'
import { EXIDX, isBodyweightEq } from './exercises.js'
import { eqAvailable } from './equipment.js'
import { defaultConfig } from './history.js'
import { substituteFor } from './starter.js'

/* ---------- movement patterns ----------
   `prefer` lists catalogue ids, best first, across every kind of equipment: the barbell lift
   leads, then the Smith and the machines, dumbbells, kettlebells, cables, the suspension trainer,
   bands, and the body-weight version last. The first one the equipment allows is the pick, so a
   home gym with a bar gets the bar and a hotel room gets the push-up, from the same list.
   Accessories (a bench, a pull-up bar) are read off the exercise by lib/equipment.js, so "dumbbell
   bench press" waits for a bench and "pull-up" for a bar.
   `kind` decides sets and reps (SCHEMES). `alt` is the pattern that stands in when nothing at all
   fits: no bar and no band for a vertical pull means a second row rather than a hole. */
export const SLOTS = {
  squat: { kind: 'main', prefer: ['0043', '0042', '0770', '0739', '2267', '1760', '0534', '0413', '0533', '6544', '0852', '4398', '1004', '5004', '1197', '1580'] },
  hinge: { kind: 'main', prefer: ['0032', '0811', '0085', '0752', '1060', '1459', '0300', '3322', '0549', '4046', '6552', '1206', '2146', '4742', '4618', '1513', '5837', '2471', '2072'] },
  lunge: { kind: 'secondary', alt: 'squat', prefer: ['0054', '0336', '0381', '4295', '2960', '0431', '4059', '3030', '11879', '10048', '4135', '1008', '4689', '0612', '1460', '0781', '0801', '1581'] },
  hpush: { kind: 'main', prefer: ['0025', '0748', '0289', '0576', '0151', '1254', '5738', '3780', '0662', '3910', '0915', '0279'] },
  vpush: { kind: 'main', alt: 'hpush', prefer: ['1162', '0774', '0426', '0405', '2137', '0603', '3572', '0546', '0219', '5074', '0997', '2921', '0471'] },
  chest: { kind: 'secondary', alt: 'hpush', prefer: ['0047', '0757', '0314', '1299', '0308', '0319', '0227', '1030', '0596', '4149', '5858', '4075', '0279', '1311', '3294'] },
  hpull: { kind: 'main', prefer: ['0027', '1359', '0293', '0861', '0606', '1350', '6156', '1080', '3899', '0930', '3858', '0499', '3381'] },
  vpull: { kind: 'main', alt: 'hpull', prefer: ['0652', '1326', '0841', '0198', '0579', '0017', '1088', '0970', '0905', '1013', '4358'] },
  legcurl: { kind: 'secondary', alt: 'hinge', prefer: ['0586', '0599', '6161', '0911', '4036', '4033', '7746', '4204'] },
  calves: { kind: 'accessory', prefer: ['0605', '0594', '1391', '1372', '1050', '0417', '3018'] },
  biceps: { kind: 'accessory', alt: 'vpull', prefer: ['0031', '0447', '0294', '0313', '0868', '5857', '4063', '4687', '1326', '2922'] },
  triceps: { kind: 'accessory', alt: 'hpush', prefer: ['0201', '0061', '0030', '0351', '0430', '0333', '5861', '1502', '3939', '0129', '0283'] },
  lateral: { kind: 'accessory', alt: 'vpush', prefer: ['0334', '0178', '3740', '0907', '0120', '0978'] },
  reardelt: { kind: 'accessory', alt: 'hpull', prefer: ['5609', '0383', '3914', '0076', '5607', '0993', '1503', '4568', '1113', '5665'] },
  core: { kind: 'core', prefer: ['0463', '0472', '1163', '1202', '0175', '0979', '0276', '1246', '0715', '6211', '1241'] }
}

/* ---------- sets and reps ----------
   [sets, reps] per slot kind. Strength keeps the big lifts heavy and short; muscle sits in the
   middle; general fitness runs lighter and longer. Core work is reps or, for a hold, the
   exercise's own default seconds. */
export const SCHEMES = {
  strength: { main: [5, 5], secondary: [3, 8], accessory: [3, 10], core: [3, 12] },
  muscle: { main: [4, 8], secondary: [3, 10], accessory: [3, 12], core: [3, 15] },
  general: { main: [3, 10], secondary: [3, 12], accessory: [2, 15], core: [3, 15] }
}
export const GOALS = Object.keys(SCHEMES)

// Five push-ups is no set: body weight has no load to make a low rep count hard, so a weightless
// exercise never starts below this, whatever the goal says.
export const BW_MIN_REPS = 8

/* ---------- sessions ----------
   Each session is its movement patterns in priority order; a shorter session keeps the front of
   the list, so four exercises are always the compound lifts and the accessories come with the
   extra room. A pattern may appear twice: the second time it takes the next exercise on its list. */
const FB_A = ['squat', 'hpush', 'hpull', 'hinge', 'vpush', 'core', 'biceps', 'triceps']
const FB_B = ['hinge', 'vpush', 'vpull', 'lunge', 'chest', 'core', 'lateral', 'calves']
const FB_C = ['squat', 'hpush', 'hpull', 'legcurl', 'vpush', 'core', 'reardelt', 'biceps']
const UPPER_A = ['hpush', 'hpull', 'vpush', 'vpull', 'lateral', 'biceps', 'triceps', 'reardelt']
const UPPER_B = ['chest', 'vpull', 'vpush', 'hpull', 'reardelt', 'triceps', 'biceps', 'lateral']
const LOWER_A = ['squat', 'hinge', 'lunge', 'legcurl', 'calves', 'core', 'hinge', 'core']
const LOWER_B = ['hinge', 'squat', 'legcurl', 'lunge', 'calves', 'core', 'squat', 'core']
const PUSH = ['hpush', 'vpush', 'chest', 'triceps', 'lateral', 'triceps', 'core', 'hpush']
const PULL = ['vpull', 'hpull', 'biceps', 'reardelt', 'hpull', 'biceps', 'core', 'vpull']
const LEGS = ['squat', 'hinge', 'lunge', 'legcurl', 'calves', 'core', 'squat', 'core']

export const LENGTHS = [4, 6, 8]

/* ---------- splits ----------
   One per number of training days: [name, icon, patterns, weekday]. The weekday is a DAYN index
   (1 is Monday), fixed weeks only, the way the starter plans lay themselves out. `split` names
   the family, for the copy the UI shows. */
export const SPLITS = {
  2: { split: 'full-body', routines: [['Full Body A', 'figureStrength', FB_A, 1], ['Full Body B', 'figureStrength', FB_B, 4]] },
  3: { split: 'full-body', routines: [['Full Body A', 'figureStrength', FB_A, 1], ['Full Body B', 'figureStrength', FB_B, 3], ['Full Body C', 'figureStrength', FB_C, 5]] },
  4: { split: 'upper-lower', routines: [['Upper A', 'barbell', UPPER_A, 1], ['Lower A', 'legs', LOWER_A, 2], ['Upper B', 'barbell', UPPER_B, 4], ['Lower B', 'legs', LOWER_B, 5]] },
  5: { split: 'ppl-ul', routines: [['Push', 'barbell', PUSH, 1], ['Pull', 'pullup', PULL, 2], ['Legs', 'legs', LEGS, 3], ['Upper', 'barbell', UPPER_A, 4], ['Lower', 'legs', LOWER_B, 5]] },
  6: { split: 'ppl', routines: [['Push A', 'barbell', PUSH, 1], ['Pull A', 'pullup', PULL, 2], ['Legs A', 'legs', LEGS, 3], ['Push B', 'barbell', PUSH, 4], ['Pull B', 'pullup', PULL, 5], ['Legs B', 'legs', LEGS, 6]] }
}
export const DAY_OPTIONS = Object.keys(SPLITS).map(Number)

// The first exercise on the pattern's list that the equipment allows and this routine does not
// already hold. `cursor` counts how often the pattern has been filled across the plan: a pattern
// that varies walks down its list on each fill, so Full Body A and B do not open with the same
// press; one that does not (a main lift under the strength goal) repeats its best pick, which
// is what practising a lift means.
function fromList(slot, equipment, taken, cursor, varies) {
  const fresh = SLOTS[slot].prefer.map(id => EXIDX[id]).filter(ex => ex && !taken.has(ex.id) && eqAvailable(equipment, ex))
  if (!fresh.length) return null
  const n = cursor[slot] || 0
  if (varies) cursor[slot] = n + 1
  return fresh[varies ? n % fresh.length : 0]
}

// Names that are no plan material: a drawing variant, a second version, a camera angle, a
// movement improvised on furniture or a towel. The lists never hold them; this keeps the
// stand-in search from reaching for them either.
const JUNK = /\((male|female)\)|\bv\. ?\d|version \d|\bpov\b|form check|\bchairs?\b|\btowels?\b|\bstraps\b|bed sheet|\bslide\b/i
const JUNK_IDS = new Set(Object.values(EXIDX).filter(e => JUNK.test(e.n)).map(e => e.id))

// The closest catalogue stand-in for the pattern's archetype: the same matcher that fits a
// starter plan to an equipment profile, kept off the junk.
const standIn = (slot, equipment, taken) =>
  substituteFor(EXIDX[SLOTS[slot].prefer[0]], equipment, new Set([...taken, ...JUNK_IDS]))

// A main lift under the strength goal repeats its best pick; everything else varies.
const varies = (slot, goal) => goal !== 'strength' || SLOTS[slot].kind !== 'main'

// The pattern's own list first. A pattern with an `alt` then hands over to it, and that one to
// its own (a biceps curl with no bar asks for a vertical pull, which asks for a row), so the
// person is told plainly what stands where. The last pattern in a chain, having no alt, takes
// the closest stand-in the catalogue holds, because for a squat or a push any same-pattern
// exercise beats a hole. `via` is the pattern the exercise came from.
function resolve(slot, equipment, taken, cursor, goal, seen = new Set()) {
  const own = fromList(slot, equipment, taken, cursor, varies(slot, goal))
  if (own) return { ex: own, via: slot }
  const alt = SLOTS[slot].alt
  if (alt && !seen.has(alt)) { seen.add(slot); return resolve(alt, equipment, taken, cursor, goal, seen) }
  const sub = standIn(slot, equipment, taken)
  return sub ? { ex: sub, via: slot } : null
}

// A routine slot for the exercise: the catalogue's own default shape (a plank is a timed hold, a
// body-weight move carries its flag), with the goal's sets and reps on top. Weight starts at 0,
// like a starter plan; the first session fills it in.
export function entryFor(ex, kind, goal) {
  const cfg = defaultConfig(ex.id)
  const [sets, reps] = SCHEMES[goal][kind]
  cfg.sets = sets
  if (cfg.mode === 'reps') cfg.reps = isBodyweightEq(ex) ? Math.max(reps, BW_MIN_REPS) : reps
  return { id: ex.id, ...cfg }
}

/* The plan: { split, routines, schedule, notes }, or null for options the builder does not know.
   routines are fresh routine objects (new ids, independent), schedule is [{ day, routineId }],
   and notes lists every pattern that could not be filled as itself: { routine, slot, alt }, alt
   being the pattern that stood in, or null when the slot was left out altogether.
   `equipment` is a bare list the way an equipment profile holds it (lib/equipment.js); an empty
   list is body weight only, which is the honest plan for someone with nothing. */
export function buildPlan({ equipment = [], days = 3, goal = 'muscle', length = 6 } = {}) {
  const split = SPLITS[days]
  if (!split || !SCHEMES[goal] || !LENGTHS.includes(length)) return null
  const have = Array.isArray(equipment) ? equipment : []
  const cursor = {}
  const notes = []
  const built = split.routines.map(([name, emoji, slots, day]) => {
    const taken = new Set()
    const ex = []
    for (const slot of slots.slice(0, length)) {
      const got = resolve(slot, have, taken, cursor, goal)
      if (!got) { notes.push({ routine: name, slot, alt: null }); continue }
      if (got.via !== slot) notes.push({ routine: name, slot, alt: got.via })
      taken.add(got.ex.id)
      ex.push(entryFor(got.ex, SLOTS[slot].kind, goal))
    }
    return { routine: { id: uid(), name, emoji, ex }, day }
  })
  return {
    split: split.split,
    routines: built.map(b => b.routine),
    schedule: built.map(b => ({ day: b.day, routineId: b.routine.id })),
    notes
  }
}
