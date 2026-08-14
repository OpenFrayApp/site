// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

// Draws the featured image for a release post: the version number over an abstract
// field in the brand's colours. Release covers are the one kind of cover worth
// generating — the only thing that changes between them is a version string, and
// hand-making one per release in a design tool is the step that quietly stops happening.
//
//   node scripts/make-release-cover.mjs 0.3.0
//   node scripts/make-release-cover.mjs 0.3.0 --tagline "The player view"
//   node scripts/make-release-cover.mjs 0.3.0 --post openfray-0-3-0
//   node scripts/make-release-cover.mjs 0.3.0 --out some/other/path.webp
//
// The background is seeded from the version string, so a given version always draws the
// same image and two releases never draw the same one. Re-running for 0.3.0 next year
// reproduces this year's file byte for byte.
//
// Everything else a post might feature is a picture of something real, and belongs in
// src/assets/news/ as artwork. This is not a general cover generator, and shouldn't grow
// into one.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

// sharp arrives with Astro's image service, so this needs nothing extra installed.
const sharp = createRequire(import.meta.url)('sharp')

const COVERS = 'src/assets/news'
const WIDTH = 1200
const HEIGHT = 630
const MARGIN = 84

// Inter is what the print edition installs to match the site's own type (see AGENTS.md);
// the browser resolves the site's stack to SF Pro on a Mac, and the rasteriser here does
// not, so naming Inter is what keeps a cover looking like the site rather than like
// Helvetica. --font overrides it if it isn't installed.
const DEFAULT_FONT = "Inter, 'Helvetica Neue', Arial, sans-serif"

// The site's dark theme (src/styles/global.css). A cover doesn't follow the
// light/dark toggle: a link preview is rendered by whoever received it.
const BG = '#020617'
const ACCENT = '#818cf8'
const TEXT = '#e2e8f0'
const MUTED = '#94a3b8'

// Indigo through violet, the range the site already uses. Nothing outside it, so a
// cover can't come out looking like it belongs to a different product.
const PALETTE = ['#6366f1', '#818cf8', '#4f46e5', '#a78bfa', '#7c3aed']

/** The five characters that would otherwise close a tag or an entity. */
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

