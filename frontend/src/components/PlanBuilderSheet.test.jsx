// @vitest-environment happy-dom
// The plan builder sheet: what it opens with, that the preview follows every control, that the
// equipment switches hold, and that Load hands over exactly the plan on screen.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { EXIDX } from '../lib/exercises.js'
import PlanBuilderSheet from './PlanBuilderSheet.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const HOME = { id: 'home', name: 'Home', equipment: ['dumbbell', 'bench'], accV: 2 }
const GYM = { id: 'gym', name: 'Gym', equipment: ['barbell', 'bench', 'pull-up bar', 'cable'], accV: 2 }

let root, host, onLoad
const mount = () => {
  onLoad = vi.fn()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<PlanBuilderSheet onLoad={onLoad} />))
}
const setS = patch => useStore.setState(s => ({ S: { ...s.S, ...patch } }))

const chip = label => [...host.querySelectorAll('[data-plan-equipment] .chip')].find(b => b.textContent === label)
const onChips = () => [...host.querySelectorAll('[data-plan-equipment] .chip.on')].map(b => b.textContent)
const seg = (cls, label) => [...host.querySelectorAll(`.${cls} button`)].find(b => b.textContent === label)
const routines = () => [...host.querySelectorAll('[data-plan-routine]')].map(el => ({ name: el.querySelector('.tt').textContent, ex: el.querySelector('.ss').textContent }))
const notes = () => [...host.querySelectorAll('[data-plan-note]')].map(el => el.textContent)
const click = el => act(() => { el.click() })

beforeEach(() => {
  setS({ equipProfiles: [], activeEquipId: null, equipFilterOn: false, dumbbells: {} })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => root.unmount()) })

describe('PlanBuilderSheet', () => {
  it('opens with nothing ticked and a three-day body-weight plan when there is no profile', () => {
    mount()
    expect(host.querySelector('[data-plan-profile]')).toBeNull()
    expect(onChips()).toEqual([])
    expect(routines().map(r => r.name)).toEqual(['Full Body A', 'Full Body B', 'Full Body C'])
    expect(routines()[0].ex).toMatch(/push-up/i)
    expect(routines()[0].ex).not.toMatch(/bench press|barbell|dumbbell/i)
  })

  it('opens ticked like the profile you filter by, and a profile chip replaces the ticks', () => {
    setS({ equipProfiles: [HOME, GYM], activeEquipId: 'gym' })
    mount()
    expect(onChips()).toEqual(expect.arrayContaining(['barbell', 'bench', 'pull-up bar', 'cable']))
    expect(onChips()).not.toContain('dumbbell')
    expect(routines()[0].ex).toMatch(/barbell bench press/i)
    click([...host.querySelectorAll('[data-plan-profile]')].find(b => b.textContent === 'Home'))
    expect(onChips().sort()).toEqual(['bench', 'dumbbell'])
    expect(routines()[0].ex).toMatch(/dumbbell bench press/i)
    expect(routines()[0].ex).not.toMatch(/barbell/i)
  })

  it('rebuilds the preview as the ticks and the controls change', () => {
    mount()
    click(chip('barbell'))
    expect(routines()[0].ex).toMatch(/barbell full squat/i)
    click(seg('plan-days', '4'))
    expect(routines().map(r => r.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
    click(seg('plan-length', '4'))
    expect(routines()[0].ex.split(' · ')).toHaveLength(4)
    click(seg('plan-length', '8'))
    expect(routines()[0].ex.split(' · ')).toHaveLength(8)
    click(chip('barbell'))   // off again
    expect(routines()[1].ex).not.toMatch(/barbell/i)
  })

  it('tells you which pattern found nothing and what stands in for it', () => {
    mount()
    click(seg('plan-days', '4'))
    expect(notes().some(n => n.startsWith('Vertical pull:') && n.includes('Upper A') && n.includes('Horizontal pull'))).toBe(true)
    click(chip('pull-up bar'))
    expect(notes().some(n => n.startsWith('Vertical pull:'))).toBe(false)
    expect(routines()[0].ex).toMatch(/pull-up/i)
  })

  it('keeps dumbbells out when you own none, even if the profile ticks them', () => {
    setS({ equipProfiles: [HOME], activeEquipId: 'home', dumbbells: { none: { on: true, _ts: 1 } } })
    mount()
    expect(chip('dumbbell').disabled).toBe(true)
    expect(onChips()).toEqual(['bench'])
    for (const r of routines()) expect(r.ex).not.toMatch(/dumbbell/i)
  })

  it('hands Load the plan on screen', () => {
    setS({ equipProfiles: [GYM], activeEquipId: 'gym' })
    mount()
    click(seg('plan-goal', 'Get stronger'))
    click([...host.querySelectorAll('button')].find(b => b.textContent === 'Load plan'))
    expect(onLoad).toHaveBeenCalledTimes(1)
    const plan = onLoad.mock.calls[0][0]
    expect(plan.routines.map(r => r.name)).toEqual(routines().map(r => r.name))
    expect(plan.routines[0].ex[0]).toMatchObject({ id: '0043', sets: 5, reps: 5 })
    expect(plan.routines[0].ex.map(e => EXIDX[e.id].n).join(' · ')).toBe(routines()[0].ex.toLowerCase())
  })
})
