# Analisi Funzionalità Tutorial.txt
**File**: scenes/Pompa_Becker/tutorial.txt
**Data Analisi**: Gennaio 2026
**Versione Sistema**: Campus Virtual Training v1.0

---

## 📋 INDICE FUNZIONALITÀ UTILIZZATE

### 1. CONFIGURAZIONE CAMERA
```ini
CameraPos=(x,y,z)                    # Posizione camera nello spazio 3D
CameraTarget=(x,y,z)                 # Punto target camera (coordinate assolute)
CameraTarget=oggetto                 # Punto target camera (oggetto)
CameraZoom=valore                    # Livello zoom (default: 1.0)
CameraTransitionTime=secondi         # Durata transizione camera
```

**Utilizzo nel file**:
- ✅ Usato in tutti i tutorial
- ✅ Sintassi coerente
- ⚠️ ATTENZIONE: Alcuni step usano "cameratarget" minuscolo (linea 441, 549)

---

### 2. POSIZIONAMENTO MODELLI
```ini
Posizione=modello:(x,y,z)            # Posizione assoluta modello
Rotazione=modello:(rx,ry,rz)         # Rotazione in gradi
```

**Utilizzo nel file**:
- ✅ Configurazioni globali (linee 11, 203-244)
- ✅ Configurazioni tutorial specifiche
- ✅ Export automatico posizioni (linee 553-688)

---

### 3. ELEMENTI E UTENSILI
```ini
Elemento=models/nome.glb             # Modello 3D su cui operare
Utensile=tipo                        # Tool richiesto (Mani, ChiaveBrugola, ChiaveInglese, Aria)
Descrizione=testo                    # Istruzione mostrata all'utente
```

**Utensili utilizzati**:
- ✅ **Mani** - 45+ occorrenze
- ✅ **ChiaveBrugola** - 12 occorrenze
- ✅ **ChiaveInglese** - 10 occorrenze
- ✅ **Aria** - 1 occorrenza

---

### 4. SISTEMA AZIONI

#### 4.1 Azioni Movimento Base
```ini
Azione1=svita                        # Svita con distanza default (0.5)
Azione1=svita(distanza)              # Svita con distanza personalizzata
Azione1=avvita                       # Avvita con distanza default (0.5)
Azione1=avvita(distanza)             # Avvita con distanza personalizzata
Azione1=estrai                       # Estrai con distanza default (0.4)
Azione1=estrai(distanza)             # Estrai con distanza personalizzata
Azione1=inserisci                    # Inserisci con distanza default (0.4)
Azione1=inserisci(distanza)          # Inserisci con distanza personalizzata
```

**Utilizzo**:
- ✅ svita: 16 occorrenze
- ✅ svita(0.3): 8 occorrenze
- ✅ svita(0.1): 10 occorrenze
- ✅ avvita(0.005): 2 occorrenze

#### 4.2 Traslazioni
```ini
Azione1=traslazione:(x,y,z,durata)                      # Traslazione assoluta
Azione1=traslazione:target_original,(x,y,z,durata)      # Traslazione relativa a target
```

**Utilizzo**:
- ✅ Traslazione assoluta: 30+ occorrenze
- ✅ Traslazione relativa a tappino_grasso_dx_original: 42 occorrenze (pompaggio)
- ✅ Traslazione relativa a tappino_grasso_sx_original: 22 occorrenze (pompaggio)
- ✅ Traslazione relativa a ingrassatore_original: 1 occorrenza

#### 4.3 Rotazioni
```ini
Azione1=rotazione:(rx,ry,rz,durata)                     # Rotazione normale
Azione1=centro:(x,y,z);rotazione:(rx,ry,rz,durata)      # Rotazione con cambio pivot
```

**Utilizzo**:
- ✅ Rotazione normale: 8 occorrenze
- ✅ Rotazione con centro pivot: 2 occorrenze (coperchio, ingrassatore)

#### 4.4 Azioni Speciali
```ini
Azione1=appoggia(durata)             # Appoggia oggetto al pavimento (Y=0)
Azione1=resetCenteredOriginal        # Reset posizioni centrate
```

**Utilizzo**:
- ✅ appoggia: 28 occorrenze
- ✅ resetCenteredOriginal: 2 occorrenze

---

### 5. SISTEMA DRAG & DROP

#### 5.1 Configurazione Base
```ini
DragDrop=true                        # Abilita drag & drop
DragDropObjects=obj1,obj2            # Oggetti draggabili (formato standard)
AllowedComponents=obj1,obj2          # Oggetti draggabili (formato AssemblyMode)
DragDropDistance=valore              # Distanza snap in unità 3D
```

**Utilizzo**:
- ✅ DragDrop=true: 7 occorrenze
- ✅ DragDropObjects: 1 occorrenza (linea 443)
- ✅ AllowedComponents: 6 occorrenze
- ✅ DragDropDistance: 7 occorrenze (valori: 0.2, 0.3, 1.5)

#### 5.2 Sistema Snap
```ini
SnapTargets=target1,target2                                    # Snap globale
SnapTargets=obj:target1,target2;obj2:target3                  # Snap per-oggetto
SnapPoint=(x,y,z),(x2,y2,z2)                                  # Snap coordinate globale
SnapPoint=obj:(x,y,z);obj2:(x2,y2,z2)                         # Snap coordinate per-oggetto
```

**Utilizzo**:
- ✅ SnapTargets formato globale: 1 occorrenza (linea 445)
- ⚠️ SnapPoint: NON utilizzato nel file

---

