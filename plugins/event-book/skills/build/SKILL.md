---
name: build
description: Make a project's Given / When / Then tests write the build file Event Book and Build Book read (one JSON per build), and optionally a usage file. Use when someone wants their tests to produce their event model, to see what was built against what was planned, to set up "the build book" in CI, or asks to "export the scenarios", "write the build file" or "make the tests write the model".
---

# Event Book: make the tests write the build

The project's rules tests already describe the system: the commands it accepts, the events it records, the views it shows and the requests it refuses. Make them also **write that down**, one JSON file per build, so the build opens as a book in Event Book (☰ → Import) or Build Book, and can be compared with the plan.

The file's shape is in `../../reference/format.md` (schema: `../../reference/build-export.schema.json`). Read it first.

## 1. Tests shaped as Given / When / Then

The export is easy when the rules are pure functions:

- **Commands:** `decide(history, command) → events | rejection`. Fold the history of events into the state it needs, then decide.
- **Views:** `project(history) → value`.

No database, HTTP or framework in them; the endpoint or handler is a thin adapter that loads events, calls `decide` and appends. If the project isn't shaped like this, propose the change slice by slice; don't rewrite it all at once.

Each test then reads as: **given** these events, **when** this command (with this data), **then** these events, or this refusal, or nothing changes. For a view: given these events, it shows this value.

## 2. Start red: specs from the plan, before any code

If there's a plan (the **plan** skill's `<app>-plan.json`, or one exported from Event Book), write the specs from it first:

