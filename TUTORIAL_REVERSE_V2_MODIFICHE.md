# Tutorial Sostituzione Palette Reverse - Versione 2 (Con Avvitamento Manuale)

**Data Modifica**: Gennaio 2026
**File**: `scenes/Pompa_Becker/tutorial.txt`
**Backup Versione Precedente**: `tutorial.txt.reverse_v1` ✅

---

## 📋 Modifiche Implementate

### ✅ Backup Creato
- Versione precedente salvata come `tutorial.txt.reverse_v1`
- Tutorial originale con backup `tutorial.txt.original`

### ✅ Step Espansi: da 6 a 18
Il tutorial è stato espanso per includere avvitamento manuale di tutte le viti, una ad una.

---

## 🔄 Confronto Versioni

### Versione 1 (Precedente - 6 step)
```
Step 1: Rimonta 5 palette (drag&drop)
Step 2: Rimonta flangia (drag&drop)
Step 3: Riattacca tubo grasso (drag&drop)
Step 4: Monta 8 viti flangia (drag&drop) ← Finito qui
Step 5: Rimonta culatta (drag&drop)
Step 6: Monta 4 viti culatta (drag&drop) ← Finito qui
```

### Versione 2 (Corrente - 18 step)
```
Step 1:  Rimonta 5 palette (drag&drop)
Step 2:  Rimonta flangia (drag&drop)
Step 3:  Riattacca tubo grasso (drag&drop)
Step 4:  POSIZIONA 8 viti flangia (drag&drop) ← Non avvitate
Step 5:  Avvita vite flangia 1 (ChiaveInglese)
Step 6:  Avvita vite flangia 2 (ChiaveInglese)
Step 7:  Avvita vite flangia 3 (ChiaveInglese)
Step 8:  Avvita vite flangia 4 (ChiaveInglese)
Step 9:  Avvita vite flangia 5 (ChiaveInglese)
Step 10: Avvita vite flangia 6 (ChiaveInglese)
Step 11: Avvita vite flangia 7 (ChiaveInglese)
Step 12: Avvita vite flangia 8 (ChiaveInglese)
Step 13: Rimonta culatta (drag&drop)
Step 14: POSIZIONA 4 viti culatta (drag&drop) ← Non avvitate
Step 15: Avvita vite culatta 1 (ChiaveBrugola)
Step 16: Avvita vite culatta 2 (ChiaveBrugola)
Step 17: Avvita vite culatta 3 (ChiaveBrugola)
Step 18: Avvita vite culatta 4 (ChiaveBrugola) + ValidateAssembly
```

---

## 🎯 Dettaglio Modifiche per Categoria

### 1️⃣ Step 4: Posiziona Viti Flangia (Modificato)

**PRIMA (V1)**:
```ini
[Next Step - Gruppo Viti Flangia]
Descrizione=Monta le 8 viti della flangia in qualsiasi ordine usando la chiave inglese.
Utensile=Mani
DragDrop=true
AssemblyMode=true
AllowedComponents=vite_flangia_1,vite_flangia_2,...,vite_flangia_8
```
✅ Le viti erano considerate "montate e avvitate"

**DOPO (V2)**:
```ini
[Next Step - Posiziona Viti Flangia]
Descrizione=Posiziona le 8 viti della flangia nelle loro sedi in qualsiasi ordine. Le viti non sono ancora avvitate.
Utensile=Mani
DragDrop=true
AssemblyMode=true
AllowedComponents=vite_flangia_1,vite_flangia_2,...,vite_flangia_8
```
✅ Le viti sono solo "posizionate", non avvitate

---

### 2️⃣ Step 5-12: Avvita Viti Flangia (NUOVI - 8 step)

Aggiunti **8 nuovi step** per avvitare individualmente ogni vite flangia:

```ini
[Next Step - Avvita vite flangia 1]
Elemento=models/vite_flangia_1.glb
Descrizione=Stringi la prima vite della flangia con la chiave inglese da 10mm.
Utensile=ChiaveInglese
Azione1=avvita(0.1)

[Next Step - Avvita vite flangia 2]
Elemento=models/vite_flangia_2.glb
Descrizione=Stringi la seconda vite della flangia con la chiave inglese da 10mm.
Utensile=ChiaveInglese
Azione1=avvita(0.1)

... (ripetuto per vite_flangia_3 fino a vite_flangia_8)
```

**Caratteristiche**:
- **Elemento**: Modello GLB specifico per ogni vite
- **Utensile**: ChiaveInglese (10mm)
- **Azione**: `avvita(0.1)` - Distanza corta perché le viti sono già posizionate
- **Rotazione**: -1800° (5 giri antiorario) come configurato nel sistema
- **Sequenza**: Una vite alla volta, in ordine numerico

---

### 3️⃣ Step 13: Rimonta la Culatta (Invariato)

