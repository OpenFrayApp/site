// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const SCRIPT = resolve('scripts/make-release-cover.mjs')
const dir = mkdtempSync(join(tmpdir(), 'openfray-cover-'))

afterAll(() => rmSync(dir, { recursive: true, force: true }))

/** Run the generator, returning its stdout. Throws with stderr attached on a non-zero exit. */
function draw(args: string[]) {
  return execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8', stdio: 'pipe' })
}

/** Draw to a named file in the temp dir and hand back the bytes. */
function drawTo(name: string, args: string[]) {
  const out = join(dir, name)
  draw([...args, '--out', out, '--force'])
  return readFileSync(out)
}

/** Pixel dimensions of whatever the generator wrote. */
async function size(image: Buffer) {
  const { default: sharp } = await import('sharp')
  const { width, height } = await sharp(image).metadata()
  return `${width}x${height}`
}

describe('the release cover generator', () => {
  it('draws a 2x social card', async () => {
    // 2400x1260 is 1200x630 at 2x, so Astro has something to resize down from.
    expect(await size(drawTo('a.webp', ['0.3.0']))).toBe('2400x1260')
  })

  it('writes WebP, because a PNG of this costs a megabyte a release', async () => {
    // The cover is a full-canvas gradient with a few big glyphs — the worst case for
    // lossless compression. The same image is 984KB as a PNG. It is generated from the
    // script, so being lossy costs nothing that isn't recoverable.
    const image = drawTo('fmt.webp', ['0.3.0'])
    const { default: sharp } = await import('sharp')
    expect((await sharp(image).metadata()).format).toBe('webp')
    expect(image.length).toBeLessThan(150 * 1024)
  })

  it('draws the same version identically, however long between runs', () => {
    // The field is seeded from the version, not from a clock or Math.random. A cover
    // regenerated next year has to reproduce the committed one byte for byte, or every
    // rebuild would show up as a diff.
    expect(drawTo('b.webp', ['0.3.0']).equals(drawTo('c.webp', ['0.3.0']))).toBe(true)
  })

  it('draws a different field for a different version', () => {
    expect(drawTo('d.webp', ['0.4.0']).equals(drawTo('e.webp', ['0.3.0']))).toBe(false)
  })

  it('takes a tagline, and it changes the picture', () => {
    const plain = drawTo('f.webp', ['0.3.0'])
    const tagged = drawTo('g.webp', ['0.3.0', '--tagline', 'The shared player view'])
    expect(tagged.equals(plain)).toBe(false)
  })

  it('finds the version after a switch rather than eating it', async () => {
    // `--force 0.3.0` must not read 0.3.0 as the value of --force.
    expect(await size(drawTo('h.webp', ['--force', '0.3.0']))).toBe('2400x1260')
  })

  it('refuses to overwrite a cover unless told to', () => {
    const out = join(dir, 'keep.webp')
    draw(['0.9.0', '--out', out])
    expect(() => draw(['0.9.0', '--out', out])).toThrow(/already exists/)
    expect(() => draw(['0.9.0', '--out', out, '--force'])).not.toThrow()
  })

  it('explains itself instead of drawing nothing', () => {
    expect(() => draw([])).toThrow(/Missing the version/)
    expect(() => draw(['0.3.0', '--tagline'])).toThrow(/--tagline needs a value/)
    // An unquoted tagline arrives as stray positionals; say so rather than ignoring it.
    expect(() => draw(['0.3.0', 'player', 'view'])).toThrow(/Unexpected argument/)
  })

  it('prints the frontmatter lines to paste, when it wrote where a post can reach it', () => {
    const stdout = draw(['0.8.0', '--post', 'openfray-0-8-0', '--force'])
    expect(stdout).toContain("cover: '../../assets/news/openfray-0-8-0.webp'")
    expect(stdout).toContain('coverAlt:')
    rmSync(join('src/assets/news', 'openfray-0-8-0.webp'), { force: true })
  })

  it('carries no logo and no site address', () => {
    // Both were on the first draft and were cut. The cover is the version and nothing
    // else, so a reader's eye has one place to land.
    const source = readFileSync(SCRIPT, 'utf8')
    expect(source).not.toContain('openfray.app')
    // The crossed-swords mark, by the first segment of its path data.
    expect(source).not.toContain('m14.5 17.5-11.5-11.5')
  })

  it('draws a background with light and shade in it, not a flat fill', async () => {
    // The first two attempts averaged out to one flat area — many soft fields at low
    // opacity are indistinguishable from a plain rectangle. This measures the right
    // half, away from the numerals, so it is the wash being judged and not the text.
    const { default: sharp } = await import('sharp')
    for (const version of ['0.3.0', '0.4.0', '1.0.0']) {
      const image = drawTo('varies.webp', [version])
      const raw = await sharp(image)
        .extract({ left: 1320, top: 0, width: 1080, height: 1260 })
        .resize(60, 70)
        .greyscale()
        .raw()
        .toBuffer()
      const values = [...raw]
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length
      const deviation = Math.sqrt(
        values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length,
      )
      expect(deviation, `"${version}" draws a flat background`).toBeGreaterThan(5)
    }
  })

  it('keeps the version legible against whatever the seed put behind it', async () => {
    // #e2e8f0 numerals at 200px are large text, which wants 3:1. The check is against
    // the brightest pixel anywhere under the text block, not an average.
    const { default: sharp } = await import('sharp')
    const relative = (v: number) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    for (const version of ['0.3.0', '0.4.0', '0.12.0', '1.0.0']) {
      const image = drawTo('legible.webp', [version])
      // Sample the band the numerals sit in, but only the gap to their right, which is
      // the same wash they sit on and has no glyphs in it.
      const raw = await sharp(image)
        .extract({ left: 2260, top: 500, width: 120, height: 300 })
        .greyscale()
        .raw()
        .toBuffer()
      const brightest = Math.max(...raw)
      const ratio = (relative(226) + 0.05) / (relative(brightest) + 0.05)
      expect(ratio, `"${version}" puts the version on too bright a ground`).toBeGreaterThan(3)
    }
  })

  it('keeps the version inside the canvas, whatever shape it is', async () => {
    // Long tags step the type down. The check is the right-hand 80px of the version
    // band: anything bright there is a string that ran off the edge.
    const { default: sharp } = await import('sharp')
    for (const version of ['0.3.0', '10.24.6', '1.0.0-beta.2', '2026.07.31-nightly']) {
      const image = drawTo('fit.webp', [version])
      const strip = await sharp(image)
        .extract({ left: 2400 - 80, top: 380, width: 80, height: 520 })
        .greyscale()
        .raw()
        .toBuffer()
      const bright = strip.filter((v) => v > 150).length
      expect(bright, `"${version}" overflows the canvas`).toBe(0)
    }
  })
})
