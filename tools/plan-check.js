// Headless check of the study planner: dates, finish date, behind-detection, and .ics output.
// Run with: osascript -l JavaScript tools/plan-check.js
ObjC.import('Foundation')

var ROOT = '/Users/yvonneventer/coaching-class/'

function readFile(p) {
  return $.NSString.stringWithContentsOfFileEncodingError(p, $.NSUTF8StringEncoding, null).js
}

function makeEl() {
  var el = {
    innerHTML: '', value: '', textContent: '', style: {}, dataset: {}, files: [],
    scrollTop: 0, scrollHeight: 0, href: '', download: '',
    classList: { add: function () {}, remove: function () {}, toggle: function () {} },
    addEventListener: function () {},
    closest: function () { return el },
    focus: function () {},
    click: function () {},
    getBoundingClientRect: function () { return { left: 0, width: 100 } }
  }
  return el
}

var fakeDoc = {
  getElementById: function () { return makeEl() },
  createElement: function () { return makeEl() },
  querySelector: function () { return null },
  querySelectorAll: function () { return [] },
  body: { appendChild: function () {}, removeChild: function () {} }
}

var store = {}
var fakeStorage = {
  getItem: function (k) { return store[k] || null },
  setItem: function (k, v) { store[k] = v },
  removeItem: function (k) { delete store[k] }
}

var src = readFile(ROOT + 'prototype/app.js')
var factory = new Function(
  'document', 'localStorage', 'structuredClone', 'URL', 'Blob', 'FileReader',
  'setInterval', 'clearInterval', 'setTimeout', 'location',
  src + '\n; return { state: state, SEED: SEED, planStatus: planStatus, planSessions: planSessions,' +
  ' packPlan: packPlan, courseTasks: courseTasks, buildIcs: buildIcs, longDate: longDate,' +
  ' isoDate: isoDate, shiftISO: shiftISO, today: today, planCapacity: planCapacity };'
)

var api = factory(
  fakeDoc, fakeStorage,
  function (o) { return JSON.parse(JSON.stringify(o)) },
  { createObjectURL: function () { return 'blob:x' }, revokeObjectURL: function () {} },
  function (parts) { this.parts = parts },
  function () {},
  function () { return 0 }, function () {}, function () { return 0 },
  { origin: 'http://127.0.0.1:8765', pathname: '/', hash: '' }
)

function fail(msg) { console.log('  FAIL: ' + msg); failures += 1 }
function ok(msg) { console.log('  ok: ' + msg) }
var failures = 0

// ---- 1. Whole course is scheduled, not one module
console.log('\n[1] Whole course coverage')
var tasks = api.courseTasks()
var chapters = {}
tasks.forEach(function (t) { chapters[t.lesson.chapter.id] = true })
console.log('  tasks: ' + tasks.length + ' across chapters: ' + Object.keys(chapters).join(', '))
if (Object.keys(chapters).length === 3) ok('all three chapters included')
else fail('expected 3 chapters, got ' + Object.keys(chapters).length)
if (tasks.every(function (t) { return t.lesson.type !== 'ask' })) ok('Ask the Coach excluded')
else fail('Ask the Coach was scheduled')

// ---- 2. Dates follow the chosen start date and weekdays
console.log('\n[2] Dates and weekdays')
var plan = { startDate: '2026-09-14', hours: 5, slots: ['tue-evening', 'thu-evening', 'sat-morning'], makeups: [] }
var sessions = api.planSessions(plan, 3)
var first6 = sessions.slice(0, 6).map(function (s) { return api.longDate(s.date) + ' ' + s.period })
console.log('  first sessions: ' + first6.join(' | '))
var namesOk = sessions.slice(0, 6).every(function (s) {
  var wd = api.longDate(s.date).split(' ')[0]
  return (s.slotId.indexOf('tue') === 0 && wd === 'Tue') ||
         (s.slotId.indexOf('thu') === 0 && wd === 'Thu') ||
         (s.slotId.indexOf('sat') === 0 && wd === 'Sat')
})
if (namesOk) ok('each session falls on its chosen weekday')
else fail('weekday mismatch between slot and date')
var chron = sessions.every(function (s, i) { return i === 0 || sessions[i - 1].date <= s.date })
if (chron) ok('sessions are in chronological order')
else fail('sessions out of order')

