# The format

Three files: a **plan** (what is proposed, `eventbook-plan/1`), a **build** (what Given / When / Then tests write) and, optionally, **usage**. Event Book and Build Book read them.

> A description, not a standard. It's what our own tests happen to write today. Borrow from it, change it and write your own. It can change without notice. Check a build file against [build-export.schema.json](build-export.schema.json) (and [build-usage.schema.json](build-usage.schema.json) for usage).

## The plan file (`eventbook-plan/1`)

The plan skill writes one file in the format Event Book publishes for plans, `eventbook-plan/1`: chapters of steps (`do`, `see`, `auto`), each with its Given / When / Then scenarios. Event Book opens it with ☰ → Import.

- Schema (JSON Schema 2020-12): https://eventbook.itsybit.se/plan.schema.json
- Guide for agents (the method and every key): https://eventbook.itsybit.se/llms.txt
- Complete example: https://eventbook.itsybit.se/plan.example.json, and [`examples/tool-library-plan.json`](../../../examples/tool-library-plan.json) in this repo

It is not the build file below: a plan has no `app`, `files`, `commit` or `repo`, and uses `{ "format", "name", "chapters" }` instead. The sections below describe the **build file** (what the tests write) and the usage file. They share scenario ideas with the plan (given, when, then, a refusal with its reason) but not their shape.

## The build file (one per build)

```json
{
  "app": "wishbook",
  "repo": "owner/wishbook",
  "commit": "199305ca2e32f0351587e2036a94782cbe5412b0",
  "build": "33",
  "createdAt": "2026-10-25T12:31:22+00:00",
  "files": [
    { "file": "create.test.json", "scenarios": [ … ] }
  ]
}
```

| Field | Required | What it is |
|---|---|---|
| `app` | yes | The app's name. Builds of the same app are editions of one book. |
| `files` | yes | One entry per test file: `{ file, scenarios }`. |
| `repo` | no | `owner/name` on GitHub (or a full URL). With it, the book links to the code and each edition's commit. |
| `commit` | no | The commit the build ran on. Tells editions apart. Event Book treats a file with no `commit` as a plan in this older shape; new plans use `eventbook-plan/1` above. |
| `build` | no | The CI run's number, as a string. |
| `createdAt` | no | When the file was written (ISO 8601). |
| `events` | no | What the scenarios can't say about an event type, by its name: it's external, or a legacy table. See [External events and legacy tables](#external-events-and-legacy-tables). |

A bare list of scenarios (one test file's, without the wrapper) is read too.

## A scenario

One Given / When / Then. The `chapter` groups slices; the command (`when`) or the view (`then.view`) names the slice.

```json
{
  "chapter": "Create",
  "title": "The organizer creates a party",
  "given": [ { "type": "WishlistStarted", "data": { "listId": "l1" } } ],
  "when": "Create Party",
  "whenData": { "kidName": "Alex", "age": 8 },
  "then": { "events": [ { "type": "PartyCreated", "data": { "partyId": "p1", "kidName": "Alex" } } ] },
  "spec": { "file": "tests/Create/CreatePartyTests.cs", "line": 18 },
  "slice": { "type": "Wishbook.Features.Create.CreateParty", "method": "Decide", "file": "src/Features/Create/CreateParty.cs", "line": 42 }
}
```

| Field | Required | What it is |
|---|---|---|
| `chapter` | yes | The feature the scenario belongs to. |
| `title` | yes | The scenario's name, as a sentence. |
| `given` | yes | The events so far, oldest first: `{ type, data }`. May be empty. |
| `when` | yes | The command's name, or `null` for a view (the scenario reads `given` into `then.view`). |
| `whenData` | no | What the command was sent. Its keys become the command's fields. |
| `then` | yes | One of the four outcomes below. |
| `spec` | no | Where the test is: `{ file, line }`. Builds only. |
| `slice` | no | Where the code under test is: `{ type, method, file, line }`. Builds only. |
| `pending`, `passing`, `pendingReason` | no | A generated spec still marked "not built yet". Not passing, its `then` is the planned outcome, and the book shows it as "not passing yet". Builds only. |

### The four outcomes

| Then | Means |
|---|---|
| `{ "events": [ { "type", "data" } ] }` | The command was accepted and recorded these events. |
| `{ "rejected": "Name is required" }` | The command was refused, with the reason. |
| `{ "nothing": true }` | Accepted, but nothing changed. |
| `{ "view": "Guest Invite", "value": … }` | A view and what it showed (an object, or a list of rows). Use with `"when": null`. |

### Events

Every event is `{ type, data }`. Names can be PascalCase (`PartyCreated`) or words (`Party Created`); they match either way. An event type's fields are every key the scenarios ever gave it.

### External events and legacy tables

Some events aren't this system's own. Name them in the file's `events`, by type:

```json
"events": {
  "Payment Received": { "external": true, "from": "Stripe" },
  "Orders Tbl":       { "table": true, "from": "the old ERP" }
}
```

| Field | Means |
|---|---|
| `external` | Another system records it; this one only reacts. Event Book draws it yellow. |
| `table` | A table in an old database, read as if it were events (a legacy system you're modelling around). Drawn a shadowy orange, so it reads apart from real events. |
| `from` | Which system or database it comes from. |

An event named here that no scenario mentions is still in the model.

## Usage (optional)

A second, separate file: how often each event type really happened over a window. The book then shows each slice's use, the busiest slices and the unused ones.

```json
{
  "app": "eventpad",
  "at": "2026-10-27T18:50:48+00:00",
  "since": "2026-09-27T18:50:48+00:00",
  "days": 30,
  "total": 1189,
  "counts": { "PropertyAdded": 251, "SliceElementAdded": 154 },
  "unmatched": ["PaymentTaken"]
}
```

| Field | Required | What it is |
|---|---|---|
| `app` | yes | The same name as the build file's. |
| `counts` | yes | How many times each event type happened in the window, by name. |
| `total` | yes | All the events in the window. |
| `at`, `since`, `days` | no | The window: its end, its start, its length in days. |
| `unmatched` | no | Event types that happened but that no scenario mentions. |

Only counts per event type: no ids, no data, nothing about who did what.

## File names

- A build: `<date>-<app>-<short sha>-built.json`, plus a `latest-built.json` copy.
- A plan (`eventbook-plan/1`): `<app>-plan.json` (or `<date>-<app>-plan.json`).
- Usage: `latest-used.json`.
