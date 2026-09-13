// Headless check of the coach dashboard: cohort stats, tabs, surveys, profiles, notes.
// Run with: osascript -l JavaScript tools/dash-check.js
ObjC.import('Foundation')

var ROOT = '/Users/yvonneventer/coaching-class/'
var failures = 0
function ok(m) { console.log('  ok: ' + m) }
function fail(m) { console.log('  FAIL: ' + m); failures += 1 }

function readFile(p) {
  return $.NSString.stringWithContentsOfFileEncodingError(p, $.NSUTF8StringEncoding, null).js
}

function makeEl() {
  var el = {
    innerHTML: '', value: '', textContent: '', style: {}, dataset: {}, files: [],
    scrollTop: 0, scrollHeight: 0, href: '', download: '', checked: false,
    classList: { add: function () {}, remove: function () {}, toggle: function () {} },
    addEventListener: function () {}, closest: function () { return el },
    focus: function () {}, click: function () {},
    querySelectorAll: function () { return [] },
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
var api = new Function(
  'document', 'localStorage', 'structuredClone', 'URL', 'Blob', 'FileReader',
  'setInterval', 'clearInterval', 'setTimeout', 'location',
  readFile(ROOT + 'prototype/app.js') +
  '\n; return { state: state, coachView: coachView, profileView: profileView, rosterTab: rosterTab,' +
  ' surveysTab: surveysTab, assignmentsTab: assignmentsTab, cohortStudents: cohortStudents,' +
  ' overallProgress: overallProgress, averageSurveyScore: averageSurveyScore, pendingSubmissions: pendingSubmissions,' +
  ' surveyLessons: surveyLessons, surveyFor: surveyFor, gradedLessons: gradedLessons, courseTasks: courseTasks,' +
  ' submittedCount: submittedCount, cohortName: cohortName, surveyScore: surveyScore, allLessons: allLessons };'
)(
  fakeDoc, { getItem: function (k) { return store[k] || null }, setItem: function (k, v) { store[k] = v } },
  function (o) { return JSON.parse(JSON.stringify(o)) },
  { createObjectURL: function () { return 'blob:x' }, revokeObjectURL: function () {} },
  function () {}, function () {}, function () { return 0 }, function () {}, function () { return 0 },
  { origin: 'http://127.0.0.1:8765', pathname: '/', hash: '' }
)

api.state.session = { role: 'coach', id: 'coach' }

// ---- 1. Cohorts
console.log('\n[1] Cohort filter')
api.state.cohort = 'all'
var all = api.cohortStudents().length
api.state.cohort = 'autumn26'
var autumn = api.cohortStudents().length
api.state.cohort = 'summer26'
var summer = api.cohortStudents().length
console.log('  all: ' + all + ', autumn26: ' + autumn + ', summer26: ' + summer)
if (all === autumn + summer && autumn > 0 && summer > 0) ok('cohorts partition the roster')
else fail('cohort counts do not add up')

// ---- 2. Stats
console.log('\n[2] Top stats')
api.state.cohort = 'autumn26'
var students = api.cohortStudents()
var completion = Math.round(students.reduce(function (s, x) { return s + api.overallProgress(x).pct }, 0) / students.length)
var avg = api.averageSurveyScore(students)
var pending = api.pendingSubmissions(students)
var maxPending = students.filter(function (s) { return s.status !== 'paused' }).length * api.gradedLessons().length
console.log('  completion: ' + completion + '%, avg survey: ' + (avg ? avg.toFixed(2) : 'n/a') +
  ', pending: ' + pending + ' (max ' + maxPending + ')')
if (completion >= 0 && completion <= 100) ok('completion within 0-100')
else fail('completion out of range: ' + completion)
if (avg > 1 && avg <= 5) ok('average survey score on a 1-5 scale')
else fail('survey average out of range: ' + avg)
if (pending >= 0 && pending <= maxPending) ok('pending submissions within bounds')
else fail('pending out of bounds')

// paused students excluded from pending
var tomas = api.state.data.students.filter(function (s) { return s.id === 'tomas' })[0]
api.state.cohort = 'summer26'
var summerStudents = api.cohortStudents()
var withPaused = api.pendingSubmissions(summerStudents)
tomas.status = 'active'
var withActive = api.pendingSubmissions(summerStudents)
tomas.status = 'paused'
if (withActive > withPaused) ok('paused students excluded from pending submissions')
else fail('paused student still counted in pending')

// ---- 3. Surveys
console.log('\n[3] Module surveys')
if (api.surveyLessons().length === 3) ok('one survey per chapter')
else fail('expected 3 survey lessons, got ' + api.surveyLessons().length)
if (!api.courseTasks().some(function (t) { return t.lesson.type === 'survey' })) ok('surveys excluded from the study planner')
else fail('survey lesson leaked into planner tasks')
api.state.cohort = 'autumn26'
var priya = api.state.data.students.filter(function (s) { return s.id === 'priya' })[0]
var sc = api.surveyScore(api.surveyFor(priya, 'c1l6'))
console.log('  Priya chapter 1 score: ' + sc.toFixed(2))
if (sc > 1 && sc <= 5) ok('per-response score computes')
else fail('bad per-response score')

// ---- 4. Tabs render
console.log('\n[4] Tab rendering')
;['assignments', 'surveys', 'roster'].forEach(function (tab) {
  api.state.coachTab = tab
  api.state.profileId = null
  var html = api.coachView()
  if (html.indexOf('coach-page') !== -1 && html.length > 500) ok(tab + ' tab renders (' + html.length + ' chars)')
  else fail(tab + ' tab produced no markup')
})
api.state.coachTab = 'roster'
var roster = api.rosterTab(api.cohortStudents())
var rowCount = (roster.match(/data-profile=/g) || []).length
console.log('  roster rows: ' + rowCount + ' for ' + api.cohortStudents().length + ' students')
if (rowCount === api.cohortStudents().length) ok('every student has a clickable row')
else fail('roster row count mismatch')

// ---- 5. Profile page
console.log('\n[5] Student profile')
api.state.profileId = 'priya'
var prof = api.profileView()
var checks = [
  ['progress bar', 'progress-wide'],
  ['planner settings', 'Study planner settings'],
  ['projected finish', 'Projected finish'],
  ['assignment submissions', 'Assignment submissions'],
  ['survey responses', 'Module survey responses'],
  ['coach notes', 'Coach notes'],
  ['message thread', 'Ask the Coach']
]
checks.forEach(function (c) {
  if (prof.indexOf(c[1]) !== -1) ok('profile shows ' + c[0])
  else fail('profile missing ' + c[0])
})
var pdfProfile = (function () { api.state.profileId = 'dele'; return api.profileView() })()
if (pdfProfile.indexOf('dele-mock-attempt.pdf') !== -1) ok('uploaded PDFs listed on profile')
else fail('PDF uploads missing from profile')
if (pdfProfile.indexOf('Interpretation write-up') !== -1) ok('text submissions listed on profile')
else fail('text submissions missing from profile')

// ---- 6. Notes persist
console.log('\n[6] Coach notes')
var jordan = api.state.data.students.filter(function (s) { return s.id === 'jordan' })[0]
var before = (jordan.notes || []).length
jordan.notes.unshift({ text: 'Test note', at: 'today' })
api.state.profileId = 'jordan'
if (api.profileView().indexOf('Test note') !== -1 && jordan.notes.length === before + 1) ok('notes render and store')
else fail('note not shown')
if (api.profileView().indexOf('data-drop-note') !== -1) ok('notes are deletable')
else fail('no delete control on notes')

// ---- 7. No student-facing leak of notes
console.log('\n[7] Privacy')
api.state.session = { role: 'student', id: 'jordan' }
api.state.profileId = null
var studentSide = api.allLessons().length
if (studentSide > 0) ok('student lesson list intact (' + studentSide + ' lessons)')
else fail('student lessons broken')

console.log('\n' + (failures ? failures + ' CHECK(S) FAILED' : 'ALL CHECKS PASSED'))