```ini
[Next Step - Rimonta la culatta]
Descrizione=Posiziona la culatta sul corpo pompa. Richiede che tutte le viti della flangia siano state avvitate.
Utensile=Mani
DragDrop=true
AssemblyMode=true
AllowedComponents=culatta
```

**Modifica**: Descrizione aggiornata - ora richiede che le viti flangia siano "avvitate" (non solo posizionate)

---

### 4️⃣ Step 14: Posiziona Viti Culatta (Modificato)

**PRIMA (V1 - Step 6)**:
```ini
[Next Step - Gruppo Viti Culatta]
Descrizione=Monta le 4 viti della culatta in qualsiasi ordine usando la chiave a brugola.
Utensile=Mani
ValidateAssembly=true
```
✅ Le viti erano considerate "montate e avvitate" + validazione finale

**DOPO (V2 - Step 14)**:
```ini
[Next Step - Posiziona Viti Culatta]
Descrizione=Posiziona le 4 viti della culatta nelle loro sedi in qualsiasi ordine. Le viti non sono ancora avvitate.
Utensile=Mani
DragDrop=true
AssemblyMode=true
AllowedComponents=vite_culatta_1,vite_culatta_2,vite_culatta_3,vite_culatta_4
```
✅ Le viti sono solo "posizionate", non avvitate
✅ `ValidateAssembly` rimosso da questo step

---

### 5️⃣ Step 15-18: Avvita Viti Culatta (NUOVI - 4 step)

Aggiunti **4 nuovi step** per avvitare individualmente ogni vite culatta:

```ini
[Next Step - Avvita vite culatta 1]
Elemento=models/vite_culatta_1.glb
Descrizione=Stringi la prima vite della culatta con la chiave a brugola da 6mm.
Utensile=ChiaveBrugola
Azione1=avvita(0.1)

[Next Step - Avvita vite culatta 2]
Elemento=models/vite_culatta_2.glb
Descrizione=Stringi la seconda vite della culatta con la chiave a brugola da 6mm.
Utensile=ChiaveBrugola
Azione1=avvita(0.1)

[Next Step - Avvita vite culatta 3]
Elemento=models/vite_culatta_3.glb
Descrizione=Stringi la terza vite della culatta con la chiave a brugola da 6mm.
Utensile=ChiaveBrugola
Azione1=avvita(0.1)

[Next Step - Avvita vite culatta 4]
Elemento=models/vite_culatta_4.glb
Descrizione=Stringi la quarta vite della culatta con la chiave a brugola da 6mm. Questo completa il rimontaggio della pompa.
Utensile=ChiaveBrugola
Azione1=avvita(0.1)
ValidateAssembly=true  ← Validazione spostata qui (step finale)
```

**Caratteristiche**:
- **Elemento**: Modello GLB specifico per ogni vite
- **Utensile**: ChiaveBrugola (6mm)
- **Azione**: `avvita(0.1)` - Distanza corta perché le viti sono già posizionate
- **Rotazione**: -1800° (5 giri antiorario)
- **Sequenza**: Una vite alla volta, in ordine numerico
- **Validazione**: Solo nell'ultima vite (`vite_culatta_4`) ✅

---

## 📊 Statistiche Comparative

| Metrica | Versione 1 | Versione 2 |
|---------|-----------|-----------|
| **Step Totali** | 6 | 18 |
| **Step DragDrop** | 6 | 6 |
| **Step Avvitamento** | 0 | 12 |
| **Interazioni Viti Flangia** | 1 (drag&drop gruppo) | 1 drag&drop + 8 avvitamenti |
| **Interazioni Viti Culatta** | 1 (drag&drop gruppo) | 1 drag&drop + 4 avvitamenti |
| **Utensili Usati** | Mani | Mani, ChiaveInglese, ChiaveBrugola |
| **Tempo Stimato Completamento** | ~2 min (esperto) | ~5 min (esperto) |

---

## 🎯 Vantaggi Versione 2

### ✅ Maggiore Realismo
- **Separazione azioni**: Posizionare ≠ Avvitare (come nella realtà)
- **Utensili appropriati**: ChiaveInglese per flangia, ChiaveBrugola per culatta
- **Feedback tattile**: Ogni vite richiede azione specifica

### ✅ Training Migliorato
- **Sequenza dettagliata**: Utente apprende passo-passo la procedura completa
- **Focus su utensili**: Pratica con ChiaveInglese e ChiaveBrugola
- **Memoria procedurale**: 18 step = apprendimento più profondo

### ✅ Flessibilità Assemblaggio
- **Posizionamento intercambiabile**: Viti posizionate in ordine libero (drag&drop)
- **Avvitamento sequenziale**: Viti avvitate una ad una (controllo qualità)

---

## 🔧 Parametri Tecnici

