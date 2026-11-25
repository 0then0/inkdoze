# User guide

InkDoze prepares images for the screen of your e-reader. Add your images, select the reader, then use **How to install** to find the steps for its firmware. [Open InkDoze](https://0then0.github.io/inkdoze/)

## Prepare and download images

1. Drop PNG, JPEG, WebP or supported HEIC files onto the page, or select **Add images**.
2. Search for your e-reader by model, generation or resolution. If you know the dimensions and want to enter them yourself, select **Custom size** and set the width and height in **Manual settings**.
3. Check the preview and the line above the download buttons for the output size, format and colour mode. Use **Download image** for the selected image or the ZIP option for the batch.
4. Follow **How to install** for your model. Support for a custom image depends on the device and firmware. The catalog also includes devices with a confirmed screen size and no documented installation method. [Device catalog](device-catalog.md)

Standard output defaults to the reader's screen dimensions, **Fill** framing and the recommended file format. **Automatic e-ink adjustment** adjusts contrast and midtones for each image. The output format can constrain colour mode and gray levels.

Use the controls below the preview to crop, rotate, zoom or position an image. In **Manual settings**, choose **All images** for batch defaults or **This image only** for overrides. **Use batch settings** clears the selected image's overrides for the current output mode. You can rename each output in **Images**. [Image processing and file limits](image-processing.md)

## Reuse batch settings

In **Processing profiles**, select **Save batch settings as a profile** and enter a name. The list shows saved profiles for the selected reader or **Custom size** and the current output mode. Select a profile and choose **Apply profile** to update the batch defaults. The same list lets you rename or delete the selected profile.

Standard profiles store output size, framing, background, colour, tone, gray levels, dithering, format and JPEG quality. CrossPoint sleep overlay profiles store the framing choice. Individual image settings take priority when rendering previews and downloads.

The browser stores up to 40 profiles, with names of up to 64 characters. Profiles are kept in site data independently of the offline app cache. Clearing site data deletes saved profiles.

## Open InkDoze offline

1. While online, open InkDoze at `/inkdoze/`. Select **Offline** next to the language picker, then **Prepare for offline use**.
2. Wait for **Ready to open offline**. You can close the tab and reopen the same address without a connection, using the same browser profile.

The prepared app can add and export images, including the first HEIC photo. Add your image files again after reopening. The offline cache holds the app files, while saved profiles and preferences use browser site storage.

Offline preparation requires Service Workers, Cache Storage, WebAssembly and space in site storage. If preparation fails, check storage and the connection, then select **Try again**. If the browser removes the cache or you clear site data, prepare again while online. [Browser requirements](#browser-support-and-privacy)

To update a prepared copy, go online and choose **Check for offline updates**. When **Update saved** appears, close all InkDoze tabs and reopen the app. The previous complete build remains usable if an update fails. [Self-hosting and offline support](development.md#hosting)

## Kindle Display Cover

1. Select a Kindle whose **How to install** panel lists a book-cover method, add an image and choose **Download EPUB for Kindle**.
2. Send the EPUB to your Kindle through Amazon's service. That step uploads the book to your Amazon account for conversion. [Send to Kindle](https://www.amazon.com/sendtokindle) · [Amazon's file transfer guide](https://digprjsurvey.amazon.com/csad/help/node/TCUBEdEkbIhK07ysFu)
3. Enable **Display Cover** in the Kindle settings and open the delivered book. Check **How to install** for the menu path for your firmware.

The sleep screen follows the most recently opened book. Display Cover availability depends on the model, firmware, region and ad settings. The automated tests check the generated book structure and cover image. [EPUB format details](image-processing.md#kindle-cover-epub)

## CrossPoint sleep overlay

1. Add your images, select your e-reader and choose **CrossPoint sleep overlay**. The preview shows the placement over a sample reading page. Each PNG contains the overlay at the reader's screen size and keeps transparent areas.
2. For one image, choose **Download overlay** and copy `sleep-overlay.png` to the root of the SD card. For a batch, choose **Download overlay ZIP** and extract it to the root so the PNGs are directly inside `.sleep-overlay/`.
3. On CrossPoint 2.0.0, open **Settings › Display › Sleep Screen**. Select **Transparent** to show the overlay over the current screen or **Cover + Transparent** to use the last book cover.

CrossPoint picks a random image from the folder on each sleep. If you use the folder, move any root-level `sleep-overlay.bmp` and `sleep-overlay.png` elsewhere. The root BMP takes priority, followed by the root PNG, then the folder. [CrossPoint 2.0.0 overlay guide](https://github.com/crosspoint-reader/crosspoint-reader/blob/2.0.0/USER_GUIDE.md#transparent-overlay-images)

For a full-screen custom image, use standard output and follow the CrossPoint instructions under **How to install**. Those steps use `sleep.bmp` or `.sleep/`. [CrossPoint 2.0.0 custom image guide](https://github.com/crosspoint-reader/crosspoint-reader/blob/2.0.0/USER_GUIDE.md#custom-images)

## Browser support and privacy

Open InkDoze from a secure origin such as HTTPS or localhost. The browser needs `OffscreenCanvas`, module Web Workers and `createImageBitmap`. Profile storage also needs IndexedDB. The automated browser tests cover Chromium, Firefox and WebKit, with a phone viewport and touch emulation in Chromium.

InkDoze processes images locally. The site serves the app and its decoder. Preparing for offline use copies those static files into the browser cache. The production page blocks network connections from application scripts. [Browser tests and build details](development.md)
