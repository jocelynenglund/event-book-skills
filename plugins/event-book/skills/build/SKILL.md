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

## 2. A small harness that records each scenario

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
      then: expected => { const got = s.run(); delete s.run;
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
- Record only after the assertion passes, so a red test never writes a scenario.
- Add `spec` (the test's file and line) and, if you can, `slice` (the decide function's type, method, file and line). The book then links to the code.

## 3. Combine per build

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

## 4. Usage (optional)

If the app keeps its events, a nightly job can count them by type over the last 30 days and write `latest-used.json` (see the usage section of the format). Counts only: never ids, data or anything about who did what. The book then shows which slices are busy and which nobody uses.

## 5. Read it

- Open `latest-built.json` in Event Book (☰ → Import) or Build Book: each command becomes a state-change slice, each view a state-view slice, in its chapter, with its scenarios.
- If there's a plan (the **plan** skill's `<app>-plan.json`), open both and **Compare**: what was planned and built, planned but not built, and built but never planned.

## Good to know

- Write the spec first: see the scenario fail for the right reason, then make it pass. Porting existing tests? Break a `decide` once to prove the scenarios can go red.
- Start with one chapter end to end (tests → file → book) before porting everything.
- The format is a description, not a standard; the project may add fields of its own.