/** FNV-1a over the version string: the seed that makes each release's field its own. */
function seedOf(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 — a small deterministic PRNG, so a version always draws the same field.
 *  Math.random would make the output different on every run and useless to review. */
function randomFrom(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Soft colour fields, weighted to the right so the version keeps a dark ground to sit
 * on. Wide, overlapping and off-canvas on purpose: what should read is a wash with no
 * visible edge to it, not a set of discs.
 *
 * Radial gradients rather than a blur filter — librsvg's filter support is the part of
 * SVG that varies between rasterisers, and gradients look the same everywhere.
 */
function wash(rand) {
  const defs = []
  const shapes = []

  // One field per zone, jittered rather than placed at random. Nine overlapping soft
  // fields scattered freely was the first attempt, and they averaged out: enough of
  // them at low opacity is indistinguishable from a flat fill. Few, strong, and kept
  // apart is what leaves dark between the light, which is the whole of the effect.
  const ZONES = [
    [0.78, 0.16],
    [0.42, 0.92],
    [1.08, 0.62],
    [0.16, 0.3],
    [0.92, 1.05],
  ]

  for (const [zx, zy] of ZONES) {
    const id = `w${defs.length}`
    const cx = (zx + (rand() - 0.5) * 0.22) * WIDTH
    const cy = (zy + (rand() - 0.5) * 0.22) * HEIGHT
    const r = 280 + rand() * 300
    const color = PALETTE[Math.floor(rand() * PALETTE.length)]
    const opacity = (0.3 + rand() * 0.2).toFixed(3)
    // Most of the falloff happens in the outer half, so each field keeps a readable
    // core instead of dissolving into its neighbours.
    defs.push(
      `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">` +
        `<stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/>` +
        `<stop offset="0.42" stop-color="${color}" stop-opacity="${(Number(opacity) * 0.55).toFixed(3)}"/>` +
        `<stop offset="1" stop-color="${color}" stop-opacity="0"/>` +
        `</radialGradient>`,
    )
    shapes.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="url(#${id})"/>`,
    )
  }
  return { defs: defs.join(''), shapes: shapes.join('') }
}

/** A vignette that darkens the corners, so the wash reads as light falling on the page
 *  rather than as shapes laid over it. */
function vignette() {
  return (
    `<radialGradient id="vig" cx="50%" cy="46%" r="76%">` +
    `<stop offset="0.45" stop-color="${BG}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${BG}" stop-opacity="0.75"/>` +
    `</radialGradient>`
  )
}

/** Point size for the version, stepped down so a long one still fits the canvas. */
function versionSize(version) {
  if (version.length <= 6) return 208
  if (version.length <= 9) return 168
  if (version.length <= 13) return 132
  return 104
}

/** The whole cover as an SVG document. */
function cover({ version, tagline, font }) {
  const rand = randomFrom(seedOf(version))
  const field = wash(rand)
  const size = versionSize(version)

  // The version sits on the optical centre line; the eyebrow above and the tagline
  // below hang off it, so the block stays balanced whether or not a tagline is given.
  const baseline = tagline ? 372 : 400

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    ${field.defs}
    ${vignette()}
    <linearGradient id="veil" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${BG}" stop-opacity="0.72"/>
      <stop offset="0.5" stop-color="${BG}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>
  ${field.shapes}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vig)"/>
  ${/* Keeps the text column dark enough to read, whatever the seed put behind it. */ ''}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#veil)"/>

  <g font-family="${font}">
    <text x="${MARGIN}" y="${baseline - size * 0.86}" font-size="22" font-weight="600" letter-spacing="6" fill="${ACCENT}">RELEASE</text>

    <text x="${MARGIN}" y="${baseline}" font-size="${size}" font-weight="700" letter-spacing="-4" fill="${TEXT}">${esc(version)}</text>

    ${
      tagline
        ? `<text x="${MARGIN}" y="${baseline + 66}" font-size="30" fill="${MUTED}">${esc(tagline)}</text>`
        : ''
    }
  </g>
</svg>`
}

const USAGE = [
  'Usage: node scripts/make-release-cover.mjs <version> [options]',
  '',
  '  --tagline "…"   a line under the version',
  '  --post <slug>   write to that post’s cover path instead of release-<version>.png',
  '  --out <path>    write somewhere else entirely',
  '  --font <stack>  override the font family (default Inter)',
  '  --force         redraw over an existing file',
  '',
  '  e.g. node scripts/make-release-cover.mjs 0.3.0 --post openfray-0-3-0',
].join('\n')

// Flags that consume the next argument. Anything else starting with -- is a switch, so
// `--force 0.3.0` still finds the version instead of eating it as a flag's value.
const VALUED = new Set(['tagline', 'post', 'out', 'font'])

/** Split argv into positionals and options, without pulling in a parser. */
function parse(argv) {
  const positional = []
  const options = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      positional.push(arg)
      continue
    }
    const name = arg.slice(2)
    if (VALUED.has(name)) {
      const value = argv[++i]
      if (value === undefined) {
        console.error(`--${name} needs a value.\n\n${USAGE}`)
        process.exit(1)
      }
      options[name] = value
    } else {
      options[name] = true
    }
  }
  return { positional, options }
}

const { positional, options } = parse(process.argv.slice(2))
const [version, ...extra] = positional

if (!version) {
  console.error(`Missing the version.\n\n${USAGE}`)
  process.exit(1)
}
if (extra.length) {
  console.error(`Unexpected argument "${extra[0]}". Quote a tagline: --tagline "…"\n\n${USAGE}`)
  process.exit(1)
}

const named = options.post ? `${options.post}.webp` : `release-${version}.webp`
const out = options.out ?? join(COVERS, named)

if (existsSync(out) && !options.force) {
  console.error(`${out} already exists. Pass --force to redraw it.`)
  process.exit(1)
}

mkdirSync(dirname(out), { recursive: true })

// density 144 renders at 2x, so Astro has a 2400x1260 source to resize down and the
// cover stays sharp on a high-density screen.
const svg = cover({
  version,
  tagline: options.tagline,
  font: options.font ?? DEFAULT_FONT,
})
// WebP, not PNG. A cover is a full-canvas gradient with a few large glyphs on it —
// exactly what lossless compression is worst at, and what a lossy codec is best at. The
// same image is 984KB as a PNG and 33KB here, and at q92 the difference is not visible
// at any size the site serves. Committing a megabyte per release was the alternative.
//
// Being lossy costs nothing that matters: this file is generated, the script is the
// source, and Astro re-encodes it to avif/webp for the page and to png for the social
// card regardless.
//
// No grain layer either. One was tried, to guard the near-flat areas against banding,
// and measurement retired it: the rasteriser already dithers the gradients (a 900px
// slice of the wash ramps 21 levels with no single-level step in it), and the noise
// came out at 0.09 levels of neighbour difference, which is invisible.
const image = await sharp(Buffer.from(svg, 'utf8'), { density: 144 })
  .webp({ quality: 92 })
  .toBuffer()
writeFileSync(out, image)

const { width, height } = await sharp(image).metadata()
console.log(`Drew ${out}  ${width}x${height}  ${Math.round(image.length / 1024)}KB`)

// Only offer the frontmatter lines when the file landed where a post can reach it by
// the relative path they use; --out somewhere else is the caller's business.
if (!options.out) {
  console.log('\nAdd to the post’s frontmatter:')
  console.log(`cover: '../../assets/news/${named}'`)
  console.log(`coverAlt: 'OpenFray ${version} over an abstract indigo field.'`)
}
