# Debug TargetChild - Guida Step-by-Step

**Problema**: I child del GLB a500 non si muovono durante il tutorial
**Obiettivo**: Identificare esattamente dove sta il problema

---

## 📋 STEP 1: Verifica che il modello sia caricato

1. **Apri l'applicazione** e carica lo scenario "Manutenzione_Elettromandrino"
2. **Apri la console** browser (F12 → Console)
3. **Esegui**:
   ```javascript
   Scene3D.listAvailableObjects()
   ```

**Risultato atteso**: Dovresti vedere `a500` nella lista dei modelli caricati.

✅ **Se vedi a500**: Passa allo Step 2
❌ **Se NON vedi a500**: Il GLB non è caricato - verifica il percorso in `tutorial.txt`

---

## 📋 STEP 2: Lista i child disponibili

**Esegui nella console**:
```javascript
Scene3D.listChildNames('a500')
```

**Risultato atteso**: Lista ad albero dei child come:
```
📋 Children disponibili in "a500" (max depth: 10):

├─ Basamento (Group)
├─ Basamento_Portale (Group)
│  ├─ Basamento_Portale_CarroY (Group)
...
```

✅ **Se vedi la lista**: Copia i nomi esatti che ti servono e passa allo Step 3
❌ **Se errore**: Il modello a500 non esiste - torna allo Step 1

**📝 IMPORTANTE**: Scrivi i nomi esatti dei child che vuoi animare:
- Child 1: `____________________`
- Child 2: `____________________`
- Child 3: `____________________`

---

## 📋 STEP 3: Verifica che un child specifico sia trovabile

Prendi il primo child che vuoi animare (es: `Basamento_Portale`) e **esegui**:
```javascript
Scene3D.findChild('a500', 'Basamento_Portale')
```

**Sostituisci** `'Basamento_Portale'` con il nome esatto che hai copiato dallo Step 2.

**Risultato atteso**:
```
✅ Child trovato: "Basamento_Portale"
   Tipo: Group
   Posizione: (x, y, z)
   ...
```

✅ **Se child trovato**: Passa allo Step 4
❌ **Se child NON trovato**: Il nome non corrisponde - verifica di averlo copiato esattamente

---

## 📋 STEP 4: TEST ANIMAZIONE MANUALE

Ora testiamo se il child può essere animato. **Esegui**:

### Test 1: Movimento semplice verso l'alto
```javascript
Scene3D.testMoveChild('a500', 'Basamento_Portale', 0, 0.5, 0, 2.0)
```

**Cosa fa**: Muove il child di 0.5 unità sull'asse Y (verso l'alto) in 2 secondi.

**Osserva il viewport 3D** mentre l'animazione è in corso!

**Risultati possibili**:

### ✅ Caso A: IL CHILD SI MUOVE VISIBILMENTE
```
✅ Animazione avviata con successo!
✅ IL CHILD SI È MOSSO!
```

**→ OTTIMO!** Il sistema funziona. Il problema è nei nomi o nella sintassi del tutorial.txt.
**Vai allo Step 5** per verificare il tutorial.txt

---

### ❌ Caso B: IL CHILD NON SI MUOVE (ma animazione avviata)
```
✅ Animazione avviata con successo!
❌ IL CHILD NON SI È MOSSO - Potrebbe essere un problema di coordinate locali/world
```

**→ PROBLEMA CONFERMATO**: Il sistema di animazione non funziona sui child.

**Possibili cause**:
1. **Problema coordinate locali**: Il child si muove in coordinate locali ma non in world
2. **Gerarchia bloccata**: Un parent ha rotazione/scala che impedisce il movimento visibile
3. **matrixAutoUpdate bug**: Nonostante il fix, qualcosa blocca l'aggiornamento

**PROVA QUESTI FIX**:

#### Fix A: Prova un movimento più grande
```javascript
Scene3D.testMoveChild('a500', 'Basamento_Portale', 0, 2.0, 0, 2.0)
```
Se si muove, il problema era che 0.5 era troppo piccolo.

#### Fix B: Prova un altro child più esterno nella gerarchia
```javascript
Scene3D.testMoveChild('a500', 'Basamento', 0, 0.5, 0, 2.0)
```
Se `Basamento` si muove ma `Basamento_Portale` no, il problema è nella gerarchia profonda.

#### Fix C: Prova movimento su asse diverso
```javascript
Scene3D.testMoveChild('a500', 'Basamento_Portale', 0, 0, -1, 2.0)  // Asse Z
Scene3D.testMoveChild('a500', 'Basamento_Portale', -1, 0, 0, 2.0)  // Asse X
```

---

### ❌ Caso C: ANIMAZIONE NON AVVIATA
```
❌ Animazione non avviata
```

**→ PROBLEMA CRITICO**: Il sistema di animazione ha un errore.

**Controlla la console** per errori JavaScript. Potrebbero esserci:
- `MultiStepAnimationSystem non disponibile`
- Errori di dipendenze mancanti
- Errori nei moduli core

**Invia screenshot** dell'errore completo nella console.

---

## 📋 STEP 5: Verifica sintassi tutorial.txt

Se il test manuale allo Step 4 ha funzionato (Caso A), il problema è nel tutorial.txt.

**Apri**: `scenes/Manutenzione_Elettromandrino/tutorial.txt`

