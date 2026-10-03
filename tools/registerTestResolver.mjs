/**
 * Register the extensionless-import resolver for `node --test`.
 *
 * `--import ./tools/registerTestResolver.mjs --test <file>` is what makes the
 * app's data modules loadable outside Vite. See ./nodeExtensionlessResolve.mjs
 * for why the hook exists.
 */

import { register } from 'node:module'

register('./nodeExtensionlessResolve.mjs', import.meta.url)