# S1X: The Great Code Hunt

English scan-only implementation of S1X.

## Rules
- Barcode / EAN: 1 image fragment
- QR code: 2 image fragments
- Each exact code can be used only once per browser/device
- Every accepted scan generates a deterministic three-line field note derived from the code content

## Images
Replace the six files in `images/` and update `images.json`.
Images do not need to be manually divided. Square JPG, PNG, WebP or SVG images work well.

## Hosting
Publish the whole folder through HTTPS, for example GitHub Pages. Camera scanning normally requires HTTPS.

The manual code field is included as a fallback and for testing.


## Version 1.1
The completion screen now shows final field time, number of captured codes, recovered fragments, and a generated closing field line.
