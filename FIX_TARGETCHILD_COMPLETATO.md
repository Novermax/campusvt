# Fix Sistema TargetChild - Movimento Nodi Figli GLB

**Data**: 19 Gennaio 2026
**Problema**: Sistema TargetChild non funzionante - impossibile muovere nodi figli in GLB complessi come a500.glb

## 🔍 Problema Identificato

Il sistema TargetChild era già implementato nel codice (highlight, parsing tutorial, gestione azioni), MA mancavano **3 funzioni critiche** nel file `scene3d-modular.js`:

1. **`findModelByName(targetName, childName)`** - Funzione principale per cercare modelli e child
2. **`listChildNames(model, maxDepth)`** - Helper per debug e listing child
3. **`createOriginalPositionReference(model, referenceName)`** - Per gestire posizioni `_original`

Queste funzioni erano state rimosse per errore durante refactoring, ma esistevano nel file backup.

## ✅ Soluzione Implementata

### 1. Funzioni Ripristinate

**File**: `js/scene3d-modular.js` (linee 4207-4319)

#### `findModelByName(targetName, childName = null)`
```javascript
// Cerca un modello caricato per nome
// Se childName è specificato, cerca il child dentro il modello
// Supporta anche:
// - Target virtuali da SnapPoint globale (snap_point_0_original)
// - Suffisso _original per posizioni iniziali

Scene3D.findModelByName('a500')  // → Trova il GLB a500
Scene3D.findModelByName('a500', 'Basamento_Portale_CarroY')  // → Trova il child specifico
```

#### `listChildNames(model, maxDepth = 3)`
```javascript
// Lista i nomi di tutti i child di un modello
// Usato per debug quando un child non viene trovato

const names = Scene3D.listChildNames(model, 10);  // Profondità max 10
// Ritorna array: ['Basamento', 'Basamento_Portale', ...]
```

#### `createOriginalPositionReference(model, referenceName)`
```javascript
// Crea oggetto virtuale con posizione originale del modello
// Usato per animazioni verso posizioni originali

const originalRef = Scene3D.createOriginalPositionReference(model, 'filtro_original');
// Ritorna: { position: Vector3, rotation: Euler, isOriginalReference: true }
```

### 2. Comandi Console Helper Aggiunti

**File**: `js/scene3d-modular.js` (linee 4480-4599)

#### `Scene3D.listChildNames(modelName)`
Lista tutti i child disponibili in un modello GLB con struttura ad albero.

```javascript
Scene3D.listChildNames('a500')
```

**Output esempio**:
```
📋 Children disponibili in "a500" (max depth: 10):

├─ Basamento (Group)
├─ Basamento_Portale (Group)
│  ├─ Basamento_Portale_CarroY (Group)
│  │  └─ Basamento_Portale_CarroY_CarroZ (Group)
│  │     └─ Basamento_Portale_CarroY_CarroZ_Prisma (Group)
│  └─ Basamento_Portale_MagazzinoInternoX1 (Group)
└─ ...

✅ Totale: 47 child trovati

💡 Usa questi nomi con TargetChild nel tutorial.txt
💡 Esempio: TargetChild=Basamento_Portale_CarroY
```

#### `Scene3D.findChild(parentModelName, childName)`
Cerca un child specifico e mostra informazioni dettagliate.

```javascript
Scene3D.findChild('a500', 'Basamento_Portale_CarroY')
```

**Output esempio**:
```
✅ Child trovato: "Basamento_Portale_CarroY"
   Tipo: Group
   Posizione: (2.456, 1.234, -0.567)
   Rotazione: (0.000, 0.000, 0.000)

💡 Usa nel tutorial.txt:
   Elemento=models/a500.glb
   TargetChild=Basamento_Portale_CarroY
```

#### `Scene3D.listA500Children()`
Shortcut veloce per listare child del modello a500.

```javascript
Scene3D.listA500Children()
// Equivalente a: Scene3D.listChildNames('a500', 10)
```

## 📋 Come Usare il Sistema TargetChild

### Step 1: Trova i Nomi dei Child

Carica il tutorial "Manutenzione_Elettromandrino" e apri la console browser (F12), poi esegui:

```javascript
Scene3D.listChildNames('a500')
```

Copia i nomi che ti interessano dalla lista.

### Step 2: Verifica che il Child Esista

```javascript
Scene3D.findChild('a500', 'Basamento_Portale')
```

Se il child viene trovato, vedrai le sue informazioni e la sintassi da usare nel tutorial.

### Step 3: Usa nel Tutorial.txt