// ---- 3. Finish date and full placement
console.log('\n[3] Finish date')
var packed = api.packPlan(tasks, api.planSessions(plan, 16))
var totalMin = tasks.reduce(function (s, t) { return s + t.minutes }, 0)
var placedMin = 0
packed.sessions.forEach(function (c) { c.items.forEach(function (i) { placedMin += i.minutes }) })
console.log('  work: ' + totalMin + ' min, placed: ' + placedMin + ' min, sessions used: ' + packed.sessions.length)
console.log('  starts ' + api.longDate(packed.sessions[0].date) + ', finishes ' + api.longDate(packed.sessions[packed.sessions.length - 1].date))
if (placedMin === totalMin && packed.unplaced === 0) ok('every minute of the course is placed')
else fail('placed ' + placedMin + ' of ' + totalMin + ', unplaced tasks: ' + packed.unplaced)

// ---- 4. Behind-detection for the seeded students
console.log('\n[4] Behind-detection')
api.SEED.students.forEach(function (s) {
  if (!s.plan) { console.log('  ' + s.name + ': no plan'); return }
  var status = api.planStatus(s)
  console.log('  ' + s.name + ': ' + status.overdue.length + ' overdue, ' +
    status.remaining + ' items left, finishes ' + (status.finish ? api.longDate(status.finish) : 'n/a'))
})
var jordan = api.SEED.students.filter(function (s) { return s.id === 'jordan' })[0]
if (api.planStatus(jordan).overdue.length > 0) ok('Jordan triggers the behind prompt')
else fail('Jordan should be behind (plan started 16 days ago)')
var uniqueOverdue = api.planStatus(jordan).overdue.map(function (o) { return o.lesson.id })
if (uniqueOverdue.length === new Set(uniqueOverdue).size) ok('overdue items are de-duplicated across split sessions')
else fail('overdue list contains duplicates')

// ---- 5. Calendar export
console.log('\n[5] .ics export')
api.state.session = { role: 'student', id: 'jordan' }
api.state.planDraft = null
var ics = api.buildIcs(jordan)
var lines = ics.split('\r\n')
var events = lines.filter(function (l) { return l === 'BEGIN:VEVENT' }).length
var ends = lines.filter(function (l) { return l === 'END:VEVENT' }).length
console.log('  ' + lines.length + ' lines, ' + events + ' events')
if (events === ends && events > 0) ok(events + ' well-formed events')
else fail('event begin/end mismatch: ' + events + '/' + ends)
if (lines[0] === 'BEGIN:VCALENDAR' && lines[lines.length - 1] === 'END:VCALENDAR') ok('calendar wrapper correct')
else fail('missing VCALENDAR wrapper')
if (ics.indexOf('SUMMARY:IAC Skills Course:') !== -1) ok('lesson titles present in SUMMARY')
else fail('no lesson titles in SUMMARY')
if (ics.indexOf('#lesson=c1l1') !== -1) ok('deep link to course content present')
else fail('no course content link')
if (ics.indexOf('zoom.us') !== -1) ok('Zoom links present for live sessions')
else fail('no Zoom links')
var longLines = lines.filter(function (l) { return l.length > 75 })
if (!longLines.length) ok('all lines within the 75-octet limit')
else fail(longLines.length + ' lines exceed 75 octets, e.g. ' + longLines[0].slice(0, 90))
var dtstarts = lines.filter(function (l) { return l.indexOf('DTSTART:') === 0 })
var badStamp = dtstarts.filter(function (l) { return !/^DTSTART:\d{8}T\d{6}$/.test(l) })
if (!badStamp.length) ok(dtstarts.length + ' DTSTART values well-formed')
else fail('bad DTSTART: ' + badStamp[0])
console.log('\n  sample event:')
var s = lines.indexOf('BEGIN:VEVENT')
console.log(lines.slice(s, s + 9).map(function (l) { return '    ' + l }).join('\n'))

