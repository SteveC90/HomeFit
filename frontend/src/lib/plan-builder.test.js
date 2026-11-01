import { describe, expect, it } from 'vitest'
import { EXIDX, isBodyweightEq } from './exercises.js'
import { ALL_EQUIPMENT, accessoriesOf, eqAvailable } from './equipment.js'
import { buildPlan, BW_MIN_REPS, DAY_OPTIONS, GOALS, LENGTHS, SCHEMES, SLOTS, SPLITS } from './plan-builder.js'

// A home gym with a bar, a bench and somewhere to hang from: the setup the lists lead with.
const HOME = ['barbell', 'dumbbell', 'bench', 'pull-up bar']
const SETUPS = { home: HOME, nothing: [], dumbbells: ['dumbbell'], bands: ['band', 'resistance band'], kettlebell: ['kettlebell', 'pull-up bar'], everything: ALL_EQUIPMENT }

const ids = r => r.ex.map(e => e.id)
const shape = r => r.ex.map(e => [e.id, e.sets, e.mode === 'time' ? e.sec + 's' : e.reps])
const every = fn => { for (const days of DAY_OPTIONS) for (const goal of GOALS) for (const length of LENGTHS) fn({ days, goal, length }) }

// Mobility, warm-up and stretching never make a plan; the lists are checked for it by category.
const NOT_A_LIFT = new Set(['stretching', 'mobility', 'yoga', 'rehab', 'cardio', 'pilates', 'combat'])

describe('the pattern lists', () => {
  it('name real exercises, each once, none of them mobility work', () => {
    for (const [slot, { prefer }] of Object.entries(SLOTS)) {
      expect(new Set(prefer).size, slot).toBe(prefer.length)
      for (const id of prefer) {
        expect(EXIDX[id], `${slot} ${id}`).toBeTruthy()
        expect(NOT_A_LIFT.has(EXIDX[id].cat), `${slot} ${id} ${EXIDX[id].n}`).toBe(false)
      }
    }
  })

  it('can each be met with no equipment at all, directly or through their alt', () => {
    // Someone with nothing ticked must still get a full session: every pattern, followed along
    // its alt chain, reaches an exercise that is body weight and needs neither bench nor bar.
    const bare = ex => ex.eq === 'body weight' && accessoriesOf(ex).length === 0
    for (const slot of Object.keys(SLOTS)) {
      let s = slot, found = false
      while (s && !found) { found = SLOTS[s].prefer.some(id => bare(EXIDX[id])); s = SLOTS[s].alt }
      expect(found, slot).toBe(true)
    }
  })

  it('offer a split for every day count, each day used once, each routine a pattern list', () => {
    for (const days of DAY_OPTIONS) {
      const { routines } = SPLITS[days]
      expect(routines).toHaveLength(days)
      expect(new Set(routines.map(([, , , day]) => day)).size).toBe(days)
      for (const [, , slots] of routines) {
        expect(slots.length).toBeGreaterThanOrEqual(Math.max(...LENGTHS))
        for (const slot of slots) expect(SLOTS[slot], slot).toBeTruthy()
      }
    }
  })
})

