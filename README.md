<p align="center">
  <img src="docs/icon.svg" width="96" height="96" alt="InkDoze icon: an e-reader with a crescent moon on its screen">
</p>

<h1 align="center">InkDoze</h1>

<p align="center">
  <a href="https://github.com/0then0/inkdoze/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/0then0/inkdoze/ci.yml?branch=main&amp;label=CI" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/0then0/inkdoze" alt="License: Apache-2.0"></a>
</p>

InkDoze turns images into sleep screens for e-readers. It sizes and adjusts each image for the selected screen and shows the model's documented installation options. Image processing runs in your browser.

**[Open InkDoze](https://0then0.github.io/inkdoze/)**

## How to use

1. Select **Add images** or drop PNG, JPEG, WebP or supported HEIC files onto the page.
2. Choose your e-reader by model or resolution, or select **Custom size**.
3. Download an image or a ZIP of the batch. See **How to install** for the selected model's instructions.

You can adjust an entire batch or a single image, save and transfer processing profiles, and prepare InkDoze to reopen offline. Compatible devices also get a Kindle cover EPUB or a CrossPoint transparent overlay option. [User guide](docs/user-guide.md)

## Documentation

- Check how models, resolutions and installation methods are sourced. [Device catalog](docs/device-catalog.md)
- Check supported inputs, export formats and HEIC colour handling. [Image processing](docs/image-processing.md)
- Set up a checkout, run the tests or serve the static build. [Development and hosting](docs/development.md)
- See what changed in each release. [Changelog](CHANGELOG.md)

## Run locally

Use Node.js 24 and npm to match CI. In the checkout, run the following commands.

```sh
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173/).

## Contributing

Contributions include bug reports, device corrections, translations, documentation and code. [Contribution guide](CONTRIBUTING.md) · [Code of conduct](CODE_OF_CONDUCT.md) · [Security policy](SECURITY.md)

## License

[Apache License 2.0](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.txt)
