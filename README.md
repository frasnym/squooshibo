# Squooshibo

Squooshibo is a fork of [Squoosh] focused on batch image compression:
drop in a folder of images, compress them all with one shared setting,
and download the results as a zip. All compression runs locally in the
browser via WebAssembly — no image is ever uploaded to a server.

Live at **[squooshibo.vercel.app](https://squooshibo.vercel.app)**.

# Features

- Bulk compress any number of images at once with one shared encoder
  and resize setting.
- Formats: MozJPEG, WebP, AVIF, JPEG XL, WebP2, OxiPNG, QOI, and the
  browser's native JPEG/PNG/GIF encoders.
- Optional resize before compression.
- Per-file preview (before/after) and per-file removal from the batch.
- Download all results as a single zip.
- Installable as a PWA with offline support.

# Privacy

Squooshibo does not send your image to a server. All image compression
happens locally, and unlike upstream Squoosh, this fork has no analytics
or tracking of any kind.

# Developing

To develop for Squooshibo:

1. Clone the repository
1. Use Node 20 (see `.nvmrc`)
1. To install node packages, run:
   ```sh
   npm install
   ```
1. Then build the app by running:
   ```sh
   npm run build
   ```
1. After building, start the development server by running:
   ```sh
   npm run dev
   ```

# Deployment

The `dev` branch is deployed to Vercel automatically (see `vercel.json`
for build/output config, headers, and redirects).

# Contributing

Squooshibo is an open-source project that appreciates all community
involvement. To contribute to the project, follow the
[contribute guide](/CONTRIBUTING.md).

[squoosh]: https://squoosh.app
