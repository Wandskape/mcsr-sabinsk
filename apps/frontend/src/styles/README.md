# Frontend styles

Styles are grouped by the layout or feature that owns them:

- `global.css` — fonts, design tokens, reset, and global accessibility rules;
- `admin-*.css` — admin shell and admin-only features;
- `public-*.css` — public tournament page features;
- `playoff.css` — bracket styles shared by public and admin views.

`MainLayout.astro` imports only global, public, and playoff styles.
`AdminLayout.astro` imports only global, admin, and playoff styles.

Keep responsive rules in the feature stylesheet when practical. The dedicated
responsive files contain cross-feature breakpoints retained from the initial
stylesheet. New page-specific rules must not be added to `global.css`.
