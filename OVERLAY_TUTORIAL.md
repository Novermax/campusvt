# 📚 Sistema Overlay Selezione Tutorial

**Data**: 12 Febbraio 2026
**Versione**: UI v1.3.0

---

## 🎯 Funzionalità Implementata

Sistema di evidenziazione per guidare l'utente a selezionare un tutorial quando viene caricato uno scenario.

**Componenti**:
1. ✨ **Overlay scuro** con titolo e freccia animata
2. 💙 **Pulsanti tutorial che pulsano** per 2 secondi (2 cicli completi)
3. ⏱️ **Auto-dismiss** dopo 5 secondi
4. 🖱️ **Chiusura al click** su pulsante o overlay

---

## 📋 Comportamento Dettagliato

### 1. Quando Appare
- **Trigger**: Caricamento scenario con tutorial disponibili
- **Delay**: 500ms dopo visualizzazione barra tutorial
- **Condizione**: Solo se ci sono tutorial configurati in `tutorial.txt`

### 2. Animazioni

#### Overlay
- **Fade In**: Sfondo scuro con opacità 0 → 1 (0.5s)
- **Titolo**: Scala 0.8 → 1.0 con fade (0.6s)
- **Sottotitolo**: Fade in con delay 0.2s
- **Freccia**: Bounce verticale infinito (↓)

#### Pulsanti Tutorial
- **Animazione**: `tutorialPulse` - scala 1.0 → 1.15 → 1.0
- **Box Shadow**: Alone blu che si espande e scompare
- **Durata**: 1 secondo per ciclo
- **Ripetizioni**: 2 cicli (totale 2 secondi)
- **Z-index**: 10000 (sopra overlay per essere cliccabili)

### 3. Chiusura

**Automatica**:
- ⏱️ Dopo **5 secondi** dall'apertura

**Manuale**:
- 🖱️ Click su **qualsiasi pulsante tutorial** (step-indicator blu)
- 🖱️ Click sull'**overlay stesso** (area scura)

---

## 🎨 Design e Stile

### Overlay
```css
background-color: rgba(0, 0, 0, 0.7);  /* Sfondo scuro semi-trasparente */
z-index: 9999;                          /* Sopra tutto tranne pulsanti */
```

