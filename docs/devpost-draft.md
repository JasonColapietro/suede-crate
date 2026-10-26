# Suede Crate

Working draft. Do not submit until real Qloo integration and public demo verification are complete. Update the evidence section from actual live results; do not convert synthetic tests into live claims.

## Tagline

Follow your music taste into a crate of new artists, films, and books.

## Inspiration

Music fans often discover a new artist through a friend, a record shop, a film, or a book. Those connections disappear when recommendations stay inside one streaming catalog. We wanted to make cultural discovery feel like following a thread rather than asking a chatbot for a plausible list.

## What it does

Suede Crate starts with a handful of favorite artists. The listener selects exact matches from Qloo's catalog, then builds a crate of artist recommendations and related films and books. A discovery can become a new starting point, while a passed artist is excluded from future passes. A deeper-cut setting asks for less popular artist results. Each crate includes a readable explanation of the queries and signals used, and downloadable listening notes.

## How we built it

A dependency-free Node.js backend keeps Qloo credentials on the server. Artist search uses `/search`; discovery uses `/v2/insights` with the listener's entity IDs, exclusions, and an optional popularity ceiling. The same workflow powers the web interface and two MCP tools, so an assistant can search, build, and refine a crate with the same evidence as a browser user.

The interface uses plain JavaScript, HTML, CSS, and original typographic record sleeves. It does not stream music, fabricate song recommendations, infer artistic influence, or invent confidence percentages. External listening and reference links are clearly labeled searches.

## What makes Qloo essential

Cross-domain discovery and artist recommendations come from Qloo, not a language model's memory. Removing Qloo removes the recommendations. The app refuses to substitute canned answers when Qloo is unavailable.

## Challenges

Distinguishing a taste association from a factual influence claim; letting listeners resolve ambiguous artist names; propagating feedback into subsequent API calls; and keeping partial film/book failures separate from artist discovery failures.

## What we learned

An explanation can be useful without pretending to know more than the underlying data. Showing exact selected seeds, query stages, exclusions and the popularity filter makes the discovery process inspectable while keeping the interface small.

## What's next

Validate the workflow with music listeners, measure which discoveries they keep, and improve the selection/refinement experience. Any streaming-platform connection would require its own authorized integration; current links remain searches.

## Built with

Qloo API, Node.js, JavaScript, HTML, CSS, MCP, Vercel, Playwright.

## Evidence to add before submission

- Public source repository and externally hosted functional demo URL.
- Actual Qloo search and artist/movie/book responses verified without publishing Qloo datasets.
- Real MCP tool calls verified against the public deployment.
- Exact release commit, hosted checks and desktop/mobile review.
- Correct entrant/ownership declarations and availability for the November 5 finalist appearance if selected.

Existing projects were not modified. This is a newly created standalone project for this challenge.
