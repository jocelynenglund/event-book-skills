---
name: plan
description: Propose a feature or system as an event model (chapters of slices with Given / When / Then scenarios) and write it as one eventbook-plan/1 JSON file that Event Book opens (☰ → Import). Use when someone asks to design, plan, model or spec a feature, a workflow or a whole app, especially an event-sourced one, or says "event model", "event modeling", "Event Book" or "Given / When / Then".
---

# Event Book: plan a design as an event model

When someone asks you to design a feature, plan a system or spec a workflow, propose it as an **event model**: what people do, what the system records, and what they see. Then write it as **one JSON file** in the `eventbook-plan/1` format, which they open in Event Book (https://eventbook.itsybit.se, ☰ → Import). They read it as a book of chapters and slices, adjust it, tick each slice Refined when it is right, and build from it.

This is the one plan format Event Book publishes. Event Book's own guide for agents is the full reference; read it if you can: **https://eventbook.itsybit.se/llms.txt**. The schema is https://eventbook.itsybit.se/plan.schema.json and a complete example is https://eventbook.itsybit.se/plan.example.json. This skill is the short version, plus the habits that make a plan good.

The plan is a proposal. The product owner decides what is refined. Never write anything that says a slice is refined or done.

## 1. Start from the events

An event is a fact that happened, in the past tense (`Order placed`, `Seat released`). Lay the events out left to right in the order the story happens, then add what people see and do around them. Read the timeline aloud as a story to check it makes sense. The state of the system is only ever what the events add up to.

Every step follows one of four patterns. The file has three kinds of step:

1. **State change (`"kind": "do"`):** a screen sends a command, and the command records one or more events, or is refused with a reason. *Screen → command → event(s).*
2. **State view (`"kind": "see"`):** events are turned into a read model, and a screen shows it. *Events → read model → screen.*
3. **Automation (`"kind": "auto"`):** an event happens, a processor (software, not a person) looks at its to-do list (a read model) and runs a command, which records events. *Event → processor → command → event(s).*
4. **Translation:** an event from another system becomes one of ours. Write it as an `auto` step whose `when` event has `"external": true`.

Group steps into **chapters**, one per feature or part of the journey (Ordering, Paying, Kitchen…), in story order.

## 2. One slice per command or view

Each step is one **slice**, something that can be built and tested on its own: one command, or one read model, or one automation. Never a step that does two of these. Slices share only events; if two screens need the same data in different shapes, make two read models.

Names:
- Events: past tense, in business words. `Order placed`, not `OrderCreated`.
- Commands: imperative. `Place order`, `Cancel booking`.
- Read models: named by the question they answer. `Open orders`, `Seats left on a flight`.
- Screens: what the person sees. Processors: the job they do. Use the domain's words, not database words ("update", "record", "entity").
- The same thing gets the same spelling everywhere: stickies with the same name are one sticky, and the first step that mentions it decides its fields.

## 3. Write scenarios, not prose

Every slice gets Given / When / Then scenarios:

1. **Happy case first** for every command: Given nothing (or only the fewest events the command needs), When the command, Then its event.
2. **One scenario per refusal**, each with the reason a person would read (`"Sold out today"`, `"Only the organizer can cancel"`). A refusal always has a reason.
3. **A view** shows its rows for a few simple histories: nothing yet (`"rows": []`), one event, a later event changing an earlier row.
4. **An automation** shows the event that starts it and what it records.

Make the happy case and every business-rule refusal `"mustHave": true`; leave it out for a nice to have. Use small, concrete example values (ids like `"o-1"`, names like `"Sam"`, numbers as numbers), the same ones across a chapter, and the same field names as the step's `fields`.

- **Time:** when a rule depends on "now" (due dates, expiry), pass it in as a command field (`"today": "2026-11-03"`). Never rely on a hidden clock.
- **Views have no clock and no caller.** A view only gets the events. If what it shows depends on today or on who is asking, show the plain fact (`closesOn`) and let the screen compare it; put access rules on the command or the server. A view scenario that needs `today` or a caller can't be tested as written.
- **Given** holds every event the decision depends on, from any chapter (a loan's `Tool borrowed` when returning it).
- **Harmless repeats** (a second identical request that changes nothing) have no outcome of their own in this format: `then` is an event, a refusal, or a read model. Say it in the step's `description` ("Returning twice records nothing") and in your notes, rather than inventing a refusal.

**How big:** a first proposal covers the main journey, 3–6 chapters. Per command: the happy path plus the refusals that matter (2–5 scenarios); per view, 1–2. Around 15–35 scenarios in all is plenty. Mention the rules you left out in your notes.

## 4. Check where the data comes from

- Every field on a read model comes from a field of an event it reads.
- Every field of an event comes from its command, from an external event, or is worked out when the command runs (a time, a generated id). Say which in the description when it is not obvious.
- Every field of a command comes from the screen or from a read model the screen shows.

A field with no origin means the model is incomplete: add the missing step or remove the field.

## 5. Write the file

One JSON object, `"format": "eventbook-plan/1"`, a `name`, a `description`, and `chapters` (each with `name` and `steps`, in timeline order). A short sketch:

```json
{
  "format": "eventbook-plan/1",
  "name": "Sandwich shop",
  "description": "Guests order sandwiches and the kitchen makes them.",
  "chapters": [
    {
      "name": "Ordering",
      "steps": [
        {
          "kind": "do",
          "name": "Place order",
          "screen": "Order form",
          "command": "Place order",
          "event": "Order placed",
          "fields": "orderId, sandwich, size",
          "description": "A guest orders a sandwich.",
          "scenarios": [
            {
              "name": "A guest orders a footlong",
              "mustHave": true,
              "given": [],
              "when": { "values": { "orderId": "o-1", "sandwich": "BLT", "size": "footlong" } },
              "then": { "event": "Order placed", "values": { "orderId": "o-1", "sandwich": "BLT", "size": "footlong" } }
            },
            {
              "name": "Sold out is refused",
              "mustHave": true,
              "given": [ { "event": "Sandwich sold out", "values": { "sandwich": "BLT" } } ],
              "when": { "values": { "orderId": "o-2", "sandwich": "BLT", "size": "6 inch" } },
              "then": { "rejected": "Sold out today" }
            }
          ]
        },
        {
          "kind": "see",
          "name": "Kitchen queue",
          "events": ["Order placed", "Order paid"],
          "readModel": "Kitchen queue",
          "screen": "Kitchen board",
          "fields": "orderId, sandwich, size",
          "scenarios": [
            {
              "name": "The kitchen sees the paid orders",
              "mustHave": true,
              "given": [
                { "event": "Order placed", "values": { "orderId": "o-1", "sandwich": "BLT", "size": "footlong" } },
                { "event": "Order paid", "values": { "orderId": "o-1" } }
              ],
              "then": { "readModel": "Kitchen queue", "rows": [ { "orderId": "o-1", "sandwich": "BLT", "size": "footlong" } ] }
            }
          ]
        }
      ]
    }
  ]
}
```

The rules, in short (the guide has all of them):

- **`do`** needs `command`; `event` (or `events`) is what it records. **`see`** needs `readModel`; `events` lists every event it is built from; add `"list": true` for a list of rows. **`auto`** needs `processor` and `command`; `when` is the starting event, `using` the to-do read model (add `"todo": true`), `result` what the command records.
- **`fields`** is a comma-separated string: `"orderId, price:number, paid:boolean, items[]"`. On `do` and `auto` steps they are the command's and its events'; on `see` steps, the read model's.
- **A scenario** has `name`, optional `mustHave`, `given` (past events, each `{ "event", "values" }`, `[]` for nothing), `when` (`{ "values" }` for `do` and `auto`; left out on `see`) and `then`: one of `{ "event", "values" }`, `{ "rejected": "reason" }`, `{ "readModel", "rows" }` or `{ "readModel", "values" }`.
- **External events and legacy tables:** mark an event another system records with `"external": true`, and an event that is really a legacy table with `"table": "<name>"`; with several events, or on an `auto` step, write each as `{ "name", "external" | "table" }`.
- **Only the listed keys are allowed.** Event Book refuses a file with an unknown key and nothing is imported. Don't add `repo`, `commit` or `build`; those belong to files the tests write (the build skill).

Before handing it over, **validate it** against https://eventbook.itsybit.se/plan.schema.json if you can (for example `npx ajv-cli@5 validate --spec=draft2020 -s plan.schema.json -d <file>`), or at least make sure it parses as JSON.

Save it as `<app>-plan.json` (lower case, dashes), unless the person names a path, and tell them: **"Open it in Event Book: ☰ → Import."**

## 6. Then say what you assumed

After the file, list in a few lines:
- the open questions;
- the rules you assumed (each one is a refusal scenario they can delete);
- what you left out on purpose.

The person refines the model in Event Book, and that's where it becomes the plan. When they're happy with it, the **build** skill starts from these exact scenarios as failing tests, before any code exists.

### Checklist

- Valid JSON, `"format": "eventbook-plan/1"`, a `name` and a `description`.
- Chapters follow the story; every step is one command, one read model or one automation.
- Events past tense, commands imperative, read models named by their question; the same name everywhere.
- Every command has its happy case first, then one scenario per refusal, each with a reason.
- Every view has a scenario with its rows; every automation has a processor, a command, a result and a scenario (and a `when` event unless it runs on a schedule).
- Every field has an origin. No slice without scenarios (if one needs none, say so in its description).
- Nothing says refined or done.

## 7. Working as a team: eventmodelers.ai

Event Book is for one person on their own device. Teams that want to model together, live on one canvas (common in companies), can take the plan to [eventmodelers.ai](https://app.eventmodelers.ai), Martin Dilger's collaborative event-modeling app:

1. Open the plan in Event Book (https://eventbook.itsybit.se): ☰ → Import.
2. ☰ → Export… → **For eventmodelers.ai**. It saves `<model>-emstudio.json`: each chapter a timeline, each slice its columns, the scenarios as specs, and the slice notes and open comments as markdown notes (comments on yellow).
3. In eventmodelers.ai, import that file into a board and invite the team.

When the person mentions a team, several people or a workshop, offer this route after writing the file.

## Good to know

- Keep a first proposal small: the main journey and its refusals. People add the rest in the book.
- Method: Adam Dymitruk's Event Modeling and Martin Dilger's way of slicing ("Understanding Eventsourcing"). The guide at https://eventbook.itsybit.se/llms.txt is the reference for the format; it may change, and it wins over this file.