### Titolo
```
📚 Seleziona un Tutorial
```
- **Font**: 2.5rem (1.8rem su mobile)
- **Colore**: Bianco (#ffffff)
- **Shadow**: 0 4px 12px rgba(0,0,0,0.8)

### Sottotitolo
```
Clicca su uno dei pulsanti blu per iniziare
```
- **Font**: 1.2rem (1rem su mobile)
- **Colore**: Grigio chiaro (#e0e0e0)

### Freccia
```
↓
```
- **Font**: 3rem (2rem su mobile)
- **Colore**: Verde (#4CAF50)
- **Animazione**: Bounce 1.5s infinito

### Pulsanti Tutorial (Pulse)
```css
@keyframes tutorialPulse {
    0%, 100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.7);
    }
    50% {
        transform: scale(1.15);
        box-shadow: 0 0 20px 10px rgba(33, 150, 243, 0);
    }
}
```

---

## 📱 Responsive Design

### Desktop (> 768px)
- Titolo: 2.5rem
- Sottotitolo: 1.2rem
- Freccia: 3rem

### Mobile (≤ 768px)
- Titolo: 1.8rem + padding laterale
- Sottotitolo: 1rem + padding laterale
- Freccia: 2rem

---

## 🔧 File Modificati/Creati

### 1. **CSS** - `css/components.css`
- Classe `.tutorial-selection-overlay`
- Classe `.tutorial-selection-title`
- Classe `.tutorial-selection-subtitle`
- Classe `.tutorial-selection-arrow`
- Classe `.step-indicator.pulse-tutorial`
- Keyframes: `tutorialPulse`, `fadeInScale`, `fadeIn`, `bounceDown`
- Media queries responsive

### 2. **HTML** - `index.html:451-461`
```html
<!-- ===== OVERLAY SELEZIONE TUTORIAL ===== -->
<div id="tutorialSelectionOverlay" class="tutorial-selection-overlay">
    <div class="tutorial-selection-title">
        📚 Seleziona un Tutorial
    </div>
    <div class="tutorial-selection-subtitle">
        Clicca su uno dei pulsanti blu per iniziare
    </div>
    <div class="tutorial-selection-arrow">
        ↓
    </div>
</div>
```

### 3. **JavaScript** - `js/ui.js`

**Nuovi Metodi** (linee 5348-5404):
```javascript
showTutorialSelectionOverlay()  // Mostra overlay + pulse pulsanti
hideTutorialSelectionOverlay()  // Nasconde overlay
```

**Integrazione** (linea 2154-2157):
```javascript
// In loadTutorial(), dopo showTutorialStepsBar()
setTimeout(() => {
    this.showTutorialSelectionOverlay();
}, 500);
```

---

## 🎬 Timeline Animazione

```
t = 0ms     → Scenario caricato
t = 500ms   → showTutorialSelectionOverlay() chiamato
t = 500ms   → Overlay fade in inizia (0.5s)
t = 500ms   → Pulsanti iniziano pulse (2s totale)
t = 600ms   → Titolo fade+scale completo
t = 700ms   → Sottotitolo fade completo
t = 1000ms  → Overlay completamente visibile
t = 1500ms  → Primo ciclo pulse completato
t = 2500ms  → Secondo ciclo pulse completato ✅
t = 5500ms  → Auto-dismiss overlay
```

---

## 🐛 Debug e Testing

### Console Log
```javascript
📚 [UI] Overlay selezione tutorial mostrato
✅ [UI] Animazione pulse pulsanti completata  // Dopo 2 secondi
❌ [UI] Overlay selezione tutorial nascosto   // Al click o timeout
```

### Test Manuale

1. **Carica scenario** con tutorial configurato
2. **Verifica**:
   - ✅ Overlay appare dopo 500ms
   - ✅ Titolo "📚 Seleziona un Tutorial" visibile
   - ✅ Pulsanti blu pulsano per 2 secondi
   - ✅ Freccia verde fa bounce
   - ✅ Overlay scompare al click pulsante
   - ✅ Overlay scompare al click su sfondo
   - ✅ Overlay scompare dopo 5 secondi

3. **Test Mobile**:
   - ✅ Font ridimensionati correttamente
   - ✅ Padding adeguato su schermi piccoli
   - ✅ Touch funziona su overlay e pulsanti

---

## ⚙️ Personalizzazione

### Modificare Durata Pulse
```javascript
// File: css/components.css
.step-indicator.pulse-tutorial {
    animation: tutorialPulse 1s ease-in-out 2;
    /*                       ^^              ^
                             |               |
                    Durata 1 ciclo    Numero cicli
    */
}
```

**Esempi**:
- `1s ease-in-out 1` = 1 ciclo, 1 secondo totale
- `1s ease-in-out 2` = **2 cicli, 2 secondi totale** (attuale)
- `1s ease-in-out 3` = 3 cicli, 3 secondi totale

### Modificare Timeout Auto-Dismiss
```javascript
// File: js/ui.js:5382
setTimeout(() => {
    this.hideTutorialSelectionOverlay();
}, 5000); // ← Modifica qui (in millisecondi)
```

**Esempi**:
- `3000` = 3 secondi
- `5000` = **5 secondi** (attuale)
- `7000` = 7 secondi
- `0` = Mai (solo chiusura manuale)

### Modificare Testi
```html
<!-- File: index.html:455-460 -->
<div class="tutorial-selection-title">
    📚 Seleziona un Tutorial  <!-- ← Modifica qui -->
</div>
<div class="tutorial-selection-subtitle">
    Clicca su uno dei pulsanti blu per iniziare  <!-- ← Modifica qui -->
</div>
```

---

## 🎯 Casi d'Uso

### Scenario 1: Singolo Tutorial
```ini
# home_config.txt
[Pompa_Becker]
Tutorial=scenes/Pompa_Becker/tutorial.txt
```

**Comportamento**:
- ✅ Overlay appare
- ✅ 1 pulsante blu pulsa
- ✅ Utente clicca → Tutorial inizia

### Scenario 2: Multipli Tutorial
```ini
# tutorial.txt
[Tutorial 1 - Smontaggio]
...

[Tutorial 2 - Manutenzione]
...

[Tutorial 3 - Rimontaggio]
...
```

**Comportamento**:
- ✅ Overlay appare
- ✅ **3 pulsanti blu pulsano** contemporaneamente
- ✅ Utente sceglie → Tutorial scelto inizia

### Scenario 3: Nessun Tutorial
```ini
# home_config.txt
[Scenario_Test]
# NO Tutorial configurato
```

**Comportamento**:
- ❌ Overlay NON appare
- ❌ Nessun pulsante mostrato

---

## ✅ Vantaggi UX

1. **Guida Visiva**: Utente capisce immediatamente cosa fare
2. **Attira Attenzione**: Pulsanti pulsanti sono impossibili da ignorare
3. **Non Invasivo**: Si chiude automaticamente o al click
4. **Professionale**: Animazioni smooth e design moderno
5. **Responsive**: Funziona su desktop e mobile

---

## 📊 Statistiche Performance

- **CSS**: ~100 righe aggiuntive
- **HTML**: ~8 righe
- **JavaScript**: ~60 righe
- **Overhead**: Minimo (animazioni CSS native, 1 setTimeout)
- **Compatibilità**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+

---

**Ultimo aggiornamento**: 12 Febbraio 2026
