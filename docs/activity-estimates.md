# BMI and activity estimates

`activity-estimates.js` is a pure, dependency-free public helper. It exports `OY_ACTIVITY_ESTIMATES` in a browser and the same API through CommonJS. It reads no profile, network, storage, clock or database. Personal values come from the authenticated app; no actual user measurements are embedded in the helper or its synthetic tests.

## BMI

`bmi(heightCm, weightKg)` returns `weightKg / (heightCm / 100)²`, or `null` for invalid inputs. The app derives current weight from actual check-ins and does not persist a second BMI fact. BMI describes weight relative to height; it does not distinguish muscle, fat or bone. The helper assigns no diagnostic category or body-fat percentage and does not use BMI in activity calculations. [CDC: About BMI](https://www.cdc.gov/bmi/about/index.html).

## Activity method

Reference version `2024-compendium-level-v1` selects published 2024 Adult Compendium entries for level-ground running and firm-surface walking. `rows.run` contains codes 12028 through the selected 12135 entry; `rows.walk` contains selected codes 17152–17231. Each row exposes its exact source code, unchanged MET, and published speed interval in mph. Inclines, trails, loads, mixed run/walk, generic gym work and other activities are outside this model. References: [running](https://pacompendium.com/running/), [walking](https://pacompendium.com/walking/).

The [Compendium home page](https://pacompendium.com/) defines one MET as approximately 1 kcal/kg/hour. Using recorded duration and weight, the app calculates:

```text
speed mph = distance km / 1.609344 / (duration minutes / 60)
gross kcal = MET × weight kg × duration minutes / 60
active kcal = max(0, MET − 1) × weight kg × duration minutes / 60
```

Gross includes a standard resting component; active subtracts that component. Both are population-reference approximations, not measured or individually calibrated expenditure. Do not add either number to calorie goals or food remaining. Distance and duration must be actual entries; opening a plan or recording a previous mile baseline supplies neither.

Running support spans 4–14 mph and walking 2–5.5 mph. Speeds inside an interval use that published row. Internal gaps choose the nearest interval and set `nearestReference: true`; exact-distance ties select the slower interval. The app must visibly label this approximation. No MET interpolation or extrapolation is performed. The small `1e-10` mph comparison tolerance absorbs floating-point conversion roundoff at interval boundaries.

The [Adult Compendium reference](https://pacompendium.com/adult-compendium/) covers ages 19–59. A supplied age outside this range returns unavailable. Unknown age does not block logging or the generic reference estimate, but details must retain the adult-reference caveat. This is not an age-specific model. Source pages and values were checked October 21, 2026; commercial reuse with citation is permitted, while changing MET values or combining activities with differing METs is discouraged by the source.

## API and validity

All measurement arguments must be finite JavaScript numbers; blanks, numeric strings and booleans are not coerced.

- `bmi(heightCm, weightKg) → number | null`: accepts heights 100–250 cm and weights 20–400 kg.
- `weightAsOf(checkins, date) → {date, weightKg} | null`: accepts a keyed object such as `{'2026-04-09': {weightKg: 80}}` and a real ISO calendar date. Picks the latest valid weight date on or before the requested date, skipping malformed dates, missing weights and invalid records. Later check-ins never supply an earlier workout. The returned object is detached and frozen.
- `distanceKm(value, unit) → number | null`: accepts positive distance with unit `'km'` or `'mile'`, converting with exactly 1.609344 km per mile. Canonical output may not exceed 1,000 km.
- `estimate({activity, durationMinutes, distanceKm, weightKg, weightDate, age?})`: accepts explicit activity `'run'` or `'walk'`, positive duration up to 1,440 minutes, positive canonical distance up to 1,000 km, weight 20–400 kg and a valid weight-source date. Optional age may be absent, `null` or empty; supplied numeric age must be within the adult reference range.
- `version` and deeply frozen `rows` expose the source-table version and rows for review.

These are software bounds, not clinical cutoffs. The current workout form additionally caps duration at 480 minutes; the pure helper remains reusable through 1,440 minutes. An unavailable result is the frozen object `{available: false, reason}`. Missing distance can therefore leave duration-only cardio logging usable without inventing a burn estimate.

An available result is a frozen JSON-safe snapshot with these fields:

```text
available, version, sourceURL, sourceCode, met,
referenceSpeedMinMph, referenceSpeedMaxMph, nearestReference,
activity, durationMinutes, distanceKm, weightKg, weightDate,
method, grossKcal, activeKcal, speedMph
```

Values remain unrounded in the snapshot; the interface should round presentation sensibly and call them estimates. All fields are primitives, so freezing also prevents nested mutation. Serialization preserves the snapshot, although objects reconstructed from database JSON must be treated as historical values by the caller.

The caller must pass `weightAsOf(checkins, workoutDate)` into `estimate`; `estimate` has no workout-date parameter and cannot independently check chronological provenance. A valid `weightDate` alone does not establish that it preceded an activity. The app also controls account isolation, completion state and save behavior.

## Historical preservation and integration checks

Save the estimate with an explicitly logged activity. A later weight check-in, profile change or table revision must not recalculate history. When editing a workout, preserve its original snapshot if actual activity inputs are unchanged, including its original weight provenance. An intentional duration, distance or activity change may recompute using the applicable weight as of that workout date. The caller owns this unchanged-versus-edited decision; the pure helper never writes anything.

Count estimated active energy only for completed supported sessions and show coverage, such as how many completed sessions have estimates. An unestimated workout or missing day is unknown, not zero activity. Preserve the separate food diary and saved intake goals.

`node tests/activity-estimates.test.cjs` runs 14 tests covering browser/CommonJS evaluation, the independent 80 kg / 30 minute / 5 mph fixture (340 gross and 300 active kcal), current source literals, every interval boundary, nearest-gap selection and ties, unsupported pace, explicit activity, age limitations, malformed inputs and dates, historical weight selection, unit conversion, JSON snapshots and immutability. App-level tests separately verify no-op editing, completion coverage, account lifecycle and food-goal preservation.

The reusable helper accepts durations through 24 hours; the current workout form has an independent eight-hour logging cap (480 minutes). Both reject nonpositive durations. The public reference helper does not widen the form limit.
