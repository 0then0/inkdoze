# Security Policy

## Supported versions

Only the latest release and the `main` branch receive fixes.

## Reporting a vulnerability

Submit vulnerability reports privately through GitHub. Include the affected version, browser, steps to reproduce and a sample file if available. [Report a vulnerability](https://github.com/0then0/inkdoze/security/advisories/new)

You can expect an acknowledgement within a week. Once a fix is ready we will publish an advisory and credit you unless you prefer otherwise.

## Scope

InkDoze processes untrusted image files in the browser. Reports may cover issues such as the following.

- Exposure of image data, file names or metadata.
- Crafted files that bypass the size and pixel limits or exhaust memory before the limits apply.
- Malformed output (BMP, ZIP) that could harm the software reading it on an e-reader.
- Script injection through file names, catalog data or translations.

Bugs in browsers' own image decoders should be reported to the browser vendor.
