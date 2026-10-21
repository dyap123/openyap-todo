# Fitness plan template

`training-plan.js` exposes `window.OY_TRAINING_PLAN`. Version `2026-10-21.1` is a public, general template for an adult who wants to build or retain strength while working toward a leaner appearance. It includes no account profile, personal measurements, actual training loads, calorie target or completed workout. The app adapts the template using the signed-in person's private profile and preserves their saved goals until they explicitly apply a suggestion.

## A week you can repeat

The default is four training days: A on Monday, B on Wednesday, C on Friday and moderate cardio on Saturday. Tuesday and Thursday allow easy movement; Sunday is rest. Three days keeps the three gym sessions. Five adds a second cardio day. Days are movable examples, not attendance requirements; keep the A → B → C sequence and recovery between gym sessions after a missed day.

| Session | Working sets and repetitions |
| --- | --- |
| A · Squat and push | Squat or leg press 3 × 6–10; bench or dumbbell press 3 × 6–10; submaximal pull-ups 3 sets; dumbbell Romanian deadlift 2 × 8–12; dead bug 2 × 6–10 per side |
| B · Hinge and row | Romanian deadlift 3 × 6–10; chest-supported row 3 × 8–12; supported split squat 2 × 8–12 per leg; seated dumbbell shoulder press 2 × 8–12; bird dog 2 × 6–10 per side |
| C · Legs and upper body | Leg press or goblet squat 3 × 8–12; incline dumbbell press 3 × 8–12; submaximal pull-ups 3 sets; hamstring curl 2 × 10–15; reverse crunch 2 × 8–12 |

Start with 5–8 easy minutes, comfortable practice movements and 2–3 progressively heavier warm-up sets before the first loaded lifts. Warm-ups are separate from working sets. For a new or returning lifter, two working sets per exercise is a reasonable entry point. Choose a comfortable version and range of motion; the asset includes alternatives and short technique cues.

Choose working loads from controlled movement and 1–2 repetitions in reserve (RIR): end the set while another clean rep or two would still be possible. Rest about 2–3 minutes for demanding lifts and pull-ups and 60–90 seconds for smaller or core movements. Take longer when needed. Add reps first. After reaching the top of the range on every set with that reserve for two sessions, try the smallest practical load increase. No percentage-based bench load or assumed one-repetition maximum is used.

Pull-up sets adapt to `profile.pullupMax`; a modest maximum calls for short sets with clean reps available. The interface must allow fewer reps on later sets, assistance and substitutions. Assistance belongs in notes and must not be confused with unassisted progress. A rested retest every 4–6 weeks is optional. Added weight and daily maximum attempts are not required.

If fatigue accumulates or performance keeps falling, use an easier week: roughly half the working sets, easier loads and 3–4 RIR. Do not make up missed training by stacking hard sessions. Persistent pain or injury limitations call for exercise-specific help.

