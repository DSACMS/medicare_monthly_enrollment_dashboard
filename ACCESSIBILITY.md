# Accessibility Statement

## Conformance Target

This project targets **WCAG 2.2 Level AA** for all user-facing content and interactions. This is a target, not a claim of conformance. Automated testing, manual testing, and screen-reader testing supplement but do not establish conformance.

## Section 508 Context

As a U.S. government project (CMS), this dashboard falls under Section 508 of the Rehabilitation Act. We aim to meet WCAG 2.2 Level AA, which aligns with the Revised Section 508 Standards.

## Geographic Scope

The dashboard covers all geographic areas served by the Medicare program:

- **50 U.S. states** — full map and data support
- **District of Columbia** — full map and data support
- **5 inhabited U.S. territories**: Puerto Rico, Guam, American Samoa, U.S. Virgin Islands, Northern Mariana Islands — data and table support; no map geometry in Phase 0
- **Foreign and Other Outlying Areas** — data available in the canonical table, not shown on map
- **Unknown** — records with unreported geography, available in the table

## Map as Secondary Interface

The interactive choropleth map is a **visual enhancement**, not the primary interface. The geographic selector and canonical enrollment table are the primary keyboard and screen-reader interfaces. Users who cannot operate the map can complete all essential tasks through the selector and table.

## Supported Keyboard Tasks

- Skip to main content
- Operate the geographic selector (open, search, select, clear)
- Switch between Hospital/Medical and Prescription Drug views
- Switch between Yearly and Monthly trend ranges
- Expand cards to overlay view
- Open and close mobile drawers
- Navigate tables with sort controls
- Return to national view from a selected state

## Supported Screen-Reader Test Combinations

| Screen Reader | Browser | Operating System | Status |
|---------------|---------|-----------------|--------|
| VoiceOver | WebKit (Safari) | macOS | Tested via GuidePup |
| NVDA | Chromium | Windows | Tested via GuidePup |

Screen-reader tests verify:
- Dashboard heading is discoverable
- Geographic selector is announced correctly
- Territory selection (e.g., Puerto Rico) works without map interaction
- Enrollment table has proper caption and headers
- State/territory changes are announced concisely

## Automated Testing Commands

```bash
# Unit tests
npm test

# Build the site
npm run build

# Playwright + axe accessibility tests
npm run test:a11y

# Playwright E2E tests
npm run test:e2e

# VoiceOver screen-reader tests (macOS only)
npm run test:guidepup:voiceover

# NVDA screen-reader tests (Windows only)
npm run test:guidepup:nvda

# HTML validation
npm run test:html-validation

# Link checking
npm run test:links

# Linting
npm run lint
```

## Manual Testing Requirements

Automated tools catch approximately 30-40% of WCAG issues. Manual testing is required for:

- Keyboard navigation through all interactive elements
- Screen-reader navigation and task completion
- Focus management after state changes (back button, overlay close)
- Forced-colors (high contrast) mode
- 400% browser zoom / 320 CSS pixel reflow
- Touch and pointer interaction on mobile
- Tooltip content and behavior

## Current Limitations (Phase 0)

### Known barriers deferred to Phase 1

1. **Map keyboard navigation** — SVG map paths are not individually keyboard-focusable. The map is treated as a visual aid; the selector and table are the keyboard interfaces.
2. **Territory map geometry** — Territories (Puerto Rico, Guam, etc.) have no map geometry. They are usable through the selector and table.
3. **Focus management on back button** — After returning to national view, focus placement may not always be optimal. This is being improved.
4. **Table row selection** — Table rows use click handlers with keyboard equivalents (Enter/Space), but are not native `<button>` elements. Screen-reader users navigate tables normally.
5. **Combo-box internals** — The USWDS combo-box component has internal DOM dependencies that cannot be fully avoided without replacing the component.

### What was fixed in Phase 0

- Page title updated from placeholder text
- Skip-to-main-content link added
- Heading hierarchy established
- Geographic selector labeled with visible instructions
- Territories included in selector and data tables
- Map geographic scope documented with visible note
- `tabindex="0"` removed from table containers
- Input-neutral language replaces "Click" instructions
- Histogram labeled as "Distribution across 50 states"

## How to Report an Accessibility Problem

If you encounter an accessibility barrier on this dashboard:

1. [Open an issue](https://github.com/DSACMS/medicare_monthly_enrollment_dashboard/issues/new) with:
   - The page or component affected
   - Steps to reproduce
   - Expected vs. actual behavior
   - Your browser, operating system, and assistive technology (if applicable)
2. Or email: opensource@cms.hhs.gov

We respond to accessibility reports within 5 business days.

## Testing Evidence

Playwright test results and axe-core scan reports are available in GitHub Actions artifacts for each pull request. Screen-reader test results are recorded when GuidePup tests run.

## Last Reviewed

2026-09-02

## Related Documents

- [Maps Accessibility Best Practices](https://mgifford.github.io/ACCESSIBILITY.md/examples/MAPS_ACCESSIBILITY_BEST_PRACTICES.html)
- [CI/CD Accessibility Best Practices](https://mgifford.github.io/ACCESSIBILITY.md/examples/CI_CD_ACCESSIBILITY_BEST_PRACTICES.html)
- [WCAG 2.2 Level AA](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [USWDS Accessibility](https://designsystem.digital.gov/components/accessibility/)