- One spec file per slice, grouped by chapter: `tests/gwt/<chapter>/<slice>.test.js` (or the project's equivalent). Copy every scenario exactly as planned: title, given, when, then.
- Beside each spec, a stub for the slice that throws a `NotBuiltYet` error. While a stub throws, its scenarios are **pending**: the suite stays green, so CI isn't blocked by work that hasn't started, and the export marks them `"pending": true, "passing": false` with the planned `then`. The book shows them as "not passing yet".
- A switch (we use `GWT_RUN_PENDING=1`) runs the pending scenarios for real, so you can see every one fail for the right reason before writing code.
- Then build **one slice per commit**, and say how far it got in the message: `Build S3 Count Me In: 13 of 19 green`. The history then reads like the plan coming true.
- Put the real slice in the app, not in the tests, and let the stub just re-export it. The tests then run the code that ships.

If a spec turns out to be untestable as planned (a view that needs today's date, say), fix the plan and write the spec again. Don't bend the test to fit.

## 3. A small harness that records each scenario

Write (or reuse) a tiny Given / When / Then helper in the project's test framework. When an environment variable (we use `GWT_EXPORT`) names a folder, every scenario appends a record to `<GWT_EXPORT>/<test file>.test.json`:

```json
{ "chapter": "Ordering", "title": "Sold out is refused",
  "given": [ { "type": "SandwichSoldOut", "data": { "sandwich": "BLT" } } ],
  "when": "Place Order", "whenData": { "sandwich": "BLT" },
  "then": { "rejected": "Sold out today" },
  "spec": { "file": "tests/ordering.test.js", "line": 31 } }
```

A minimal JavaScript sketch (adapt it to xUnit, pytest or whatever the project uses):

```js
// tests/gwt.js — scenario(title).given(events).when(name, data, decide).then(expected)
export class NotBuiltYet extends Error { name = 'NotBuiltYet'; }   // what a stub throws
import fs from 'node:fs'; import path from 'node:path';
const out = process.env.GWT_EXPORT;
export const chapter = name => ({
  scenario: title => {
    const s = { chapter: name, title, given: [] };
    const record = () => { if (!out) return;
      const file = path.join(out, path.basename(import.meta.url).replace(/\.js$/, '') + '.test.json');
      fs.mkdirSync(out, { recursive: true });
      const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
      fs.writeFileSync(file, JSON.stringify([...list, s], null, 1)); };
    const api = {
      given: events => (s.given = events, api),
      when: (command, data, decide) => (s.when = command, s.whenData = data, s.run = () => decide(s.given, data), api),
      then: expected => {
        let got;
        try { got = s.run(); } catch (e) {
          // A stub that isn't built yet: pending (green), unless GWT_RUN_PENDING asks to see it red.
          if (e.name !== 'NotBuiltYet' || process.env.GWT_RUN_PENDING) throw e;
          delete s.run; Object.assign(s, { then: expected, pending: true, passing: false }); record(); return;
        }
        delete s.run;
        assertDeepEqual(got, expected);          // the project's own assertion
        s.then = expected; record(); },
      thenView: (view, project, expected) => { s.when = null; const got = project(s.given);
        assertDeepEqual(got, expected); s.then = { view, value: expected }; record(); }
    };
    return api;
  }
});
```

Rules that keep the book readable:
- `chapter` is the feature; the `when` name *is* the slice. Use the exact same command and view names everywhere.
- `then` is exactly one of `{ events }`, `{ rejected }`, `{ nothing: true }` or `{ view, value }`.
- Record only after the assertion passes, so a red test never writes a scenario. (A pending one is recorded as pending, with the planned `then`.)
- Assert a refusal with its reason (`{ rejected: "Sold out today" }`), never as "nothing happened": a refused command and a harmless repeat are different outcomes, and a check that can't tell them apart hides bugs.
- Add `spec` (the test's file and line) and, if you can, `slice` (the decide function's type, method, file and line). The book then links to the code.

## 4. Combine per build

After the tests pass, combine the folder into one file:

```python
# scripts/save-build.py <export dir> <app> — writes <date>-<app>-<sha>-built.json and latest-built.json
import json, os, sys, glob, datetime, subprocess
d, app = sys.argv[1], sys.argv[2]
git = lambda *a: subprocess.run(['git', *a], capture_output=True, text=True).stdout.strip()
remote = git('remote', 'get-url', 'origin').removesuffix('.git')
doc = {
  'app': app,
  'repo': '/'.join(remote.replace(':', '/').split('/')[-2:]) if 'github.com' in remote else None,
  'commit': git('rev-parse', 'HEAD'),
  'build': os.environ.get('GITHUB_RUN_NUMBER'),
  'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
  'files': [{'file': os.path.basename(f), 'scenarios': json.load(open(f))}
            for f in sorted(glob.glob(os.path.join(d, '*.test.json')))],
}
name = f"{datetime.date.today()}-{app}-{doc['commit'][:7]}-built.json"
for n in (name, 'latest-built.json'):
    json.dump(doc, open(n, 'w'), indent=1)
print(name, sum(len(f['scenarios']) for f in doc['files']), 'scenarios')
```

In CI (GitHub Actions), run the tests with the variable set, then save the file as an artifact or wherever the team keeps builds:

```yaml
- run: npm test            # or dotnet test, pytest…
  env: { GWT_EXPORT: ${{ runner.temp }}/gwt }
- run: python3 scripts/save-build.py "$RUNNER_TEMP/gwt" my-app
- uses: actions/upload-artifact@v4
  with: { name: build-book, path: latest-built.json, retention-days: 30 }
```

Only a green build writes a book. Check the result against `../../reference/build-export.schema.json`.

## 5. Usage (optional)

If the app keeps its events, a nightly job can count them by type over the last 30 days and write `latest-used.json` (see the usage section of the format). Counts only: never ids, data or anything about who did what. The book then shows which slices are busy and which nobody uses.

## 6. Read it

- Open `latest-built.json` in Event Book (☰ → Import) or Build Book: each command becomes a state-change slice, each view a state-view slice, in its chapter, with its scenarios.
- If there's a plan (the **plan** skill's `<app>-plan.json`), open both and **Compare**: what was planned and built, planned but not built, and built but never planned.

## Good to know

- Write the spec first: see the scenario fail for the right reason, then make it pass. Porting existing tests? Break a `decide` once to prove the scenarios can go red.
- Start with one chapter end to end (tests → file → book) before porting everything.
- **Rules in two places, two books.** If the same rules run in two places (a page that decides before it calls a server that checks again), spec both, with the same scenario titles, and write two build files from the same repo, such as `my-app` and `my-app-api`. Each book's slices then link to their own code, and a reader can see the two agree.
- The format is a description, not a standard; the project may add fields of its own.
