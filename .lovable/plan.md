# Dashboard Overview Visual Update

## Goal
Restyle only the Dashboard overview to closely match the supplied reference screens and use the supplied InsureS logo and blue/orange brand palette.

## Changes
- Add the supplied InsureS logo as a project asset and use it in the Dashboard heading/sidebar branding.
- Recompose the Dashboard header with the title, supporting summary, renewal notice, refresh action, and existing pipeline setup action.
- Present the existing period/user filters as a compact toolbar with Apply and Reset controls.
- Restyle the existing KPI values into one responsive row with clear icons and blue, green, amber, and red status accents.
- Restyle the existing Fresh/Renewal/Total pipeline information into compact horizontal stage summaries, retaining all current data, filtering, permissions, and calculations.
- Restyle the existing monthly chart, insurer breakdown, and pipeline-stage summary to match the attached clean enterprise layout, including polished empty states.
- Preserve dark mode using equivalent semantic colors.

## Technical Details
- Scope changes to presentation files for the Dashboard overview, shared pipeline display, and brand asset usage.
- Do not alter queries, formulas, record filtering, roles, permissions, APIs, database structure, or stored data.
- Use existing design-system controls and semantic color tokens.
- Verify the result in the live preview at desktop and mobile widths, and run the existing TypeScript check.
