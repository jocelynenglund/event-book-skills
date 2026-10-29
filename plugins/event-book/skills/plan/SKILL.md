---
name: plan
description: Propose a feature or system as an event model (chapters of slices with Given / When / Then scenarios) and write it as one JSON file that Event Book opens (☰ → Import). Use when someone asks to design, plan, model or spec a feature, a workflow or a whole app, especially an event-sourced one, or says "event model", "event modeling", "Event Book" or "Given / When / Then".
---

# Event Book: plan a design as an event model

When someone asks you to design a feature, plan a system or spec a workflow, propose it as an **event model**: what people do, what the system records, and what they see. Then write it as **one JSON file** they can open in Event Book (https://eventpad.itsybit.se, ☰ → Import). They read it as a book of chapters and slices, adjust it, and build from it.

The file uses the same shape that Given / When / Then tests write (`../../reference/format.md`, also at https://buildbook.itsybit.se/spec.html). So the plan can later be compared with the build, which the **build** skill makes the tests write.

## 1. Think in slices

An event model reads left to right, like a story. Every step is one **slice**:

- **State change** (a command): someone asks for something, and the system records **events** (facts, past tense) or refuses with a reason.
  *Place Order → Order Placed*
- **State view** (a read model): what a screen shows, built from the events so far.
  *Order Placed, Order Paid → Kitchen Queue*

Group slices into **chapters**, one per feature or part of the journey (Ordering, Paying, Kitchen…), in the order the story happens.

Names:
- Commands are imperative: `Place Order`, `Invite Guest`.
- Events are past-tense facts: `Order Placed`, `Guest Invited`.
- Views are nouns: `Kitchen Queue`, `Guest List`.
- Use the domain's own words, not technical ones (`Order Placed`, not `OrderRowInserted`).

## 2. Write scenarios, not prose

Each slice gets **Given / When / Then scenarios**: the events so far, the command (or the view), and what happens. Cover:

1. **The happy path:** the command records its events.
2. **Every refusal:** each rule that can say no, with the reason a person would read (`"Sold out today"`, `"Only the organizer can cancel"`).
3. **Nothing changes** when a repeat is harmless (`then: { "nothing": true }`).
4. **Each view:** given some events, what it shows (rows for a list).

Use realistic, small example values (ids like `o1`, names like `Alex`), the same ones across a chapter so the story holds together. Every field a command takes appears in `whenData`, and every field an event carries appears in its `data`. Fields are the model's data, so don't leave them out.

- **Time:** when a rule depends on "now" (due dates, expiry), pass it in: `"whenData": { "today": "2026-11-03" }`. Never rely on a hidden clock.
- **Given** holds every event the decision depends on, from any chapter (a loan's `Tool Borrowed` when returning it).
- **Views** may show an empty list (`"value": []`), list rows in the order the screen shows them, and include derived fields (`"status": "overdue"`).

**How big:** a first proposal covers the main journey, 3–6 chapters. Per command: the happy path plus the refusals that matter (2–5 scenarios); per view, 1–2. Around 15–35 scenarios in all is plenty. Mention the rules you left out in your notes rather than writing every one.

## 3. Write the file

One JSON object. `app` is the system's name; `files` holds one entry per chapter (or one entry with every scenario):

```json
{
  "app": "Sandwich shop",
  "files": [
    {
      "file": "ordering",
      "scenarios": [
        {
          "chapter": "Ordering",
          "title": "A guest orders a footlong",
          "given": [],
          "when": "Place Order",
          "whenData": { "orderId": "o1", "sandwich": "BLT", "size": "footlong" },
          "then": { "events": [ { "type": "Order Placed", "data": { "orderId": "o1", "sandwich": "BLT", "size": "footlong" } } ] }
        },
        {
          "chapter": "Ordering",
          "title": "Sold out is refused",
          "given": [ { "type": "Sandwich Sold Out", "data": { "sandwich": "BLT" } } ],
          "when": "Place Order",
          "whenData": { "orderId": "o2", "sandwich": "BLT", "size": "6 inch" },
          "then": { "rejected": "Sold out today" }
        },
        {
          "chapter": "Kitchen",
          "title": "The kitchen sees the paid orders",
          "given": [
            { "type": "Order Placed", "data": { "orderId": "o1", "sandwich": "BLT", "size": "footlong" } },
            { "type": "Order Paid", "data": { "orderId": "o1" } }
          ],
          "when": null,
          "then": { "view": "Kitchen Queue", "value": [ { "orderId": "o1", "sandwich": "BLT", "size": "footlong" } ] }
        }
      ]
    }
  ]
}
```

The rules:
- **`when`** is the command's name, or `null` for a view.
- **`then`** is exactly one of:
  - `{ "events": [ … ] }`: accepted, these events recorded;
  - `{ "rejected": "reason" }`: refused;
  - `{ "nothing": true }`: accepted, nothing changed;
  - `{ "view": "Name", "value": … }`: what the view shows (an object, or a list of rows).
- **`given`** lists earlier events, oldest first, each `{ "type", "data" }`.
- **`events`** (optional, beside `app` and `files`) says what the scenarios can't: an event another system records (`{ "external": true, "from": "Stripe" }`, drawn yellow), or a table in a legacy database read as events (`{ "table": true, "from": "the old ERP" }`, a shadowy orange). Name every such event there, keyed by its type, even if no scenario uses it yet:
  ```json
  "events": { "Payment Received": { "external": true, "from": "Stripe" }, "Orders Tbl": { "table": true, "from": "the old ERP" } }
  ```
- Don't add `repo`, `commit` or `build`: those mark a file as built by tests. A proposal has none.
- The JSON Schema is at https://buildbook.itsybit.se/build-export.schema.json. Check the file against it if you can.

Before handing it over, make sure it parses as JSON (run a parser if you have a tool; otherwise re-read the brackets and quotes). Check it against the schema if you can.

Save it as `<app>-plan.json` (lower case, dashes), unless the person names a path, and tell them: **"Open it in Event Book: ☰ → Import."**

## 4. Then say what you assumed

After the file, list in a few lines:
- the open questions;
- the rules you assumed (each one is a refusal scenario they can delete);
- what you left out on purpose.

The person refines the model in Event Book, and that's where it becomes the plan.

## 5. Working as a team: eventmodelers.ai

Event Book is for one person on their own device. Teams that want to model together, live on one canvas (common in companies), can take the plan to [eventmodelers.ai](https://app.eventmodelers.ai), Martin Dilger's collaborative event-modeling app:

1. Open the plan in Event Book (https://eventpad.itsybit.se, or the copy in this repo's `event-book/`): ☰ → Import.
2. ☰ → Export… → **For eventmodelers.ai**. It saves `<model>-emstudio.json`: each chapter a timeline, each slice its columns, the scenarios as specs, and the slice notes and open comments as markdown notes (comments on yellow).
3. In eventmodelers.ai, import that file into a board and invite the team.

When the person mentions a team, several people or a workshop, offer this route after writing the file.

## Good to know

- One command per state-change slice, one view per state-view slice. Name them exactly the same in every scenario: the name *is* the slice.
- **External systems and legacy databases:** when the design reacts to another system (a payment provider, a partner's webhook) or reads an old system's tables, model what comes in as events and mark them in `events` (`external`, or `table` for a legacy table), so the book shows what's this system's own and what isn't.
- **Automations** (something that reacts to an event or a schedule and sends a command, like "hold the tool for the next reserver after it's returned" or "mark overdue loans every morning") aren't their own kind in this file yet. Write the command they send as its own slice, and put the trigger in its scenarios' titles so it shows in the book: `"title": "After a return, the tool is held for the first reserver"`, `"title": "Each morning, loans past due are marked overdue"`. Repeat it in your notes.
- Keep a first proposal small: the main journey and its refusals, 3–6 chapters. People add the rest in the book.
- This is a format Event Book reads, not a standard. It may change; the spec page is the reference.