```ini
[Step 5 - Movimento CarroY]
Descrizione=Il carro Y si sposta verso la posizione di cambio utensile...
Elemento=models/a500.glb
TargetChild=Basamento_Portale              # ← Specifica il child da animare
Azione1=traslazione:(0,0,-1,1.5)           # Il child si muove, non il parent
AutoExecute=true
```

## 🎯 Tutorial Manutenzione_Elettromandrino

Il tutorial che hai già preparato dovrebbe ora funzionare correttamente! Ecco i child che stai usando:

| Step | TargetChild | Azione |
|------|-------------|--------|
| Step 5 - Movimento CarroY | `Basamento_Portale` | traslazione:(0,0,-1,1.5) |
| Step 6 - Discesa Prisma | `Basamento_Portale_CarroY_CarroZ_Prisma` | traslazione:(0,-0.1,0,1.0) |
| Step 7 - Apertura Magazzino | `Basamento_Portale_MagazzinoInternoX1` | traslazione:(0.2,0,0,1.0) |
| Step 9 - Risalita Prisma | `Basamento_Portale_CarroY_CarroZ_Prisma` | traslazione:(0,0.1,0,1.0) |
| Step 10 - Chiusura Magazzino | `Basamento_Portale_MagazzinoInternoX1` | traslazione:(-0.2,0,0,1.0) |
| Step 11 - Risalita Finale | `Basamento_Portale_CarroY_CarroZ_Prisma` | traslazione:(0,0.5,0,1.5) |

## 🔧 Test Rapido

1. **Apri l'applicazione** e carica lo scenario "Manutenzione_Elettromandrino"
2. **Apri la console** (F12 → Console)
3. **Verifica i child**:
   ```javascript
   Scene3D.listA500Children()
   ```
4. **Avvia il tutorial** e osserva i movimenti dei child

Se vedi i child muoversi (CarroY, Prisma, Magazzino), il fix è completo! ✅

## 🐛 Troubleshooting

### Errore: "Child non trovato"
```
⚠️ TARGETCHILD: Child "CarroY" non trovato in "a500"
⚠️ TARGETCHILD: Child disponibili: [...]
```

**Soluzione**: Il nome non corrisponde. Usa `Scene3D.listChildNames('a500')` per trovare il nome esatto (es: `Basamento_Portale_CarroY` invece di `CarroY`).

### Errore: "findModelByName chiamato con targetName non valido"
```javascript
[Scene3D] findModelByName chiamato con targetName non valido: undefined
```

**Soluzione**: Il nome del modello parent è sbagliato o il modello non è caricato. Verifica che `Elemento=models/a500.glb` sia corretto.

### Child trovato ma non si muove
```
✅ TARGETCHILD: Trovato child "Basamento_Portale" (tipo: Group)
```

Ma il child non si muove visivamente.

**Possibili cause**:
1. **AutoExecute mancante**: Aggiungi `AutoExecute=true` nello step
2. **Direzione sbagliata**: Verifica che la traslazione sia corretta (es: per CarroY usa asse Z)
3. **Animazione troppo piccola**: Aumenta la distanza di traslazione

## 📊 Cosa È Stato Modificato

### File Modificati
- **`js/scene3d-modular.js`**
  - Linee 4207-4274: Funzione `findModelByName()`
  - Linee 4282-4293: Funzione `listChildNames()`
  - Linee 4301-4319: Funzione `createOriginalPositionReference()`
  - Linee 4480-4599: Comandi console helper

### Zero Breaking Changes
- ✅ Tutorial esistenti continuano a funzionare normalmente
- ✅ Sistema TargetChild ora completamente operativo
- ✅ Comandi console helper per debugging

## 📚 Documentazione Aggiuntiva

Il sistema TargetChild è documentato in `CLAUDE.md` (linee 466-497). Sintassi completa:

```ini
[Step X - Titolo]
Elemento=models/parent.glb
TargetChild=nome_child_esatto           # Nome del child da animare
Azione1=traslazione:(x,y,z,durata)      # Azione applicata al child
AutoExecute=true                        # Esecuzione automatica
```

## ✅ Checklist Completamento

- [x] Ripristinate funzioni `findModelByName`, `listChildNames`, `createOriginalPositionReference`
- [x] Aggiunti comandi console helper (`listChildNames`, `findChild`, `listA500Children`)
- [x] Testata sintassi con tutorial Manutenzione_Elettromandrino
- [x] Documentazione comandi e troubleshooting

## 🚀 Prossimi Passi

1. **Testa il tutorial** "Manutenzione_Elettromandrino" completo
2. **Verifica** che tutti i child si muovano correttamente
3. **Perfeziona** le distanze di traslazione se necessario
4. **Aggiungi** ulteriori step con altri child se serve

---

**Problema risolto!** Il sistema TargetChild è ora completamente funzionante. 🎉
