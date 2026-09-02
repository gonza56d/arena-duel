# contradiction

A memory that clashes with newer reality — flagged to be resolved.

## `IncrementRecord` "deliberately not exposed over HTTP" was overridden: v1 now has a client-facing `POST /profile/record`

What: an earlier decision (decisions.md) said the record counters change only via `IncrementRecord` and that method is "deliberately not exposed over HTTP" because "an authenticated client endpoint would let players record their own wins" — the intended caller being a future trusted server-side path. The "Zombie NPC, match loop & fog of war" work order required match-end to persist the client-computed outcome (acceptance 4), and v1 has no trusted game backend, so a protected `POST /profile/record` route was added and the client calls it · Why flagged: the new route does exactly what the old decision set out to avoid (a client self-reporting its own win). It was accepted for v1 because the work order's intent is explicit that outcome is client-side in v1, and there is no server-authoritative alternative yet · Resolution: when the server-authoritative game backend exists (README: "backend rules must prevail"), it should become the caller of `IncrementRecord` and this client route should be removed or locked to trusted callers. Until then, v1 knowingly trusts the client. See the superseding decision in decisions.md.
