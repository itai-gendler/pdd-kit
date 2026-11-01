import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { defineEventHandler, readBody, setHeader } from 'h3'

const { version: pddVersion } = createRequire(import.meta.url)('../../package.json')

// `pdd-kit view` serves these paths from the CLI. `nuxt dev` has no CLI in
// front of it, so dev-only handlers stand in with a catalog Blueprint — a model
// rich enough to exercise every element kind the Product Report has to render. They are
// dev handlers, so nothing here reaches the generated viewer.
//
// `PDD_KIT_DEV_MODEL` points them at another `product-model/` instead — this
// repository's own model is the one case the catalog Blueprint cannot stand in
// for, because a rendering bug in a kind it happens not to use is invisible
// until someone opens the model that does.
const fixtureRoot = resolve(process.env.PDD_KIT_DEV_MODEL || '../../blueprints/content-feed-reader/product-model')

// The dev star remembers its state until `nuxt dev` restarts.
let devStarred = false
const devPreferences: Record<string, unknown> = {}

const devHandlers = [
  {
    route: '/_pdd-kit/report.json',
    handler: defineEventHandler((event) => {
      setHeader(event, 'cache-control', 'no-store')
      return JSON.parse(readFileSync(resolve(fixtureRoot, 'build/report.json'), 'utf8'))
    })
  },
  {
    route: '/_pdd-kit/logo.svg',
    handler: defineEventHandler((event) => {
      setHeader(event, 'content-type', 'image/svg+xml')
      setHeader(event, 'cache-control', 'no-store')
      /* Schema 5: the Product expands to `product/` once it owns a logo. */
      return readFileSync(resolve(fixtureRoot, 'product/logo.svg'), 'utf8')
    })
  },
  {
    // The viewer opens a stream immediately; without this the dev console fills
    // with reconnect noise that hides real errors.
    route: '/_pdd-kit/events',
    handler: defineEventHandler((event) => {
      setHeader(event, 'content-type', 'text/event-stream')
      setHeader(event, 'cache-control', 'no-store')
      return ': pdd-kit dev viewer\n\n'
    })
  },
  {
    // Keeps preferences for this dev server only; the CLI keeps them in a file.
    route: '/_pdd-kit/preferences',
    handler: defineEventHandler(async (event) => {
      setHeader(event, 'cache-control', 'no-store')
      if (event.method === 'PUT') Object.assign(devPreferences, await readBody(event))
      return devPreferences
    })
  },
  {
    // Shows the star button without touching GitHub; the CLI asks `gh`.
    route: '/_pdd-kit/github-star',
    handler: defineEventHandler((event) => {
      setHeader(event, 'cache-control', 'no-store')
      if (event.method === 'POST') devStarred = true
      if (event.method === 'DELETE') devStarred = false
      return { state: devStarred ? 'starred' : 'not-starred' }
    })
  }
]

export default defineNuxtConfig({
  extends: [
    // The report layer supplies the stable Product Report and approved identity;
    // the shared theme lab adds the background audition controls to this host
    // only. Keep the composition here so report-viewer stays neutral for
    // consumers, such as the site, that want only the approved theme.
    // `report-viewer-lab` extends `report-viewer` and remains the private hook
    // for future Product Report auditions.
    resolve('../../layers/nuxt/report-viewer-lab'),
    resolve('../../layers/nuxt/theme-lab')
  ],
  ssr: false,
  hooks: {
    'components:extend'(components) {
      // The private host uses explicit Prose mappings; unrelated global readers need not ship.
      for (const component of components) {
        if (component.pascalName.startsWith('Prose')) component.global = false
      }
    }
  },
  // Keep the downloadable CLI within its archive budget as graph engines grow.
  vite: { build: { minify: 'terser', terserOptions: { compress: { passes: 2 } } } },
  devtools: { enabled: false },
  // The theme self-hosts these families through its @fontsource stylesheets.
  // @nuxt/fonts would resolve them again — from this app's node_modules or a
  // CDN, at build time — and ship a second copy of every face.
  fonts: {
    families: ['Archivo Variable', 'Inter Variable', 'IBM Plex Mono']
      .map(name => ({ name, provider: 'none' }))
  },
  colorMode: {
    preference: 'light',
    fallback: 'light'
  },
  icon: {
    clientBundle: {
      icons: [
        'lucide:circle-alert',
        'lucide:info',
        'lucide:loader-circle',
        'lucide:rotate-cw',
        'lucide:refresh-cw',
        'lucide:sliders-horizontal',
        'lucide:triangle-alert',
        'simple-icons:github'
      ]
    }
  },
  compatibilityDate: '2024-11-01',
  css: ['~/assets/local-viewer.css'],
  alias: {
    /* The narrower subpath first, so the broader one does not claim it as a prefix. */
    'pdd-toolkit/report/selectors': resolve('../../src/report-selectors.ts'),
    'pdd-toolkit/report/compare': resolve('../../src/report-compare.ts'),
    'pdd-toolkit/report': resolve('../../src/report.ts')
  },
  nitro: { devHandlers },
  runtimeConfig: {
    public: {
      pddVersion
    }
  }
})
