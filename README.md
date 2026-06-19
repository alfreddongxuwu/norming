# Norming experiment

Prior norming study for the thesis project. The experiment is implemented in jsPsych and is designed for deployment as a static GitHub Pages site.

## Design

- 2 items: photo, package
- 2 prior conditions: high, low
- 4 between-subjects cells
- 2 continuous ratings per participant, shown together on one page: completion likelihood and attempt likelihood
- The two rating questions are shown without numbers and their order is randomized

For local review, force a condition with a query parameter:

- `?condition=0`: photo, high prior
- `?condition=1`: photo, low prior
- `?condition=2`: package, high prior
- `?condition=3`: package, low prior

## Local development

```bash
pnpm install
pnpm dev
```

Run validation and create the production build:

```bash
pnpm test
pnpm build
```

## Data collection status

This version is a local prototype. It does not transmit participant data. DataPipe, private OSF storage, Prolific URL parameters, and the Prolific completion redirect will be connected only after the full experiment flow has been reviewed.
