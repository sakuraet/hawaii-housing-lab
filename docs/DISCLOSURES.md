# Disclosures

AI-assisted development is welcome. This document exists so reviewers can
confirm that your tool's code, models, services, and dependencies are compatible
with the challenge's open-source and downstream-use requirements. Disclose
material use; incidental use of a general coding assistant is lower risk but
should still be noted if its terms affect your submission.

# AI-Assisted Code Generation

| Tool | Used for |
| ---- | -------- |
| Claude Code | Restructuring the model so each county's rules and assumptions live in a config file (`src/core/`, `src/localities/`) instead of the calculation code; porting the team's later model changes from `@uhero/feasim` 0.2.1; writing the tests that check the config against the original model (`test/honolulu-config.test.ts`, `test/schedule.test.ts`, `test/zoning.test.ts`, `test/parking.test.ts`, `test/fees.test.ts`, `test/market.test.ts`, `test/locality.test.ts`); drafting documentation |

# Pretrained Models, Weights, and Embeddings

[List any pretrained models, model weights, embeddings, or model libraries your
tool incorporates or requires. For each, give the name, source, and the license
or terms that govern it. Flag any noncommercial, field-of-use, or
acceptable-use restrictions.]

| Model / asset | Source | License / terms | Restrictions |
| ------------- | ------ | --------------- | ------------ |
| [name] | [URL] | [license] | [none / noncommercial / etc.] |

# External APIs and Hosted Services

[List any API or hosted service your tool needs to function. Note whether there
is a free tier, whether access could lapse, and any terms limiting commercial,
government, or downstream use. Reviewers prioritize tools whose data and services
remain freely available to end users.]

# Dependency Licenses

[Confirm that your runtime dependencies are permissively licensed and compatible with closed-source downstream integration. Copyleft (GPL, AGPL, LGPL, MPL, EUPL), source-available-but-not-open-source, noncommercial, or unknown-license dependencies must be flagged here and resolved. Your SBOM (exported from GitHub's dependency graph) is the source of truth; summarize any exceptions.]

| Dependency | License | Runtime or dev-only | Notes |
| ---------- | ------- | ------------------- | ----- |
| [name] | [license] | [runtime / dev] | [ok / flagged] |

# Generated or Copied Code

[Note any code copied or adapted from external sources, and the license it came under. Ensure attribution requirements (e.g., an entry in NOTICE) are met.]

## Important Notice (WIP) 
Note: imported unchanged in commit `b29c53c` this is from @uhero/policy-simulator which is OSI compliant.

Model changes made later by a team member (Sakura Takahashi) during the Coding Period, first in UHERO's package and released as `@uhero/feasim` 0.2.1, were ported into this repository: commits `059c4ef`, `69b85fa`, `91255fe`, `01544aa` and `27716f3` of UHERO/policy-simulator-package (Bill 7 grant sizing and prevailing wages, RLV detail, rent escalation, one permitting and construction time for every zone). The package's other changes after `6e75844` (renaming, publishing, release automation and version bumps, by non-team UHERO staff) were not ported.
