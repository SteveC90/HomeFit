// "Build my plan": a plan generated from the equipment you tick, offline (lib/plan-builder.js).
// The sheet is only the controls and a live preview; sheets.jsx opens it and writes the result
// into the store, the way the starter plan chooser does, so the two load through one path.
import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { exerciseNameText } from '../lib/format.js'
import { EXIDX } from '../lib/exercises.js'
import { ALL_EQUIPMENT, profileEquipment } from '../lib/equipment.js'
import { ownsNoDumbbells } from '../lib/dumbbells.js'
import { buildPlan, DAY_OPTIONS, GOALS, LENGTHS } from '../lib/plan-builder.js'
import Icon from './Icon.jsx'
import { Button, Segmented } from './ui.jsx'

// Pattern and goal names as literals inside t(), where check-source-strings.mjs can see them.
export const SLOT_COPY = {
  squat: () => t('Squat'), hinge: () => t('Hinge'), lunge: () => t('Lunge'),
  hpush: () => t('Horizontal push'), vpush: () => t('Vertical push'), chest: () => t('Chest'),
  hpull: () => t('Horizontal pull'), vpull: () => t('Vertical pull'),
  legcurl: () => t('Leg curl'), calves: () => t('Calves'), biceps: () => t('Biceps'), triceps: () => t('Triceps'),
  lateral: () => t('Side delts'), reardelt: () => t('Rear delts'), core: () => t('Core')
}
const GOAL_COPY = { strength: () => t('Get stronger'), muscle: () => t('Build muscle'), general: () => t('General fitness') }

// What a note under the preview says: the pattern that found nothing, and what the routine does
// about it.
export const noteText = n => (n.alt
  ? t('{0}: nothing fits this equipment, so {1} gets {2} instead.', SLOT_COPY[n.slot](), n.routine, SLOT_COPY[n.alt]())
  : t('{0}: nothing fits this equipment, so {1} skips it.', SLOT_COPY[n.slot](), n.routine))

// The equipment the sheet opens with: the profile you filter by, else your first one, else
// nothing ticked, which builds a body-weight plan.
const startingEquipment = S => {
  const profiles = S.equipProfiles || []
  const p = profiles.find(x => x.id === S.activeEquipId) || profiles[0]
  return new Set(p ? profileEquipment(p) : [])
}

export default function PlanBuilderSheet({ onLoad }) {
  const S = useStore(s => s.S)
  const profiles = S.equipProfiles || []
  // "I own no dumbbells" (Settings → Equipment) holds here too: the chip is off and stays off.
  const noDumbbells = ownsNoDumbbells(S)
  const [checked, setChecked] = useState(() => startingEquipment(S))
  const [days, setDays] = useState(3)
  const [goal, setGoal] = useState('muscle')
  const [length, setLength] = useState(6)
  const equipment = useMemo(() => [...checked].filter(e => !(noDumbbells && e === 'dumbbell')), [checked, noDumbbells])
  const plan = useMemo(() => buildPlan({ equipment, days, goal, length }), [equipment, days, goal, length])
  const toggle = k => setChecked(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  return <>
    <h3>{t('Build a plan from your equipment')}</h3>
    <div className="muted small" style={{ marginBottom: 10 }}>{t('Tick what you train with. Nothing ticked means body weight only.')}</div>
    {profiles.length > 0 && <div className="chips" style={{ margin: '0 0 10px' }}>
      <div className="small dim" style={{ width: '100%' }}>{t('Start from a profile')}</div>
      {profiles.map(p => <button key={p.id} className="chip nocap" data-plan-profile onClick={() => setChecked(new Set(profileEquipment(p)))}>{p.name}</button>)}
    </div>}
    <div className="chips" data-plan-equipment>
      {ALL_EQUIPMENT.map(k => (
        <button key={k} className={'chip' + (checked.has(k) && !(noDumbbells && k === 'dumbbell') ? ' on' : '')}
          disabled={noDumbbells && k === 'dumbbell'} onClick={() => toggle(k)}>{t(k)}</button>
      ))}
    </div>
    <div className="dim small" style={{ marginTop: 10 }}>{t('Body-weight exercises are always available, unless they need a pull-up bar or a bench.')}</div>

    <h4 className="sec">{t('Days per week')}</h4>
    <Segmented className="plan-days" value={days} onChange={setDays} options={DAY_OPTIONS.map(n => ({ value: n, label: String(n) }))} />
    <h4 className="sec">{t('Goal')}</h4>
    <Segmented className="plan-goal" value={goal} onChange={setGoal} options={GOALS.map(g => ({ value: g, label: GOAL_COPY[g]() }))} />
    <h4 className="sec">{t('Exercises per session')}</h4>
    <Segmented className="plan-length" value={length} onChange={setLength} options={LENGTHS.map(n => ({ value: n, label: String(n) }))} />

    <h4 className="sec">{t('Routines')}</h4>
    <div className="list" data-plan-preview>
      {plan.routines.map(r => <div key={r.id} className="item" data-plan-routine>
        <span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name={r.emoji} /></span>
        <div className="grow">
          <div className="tt">{r.name}</div>
          <div className="ss">{r.ex.map(e => exerciseNameText(EXIDX[e.id])).join(' · ')}</div>
        </div>
      </div>)}
    </div>
    {plan.notes.map((n, i) => <div key={i} className="small dim" style={{ marginTop: 6 }} data-plan-note>{noteText(n)}</div>)}
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={() => onLoad(plan)}>{t('Load plan')}</Button>
  </>
}
