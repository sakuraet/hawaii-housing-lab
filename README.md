<!--
==============================================================================
HOW TO USE THIS TEMPLATE (delete this comment block once you've read it)

1. Click "Use this template" on GitHub to create your own PUBLIC repository.
2. Read docs/REPO_SETUP_GUIDE.md and turn on the repository security settings (secret scanning, push protection, code scanning). These are settings, not files, so the template cannot enable them for you.
3. Replace every [bracketed placeholder] below with your project's details.
4. Fill in the "Command contract" so anyone can set up, run, and test your tool with the exact commands you list.
5. Work through SUBMISSION_CHECKLIST.md before you submit.

This template is language-agnostic. Use Python, JavaScript, Go, R, or anything else. The files here are configuration and documentation only; nothing forces a particular language or framework on you.
==============================================================================
-->

# Feasim: Hawaii Housing Lab

Give it a lot (its size, zoning and height limit) and a policy pathway, such as current zoning, Bill 7 or a transit-oriented development (TOD) permit. It works out what a developer could build there, then runs the project's pro forma: units, parking, costs, rents and sales, financing, residual land value and developer returns. It finishes with a verdict: is the project strong, marginal or poor?

Some things you can use it for:

- **Compare pathways for one lot:** Which policy makes a project pencil?
- **Test assumptions:** How do land cost, construction cost, interest rates or a subsidy change the answer?
- **Run many parcels:** Map or total the housing a policy would make feasible across a district or the whole island.

**Note:** The model code is in plain TypeScript with no runtime dependencies, so it runs in Node or the browser.

## Command contract (WIP)

Run these from the repository root, on a clean checkout:

| Step  | Command   | Notes |
| ----- | --------- | ----- |
| Setup | `npm ci`  | Installs the exact dependencies in `package-lock.json` and builds the model into `dist/` |
| Run   | `npm run dev` | Starts the tool at http://localhost:3000; so far it only shows the engine running on a made-up lot |
| Test  | `npm test` | Runs the automated tests (Vitest) |

## Repository layout

| Folder | What's in it |
| ------ | ------------ |
| `src/`, `test/` | The engine, county configs, scenarios and their tests |
| `web/` | The interactive tool (Next.js), which imports the engine as the `feasim-challenge` package |
| `scripts/` | Scripts that collect the data, build the parcel table and run it through the engine; see [scripts/README.md](scripts/README.md) |
| `data/sample/` | A small made-up sample; all other data stays out of the repo |
| `docs/` | Model, data and submission documents |
| `templates/` | The starting point for adding a county |

**Requirements:** Node.js 24 and npm. CI runs the same commands on Ubuntu with Node.js 24 (see `.github/workflows/ci.yml`).

No environment variables or API keys are needed.

## Data (WIP)

The tool's data comes from the Hawaiʻi Statewide GIS Program's public parcel and zoning layers. One command downloads and builds it; [scripts/README.md](scripts/README.md) has the setup and each step:

```bash
python scripts/build_data.py
```

Nothing it downloads or builds is committed. Full provenance goes in [docs/DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md).

## Documentation (WIP)

- [Model & Assumptions Overview](docs/MODEL_AND_ASSUMPTIONS.md) — how the tool works and what it assumes
- [Model documentation](docs/model/README.md) — the pipeline every pathway runs, each Honolulu pathway, and every variable with its source
- [Policy Scenario Comparison](docs/POLICY_SCENARIO_COMPARISON.md) — scenario ranking and drivers
- [Data Provenance](docs/DATA_PROVENANCE.md) — sources, licenses, and cleaning steps
- [Disclosures](docs/DISCLOSURES.md) — AI tools, pretrained models, and external services
- [Presentation Guide](docs/PRESENTATION_GUIDE.md) — slide deck and demo video guidance

## License (WIP)

This project is licensed under the **Apache License 2.0** (see [LICENSE](LICENSE)), the challenge's recommended default because its express patent grant is the safest choice for tools that may later be adopted or integrated downstream.

The challenge also permits **MIT**, **BSD 3-Clause**, and **BSD 2-Clause**. If you choose one of these instead, replace the LICENSE file with the full text of your chosen license and update this section. Copyleft licenses (GPL, AGPL, LGPL, MPL, EUPL) and public-domain dedications (CC0, the Unlicense) are **not** permitted for submission code. Your dependencies must also be permissively licensed — see docs/DISCLOSURES.md.

## Team

- **Patrick Spence** – Program Manager at National Association of Counties (NACo)
- **Phillip Lee** – Post-doc researcher at University of Hawaiʻi Economic Research Organization (UHERO)
- **Sakura Takahashi** – Junior Housing Research Associate at University of Hawaiʻi Economic Research Organization (UHERO)
- **Trey Gordner** – Policy researcher and data analyst at University of Hawaiʻi Economic Research Organization (UHERO)
