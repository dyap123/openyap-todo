'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const api = require('../activity-estimates.js');
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const base = {activity: 'run', durationMinutes: 30, distanceKm: 4.02336, weightKg: 80, weightDate: '2026-04-09'};
const atSpeed = (activity, mph) => api.estimate({...base, activity, distanceKm: mph * 0.5 * 1.609344});

test('CommonJS and browser expose the same pure API without network or storage', () => {
  const context = {window: {}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../activity-estimates.js'), 'utf8'), context);
  const browser = context.window.OY_ACTIVITY_ESTIMATES;
  assert.equal(browser.version, api.version);
  assert.deepEqual(JSON.parse(JSON.stringify(browser.estimate(base))), api.estimate(base));
});
test('BMI uses kg and metres squared, with no category or body-fat inference', () => {
  near(api.bmi(180, 80), 24.691358024691358);
  near(api.bmi(160, 64), 25);
  for (const [h,w] of [[0,80],[180,0],[NaN,80],[Infinity,80],[180,Infinity],[null,80],['180',80],[180,'80'],[99,80],[251,80],[180,19],[180,401]]) assert.equal(api.bmi(h,w), null);
});
test('weight lookup uses the latest valid canonical check-in on or before the date', () => {
  const checkins = {'2026-04-01': {weightKg: 78}, '2026-04-09': {weightKg: 80}, '2026-04-10': {weightKg: 82}, '2026-04-08': {waistCm: 75}, '2026-04-07': {weightKg: '79'}, 'bad': {weightKg: 90}};
  assert.deepEqual(api.weightAsOf(checkins,'2026-04-09'), {date: '2026-04-09', weightKg: 80});
  assert.deepEqual(api.weightAsOf(checkins,'2026-04-08'), {date: '2026-04-01', weightKg: 78});
  assert.equal(api.weightAsOf(checkins,'2026-03-31'), null);
  const snapshot = api.weightAsOf(checkins, '2026-04-09');
  checkins['2026-04-09'].weightKg = 83;
  assert.equal(snapshot.weightKg,80);
  assert(Object.isFrozen(snapshot));
});
test('weight lookup rejects malformed/impossible dates and malformed collections', () => {
  for (const date of ['2026-02-30','2025-02-29','0000-01-01','2026-4-09',null,1]) assert.equal(api.weightAsOf({'2026-04-01': {weightKg: 80}},date),null);
  assert.deepEqual(api.weightAsOf({'2024-02-29':{weightKg:72},'2024-02-30':{weightKg:90}},'2024-03-01'),{date:'2024-02-29',weightKg:72});
  for (const values of [null, [], 'bad', {bad:{weightKg:80}}, {'2026-04-09':null}]) assert.equal(api.weightAsOf(values,'2026-04-09'),null);
});
test('miles convert exactly by the international mile and km remain canonical', () => {
  assert.equal(api.distanceKm(1,'mile'),1.609344);
  assert.equal(api.distanceKm(5,'km'),5);
  for (const [n,u] of [[0,'km'],[-1,'mile'],[Infinity,'km'],[NaN,'mile'],['1','km'],[true,'km'],[null,'km'],[1,'m'],[1001,'km'],[1000,'mile']]) assert.equal(api.distanceKm(n,u),null);
});
test('fixed independent running fixture: 80 kg, half hour, 5 mph gives 340 gross and 300 active', () => {
  const value = api.estimate(base);
  assert.equal(value.available,true);
  assert.equal(value.met,8.5);
  assert.equal(value.sourceCode,'12030');
  assert.equal(value.sourceURL,'https://pacompendium.com/running/');
  near(value.grossKcal,340); near(value.activeKcal,300); near(value.speedMph,5);
  assert.equal(value.nearestReference,false);
  assert.equal(value.weightDate,'2026-04-09');
});
test('published 2024 codes and MET values stay literal, including walking update', () => {
  assert.deepEqual(api.rows.run.map(r=>[r.sourceCode,r.met]), [['12028',6.5],['12029',7.8],['12030',8.5],['12045',9],['12050',9.3],['12060',10.5],['12070',11],['12080',11.8],['12090',12],['12100',12.5],['12110',13],['12115',14.8],['12120',14.8],['12130',16.8],['12132',18.5],['12134',19.8],['12135',23]]);
  assert.deepEqual(api.rows.walk.map(r=>[r.sourceCode,r.met]), [['17152',2.8],['17170',3],['17190',3.8],['17200',4.8],['17220',5.5],['17230',7],['17231',8.5]]);
  const walk=atSpeed('walk',3);
  assert.equal(walk.met,3.8); assert.equal(walk.sourceCode,'17190');
  near(walk.grossKcal,152); near(walk.activeKcal,112);
});
test('every published interval includes both boundaries and unmodified MET', () => {
  for (const [activity,rows] of Object.entries(api.rows)) for (const row of rows) for (const speed of [row.minMph,row.maxMph]) {
    const result=atSpeed(activity,speed);
    assert.equal(result.available,true); assert.equal(result.sourceCode,row.sourceCode); assert.equal(result.met,row.met); assert.equal(result.nearestReference,false);
  }
});
test('unsupported pace is unavailable rather than clamped or extrapolated', () => {
  for (const [activity,speed] of [['run',3.99],['run',14.01],['walk',1.99],['walk',5.51]]) {
    const result=atSpeed(activity,speed); assert.equal(result.available,false); assert.match(result.reason,/outside/); assert(!('met' in result));
  }
});
test('internal gaps choose nearest reference, label it and break ties toward lower speed', () => {
  for (const [speed,code] of [[4.81,'12029'],[4.99,'12030'],[4.9,'12029'],[6.5,'12050']]) {
    const result=atSpeed('run',speed); assert.equal(result.nearestReference,true); assert.equal(result.sourceCode,code);
  }
  const walk=atSpeed('walk',2.7); assert.equal(walk.sourceCode,'17190'); assert.equal(walk.nearestReference,true);
});
test('activity is explicit: overlapping walk/run speeds use different published references', () => {
  assert.equal(atSpeed('walk',4).met,5.5);
  assert.equal(atSpeed('run',4).met,6.5);
  for(const activity of ['cardio','gym','jog',null,'toString','__proto__']) assert.equal(api.estimate({...base,activity}).available,false);
});
test('unknown age is allowed with adult reference caveat, known out-of-range is unavailable', () => {
  for(const age of [undefined,null,'',19,35,59]) assert.equal(api.estimate({...base,age}).available,true);
  for(const age of [18,60,0,-1,Infinity,NaN,'35']) {const value=api.estimate({...base,age}); assert.equal(value.available,false); assert.match(value.reason,/19–59/);}
});
test('invalid or missing actual inputs do not fabricate an estimate', () => {
  for(const field of ['durationMinutes','distanceKm','weightKg','weightDate']) for(const value of [undefined,null,'',NaN,Infinity,0,-1]) assert.equal(api.estimate({...base,[field]:value}).available,false);
  for(const input of [null,undefined,{}, {...base,durationMinutes:1441},{...base,distanceKm:1001},{...base,weightKg:401},{...base,weightDate:'2026-02-30'}]) assert.equal(api.estimate(input).available,false);
});
test('snapshots and reference table are immutable, detached, JSON-safe and unrounded', () => {
  const input={...base,durationMinutes:31,distanceKm:4.157472};
  const result=api.estimate(input);
  assert(Object.isFrozen(result)); assert(Object.isFrozen(api.rows)); assert(Object.isFrozen(api.rows.run)); assert(Object.isFrozen(api.rows.run[0]));
  assert.throws(()=>{result.met=100},TypeError);
  assert.throws(()=>{api.rows.run[0].met=100},TypeError);
  input.weightKg=90; assert.equal(result.weightKg,80);
  assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
  assert.equal(result.version,api.version);
  assert.equal(result.referenceSpeedMinMph,5); assert.equal(result.referenceSpeedMaxMph,5.2);
  near(result.grossKcal,351.3333333333333);
  assert(!('bmi' in result)); assert(!('calorieGoal' in result));
});
