# Contributing to InkDoze

Bug reports, device corrections, translations, documentation and code are welcome. The project's conduct standards apply to all contributions. [Code of Conduct](CODE_OF_CONDUCT.md)

## Report a problem

For an app issue, include the steps to reproduce it, the expected result, the browser version and the selected reader. If a specific file triggers the problem, describe its format and dimensions. A sample you can share publicly is useful. [Open a bug report](https://github.com/0then0/inkdoze/issues/new?template=bug_report.yml)

Report vulnerabilities privately. [Security policy](SECURITY.md)

## Adding or correcting an e-reader

Include the brand, exact model, generation or regional variant, native portrait resolution and the source for each claim. For an installation method, include the firmware version and a source that covers the device. [Catalog contribution guide](docs/device-catalog.md#add-or-correct-an-e-reader) · [Open a catalog issue](https://github.com/0then0/inkdoze/issues/new?template=device.yml)

## Code and documentation

Set up a checkout with the instructions in the development guide. Run `npm run check` before opening a pull request. Run the relevant Playwright tests for changes to the UI, file formats or translations. In the pull request, describe what changed and list the checks you ran. [Local development and tests](docs/development.md)

Keep image processing local. The page and image workers handle user files. Network access for offline preparation belongs to the service worker and is limited to static app files. Test binary format changes with an independent reader. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

## Translations

Add each new message key to every locale. Preserve placeholders such as `{menu}` and keep literal firmware menu names, folder names and file names intact. Write natural UI text in the target language. [Locale files](src/i18n/locales)

Run `npm test` to check message keys, placeholders and plural forms, then run `npm run test:e2e -- e2e/locales.spec.ts` to check desktop, tablet and phone layouts.