describe('buildPlan', () => {
  it('returns null for options it does not know, and changes nothing', () => {
    expect(buildPlan({ days: 7 })).toBeNull()
    expect(buildPlan({ days: 1 })).toBeNull()
    expect(buildPlan({ goal: 'cardio' })).toBeNull()
    expect(buildPlan({ length: 5 })).toBeNull()
    expect(buildPlan({ days: '3' })).not.toBeNull()   // a string from a control still names the split
  })

  it('makes one routine per training day, on distinct weekdays, the schedule naming each by id', () => {
    for (const days of DAY_OPTIONS) {
      const plan = buildPlan({ equipment: HOME, days })
      expect(plan.routines).toHaveLength(days)
      expect(plan.schedule).toHaveLength(days)
      expect(new Set(plan.schedule.map(s => s.day)).size).toBe(days)
      const byId = new Set(plan.routines.map(r => r.id))
      for (const { day, routineId } of plan.schedule) {
        expect(byId.has(routineId)).toBe(true)
        expect(day).toBeGreaterThanOrEqual(0)
        expect(day).toBeLessThanOrEqual(6)
      }
      expect(plan.split).toBe(SPLITS[days].split)
    }
  })

  it('fills every slot from a full gym, no exercise twice in a routine, nothing to note', () => {
    every(opts => {
      const plan = buildPlan({ ...opts, equipment: ALL_EQUIPMENT })
      expect(plan.notes, JSON.stringify(opts)).toEqual([])
      for (const r of plan.routines) {
        expect(r.ex, `${r.name} ${JSON.stringify(opts)}`).toHaveLength(opts.length)
        expect(new Set(ids(r)).size).toBe(opts.length)
      }
    })
  })

  it('uses only exercises the equipment allows, whatever the setup', () => {
    for (const [name, equipment] of Object.entries(SETUPS)) {
      every(opts => {
        for (const r of buildPlan({ ...opts, equipment }).routines) {
          for (const e of r.ex) {
            const ex = EXIDX[e.id]
            expect(ex, `${name}: ${e.id}`).toBeTruthy()
            expect(eqAvailable(equipment, ex), `${name} ${r.name}: ${ex.n} (${ex.eq})`).toBe(true)
          }
          expect(new Set(ids(r)).size, `${name} ${r.name}`).toBe(r.ex.length)
        }
      })
    }
  })

  it('with nothing ticked builds a full body-weight plan that needs no bench or bar', () => {
    every(opts => {
      const plan = buildPlan({ ...opts, equipment: [] })
      for (const r of plan.routines) {
        expect(r.ex, `${r.name} ${JSON.stringify(opts)}`).toHaveLength(opts.length)
        for (const e of r.ex) {
          expect(EXIDX[e.id].eq).toBe('body weight')
          expect(accessoriesOf(EXIDX[e.id])).toEqual([])
        }
      }
    })
  })

  it('leads with the barbell lifts at home, five by five under the strength goal', () => {
    const [a] = buildPlan({ equipment: HOME, days: 3, goal: 'strength', length: 6 }).routines
    expect(a.name).toBe('Full Body A')
    // squat, bench, row, deadlift, press, then the plank as a timed hold
    expect(shape(a)).toEqual([
      ['0043', 5, 5], ['0025', 5, 5], ['0027', 5, 5], ['0032', 5, 5], ['1162', 5, 5], ['0463', 3, '45s']
    ])
    expect(a.ex[5].mode).toBe('time')
    for (const e of a.ex) expect(e.weight).toBe(0)
  })

  it('repeats the main lifts under strength and varies them for muscle', () => {
    const strength = buildPlan({ equipment: HOME, days: 3, goal: 'strength', length: 6 }).routines
    expect(ids(strength[0])[1]).toBe('0025')      // bench press in A
    expect(ids(strength[2])[1]).toBe('0025')      // and again in C: practice
    const muscle = buildPlan({ equipment: HOME, days: 3, goal: 'muscle', length: 6 }).routines
    expect(ids(muscle[0])[1]).toBe('0025')
    expect(ids(muscle[2])[1]).not.toBe('0025')    // C opens its press on the next option
    // Accessories vary either way: the two curls of a long Pull day are two different curls.
    const pull = buildPlan({ equipment: ALL_EQUIPMENT, days: 6, goal: 'strength', length: 8 }).routines[1]
    const curls = ids(pull).filter(id => /curl/.test(EXIDX[id].n))
    expect(curls.length).toBe(2)
    expect(curls[0]).not.toBe(curls[1])
  })

  it('never starts a weightless exercise below the rep floor, but keeps its sets', () => {
    for (const equipment of [[], HOME, ['kettlebell', 'pull-up bar']]) {
      every(opts => {
        for (const r of buildPlan({ ...opts, equipment }).routines) {
          for (const e of r.ex) {
            if (e.mode !== 'reps' || !isBodyweightEq(e.id)) continue
            expect(e.reps, `${r.name}: ${EXIDX[e.id].n}`).toBeGreaterThanOrEqual(BW_MIN_REPS)
          }
        }
      })
    }
    const [a] = buildPlan({ equipment: ['kettlebell', 'pull-up bar'], days: 3, goal: 'strength', length: 4 }).routines
    const pushUp = a.ex.find(e => e.id === '0662')
    expect(pushUp).toMatchObject({ sets: 5, reps: BW_MIN_REPS, bodyweight: true })
  })

  it('hands a pattern nothing fits to its alt, says so, and still fills the session', () => {
    const plan = buildPlan({ equipment: [], days: 4, goal: 'muscle', length: 8 })
    const upperA = plan.routines[0]
    expect(upperA.ex).toHaveLength(8)
    // No bar: the vertical pull becomes a second row, and the note names both patterns.
    expect(plan.notes).toContainEqual({ routine: 'Upper A', slot: 'vpull', alt: 'hpull' })
    for (const n of plan.notes) {
      expect(SLOTS[n.slot]).toBeTruthy()
      expect(n.alt === null || !!SLOTS[n.alt]).toBe(true)
      expect(n.alt).not.toBe(n.slot)
    }
    // A bar back, the pull-up is there and the note is gone.
    const withBar = buildPlan({ equipment: ['pull-up bar'], days: 4, goal: 'muscle', length: 8 })
    expect(ids(withBar.routines[0])).toContain('0652')
    expect(withBar.notes.some(n => n.slot === 'vpull')).toBe(false)
  })

  it('follows the goal scheme per slot kind', () => {
    const plan = buildPlan({ equipment: ALL_EQUIPMENT, days: 4, goal: 'general', length: 8 })
    const [upperA, lowerA] = plan.routines
    const [mainSets, mainReps] = SCHEMES.general.main
    const [accSets, accReps] = SCHEMES.general.accessory
    expect(upperA.ex[0]).toMatchObject({ id: '0025', sets: mainSets, reps: mainReps })      // horizontal push: main
    expect(upperA.ex[4]).toMatchObject({ id: '0334', sets: accSets, reps: accReps })        // side delts: accessory
    expect(lowerA.ex[5]).toMatchObject({ id: '0463', sets: SCHEMES.general.core[0], mode: 'time' })   // core: a hold
  })

  it('shortens a session from the back, so four exercises are the compound lifts', () => {
    // Checked on the first routine of each split: the ones after it vary with how often a
    // pattern was already filled, and a longer session fills some patterns twice.
    for (const goal of GOALS) {
      for (const days of DAY_OPTIONS) {
        const [long] = buildPlan({ equipment: ALL_EQUIPMENT, days, goal, length: 8 }).routines
        const [short] = buildPlan({ equipment: ALL_EQUIPMENT, days, goal, length: 4 }).routines
        expect(ids(short)).toEqual(ids(long).slice(0, 4))
      }
    }
  })

  it('is the same plan for the same choices, with fresh ids and independent objects each time', () => {
    const a = buildPlan({ equipment: HOME, days: 4, goal: 'muscle', length: 6 })
    const b = buildPlan({ equipment: HOME, days: 4, goal: 'muscle', length: 6 })
    expect(a.routines.map(shape)).toEqual(b.routines.map(shape))
    expect(a.routines.map(r => r.id)).not.toEqual(b.routines.map(r => r.id))
    a.routines[0].ex[0].sets = 99
    expect(b.routines[0].ex[0].sets).not.toBe(99)
  })

  it('writes routine slots the app can open: sets, reps or seconds, a zero weight, the hold flag', () => {
    every(opts => {
      for (const r of buildPlan({ ...opts, equipment: HOME }).routines) {
        expect(typeof r.id).toBe('string')
        expect(typeof r.name).toBe('string')
        expect(typeof r.emoji).toBe('string')
        for (const e of r.ex) {
          expect(e.sets).toBeGreaterThan(0)
          expect(e.weight).toBe(0)
          if (e.mode === 'time') { expect(e.sec).toBeGreaterThan(0); expect(EXIDX[e.id].hd).toBeTruthy() }
          else { expect(e.mode).toBe('reps'); expect(e.reps).toBeGreaterThan(0) }
        }
      }
    })
  })
})
