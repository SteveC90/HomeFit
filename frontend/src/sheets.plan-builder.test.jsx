// @vitest-environment happy-dom
// Loading a built plan: the routines land in the store and on their weekdays, a taken weekday
// asks first, a cancel changes nothing, and loading the same plan twice adds nothing twice.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { loadBuiltPlan, planBuilderSheet } from './sheets.jsx'
import { buildPlan } from './lib/plan-builder.js'

const mounted = []
const S = () => useStore.getState().S
const nameOn = day => S().routines.find(r => r.id === [].concat(S().week[day] ?? [])[0])?.name

function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const buttonFor = (host, label) => [...host.querySelectorAll('button')].find(b => b.textContent === label)
const segButton = (host, cls, label) => [...host.querySelectorAll(`.${cls} button`)].find(b => b.textContent === label)

// Opens the builder, optionally picks a day count, and taps Load.
function build(days) {
  planBuilderSheet()
  const host = renderTop()
  if (days) act(() => { segButton(host, 'plan-days', String(days)).click() })
  act(() => { buttonFor(host, 'Load plan').click() })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState(s => ({
    S: { ...s.S, routines: [{ id: 'mine', name: 'My routine', emoji: 'star', ex: [] }], week: {}, active: null, equipProfiles: [], activeEquipId: null, dumbbells: {} },
  }))
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('loadBuiltPlan', () => {
  it('adds the routines and puts them on their weekdays, leaving the rest alone', () => {
    useStore.setState(s => ({ S: { ...s.S, week: { 0: ['mine'] } } }))
    const plan = buildPlan({ equipment: ['barbell'], days: 4, goal: 'muscle', length: 6 })
    expect(loadBuiltPlan(plan)).toBe(true)
    expect(nameOn(1)).toBe('Upper A')
    expect(nameOn(2)).toBe('Lower A')
    expect(nameOn(4)).toBe('Upper B')
    expect(nameOn(5)).toBe('Lower B')
    expect(S().week[0]).toEqual(['mine'])
    expect(S().routines[0].name).toBe('My routine')
    expect(S().routines).toHaveLength(5)
    expect(useUI.getState().toastMsg).toBe('4 routines added to your week')
  })

  it('reuses the routines it added last time instead of adding them twice', () => {
    const opts = { equipment: ['dumbbell', 'bench'], days: 3, goal: 'general', length: 6 }
    expect(loadBuiltPlan(buildPlan(opts))).toBe(true)
    const ids = S().routines.map(r => r.id)
    expect(loadBuiltPlan(buildPlan(opts))).toBe(true)
    expect(S().routines.map(r => r.id)).toEqual(ids)
    expect(S().routines.filter(r => r.name === 'Full Body A')).toHaveLength(1)
    // Built for other equipment, the exercises differ, so it is added alongside.
    expect(loadBuiltPlan(buildPlan({ ...opts, equipment: ['barbell'] }))).toBe(true)
    expect(S().routines.filter(r => r.name === 'Full Body A')).toHaveLength(2)
  })

  it('changes nothing for anything that is not a plan', () => {
    const before = structuredClone(S())
    expect(loadBuiltPlan(null)).toBe(false)
    expect(loadBuiltPlan({ routines: [] })).toBe(false)
    expect(loadBuiltPlan({ type: 'click' })).toBe(false)
    expect(S()).toEqual(before)
    expect(useUI.getState().toastMsg).toBe('')
  })
})

describe('the plan builder sheet', () => {
  it('loads straight away when its weekdays are free', () => {
    useStore.setState(s => ({ S: { ...s.S, week: { 6: ['mine'] } } }))
    build()
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(nameOn(1)).toBe('Full Body A')
    expect(nameOn(3)).toBe('Full Body B')
    expect(nameOn(5)).toBe('Full Body C')
    expect(S().week[6]).toEqual(['mine'])
    expect(useUI.getState().toastMsg).toBe('3 routines added to your week')
  })

  it('asks first when a weekday it wants is taken, and loads on confirm', () => {
    useStore.setState(s => ({ S: { ...s.S, week: { 2: ['mine'] } } }))
    build(4)
    const confirm = renderTop()
    expect(confirm.querySelector('h3').textContent).toBe('Load Upper / Lower?')
    expect(confirm.textContent).toContain('Monday, Tuesday, Thursday and Friday')
    expect(S().routines).toHaveLength(1)
    act(() => { buttonFor(confirm, 'Load plan').click() })
    expect(nameOn(2)).toBe('Lower A')
    expect(S().routines).toHaveLength(5)
  })

  it('leaves everything alone when the confirmation is cancelled', () => {
    useStore.setState(s => ({ S: { ...s.S, week: { 1: ['mine'] } } }))
    const before = structuredClone(S())
    build()
    const confirm = renderTop()
    act(() => { buttonFor(confirm, 'Cancel').click() })
    expect(S()).toEqual(before)
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('does not ask when only weekdays outside the plan are occupied', () => {
    useStore.setState(s => ({ S: { ...s.S, week: { 2: ['mine'], 4: ['mine'] } } }))
    build()   // three days: Monday, Wednesday, Friday
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(nameOn(1)).toBe('Full Body A')
    expect(S().week[2]).toEqual(['mine'])
  })
})
