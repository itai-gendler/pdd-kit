import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collapseShortcutReferences } from './config/markdownReferences'
import { pddKitSyntaxHighlightTheme } from './config/syntaxHighlightTheme'
import { readFaqContent } from './shared/faq-content'
import { NOT_FOUND_TITLE } from './shared/utils/site'

const isDevelopment = process.env.NODE_ENV === 'development'
const isolatedBuildDir = process.env.PDD_KIT_NUXT_BUILD_DIR

// The site lives in the pdd-kit repository. Its docs, FAQ, changelog and
// Blueprints are read from the checkout it is built in, and its report viewer
// and theme Layers are that checkout's source, so a change and the page that
// shows it ship in one pull request.
const repoRoot = fileURLToPath(new URL('..', import.meta.url))

// Nuxt Content ingests only `**/*.md`, so images committed alongside the docs
// are invisible to it. Serve that directory as a public asset rather than
// copying the files in here, so a diagram keeps one source of truth.
// A page at /docs/<slug> resolves `./images/x.webp` to /docs/images/x.webp, so
// the same relative path also renders on GitHub and inside the npm package.
const docsImagesDir = resolve(repoRoot, 'docs', 'images')
const docsImageAssets = existsSync(docsImagesDir)
  ? [{ dir: docsImagesDir, baseURL: '/docs/images', maxAge: 60 * 60 * 24 * 365 }]
  : []

// `pnpm blueprints` builds every Blueprint into .data/blueprints before a dev
// server or a build starts: the same files the Blueprint release publishes.
// Their logos and covers are served from /_blueprints.
const blueprintsDir = fileURLToPath(new URL('./.data/blueprints', import.meta.url))

// The header badge names the pdd-kit release this site ships beside, read from
// the package in this repository so it cannot drift.
const { version: pddVersion } = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as { version: string }

const lightSyntaxTheme = pddKitSyntaxHighlightTheme()