**Verifica Step 5** (linee 187-193):
```ini
[Next Step - Movimento CarroY]
Descrizione=Il carro Y si sposta verso la posizione di cambio utensile...
Elemento=models/a500.glb
TargetChild=Basamento_Portale              # ← VERIFICA QUESTO NOME
Azione1=traslazione:(0,0,-1,1.5)
AutoExecute=true
```

**Controlla**:
1. ✅ Il nome in `TargetChild=` corrisponde **esattamente** al nome che hai testato allo Step 4?
2. ✅ C'è `AutoExecute=true`?
3. ✅ Il file GLB è `models/a500.glb` (non `models/A500.glb` o altri nomi)?

**Se tutto è corretto**, prova ad **avviare il tutorial** e osserva:

### Durante l'esecuzione dello step, nella console dovresti vedere:
```
[UI] 🤖 AutoExecute: Trovato modello "a500"
[UI] 🔍 DEBUG: Cercando child "Basamento_Portale" in "a500"
[UI] ✅ AutoExecute: TROVATO child "Basamento_Portale" in "a500"
[Scene3D] 🤖 AutoExecute: Avvio animazione per "Basamento_Portale"
[Scene3D] 🤖 AutoExecute: isChild (ha parentModel)? true
```

---

## 📋 STEP 6: Confronta test manuale vs tutorial

### Se il test manuale (Step 4) FUNZIONA ma il tutorial NO:

**Confronta i parametri**:

| Parametro | Test Manuale | Tutorial Step 5 |
|-----------|--------------|-----------------|
| Parent | `'a500'` | `models/a500.glb` |
| Child | `'Basamento_Portale'` | `Basamento_Portale` |
| Traslazione | `(0, 0.5, 0)` | `(0, 0, -1)` |
| Durata | `2.0` | `1.5` |

**Prova a modificare il tutorial** per usare gli stessi parametri del test che ha funzionato:

```ini
[Next Step - Movimento CarroY]
Elemento=models/a500.glb
TargetChild=Basamento_Portale
Azione1=traslazione:(0,0.5,0,2.0)    # ← Stessi parametri del test
AutoExecute=true
```

**Ricarica il tutorial** e verifica se ora funziona.

---

## 📋 STEP 7: Debug log completo

Se ancora non funziona, **copia TUTTO il log della console** durante l'esecuzione dello step e inviamelo.

**Come fare**:
1. **Apri Console** (F12)
2. **Click destro** nella console → **Save as...** → Salva come `console_log.txt`
3. Oppure **seleziona tutto** il testo e **copia/incolla**

**Inviami**:
- Il file `console_log.txt` o il testo copiato
- Screenshot del viewport 3D durante lo step
- Screenshot della console con eventuali errori in rosso

---

## 🔍 Checklist Rapida

Prima di chiedere ulteriore aiuto, verifica di aver completato:

- [ ] Step 1: Modello a500 caricato? → `Scene3D.listAvailableObjects()`
- [ ] Step 2: Child listati? → `Scene3D.listChildNames('a500')`
- [ ] Step 3: Child trovabile? → `Scene3D.findChild('a500', 'nome')`
- [ ] Step 4: Test animazione manuale? → `Scene3D.testMoveChild(...)`
  - [ ] Test con movimento Y (verso alto)
  - [ ] Test con movimento Z
  - [ ] Test con movimento più grande (2.0 invece di 0.5)
- [ ] Step 5: Sintassi tutorial.txt verificata?
  - [ ] Nome child esatto (no spazi, maiuscole corrette)
  - [ ] `AutoExecute=true` presente
  - [ ] `Elemento=models/a500.glb` corretto
- [ ] Step 6: Parametri tutorial uguali a test manuale funzionante?
- [ ] Step 7: Log console completo salvato?

---

## 🎯 Cosa Aspettarsi

### ✅ Se tutto funziona correttamente:

1. Test manuale allo Step 4 → **Child si muove visibilmente**
2. Console mostra:
   ```
   ✅ Child trovato: "Basamento_Portale"
   🔧 Forzando matrixAutoUpdate su child e parent chain...
   ✅ Parent chain aggiornata (3 livelli)
   🎬 Avvio animazione...
   ✅ Animazione avviata con successo!
   📊 Posizione dopo 100ms: (x, y, z+delta)
   ✅ IL CHILD SI È MOSSO!
   ```
3. Tutorial eseguito → **Child si muove automaticamente**

### ❌ Se qualcosa non funziona:

**Inviami**:
1. A quale step ti sei fermato (Step 1, 2, 3, 4, 5, 6, o 7)?
2. Quale errore hai ricevuto nella console?
3. Screenshot della console durante il test
4. Screenshot del viewport (se il child appare ma non si muove)

---

## 📚 Comandi Rapidi di Riferimento

```javascript
// Lista modelli caricati
Scene3D.listAvailableObjects()

// Lista child del GLB a500
Scene3D.listChildNames('a500')

// Trova un child specifico
Scene3D.findChild('a500', 'Basamento_Portale')

// TEST animazione child
Scene3D.testMoveChild('a500', 'Basamento_Portale', 0, 0.5, 0, 2.0)
//                     parent   child              x   y    z   dur

// TEST altri assi
Scene3D.testMoveChild('a500', 'Basamento_Portale', 0, 0, -1, 2.0)  // Z
Scene3D.testMoveChild('a500', 'Basamento_Portale', -1, 0, 0, 2.0)  // X
```

---

**Segui questi step uno per uno e fammi sapere dove ti blocchi!** 🚀
