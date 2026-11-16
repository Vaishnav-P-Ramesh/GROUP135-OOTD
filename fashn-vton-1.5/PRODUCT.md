# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: static HTML/CSS + existing Python stdlib server (`web/server.py`), so the try-on UI stays zero-framework and talks to the local FASHN VTON pipeline already in this repo.

## Users

*(inferred from brief)* People who want to see how a garment looks on them before buying or posting — shoppers, creators, and anyone building an outfit of the day.

## Product Purpose

OOTD is a virtual try-on product. Upload a person photo and a garment photo; the local model generates a photorealistic image of that person wearing the garment.

## Positioning

*(inferred)* Local, maskless virtual try-on powered by FASHN VTON 1.5 — no cloud API key required for the demo path in this repo.

## Capabilities

- Landing page introducing OOTD
- Studio UI: upload person + garment, choose category / photo type / quality, run try-on
- Local inference via `/api/tryon` against weights in `./weights`

## Constraints

- Runs on consumer GPU (RTX 3050 4GB class); Turbo/Balanced/Quality presets trade speed for fidelity
- Person/garment images only; categories: tops, bottoms, one-pieces
- Brand name: **OOTD**

## Brand Commitments

- Visual world pinned by user to match [Restless.ai](https://www.restless.ai/): neon yellow `#fff67c` ground, ink `#141414`, white paper sections, mono chrome, inverted headline blocks, checkerboard dividers, centered wordmark + square menu.

## Open Decisions

- Production hosting / auth / persistence: undecided
- Public marketing claims / pricing: none (do not invent)
