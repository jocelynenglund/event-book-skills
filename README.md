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

## What's new in 0.2

- **Start red.** The build skill now begins from the plan: one spec per slice, grouped by chapter, each beside a stub that throws `NotBuiltYet`. Those scenarios are pending (CI stays green) until you run them red on purpose, then go green one slice per commit.
- **Refusals with reasons.** A refused command is asserted with its reason, never as "nothing happened".
- **Views have no clock and no caller.** The plan skill keeps dates and access rules out of views, where they can't be tested.
- **Happy case first** for every command.
- **Two books when the rules live in two places**, such as a page and the server that checks it again.

A worked example of all of it, from model to production one commit at a time: [Count me in](https://github.com/jocelynenglund/count-me-in) and its write-up, [From idea to the shelf](https://itsybit-agent.github.io/itsybot-devlog/2026/11/04/from-idea-to-the-shelf/).

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
