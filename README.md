# CMS OSPO Website Template
A template repository to set up a HTML/CSS/JS/Markdown/USWDS/11ty website

## About the project
This repository serves as a template for the CMS OSPO's static website stack:
- HTML/CSS/Javascript
- Markdown for content
- 11ty for Static Site Generation
- US Web Design System (USWDS)
- search.gov and Digital Analytics Program

This template is a fork from the 18F/guides repository. The repository documentation can be used as a resource: [https://github.com/18F/guides?tab=readme-ov-file](https://github.com/18F/guides?tab=readme-ov-file)

Other applications of this template include:
- CMS OSPO [metrics website](https://dsacms.github.io/metrics) and [repository](https://github.com/DSACMS/metrics)
- CMS OSPO [ospo-guide website](https://dsacms.github.io/ospo-guide/) and [repository](https://github.com/DSACMS/ospo-guide)
- CMS OSPO [SHARE IT Act Landing Page](https://dsacms.github.io/share-it-act-lp/) and [repository](https://github.com/DSACMS/share-it-act-lp)

<!---
### Project Vision
**{project vision}** -->

<!--
### Project Mission
**{project mission}** -->

<!--
### Agency Mission
TODO: Good to include since this is an agency-led project -->

<!--
### Team Mission
TODO: Good to include since this is an agency-led project -->

## Core Team

A list of core team members responsible for the code and documentation in this repository can be found in [COMMUNITY.md](COMMUNITY.md).

## Repository Structure
```
.
├── _data          # Data directory
├── _includes      # Contains various components
│   ├── home
│   ├── layouts
│   └── searchgov
├── assets         # Static assets like images, CSS, and JavaScript
│   └── _common    # Common assets used across all pages
│       ├── _img
│       │   └── favicons
│       ├── js
│       └── styles
│           └── overrides
├── config         # Configurations to supplement website functionality
└── content.       # Individual web page content lives here
    ├── basic_page
    ├── other
    └── side_nav_page
```

# Development and Software Delivery Lifecycle

The following guide is for members of the project team who have access to the repository as well as code contributors. The main difference between internal and external contributions is that external contributors will need to fork the project and will not be able to merge their own pull requests. For more information on contributing, see: [CONTRIBUTING.md](./CONTRIBUTING.md).

## Local Development

The site uses 11ty. Ensure that you have the latest version of [Node](https://nodejs.org/en/download) installed.

To run the site locally:

1. Clone this repo
2. From the repo directory, run:
   ```sh
   npm install
   npm run dev
   ```
3. Open http://localhost:8080

## I’d like to make a contribution, how do I update this content?

We welcome contributions to be made to our resources. All are encouraged to suggest improvements that benefit the rest of the organization. To make a contribution to a document:

1. Find markdown file with document contents located in `/content`.
2. Make edits in a separate branch. Be sure to update `subnav` front matter if new sections are made.
3. Create a pull request with anyone in the OSPO team as reviewers as noted in [COMMUNITY.md](COMMUNITY.md).

## Coding Style and Linters

We use a GitHub workflow in place that performs a number of tests on every pull request:

- Automated accessbility test with`pa11y-ci`
- Code linting with `eslint`
- HTML validation with `html-validate`
- Internal link checking with `check-html-links`

Additionally, we use `prettier` for code formatting.

## Branching Model

This project follows [trunk-based development](https://trunkbaseddevelopment.com/), which means:

- Make small changes in [short-lived feature branches](https://trunkbaseddevelopment.com/short-lived-feature-branches/) and merge to `main` frequently.
- Be open to submitting multiple small pull requests for a single ticket (i.e. reference the same ticket across multiple pull requests).
- Treat each change you merge to `main` as immediately deployable to production. Do not merge changes that depend on subsequent changes you plan to make, even if you plan to make those changes shortly.
- Ticket any unfinished or partially finished work.
- Tests should be written for changes introduced, and adhere to the text percentage threshold determined by the project.

This project uses **continuous deployment** using [Github Actions](https://github.com/features/actions) which is configured in the [./github/workflows](.github/workflows) directory.

Pull-requests are merged to `main` and the changes are immediately deployed to the production environment.

## Community

The Open Source Team at CMS is taking a community-first and open source approach to the product development of this tool. We believe government software should be made in the open and be built and licensed such that anyone can download the code, run it themselves without paying money to third parties or using proprietary software, and use it as they will.

We know that we can learn from a wide variety of communities, including those who will use or will be impacted by the tool, who are experts in technology, or who have experience with similar technologies deployed in other spaces. We are dedicated to creating forums for continuous conversation and feedback to help shape the design and development of the tool.

We also recognize capacity building as a key part of involving a diverse open source community. We are doing our best to use accessible language, provide technical and process documents, and offer support to community members with a wide variety of backgrounds and skillsets.

### Community Guidelines

Principles and guidelines for participating in our open source community are can be found in [COMMUNITY.md](COMMUNITY.md). Please read them before joining or starting a conversation in this repo or one of the channels listed below. All community members and participants are expected to adhere to the community guidelines and code of conduct when participating in community spaces including: code repositories, communication channels and venues, and events.

## Feedback

If you have ideas for how we can improve or add to our capacity building efforts and methods for welcoming people into our community, please let us know at opensource@cms.hhs.gov. If you would like to comment on the tool itself, please let us know by filing an **issue on our GitHub repository.**

### Policies

### Open Source Policy

We adhere to the [CMS Open Source
Policy](https://github.com/CMSGov/cms-open-source-policy). If you have any
questions, just [shoot us an email](mailto:opensource@cms.hhs.gov).

### Security and Responsible Disclosure Policy

_Submit a vulnerability:_ Vulnerability reports can be submitted through [Bugcrowd](https://bugcrowd.com/cms-vdp). Reports may be submitted anonymously. If you share contact information, we will acknowledge receipt of your report within 3 business days.

For more information about our Security, Vulnerability, and Responsible Disclosure Policies, see [SECURITY.md](SECURITY.md).

### Public domain

This project is in the public domain within the United States, and copyright
and related rights in the work worldwide are waived through the [CC0 1.0
Universal public domain
dedication](https://creativecommons.org/publicdomain/zero/1.0/) as indicated in [LICENSE](LICENSE).

All contributions to this project will be released under the CC0 dedication. By
submitting a pull request or issue, you are agreeing to comply with this waiver
of copyright interest.


