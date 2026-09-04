# How to Contribute

We're so thankful you're considering contributing to an [open source project of
the U.S. government](https://code.gov/)! If you're unsure about anything, just
ask -- or submit the issue or pull request anyway. The worst that can happen is
you'll be politely asked to change something. We appreciate all friendly
contributions.

We encourage you to read this project's CONTRIBUTING policy (you are here), its
[LICENSE](LICENSE), and its [README](README.md).

## Getting Started

This project doesn't currently use `good-first-issue` or `easy` labels. If you're new and looking for a place to start, check open issues for anything untriaged, or comment on an issue to ask if it's still relevant before picking it up — this avoids duplicate work.

## Team Specific Guidelines

Our project maintainers are listed in [COMMUNITY.md](COMMUNITY.md). They are responsible for reviewing and merging all pull requests. Feel free to tag them in issues or pull requests if you need input or assistance.

### Building dependencies

This is a Node.js project built with [11ty](https://www.11ty.dev/) and D3.js. You'll need [Node 24 LTS](https://nodejs.org/en/download) installed, then run:

```bash
npm install
```

### Building the Project

To run the site locally:

```bash
npm run dev
```

Then open http://localhost:8080. See the [README](README.md) for more on the project structure — chart and visualization code lives in `assets/_common/charts`, table configs live in `assets/_common/tables`, and data-fetching logic lives in `src/datasets` and `src/api`.

### Workflow and Branching

This project follows [trunk-based development](https://trunkbaseddevelopment.com/):

1. Fork the project (external contributors) or check out a feature branch (internal contributors)
2. Check out the `main` branch
3. Create a short-lived feature branch
4. Write code and, where applicable, tests for your change
5. From your branch, make a pull request against `main`
6. Work with repo maintainers to get your change reviewed
7. Wait for your change to be merged into `main`
8. Delete your feature branch

Treat each change you merge to `main` as immediately deployable to production — this project uses continuous deployment via GitHub Actions, and pull requests merged to `main` are deployed automatically.

### Testing Conventions

We use a GitHub workflow that runs a number of checks on every pull request, including:

- Code linting with `eslint`
- HTML validation with `html-validate`
- Internal link checking with `check-html-links`

If you add or change a chart, table, or data-fetching function (e.g. in `assets/_common/charts`, `assets/_common/tables`, or `src/datasets`), please add or update relevant tests alongside it (see `yearlyLatest.test.js` for an example).

### Coding Style and Linters

We use `eslint` for JavaScript linting and `prettier` for code formatting. Before committing your changes, please run:

```bash
npx eslint .
npx prettier --write .
```

### Writing Issues

When creating an issue, please try to adhere to the following format:

```
module-name: One line summary of the issue (less than 72 characters)

### Expected behavior

As concisely as possible, describe the expected behavior.

### Actual behavior

As concisely as possible, describe the observed behavior.

### Steps to reproduce the behavior
  
List all relevant steps to reproduce the observed behavior.
```

For standard templates, see our [.github/ISSUE_TEMPLATE/bug_report.md](.github/ISSUE_TEMPLATE/bug_report.md) or [.github/ISSUE_TEMPLATE/feature_request.md](.github/ISSUE_TEMPLATE/feature_request.md).

### Writing Pull Requests

Please keep pull requests focused on a single change. In your PR description, include:

- **Problem** — what you're fixing or adding, and why
- **Solution** — a short description of the change
- **Testing** — how you verified it works (e.g. which tests you ran or added, or which views/tabs you checked manually)

For standard templates, see our [./github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)

Some notes on commit messages:

- Describe what was done, not the result
- Use the active voice and present tense
- Keep the summary line under ~72 characters and don't end it in a period

### Reviewing Pull Requests

Pull requests are reviewed by the project maintainers listed in [COMMUNITY.md](COMMUNITY.md) before merging. Reviewers will check for:

- Correctness — does the change do what it says, without breaking existing charts, tables, or data fetching
- Accessibility — does the change, where relevant, meet 508 compliance
- Code clarity — does the change follow our `eslint`/`prettier` conventions and match the style of surrounding code
- Documentation — is the [README](README.md) updated if the change affects usage, structure, or data sources
- Scope — is the pull request focused on a single change

Once a pull request is approved, a maintainer will merge it into `main`, and the change will deploy automatically.

## Shipping Releases

This project uses continuous deployment via GitHub Actions: pull requests merged to `main` are deployed to the production static site automatically. There is no separate release/versioning process at this time.

## Documentation

Documentation improvements are always welcome, and don't require an issue to be filed first for small fixes (typos, clarifications). For larger documentation changes, please open an issue first to discuss the approach. Key areas for documentation:

- [README.md](README.md) — project overview, repository structure, and local development instructions
- Inline comments in chart, table, and data-fetching code

## Policies

### Open Source Policy

We adhere to the [CMS Open Source
Policy](https://github.com/CMSGov/cms-open-source-policy). If you have any
questions, just [shoot us an email](mailto:opensource@cms.hhs.gov).

### Security and Responsible Disclosure Policy

_Submit a vulnerability:_ Vulnerability reports can be submitted through [Bugcrowd](https://bugcrowd.com/cms-vdp). Reports may be submitted anonymously. If you share contact information, we will acknowledge receipt of your report within 3 business days.

For more information about our Security, Vulnerability, and Responsible Disclosure Policies, see [SECURITY.md](SECURITY.md).

## Public domain

This project is in the public domain within the United States, and copyright and related rights in the work worldwide are waived through the [CC0 1.0 Universal public domain dedication](https://creativecommons.org/publicdomain/zero/1.0/) as indicated in [LICENSE](LICENSE).

All contributions to this project will be released under the CC0 dedication. By submitting a pull request or issue, you are agreeing to comply with this waiver of copyright interest.