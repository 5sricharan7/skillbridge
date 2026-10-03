/**
 * Resolve the app's extensionless relative imports under Node's ESM loader.
 *
 * The app is bundled by Vite, which resolves `./careerBridgeMock` to
 * `./careerBridgeMock.js`. Node's ESM resolver does not, so importing a module
 * of the app from a plain `node --test` run fails on the first import it meets.
 * Rather than add extensions to the app's imports — a change to every module for
 * the sake of the test runner — this hook teaches Node the one thing Vite was
 * already doing, and only for relative specifiers.
 *
 * It exists to run `npm test`, adds no dependency, and changes nothing about how
 * Vite builds the app.
 */

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CANDIDATE_SUFFIXES = ['.js', '.jsx']

export function resolve(specifier, context, nextResolve) {
  const relative = specifier.startsWith('./') || specifier.startsWith('../')

  if (relative && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    const base = new URL(specifier, context.parentURL)

    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidate = new URL(base.href + suffix)
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate.href, context)
      }
    }
  }

  return nextResolve(specifier, context)
}