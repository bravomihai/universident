# Brand assets

Assets are stored in [`public/branding`](../public/branding). The six primary PNGs have transparent backgrounds and matching geometry across themes.

| Asset | Dimensions | Use |
| --- | --- | --- |
| `universident-header-light.png` / `universident-header-dark.png` | 1600 × 320 | Symbol and wordmark on light/dark backgrounds |
| `universident-logo-light.png` / `universident-logo-dark.png` | 1600 × 1100 | Full logo with tagline |
| `favicon-light.png` / `favicon-dark.png` | 512 × 512 | Text-free browser tab symbol |

`preview-light.png` and `preview-dark.png` are presentation sheets with opaque backgrounds, not application assets.

## Colors and typography

| Element | Light theme | Dark theme |
| --- | --- | --- |
| Tooth and book pages | `#60A5FA` | `#60A5FA` |
| Binding and text | `#10233F` | `#E8EEF7` |
| Presentation background | `#E3EFFF` | `#08111F` |

The wordmark uses Figtree Semibold (600); the tagline, “Unde învățarea devine grijă.”, uses Figtree Regular (400). Preserve the built-in padding, aspect ratio, and alpha channel. Do not convert transparent assets to JPEG. Theme variants share the same alpha masks.

## Home-screen and fallback icons

These exports use the current tooth-and-book symbol from `favicon-light.png`.

| Asset | Dimensions | Use |
| --- | --- | --- |
| `public/branding/universident-apple-touch-icon.png` | 180 × 180 | Explicit Apple touch icon |
| `public/branding/universident-icon-192.png` | 192 × 192 | Manifest icon |
| `public/branding/universident-icon-512.png` | 512 × 512 | High-resolution manifest icon |
| `public/apple-touch-icon.png` | 180 × 180 | Safari fallback path |
| `public/favicon.ico` | 16, 32, 48 | Legacy browser fallback |

Home-screen icons use an opaque `#E3EFFF` background independent of the page theme. Tab favicons remain transparent; the manifest uses browser display mode.

After changing the source symbol, run `npm run brand:icons`. The script uses sharp to resize the existing artwork. Check dimensions, transparency, theme geometry, and exported icons. For iOS verification, add a new Safari shortcut: an existing shortcut may retain a cached icon. See [Apple's Web Clip icon reference](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html).
