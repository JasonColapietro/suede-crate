# Suede Crate

A Qloo-powered listening companion for curious music fans and musicians.

## Scope

Resolve favorite artists with Qloo search, let the listener choose exact matches, and build a small crate of new artists plus a movie and book from the same taste signals. The listener can save a discovery as a new seed or dismiss it, then run another discovery pass. An evidence view makes each real API step and input visible. No invented songs, audio, biographical influences, or affinity percentages.

The HTTP API and MCP tools share the same discovery workflow. No account, payment, database, or LLM dependency. Qloo keys stay on the server. All recommendations must come from Qloo; unavailable credentials return a clear configuration error instead of sample recommendations.

## Design

Palette: cloud #f5f8fa, denim #234c66, oxblood #752d44, mist #dce8ee, ink #172b38, white #ffffff.
Type: Avenir Next / system sans for product copy; Georgia for the large music-room headline.
Layout: quiet left-aligned workbench with a record sleeve as the single characteristic visual; artist search and chosen records on the left, discovery results below. The result sleeves are abstract typography, not borrowed album art.
Review: avoid dashboard cards and decorative charts. Keep the central action immediately usable, with no scroll required to begin. Mobile stacks cleanly. Explanations describe taste association, not influence or proof of genre.

## Build and verification

1. Server-only Qloo adapter with documented GET endpoints, validation, timeouts, bounded response size, private caching, and secret-safe errors.
2. Shared discovery orchestration, HTTP handlers, and stateless MCP tools.
3. Responsive accessible frontend with search disambiguation, pinned seeds, dismiss/refine, links and downloadable session notes.
4. Contract tests with synthetic fixtures for transport, tool behavior, provider failures and input abuse. Browser checks for desktop/mobile, keyboard flow, stale-response races and honest missing-key behavior.
5. MIT license, setup/deployment documentation, privacy notes, CI and accurate Devpost copy. Real-key integration, public deploy and contest submission only after the required credentials and declarations are available.

## Existing work

This is a separate repository. Existing Suede projects and submitted hackathon artifacts remain untouched. Do not claim a real Qloo run until verified with actual API access.
