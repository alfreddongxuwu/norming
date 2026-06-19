# Norming experiment

Prior norming study for the thesis project. The experiment is implemented in jsPsych and is designed for deployment as a static GitHub Pages site.

## Design

- 2 items: photo, package
- 2 prior conditions: high, low
- 4 between-subjects cells
- 2 continuous ratings per participant, shown together on one page: completion likelihood and attempt likelihood
- The two rating questions are shown without numbers and their order is randomized

For review, force a condition with a query parameter:

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

The public condition links are preview-only and do not transmit participant data. A data-collection session begins only when all three standard Prolific URL parameters are present: `PROLIFIC_PID`, `STUDY_ID`, and `SESSION_ID`.

Pilot sessions use DataPipe to obtain a sequentially balanced condition and save one participant-level JSON object to a private OSF component. Each record includes a data schema version, identifiers and assignment metadata once, the final ratings, question order, demographics, and one total response time for each substantive page. Fixed page HTML, jsPsych bookkeeping fields, and per-slider movement times are excluded. Filenames contain a random UUID rather than a Prolific ID. The condition and filename are retained for the current browser tab so that refreshing does not consume another condition or create a different filename.

The Prolific completion redirect is not connected yet.
