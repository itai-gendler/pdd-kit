import { defineConfig } from 'tsdown'

export default defineConfig({
  // `report` is the published library entry the report viewer layer imports by
  // package name; it carries type declarations because Nuxt hosts outside this
  // repository compile against it.
  entry: {
    cli: 'src/cli.ts',
    // Run detached by the CLI to look for a newer release.
    'update-check': 'src/update-check.ts',
    report: 'src/report.ts',
    'report-digest': 'src/report-digest.ts',
    'report-selectors': 'src/report-selectors.ts',
    'report-compare': 'src/report-compare.ts',
    logo: 'src/logo.ts',
    pddKitThemeLabVariants: 'layers/nuxt/theme-lab/app/utils/pddKitThemeLabVariants.ts'
  },
  format: 'esm',
  platform: 'node',
  // Keep the CLI and library bundles within the release tarball's size budget.
  minify: true,
  dts: true,
  // The package is `type: module`, so plain `.js` and `.d.ts` are ESM; the
  // `bin` and `exports` paths name them.
  fixedExtension: false,
  clean: true
})
