# Premium Office Precatório — Next.js + Mantine + Tailwind

This is a recreation of the "Premium Office Precatório" landing page (hero, AI chat
widget flow, quick calculator, testimonials, FAQ, footer) as a real **Next.js 16
(App Router)** project on **React 19**, styled with **Tailwind CSS** for layout/utility
classes and **Mantine UI v7** for interactive components (Tabs, Accordion, inputs, buttons).

## Requirements

- Node.js 20.9+ (Next.js 16 requirement)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Project structure

```
app/
  layout.tsx        Mantine provider + font + global styles
  globals.css        Tailwind directives + small global resets
  page.tsx           Assembles the page from the components below
components/
  Hero.tsx           Top hero section with headline + CTA + example card
  ChatSection.tsx     Testimonials carousel + full AI chat flow + quick calculator
  ComoFunciona.tsx    "Como funciona" persuasive copy block
  Vantagens.tsx       "Segurança em cada etapa" cards
  Faq.tsx             FAQ accordion (Mantine Accordion)
  Footer.tsx
lib/
  data.ts             Mock data, IR/RRA + net-available math, discount table, FAQ + reviews
  beams.js            WebGL beam-field background (three) mounted by Hero
public/
  logo-white.png      Brand logo (white version, for dark backgrounds)
```

## Tailwind + Mantine together

Mantine ships its own CSS reset, so Tailwind's `preflight` is disabled in
`tailwind.config.ts` to avoid the two resets fighting each other. Mantine's
stylesheet (`@mantine/core/styles.css`) is imported in `app/layout.tsx` **before**
`globals.css`, so Tailwind's utility classes still win when both target the same
element. `postcss-preset-mantine` + `postcss-simple-vars` are wired in
`postcss.config.mjs` per Mantine's official Next.js guide.

## Behavior notes vs. the original HTML prototype

The whole prototype is ported 1:1 — layout, flow, animations and math:

- **Hero background beams**: the animated WebGL beam field (`lib/beams.js`,
  built on `three`) is mounted onto a `<canvas>` in `Hero.tsx` via a client-side
  dynamic import, exactly as the prototype (`lightColor #0D1F38`,
  `backgroundColor #0B1B33`, `diffuseColor #050B16`).
- **Flying message bubble**: each user choice literally "flies" from the clicked
  button into the chat log before landing as a bubble — the same
  pixel-measured transition (`flyBubble`) as the prototype.
- **AI text "typewriter" reveal**: each AI message reveals character-by-character
  via `requestAnimationFrame` (~14 chars/ms), with the blur/translate settle.
- **"Digitando…" indicator**: AI typing dots (`blink` keyframe) show while the
  analysis / calculation timers run.
- **Chat flow**: qualify → upload → extract card → confirm → calc card →
  decision (accept / consultant / revision / other) → documents → schedule →
  done, plus the correct WhatsApp hand-offs. Uses `MOCK_DOC` +
  `calcularAntecipacao`.
- **"Análise Rápida" tab**: upload/example → spinner → auto result with extracted
  data, plain-language summary, credit-composition bar, and the indicative
  proposal card with an animated fill bar. Runs the full IR/RRA + net-available
  math (`analisarOficio(DEMO_OFICIO)` in `lib/data.ts`).
- **Testimonials carousel**: autoplays every 5s and resets its timer on manual
  navigation.
- **File upload**: the file input reads the filename only; no file is actually
  uploaded/parsed. Hook up real document parsing/OCR here.
- **WhatsApp links**: hardcoded to the prototype's number — update `waNumber`
  in `ChatSection.tsx` and `Footer.tsx`.

## Mantine

Mantine v7 (`MantineProvider` in `app/layout.tsx`) powers the FAQ accordion
(`components/Faq.tsx`). The rest of the UI is hand-built with Tailwind + inline
styles to match the prototype pixel-for-pixel.

## Design tokens

Custom Tailwind colors (see `tailwind.config.ts`) mirror the source palette:

- `navy` `#0B1B33` — primary dark background
- `navy-panel` `#101E38`, `navy-card` `#16233F`, `navy-accent` `#0D1F38`,
  `navy-border` `#223255` — dark-surface variants
- `ink` `#1C2331` — default body text
- `mist` `#E9EBEF`, `cloud` `#EEF0F3` — light section backgrounds
- `sky` `#8FB4EA` — accent blue used on dark backgrounds

Font: Montserrat (400/500/600/700/800), loaded via `next/font/google`.

## Next steps

- Replace the mock document extraction / calculation with real backend calls.
- Add analytics + form validation before going to production.
- Consider `next/image` instead of `<img>` for the logo once final hosting is set.
# precatorio-lp-com-chatbot