### Distanza Avvitamento
```ini
Azione1=avvita(0.1)
```
- **Valore**: 0.1 unità (distanza ridotta)
- **Motivo**: Le viti sono già posizionate nello step precedente, servono solo pochi millimetri di avvitamento
- **Rotazione**: -1800° (5 giri completi antiorario)
- **Durata**: Default 0.5s per azione

### Confronto con Svitamento Tutorial Smontaggio
Tutorial Smontaggio usava:
```ini
Azione1=svita(0.1)  # Viti flangia - estrazione corta
```

Tutorial Reverse (V2) usa distanza identica ma inversa:
```ini
Azione1=avvita(0.1)  # Viti flangia - inserimento corto
```

---

## 🚀 Come Testare

### Test Desktop
```javascript
// Salta direttamente a step viti flangia
jumpToStep(4)  // Posizionamento viti flangia
jumpToStep(5)  // Prima vite da avvitare

// Salta direttamente a step viti culatta
jumpToStep(14)  // Posizionamento viti culatta
jumpToStep(15)  // Prima vite culatta da avvitare

// Verifica stato assemblaggio
DragDropSystem.getAssemblyStatus()
```

### Test Mobile AutoMode
```javascript
1. Apri da smartphone
2. Login → Scenario "Pompa Becker"
3. Tutorial "Sostituzione Palette Reverse"
4. Click "🤖 AUTO ON"
5. Sistema esegue automaticamente:
   - Posiziona 8 viti flangia
   - Avvita 8 viti flangia una ad una
   - Posiziona 4 viti culatta
   - Avvita 4 viti culatta una ad una
```

---

## 📝 File Modificati

### tutorial.txt (linee 690-849)
```
Linea 695: TutorialSteps=6 → TutorialSteps=18
Linea 737: "Gruppo Viti Flangia" → "Posiziona Viti Flangia"
Linee 753-799: Aggiunti 8 step avvitamento viti flangia (NUOVI)
Linea 814: "Gruppo Viti Culatta" → "Posiziona Viti Culatta"
Linee 826-849: Aggiunti 4 step avvitamento viti culatta (NUOVI)
Linea 849: ValidateAssembly spostato da step 14 a step 18
```

### Righe Totali Tutorial Reverse
- **Versione 1**: 85 righe (linee 690-774)
- **Versione 2**: 160 righe (linee 690-849)
- **Incremento**: +75 righe (+88%)

---

## 🐛 Possibili Problemi e Soluzioni

### ❌ Problema: "Vite già avvitata"
**Causa**: Tentativo di avvitare vite già completata in step precedente
**Soluzione**: Usa `jumpToStep(N)` per saltare a step specifico

### ❌ Problema: "Vite non trovata"
**Causa**: Vite non posizionata nello step drag&drop precedente
**Soluzione**: Torna allo step 4 (flangia) o 14 (culatta) e posiziona tutte le viti

### ❌ Problema: "Animazione avvitamento non visibile"
**Causa**: Sistema rotazione viti funzionante (riferimento CLAUDE.md:1550-1630)
**Verifica**: Console log dovrebbe mostrare "🔩 ROTATE AROUND CENTER" con 5 giri

---

## ✅ Checklist Completamento V2

- [x] Backup `tutorial.txt.reverse_v1` creato
- [x] TutorialSteps aggiornato a 18
- [x] Step 4 modificato: "Posiziona Viti Flangia" (non avvitate)
- [x] Aggiunti 8 step avvitamento viti flangia (step 5-12)
- [x] Step 13 invariato: Rimonta culatta
- [x] Step 14 modificato: "Posiziona Viti Culatta" (non avvitate)
- [x] Aggiunti 4 step avvitamento viti culatta (step 15-18)
- [x] ValidateAssembly spostato su ultimo step (step 18)
- [x] Utensili corretti: ChiaveInglese (flangia), ChiaveBrugola (culatta)
- [x] Distanza avvitamento ottimizzata: 0.1 unità
- [x] Documentazione V2 completa creata

---

## 🎉 Risultato Finale

Il tutorial **[Sostituzione Palette Reverse]** versione 2 è **completo e ottimizzato**!

**File**: `scenes/Pompa_Becker/tutorial.txt` (linee 690-849)
**Backup disponibili**:
- `tutorial.txt.original` - Backup pre-reverse
- `tutorial.txt.reverse_v1` - Versione 1 (6 step)

**Tutorial ora include**:
- ✅ 18 step totali (6 → 18)
- ✅ Posizionamento e avvitamento separati
- ✅ Utensili realistici (ChiaveInglese, ChiaveBrugola)
- ✅ Training completo e dettagliato

---

**Generato**: Gennaio 2026
**Autore**: Claude Code - Campus Virtual Training Team
**Versione**: 2.0 (Con Avvitamento Manuale)