// ---- 6. Make-up sessions and adjustments
console.log('\n[6] Make-up sessions')
var withMakeup = {
  startDate: plan.startDate, hours: 5,
  slots: plan.slots,
  makeups: [{ date: '2026-09-16', period: 'evening', minutes: 90 }]
}
var mSessions = api.planSessions(withMakeup, 4)
var makeupCell = mSessions.filter(function (s) { return s.makeup })[0]
if (makeupCell && api.longDate(makeupCell.date).indexOf('Wed') === 0) ok('make-up session lands on its own date (Wed 16 Sep)')
else fail('make-up session missing or misdated')
var beforeFinish = api.packPlan(tasks, api.planSessions(plan, 16)).sessions.slice(-1)[0].date
var afterFinish = api.packPlan(tasks, mSessions.concat(api.planSessions(withMakeup, 16))).sessions.slice(-1)[0].date
console.log('  finish without make-up: ' + api.longDate(beforeFinish) + ', with make-up: ' + api.longDate(afterFinish))
if (afterFinish <= beforeFinish) ok('adding a make-up session does not push the finish date out')
else fail('make-up session delayed the finish date')

// ---- 7. Subscription feed: stable UIDs and a file for the round-trip test
console.log('\n[7] Subscription feed')
jordan.calendar = { token: 'jordan-feedtest' }
var feed = api.buildIcs(jordan)
if (feed.indexOf('REFRESH-INTERVAL;VALUE=DURATION:PT1H') !== -1) ok('feed asks clients to refresh hourly')
else fail('no REFRESH-INTERVAL in feed')
if (feed.indexOf('X-WR-CALDESC:') !== -1) ok('feed carries a calendar description')
else fail('no calendar description')

var uids = feed.split('\r\n').filter(function (l) { return l.indexOf('UID:') === 0 })
if (uids.length === new Set(uids).size) ok(uids.length + ' unique UIDs')
else fail('duplicate UIDs in feed')
if (uids.every(function (u) { return u.indexOf('UID:jordan-feedtest-') === 0 })) ok('UIDs namespaced to the feed token')
else fail('UIDs not namespaced: ' + uids[0])

// Same plan rebuilt must produce identical UIDs, so subscribers update in place.
var again = api.buildIcs(jordan)
var uids2 = again.split('\r\n').filter(function (l) { return l.indexOf('UID:') === 0 })
if (JSON.stringify(uids) === JSON.stringify(uids2)) ok('UIDs stable across rebuilds')
else fail('UIDs changed between rebuilds')

// Moving the plan must keep UIDs but change times.
var moved = JSON.parse(JSON.stringify(jordan.plan))
moved.startDate = api.shiftISO(1)
var movedFeed = api.buildIcs(jordan, moved)
var movedUids = movedFeed.split('\r\n').filter(function (l) { return l.indexOf('UID:') === 0 })
var movedStarts = movedFeed.split('\r\n').filter(function (l) { return l.indexOf('DTSTART:') === 0 })
var origStarts = feed.split('\r\n').filter(function (l) { return l.indexOf('DTSTART:') === 0 })
if (JSON.stringify(movedUids) === JSON.stringify(uids)) ok('rescheduling keeps UIDs (events move, not duplicate)')
else fail('rescheduling changed UIDs')
if (JSON.stringify(movedStarts) !== JSON.stringify(origStarts)) ok('rescheduling changes event times')
else fail('rescheduling did not move any event')

$.NSString.alloc.initWithUTF8String(feed).writeToFileAtomicallyEncodingError(
  '/tmp/feed-out.ics', true, $.NSUTF8StringEncoding, null
)
console.log('  wrote /tmp/feed-out.ics for the server round-trip test')

console.log('\n' + (failures ? failures + ' CHECK(S) FAILED' : 'ALL CHECKS PASSED'))
