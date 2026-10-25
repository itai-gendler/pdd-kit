import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { stringify } from 'yaml'
import { lintModel } from '../src/commands/lint.js'
import { splitFrontmatter } from '../src/core/frontmatter.js'
import { loadModel } from '../src/core/model.js'

const FIXTURE = join(__dirname, 'fixtures', 'fixture-shop')
const TRACKED = [
  'README.md',
  'src/routes/storefront.ts', 'src/routes/admin.ts',
  'src/services/catalog.ts', 'src/services/orders.ts', 'src/services/payments.ts',
  'src/models/product.ts', 'src/models/order.ts'
]

let dir: string | undefined
function fixtureCopy(): string {
  dir = mkdtempSync(join(tmpdir(), 'pdd-kit-lint-'))
  cpSync(FIXTURE, dir, { recursive: true })
  return dir
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = undefined
})

function run(cwd: string, tracked = TRACKED) {
  return lintModel(loadModel(cwd), tracked)
}

function editCoverage(file: string, changes: Record<string, unknown>) {
  const { data, body } = splitFrontmatter(readFileSync(file, 'utf8'), [], 'coverage.md')
  const { rationale, ...fields } = changes
  writeFileSync(file, `---\n${stringify({ ...data, ...fields })}---\n\n${rationale === undefined ? body : `# Coverage\n\n${rationale}\n`}`)
}

/** Write a compact or expanded resource file, creating its parent path. */
function writeResource(file: string, content: string) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}

function expandResource(compactFile: string, expandedFile: string) {
  mkdirSync(dirname(expandedFile), { recursive: true })
  renameSync(compactFile, expandedFile)
}

function compactResource(expandedFile: string, compactFile: string) {
  renameSync(expandedFile, compactFile)
  rmdirSync(dirname(expandedFile))
}

/** The fixture's Shopper, with an extra frontmatter block spliced in. */
function shopperWith(block: string): string {
  return `---
kind: person
acts: external
relations:
  - entity: order
    verb: owns
    cardinality: one-to-many
${block}
---

# Shopper

Lead.

## Information kept

- **Delivery address** — where their orders are sent
- **Product presentation assignment** — the named product-detail experiment arm assigned to this shopper
- **Checkout assignment** — the checkout review experiment arm assigned to this shopper
- **Post-purchase assignment** — the post-purchase experiment arm assigned to this shopper
`
}

/** Drop the mobile catalog preview and its Variation, for tests that reshape customer-mobile. */
function withoutCatalogPreview(productModel: string) {
  unlinkSync(join(productModel, 'variations/mobile-storefront.md'))
  unlinkSync(join(productModel, 'interfaces/customer-mobile/experiences/catalog-preview.md'))
  const capability = join(productModel, 'capabilities/browse-catalog/capability.md')
  writeFileSync(capability, readFileSync(capability, 'utf8').replace(', { place: customer-mobile::catalog-preview }', ''))
  const scenario = join(productModel, 'capabilities/browse-catalog/scenarios/browse-catalog.md')
  writeFileSync(scenario, readFileSync(scenario, 'utf8')
    .replace('  preview: Mobile catalog preview\n', '')
    .replaceAll('      preview:\n        place: customer-mobile::catalog-preview\n', ''))
}

function writeRule(cwd: string, id: string, frontmatter: string) {
  writeResource(join(cwd, `product-model/business-rules/${id}.md`), `---
${frontmatter}
---

# ${id}

Lead.
`)
}

