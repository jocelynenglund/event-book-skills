# Event Book skills

Two Claude skills for designing and building software the event-modeling way, plus the format they share and a copy of Event Book to read the results in.

- **plan:** your agent proposes a design as an event model: chapters of slices, each a command and the events it records, or a view and what it shows, with Given / When / Then scenarios for the happy path and every refusal. It writes one JSON file.
- **build:** your agent makes the project's tests write the same kind of file on every build, from the scenarios the tests really run.

Open either file in [Event Book](https://eventpad.itsybit.se) (☰ → Import), or in the copy in [`event-book/`](event-book/). Open both and **Compare**: what was planned and built, planned but not built, and built but never planned.

## Install (Claude Code)

Run these one at a time, as two separate commands. First add the marketplace:

```
/plugin marketplace add jocelynenglund/event-book-skills
```

Then install the plugin from it:

```
/plugin install event-book@event-book-skills
```

If your Claude Code version doesn't take the `owner/repo` shorthand, use the full URL: `/plugin marketplace add https://github.com/jocelynenglund/event-book-skills.git`

Then ask your agent to design something ("Design a tool library where members borrow and reserve tools"), or to make the tests write the build ("Make our tests write the build book").

## What's here

| | |
|---|---|
| [`plugins/event-book/skills/plan`](plugins/event-book/skills/plan/SKILL.md) | The plan skill |
| [`plugins/event-book/skills/build`](plugins/event-book/skills/build/SKILL.md) | The build skill |
| [`plugins/event-book/reference/format.md`](plugins/event-book/reference/format.md) | The format, with JSON Schemas for the build file and the optional usage file |
| [`examples/`](examples/) | A plan an agent wrote with the plan skill from a one-paragraph brief |
| [`event-book/`](event-book/) | A static copy of Event Book to run yourself |

## The format

The format is a description, not a standard: borrow from it, change it, and expect it to change. It's also at [buildbook.itsybit.se/spec.html](https://buildbook.itsybit.se/spec.html).

Made by Jocelyn Englund · [itsybit.se](https://itsybit.se). Based on Event Modeling by Adam Dymitruk.
