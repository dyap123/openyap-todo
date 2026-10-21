/* Public templates only. Profile values, selected loads and completed work belong to the private workspace. */
window.OY_TRAINING_PLAN = {
  version: '2026-10-21.1',
  name: 'Build strength, get leaner',
  summary: 'Three full-body gym sessions, manageable cardio and meals you can repeat. Adjust the week to your recovery and schedule.',
  defaultTrainingDays: 4,
  sessions: [
    { id: 'a', name: 'A · Squat and push', focus: 'Full body · squat, horizontal push, pull and core', exercises: [
      { id: 'a-squat', name: 'Squat or leg press', sets: 3, reps: '6–10', kind: 'loaded', note: 'Use the version you can control comfortably. Keep the whole foot supported and use a comfortable depth.' },
      { id: 'a-bench', name: 'Bench press or dumbbell press', sets: 3, reps: '6–10', kind: 'loaded', note: 'Use a spotter or safety arms for barbell bench. Choose the load from clean reps today.' },
      { id: 'pullup', name: 'Pull-up', sets: 3, reps: 'Submaximal', kind: 'bodyweight', profileMetric: 'pullupMax', note: 'Leave 1–2 clean reps in reserve. Use assistance when needed; record assistance in notes. Stop before swinging or grinding.' },
      { id: 'a-hinge', name: 'Dumbbell Romanian deadlift', sets: 2, reps: '8–12', kind: 'loaded', note: 'Move the hips back with weights close. Stop the descent while you can keep a controlled back position.' },
      { id: 'a-core', name: 'Dead bug', sets: 2, reps: '6–10 / side', kind: 'bodyweight', note: 'Move slowly and keep the trunk steady. Count reps on each side.' }
    ] },
    { id: 'b', name: 'B · Hinge and row', focus: 'Full body · hinge, row, single-leg work and shoulders', exercises: [
      { id: 'b-hinge', name: 'Romanian deadlift', sets: 3, reps: '6–10', kind: 'loaded', note: 'Use dumbbells or a barbell. Keep the load close and finish standing tall without leaning back.' },
      { id: 'b-row', name: 'Chest-supported row', sets: 3, reps: '8–12', kind: 'loaded', note: 'A seated cable row is an alternative. Pull without jerking the torso.' },
      { id: 'b-split', name: 'Supported split squat', sets: 2, reps: '8–12 / leg', kind: 'loaded', note: 'Start with bodyweight if needed; log zero external load. Use support for balance and a comfortable range.' },
      { id: 'b-press', name: 'Seated dumbbell shoulder press', sets: 2, reps: '8–12', kind: 'loaded', note: 'Use a machine press if more comfortable. Keep the trunk supported and the motion pain-free.' },
      { id: 'b-core', name: 'Bird dog', sets: 2, reps: '6–10 / side', kind: 'bodyweight', note: 'Pause briefly with opposite arm and leg extended; avoid twisting or arching.' }
    ] },
    { id: 'c', name: 'C · Legs and upper body', focus: 'Full body · legs, incline push, pull and core', exercises: [
      { id: 'c-legpress', name: 'Leg press or goblet squat', sets: 3, reps: '8–12', kind: 'loaded', note: 'Choose a repeatable range and keep each rep controlled.' },
      { id: 'c-incline', name: 'Incline dumbbell press', sets: 3, reps: '8–12', kind: 'loaded', note: 'A machine chest press is an alternative. Keep 1–2 clean reps available.' },
      { id: 'pullup', name: 'Pull-up', sets: 3, reps: 'Submaximal', kind: 'bodyweight', profileMetric: 'pullupMax', note: 'Repeat clean submaximal sets; use assistance or substitute a comfortable pulldown and record the change.' },
      { id: 'c-curl', name: 'Seated or lying hamstring curl', sets: 2, reps: '10–15', kind: 'loaded', note: 'Control both directions. Set the machine to fit your knee position.' },
      { id: 'c-core', name: 'Reverse crunch', sets: 2, reps: '8–12', kind: 'bodyweight', note: 'Curl the pelvis slowly without swinging. Substitute dead bugs if more comfortable.' }
    ] }
  ],
  schedule: {
    3: { name: '3 training days', days: [
      { day: 'Mon', kind: 'strength', sessionId: 'a', name: 'Session A', detail: 'Gym; optional short brisk walk afterwards.' },
      { day: 'Tue', kind: 'recovery', name: 'Walk / recover', detail: 'Comfortable walking and normal daily movement.' },
      { day: 'Wed', kind: 'strength', sessionId: 'b', name: 'Session B', detail: 'Gym; optional short brisk walk afterwards.' },
      { day: 'Thu', kind: 'recovery', name: 'Walk / recover', detail: 'Comfortable walking; keep legs fresh.' },
      { day: 'Fri', kind: 'strength', sessionId: 'c', name: 'Session C', detail: 'Gym; optional easy cardio if recovered.' },
      { day: 'Sat', kind: 'recovery', name: 'Walk / recover', detail: 'Optional enjoyable walk; rest if tired.' },
      { day: 'Sun', kind: 'recovery', name: 'Rest', detail: 'Rest and prepare food for the coming week.' }
    ], note: 'Three gym sessions are the planned training days. Build aerobic minutes through brisk walking in short bouts on days that suit you; easy strolling may not count as moderate activity.' },
    4: { name: '4 training days · default', days: [
      { day: 'Mon', kind: 'strength', sessionId: 'a', name: 'Session A', detail: 'Gym.' },
      { day: 'Tue', kind: 'recovery', name: 'Walk / recover', detail: 'Easy movement and optional gentle mobility.' },
      { day: 'Wed', kind: 'strength', sessionId: 'b', name: 'Session B', detail: 'Gym.' },
      { day: 'Thu', kind: 'recovery', name: 'Walk / recover', detail: 'Easy movement and optional gentle mobility.' },
      { day: 'Fri', kind: 'strength', sessionId: 'c', name: 'Session C', detail: 'Gym.' },
      { day: 'Sat', kind: 'cardio', name: 'Moderate cardio', detail: '25–35 minutes brisk walking, cycling or elliptical; start shorter if needed.' },
      { day: 'Sun', kind: 'recovery', name: 'Rest', detail: 'Rest and prepare for next week.' }
    ], note: 'Add manageable brisk walks around this week to work toward 150 moderate minutes. One cardio session alone does not reach that guideline.' },
    5: { name: '5 training days', days: [
      { day: 'Mon', kind: 'strength', sessionId: 'a', name: 'Session A', detail: 'Gym.' },
      { day: 'Tue', kind: 'cardio', name: 'Moderate cardio', detail: '25–35 minutes at a conversational pace.' },
      { day: 'Wed', kind: 'strength', sessionId: 'b', name: 'Session B', detail: 'Gym.' },
      { day: 'Thu', kind: 'recovery', name: 'Walk / recover', detail: 'Easy movement; rest if recovery is lagging.' },
      { day: 'Fri', kind: 'strength', sessionId: 'c', name: 'Session C', detail: 'Gym.' },
      { day: 'Sat', kind: 'cardio', name: 'Moderate cardio', detail: '25–35 minutes cycling, brisk walking or elliptical.' },
      { day: 'Sun', kind: 'recovery', name: 'Rest', detail: 'Rest; no missed-session catch-up required.' }
    ], note: 'The extra days add cardio rather than more hard lifting. Build toward 150 moderate minutes with additional brisk walks as recovery allows.' }
  },
  guidance: [
    { title: 'Warm up', text: 'Start with 5–8 easy minutes and a few comfortable practice movements. Before the first loaded lifts, do 2–3 progressively heavier practice sets. These are separate from working sets.' },
    { title: 'Effort and rest', text: 'Choose a load that leaves 1–2 clean reps in reserve (RIR). Start easier while learning. Rest 2–3 minutes for demanding lifts and pull-ups, 60–90 seconds for smaller/core movements; take longer if needed.' },
    { title: 'Progress', text: 'Add a rep when all sets remain controlled. When every set reaches the top of its range with 1–2 reps available on two sessions, try the smallest load increase and return to the lower end. No max test is needed.' },
    { title: 'Pull-ups', text: 'Use the private profile max only to suggest submaximal reps; reduce reps on later sets as needed. Add clean reps gradually before considering added weight. An optional rested retest every 4–6 weeks can update the profile; never test daily.' },
    { title: 'Recover', text: 'Keep roughly a day between gym sessions. New or returning? Start with 2 working sets per exercise. If fatigue accumulates or performance repeatedly drops, take a lighter week: about half the sets, easier loads and 3–4 reps in reserve.' },
    { title: 'Cardio and walking', text: 'Build gradually toward 150 minutes of moderate aerobic activity per week alongside strength work. At moderate effort you can talk but not sing. Use short brisk walks to fill the gap; a fast mile is not a required workout pace.' },
    { title: 'Adapt', text: 'Move days to fit your week, keep the A → B → C order, and resume after a missed day. Swap uncomfortable exercises for a similar movement; stop painful reps and get help with persistent pain or injury-specific changes.' }
  ],
  nutrition: {
    summary: 'Build three repeatable meals around protein, plants and a portion of starch; add a snack if it helps you meet your needs.',
    structure: 'At main meals start with 1–2 palm-sized portions of protein, 1–2 fists of vegetables, a cupped-hand portion of rice, potatoes or whole grains, and a modest serving of fat. Include fruit daily and beans or whole grains for fiber. Adjust portions to hunger, training and your chosen goal.',
    protein: 'For healthy adults doing resistance training, a practical daily protein range is 1.6–2.0 g/kg of current body weight. Spread it across meals; food alone can meet it and supplements are optional.',
    deficit: 'For an eligible adult with a complete profile, an optional starting point is about 300 kcal below estimated maintenance. Keep saved goals until you choose to apply changes. An estimate needs checking against real trends.',
    review: 'After 2–3 consistent weeks, compare weight averages, waist, strength, hunger and recovery. Daily weight fluctuates; incomplete food diaries do not justify a lower target. Adjust one small habit or portion at a time.',
    context: 'The calorie-deficit template is for adults, excluding pregnancy or breastfeeding. For medical dietary restrictions or a history of disordered eating, use an individualized plan with an appropriate clinician or dietitian.',
    estimateNote: 'Meal ranges are rough planning examples, not verified restaurant nutrition or a prescribed daily menu. Brands, oil, sauces and actual portions can move values outside these ranges; log the food you actually eat.'
  },
  meals: [
    { id: 'yogurt-oats', meal: 'Breakfast', name: 'Yogurt, oats and fruit', portions: 'About 1 cup plain high-protein yogurt, ½ cup dry oats and 1 cup berries; optional small spoon of nuts.', estimate: { calories: [350, 550], proteinG: [25, 40] }, note: 'Choose plain yogurt or a suitable fortified soy alternative; check its protein label.' },
    { id: 'eggs-toast', meal: 'Breakfast', name: 'Eggs, toast and fruit', portions: '2 eggs plus ½ cup egg whites, 2 slices whole-grain toast and a piece of fruit; cook with a small amount of oil.', estimate: { calories: [450, 650], proteinG: [30, 40] }, note: 'Swap eggs for a generous tofu scramble if preferred; protein varies with the tofu.' },
    { id: 'chicken-bowl', meal: 'Lunch', name: 'Chicken rice bowl', portions: '1–2 palms cooked chicken, ¾–1 cup cooked rice, 1–2 cups vegetables and salsa; use a measured spoon of dressing or oil.', estimate: { calories: [500, 750], proteinG: [35, 55] }, note: 'Batch-cook the protein and rice. Beans can replace part of the rice or meat.' },
    { id: 'tofu-bean-bowl', meal: 'Lunch', name: 'Tofu and bean bowl', portions: 'About 200 g firm tofu, ½ cup beans, ½–1 cup cooked grain and 1–2 cups vegetables; season with a modest amount of sauce.', estimate: { calories: [500, 800], proteinG: [30, 45] }, note: 'Choose tofu using its label; firmness and brand change protein and calories.' },
    { id: 'fish-potato', meal: 'Dinner', name: 'Fish, potato and vegetables', portions: '1–2 palms fish, 1 medium-to-large potato and 1–2 cups vegetables, with a small amount of oil.', estimate: { calories: [450, 750], proteinG: [30, 50] }, note: 'Salmon contributes more fat than white fish. Chicken or tofu also works.' },
    { id: 'chili', meal: 'Dinner', name: 'Turkey or bean chili', portions: 'About 2 cups chili made with lean turkey and beans, or a bean-and-soy version; add a large side of vegetables and a modest grain portion if needed.', estimate: { calories: [450, 750], proteinG: [30, 50] }, note: 'Batch-cook and freeze portions. Cheese, sour cream and added oil change the total.' },
    { id: 'restaurant-bowl', meal: 'Eating out', name: 'Build a restaurant bowl', portions: 'Choose grilled protein, beans, a moderate rice portion and plenty of vegetables; add salsa and pick one richer topping you enjoy.', estimate: { calories: [500, 850], proteinG: [30, 55] }, note: 'Search the food library for the actual restaurant items and serving sizes. This range is not an official menu value.' },
    { id: 'protein-fruit', meal: 'Snack', name: 'Protein and fruit', portions: '¾–1 cup cottage cheese or high-protein yogurt plus fruit; alternatively use edamame with fruit.', estimate: { calories: [180, 350], proteinG: [15, 30] }, note: 'Choose a portion that fills a gap in your day rather than automatically adding a snack.' }
  ],
  notes: [
    'A plan is a suggestion. Only explicitly saved workout entries count as completed training; suggested sets are not logged sets.',
    'Choose and record actual loads with units. For dumbbells record the combined external load consistently; bodyweight movements have no assumed external load.',
    'A seasonal checkpoint is a date to review habits and trends, not a promise of a particular weight, visible abs or a specific physique. Core exercises strengthen the trunk; they do not selectively remove belly fat.'
  ],
  sources: [
    { title: 'ACSM · 2026 resistance training guidance', url: 'https://acsm.org/resistance-training-guidelines-update-2026/' },
    { title: 'CDC · Adult physical activity guidelines', url: 'https://www.cdc.gov/physical-activity-basics/guidelines/adults.html' },
    { title: 'Physical Activity Guidelines for Americans · second edition', url: 'https://www.cdc.gov/physical-activity/media/pdfs/Physical_Activity_Guidelines_2nd_edition.pdf' },
    { title: 'CDC · Steps for losing weight', url: 'https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html' },
    { title: 'ISSN · Protein and exercise position stand (2017)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/' },
    { title: 'NIDDK · Body Weight Planner', url: 'https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner' },
    { title: 'ACE · Core training and fitness myths', url: 'https://www.acefitness.org/resources/everyone/blog/6913/breaking-down-fitness-myths-and-misconceptions/' }
  ]
};
