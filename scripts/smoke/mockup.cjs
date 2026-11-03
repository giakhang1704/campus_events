const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const file = path.resolve(__dirname, '../../frontend/public/mockup/app.js');
const source = fs.readFileSync(file, 'utf8');
const context = vm.createContext({
 localStorage: { getItem: () => null, setItem() {} },
 document: { querySelector: () => ({ innerHTML:'', textContent:'', classList:{add(){},remove(){}} }) },
 setInterval() {}, setTimeout() {}, clearTimeout() {}, console
});
// Replace only final startup invocation, keeping production helper definitions.
vm.runInContext(source.replace(/\nrender\(\);\nsetInterval/, '\nnormalize();\nsetInterval'), context);
const run = code => vm.runInContext(code, context);
assert.equal(run('state.events.every(e=>e.mode==="single")'), true);
assert.equal(run('state.events.find(e=>e.id==="e5").finished'), true);
assert.equal(run('state.events.find(e=>e.id==="e1").finished'), false);
assert.equal(run('eligible({departments:[shortFaculty,"Khoa Kinh tế"],studyYears:["2","3"]}, {faculty:shortFaculty,year:"3"})'), true);
assert.equal(run('eligible({departments:[shortFaculty],studyYears:["2"]}, {faculty:shortFaculty,year:"3"})'), false);
const form = run('createForm(false)');
assert.equal(form.includes('name="departments" multiple'), true);
assert.equal(form.includes('name="mode"'), false);
assert.equal(form.includes('name="category"'), false);
assert.equal(run('csvData(state.events[0],true).includes("Check-out")'), false);
// Increasing capacity promotes the waiting user, preserving the same object.
assert.equal(run(`(()=>{const e=state.events[0], old=e.regs.s4;e.capacity=4;const names=promote(e);return names.length===1 && e.regs.s4===old && old.status==='Registered';})()`), true);
run(`globalThis.render=()=>{};globalThis.toast=()=>{};globalThis.modal=(title,body,apply)=>{globalThis.applyModal=apply;};`);
assert.equal(run(`(()=>{selected='e1';state.uid='s1';const e=event(),old=e.regs.s1;old.checkin=true;old.checkinAt='08:00';cancelEvent();applyModal();if(old.status!=='Cancelled'||!old.checkin)return false;registerEvent();applyModal();return e.regs.s1===old&&!old.checkin&&old.history.some(h=>h.action==='REREGISTER'&&h.before.checkin);})()`), true);
console.log('PASS: single attendance, ends_at, multi-select eligibility, deferred controls, CSV and capacity promotion.');