Cardio sessions start around 25–35 minutes, or less when building tolerance. Brisk walking, cycling and an elliptical are options. At moderate effort, talking is possible but singing is difficult. Add brisk walks in manageable bouts to work toward the adult aerobic guideline; the listed cardio sessions alone do not total 150 minutes. A previous fast mile does not determine an appropriate easy pace. [CDC adult activity guidance](https://www.cdc.gov/physical-activity-basics/guidelines/adults.html) describes the weekly aerobic and strength recommendations.

## Repeatable meals

Use three meals built around protein, vegetables or fruit, and a portion of rice, potatoes, beans or whole grains. Add a snack if useful. As a visual starting point, main meals can have 1–2 palms of protein, 1–2 fists of vegetables, a cupped hand of starch and a modest amount of fat. Adjust portions to training, appetite and the chosen daily goal.

The asset supplies eight usable choices: yogurt/oats/berries, eggs/toast/fruit, chicken/rice/vegetables, tofu/beans/grain, fish/potato/vegetables, turkey or bean chili, a restaurant bowl, and a protein-and-fruit snack. Each has portion guidance, a broad calorie/protein range and a note about substitutions or preparation. These are planning examples assembled for this app, not official nutrient analyses. Oil, sauces, brands and actual portions matter. They must not be automatically added to the food diary or treated as verified restaurant items. Log the food actually eaten using its label or the sourced food library.

For healthy adults training with resistance, the template selects a practical protein range of 1.6–2.0 g/kg/day within the ISSN position stand's broader range for exercising adults. Spread protein through meals; a supplement is optional. [ISSN position stand, 2017](https://link.springer.com/article/10.1186/s12970-017-0177-8).

The optional deficit starts around 300 kcal below an estimated maintenance value only for an eligible adult with the required profile inputs. That number is a conservative product starting choice, not a universal prescription or a predicted loss rate. This asset implements no energy equation. Missing age or other inputs must leave meals and workouts usable without inventing a calorie target. Preserve existing goals until the person chooses to apply new ones. The calorie-deficit flow excludes minors, pregnancy and breastfeeding; medical dietary restrictions or disordered-eating history need individualized guidance. [NIDDK Body Weight Planner](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner) documents adult use and exclusions; its dynamic model is not implemented here.

After 2–3 consistent weeks, review weight averages, waist, strength, hunger and recovery. Avoid responding to a single weigh-in or an incomplete diary by automatically reducing intake. A seasonal checkpoint is a review date and can be edited; the app promises no particular target weight or appearance. [CDC weight management guidance](https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html) supports gradual changes and regular review. Core work supports trunk strength; it does not selectively remove belly fat. [ACE discussion of abdominal training](https://www.acefitness.org/resources/everyone/blog/6913/breaking-down-fitness-myths-and-misconceptions/).

## Asset and logging contract

- `sessions` contains stable session IDs `a`, `b`, `c`, names, focus and exercise templates. Exercises have a stable `id`, `name`, numeric suggested `sets`, textual `reps`, `kind` (`loaded` or `bodyweight`) and `note`. Both pull-up appearances use `id: 'pullup'` and `profileMetric: 'pullupMax'` so history can derive comparable repetitions.
- `schedule[3|4|5]` contains a name, seven `days` and a note. Each day has `day`, `kind`, `name`, `detail` and, for gym sessions, `sessionId`. `defaultTrainingDays` is `4`.
- `guidance` is an ordered list of `{title, text}` disclosures. `nutrition` contains prose guidance; `meals` contains `{id, meal, name, portions, estimate: {calories: [low, high], proteinG: [low, high]}, note}`. `notes` contains brief plan/logging context. `sources` contains `{title, url}`.
- Suggested set counts and rep ranges describe the plan. Actual set fields must begin blank and uncompleted. Viewing or choosing a session must never create completed sets, a workout or calories burned.
- Snapshot plan/exercise descriptions when a workout is explicitly saved; later template changes must not rewrite history. Record actual external load with explicit units. Use a consistent combined-dumbbell convention, label it, and keep bodyweight reps separate from externally loaded tonnage.
- Keep profile values, selected days, actual loads, notes and completion inside the existing private Fitness workspace. No personal baseline belongs in this static asset.

## Source verification

Sources were checked October 21, 2026. The [ACSM 2026 update](https://acsm.org/resistance-training-guidelines-update-2026/) supports regular resistance training, individualization, flexible equipment and avoiding a requirement to reach failure. The exact A/B/C exercise selection, rest intervals, rep ranges, progression and lighter-week examples are an app template, not a verbatim ACSM protocol.

The [Physical Activity Guidelines, second edition](https://www.cdc.gov/physical-activity/media/pdfs/Physical_Activity_Guidelines_2nd_edition.pdf) is linked for the underlying recommendation; the browser reader could not fetch that large PDF during this task, so the same recommendation was checked on CDC's adult overview above. The [PMC copy of the ISSN paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/) presented a browser challenge; its text and DOI were verified through the journal's primary publication linked above. Other linked sources opened successfully. All guidance is paraphrased.


## Optional app energy estimate

The UI implements the original [Mifflin–St Jeor equation](https://pubmed.ncbi.nlm.nih.gov/2305711/): resting kcal/day = 10×kg + 6.25×cm − 5×age + 5 for the male coefficient, or −161 for the female coefficient. It requires complete adult inputs and an explicit eligible context. Approximate activity factors 1.2/1.35/1.5/1.7 are product assumptions, not coefficients from that paper or measured expenditure. Maintenance is rounded to 50 kcal, with a 300 kcal initial deficit; the UI declines suggested targets outside 1,500–6,500 kcal as conservative software guardrails, not universal clinical minimums. Missing inputs and excluded contexts leave manual targets and basic meal/workout logging available. Only explicit Apply changes calorie/protein goals. No private baseline values are shipped in the source or this document.