export default defineNuxtConfig({
  ...(isolatedBuildDir ? { buildDir: isolatedBuildDir } : {}),
  app: {
    // Error pages do not render app.vue, so document language belongs here.
    head: { htmlAttrs: { lang: 'en' } }
  },
  extends: [
    'pdd-toolkit/nuxt/report-viewer'
  ],
  // The report viewer imports the report contract by its package name. Point it
  // at this repository's source, as the local viewer does, so the site needs no
  // built package to compile.
  alias: {
    'pdd-toolkit/report/selectors': resolve(repoRoot, 'src/report-selectors.ts'),
    'pdd-toolkit/report/compare': resolve(repoRoot, 'src/report-compare.ts'),
    'pdd-toolkit/report': resolve(repoRoot, 'src/report.ts')
  },
  modules: [
    '@nuxt/eslint',
    '@vueuse/nuxt',
    // The report viewer Layer extends the pdd-kit theme and registers
    // @nuxt/ui before this project module.
    '@nuxt/content',
    // Nuxt strips `onServerPrefetch` from the client bundle by default. Vue
    // treats a component with that hook as an async boundary when numbering
    // `useId`, so every server-rendered icon ahead of a page shifts the ids the
    // page generates on the server but not on the client, and Reka's
    // `aria-controls`, tab, and tooltip ids in the embedded Product Report stop
    // matching after hydration. Keeping the registration on the client makes
    // both sides count the same boundaries; the hook body is still tree-shaken
    // behind `import.meta.server`.
    (_options, nuxt) => {
      const client = nuxt.options.optimization.treeShake.composables.client
      client.vue = (client.vue ?? []).filter(name => name !== 'onServerPrefetch')
    }
  ],
  devtools: { enabled: isDevelopment },
  // Every icon ships in the client bundle, so no page asks api.iconify.design
  // for one at runtime. A static site has no `/api/_nuxt_icon` endpoint, and
  // the prerenderer cannot reach it either, so an icon left out would render
  // empty on the server and then be fetched from Iconify in the browser.
  // `scan` collects the names written in each Layer's `app/` and the blog;
  // the report viewer Layer lists its own. `provider: 'none'` keeps a missed
  // icon blank instead of calling out.
  icon: {
    provider: 'none',
    clientBundle: {
      scan: {
        globInclude: ['app/**/*.{vue,ts}', 'content/**/*.md']
      }
    }
  },
  css: [
    '~/assets/css/main.css'
  ],
  colorMode: {
    preference: 'light',
    fallback: 'light'
  },
  hooks: {
    'content:file:afterParse'({ content, collection }) {
      if (collection.name === 'faq') {
        readFaqContent(content.body, content.title)
        // The Git source includes docs/ in its stem; both sources serve /faq.
        content.path = '/faq'
      }
    },
    // Nuxt Content resolves a relative link against the page's route. The docs
    // index renders at /docs rather than /docs/index, so its `./variations.md`
    // would land on /variations. The pdd docs are authored for GitHub with
    // relative links, so point the index's links inside /docs here instead.
    //
    // MDC reads a shortcut reference such as the changelog's `## [0.23.0]` as
    // an inline span, dropping both the brackets and the link GitHub resolves
    // from `[0.23.0]: <url>`. Spelling each defined label as the equivalent
    // collapsed reference, `[0.23.0][]`, renders what GitHub renders without
    // changing what pdd authors.
    'content:file:beforeParse'({ file, collection }) {
      if (typeof file.body !== 'string') return
      if (collection.name === 'changelog') {
        file.body = collapseShortcutReferences(file.body)
        return
      }
      if (collection.name !== 'docs') return
      // A link to the docs index, `./index.md#…`, would resolve to `/docs/`, a
      // second URL for the same page. Point it at `/docs`, the one URL that
      // exists on a static host.
      file.body = file.body.replace(/\]\(\.\/index\.md(?=[#)])/g, '](/docs')
      if (!/(?:^|[/:])index\.md$/.test(file.id)) return
      file.body = file.body.replace(/\]\(\.\/(?!docs\/)/g, '](./docs/')
    }
  },
  content: {
    // Nuxt Content rebuilds its local tables in place. Keep the live dev
    // database separate so concurrent builds cannot temporarily drop its tables.
    _localDatabase: {
      type: 'sqlite',
      filename: isDevelopment
        ? '.data/content/contents.dev.sqlite'
        : '.data/content/contents.build.sqlite'
    },
    experimental: {
      // Node's built-in sqlite avoids the better-sqlite3 native build, which
      // pnpm blocks and alpine images can't compile without a toolchain.
      sqliteConnector: 'native'
    }
  },
  mdc: {
    highlight: {
      /**
       * Brand Warm is the site's light syntax palette. Every token clears 7:1
       * on the warm code surface while staying inside the pdd-kit color
       * family. Dark mode was already clear, so it keeps Palenight.
       *
       * `default` is the no-color-mode-class fallback. This site's fallback is
       * light, so it must be the readable light palette too; otherwise code can
       * briefly render with dark-theme token colors before hydration.
      */
      theme: {
        light: lightSyntaxTheme,
        default: lightSyntaxTheme,
        dark: 'material-theme-palenight'
      }
    }
  },
  runtimeConfig: {
    public: {
      pddVersion
    }
  },
  // Every page is generated. The crawler follows links from `/`, which reaches
  // every doc, post and Blueprint; the feeds and sitemap are named because no
  // page links them as HTML.
  nitro: {
    hooks: {
      // `404.html` is a client-only shell, rendered before any page runs, so no
      // head tag from `app/error.vue` reaches it. A static host serves it for
      // every unknown URL, and without this it has no title at all.
      'prerender:generate'(route) {
        if (route.route !== '/404.html' || !route.contents) return
        route.contents = route.contents.replace(
          '</head>',
          `<title>${NOT_FOUND_TITLE}</title><meta name="robots" content="noindex"></head>`
        )
      }
    },
    serverAssets: [{ baseName: 'blueprints', dir: blueprintsDir }],
    publicAssets: [
      ...docsImageAssets,
      { dir: blueprintsDir, baseURL: '/_blueprints', maxAge: 60 * 60 * 24 }
    ],
    prerender: {
      crawlLinks: true,
      // `/faq` is written as `faq.html`, not `faq/index.html`. Static hosts
      // serve that file at the slashless URL every link and the sitemap use,
      // where a directory index would be redirected to `/faq/`.
      autoSubfolderIndex: false,
      failOnError: true,
      // The home page's Blueprint picker opens after hydration, so it reads the
      // list from this file rather than from the page payload.
      routes: ['/', '/blueprints', '/sitemap.xml', '/blog/rss.xml', '/blueprints/rss.xml', '/_data/blueprints.json']
    }
  },
  compatibilityDate: '2024-11-01',
  vite: {
    build: {
      chunkSizeWarningLimit: 1400,
      rollupOptions: {
        onwarn(warning, warn) {
          const isModulePreloadSourcemapWarning = warning.plugin === 'nuxt:module-preload-polyfill'
            && warning.message.includes('Sourcemap is likely to be incorrect')
          const isVueUsePureAnnotationWarning = warning.id?.includes('/@vueuse/core/dist/index.js')
            && warning.message.includes('contains an annotation that Rollup cannot interpret')

          if (isModulePreloadSourcemapWarning || isVueUsePureAnnotationWarning) return
          warn(warning)
        }
      }
    },
    optimizeDeps: {
      include: [
        'motion-v',
        // MDC is transitive under Nuxt Content in pnpm's strict layout. Its
        // CommonJS dependencies need prebundling before the browser can use them.
        '@nuxt/content > @nuxtjs/mdc > unified > extend',
        '@nuxt/content > @nuxtjs/mdc > debug'
      ]
    }
  },
  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
