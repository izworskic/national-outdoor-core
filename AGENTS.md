# Agent boundary

Work only inside this repository's stated ownership scope.

Do not copy implementation from sibling tool repositories. Shared location/freshness helpers belong in `izworskic/national-outdoor-core`. Cross-tool behavior must use explicit versioned package or HTTP contracts.

Preserve existing public canonical URLs unless a migration issue explicitly authorizes a URL change.

## Mandatory ChrisIzworski.com site-tag contract

Any repository that serves HTML on `chrisizworski.com`, any `*.chrisizworski.com` hostname, or an extracted tool whose canonical output is routed into `chrisizworski.com` must include these identifiers globally:

- GA4 measurement ID `G-Y5D2V2W7HN`
- AdSense publisher ID `ca-pub-8222782620788075` via `<meta name="google-adsense-account" content="ca-pub-8222782620788075">`

Implement them in the root layout/document/template/generator or an idempotent build scanner so all current and future HTML receives them automatically. Do not treat per-page manual insertion as compliant. Missing either identifier in rendered HTML is a release failure where a verification gate exists.

Before attaching a new or extracted repository to a ChrisIzworski.com production hostname, verify both identifiers in its build output. Redirect-only repositories that serve no HTML are exempt; their canonical destination must comply.

The network source-of-truth policy is `izworskic/chrisizworski-com/docs/NETWORK_SITE_TAGS.md`.
