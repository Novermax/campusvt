# Build Resources

Questa directory contiene le risorse necessarie per il packaging dell'applicazione Electron.

## Icona Applicazione

Per personalizzare l'icona dell'applicazione, inserisci in questa directory:

- **`icon.ico`** - Icona Windows (256x256 o maggiore)
- **`icon.png`** - Icona sorgente PNG (512x512 o 1024x1024)

### Come creare icon.ico

Puoi usare tool online gratuiti:
- https://icoconvert.com/
- https://convertio.co/it/png-ico/
- https://favicon.io/

Oppure tool desktop:
- **GIMP** (Export as .ico)
- **IcoFX**
- **Greenfish Icon Editor Pro**

### Formato Raccomandato

- **Dimensioni**: 512x512 o 1024x1024 pixel
- **Formato**: PNG con trasparenza, poi convertito in ICO
- **Icone Multiple**: ICO dovrebbe contenere 16x16, 32x32, 48x48, 256x256

---

**Nota**: Se `icon.ico` non è presente, electron-builder userà l'icona di default di Electron.
