# Plan builder

Plan → header menu → **Build my plan** (also the first button on an empty Plan page). A plan
generated from the equipment you tick, offline, with no model behind it. HomeFit's reason to
exist as a fork: the upstream starter plans are four fixed barbell programmes that get *fitted*
to an equipment profile by swapping exercises out; this builds the plan *from* the equipment.

## Where it lives

| File | What it does |
|---|---|
| `frontend/src/lib/plan-builder.js` | The generator. Pure, deterministic, unit-tested beside it. |
| `frontend/src/components/PlanBuilderSheet.jsx` | The sheet: equipment chips, days, goal, session length, live preview, notes. |
| `frontend/src/sheets.jsx` (`planBuilderSheet`, `loadBuiltPlan`) | Opens the sheet, asks before overwriting a weekday, writes the plan into the store through the same path as a starter plan. |
| `frontend/src/views/Plan.jsx` | The menu entry and the empty-state button. |

## How a plan is built

1. **A split for the days you train.** 2 or 3 days: Full Body A/B(/C). 4: Upper/Lower A and B.
   5: Push, Pull, Legs, Upper, Lower. 6: Push/Pull/Legs twice. Fixed weekdays, like the starter
   plans (Monday is 1).
2. **Each session is a list of movement patterns** in priority order: squat, hinge, lunge,
   horizontal push, vertical push, a second chest movement, horizontal pull, vertical pull, leg
   curl, calves, biceps, triceps, side delts, rear delts, core. The session length (4, 6 or 8)
   cuts the list from the back, so a short session is always the compound lifts.
3. **Each pattern has an ordered preference list of catalogue ids** across every kind of
   equipment: the barbell lift first, then the Smith machine and machines, dumbbells,
   kettlebells, cables, the suspension trainer, bands, and the body-weight version last. The
   first one the equipment allows is the pick. Availability is `eqAvailable` from
   `lib/equipment.js`, so the bench and the pull-up bar gate what they gate ("dumbbell bench
   press" waits for a bench, "pull-up" and "hanging leg raise" for a bar).
4. **Variation.** A pattern filled more than once across the plan walks down its list, so Full
   Body A and B do not open with the same press, and a Push day's two triceps slots are two
   different exercises. The exception is a main lift under the strength goal, which repeats
   its best pick: that is what practising a lift means.
5. **When nothing fits.** A pattern with an `alt` hands over to it (vertical pull → horizontal
   pull, side delts → vertical push, leg curl → hinge, ...), chained, and the sheet says so
   under the preview: "Vertical pull: nothing fits this equipment, so Upper A gets Horizontal
   pull instead." A pattern with no alt (squat, hinge, the pushes and rows, calves, core) takes
   the closest stand-in the catalogue holds, through the same `substituteFor` that fits a
   starter plan, kept off drawing variants, "v. 2" duplicates and furniture improvisations.
6. **Sets and reps** follow the goal and the pattern's kind:

   | | main | secondary | accessory | core |
   |---|---|---|---|---|
   | Get stronger | 5×5 | 3×8 | 3×10 | 3×12 |
   | Build muscle | 4×8 | 3×10 | 3×12 | 3×15 |
   | General fitness | 3×10 | 3×12 | 2×15 | 3×15 |

   A body-weight exercise never starts below 8 reps (five push-ups is not a set). A hold (plank,
   hollow hold) is a timed set at the catalogue's default seconds. Weight starts at 0, as in a
   starter plan; the first session fills it in and progression takes over from there.

## Equipment

The sheet opens ticked like the profile you filter by (else your first profile, else nothing).
Tapping a profile chip replaces the ticks; the chips can then be edited freely. Nothing ticked
builds a body-weight plan that needs no bench and no bar, which is the honest plan for a hotel
room. "I own no dumbbells" (Settings → Equipment) holds here too.

## Adding or changing an exercise

Edit the `prefer` list of the pattern in `plan-builder.js`. Keep the order by equipment
(loaded bar first, body weight last) and never list an exercise whose name carries "bench",
"incline", "decline", "pull-up", "chin-up" or "hanging" as a body-weight option: those words
make `lib/equipment.js` ask for the bench or the bar. `plan-builder.test.js` checks that every
pattern can still be met with no equipment at all, directly or through its alt chain.
