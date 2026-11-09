# Security Policy

## Supported versions

Only the latest release and the `main` branch receive fixes.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's [private vulnerability reporting](https://github.com/0then0/inkdoze/security/advisories/new) instead. Include steps to reproduce and, if possible, a sample file.

You can expect an acknowledgement within a week. Once a fix is ready we will publish an advisory and credit you unless you prefer otherwise.

## Scope

InkDoze processes untrusted image files entirely in the browser. Issues of particular interest:

- Any way image data, file names or metadata could leave the device.
- Crafted files that bypass the size and pixel limits or exhaust memory before the limits apply.
- Malformed output (BMP, ZIP) that could harm the software reading it on an e-reader.
- Script injection through file names, catalog data or translations.

Bugs in browsers' own image decoders should be reported to the browser vendor.
