# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Verified University of Florida students who hold or want UF football tickets. The primary situation: a student holds a ticket to a specific game in a section they're not happy with (or wants to sell it outright, or wants tickets for a different section/game) and needs another verified UF student on the other side of that exchange. Signup is gated to `@ufl.edu` addresses with email confirmation as the verification mechanism — there is no other user type.

## Product Purpose

Gator Trade lets verified UF students trade, sell, and upgrade Ben Hill Griffin Stadium football tickets with each other. The core insight: most activity isn't a pure sale, it's two students who already hold tickets to the same game swapping seats, with cash making up the difference in seat quality (someone in a bad section pays to move down, someone in a good section takes cash to move back). A pure sale and a cross-game trade are both just variations of the same underlying object — an offer, an optional want, and a signed cash delta. Success means students find a matching trade partner for a specific game faster and with more trust than an ad-hoc group chat or marketplace post would give them.

## Positioning

Gator Trade's mechanism is the same-game seat-upgrade finder: given the section a student holds, it surfaces open posts at that exact game offering a better tier, sorted by what it costs to move up. General ticket marketplaces (StubHub, Facebook groups, GroupMe) treat every listing as an independent sale; they can't answer "what does it cost me to move from my section to a better one at this specific game" in one screen, because they don't model tiered seat quality or two-sided want/offer trades. Gator Trade's tier system (seeded from the actual stadium seating chart) and signed cash-delta model make that question answerable directly. It is an independent, unofficial student project — not run, sanctioned, or endorsed by the University of Florida — so copy and design should never imply official UF backing, even though it uses UF context (Gators, Ben Hill Griffin Stadium) to describe itself.

## Operating Context

- Verification loop: signup with a `.ufl.edu` email → email confirmation → a trigger flips `is_verified` on the profile. Unverified users have a real, expected "pending verification" state, not an error state.
- Browsing is game-scoped, not a global feed: pick a game, then see posts for that game. The seat-upgrade finder is the default/headline view within a game.
- A trade's full lifecycle lives in-product: post → proposal (accept/decline/withdraw) → handoff checklist → messaging, scoped to that one accepted proposal.
- Cash never moves through the platform. Students settle Venmo/Zelle privately; the platform only records the agreed amount. Copy must never imply the platform processes payment.
- The platform never transfers the actual ticket (UF's ticketing system has no public API for that). It coordinates and records that a handoff happened — copy must not imply the platform performs the transfer.
- Posts auto-expire when the last referenced game kicks off; there's no manual "sold" toggle beyond that and the explicit status enum (open/pending/completed/withdrawn/expired).
- Reporting a post or a user is a first-class, low-friction action — this is a peer-to-peer marketplace among people who'll see each other on campus, so trust/safety affordances matter.
- Responsive web only. No native app. No real-time chat — refetch-on-navigation messaging is the deliberate, accepted behavior, not a placeholder for something more real-time later.

## Capabilities and Constraints

- **In scope:** UF-email-gated signup/verification, posts (offer items + want slots + signed cash delta), same-game seat-upgrade browse as the primary experience, section tier quality (1 best–5 worst, seeded from the real Ben Hill Griffin Stadium chart — tier assignments are supplied by the product owner, never invented), proposals (create/accept/decline/withdraw), a handoff checklist after both sides agree, messaging scoped to an accepted proposal, reporting a post or user.
- **Explicitly out of scope, do not build even as a natural-seeming extension:** payment processing/escrow of any kind, actual ticket transfer/custody, native mobile apps, real-time chat.
- **Terminology:** "post" (not listing), "offer side" / "want side" / "cash delta" (signed integer cents, positive = counterparty pays the author, negative = author pays, zero = even swap), "proposal" (an offer against a post), "handoff" (the in-person/manual exchange coordination record, not a transfer mechanism), "section tier" (1–5, 1 is best).
- **Trust signal (confirmed):** a user's completed-trade count is shown publicly as a lightweight reputation signal (profile and/or post context).
- **Authorization:** enforced at the database level via Postgres RLS, not just in the UI — RLS is a correctness requirement, not an implementation detail hidden from design (e.g., a withdrawn/pending post genuinely isn't visible to other users, not just hidden by the client).
- **Money is always integer cents**, never a float, everywhere including UI copy/formatting.
- **Undecided (do not invent an answer):** whether posts should also expire on a fixed timer (e.g., after 14 days of no activity) in addition to expiring at kickoff. Section tier assignments for Ben Hill Griffin Stadium come from the product owner, not from guessing at a stadium chart.

## Brand Commitments

Name is "Gator Trade." It is an independent, unofficial UF-student project (see Positioning) — not affiliated with or endorsed by the University of Florida. No logo, wordmark, or other visual brand asset exists yet (public/ only has the default create-next-app placeholder SVGs). No voice/tone or visual direction has been committed to yet; that is a design-world decision for later work, not recorded here.

## Evidence on Hand

None yet. No real trade history, testimonials, press, or case studies exist — this is a pre-launch build (steps 1–10 of an 11-step build order are done: scaffold, Supabase schema, auth, RLS, seed scripts, post creation, browse/upgrade finder, proposals, handoffs/messaging, and image storage). Step 11 (reports, empty states, loading states, and enough seed data to look real) is still open. Future work must not fabricate testimonials, trade counts, or user quotes — use realistic seed data (games, sections, sample posts) instead.

## Product Principles

1. Model the real trade, not a generic listing. Every surface should reflect that a post is offer + want + signed cash delta, and that most trades are upgrades/downgrades between students at the same game — not independent buy/sell listings.
2. Never imply the platform does more than it does. No payment processing, no ticket custody/transfer — copy and UI must make the private-settlement, coordinate-don't-transfer model legible, not hidden behind reassuring-sounding language.
3. Verification and RLS are trust infrastructure, not paperwork. Design should make "verified UF student" and per-user visibility feel like real, load-bearing guarantees, not a checkbox.
4. Game-scoped, not feed-scoped. Students think "who else has tickets to this game," not "what's new on the marketplace" — browse and search should stay anchored to a chosen game.
5. Independent, not official. Nothing in copy, naming, or visual treatment should suggest University of Florida endorsement or operation.

## Accessibility & Inclusion

No formal standard mandated; follow ordinary accessible-web practice (semantic HTML, keyboard operability, sufficient contrast, labeled form fields) with no product-specific requirement beyond that.
