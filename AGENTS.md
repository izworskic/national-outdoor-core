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

## Shared visitor-experience guidance (substantial UI work only)

This repository owns its source, data, deployment and release decisions. The central site does not automatically inject its agent instructions into this repository.

For a new visitor-facing tool, a major interactive feature, or a substantial redesign, first read this repository's instructions and tests, then review the latest compatible released 1.2.x Experience OS package (`EXPERIENCE_OS_V1`):
https://github.com/izworskic/chrisizworski-com/tree/main/design-systems/experience-os-v1

Also review the Experience Investment skill for purpose-built design alternatives and proof:
https://github.com/izworskic/chrisizworski-com/tree/main/.agents/skills/experience-investment

Preserve this repository's existing safety, fact provenance, canonical URLs, advertising, ownership and CI rules. Use the smallest technically justified stack. Do not apply a universal page template or copy implementation across repositories. For small repairs, apply directly relevant guardrails without a full design exercise. Never interpret this reference as approval to merge or deploy.
