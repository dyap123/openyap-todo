(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OY_ACTIVITY_ESTIMATES = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const version = '2024-compendium-level-v1';
  const KM_PER_MILE = 1.609344;
  const method = 'gross=MET*kg*minutes/60; active=max(0,MET-1)*kg*minutes/60';
  // Keep published METs intact. Gaps use the nearest interval, never interpolation.
  const makeRows = values => Object.freeze(values.map(([sourceCode, met, minMph, maxMph = minMph]) => Object.freeze({ sourceCode, met, minMph, maxMph })));
  const rows = Object.freeze({
    run: makeRows([
      ['12028', 6.5, 4, 4.2], ['12029', 7.8, 4.3, 4.8],
      ['12030', 8.5, 5, 5.2], ['12045', 9, 5.5, 5.8],
      ['12050', 9.3, 6, 6.3], ['12060', 10.5, 6.7],
      ['12070', 11, 7], ['12080', 11.8, 7.5], ['12090', 12, 8],
      ['12100', 12.5, 8.6], ['12110', 13, 9], ['12115', 14.8, 9.3, 9.6],
      ['12120', 14.8, 10], ['12130', 16.8, 11], ['12132', 18.5, 12],
      ['12134', 19.8, 13], ['12135', 23, 14]
    ]),
    walk: makeRows([
      ['17152', 2.8, 2, 2.4], ['17170', 3, 2.5], ['17190', 3.8, 2.8, 3.4],
      ['17200', 4.8, 3.5, 3.9], ['17220', 5.5, 4, 4.4],
      ['17230', 7, 4.5, 4.9], ['17231', 8.5, 5, 5.5]
    ])
  });
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const weightValid = n => finite(n) && n >= 20 && n <= 400;
  function dateValid(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000')) return false;
    const parsed = new Date(date + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  }
  function bmi(heightCm, weightKg) {
    if (!finite(heightCm) || heightCm < 100 || heightCm > 250 || !weightValid(weightKg)) return null;
    return weightKg / ((heightCm / 100) ** 2);
  }
  function weightAsOf(checkins, date) {
    if (!dateValid(date) || !checkins || typeof checkins !== 'object' || Array.isArray(checkins)) return null;
    const latest = Object.keys(checkins).filter(key => dateValid(key) && key <= date && weightValid(checkins[key]?.weightKg)).sort().at(-1);
    return latest ? Object.freeze({ date: latest, weightKg: checkins[latest].weightKg }) : null;
  }
  function distanceKm(value, unit) {
    if (!finite(value) || value <= 0 || !['km', 'mile'].includes(unit)) return null;
    const km = unit === 'mile' ? value * KM_PER_MILE : value;
    return Number.isFinite(km) && km <= 1000 ? km : null;
  }
  const unavailable = reason => Object.freeze({ available: false, reason });
  function estimate(input) {
    if (!input || typeof input !== 'object') return unavailable('Add an activity, duration, distance and recorded weight.');
    const { activity, durationMinutes, distanceKm: km, weightKg, weightDate, age } = input;
    if (!Object.hasOwn(rows, activity)) return unavailable('Only level-ground run or walk sessions have a reference estimate.');
    if (!finite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) return unavailable('Add an actual duration above zero and no longer than 24 hours.');
    if (distanceKm(km, 'km') === null) return unavailable('Add an actual positive distance in miles or km, up to 1,000 km.');
    if (!weightValid(weightKg) || !dateValid(weightDate)) return unavailable('A valid weight check-in dated on or before the activity is needed.');
    if (age !== undefined && age !== null && age !== '') {
      if (!finite(age) || age < 19 || age > 59) return unavailable('This adult reference covers ages 19–59; an age-specific estimate is unavailable.');
    }
    const speedMph = km / KM_PER_MILE / (durationMinutes / 60);
    const table = rows[activity];
    // Tolerance only absorbs unit-conversion roundoff, not a wider supported pace range.
    const epsilon = 1e-10;
    if (!finite(speedMph) || speedMph < table[0].minMph - epsilon || speedMph > table.at(-1).maxMph + epsilon) return unavailable('Pace is outside the supported level-ground ' + activity + ' references.');
    let row = table.find(r => speedMph >= r.minMph - epsilon && speedMph <= r.maxMph + epsilon);
    const nearestReference = !row;
    if (!row) {
      let best = Infinity;
      for (const candidate of table) {
        const gap = Math.max(candidate.minMph - speedMph, speedMph - candidate.maxMph, 0);
        // Rows are sorted slowest first; exact ties retain the slower reference.
        if (gap < best - epsilon) { best = gap; row = candidate; }
      }
    }
    const hoursKg = weightKg * durationMinutes / 60;
    return Object.freeze({
      available: true, version,
      sourceURL: 'https://pacompendium.com/' + (activity === 'run' ? 'running/' : 'walking/'),
      sourceCode: row.sourceCode, met: row.met,
      referenceSpeedMinMph: row.minMph, referenceSpeedMaxMph: row.maxMph,
      nearestReference, activity, durationMinutes, distanceKm: km, weightKg, weightDate,
      method, grossKcal: row.met * hoursKg, activeKcal: Math.max(0, row.met - 1) * hoursKg,
      speedMph
    });
  }
  return Object.freeze({ version, rows, bmi, weightAsOf, distanceKm, estimate });
});
