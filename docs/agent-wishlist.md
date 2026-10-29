# If I were the agent: what I'd want from this tool

Written from the point of view of a coding agent that just edited a component and has one tool call to spend.

## 1. "Did my change look right?" in one call
After an edit, calling `render_component` again should tell me what changed, without me keeping baseline ids: changed-pixel ratio, the regions that changed, and a text diff of the accessibility tree. `render_diff` with a `captureId` exists; the automatic version (`changes` on every re-render of the same target) is the ergonomic one.

## 2. The state I care about, not the default one
A dropdown closed, a form empty, a card not hovered: that is rarely the state I'm fixing. I want `actions` before capture (`click`, `hover`, `fill`, `press`, `scroll`, `wait`) addressed by role/text/ref, plus `storage`/`cookies` for logged-in or feature-flagged states, `viewport`, `colorScheme` and `prefersReducedMotion`, all in the same call.

## 3. The box it lives in
A component alone on white lies: width, height and background come from the parent. `in_context` renders inside the call site's ancestors; `frame` is the stand-in when there is no usage yet.

## 4. Layout facts as text
Pixels cost tokens and I can't measure them. I want `[ref=e3] button "Add" 120×36 at (24,180)`, and flags I would otherwise miss: text truncated, element overflowing its parent, zero-size element, low contrast, image failed to load.

## 5. From pixel to file
`inspect ref` returning `in ProductCard (components/ProductCard.tsx:19)` and the computed styles that matter, so a wrong margin becomes a line to change.

## 6. Errors that say what to do
`Cannot resolve "./Icon" from components/Card.tsx` with the file and the line, missing `NEXT_PUBLIC_X`, a provider that threw: each with the fix it suggests, not a browser's "failed to fetch".

## 7. Every usage, only the ones that differ
After a change to a shared component, render it at every call site but group identical outcomes, and show pixels changed per usage, so the blast radius is three lines, not twelve screenshots.

## 8. Captures I can trust to diff
Fonts loaded, images loaded, animations settled (done), and also `Date.now` and `Math.random` frozen, so "changed" means my edit changed it.

## 9. Speed that lets me iterate
Warm renders under 50 ms (done) and a cold start under a second, with the server living across tool calls (done).

## 10. The tool telling me the next step
"3 usages exist, 2 with runtime props; call `render_usages`" or "required prop `price` missing; `describe_props` lists it". Hints in results, so I don't have to remember the tool surface.

Order of building: 2 (actions + storage) and 1 (automatic changes) first, then 4 and 5 (facts and source), then 8, 7, 10.
