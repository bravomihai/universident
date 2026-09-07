# Universident — imagini de brand

Cele șase PNG-uri au fundal cu transparență reală și aceeași geometrie în ambele teme.

| Fișier | Dimensiuni | Utilizare |
| --- | --- | --- |
| `universident-header-light.png` | 1600 × 320 | Simbol + nume, pe fundal deschis |
| `universident-header-dark.png` | 1600 × 320 | Simbol + nume, pe fundal închis |
| `universident-logo-light.png` | 1600 × 1100 | Logo complet cu slogan, pe fundal deschis |
| `universident-logo-dark.png` | 1600 × 1100 | Logo complet cu slogan, pe fundal închis |
| `favicon-light.png` | 512 × 512 | Simbol fără text, pentru tema light |
| `favicon-dark.png` | 512 × 512 | Simbol fără text, pentru tema dark |

`preview-light.png` și `preview-dark.png` sunt planșe de prezentare cu fundal opac, nu fișierele folosite de aplicație.

## Culori și font

- Light: albastru `#2563EB`, navy `#10233F`, fundal de prezentare `#E3EFFF`.
- Dark: albastru `#60A5FA`, alb rece `#E8EEF7`, fundal de prezentare `#08111F`.
- Wordmark: Figtree Semibold (600), fontul folosit în site.
- Slogan: Figtree Regular (400), „Unde învățarea devine grijă.”

Pentru menținerea transparenței, nu salva imaginile ca JPEG. Fișierele au spațiere interioară inclusă; păstrează proporțiile la afișare.

## Proveniență și finisaj

Simbolul trimis de utilizator (dinte deasupra unei cărți deschise) a fost folosit ca referință într-o generare/editare cu instrumentul **ImageGen integrat**, nu prin CLI. Masterul selectat a fost apoi finisat tehnic, cu acordul explicit al utilizatorului: eliminarea fundalului, curățarea contururilor, separarea formelor, recolorare în valorile HEX exacte, compoziție cu text Figtree și redimensionare cu antialiasing. Perechile light/dark folosesc aceleași măști alfa, nu generări independente.

Verificările tehnice acoperă dimensiunile, formatul RGBA, transparența reală, culorile pixelilor opaci și egalitatea măștilor alfa între teme.

### Promptul masterului selectat

```text
Use case: logo-brand.
Input image 1 is a SHAPE REFERENCE ONLY, not a texture or pixel template.
Rebuild the Universident tooth-and-open-book symbol from scratch as an immaculate flat vector-style raster logo. Preserve the recognizable outline and proportions of the supplied tooth (two rounded roots and overlapping curved crown) above the open book (two clean page shapes per side and a curved bottom binding). Smooth mathematical-looking curves, large clean negative spaces, perfectly solid flat fills.
CRITICAL: remove EVERY speckle, tiny line, distressed patch, photographic shading, grain, gradient, blue fringe and stray pixel visible in the reference. Do not preserve the reference's raster defects. There must be no marks at all in the transparent spaces between the pages or inside the tooth.
LIGHT THEME palette: tooth + four upper page shapes pure #2563EB; lower binding pure #10233F. No black strokes. No outlines around the colored shapes. No extra symbols, words, labels, watermark or shadow.
One centered isolated symbol on genuine transparent RGBA background. Square PNG 1024x1024, symbol 84% canvas width. This is a final logo/favicon asset, not a mockup. Clean flat logo geometry takes priority over copying damaged pixels.
```
