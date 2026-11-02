# Foid v0.0.1 beta

Foid is a steerable Rive companion for websites and browser-based desktop shells. This first public beta includes a self-contained ESM website package, interactive example with common state combinations, a local CLI host, a GIF recorded from the real Rive runtime, and editable Rive source with its referenced artwork.

## Included

- Synchronous `mount(host)` with asynchronous `ready`, independent instances, transparent rendering and disposal.
- Gaze, head tilt, blush, expressions, blinking, movement, gesture and task presentation, simulated talking, and reduced-motion handling.
- Happy and teasing eye animations reopen automatically; either expression can be selected again to replay it.
- A local-only CLI viewer and commands for status, movement, expression, gaze, speech shapes, task cues and browser-container travel.
- A sample page with one-click listening, thinking, working, talking, waiting, celebrating, playful, walking, resting, error and ready combinations.
- The editable Rive project under `source/rive/` and the Foid-only website-module sources and pinned dependencies under `source/runtime/`.

## Beta limitations

The artwork and animations are a rough draft. Turning switches between staged views, foot contact can slide, some poses and overlaps need refinement, and simulated talking is not lip-sync or speech synthesis. The CLI drives the presentation and does not execute jobs or authorize actions. A browser webview cannot create a native desktop window or click-through behavior by itself.

## Verification

The source Rive project compiled with the official Rive CLI to SHA-256 `81d14631427974a4259bea5b0eb1e082e4833370e970abd69ac94d981907f05a`, matching the bundled `.riv`. A clean pinned dependency install and website rebuild succeeded. Chromium exercised the website presets, CLI commands and disconnect/reconnect, and actual Rive eye-animation and state-transition checks. The prototype runtime's 225 offline tests passed. Visual review and browser test coverage do not guarantee every combination or platform.