### 6. SISTEMA ASSEMBLY MODE
```ini
AssemblyMode=true                    # Abilita modalità assemblaggio sequenziale
AllowedComponents=obj1,obj2,obj3     # Componenti permessi nello step
ValidateAssembly=true                # Valida assemblaggio completo
```

**Utilizzo**:
- ✅ AssemblyMode=true: 6 occorrenze (tutorial Riassemblaggio)
- ✅ ValidateAssembly=true: 1 occorrenza (linea 302)
- ✅ Utilizzato per sequenza: Tappini → Filtro → Coperchio → Viti → Ingrassatore

---

### 7. OGGETTI COLLEGATI

#### 7.1 Slave Objects (Movimento 1:1)
```ini
SlaveObjects=obj1.glb                # Oggetto segue master 1:1
SlaveObjects=obj1,obj2,obj3          # Multipli oggetti slave
```

**Utilizzo**:
- ✅ SlaveObjects=tubograsso.glb: 1 occorrenza (linea 487)
- ✅ Tubo grasso segue flangia durante traslazione

#### 7.2 Driven Objects (Movimento Indipendente)
```ini
DrivenObject=obj.glb,traslazione:(x,y,z,dur)                           # Singolo
DrivenObjects=obj1.glb,traslazione:(x1,y1,z1,d1);obj2.glb,trasl...    # Multipli
```

**Utilizzo**:
- ✅ DrivenObjects multipli: 2 occorrenze (linee 459, 465)
- ✅ Flangia e tubograsso si muovono durante avvitamento viti estrattore
- ✅ Movimento indipendente: flangia 0.005, tubo 0.005

---

### 8. SISTEMA MESSAGGI INFORMATIVI
```ini
Message=testo messaggio              # Messaggio modale informativo
MessageTitle=titolo                  # Titolo modale (opzionale)
MessageVideo=percorso/video.mp4      # Video tutorial (opzionale)
MessageImage=percorso/immagine.jpg   # Immagine esplicativa (opzionale)
```

**Utilizzo**:
- ✅ Message: 1 occorrenza (linea 435)
- ✅ MessageTitle: 1 occorrenza (linea 436)
- ✅ MessageVideo: 1 occorrenza (linea 437)
- ✅ Usato per istruzioni estrattore flangia

---

## 🔍 ANALISI ERRORI E INCONGRUENZE

### ❌ ERRORI CRITICI

1. **Linea 441**: `cameraZoom=1` (minuscolo) invece di `CameraZoom=1`
2. **Linea 549**: `cameratarget=(0, 0, 0)` (minuscolo) invece di `CameraTarget=(0, 0, 0)`
3. **Linea 691**: Linea vuota con solo `/` - possibile errore di battitura

### ⚠️ WARNINGS

1. **Linee 154, 184**: Azioni commentate con `//Azione22=...` potrebbero indicare indecisione
2. **Linee 67-69**: Azioni commentate per filtro - sintassi vecchia non più supportata
3. **Linea 200**: `//AutoComplete=false` commentato - potrebbe servire?

### ✅ BEST PRACTICES VIOLATE

1. **Multipli Step con stesso nome**: "Next Step - stringi viti estrattore" appare 2 volte (linee 449, 460)
2. **Numerazione Azioni non sequenziale**: Mancano Azione2-20 in alcuni step pompaggio
3. **Mix sintassi**: Alcuni usano `CameraPos=...`, altri no nello stesso tutorial

---

## 📊 STATISTICHE UTILIZZO

### Comandi per Categoria
- **Camera**: 25+ configurazioni
- **Azioni Movimento**: 150+ azioni totali
- **Drag & Drop**: 7 step configurati
- **Assembly Mode**: 6 step sequenziali
- **Messaggi**: 1 modale informativo

### Tutorial Definiti
1. ✅ **Pulizia Filtro e ingrassaggio** (11 step) - COMPLETO
2. ✅ **Riassemblaggio** (5 step) - COMPLETO
3. ⚠️ **Sostituzione Palette Smontaggio** (28 step) - COMPLETO ma lungo
4. ❌ **Sostituzione Palette Reverse** - INCOMPLETO (solo configurazioni)

---

## 🎯 RACCOMANDAZIONI

### Alta Priorità
1. ✅ **Correggere** `cameraZoom` e `cameratarget` in maiuscolo
2. ✅ **Rimuovere** linea 691 con `/` isolato
3. ✅ **Uniformare** nomi step duplicati

### Media Priorità
4. ✅ **Decidere** se attivare `AutoComplete=false` (linea 200)
5. ✅ **Pulire** azioni commentate non più necessarie
6. ✅ **Completare** tutorial "Sostituzione Palette Reverse"

### Bassa Priorità
7. ✅ **Aggiungere** commenti esplicativi per step complessi
8. ✅ **Standardizzare** sintassi camera in tutti i tutorial

---

## 📝 NOTE TECNICHE

### Funzionalità Avanzate Utilizzate
- ✅ **Riferimenti _original**: Usati estensivamente per pompaggio ingrassatore
- ✅ **DrivenObjects multipli**: Movimento sincronizzato flangia/tubo
- ✅ **Cambio pivot rotazione**: Per rotazioni complesse coperchio/ingrassatore
- ✅ **Assembly sequenziale**: Ordine forzato riassemblaggio
- ✅ **Snap intercambiabili**: Viti estrattore su fori multipli

### Compatibilità
- ✅ Tutte le funzionalità usate sono documentate in CLAUDE.md
- ✅ Sintassi compatibile con versione sistema 1.0
- ✅ Zero breaking syntax nel file

---

**Generato**: Gennaio 2026
**Strumento**: Campus Virtual Training Analysis Tool