describe('lintModel', () => {
  it('refuses the retired reference and asset state keys everywhere', () => {
    const cwd = fixtureCopy()
    const screen = join(cwd, 'product-model', 'interfaces', 'customer-web', 'experiences', 'storefront', 'screens', 'product-record.md')
    writeFileSync(screen, readFileSync(screen, 'utf8').replace(
      '    title: Product record visual reference',
      '    title: Product record visual reference\n    state: Ready to buy'
    ))
    // A capture of a condition attaches to the Scenario that reaches it; a
    // Screen has no states for a key to resolve against.
    expect(run(cwd).errors).toContain(`${screen}: reference has unknown key "state"`)
  })

  it('reports an unexpected collection entry instead of silently dropping it', () => {
    const cwd = fixtureCopy()
    const entities = join(cwd, 'product-model', 'entities')

    // A wrong extension, or an expanded folder that forgot its own file, used
    // to vanish with no finding at all.
    writeFileSync(join(entities, 'draft.txt'), '# Draft\n')
    mkdirSync(join(entities, 'courier'), { recursive: true })

    const result = run(cwd)
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('entities/draft.txt: expected <id>.md or <id>/entity.md')
    expect(result.errors).toContain('entities/courier/ is missing entity.md')
  })

  it('rejects duplicate compact and expanded shapes for one resource', () => {
    const cwd = fixtureCopy()
    writeResource(
      join(cwd, 'product-model/entities/shopper/entity.md'),
      readFileSync(join(cwd, 'product-model/entities/shopper.md'), 'utf8')
    )

    expect(run(cwd).errors).toContain(
      'entities/shopper: both shopper.md and shopper/entity.md exist; keep exactly one resource shape'
    )
  })

  it('warns rather than fails on an expanded resource that owns nothing yet', () => {
    const cwd = fixtureCopy()
    expandResource(
      join(cwd, 'product-model/entities/shopper.md'),
      join(cwd, 'product-model/entities/shopper/entity.md')
    )
    const result = run(cwd)

    // An author reaches the expanded shape in two steps, and the model is
    // loadable throughout. The rule still holds — expansion normalizes the
    // folder back to the compact form — so it is reported, but it does not
    // fail a model that is otherwise correct.
    expect(result.warnings).toContain(
      'entities/shopper/ has no assets or child resources; use entities/shopper.md'
    )
    expect(result.errors).not.toContain(
      'entities/shopper/ has no assets or child resources; use entities/shopper.md'
    )
    expect(result.ok).toBe(true)
  })

  it('accepts compact Product and expands a resource for its first asset', () => {
    const cwd = fixtureCopy()
    unlinkSync(join(cwd, 'product-model/product/logo.svg'))
    renameSync(join(cwd, 'product-model/product/product.md'), join(cwd, 'product-model/product.md'))
    rmdirSync(join(cwd, 'product-model/product'))

    const compactScreen = join(
      cwd,
      'product-model/interfaces/customer-web/experiences/storefront/screens/product-record.md'
    )
    const expandedScreen = join(
      cwd,
      'product-model/interfaces/customer-web/experiences/storefront/screens/product-record/screen.md'
    )
    expandResource(compactScreen, expandedScreen)
    writeFileSync(join(dirname(expandedScreen), 'mockup.svg'), '<svg viewBox="0 0 1 1"></svg>')
    writeFileSync(
      expandedScreen,
      readFileSync(expandedScreen, 'utf8').replace(
        '---\n\n# Product record',
        'assets:\n  - file: mockup.svg\n    title: Approved product record\n---\n\n# Product record'
      )
    )

    expect(run(cwd).errors).toEqual([])
  })

  it('rejects an expanded Product after its logo is removed', () => {
    const cwd = fixtureCopy()
    unlinkSync(join(cwd, 'product-model/product/logo.svg'))

    expect(run(cwd).errors).toContain('product/ has no logo asset; use product.md')
  })

  it('accepts an optional cover beside the logo and checks it like the logo', () => {
    const cover = readFileSync(join(__dirname, '../blueprints/kanban-board/product-model/product/cover.webp'))
    const cwd = fixtureCopy()
    writeFileSync(join(cwd, 'product-model/product/cover.webp'), cover)
    expect(run(cwd).errors).toEqual([])

    const invalid = fixtureCopy()
    writeFileSync(join(invalid, 'product-model/product/cover.webp'), '<svg/>')
    expect(run(invalid).errors).toContain('cover.webp: cover.webp must be a WebP image')

    const linked = fixtureCopy()
    symlinkSync(join(__dirname, '../blueprints/kanban-board/product-model/product/cover.webp'), join(linked, 'product-model/product/cover.webp'))
    expect(run(linked).errors).toContain('cover.webp: cover.webp must be a regular file, not a symbolic link')

    const broken = fixtureCopy()
    symlinkSync(join(broken, 'no-such-cover.webp'), join(broken, 'product-model/product/cover.webp'))
    expect(run(broken).errors).toContain('cover.webp: cover.webp must be a regular file, not a symbolic link')

    const other = fixtureCopy()
    writeFileSync(join(other, 'product-model/product/cover.png'), cover)
    expect(run(other).errors).toContain('product/cover.png: the Product folder may contain only product.md, logo.svg and cover.webp')
  })

  it('rejects an unrecognized child directory inside a resource folder', () => {
    const cwd = fixtureCopy()
    mkdirSync(join(cwd, 'product-model', 'capabilities', 'place-order', 'notes'), { recursive: true })
    expect(run(cwd).errors).toContain('capabilities/place-order/notes/ is not a recognized child directory')
  })

  it('passes the golden fixture', () => {
    const result = run(fixtureCopy())
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.counts).toEqual({
      interfaces: 6,
      experiences: 3,
      screens: 7,
      domains: 1,
      entities: 10,
      capabilities: 9,
      capabilityScenarios: 19,
      journeys: 2,
      journeyScenarios: 4,
      businessRules: 14
    })
  })

  it('requires coverage.md and rejects coverage.json even alongside it', () => {
    const cwd = fixtureCopy()
    const legacy = join(cwd, 'product-model/coverage.json')
    writeFileSync(legacy, '{}\n')
    expect(run(cwd).errors.join('\n')).toContain('coverage.json is not supported')
    rmSync(join(cwd, 'product-model/coverage.md'))
    expect(run(cwd).errors).toContain('coverage.md is missing')
  })

  it('requires Coverage frontmatter and rejects unstructured body prose', () => {
    const cwd = fixtureCopy()
    const file = join(cwd, 'product-model/coverage.md')
    const original = readFileSync(file, 'utf8')
    for (const [source, error] of [
      [original.replace('exclusions: []\n', ''), 'coverage.md: exclusions:'],
      [original.replace('exclusions: []', 'exclusions: ['), 'frontmatter YAML failed to parse'],
      [original.replace('exclusions: []', 'exclusions: []\nstatus: draft'), 'Unrecognized key: "status"'],
      [original.replace('exclusions: []', 'exclusions: []\nreview: null'), 'Unrecognized key: "review"'],
      [original.replace('exclusions: []', 'exclusions: []\nrationale: Hidden prose'), 'Unrecognized key: "rationale"'],
      [original.replace('# Coverage', 'Unheaded prose'), 'body must contain only "# Coverage"'],
      [original + '\n# Another title\n', 'body must contain only "# Coverage"'],
      [original + '\n## Notes\n', 'body must contain only "# Coverage"']
    ]) {
      writeFileSync(file, source!)
      expect(run(cwd).errors.join('\n')).toContain(error)
    }
  })

  it('reports each Coverage problem once, without inventing a scope error', () => {
    const cwd = fixtureCopy()
    const file = join(cwd, 'product-model/coverage.md')
    const scopeErrors = (errors: string[]) => errors.filter(error => /scope/i.test(error))

    editCoverage(file, { unmapped: [{ description: 'Refunds are not modeled.', paths: ['src/*.ts'] }] })
    const invalidPath = run(cwd).errors
    expect(invalidPath.join('\n')).toContain('coverage.md: unmapped.0.paths.0')
    expect(scopeErrors(invalidPath)).toEqual([])

    editCoverage(file, { unmapped: [{ description: 'Refund code.', paths: ['src/refunds/'] }], limitations: [{ description: 'Refund code.', paths: ['src/refunds/'] }] })
    const duplicate = run(cwd).errors.filter(error => /unique/.test(error))
    expect(duplicate).toHaveLength(1)
    expect(scopeErrors(run(cwd).errors)).toEqual([])

    rmSync(file)
    const missing = run(cwd).errors
    expect(missing).toContain('coverage.md is missing')
    expect(scopeErrors(missing)).toEqual([])
  })

  it('rejects historical folder schemas', () => {
    const cwd = fixtureCopy()
    for (const schema of [5, 8, 9, 10]) {
      writeFileSync(join(cwd, 'product-model/config.yaml'), `schema: ${schema}\nsdd:\n  paths: []\n`)
      expect(run(cwd).errors).toContain(`config.yaml: schema ${schema} is not supported (expected 11)`)
    }
  })

  it('rejects unsupported future folder schemas explicitly', () => {
    const cwd = fixtureCopy()
    writeFileSync(join(cwd, 'product-model/config.yaml'), 'schema: 99\nsdd:\n  paths: []\n')
    expect(run(cwd).errors).toContain('config.yaml: schema 99 is not supported (expected 11)')
  })

  it('requires the committed orientation and generated-path ignores', () => {
    const cwd = fixtureCopy()
    unlinkSync(join(cwd, 'product-model/README.md'))
    writeFileSync(join(cwd, 'product-model/.gitignore'), 'build/\n')
    const errors = run(cwd).errors
    expect(errors).toContain('README.md is missing')
    expect(errors).toContain('.gitignore must ignore cache/')
  })

  it('requires the model gitignore file', () => {
    const cwd = fixtureCopy()
    unlinkSync(join(cwd, 'product-model/.gitignore'))
    expect(run(cwd).errors).toContain('.gitignore is missing')
  })

  /*
   * There is one resource type for things. An Entity that acts says so with
   * `acts`, and with it `kind` — an Actor was always a person or a system, and
   * an Entity that acts without saying which would be a regression from the
   * Actor it replaces. A thing that does not act says nothing.
   */
  it('classifies an Entity that acts, and only one that acts', () => {
    const cwd = fixtureCopy()
    const admin = join(cwd, 'product-model/entities/store-admin.md')
    const source = readFileSync(admin, 'utf8')

    writeFileSync(admin, source.replace('kind: person\n', ''))
    expect(run(cwd).errors.join('\n')).toContain('an Entity that acts needs "kind": person|system')

    writeFileSync(admin, source.replace('acts: internal\n', ''))
    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('"kind" is only valid together with "acts"')
    // Without `acts` there is nothing kept and no state either, so it is not an Entity at all.
    expect(errors).toContain('an Entity needs "## Information kept", "## States", or "acts"')

    writeFileSync(admin, source.replace('kind: person', 'kind: robot').replace('acts: internal', 'acts: sideways'))
    const bad = run(cwd).errors.join('\n')
    expect(bad).toContain('kind "robot" must be person|system')
    expect(bad).toContain('acts "sideways" must be external|internal')
  })

  it('supports every person/system and external/internal combination', () => {
    const cwd = fixtureCopy()
    writeResource(join(cwd, 'product-model/entities/partner-system.md'), `---
kind: system
acts: external
---

# Partner system

An external system that uses a supported integration.
`)
    writeResource(join(cwd, 'product-model/entities/store-scheduler.md'), `---
kind: system
acts: internal
---

# Store scheduler

An internal system that initiates store operations.
`)
    // Acting is reason enough to exist, once something names them as actors.
    const cli = join(cwd, 'product-model/interfaces/operator-cli.md')
    writeFileSync(cli, readFileSync(cli, 'utf8').replace('actors: [store-admin]', 'actors: [store-admin, partner-system, store-scheduler]'))
    expect(run(cwd).errors).toEqual([])
  })

  it('names facts, and refuses a bullet that is not one', () => {
    const cwd = fixtureCopy()
    const order = join(cwd, 'product-model/entities/order.md')
    const source = readFileSync(order, 'utf8')

    writeFileSync(order, source.replace('- **Tax** — the tax charged', '- The tax charged'))
    expect(run(cwd).errors.join('\n')).toContain('fact "The tax charged" must read "**Name** — prose"')

    writeFileSync(order, source.replace('- **Tax** — the tax charged', '- **Subtotal** — the tax charged'))
    expect(run(cwd).errors.join('\n')).toContain('duplicate fact "Subtotal"')
  })

  it('names states, and refuses two with one name', () => {
    // The wire validator has always refused these; the folder linter did not,
    // so a model could lint clean and fail `blueprint export`.
    const cwd = fixtureCopy()
    const order = join(cwd, 'product-model/entities/order.md')
    writeFileSync(order, readFileSync(order, 'utf8').replace('### Cancelled', '### Confirmed'))
    expect(run(cwd).errors.join('\n')).toContain('duplicate state "Confirmed"')
  })

  it('resolves every actor reference to an Entity that acts', () => {
    const cwd = fixtureCopy()
    const cli = join(cwd, 'product-model/interfaces/operator-cli.md')
    writeFileSync(cli, readFileSync(cli, 'utf8').replace('actors: [store-admin]', 'actors: [order]'))
    expect(run(cwd).errors.join('\n')).toContain('"order" does not act; an actor is an Entity with "acts" and "kind"')

    const scenario = join(cwd, 'product-model/capabilities/browse-catalog/scenarios/browse-catalog.md')
    writeFileSync(scenario, readFileSync(scenario, 'utf8').replace('actor: shopper', 'actor: ghost'))
    expect(run(cwd).errors.join('\n')).toContain('step 2: references missing entity "ghost"')
  })

  /*
   * A Product Step may name the Actor it is attributable to — the Product did
   * it for them — and a Business Rule reads it as "who did". An unattended
   * Scenario names nobody: its permission is a Rule's `unattended` grant.
   */
  it('lets a Product Step name who it is attributable to, and nobody in an unattended Scenario', () => {
    const cwd = fixtureCopy()
    const expiry = join(cwd, 'product-model/capabilities/cancel-order/scenarios/expire-an-unpaid-order.md')
    writeFileSync(expiry, readFileSync(expiry, 'utf8').replace('    kind: product\n', '    kind: product\n    actor: store-admin\n'))
    expect(run(cwd).errors.join('\n')).toContain('an unattended Scenario names no actor')
  })

  it('requires an Actor Step rather than an actor attributed only to Product Steps', () => {
    const cwd = fixtureCopy()
    const scenario = join(cwd, 'product-model/capabilities/browse-catalog/scenarios/browse-catalog.md')
    writeFileSync(scenario, readFileSync(scenario, 'utf8').replace(
      '    kind: actor\n    actor: shopper\n',
      '    kind: product\n    actor: shopper\n'
    ))
    expect(run(cwd).errors.join('\n')).toContain(
      'needs at least one actor Step, or an unattended first condition Step'
    )
  })

  it('requires a Capability on a Journey Step that changes a thing', () => {
    const cwd = fixtureCopy()
    const scenario = join(cwd, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md')
    writeFileSync(scenario, readFileSync(scenario, 'utf8').replace('    capability: settle-payment\n', ''))
    expect(run(cwd).errors.join('\n')).toContain('step 3: a Journey Step that creates, changes or removes an Entity needs a "capability"')
  })

  it('refuses an Entity nothing touches', () => {
    const cwd = fixtureCopy()
    writeResource(join(cwd, 'product-model/entities/ghost-thing.md'), `# Ghost thing

Lead.

## Information kept

- **Weight** — how heavy it is
`)
    expect(run(cwd).errors.join('\n')).toContain(
      'ghost-thing.md: no Step changes it, no Screen presents it, nothing names it as an actor, no Rule reads it, and no Variation chooses by it'
    )
  })

  it('allows Products with no Domains and no Screens', () => {
    const cwd = fixtureCopy()
    const productModel = join(cwd, 'product-model')
    rmSync(join(productModel, 'domains'), { recursive: true })
    const walk = (directory: string, edit: (file: string) => void) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const full = join(directory, entry.name)
        if (entry.isDirectory()) walk(full, edit)
        else if (entry.name.endsWith('.md')) edit(full)
      }
    }
    // Stripping a lone `domain:` leaves an empty frontmatter block, which is not a shape.
    walk(productModel, file => writeFileSync(file, readFileSync(file, 'utf8').replace(/^domain: .*\n/m, '').replace(/^---\n---\n\n?/, '')))

    // Every Screen goes, so every Context names its container instead, and the
    // one Rule scoped to a Screen loses its scope.
    for (const relative of [
      'interfaces/customer-web/screens',
      'interfaces/customer-web/experiences/storefront/screens',
      'interfaces/customer-mobile/experiences/storefront/screens',
      'interfaces/admin-web/screens'
    ]) {
      rmSync(join(productModel, relative), { recursive: true })
    }
    for (const interfaceId of ['customer-web', 'customer-mobile']) {
      compactResource(
        join(productModel, `interfaces/${interfaceId}/experiences/storefront/experience.md`),
        join(productModel, `interfaces/${interfaceId}/experiences/storefront.md`)
      )
    }
    compactResource(join(productModel, 'interfaces/admin-web/interface.md'), join(productModel, 'interfaces/admin-web.md'))
    walk(productModel, file => writeFileSync(file, readFileSync(file, 'utf8')
      .replaceAll('customer-web::catalog', 'customer-web::storefront')
      .replace(/::product-record(?:-without-stock)?/g, '')
      .replaceAll('::order-status', '')
      .replaceAll('admin-web::order-detail', 'admin-web')))
    // The experiment's routes differ only by Screen; without Screens the
    // existing browse Scenario already covers their single remaining place.
    unlinkSync(join(productModel, 'capabilities/browse-catalog/scenarios/read-a-product-without-its-stock.md'))
    // The stock disclosure experiment varies Screens, which no longer exist,
    // and the checkout route through its second Screen collapses onto web.
    unlinkSync(join(productModel, 'variations/stock-disclosure.md'))
    for (const name of ['complete-checkout', 'complete-checkout-without-review']) {
      const file = join(productModel, `capabilities/place-order/scenarios/${name}.md`)
      writeFileSync(file, readFileSync(file, 'utf8')
        .replace('  web-without-stock: Web without stock\n', '')
        .replace(/ {6}web-without-stock:\n {8}place: [^\n]*\n/g, ''))
    }
    /* With no Screen anywhere, a governed fact is checkable only where a Step cites it. */
    const status = join(productModel, 'capabilities/track-order/scenarios/check-an-order-and-its-refund.md')
    writeFileSync(status, readFileSync(status, 'utf8').replace(
      '- { entity: order, effect: reads, facts: [Items ordered, Total charged] }',
      '- { entity: order, effect: reads, facts: [Total charged] }'
    ).replace(
      '- { entity: refund, effect: reads, facts: [Amount, Reason] }',
      '- { entity: refund, effect: reads, facts: [Amount] }'
    ))
    const console = join(productModel, 'capabilities/refund-order/scenarios/refund-a-confirmed-order.md')
    writeFileSync(console, readFileSync(console, 'utf8').replace(
      '- { entity: order, effect: reads, facts: [Items ordered, Total charged] }',
      '- { entity: order, effect: reads, facts: [Margin] }'
    ))

    const result = run(cwd)
    expect(result.errors).toEqual([])
    expect(result.counts.domains).toBe(0)
    expect(result.counts.screens).toBe(0)
  })

  it('allows direct Interface availability when the Product has no Experiences', () => {
    const cwd = fixtureCopy()
    const productModel = join(cwd, 'product-model')

    // Promote every Experience-contained Screen up to its Interface and drop the
    // Experiences, leaving each Interface undivided.
    withoutCatalogPreview(productModel)
    for (const interfaceId of ['customer-web', 'customer-mobile']) {
      const from = join(productModel, 'interfaces', interfaceId, 'experiences', 'storefront', 'screens')
      cpSync(from, join(productModel, 'interfaces', interfaceId, 'screens'), { recursive: true })
    }
    for (const interfaceId of ['customer-web', 'customer-mobile', 'admin-web']) {
      rmSync(join(productModel, 'interfaces', interfaceId, 'experiences'), { recursive: true, force: true })
    }
    // Every availability Context loses its Experience segment.
    const scrub = (file: string) => writeFileSync(file, readFileSync(file, 'utf8')
      .replace(/customer-web::storefront/g, 'customer-web')
      .replace(/customer-mobile::storefront/g, 'customer-mobile')
      .replace(/admin-web/g, 'admin-web'))
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const full = join(directory, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name.endsWith('.md')) scrub(full)
      }
    }
    walk(productModel)

    const result = run(cwd)
    expect(result.errors).toEqual([])
    expect(result.counts.experiences).toBe(0)
  })

  it('rejects an availability Context naming an Interface that Experiences divide', () => {
    const cwd = fixtureCopy()
    const capability = join(cwd, 'product-model/capabilities/place-order/capability.md')
    writeFileSync(
      capability,
      readFileSync(capability, 'utf8').replace('customer-web::storefront', 'customer-web')
    )
    expect(run(cwd).errors.join('\n')).toContain(
      'interface "customer-web" is divided into Experiences, so name one of them'
    )
  })

  it('rejects a Context place that resolves to no Experience', () => {
    const cwd = fixtureCopy()
    const capability = join(cwd, 'product-model/capabilities/place-order/capability.md')
    writeFileSync(
      capability,
      readFileSync(capability, 'utf8').replace('customer-web::storefront', 'customer-web::missing')
    )
    expect(run(cwd).errors.join('\n')).toContain(
      'availability Context references missing experience "customer-web::missing"'
    )
  })

  it('requires every authored Context to use the strict place object', () => {
    const cwd = fixtureCopy()
    const capability = join(cwd, 'product-model/capabilities/place-order/capability.md')
    writeFileSync(
      capability,
      readFileSync(capability, 'utf8')
        .replace('{ place: customer-web::storefront }', 'customer-web::storefront')
        .replace(
          '{ place: customer-mobile::storefront }',
          '{ place: customer-mobile::storefront, actor: shopper }'
        )
    )

    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('context must be a mapping with "place"')
    expect(errors).toContain('unknown frontmatter key "actor"')
  })

  /*
    The fixture ships `operator-cli` undivided. Giving it its own Experience
    keeps both shapes covered: a non-visual Interface works whether or not an
    Experience divides it.
  */
  it('supports a non-visual CLI Interface alongside visual Interfaces', () => {
    const cwd = fixtureCopy()
    expandResource(
      join(cwd, 'product-model/interfaces/operator-cli.md'),
      join(cwd, 'product-model/interfaces/operator-cli/interface.md')
    )
    writeResource(
      join(cwd, 'product-model/interfaces/operator-cli/experiences/order-desk.md'),
      `---
actors: [store-admin]
access: restricted
entryPoints:
  - operator-cli: fixture-shop orders
---

# Order desk

Where an operator works through orders from the command line.
`
    )
    // A second access mode is what makes the CLI a divided Interface; a lone
    // Experience for one audience through one access mode would be an error.
    writeResource(
      join(cwd, 'product-model/interfaces/operator-cli/experiences/status-desk.md'),
      `---
actors: [store-admin]
access: public
entryPoints:
  - operator-cli: fixture-shop status
---

# Status desk

Read-only status an operator can query without a session.
`
    )
    for (const relative of [
      'product-model/capabilities/refund-order/capability.md',
      'product-model/capabilities/refund-order/scenarios/refund-a-confirmed-order.md',
      'product-model/capabilities/merge-orders/capability.md',
      'product-model/capabilities/merge-orders/scenarios/merge-duplicate-orders.md'
    ]) {
      const file = join(cwd, relative)
      writeFileSync(
        file,
        readFileSync(file, 'utf8').replaceAll('operator-cli', 'operator-cli::order-desk')
      )
    }
    expect(run(cwd).errors).toEqual([])
  })

  it('requires a supported authored Interface type', () => {
    const cwd = fixtureCopy()
    const productInterface = join(cwd, 'product-model/interfaces/customer-web/interface.md')
    const source = readFileSync(productInterface, 'utf8')

    writeFileSync(productInterface, source.replace('type: web\n', ''))
    expect(run(cwd).errors.join('\n')).toContain(
      'type "" must be web|mobile-app|desktop-app|cli|api|webhook|messaging|voice|device'
    )

    writeFileSync(productInterface, source.replace('type: web', 'type: react'))
    expect(run(cwd).errors.join('\n')).toContain(
      'type "react" must be web|mobile-app|desktop-app|cli|api|webhook|messaging|voice|device'
    )
  })

  it('checks Interface audiences and Interface-keyed Experience entry points', () => {
    const cwd = fixtureCopy()
    const productInterface = join(cwd, 'product-model/interfaces/customer-web/interface.md')
    writeFileSync(productInterface, readFileSync(productInterface, 'utf8').replace('actors: [shopper]', 'actors: [store-admin]'))
    const experience = join(cwd, 'product-model/interfaces/customer-web/experiences/storefront/experience.md')
    writeFileSync(experience, readFileSync(experience, 'utf8').replace('  - customer-web: /', '  - missing-interface: /'))
    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('actor "shopper" is not supported by interface "customer-web"')
    expect(errors).toContain('entry point references undeclared interface "missing-interface"')
  })

  it('requires Experiences to cover every Actor of an Interface they divide', () => {
    const cwd = fixtureCopy()
    const productInterface = join(cwd, 'product-model/interfaces/customer-web/interface.md')
    writeFileSync(
      productInterface,
      readFileSync(productInterface, 'utf8').replace('actors: [shopper]', 'actors: [shopper, store-admin]')
    )

    expect(run(cwd).errors.join('\n')).toContain(
      'actor "store-admin" is not covered by any Experience declaring this interface'
    )
  })

  it('rejects duplicate availability and Capability placement gaps', () => {
    const cwd = fixtureCopy()
    const capability = join(cwd, 'product-model/capabilities/place-order/capability.md')
    writeFileSync(
      capability,
      readFileSync(capability, 'utf8').replace(
        'availability: [{ place: customer-web::storefront }, { place: customer-mobile::storefront }]',
        'availability: [{ place: customer-web::storefront }, { place: customer-web::storefront }]'
      )
    )
    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('duplicate availability Context place "customer-web::storefront"')
    expect(errors).toContain('Context place "customer-mobile::storefront" is outside capability "place-order"')
  })

  it('requires Capability Scenario Context places to be inside the Capability availability', () => {
    const cwd = fixtureCopy()
    const scenario = join(cwd, 'product-model/capabilities/place-order/scenarios/complete-checkout.md')
    writeFileSync(
      scenario,
      readFileSync(scenario, 'utf8').replace('customer-web::storefront::product-record', 'admin-web')
    )
    expect(run(cwd).errors.join('\n'))
      .toContain('Context place "admin-web" is outside capability "place-order"')
  })

  it('requires every Scenario Actor to participate in a selected Context', () => {
    const cwd = fixtureCopy()
    const scenario = join(cwd, 'product-model/capabilities/refund-order/scenarios/refund-a-confirmed-order.md')
    writeFileSync(scenario, readFileSync(scenario, 'utf8').replaceAll(
      'actor: store-admin',
      'actor: shopper'
    ))
    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('Context place "admin-web" permits none of the Scenario Actors')
    expect(errors).toContain('actor "shopper" is not supported by any selected Context place')
  })

  it('requires step text and two distinct Capabilities on achieved Journey paths', () => {
    const cwd = fixtureCopy()
    const scenario = join(cwd, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md')
    writeFileSync(
      scenario,
      readFileSync(scenario, 'utf8')
        .replace('  - text: The shopper finds and selects an available product', '  - text: ""')
        .replace('    capability: place-order', '    capability: browse-catalog')
        .replace('    capability: settle-payment', '    capability: browse-catalog')
    )
    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('step 1: needs non-empty text')
    expect(errors).toContain('an achieved Journey Scenario needs at least two distinct Capabilities')
  })

  it('rejects removed Journey flow, operation, Scenario actors, per-Step routes, and Markdown Steps', () => {
    const cwd = fixtureCopy()
    const scenario = join(cwd, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md')
    writeFileSync(
      scenario,
      readFileSync(scenario, 'utf8')
        .replace(
          'result: achieved',
          'result: achieved\nactors: [shopper]\nflow:\n  - id: legacy-stage\n    capability: browse-catalog\n    operation: Legacy duplicated sentence'
        )
        .replace('    contexts:', '    operation: Legacy duplicated sentence\n    routes:')
        .replace('## Outcome', '## Steps\n\n1. Legacy duplicated sentence\n\n## Outcome')
    )

    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('unknown frontmatter key "flow"')
    expect(errors).toContain('unknown frontmatter key "actors"')
    expect(errors).toContain('unknown frontmatter key "operation"')
    expect(errors).toContain('unknown frontmatter key "routes"')
    expect(errors).toContain('"## Steps" is not allowed on this resource type')
  })

  /*
    Routes are correlated paths, so a second id over the same assignment claims
    a lane the Product does not have — a `mobile` route that never leaves web.
  */
  it('rejects two routes that correlate the same context at every Capability-bearing step', () => {
    const cwd = fixtureCopy()
    const scenario = join(cwd, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md')
    writeFileSync(scenario, readFileSync(scenario, 'utf8').replaceAll(
      'customer-mobile::storefront::product-record',
      'customer-web::storefront::product-record'
    ))
    expect(run(cwd).errors.join('\n')).toContain('route "mobile" repeats every Context place of route "web"')
  })

  /* One differing step is a real cross-Interface handoff, not a repeated lane. */
  it('keeps two routes that differ at any single Capability-bearing step', () => {
    const cwd = fixtureCopy()
    const scenario = join(cwd, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md')
    writeFileSync(scenario, readFileSync(scenario, 'utf8').replace(
      '        place: customer-mobile::storefront::product-record',
      '        place: customer-web::storefront::product-record'
    ))
    expect(run(cwd).errors.join('\n')).not.toContain('repeats every Context place')
  })

  it('treats kind and Journey result as orthogonal fields', () => {
    const cwd = fixtureCopy()
    const source = join(cwd, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md')
    const scenario = join(cwd, 'product-model/journeys/browse-and-buy/scenarios/checkout-is-declined.md')
    writeResource(
      scenario,
      readFileSync(source, 'utf8')
        .replace('kind: primary', 'kind: edge')
        .replace('result: achieved', 'result: not-achieved')
        .replace('# Browse and complete checkout', '# Checkout is declined')
    )
    const result = run(cwd)
    expect(result.errors).toEqual([])
  })

  it('requires Scenario coverage for declared Capabilities even with known unmapped behavior', () => {
    const cwd = fixtureCopy()
    rmSync(join(cwd, 'product-model/capabilities/refund-order/scenarios'), { recursive: true })
    compactResource(
      join(cwd, 'product-model/capabilities/refund-order/capability.md'),
      join(cwd, 'product-model/capabilities/refund-order.md')
    )

    expect(run(cwd).errors.join('\n')).toContain('availability Context place "operator-cli" needs Capability Scenario coverage')

    const coverage = join(cwd, 'product-model/coverage.md')
    editCoverage(coverage, { unmapped: [{ description: 'Subscription purchase code.', paths: ['src/subscriptions/'] }] })
    const result = run(cwd)
    expect(result.errors.some(error => error.includes('needs Capability Scenario coverage'))).toBe(true)
    expect(result.warnings.some(warning => warning.includes('needs Capability Scenario coverage'))).toBe(false)
  })

  /*
   * The one rule that asks for `entity`/`state` on a Step. Every other check
   * validates the pair once it is there, which is how three shipped models came
   * to declare lifecycles their Scenarios never demonstrated.
   */
  /*
   * The Entity declares its states and nothing about the moves between them.
   * The lifecycle is composed from every Scenario, and the composition says
   * what it is missing: a state nothing produces, and an origin nothing
   * produced. The first listed state is where a thing starts, so it is
   * reachable by construction.
   */
  it('composes the lifecycle from Steps and reports what it is missing', () => {
    const cwd = fixtureCopy()
    const order = join(cwd, 'product-model/entities/order.md')
    writeFileSync(order, `${readFileSync(order, 'utf8')}
### Archived

Filed away.
`)
    const merge = join(cwd, 'product-model/capabilities/merge-orders/scenarios/merge-duplicate-orders.md')
    writeFileSync(merge, readFileSync(merge, 'utf8').replace(
      'as: duplicate, effect: changes, from: Pending, to: Cancelled',
      'as: duplicate, effect: changes, from: Archived, to: Cancelled'
    ))

    const result = run(cwd)
    expect(result.errors).toEqual([])
    expect(result.warnings.join('\n')).toContain('order.md: no Step leaves it in "Archived"')
    expect(result.warnings.join('\n')).toContain('moves it from "Archived", which no Step produces')
  })

  /*
   * A Step whose text names a thing it does not declare is the silence the
   * `entities` key exists to end. Titles only, and the Step's own actor and
   * "The Product" are exempt.
   */
  it('rejects undeclared Entity references in Steps even with known unmapped behavior', () => {
    const cwd = fixtureCopy()
    const scenario = join(cwd, 'product-model/capabilities/browse-catalog/scenarios/browse-catalog.md')
    writeFileSync(scenario, readFileSync(scenario, 'utf8').replace(
      'text: The catalog is listed',
      'text: The catalog is listed beside any refunds the shopper has'
    ))
    expect(run(cwd).errors.join('\n')).toContain(
      'browse-catalog.md: step 1: text names "Refund" and "entities" does not declare it'
    )
    // "the shopper" is the Step's actor on step 2 only; on step 1 it is another Entity named and undeclared.
    expect(run(cwd).errors.join('\n')).toContain('step 1: text names "Shopper" and "entities" does not declare it')

    const coverage = join(cwd, 'product-model/coverage.md')
    editCoverage(coverage, { unmapped: [{ description: 'Subscription purchase code.', paths: ['src/subscriptions/'] }] })
    const result = run(cwd)
    expect(result.errors.some(error => error.includes('does not declare it'))).toBe(true)
    expect(result.warnings.some(warning => warning.includes('does not declare it'))).toBe(false)
  })

  /*
   * A title inside a longer declared title is covered by it: "Catalog product"
   * declared says nothing about "Catalog". And "the Product" is the Product in
   * any case, mid-sentence as much as at the start.
   */
  it('reads a shorter title inside a declared longer one as the longer one', () => {
    const cwd = fixtureCopy()
    writeFileSync(join(cwd, 'product-model/entities/catalog.md'), '# Catalog\n\nThe shelf.\n\n## Information kept\n\n- **Name** — what it is called\n')
    writeFileSync(join(cwd, 'product-model/entities/product.md'), '# Product\n\nThe whole thing.\n\n## Information kept\n\n- **Name** — what it is called\n')
    const scenario = join(cwd, 'product-model/capabilities/browse-catalog/scenarios/browse-catalog.md')
    writeFileSync(scenario, readFileSync(scenario, 'utf8').replace(
      'text: The catalog is listed',
      'text: The Catalog product list is shown, and the Product keeps it current'
    ))
    const findings = [...run(cwd).errors, ...run(cwd).warnings].join('\n')
    expect(findings).not.toContain('browse-catalog.md: step 1: text names "Catalog"')
    expect(findings).not.toContain('browse-catalog.md: step 1: text names "Product"')
    // Elsewhere, "the catalog" is still a Catalog nobody declared.
    expect(findings).toContain('text names "Catalog"')
  })

  /*
   * A Step names the state it leaves the Entity in and never the one it came
   * from, so two transitions into one state share a demonstration. Demanding a
   * witness per edge would demand a `from` the format never gives a Step.
   */
  /*
   * Where an earlier Step left an instance in a state, a later Step leaves
   * from it — and the way out of a false alarm is an alias, never a guess.
   */
  it('chains Steps per instance and points at aliases', () => {
    const cwd = fixtureCopy()
    const refund = join(cwd, 'product-model/capabilities/refund-order/scenarios/refund-a-confirmed-order.md')
    const source = readFileSync(refund, 'utf8')
    writeFileSync(refund, source.replace(
      '      - { entity: order, effect: reads, facts: [Items ordered, Total charged] }',
      '      - { entity: order, effect: changes, from: Pending, to: Confirmed, facts: [] }'
    ).replace('from: Confirmed, to: Refunded', 'from: Pending, to: Refunded'))
    expect(run(cwd).errors.join('\n')).toContain(
      '"order" was left in "Confirmed" by an earlier Step, not "Pending"; if these are different instances, give them aliases'
    )

    const merge = join(cwd, 'product-model/capabilities/merge-orders/scenarios/merge-duplicate-orders.md')
    writeFileSync(merge, readFileSync(merge, 'utf8').replace(
      '{ entity: order, as: duplicate, effect: changes, from: Pending, to: Cancelled, facts: [] }',
      '{ entity: order, effect: changes, from: Pending, to: Cancelled, facts: [] }'
    ))
    expect(run(cwd).errors.join('\n')).toContain(
      '"order" is aliased elsewhere in this Scenario; once an Entity is aliased, every mention of it is'
    )
  })

  /*
   * The other end of "capability X does not declare entity Y". That check runs
   * when a Step names an Entity; nothing ran when a Capability named one and no
   * Step ever did, so a Capability could declare what it changes while its whole
   * acceptance surface stayed silent about it.
   *
   * It asks whether the surface says anything, never whether it accounts for
   * each declared Entity: `entities` is what a Capability *can* change and a
   * Step's `changes` is what one concrete case *does*, so the two differ by
   * design.
   */
  it('refuses the retired Capability entities list, and names the replacement', () => {
    const cwd = fixtureCopy()
    const capability = join(cwd, 'product-model/capabilities/browse-catalog/capability.md')
    writeFileSync(capability, readFileSync(capability, 'utf8').replace('---\n', '---\nentities:\n  - catalog-product\n'))
    expect(run(cwd).errors.join('\n')).toContain('"entities" is gone from a Capability; each Step\'s "entities" says what it changes')
  })

  /*
   * The rule that would force a false claim if it asked for more. A Capability
   * that writes any part of a model can touch every resource type while no
   * single acceptance case touches all of them.
   */
  it('requires entities on every Step, so silence is impossible', () => {
    const cwd = fixtureCopy()
    const scenario = join(cwd, 'product-model/capabilities/browse-catalog/scenarios/browse-catalog.md')
    writeFileSync(scenario, readFileSync(scenario, 'utf8').replace(
      '    entities:\n      - { entity: catalog-product, effect: reads, facts: [Name and description, Price, Stock remaining] }\n    contexts:\n      web:\n        place: customer-web::catalog\n      mobile:\n        place: customer-mobile::storefront::product-record\n      preview:\n        place: customer-mobile::catalog-preview\n  - text: The shopper opens',
      '    contexts:\n      web:\n        place: customer-web::catalog\n      mobile:\n        place: customer-mobile::storefront::product-record\n      preview:\n        place: customer-mobile::catalog-preview\n  - text: The shopper opens'
    ))
    expect(run(cwd).errors.join('\n')).toContain('step 1: needs "entities" — what this Step does to the Product\'s things, or [] when it touches nothing')
  })

  it('refuses the retired transitions key on an Entity, and the earlier Step spellings', () => {
    const cwd = fixtureCopy()
    const order = join(cwd, 'product-model/entities/order.md')
    writeFileSync(order, readFileSync(order, 'utf8').replace('domain: ordering', 'domain: ordering\ntransitions:\n  - { from: Pending, to: Confirmed, by: settle-payment }'))
    expect(run(cwd).errors.join('\n')).toContain('"transitions" is gone; a Step\'s "entities" entry says which state it moves the thing from and to')

    const scenario = join(cwd, 'product-model/capabilities/browse-catalog/scenarios/browse-catalog.md')
    writeFileSync(scenario, readFileSync(scenario, 'utf8').replace('    entities:\n', '    reads:\n      - catalog-product\n    entities:\n'))
    expect(run(cwd).errors.join('\n')).toContain('"reads" is now an entry of "entities"')
  })

  /*
   * A read is a bare mention. It resolves like any other reference, and reading
   * and changing one thing in one act are two claims that cannot both be the
   * whole truth about that Step.
   */
  /*
   * A read is a bare mention. It resolves like any other reference, and it
   * never keeps an Entity from being an orphan.
   */
  it('resolves a Step read like any other reference', () => {
    const cwd = fixtureCopy()
    const scenario = join(cwd, 'product-model/capabilities/browse-catalog/scenarios/browse-catalog.md')
    const source = readFileSync(scenario, 'utf8')

    writeFileSync(scenario, source.replace('{ entity: catalog-product, effect: reads, facts: [Name and description, Price, Stock remaining] }', '{ entity: ghost, effect: reads, facts: [] }'))
    expect(run(cwd).errors.join('\n')).toContain('step 1: references missing entity "ghost"')

    writeFileSync(scenario, source)
    expect(run(cwd).errors).toEqual([])
  })

  it('refuses two entries for one instance, and state keys an effect cannot carry', () => {
    const cwd = fixtureCopy()
    const refund = join(cwd, 'product-model/capabilities/refund-order/scenarios/refund-a-confirmed-order.md')
    const source = readFileSync(refund, 'utf8')
    const withEntry = (entry: string) => {
      writeFileSync(refund, source.replace(
        '      - { entity: refund, effect: creates, to: Requested, facts: [Amount, Reason] }',
        `      - { entity: refund, effect: creates, to: Requested, facts: [Amount, Reason] }\n      - ${entry}`
      ))
      return run(cwd).errors.join('\n')
    }

    expect(withEntry('{ entity: refund, effect: reads, facts: [] }')).toContain('"refund" already appears in this Step')
    expect(withEntry('{ entity: cart, effect: reads, to: Full, facts: [] }')).toContain('a "reads" entry carries no "from" or "to"')
    expect(withEntry('{ entity: cart, effect: creates, from: Empty, facts: [] }')).toContain('a "creates" entry has no "from"')
    expect(withEntry('{ entity: cart, effect: removes, to: Empty }')).toContain('a "removes" entry has no "to"')
    expect(withEntry('{ entity: cart, effect: changes, to: Full, facts: [] }')).toContain('a "changes" entry carries both "from" and "to", or neither')
    expect(withEntry('{ entity: cart, effect: changes, from: Full, to: Empty, facts: [] }')).toContain('names a state, and entity "cart" declares none')
    expect(withEntry('{ entity: catalog-product, effect: creates, facts: [] }')).toContain('creating "catalog-product" needs "to", the state it starts in')
    expect(withEntry('{ entity: catalog-product, effect: removes }')).toContain('removing "catalog-product" needs "from", the state it ends in')
    expect(withEntry('{ entity: catalog-product, effect: changes, from: Available, to: Sold, facts: [] }')).toContain('"Sold" is not a state of entity "catalog-product"')
  })

  it('requires Capability Scenario coverage for every availability Context', () => {
    const cwd = fixtureCopy()
    for (const name of ['complete-checkout', 'complete-checkout-without-review', 'decline-checkout-payment', 'sell-the-last-available-unit']) {
      const file = join(cwd, `product-model/capabilities/place-order/scenarios/${name}.md`)
      writeFileSync(
        file,
        readFileSync(file, 'utf8')
          .replace('  mobile: Mobile\n', '')
          .replaceAll('      mobile:\n        place: customer-mobile::storefront::product-record\n', '')
      )
    }

    expect(run(cwd).errors.join('\n')).toContain(
      'availability Context place "customer-mobile::storefront" needs Capability Scenario coverage'
    )
  })

  it('validates complete Journey step routes and their goal-owner entry context', () => {
    const cwd = fixtureCopy()
    const file = join(cwd, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md')
    writeFileSync(
      file,
      readFileSync(file, 'utf8')
        .replace(
          '        place: customer-web::storefront::product-record',
          '        place: admin-web'
        )
        .replace(
          '      mobile:\n        place: customer-mobile::storefront::product-record',
          ''
        )
    )

    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('Context place "admin-web" is outside capability "browse-catalog"')
    expect(errors).toContain('Context place does not support actor "shopper"')
    expect(errors).toContain('step 1: contexts must assign every declared route or be omitted')
  })

  it('rejects narrowed Rule contexts outside their target and redundant ancestor targets', () => {
    const cwd = fixtureCopy()
    const file = join(cwd, 'product-model/business-rules/payment-before-confirmation.md')
    writeFileSync(file, readFileSync(file, 'utf8').replace(
      'appliesTo:\n  - type: entity\n    id: order\n    effect: changes\n    to: Confirmed',
      `appliesTo:
  - type: capability
    id: refund-order
  - type: capability-scenario
    id: refund-a-confirmed-order
    contexts:
      - place: customer-web::storefront`
    ))

    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('Context place "customer-web::storefront" is outside target "capability-scenario:refund-a-confirmed-order"')
    expect(errors).toContain('target "capability-scenario:refund-a-confirmed-order" is redundant with capability target "refund-order"')
  })

  it('lets a Rule Context select descendants and rejects redundant nested selectors', () => {
    const cwd = fixtureCopy()
    const file = join(cwd, 'product-model/business-rules/payment-before-confirmation.md')
    const source = readFileSync(file, 'utf8').replace(
      'appliesTo:\n  - type: entity\n    id: order\n    effect: changes\n    to: Confirmed',
      'appliesTo:\n  - type: capability\n    id: browse-catalog\n    contexts:\n      - place: customer-web'
    )
    writeFileSync(file, source)
    expect(run(cwd).errors).toEqual([])

    // An Interface selector already covers its Experiences, so naming both is
    // redundant rather than narrower.
    writeFileSync(file, source.replace(
      '      - place: customer-web',
      '      - place: customer-web\n      - place: customer-web::storefront'
    ))
    expect(run(cwd).errors.join('\n')).toContain(
      'Context place "customer-web::storefront" is redundant with "customer-web"'
    )
  })

  it('requires every Journey Actor to participate in an achieved Scenario', () => {
    const cwd = fixtureCopy()
    const file = join(cwd, 'product-model/journeys/browse-and-buy/journey.md')
    writeFileSync(file, readFileSync(file, 'utf8').replace('actors: [shopper]', 'actors: [shopper, store-admin]'))
    // The manual-confirmation alternative is where an operator acts; without it, none does.
    unlinkSync(join(cwd, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout-with-manual-confirmation.md'))
    unlinkSync(join(cwd, 'product-model/variations/order-confirmation.md'))

    expect(run(cwd).errors.join('\n')).toContain(
      'actor "store-admin" needs an achieved Journey Scenario'
    )
  })

  it('rejects removed Experience and Journey fields as unknown keys', () => {
    const cwd = fixtureCopy()
    const experience = join(cwd, 'product-model/interfaces/customer-web/experiences/storefront/experience.md')
    writeFileSync(experience, readFileSync(experience, 'utf8').replace('access: public', 'access: public\nexit: done'))
    const journey = join(cwd, 'product-model/journeys/browse-and-buy/journey.md')
    writeFileSync(journey, readFileSync(journey, 'utf8').replace(
      'actors:',
      'domain: ordering\nentryPoints:\n  - customer-web: /\nactors:'
    ))
    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('unknown frontmatter key "exit"')
    expect(errors).toContain('unknown frontmatter key "domain"')
    expect(errors).toContain('unknown frontmatter key "entryPoints"')
  })

  it('rejects authored content that structured export would otherwise drop or reinterpret', () => {
    const cwd = fixtureCopy()
    const journey = join(cwd, 'product-model/journeys/browse-and-buy/journey.md')
    writeFileSync(journey, readFileSync(journey, 'utf8')
      .replace('# Browse and buy\n\n## Goal', '# Browse and buy\n\nLegacy Journey summary.\n\n## Goal')
      .replace('## Success criterion', '## Outcome\n\nWrong resource shape.\n\n## Success criterion'))

    const scenario = join(cwd, 'product-model/capabilities/place-order/scenarios/complete-checkout.md')
    writeFileSync(scenario, readFileSync(scenario, 'utf8')
      .replace('# Complete checkout\n\n## Trigger', '# Complete checkout\n\nLegacy Scenario summary.\n\n## Trigger')
      .replace('## Outcome', '## Goal\n\nWrong resource shape.\n\n## Trigger\n\nDuplicate trigger.\n\n## Outcome')
      .replace(
        'The order is stored as pending, awaiting settlement, and a confirmation is shown.',
        'The order is stored as pending, awaiting settlement, and a confirmation is shown.\n\n## Edge cases\n\nNot a bullet item.'
      )
      .replace(
        'Payment recovery remains supporting context rather than another structured field.',
        '# Nested structural title'
      ))

    const coverage = join(cwd, 'product-model/coverage.md')
    editCoverage(coverage, { rationale: '## Notes\n\nThis section would be dropped.' })

    const errors = run(cwd).errors.join('\n')
    expect(errors.match(/carries no lead paragraph/g)).toHaveLength(2)
    expect(errors).toContain('"## Outcome" is not allowed on this resource type')
    expect(errors).toContain('duplicate "## Trigger" section')
    expect(errors).toContain('"## Goal" is not allowed on this resource type')
    expect(errors).toContain('"## Edge cases" must contain only single-line bullet-list items')
    expect(errors).toContain('"## Edge cases" needs at least one bullet item when present')
    expect(errors).toContain('"## Recovery note" content must not contain an H1 or H2 heading')
    expect(errors).toContain('coverage.md: body must contain only "# Coverage"')
  })

  it('rejects duplicate values in every set-valued frontmatter list', () => {
    const cwd = fixtureCopy()
    const product = join(cwd, 'product-model/product/product.md')
    writeFileSync(product, readFileSync(product, 'utf8')
      .replace('tags: [commerce, fixture]', 'tags: [commerce, fixture, commerce]'))
    const productInterface = join(cwd, 'product-model/interfaces/customer-web/interface.md')
    writeFileSync(productInterface, readFileSync(productInterface, 'utf8')
      .replace('actors: [shopper]', 'actors: [shopper, shopper]'))
    const screen = join(cwd, 'product-model/interfaces/customer-web/experiences/storefront/screens/product-record.md')
    writeFileSync(screen, readFileSync(screen, 'utf8')
      .replace('shows: [Name and description, Price, Stock remaining]', 'shows: [Price, Price]'))

    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('product.md: "tags" contains duplicate "commerce"')
    expect(errors).toContain('"actors" contains duplicate "shopper"')
    expect(errors).toContain('"shows" contains duplicate "Price"')
  })

  it('validates Screen relationships and refuses the retired prose sections', () => {
    const cwd = fixtureCopy()
    writeFileSync(join(cwd, 'product-model/interfaces/customer-web/experiences/storefront/screens/product-record.md'), `---
availability:
  - interface: missing-interface
    experiences: [missing-experience]
capabilityScenarios: [missing-capability-scenario]
journeyScenarios: [missing-journey-scenario]
entities:
  - { entity: catalog-product, shows: [Price, Colour] }
  - ghost
  - catalog-product
  - { entity: cart, shows: [] }
---

# Product record

Lead.

## Information presented

- Price

## Available actions

- Buy

## View states

### Empty

Nothing here.

## Capability boundary

Prose.
`)
    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('unknown frontmatter key "availability"')
    expect(errors).toContain('unknown frontmatter key "capabilityScenarios"')
    expect(errors).toContain('unknown frontmatter key "journeyScenarios"')
    /* A Screen is relations only: what it shows is `entities`, its facts are
       the Entity's own, and the prose sections that restated them are gone. */
    expect(errors).toContain('"Colour" is not a fact of entity "catalog-product"')
    expect(errors).toContain('names missing entity "ghost"')
    expect(errors).toContain('"catalog-product" already appears in this Screen\'s entities')
    expect(errors).toContain('"shows" must be a non-empty list when present')
    for (const heading of ['Information presented', 'Available actions', 'View states', 'Capability boundary']) {
      expect(errors).toContain(`"## ${heading}" is not allowed on this resource type`)
    }
  })

  it('derives Screen Capabilities from placed Steps', () => {
    const cwd = fixtureCopy()
    const screen = loadModel(cwd).screens.find(item => item.id === 'customer-web::storefront::product-record')!
    expect(screen.capabilities).toEqual(['browse-catalog', 'place-order'])
    expect(run(cwd).errors).toEqual([])
  })

  it('reads a Screen shared beside experiences/ as inside every Experience of its Interface', () => {
    const cwd = fixtureCopy()
    // The fixture shares customer-web::catalog beside the storefront Experience.
    // A second Experience that browse-catalog is not available in breaks both
    // the Screen and the Step that occurs on it, and names what is missing.
    writeResource(join(cwd, 'product-model/interfaces/customer-web/experiences/account/experience.md'), `---
actors: [shopper]
access: authenticated
entryPoints:
  - customer-web: /account
---

# Account

Lead.
`)
    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain(
      'catalog.md: capability "browse-catalog" must be available in every Experience of "customer-web", which shares this Screen; missing "customer-web::account"'
    )
    expect(errors).toContain('Context place "customer-web::catalog" is outside capability "browse-catalog"')

    // Offering the Capability in every Experience settles both, and the Step on
    // the shared Screen covers the new Experience without a Step of its own.
    const capability = join(cwd, 'product-model/capabilities/browse-catalog/capability.md')
    writeFileSync(
      capability,
      readFileSync(capability, 'utf8').replace(
        '{ place: customer-web::storefront }, ',
        '{ place: customer-web::storefront }, { place: customer-web::account }, '
      )
    )
    const settled = run(cwd).errors.join('\n')
    expect(settled).not.toContain('which shares this Screen')
    expect(settled).not.toContain('outside capability "browse-catalog"')
    expect(settled).not.toContain('availability Context place "customer-web::account" needs Capability Scenario coverage')
  })

  it('checks Screen reads only against Rules that can select a read', () => {
    const cwd = fixtureCopy()
    // A target with `to` selects a state move; a read carries no state, so it
    // never governs what a Screen presents.
    writeRule(cwd, 'only-an-operator-lands-refunded', `appliesTo:
  - type: entity
    id: order
    to: Refunded
permits:
  - actors: [store-admin]`)
    expect(run(cwd).errors.filter(error => error.includes('has a grant to read it'))).toEqual([])

    // A read-governing Rule with no grant for the shopper still fails the
    // shopper Screens that present an Order.
    writeRule(cwd, 'only-operators-read-orders', `appliesTo:
  - type: entity
    id: order
    effect: reads
permits:
  - actors: [store-admin]`)
    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('order-status.md: presents "order", and no actor of "customer-web::storefront" has a grant to read it in rule "only-operators-read-orders"')
  })

  it('divides an Interface only when no available Capability bridges its audiences, as an error', () => {
    const cwd = fixtureCopy()
    const adminWeb = join(cwd, 'product-model/interfaces/admin-web/interface.md')
    // admin-web now serves shoppers too; refund-order is reached by the admin,
    // cancel-order by the shopper, and nothing bridges them. (The fixture's
    // admin-cancels-a-paid-order and cancellation-request Scenarios would bridge
    // them, so they go.)
    unlinkSync(join(cwd, 'product-model/capabilities/cancel-order/scenarios/cancel-a-paid-order-before-fulfilment.md'))
    unlinkSync(join(cwd, 'product-model/capabilities/request-cancellation/scenarios/approve-a-cancellation-request.md'))
    writeFileSync(adminWeb, readFileSync(adminWeb, 'utf8').replace('actors: [store-admin]', 'actors: [store-admin, shopper]'))
    const disjoint = run(cwd)
    expect(disjoint.errors).toContain(
      `${adminWeb}: serves Actor sets no available Capability bridges; these are Experiences, not one context`
    )

    // A Capability both audiences use joins them into one context.
    writeResource(join(cwd, 'product-model/capabilities/review-orders/capability.md'), `---
domain: ordering
availability: [{ place: admin-web }]
---

# Review orders

Lets an operator and the shopper look at a disputed order together.
`)
    writeResource(join(cwd, 'product-model/capabilities/review-orders/scenarios/review-an-order-together.md'), `---
kind: primary
routes:
  web: Web
steps:
  - text: The admin opens the disputed order
    kind: actor
    actor: store-admin
    entities:
      - { entity: order, effect: reads, facts: [] }
    contexts:
      web:
        place: admin-web::order-detail
  - text: The shopper confirms the items listed are what they received
    kind: actor
    actor: shopper
    entities:
      - { entity: order, effect: reads, facts: [] }
    contexts:
      web:
        place: admin-web::order-detail
---

# Review an order together

## Trigger

A shopper disputes an order with an operator.

## Outcome

Both have looked at the same order record.
`)
    const screen = join(cwd, 'product-model/interfaces/admin-web/screens/order-detail.md')
    writeFileSync(screen, readFileSync(screen, 'utf8').replace('  - refund-order\n', '  - refund-order\n  - review-orders\n'))
    const bridged = run(cwd)
    expect(bridged.errors.filter(error => error.includes('no available Capability bridges'))).toEqual([])
  })

  it('keeps one context per access mode unless its audiences share no Actor', () => {
    const cwd = fixtureCopy()
    const promotions = join(cwd, 'product-model/interfaces/customer-web/experiences/promotions/experience.md')
    writeResource(promotions, `---
actors: [shopper]
access: public
---

# Promotions

Where shoppers browse current offers.
`)
    expect(run(cwd).errors).toContain(
      `${promotions}: shares \`public\` access and an Actor with customer-web::storefront; one access mode is one context unless its audiences share no Actor`
    )
  })

  it('exempts only alternatives of one Variation from the one-context-per-access-mode rule', () => {
    const cwd = fixtureCopy()
    // customer-mobile's storefront and catalog-preview are alternatives of the
    // Mobile storefront Variation; an Experience beside them is still compared.
    const help = join(cwd, 'product-model/interfaces/customer-mobile/experiences/help.md')
    writeResource(help, `---
actors: [shopper]
access: public
---

# Help

Where shoppers find answers inside the app.
`)
    const errors = run(cwd).errors.filter(error => error.includes('one access mode is one context'))
    const experiences = join(cwd, 'product-model/interfaces/customer-mobile/experiences')
    expect(errors.sort()).toEqual([
      `${experiences}/catalog-preview.md: shares \`public\` access and an Actor with customer-mobile::help; one access mode is one context unless its audiences share no Actor`,
      `${help}: shares \`public\` access and an Actor with customer-mobile::storefront; one access mode is one context unless its audiences share no Actor`,
    ])
  })

  it('joins roles that share one Account into one audience', () => {
    const cwd = fixtureCopy()
    const entities = join(cwd, 'product-model/entities')
    const adminWeb = join(cwd, 'product-model/interfaces/admin-web/interface.md')
    unlinkSync(join(cwd, 'product-model/capabilities/cancel-order/scenarios/cancel-a-paid-order-before-fulfilment.md'))
    unlinkSync(join(cwd, 'product-model/capabilities/request-cancellation/scenarios/approve-a-cancellation-request.md'))
    writeFileSync(adminWeb, readFileSync(adminWeb, 'utf8').replace('actors: [store-admin]', 'actors: [store-admin, shopper]'))
    writeResource(join(entities, 'account.md'), `---
---

# Account

The person behind every role they hold.

## Information kept

- **Email** — where the person is reached
`)
    const relate = (file: string) => {
      const text = readFileSync(join(entities, file), 'utf8')
      writeFileSync(join(entities, file), text.includes('relations:\n')
        ? text.replace('relations:\n', 'relations:\n  - entity: account\n    verb: signs in with\n    cardinality: one-to-one\n')
        : text.replace('---\n', '---\nrelations:\n  - entity: account\n    verb: signs in with\n    cardinality: one-to-one\n'))
    }
    relate('shopper.md')
    expect(run(cwd).errors).toContain(
      `${adminWeb}: serves Actor sets no available Capability bridges; these are Experiences, not one context`
    )
    relate('store-admin.md')
    expect(run(cwd).errors.filter(error => error.includes('no available Capability bridges'))).toEqual([])
  })

  it('flags a ceremonial Experience as an error, unless it is a counterpart or a Variation alternative', () => {
    const cwd = fixtureCopy()
    // As authored, customer-web's single storefront Experience is justified by
    // customer-mobile's counterpart. Rename the mobile one and web stands alone,
    // while mobile stays justified by the Mobile storefront Variation.
    const productModel = join(cwd, 'product-model')
    renameSync(join(productModel, 'interfaces/customer-mobile/experiences/storefront'), join(productModel, 'interfaces/customer-mobile/experiences/shop'))
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const full = join(directory, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name.endsWith('.md')) {
          writeFileSync(full, readFileSync(full, 'utf8').replaceAll('customer-mobile::storefront', 'customer-mobile::shop'))
        }
      }
    }
    walk(productModel)
    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('interfaces/customer-web/interface.md: holds Experiences but serves one audience through one access mode, and none is a counterpart or Variation; use direct Interface availability')
    expect(errors).not.toContain('interfaces/customer-mobile/interface.md: holds Experiences')
    withoutCatalogPreview(productModel)
    rmSync(join(productModel, 'variations/mobile-storefront.md'), { force: true })
    expect(run(cwd).errors.join('\n')).toContain('interfaces/customer-mobile/interface.md: holds Experiences but serves one audience through one access mode, and none is a counterpart')
  })

  it('reads a word the model declares as a thing, not as a verb, in id vocabulary checks', () => {
    const cwd = fixtureCopy()
    const productModel = join(cwd, 'product-model')
    const entity = (id: string, title: string) => writeResource(join(productModel, `entities/${id}.md`), `---
---

# ${title}

Lead.

## Information kept

- **Quantity** — how many
`)
    // `order` and `refund` name Entities here, so these open with a noun.
    entity('order-line', 'Order line')
    entity('refund-request', 'Refund request')
    // A compound noun whose first word can be a verb is still a noun.
    entity('ship-manifest', 'Ship manifest')
    // A verb acting on something the model declares reads as a command.
    entity('cancel-orders', 'Cancel orders')
    // A declared noun spanning segments: `refund-request` is the thing approved.
    entity('approve-refund-request', 'Approve refund request')
    // The spec's own counter-example: `order` is a thing, so the id carries no verb.
    cpSync(join(productModel, 'capabilities/refund-order'), join(productModel, 'capabilities/order-management'), { recursive: true })
    // The noun half is matched against things, never against a Screen's name:
    // `record` ends the `product-record` Screen but names no Entity.
    cpSync(join(productModel, 'capabilities/refund-order'), join(productModel, 'capabilities/browse-record'), { recursive: true })
    // `product` ends the `catalog-product` Entity, so the declared name is suggested.
    cpSync(join(productModel, 'capabilities/refund-order'), join(productModel, 'capabilities/price-product'), { recursive: true })
    // Scenarios are behavioural ids too.
    cpSync(join(productModel, 'capabilities/refund-order/scenarios/refund-a-confirmed-order.md'), join(productModel, 'capabilities/refund-order/scenarios/refund-processing.md'))
    // A declared thing ending in -ment is the object, not a nominalisation, even after a verb the list lacks.
    entity('document', 'Document')
    cpSync(join(productModel, 'capabilities/refund-order'), join(productModel, 'capabilities/duplicate-document'), { recursive: true })

    const warnings = run(cwd).warnings.join('\n')
    expect(warnings).not.toContain('"order-line" opens with a verb')
    expect(warnings).not.toContain('"refund-request" opens with a verb')
    expect(warnings).not.toContain('"ship-manifest" opens with a verb')
    expect(warnings).toContain('Entity id "cancel-orders" opens with a verb')
    expect(warnings).toContain('Entity id "approve-refund-request" opens with a verb')
    expect(warnings).toContain('Capability id "order-management" reads as a noun phrase')
    expect(warnings).toContain('Capability Scenario id "refund-processing" reads as a noun phrase')
    expect(warnings).not.toContain('"duplicate-document" reads as a noun phrase')
    expect(warnings).not.toContain('"browse-record" names "record"')
    expect(warnings).toContain('Capability id "price-product" names "product" where this model declares "catalog-product"')
  })

  it('adds configured verbs to naming checks without replacing defaults or overriding declared nouns', () => {
    const cwd = fixtureCopy()
    const root = join(cwd, 'product-model')
    writeResource(join(root, 'capabilities/undo-sorting-action/capability.md'),
      readFileSync(join(root, 'capabilities/refund-order/capability.md'), 'utf8'))
    for (const id of ['undo-sorting-action-classification', 'undo-sorting-action-recurring-completion', 'undo-sorting-action-regular-completion']) {
      writeResource(join(root, `capabilities/undo-sorting-action/scenarios/${id}.md`),
        readFileSync(join(root, 'capabilities/refund-order/scenarios/refund-a-confirmed-order.md'), 'utf8'))
    }
    writeResource(join(root, 'capabilities/publish-collection/capability.md'),
      readFileSync(join(root, 'capabilities/refund-order/capability.md'), 'utf8'))
    writeResource(join(root, 'capabilities/order-management/capability.md'),
      readFileSync(join(root, 'capabilities/refund-order/capability.md'), 'utf8'))
    writeResource(join(root, 'entities/redo-orders.md'), '---\n---\n\n# Redo orders\n\nLead.\n')
    const config = join(root, 'config.yaml')
    const original = readFileSync(config, 'utf8')
    const nounWarnings = () => run(cwd).warnings.filter(warning => warning.includes('reads as a noun phrase'))
    expect(nounWarnings().filter(warning => warning.includes('id "undo-sorting-action'))).toHaveLength(4)

    writeFileSync(config, `${original}lint:\n  verbs: [undo, redo, order]\n`)
    const result = run(cwd)
    expect(result.errors.filter(error => error.startsWith('config.yaml'))).toEqual([])
    expect(result.warnings.join('\n')).not.toContain('id "undo-sorting-action')
    expect(result.warnings.join('\n')).not.toContain('"publish-collection" reads as a noun phrase')
    expect(result.warnings.join('\n')).toContain('"order-management" reads as a noun phrase')
    expect(result.warnings.join('\n')).toContain('Entity id "redo-orders" opens with a verb')

    writeFileSync(config, original)
    expect(nounWarnings().filter(warning => warning.includes('id "undo-sorting-action'))).toHaveLength(4)
  })

  it('warns on a Rule that governs exactly one behaviour with no narrowing', () => {
    const cwd = fixtureCopy()
    writeRule(cwd, 'orders-are-merged-by-hand', `appliesTo:
  - type: capability
    id: merge-orders`)
    expect(run(cwd).warnings.join('\n')).toContain(
      'orders-are-merged-by-hand.md: governs only "merge-orders"; a constraint true of one behavior belongs to it as a condition Step or Outcome, not a Business Rule'
    )
  })

  it('requires a Domain Boundary to say what the Domain does not own', () => {
    const cwd = fixtureCopy()
    const domain = join(cwd, 'product-model/domains/ordering.md')
    const source = readFileSync(domain, 'utf8')
    const boundaryAt = source.indexOf('## Boundary')
    writeFileSync(domain, `${source.slice(0, boundaryAt)}## Boundary\n\nEverything about orders, from cart to fulfilment.\n`)
    expect(run(cwd).errors.join('\n')).toContain(
      'ordering.md: "## Boundary" must state what the Domain does not own, not only what it covers'
    )
  })

  it('refuses an actors/ collection and names the replacement', () => {
    const cwd = fixtureCopy()
    writeResource(join(cwd, 'product-model/actors/shopper.md'), '---\nkind: person\n---\n\n# Shopper\n\nLead.\n')
    expect(run(cwd).errors.join('\n')).toContain(
      'actors/: there is no Actor resource type; move each file to entities/ and say how it acts with "kind" and "acts"'
    )
  })

  it('resolves configuredBy on a grant, and a threshold as one fact of one instance', () => {
    const cwd = fixtureCopy()
    const errorsWith = (frontmatter: string) => {
      writeRule(cwd, 'large-refunds-are-approved', frontmatter)
      return run(cwd).errors.join('\n')
    }
    const refund = (threshold: string) => `appliesTo:
  - type: entity
    id: order
    effect: changes
    to: Refunded
permits:
  - configuredBy: approval-policy
    when: [{ fact: Total charged, over: ${threshold} }]`
    const missing = errorsWith(refund('{ entity: approval-policy, fact: Limit }'))
    expect(missing).toContain('grant 1: "configuredBy" references missing entity "approval-policy"')
    expect(missing).toContain('condition 1: the threshold references missing entity "approval-policy"')
    expect(errorsWith(refund('{ entity: store-settings, fact: Limit }'))).toContain('the threshold\'s "Limit" is not a fact of entity "store-settings"')
    // Many Catalog products, and no one of them is the Order's.
    expect(errorsWith(refund('{ entity: catalog-product, fact: Price }'))).toContain('the threshold reads "catalog-product"')
    // The old shape named an Entity and no fact.
    expect(errorsWith(refund('{ configuredBy: store-settings }'))).toContain('needs a scalar or { entity: <entity-id>, fact: <fact name> }')
  })

  it('keys an entry point by the Interface type or another Interface id, never an unknown surface', () => {
    const cwd = fixtureCopy()
    const cli = join(cwd, 'product-model/interfaces/operator-cli.md')
    const source = readFileSync(cli, 'utf8')
    // A reader may arrive at the CLI's report from the admin site: another Interface's id is a valid key.
    writeFileSync(cli, source.replace('entryPoints:\n', 'entryPoints:\n  - admin-web: /admin/tools/cli\n'))
    expect(run(cwd).errors.filter(error => error.includes('entry point'))).toEqual([])

    writeFileSync(cli, source.replace('entryPoints:\n', 'entryPoints:\n  - kiosk: /kiosk\n'))
    expect(run(cwd).errors.join('\n')).toContain('operator-cli.md: entry point key "kiosk" must be this Interface\'s type "cli" or another Interface\'s id')
  })

  it('rejects unknown config keys', () => {
    const cwd = fixtureCopy()
    writeFileSync(
      join(cwd, 'product-model/config.yaml'),
      'schema: 7\nplatform:\n  url: https://attacker.example\nsdd:\n  paths: []\n'
    )
    expect(run(cwd).errors).toContain('config.yaml: unknown key "platform"')
  })

  it.each([null, [], 'undo', 1, true].map(lint => ({ lint })))('rejects a lint config that is not a mapping: $lint', ({ lint }) => {
    const cwd = fixtureCopy()
    writeFileSync(join(cwd, 'product-model/config.yaml'), stringify({ schema: 11, lint }))
    expect(run(cwd).errors).toContain('config.yaml: "lint" must be a mapping')
  })

  it.each([null, 'undo', {}, [1], [null], [true], [''], ['Undo'], ['undo-action'], ['un do'], ['undo\n']].map(verbs => ({ verbs })))(
    'rejects an invalid lint verb list: $verbs', ({ verbs }) => {
      const cwd = fixtureCopy()
      writeFileSync(join(cwd, 'product-model/config.yaml'), stringify({ schema: 11, lint: { verbs } }))
      expect(run(cwd).errors).toContain('config.yaml: lint "verbs" must be a list of lowercase alphabetic words')
    }
  )

  it('rejects unknown lint config keys', () => {
    const cwd = fixtureCopy()
    writeFileSync(join(cwd, 'product-model/config.yaml'), 'schema: 11\nlint:\n  extraVerbs: [undo]\n')
    expect(run(cwd).errors).toContain('config.yaml: lint has unknown key "extraVerbs"')
  })

  it.each([{}, { verbs: [] }])('accepts an empty lint config: %j', (lint) => {
    const cwd = fixtureCopy()
    writeFileSync(join(cwd, 'product-model/config.yaml'), stringify({ schema: 11, lint }))
    expect(run(cwd).errors).toEqual([])
  })

  it('rejects product ids longer than 64 characters', () => {
    const cwd = fixtureCopy()
    const product = join(cwd, 'product-model/product/product.md')
    writeFileSync(product, readFileSync(product, 'utf8').replace('id: fixture-shop', `id: ${'a'.repeat(65)}`))
    expect(run(cwd).errors).toContain('product.md: id must be at most 64 characters')
  })

  it('fails on dangling relations and missing required relationships', () => {
    const cwd = fixtureCopy()
    writeFileSync(join(cwd, 'product-model/journeys/browse-and-buy/journey.md'), `---
actors: [ghost]
---

# Browse and buy

## Goal

Buy something.

## Success criterion

An order exists.
`)
    const scenario = join(cwd, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md')
    writeFileSync(scenario, readFileSync(scenario, 'utf8').replace(
      'place: customer-web::storefront::product-record',
      'place: customer-web::missing-experience::product-record'
    ))
    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('references missing entity "ghost"')
    expect(errors).toContain('Context references missing place "customer-web::missing-experience::product-record"')
  })

  it('fails when a code reference points at an untracked file', () => {
    const result = run(fixtureCopy(), TRACKED.filter(file => file !== 'src/services/payments.ts'))
    expect(result.errors.some(error => error.includes('src/services/payments.ts'))).toBe(true)
  })

  it('allows missing references and known unmapped behavior without a status', () => {
    for (const unmapped of [[], [{ description: 'Subscription purchase code.', paths: ['src/subscriptions/'] }]]) {
      const cwd = fixtureCopy()
      editCoverage(join(cwd, 'product-model/coverage.md'), { unmapped, covered: [], ...unmapped.length ? {} : { scope: '', method: '' } })
      const journeyFile = join(cwd, 'product-model/journeys/browse-and-buy/journey.md')
      const scenarioFile = join(cwd, 'product-model/capabilities/refund-order/scenarios/refund-a-confirmed-order.md')
      const referenceBlock = /references:\n(?:  - kind: .*\n    role: .*\n    target: .*\n)+/
      writeFileSync(journeyFile, readFileSync(journeyFile, 'utf8').replace(referenceBlock, ''))
      writeFileSync(scenarioFile, readFileSync(scenarioFile, 'utf8').replace(referenceBlock, ''))
      const result = run(cwd)
      expect(result.errors).toEqual([])
      expect(result.warnings.some(warning => warning.includes('reference'))).toBe(false)
      rmSync(cwd, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('fails on duplicate ids across Scenario types', () => {
    const cwd = fixtureCopy()
    writeResource(join(cwd, 'product-model/journeys/browse-and-buy/scenarios/browse-catalog.md'), `---
kind: primary
result: achieved
routes:
  web: Web
steps:
  - text: Select a product
    kind: actor
    actor: shopper
    capability: browse-catalog
    contexts:
      web:
        place: customer-web::storefront::product-record
  - text: Complete checkout
    kind: actor
    actor: shopper
    capability: place-order
    contexts:
      web:
        place: customer-web::storefront::product-record
---

# Duplicate

## Trigger

t.

## Outcome

o.
`)
    expect(run(cwd).errors.some(error => error.includes('already used'))).toBe(true)
  })

  it('fails on a bad access mode', () => {
    const cwd = fixtureCopy()
    writeFileSync(join(cwd, 'product-model/interfaces/customer-web/experiences/storefront/experience.md'), `---
actors: [shopper]
interfaces: [customer-web]
access: secret
---

# Storefront

Lead.
`)
    expect(run(cwd).errors.some(error => error.includes('access "secret"'))).toBe(true)
  })

  it('fails when a Journey loses all achieved Journey Scenarios', () => {
    const cwd = fixtureCopy()
    unlinkSync(join(cwd, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md'))
    unlinkSync(join(cwd, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout-with-manual-confirmation.md'))
    expect(run(cwd).errors.some(error => error.includes('at least one achieved Journey Scenario'))).toBe(true)
  })

  it('warns on a missing repository-relative reference without failing', () => {
    const cwd = fixtureCopy()
    writeFileSync(join(cwd, 'product-model/entities/shopper.md'), shopperWith(`references:
  - kind: doc
    role: context
    target: docs/missing.md`))
    const result = run(cwd)
    expect(result.ok).toBe(true)
    expect(result.warnings.some(warning => warning.includes('docs/missing.md'))).toBe(true)
  })

  it('checks the local path behind a reference query or fragment', () => {
    const cwd = fixtureCopy()
    writeFileSync(join(cwd, 'product-model/entities/shopper.md'), shopperWith(`references:
  - kind: research
    role: context
    target: README.md?plain=1#method`))
    const result = run(cwd)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('rejects unsafe supporting-reference schemes', () => {
    const cwd = fixtureCopy()
    writeFileSync(join(cwd, 'product-model/entities/shopper.md'), shopperWith(`references:
  - kind: visual
    role: intent
    target: file:///tmp/screen.png`))
    expect(run(cwd).errors.join('\n')).toContain('must use HTTP(S) or a repository-relative path')
  })

  it('rejects duplicate reference targets on one resource', () => {
    const cwd = fixtureCopy()
    writeFileSync(join(cwd, 'product-model/entities/shopper.md'), shopperWith(`references:
  - kind: doc
    role: context
    target: https://example.com/same
  - kind: visual
    role: intent
    target: https://example.com/same`))
    expect(run(cwd).errors.join('\n')).toContain('duplicate reference target')
  })

  it('allows references on Product but not Coverage', () => {
    const cwd = fixtureCopy()
    const product = join(cwd, 'product-model/product/product.md')
    writeFileSync(product, readFileSync(product, 'utf8').replace(
      'limitations: []',
      'limitations: []\nreferences:\n  - kind: proposal\n    role: intent\n    target: https://example.com/product-direction'
    ))
    expect(run(cwd).errors).toEqual([])

    const coverage = join(cwd, 'product-model/coverage.md')
    editCoverage(coverage, { references: [] })
    expect(run(cwd).errors.join('\n')).toContain('Unrecognized key: "references"')
  })

  /*
   * Entity was added as a kind without joining the generic "for every resource"
   * lists, so its ids, References and assets went unchecked for a release. These
   * cover the checks an Entity now shares with every other resource.
   */
  it('checks an Entity like every other resource: ids, References and assets', () => {
    const cwd = fixtureCopy()
    const order = join(cwd, 'product-model/entities/order.md')
    const source = readFileSync(order, 'utf8')

    const withRefs = (block: string) => {
      writeFileSync(order, source.replace('domain: ordering', `domain: ordering\n${block}`))
      return run(cwd)
    }

    expect(withRefs(`references:
  - kind: doc
    role: context
    target: docs/nowhere.md`).warnings.join('\n'))
      .toContain('reference target "docs/nowhere.md" does not exist in the repository')

    expect(withRefs(`references:
  - kind: code
    role: implementation
    target: src/models/order.ts
  - kind: doc
    role: context
    target: src/models/order.ts`).errors.join('\n'))
      .toContain('duplicate reference target "src/models/order.ts"')

    expect(withRefs(`references:
  - kind: code
    role: implementation
    target: src/models/order.ts
    state: Pending`).errors.join('\n'))
      .toContain('reference has unknown key "state"')

    // The tracked code target is real, so a clean list is accepted.
    writeFileSync(order, source.replace('domain: ordering', `domain: ordering
references:
  - kind: code
    role: implementation
    target: src/models/order.ts`))
    expect(run(cwd).errors).toEqual([])

    writeFileSync(order, source)
    renameSync(order, join(cwd, 'product-model/entities/Order.md'))
    expect(run(cwd).errors.join('\n')).toContain('id "Order" must be lowercase kebab-case')
  })

  it('refuses a prose section that restates frontmatter on an Entity', () => {
    const cwd = fixtureCopy()
    const order = join(cwd, 'product-model/entities/order.md')
    for (const heading of ['Transitions', 'Relations']) {
      writeFileSync(order, `${readFileSync(order, 'utf8')}\n## ${heading}\n\nSomething restated in prose.\n`)
      expect(run(cwd).errors.join('\n')).toContain(`"## ${heading}" is not allowed on this resource type`)
      writeFileSync(order, readFileSync(order, 'utf8').replace(`\n## ${heading}\n\nSomething restated in prose.\n`, ''))
    }
  })

  /*
   * `cardinality: many` said only the target end, so an author who needed the
   * other one wrote the relationship twice facing itself — which is what the
   * Content Feed Reader Blueprint did.
   */
  it('takes both relation ends, and refuses the direction that would duplicate an encoding', () => {
    const cwd = fixtureCopy()
    const order = join(cwd, 'product-model/entities/order.md')
    const source = readFileSync(order, 'utf8')

    const withCardinality = (value: string) => {
      writeFileSync(order, source.replace('cardinality: many-to-many', `cardinality: ${value}`))
      return run(cwd)
    }

    expect(withCardinality('many').errors.join('\n'))
      .toContain('"cardinality" must be one-to-one, one-to-many, or many-to-many')
    expect(withCardinality('many-to-one').errors.join('\n'))
      .toContain('declare this relation on "catalog-product", where it reads one-to-many')
    for (const value of ['one-to-one', 'one-to-many', 'many-to-many']) {
      expect(withCardinality(value).errors).toEqual([])
    }
  })

  it('warns when two Entities declare relations at each other', () => {
    const cwd = fixtureCopy()
    const product = join(cwd, 'product-model/entities/catalog-product.md')
    writeFileSync(product, `---
relations:
  - entity: order
    verb: was ordered in
    cardinality: many-to-many
---

${readFileSync(product, 'utf8')}`)
    const result = run(cwd)
    expect(result.errors).toEqual([])
    expect(result.warnings.join('\n')).toContain('faces "was ordered in order"')
  })

  /*
   * A surface reached from another surface had nowhere to say so: an Interface
   * key had to equal its own type, so a web report opened by a command could
   * only record that in prose.
   */
  it('keys an Interface entry point by its own type or by another Interface', () => {
    const cwd = fixtureCopy()
    const file = join(cwd, 'product-model/interfaces/customer-web/interface.md')
    const source = readFileSync(file, 'utf8')
    const withKey = (key: string) => {
      writeFileSync(file, source.replace('entryPoints:\n', `entryPoints:\n  - ${key}: somewhere\n`))
      return run(cwd)
    }

    expect(withKey('operator-cli').errors).toEqual([])
    expect(withKey('customer-web').errors.join('\n'))
      .toContain('is this Interface\'s own id; use its type "web"')
    expect(withKey('nonsense').errors.join('\n'))
      .toContain('must be this Interface\'s type "web" or another Interface\'s id')
  })

  it('rejects unknown frontmatter keys', () => {
    const cwd = fixtureCopy()
    writeFileSync(join(cwd, 'product-model/domains/catalog.md'), `---
color: 3
---

# Catalog

Lead.
`)
    expect(run(cwd).errors.some(error => error.includes('unknown frontmatter key "color"'))).toBe(true)
  })

  /*
   * `permits` is checked for structure: every id resolves, every path walks one
   * unambiguous hop at a time onto an Entity that acts, and no grant is
   * impossible by construction. Nothing here claims a grant is satisfied.
   */
  it('checks a permission Rule for structure', () => {
    const cwd = fixtureCopy()
    const errorsWith = (frontmatter: string) => {
      writeRule(cwd, 'probe', frontmatter)
      return run(cwd).errors.join('\n')
    }

    expect(errorsWith(`appliesTo:
  - type: capability
    id: refund-order
permits:
  - actors: [store-admin]`)).toContain('"permits" needs Entity targets only')

    expect(errorsWith(`appliesTo:
  - type: entity
    id: refund
permits:
  - when: [{ fact: Amount, over: 10 }]`)).toContain('grant 1: names nobody')

    expect(errorsWith(`appliesTo:
  - type: entity
    id: refund
permits:
  - related: []`)).toContain('"related" is empty; the instance itself is "self: true"')

    expect(errorsWith(`appliesTo:
  - type: entity
    id: refund
permits:
  - related: [{ verb: belongs to, entity: order }]`)).toContain('no relation "belongs to" joins "refund" and "order" in either direction')

    expect(errorsWith(`appliesTo:
  - type: entity
    id: refund
permits:
  - related: [{ verb: is repaid by, entity: order }]`)).toContain('"related" ends on "order", which does not act')

    expect(errorsWith(`appliesTo:
  - type: entity
    id: refund
permits:
  - actors: [store-admin]
    related: [{ verb: is repaid by, entity: order }, { verb: owns, entity: shopper }]`)).toContain('"actors" excludes "shopper", where "related" ends; the grant can never be satisfied')

    expect(errorsWith(`appliesTo:
  - type: entity
    id: refund
permits:
  - related: [{ verb: is repaid by, entity: refund }]`)).toContain('walks "refund" to itself')

    expect(errorsWith(`appliesTo:
  - type: entity
    id: order
permits:
  - self: true`)).toContain('"self" needs entity "order" to act')

    expect(errorsWith(`appliesTo:
  - type: entity
    id: order
    effect: creates
permits:
  - actors: [shopper]
    when: [{ state: Pending }]`)).toContain('a "state" condition on a "creates" target; there is no instance yet')

    expect(errorsWith(`appliesTo:
  - type: entity
    id: order
permits:
  - actors: [shopper]
    when: [{ state: Shipped }, { fact: Weight, over: 1 }, { entity: store-settings, fact: Nope, is: true }]`))
      .toMatch(/"Shipped" is not a state of entity "order"[\s\S]*"Weight" is not a fact of entity "order"[\s\S]*"Nope" is not a fact of entity "store-settings"/)

    expect(errorsWith(`appliesTo:
  - type: entity
    id: order
permits:
  - actors: [shopper]
    when: [{ fact: Subtotal, over: 1, under: 2 }]`)).toContain('needs exactly one operator')

    expect(errorsWith(`appliesTo:
  - type: entity
    id: order
    effect: removes
    to: Cancelled
permits: []`)).toContain('"to" selects nothing on a "removes" target')

    expect(errorsWith(`appliesTo:
  - type: entity
    id: order
    effect: reads
    contexts:
      - place: customer-web::storefront::product-record
permits:
  - actors: [shopper]`)).toBe('')

    expect(errorsWith(`appliesTo:
  - type: entity
    id: order
  - type: entity
    id: refund
permits:
  - related: [{ verb: owns, entity: shopper }]
    when: [{ state: Pending }]`)).toMatch(/"related" needs exactly one Entity target[\s\S]*a "state" condition needs exactly one Entity target/)
  })

  it('walks a related path only where a hop is unambiguous', () => {
    const cwd = fixtureCopy()
    // A second relation with the same verb between the same pair, facing the other way.
    const refund = join(cwd, 'product-model/entities/refund.md')
    writeFileSync(refund, readFileSync(refund, 'utf8').replace('domain: ordering', `domain: ordering
relations:
  - entity: order
    verb: is repaid by
    cardinality: one-to-one`))
    expect(run(cwd).errors.join('\n')).toContain('"is repaid by" joins "refund" and "order" more than once; give one of them another verb')
  })

  /*
   * A condition naming another Entity reads one instance of it: the acting
   * one, the one on the related path, the one the target has through to-one
   * relations, or the Product's singleton settings. Anything else says nothing.
   */
  it('refuses a grant condition that could read any of many instances', () => {
    const cwd = fixtureCopy()
    const errorsWith = (frontmatter: string) => {
      writeRule(cwd, 'probe', frontmatter)
      return run(cwd).errors.filter(error => error.includes('probe')).join('\n')
    }
    const refundRule = (when: string) => `appliesTo:
  - type: entity
    id: refund
    effect: creates
permits:
  - actors: [store-admin]
    when: [${when}]`

    // refund → order → shopper, each hop to-one: the Shopper who owns the refunded Order.
    expect(errorsWith(refundRule('{ entity: shopper, fact: Delivery address, present: true }'))).toBe('')
    // The store's one settings instance, read from anywhere.
    expect(errorsWith(refundRule('{ entity: store-settings, fact: Refund approval threshold, present: true }'))).toBe('')
    // The acting Entity reads the instance acting.
    expect(errorsWith(refundRule('{ entity: store-admin, fact: Shift, present: true }'))).not.toContain('reads "store-admin"')
    // Order was placed for many Catalog products: no one of them is the refund's.
    expect(errorsWith(refundRule('{ entity: catalog-product, fact: Price, present: true }')))
      .toContain('reads "catalog-product", which is not the acting Entity, lies off the grant\'s "related" path and is not "singleton", and no to-one relation reaches it from "refund"')
    // A grant admitting two Entities fixes neither as the one acting.
    expect(errorsWith(`appliesTo:
  - type: entity
    id: catalog-product
    effect: changes
permits:
  - actors: [shopper, store-admin]
    when: [{ entity: shopper, fact: Delivery address, present: true }]`)).toContain('give "shopper" a grant of its own')
    // A condition on the governed thing names no entity.
    expect(errorsWith(refundRule('{ entity: refund, fact: Amount, present: true }'))).toContain('the Rule\'s own target')

    const settings = join(cwd, 'product-model/entities/store-settings.md')
    writeFileSync(settings, readFileSync(settings, 'utf8').replace('singleton: true', 'singleton: false'))
    expect(run(cwd).errors.join('\n')).toContain('"singleton" is true or absent')
    writeFileSync(settings, readFileSync(settings, 'utf8').replace('singleton: false', 'singleton: true\nacts: internal\nkind: system'))
    expect(run(cwd).errors.join('\n')).toContain('an Entity that acts is never "singleton"')
  })

  /*
   * A target selects a Step by the keys its `entities` entry carries; a grant
   * is possible for the Step's actor when every who-key it carries could be
   * that actor. Rules selecting one operation AND.
   */
  it('holds Steps to the Rules that govern them', () => {
    const cwd = fixtureCopy()
    const merge = join(cwd, 'product-model/capabilities/merge-orders/scenarios/merge-duplicate-orders.md')
    writeFileSync(merge, readFileSync(merge, 'utf8').replace(
      'as: duplicate, effect: changes, from: Pending, to: Cancelled',
      'as: duplicate, effect: changes, from: Refunded, to: Cancelled'
    ))
    expect(run(cwd).errors.join('\n')).toContain(
      'step 2: moves "order (duplicate)" from Refunded to Cancelled, which rule "a-refunded-order-is-never-cancelled" forbids to everyone'
    )

    writeRule(cwd, 'gateway-only', `appliesTo:
  - type: entity
    id: order
    effect: changes
    to: Refunded
permits:
  - actors: [payment-gateway]`)
    expect(run(cwd).errors.join('\n')).toContain(
      'actor "store-admin" moves "order" from Confirmed to Refunded, and no grant of rule "gateway-only" can permit it'
    )
    unlinkSync(join(cwd, 'product-model/business-rules/gateway-only.md'))

    const refund = join(cwd, 'product-model/capabilities/refund-order/scenarios/refund-a-confirmed-order.md')
    const source = readFileSync(refund, 'utf8')
    writeFileSync(refund, source.replace('    kind: product\n    actor: store-admin\n', '    kind: product\n'))
    expect(run(cwd).errors.join('\n')).toContain(
      'step 2: moves "order" from Confirmed to Refunded, which rule "who-may-change-an-order" governs, so it needs an actor'
    )
    writeFileSync(refund, source)

    const rule = join(cwd, 'product-model/business-rules/who-may-change-an-order.md')
    writeFileSync(rule, readFileSync(rule, 'utf8').replace('  - unattended: true\n    when: [{ state: Pending }]\n', ''))
    expect(run(cwd).errors.join('\n')).toContain(
      'moves "order" from Pending to Cancelled unattended, and rule "who-may-change-an-order" has no "unattended" grant for it'
    )
  })

  it('holds a Step with no contexts to the place-scoped Rules of its Scenario', () => {
    // A Step that omits `contexts` is shared by every route, so it happens
    // inside the Scenario's places. Reading it as happening nowhere would let
    // deleting a key walk out of an authorization claim.
    const cwd = fixtureCopy()
    const refund = join(cwd, 'product-model/capabilities/refund-order/scenarios/refund-a-confirmed-order.md')
    writeFileSync(refund, readFileSync(refund, 'utf8').replace(
      `      - { entity: refund, effect: creates, to: Requested, facts: [Amount, Reason] }
    contexts:
      web:
        place: admin-web::order-detail
      cli:
        place: operator-cli
`,
      '      - { entity: refund, effect: creates, to: Requested, facts: [Amount, Reason] }\n'
    ))
    expect(run(cwd).errors).toEqual([])

    writeRule(cwd, 'refunds-on-the-console-are-the-gateway', `appliesTo:
  - type: entity
    id: order
    effect: changes
    to: Refunded
    contexts:
      - place: admin-web::order-detail
permits:
  - actors: [payment-gateway]`)
    expect(run(cwd).errors.join('\n')).toContain(
      'actor "store-admin" moves "order" from Confirmed to Refunded, and no grant of rule "refunds-on-the-console-are-the-gateway" can permit it'
    )
  })

  it('warns on selectors that say nothing', () => {
    const cwd = fixtureCopy()
    writeRule(cwd, 'twin', `appliesTo:
  - type: entity
    id: order
    effect: removes
permits: []`)
    expect(run(cwd).warnings.join('\n')).toMatch(/twin\.md: selects exactly what .*orders-are-never-deleted\.md selects/)
    unlinkSync(join(cwd, 'product-model/business-rules/twin.md'))

    // A set of facts is one selector in any order.
    for (const [id, facts] of [['tax-and-margin', 'Tax, Margin'], ['margin-and-tax', 'Margin, Tax']] as const) {
      writeRule(cwd, id, `appliesTo:
  - type: entity
    id: order
    effect: reads
    facts: [${facts}]
permits:
  - actors: [store-admin]`)
    }
    expect(run(cwd).warnings.join('\n')).toMatch(/tax-and-margin\.md: selects exactly what .*margin-and-tax\.md selects/)
    for (const id of ['tax-and-margin', 'margin-and-tax']) unlinkSync(join(cwd, `product-model/business-rules/${id}.md`))

    writeRule(cwd, 'narrow', `appliesTo:
  - type: entity
    id: order
    effect: changes
    from: Confirmed
    to: Refunded
permits:
  - actors: [store-admin]
    when: [{ state: Confirmed }]`)
    const warnings = run(cwd).warnings.join('\n')
    expect(warnings).toContain('"from: Confirmed" is redundant; every Step it could select already leaves from it')
    expect(warnings).toContain('"state: Confirmed" is redundant; every selected Step already leaves from it')
  })

  it('keeps a Screen readable by somebody who reaches it', () => {
    const cwd = fixtureCopy()
    writeRule(cwd, 'gateway-reads', `appliesTo:
  - type: entity
    id: refund
    effect: reads
permits:
  - actors: [payment-gateway]`)
    expect(run(cwd).errors.join('\n')).toContain(
      'presents "refund", and no actor of "customer-web::storefront" has a grant to read it in rule "gateway-reads"'
    )

    writeRule(cwd, 'gateway-reads', `appliesTo:
  - type: entity
    id: refund
    effect: reads
permits: []`)
    expect(run(cwd).errors.join('\n')).toContain('presents "refund", which rule "gateway-reads" forbids anyone to read')
  })

  /*
   * The experience border: a Screen is relations only, its facts are the
   * Entity's own, and Screens never nest. Each rule below is decidable from the
   * folder alone.
   */
  describe('modelling checks the catalog review surfaced', () => {
    it('requires an achieved Journey Scenario to carry its own Actor through two Capabilities', () => {
      const cwd = fixtureCopy()
      const scenario = join(cwd, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md')
      // The shopper browses, then another Actor places the order: a hand-off carries nobody.
      writeFileSync(scenario, readFileSync(scenario, 'utf8').replace(
        '  - text: The shopper submits checkout\n    kind: actor\n    actor: shopper',
        '  - text: The shopper submits checkout\n    kind: actor\n    actor: store-admin'
      ))
      expect(run(cwd).errors).toContain(`${scenario}: an achieved Journey Scenario must carry one Journey Actor through at least two Capabilities; Steps of another Actor, or of another Journey Actor, do not add up`)
    })

    it('counts the Journey Actor\'s own Capabilities, so the golden Journeys pass', () => {
      const cwd = fixtureCopy()
      expect(run(cwd).errors.join('\n')).not.toContain('must carry one Journey Actor')
    })

    it('counts each Journey Actor apart, so two Actors using one Capability each carry nobody', () => {
      const cwd = fixtureCopy()
      const journey = join(cwd, 'product-model/journeys/browse-and-buy/journey.md')
      const scenario = join(cwd, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md')
      writeFileSync(journey, readFileSync(journey, 'utf8').replace('actors: [shopper]', 'actors: [shopper, payment-gateway]'))
      // The shopper browses, an admin places the order, the gateway settles it: one Capability per Journey Actor.
      writeFileSync(scenario, readFileSync(scenario, 'utf8').replace(
        '  - text: The shopper submits checkout\n    kind: actor\n    actor: shopper',
        '  - text: The shopper submits checkout\n    kind: actor\n    actor: store-admin'
      ))
      expect(run(cwd).errors.join('\n')).toContain(`${scenario}: an achieved Journey Scenario must carry one Journey Actor through at least two Capabilities`)
    })

    it('lets another Journey Actor take part while one Actor is carried through two Capabilities', () => {
      const cwd = fixtureCopy()
      const journey = join(cwd, 'product-model/journeys/browse-and-buy/journey.md')
      writeFileSync(journey, readFileSync(journey, 'utf8').replace('actors: [shopper]', 'actors: [shopper, payment-gateway]'))
      expect(run(cwd).errors.join('\n')).not.toContain('must carry one Journey Actor')
    })

    it('counts a Product Step attributed to the Journey Actor as theirs', () => {
      const cwd = fixtureCopy()
      const scenario = join(cwd, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md')
      writeFileSync(scenario, readFileSync(scenario, 'utf8').replace(
        '  - text: The shopper submits checkout\n    kind: actor\n    actor: shopper',
        '  - text: The shopper submits checkout\n    kind: product\n    actor: shopper'
      ))
      expect(run(cwd).errors.join('\n')).not.toContain('must carry one Journey Actor')
    })

    it('warns when a Capability Scenario opens with the opposite of its Capability\'s verb', () => {
      const cwd = fixtureCopy()
      const capabilities = join(cwd, 'product-model/capabilities')
      cpSync(join(capabilities, 'track-order'), join(capabilities, 'follow-order'), { recursive: true })
      renameSync(
        join(capabilities, 'follow-order/scenarios/check-an-order-and-its-refund.md'),
        join(capabilities, 'follow-order/scenarios/unfollow-an-order.md')
      )
      const file = join(capabilities, 'follow-order/scenarios/unfollow-an-order.md')
      expect(run(cwd).warnings).toContain(`${file}: opens with "unfollow" under Capability "follow-order", whose verb is "follow"; opposite verbs are separate Capabilities`)
    })

    const oppositeCase = (capabilityId: string, scenarioId: string) => {
      const cwd = fixtureCopy()
      const capabilities = join(cwd, 'product-model/capabilities')
      cpSync(join(capabilities, 'track-order'), join(capabilities, capabilityId), { recursive: true })
      const file = join(capabilities, `${capabilityId}/scenarios/${scenarioId}.md`)
      renameSync(join(capabilities, `${capabilityId}/scenarios/check-an-order-and-its-refund.md`), file)
      return { file, warnings: run(cwd).warnings }
    }

    it.each([
      ['assign-order', 'unassign-an-order', 'unassign', 'assign'],
      ['connect-order', 'disconnect-an-order', 'disconnect', 'connect'],
      ['tag-order', 'untag-an-order', 'untag', 'tag'],
      ['start-order', 'stop-an-order', 'stop', 'start'],
      ['share-order', 'stop-sharing-an-order', 'stop sharing', 'share'],
      ['mark-order-read', 'mark-an-order-unread', 'mark unread', 'mark read'],
      ['mark-order-unread', 'mark-an-order-read', 'mark read', 'mark unread']
    ])('warns on %s holding %s', (capabilityId, scenarioId, scenarioVerb, capabilityVerb) => {
      const { file, warnings } = oppositeCase(capabilityId, scenarioId)
      expect(warnings).toContain(`${file}: opens with "${scenarioVerb}" under Capability "${capabilityId}", whose verb is "${capabilityVerb}"; opposite verbs are separate Capabilities`)
    })

    it.each([
      ['share-order', 'stop-an-order'],
      ['mark-order-read', 'mark-an-order-read-in-bulk'],
      ['assign-order', 'review-an-order'],
      ['assign-order', 'assign-an-order-again']
    ])('stays quiet on %s holding %s', (capabilityId, scenarioId) => {
      expect(oppositeCase(capabilityId, scenarioId).warnings.join('\n')).not.toContain('opposite verbs are separate Capabilities')
    })

    it('leaves a Capability Scenario alone when its verb is not an opposite', () => {
      const cwd = fixtureCopy()
      const capabilities = join(cwd, 'product-model/capabilities')
      cpSync(join(capabilities, 'track-order'), join(capabilities, 'follow-order'), { recursive: true })
      expect(run(cwd).warnings.join('\n')).not.toContain('opposite verbs are separate Capabilities')
    })

    it.each(['manage', 'organize', 'handle', 'administer'])('warns on a Capability named with the umbrella verb "%s"', (verb) => {
      const cwd = fixtureCopy()
      const capabilities = join(cwd, 'product-model/capabilities')
      cpSync(join(capabilities, 'refund-order'), join(capabilities, `${verb}-orders`), { recursive: true })
      expect(run(cwd).warnings).toContain(
        `${join(capabilities, `${verb}-orders`, 'capability.md')}: capability id "${verb}-orders" leads with the umbrella verb "${verb}"; name each verb its controls show — opposite and distinct verbs are separate Capabilities`
      )
    })

    it('leaves the golden fixture, whose Capabilities each name one verb, without umbrella warnings', () => {
      expect(run(fixtureCopy()).warnings.join('\n')).not.toContain('umbrella verb')
    })

    it('warns when a grant admits any AI agent instead of the one a person connected', () => {
      const cwd = fixtureCopy()
      writeResource(join(cwd, 'product-model/entities/ai-agent.md'), '---\nkind: system\nacts: external\n---\n\n# AI agent\n\nAn AI agent harness a shopper connects.\n')
      writeRule(cwd, 'any-ai-agent-reads-orders', 'appliesTo:\n  - type: entity\n    id: order\n    effect: reads\npermits:\n  - actors: [ai-agent]')
      const rule = join(cwd, 'product-model/business-rules/any-ai-agent-reads-orders.md')
      expect(run(cwd).warnings).toContain(`${rule}: grant 1: grants "ai-agent" with no "related" path, which admits any AI agent; say whose AI agent it is through "related"`)
    })

    it('accepts an AI agent grant that walks to the person who connected it', () => {
      const cwd = fixtureCopy()
      writeResource(join(cwd, 'product-model/entities/ai-agent.md'), '---\nkind: system\nacts: external\n---\n\n# AI agent\n\nAn AI agent harness a shopper connects.\n')
      writeResource(join(cwd, 'product-model/entities/shopper.md'), shopperWith('  - entity: ai-agent\n    verb: connects\n    cardinality: one-to-many'))
      writeRule(cwd, 'their-ai-agent-reads-orders', 'appliesTo:\n  - type: entity\n    id: order\n    effect: reads\npermits:\n  - related:\n      - { verb: owns, entity: shopper }\n      - { verb: connects, entity: ai-agent }')
      const result = run(cwd)
      // The Rule now governs every read of an order; only its path is under test here.
      expect(result.errors.join('\n')).not.toContain('"related"')
      expect(result.warnings.join('\n')).not.toContain('admits any AI agent')
      expect(result.warnings.join('\n')).not.toContain('without passing a person')
    })

    it('warns when an AI agent grant names the agent but never the person it acts for', () => {
      const cwd = fixtureCopy()
      writeResource(join(cwd, 'product-model/entities/ai-agent.md'), '---\nkind: system\nacts: external\nrelations:\n  - entity: order\n    verb: leaves\n    cardinality: one-to-many\n---\n\n# AI agent\n\nAn AI agent harness a shopper connects.\n')
      writeRule(cwd, 'the-agent-that-left-it-reads-an-order', 'appliesTo:\n  - type: entity\n    id: order\n    effect: reads\npermits:\n  - related:\n      - { verb: leaves, entity: ai-agent }')
      const rule = join(cwd, 'product-model/business-rules/the-agent-that-left-it-reads-an-order.md')
      expect(run(cwd).warnings).toContain(`${rule}: grant 1: reaches "ai-agent" without passing a person; walk "related" through the person who connected the agent`)
    })

    it('warns when a permission Rule names no effect', () => {
      const cwd = fixtureCopy()
      writeRule(cwd, 'only-a-shopper-handles-a-cart', 'appliesTo:\n  - type: entity\n    id: cart\npermits:\n  - actors: [shopper]')
      const rule = join(cwd, 'product-model/business-rules/only-a-shopper-handles-a-cart.md')
      expect(run(cwd).warnings).toContain(`${rule}: target "entity:cart" names no "effect"; each operation gets its own permission Rule naming its effect`)
    })

    it('warns when an Actor changes an Entity whose other changes the Rules govern', () => {
      const cwd = fixtureCopy()
      // Creating a cart is governed; removing it at checkout is not.
      writeRule(cwd, 'only-a-shopper-creates-a-cart', 'appliesTo:\n  - type: entity\n    id: cart\n    effect: creates\npermits:\n  - actors: [shopper]')
      expect(run(cwd).warnings.join('\n')).toContain('"shopper" removes "cart", which no permission Rule selects')
    })

    it('counts a Product Step attributed to an Actor as that Actor\'s change', () => {
      const cwd = fixtureCopy()
      writeRule(cwd, 'only-a-shopper-creates-a-cart', 'appliesTo:\n  - type: entity\n    id: cart\n    effect: creates\npermits:\n  - actors: [shopper]')
      // Every Step that empties the cart becomes a Product Step attributed to the shopper.
      const files = [
        'capabilities/place-order/scenarios/sell-the-last-available-unit.md',
        'capabilities/place-order/scenarios/complete-checkout-without-review.md',
        'capabilities/place-order/scenarios/complete-checkout.md',
        'journeys/browse-and-buy/scenarios/cancel-an-order-before-fulfilment.md',
        'journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md',
        'journeys/browse-and-buy/scenarios/browse-and-complete-checkout-with-manual-confirmation.md',
        'journeys/browse-buy-and-track/scenarios/buy-and-follow-the-order.md'
      ].map(file => join(cwd, 'product-model', file))
      for (const file of files) {
        const steps = readFileSync(file, 'utf8').split('\n  - text:')
        writeFileSync(file, steps.map(step => step.includes('entity: cart, effect: removes')
          ? step.replace('    kind: actor\n', '    kind: product\n')
          : step).join('\n  - text:'))
      }
      const warnings = run(cwd).warnings.join('\n')
      expect(warnings).toContain('"shopper" removes "cart", which no permission Rule selects')
    })

    it('stays quiet once a Rule says who may make that change', () => {
      const cwd = fixtureCopy()
      writeRule(cwd, 'only-a-shopper-creates-a-cart', 'appliesTo:\n  - type: entity\n    id: cart\n    effect: creates\npermits:\n  - actors: [shopper]')
      writeRule(cwd, 'only-a-shopper-empties-a-cart', 'appliesTo:\n  - type: entity\n    id: cart\n    effect: removes\npermits:\n  - actors: [shopper]')
      expect(run(cwd).warnings.join('\n')).not.toContain('which no permission Rule selects')
    })

    it('warns when a Product limitation speaks about the model', () => {
      const cwd = fixtureCopy()
      const product = join(cwd, 'product-model/product/product.md')
      writeFileSync(product, readFileSync(product, 'utf8').replace('limitations: []', 'limitations: ["Gift cards are not modeled."]'))
      expect(run(cwd).warnings).toContain('product.md: limitation "Gift cards are not modeled." speaks about the model; state the product fact instead, such as what the Product leaves to other systems')
    })

    it('accepts a limitation that states a product constraint', () => {
      const cwd = fixtureCopy()
      const product = join(cwd, 'product-model/product/product.md')
      writeFileSync(product, readFileSync(product, 'utf8').replace('limitations: []', 'limitations: ["Gift cards cannot be bought."]'))
      expect(run(cwd).warnings.join('\n')).not.toContain('speaks about the model')
    })

    it('accepts a limitation about a language model\'s provider', () => {
      const cwd = fixtureCopy()
      const product = join(cwd, 'product-model/product/product.md')
      writeFileSync(product, readFileSync(product, 'utf8').replace('limitations: []', 'limitations: ["No customer data is retained in the model provider\'s logs."]'))
      expect(run(cwd).warnings.join('\n')).not.toContain('speaks about the model')
    })
  })

  describe('places, facts and variation', () => {
    const PRODUCT_RECORD = 'product-model/interfaces/customer-web/experiences/storefront/screens/product-record.md'
    const screenSource = (entities: string) => `---
entities:
${entities}
entryPoints:
  - customer-web: /products/:id
---

# Product record

Lead.
`

    it('refuses a Screen nested inside a Screen, and navigation on a container', () => {
      const cwd = fixtureCopy()
      const compact = join(cwd, PRODUCT_RECORD)
      const parent = join(cwd, 'product-model/interfaces/customer-web/experiences/storefront/screens/product-record/screen.md')
      expandResource(compact, parent)
      writeResource(join(cwd, 'product-model/interfaces/customer-web/experiences/storefront/screens/product-record/screens/reviews.md'), `---
entities:
  - { entity: catalog-product, shows: [Price] }
---

# Reviews

What other shoppers said, a tab of the product record.
`)
      mkdirSync(join(cwd, 'product-model/interfaces/customer-web/experiences/storefront/screens/product-record/notes'))
      const errors = run(cwd).errors
      expect(errors).toContain(
        'interfaces/customer-web/experiences/storefront/screens/product-record/screens/: Screens never nest; fold each child into product-record (its facts into entities, its Steps onto product-record) or place it beside product-record when it has a subject of its own'
      )
      /* A child that is not a Screen folder is still refused. */
      expect(errors).toContain(
        'interfaces/customer-web/experiences/storefront/screens/product-record/notes/ is not a recognized child directory'
      )

      const settled = fixtureCopy()
      const experience = join(settled, 'product-model/interfaces/customer-web/experiences/storefront/experience.md')
      writeFileSync(experience, readFileSync(experience, 'utf8').replace('access: public', 'access: public\nnavigation: [product-record]'))
      expect(run(settled).errors).toContain(`${experience}: unknown frontmatter key "navigation"`)
    })

    it('checks every fact a Screen or Step cites against the Entity, and requires facts on every Screen entry', () => {
      const cwd = fixtureCopy()
      writeFileSync(join(cwd, PRODUCT_RECORD), screenSource('  - { entity: catalog-product, shows: [Price] }\n  - order'))
      const scenario = join(cwd, 'product-model/capabilities/browse-catalog/scenarios/browse-catalog.md')
      writeFileSync(scenario, readFileSync(scenario, 'utf8').replace(
        '  - text: The shopper opens a product page\n    kind: actor\n    actor: shopper\n    entities:\n      - { entity: catalog-product, effect: reads, facts: [Name and description, Price, Stock remaining] }',
        '  - text: The shopper opens a product page\n    kind: actor\n    actor: shopper\n    entities:\n      - { entity: catalog-product, effect: reads, facts: [Stock remaining, Colour] }'
      ))
      const errors = run(cwd).errors.join('\n')
      expect(errors).toContain(`${join(cwd, PRODUCT_RECORD)}: presents "order" without naming its facts; a Screen says which facts it shows or collects`)
      expect(errors).toContain('step 2: "Colour" is not a fact of entity "catalog-product"')
      expect(errors).toContain('step 2: reads "Stock remaining" of "catalog-product" on Screen "customer-web::storefront::product-record", which does not show that fact')
    })

    it('allows named facts on creation', () => {
      const cwd = fixtureCopy()
      const scenario = join(cwd, 'product-model/capabilities/place-order/scenarios/complete-checkout.md')
      writeFileSync(scenario, readFileSync(scenario, 'utf8').replace(
        '- { entity: order, effect: creates, to: Pending, facts: [Items ordered, Delivery details, Subtotal, Tax, Discount, Total charged, Margin, When placed] }',
        '- { entity: order, effect: creates, to: Pending, facts: [Total charged] }'
      ))
      expect(run(cwd).errors).toEqual([])
    })

    it('requires what an Actor reads on a Screen to be presented there, and nothing else', () => {
      const cwd = fixtureCopy()
      writeFileSync(join(cwd, PRODUCT_RECORD), screenSource('  - { entity: catalog-product, shows: [Price] }'))
      const errors = run(cwd).errors.join('\n')
      // The shopper submits checkout reading the cart on this Screen.
      expect(errors).toContain('reads "cart" on Screen "customer-web::storefront::product-record", which does not present it')
      // The Product asking the payment gateway is not a claim about the screen.
      expect(errors).not.toContain('reads "payment-gateway" on Screen')
      expect(errors).not.toContain('reads "catalog-product" on Screen')
    })

    it('rejects authored Screen Capabilities', () => {
      const cwd = fixtureCopy()
      const catalog = join(cwd, 'product-model/interfaces/customer-web/screens/catalog.md')
      writeFileSync(catalog, readFileSync(catalog, 'utf8').replace('entities:', 'capabilities: [browse-catalog]\nentities:'))
      expect(run(cwd).errors.join('\n')).toContain('unknown frontmatter key "capabilities"')
    })

    it('allows a Capability with container-level placement beside modeled Screens', () => {
      const cwd = fixtureCopy()
      // Cancel order is available on the storefront; its Steps use that
      // container, without claiming a Screen. No reverse coverage obligation.
      const model = loadModel(cwd)
      for (const scenario of [...model.capabilityScenarios, ...model.journeyScenarios]) {
        for (const step of scenario.steps) {
          if (('capability' in scenario ? scenario.capability : step.capability) !== 'cancel-order') continue
          for (const context of Object.values(step.contexts)) {
            const screen = model.screens.find(item => item.id === context.place)
            if (screen) context.place = screen.containerId
          }
        }
      }
      for (const screen of model.screens) screen.capabilities = screen.capabilities.filter(id => id !== 'cancel-order')
      expect(lintModel(model, TRACKED).errors).toEqual([])
    })

    it('checks a fact-scoped read Rule against the facts on screen and the facts a Step cites', () => {
      const cwd = fixtureCopy()
      /* A prohibition remains valid without a modeled example. */
      writeResource(join(cwd, 'product-model/entities/voucher.md'), `---
{}
---

# Voucher

Lead.

## Information kept

- **Code** — what the shopper types to redeem it
`)
      const checkout = join(cwd, 'product-model/capabilities/place-order/scenarios/complete-checkout.md')
      writeFileSync(checkout, readFileSync(checkout, 'utf8').replace(
        '      - { entity: shopper, effect: changes, facts: [Delivery address] }',
        '      - { entity: shopper, effect: changes, facts: [Delivery address] }\n      - { entity: voucher, facts: [] }'
      ))
      writeRule(cwd, 'codes-are-secret', `appliesTo:
  - type: entity
    id: voucher
    facts: [Code]
permits:
  - actors: [store-admin]`)
      const unseen = `${join(cwd, 'product-model/business-rules/codes-are-secret.md')}: appliesTo item 1: governs "Code" of "voucher", which no Screen presents and no Step cites`
      expect(run(cwd).errors).toEqual([])

      /* Citing the fact on the Step selects it, and the shopper has no grant. */
      writeFileSync(checkout, readFileSync(checkout, 'utf8').replace('      - { entity: voucher, facts: [] }', '      - { entity: voucher, facts: [Code] }'))
      const cited = run(cwd).errors
      expect(cited).not.toContain(unseen)
      expect(cited.join('\n')).toContain('actor "shopper" changes "voucher", and no grant of rule "codes-are-secret" can permit it')

      /* A Screen listing the fact is selected; a bare entry is not. */
      writeFileSync(join(cwd, PRODUCT_RECORD), screenSource('  - { entity: catalog-product, shows: [Price] }\n  - { entity: cart, shows: [Quantity chosen] }\n  - { entity: voucher, shows: [Code] }'))
      expect(run(cwd).errors.join('\n')).toContain(
        'presents "voucher" facts "Code", and no actor of "customer-web::storefront" has a grant to read it in rule "codes-are-secret"'
      )
      writeFileSync(join(cwd, PRODUCT_RECORD), screenSource('  - { entity: catalog-product, shows: [Price] }\n  - { entity: cart, shows: [Quantity chosen] }\n  - voucher'))
      const bare = run(cwd).errors.join('\n')
      expect(bare).toContain('presents "voucher" without naming its facts')
      expect(bare).not.toContain('has a grant to read it in rule "codes-are-secret"')
    })

    it('accepts a scoped read prohibition without disclosing the forbidden fact', () => {
      const cwd = fixtureCopy()
      writeRule(cwd, 'margin-is-secret', `appliesTo:
  - type: entity
    id: order
    effect: reads
    facts: [Margin]
    contexts:
      - place: customer-web::storefront
permits:
  - actors: [store-admin]`)
      expect(run(cwd).errors).toEqual([])
    })

    it('checks language tags and narrows them from the Product to an Interface', () => {
      const cwd = fixtureCopy()
      // The fixture serves English and German, with the admin console English-only.
      expect(run(cwd).errors.filter(error => error.includes('language'))).toEqual([])
      const product = join(cwd, 'product-model/product/product.md')
      const admin = join(cwd, 'product-model/interfaces/admin-web/interface.md')
      writeFileSync(product, readFileSync(product, 'utf8').replace('languages: [en, de]\n', ''))
      writeFileSync(admin, readFileSync(admin, 'utf8').replace('languages: [en]\n', ''))
      const productInterface = join(cwd, 'product-model/interfaces/customer-web/interface.md')
      writeFileSync(productInterface, readFileSync(productInterface, 'utf8').replace('type: web', 'type: web\nlanguages: [en, de-DE]'))
      expect(run(cwd).errors).toContain(`${productInterface}: lists languages, and product.md declares none`)

      writeFileSync(product, readFileSync(product, 'utf8').replace('tags:', 'languages: [en, English]\ntags:'))
      const errors = run(cwd).errors
      expect(errors).toContain('product.md: language "English" is not a language tag like "en" or "pt-BR"')
      expect(errors).toContain(`${productInterface}: language "de-DE" is not one of the Product's languages`)
      expect(errors.some(error => error.includes('language "en"'))).toBe(false)
    })

    it('rejects Experience version metadata', () => {
      const cwd = fixtureCopy()
      const file = join(cwd, 'product-model/interfaces/customer-web/experiences/storefront/experience.md')
      writeFileSync(file, readFileSync(file, 'utf8').replace('access: public', 'access: public\nversion: v2'))
      expect(run(cwd).errors.join('\n')).toContain('unknown frontmatter key "version"')
    })
  })
})

describe('a removal that goes with another', () => {
  const CHECKOUT = 'product-model/capabilities/place-order/scenarios/complete-checkout.md'
  const CART_LINE = '      - { entity: cart, effect: removes }\n'
  /* An earlier order and one of its refunds, removed in one Step: Order declares
     a one-to-many relation to Refund, so the refund is the one that is held. */
  const EARLIER = '      - { entity: order, as: earlier, effect: removes, from: Pending }\n'
  const REFUND = '      - { entity: refund, effect: removes, from: Requested'
  function withCart(cwd: string, replacement: string): string {
    const file = join(cwd, CHECKOUT)
    const source = readFileSync(file, 'utf8')
    expect(source).toContain(CART_LINE)
    writeFileSync(file, source.replace(CART_LINE, `${CART_LINE}${replacement}`))
    return file
  }

  it('warns when one Step removes a thing and what it holds and neither says it goes with the other', () => {
    const cwd = fixtureCopy()
    const file = withCart(cwd, `${EARLIER}${REFUND} }\n`)
    expect(run(cwd).warnings.join('\n')).toContain(`${file}: step 5: removes "refund" alongside "earlier", which holds it; say "refund" goes "with" "earlier"`)
  })

  it('accepts a removal that goes with the thing that holds it', () => {
    const cwd = fixtureCopy()
    withCart(cwd, `${EARLIER}${REFUND}, with: earlier }\n`)
    const result = run(cwd)
    expect(result.errors.join('\n')).not.toContain('"with"')
    expect(result.warnings.join('\n')).not.toContain('alongside')
  })

  it('refuses the reverse direction, and a relation that holds nothing', () => {
    const cwd = fixtureCopy()
    const file = withCart(cwd, '      - { entity: order, as: earlier, effect: removes, from: Pending, with: refund }\n' + `${REFUND} }\n`)
    expect(run(cwd).errors.join('\n')).toContain(`${file}: step 5: "earlier" goes "with" "refund", but "refund" declares no one-to-many or one-to-one relation to "order"; a removal goes with the thing that holds it, so "refund" goes "with" "earlier"`)
    const manyToMany = fixtureCopy()
    const other = join(manyToMany, CHECKOUT)
    writeFileSync(other, readFileSync(other, 'utf8').replace(CART_LINE, `${CART_LINE}      - { entity: catalog-product, effect: removes, from: Available, with: cart }\n`))
    expect(run(manyToMany).errors.join('\n')).toContain('"catalog-product" goes "with" "cart", but "cart" declares no one-to-many or one-to-one relation to "catalog-product"')
  })

  it('needs a self-relation for two removals of the same Entity', () => {
    const cwd = fixtureCopy()
    const file = withCart(cwd, '      - { entity: refund, as: original, effect: removes, from: Requested }\n      - { entity: refund, as: follow-up, effect: removes, from: Requested, with: original }\n')
    expect(run(cwd).errors.join('\n')).toContain(`${file}: step 5: "follow-up" goes "with" "original", but "refund" declares no one-to-many or one-to-one relation to "refund"`)
    const related = fixtureCopy()
    const refund = join(related, 'product-model/entities/refund.md')
    writeFileSync(refund, readFileSync(refund, 'utf8').replace('domain: ordering\n', 'domain: ordering\nrelations:\n  - entity: refund\n    verb: is followed by\n    cardinality: one-to-many\n'))
    withCart(related, '      - { entity: refund, as: original, effect: removes, from: Requested }\n      - { entity: refund, as: follow-up, effect: removes, from: Requested, with: original }\n')
    expect(run(related).errors).toEqual([])
  })

  it('refuses "with" outside a creation or removal, or naming no entry of the same effect, and keeps the entry', () => {
    const cwd = fixtureCopy()
    withCart(cwd, '      - { entity: refund, effect: removes, from: Requested, with: basket }\n')
    expect(run(cwd).errors.join('\n')).toContain('"refund" goes "with" "basket", which names no other "removes" entry of this Step')
    const second = fixtureCopy()
    const order = join(second, CHECKOUT)
    writeFileSync(order, readFileSync(order, 'utf8').replace('to: Pending, facts: [Items ordered', 'to: Pending, with: cart, facts: [Items ordered'))
    const errors = run(second).errors.join('\n')
    // The cart is removed, not created, so the new order cannot go with it.
    expect(errors).toContain('"order" goes "with" "cart", which names no other "creates" entry of this Step')
    // The order entry survives the unresolved key, so nothing reports it missing from the Step.
    expect(errors).not.toMatch(/step 5: .*"order"[^\n]*not listed|names "Order"/)
    const third = fixtureCopy()
    const changed = join(third, CHECKOUT)
    writeFileSync(changed, readFileSync(changed, 'utf8').replace('{ entity: shopper, effect: changes, facts: [Delivery address] }', '{ entity: shopper, effect: changes, facts: [Delivery address], with: cart }'))
    expect(run(third).errors.join('\n')).toContain('"with" belongs on a "creates" or "removes" entry; only a creation or a removal goes with another')
  })

  it('refuses two entries of a Step with one name', () => {
    const cwd = fixtureCopy()
    const file = withCart(cwd, '      - { entity: refund, as: cart, effect: removes, from: Requested }\n')
    expect(run(cwd).errors.join('\n')).toContain(`${file}: step 5: two entries are named "cart"; give each its own "as" so every entry of a Step has one name`)
  })

  it('refuses a "with" chain that returns to where it started', () => {
    const cwd = fixtureCopy()
    withCart(cwd, '      - { entity: order, as: earlier, effect: removes, from: Pending, with: refund }\n' + `${REFUND}, with: earlier }\n`)
    expect(run(cwd).errors.join('\n')).toContain('returns to where it started; one entry must be what the others go with')
  })

  it('lets the removal it goes with carry the permission', () => {
    const cwd = fixtureCopy()
    writeRule(cwd, 'refunds-are-never-removed', 'appliesTo:\n  - type: entity\n    id: refund\n    effect: removes\npermits: []')
    withCart(cwd, `${EARLIER}${REFUND} }\n`)
    expect(run(cwd).errors.join('\n')).toContain('which rule "refunds-are-never-removed" forbids to everyone')
    const second = fixtureCopy()
    writeRule(second, 'refunds-are-never-removed', 'appliesTo:\n  - type: entity\n    id: refund\n    effect: removes\npermits: []')
    withCart(second, `${EARLIER}${REFUND}, with: earlier }\n`)
    expect(run(second).errors.join('\n')).not.toContain('"refunds-are-never-removed" forbids')
  })

  /* A new Order's first Refund is unusual, but it is the shape: created because
     the Order is, in the same Step, so only creating the Order needs a grant. */
  it('lets the creation it goes with carry the permission, and warns when it is unsaid', () => {
    const ORDER = '      - { entity: order, effect: creates, to: Pending, facts: [Items ordered, Delivery details, Subtotal, Tax, Discount, Total charged, Margin, When placed] }\n'
    const FIRST_REFUND = '      - { entity: refund, effect: creates, to: Requested, facts: [Amount]'
    const forbid = 'appliesTo:\n  - type: entity\n    id: refund\n    effect: creates\npermits: []'
    const withRefund = (cwd: string, entry: string) => {
      const file = join(cwd, CHECKOUT)
      writeFileSync(file, readFileSync(file, 'utf8').replace(ORDER, ORDER + entry))
    }
    const cwd = fixtureCopy()
    writeRule(cwd, 'refunds-are-never-created', forbid)
    withRefund(cwd, `${FIRST_REFUND} }\n`)
    const unsaid = run(cwd)
    expect(unsaid.errors.join('\n')).toMatch(/complete-checkout\.md: step 5: creates "refund"[^\n]*"refunds-are-never-created" forbids to everyone/)
    expect(unsaid.warnings.join('\n')).toContain('creates "refund" alongside "order", which holds it; say "refund" goes "with" "order"')
    const second = fixtureCopy()
    writeRule(second, 'refunds-are-never-created', forbid)
    withRefund(second, `${FIRST_REFUND}, with: order }\n`)
    const said = run(second)
    // Refunds created by other Scenarios still meet the Rule; this one goes with its Order.
    expect(said.errors.join('\n')).not.toMatch(/complete-checkout\.md: step 5: creates "refund"/)
    expect(said.warnings.join('\n')).not.toContain('alongside "order"')
  })
})

describe('Coverage records which code the model accounts for', () => {
  it('errors on a Coverage entry that names no code', () => {
    const cwd = fixtureCopy()
    const file = join(cwd, 'product-model/coverage.md')
    editCoverage(file, { exclusions: [{ description: 'Payroll code.', paths: [] }] })
    expect(run(cwd).errors.join('\n')).toContain('coverage.md: exclusions.0.paths: A Coverage entry names the code it is about; give it at least one path')
  })

  it('accepts empty coverage for a model tied to no code, scope and method included', () => {
    const cwd = fixtureCopy()
    const file = join(cwd, 'product-model/coverage.md')
    editCoverage(file, { scope: '', method: '', covered: [], exclusions: [], unmapped: [], limitations: [] })
    expect(run(cwd).errors.filter(error => error.startsWith('coverage.md'))).toEqual([])
  })

  it('errors on a scope or method that no Coverage entry backs', () => {
    const cwd = fixtureCopy()
    const file = join(cwd, 'product-model/coverage.md')
    editCoverage(file, { scope: 'The storefront.', method: 'Static inspection.', covered: [], exclusions: [], unmapped: [], limitations: [] })
    const errors = run(cwd).errors.join('\n')
    expect(errors).toContain('coverage.md: scope: A scope with no Coverage entry claims code nothing records')
    expect(errors).toContain('coverage.md: method: A method with no Coverage entry claims code nothing records')
  })

  it('requires a scope once coverage records code', () => {
    const cwd = fixtureCopy()
    const file = join(cwd, 'product-model/coverage.md')
    editCoverage(file, { scope: '' })
    expect(run(cwd).errors.join('\n')).toContain('coverage.md: scope: Scope is required once Coverage records code')
  })
})
