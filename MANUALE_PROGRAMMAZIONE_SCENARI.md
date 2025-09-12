# MANUALE PROGRAMMAZIONE SCENARI
## Campus Virtual Training - Sistema 3D Formazione Industriale

**Versione**: 1.2  
**Data**: 12 Novembre 2025  
**Target**: Tecnici industriali non programmatori  
**Obiettivo**: Creazione autonoma di scenari formativi 3D interattivi  
**Aggiornamenti v1.2**: Sistema riferimenti posizioni originali (_original), Snap personalizzati Drag & Drop, Export automatico posizioni
**Aggiornamenti v1.1**: Comandi debug camera, CameraTarget con oggetti, Tool Aria, Axis Gizmo, Sistema Drag & Drop, Assemblaggio Sequenziale

---

## SLIDE 1: INTRODUZIONE AL SISTEMA

### Cos'è il Campus Virtual Training?
- **Sistema di formazione 3D** per training tecnico-industriale
- **Visualizzazione interattiva** di componenti meccanici
- **Tutorial step-by-step** per manutenzione e assemblaggio
- **Gestione autonoma** da parte dei tecnici senza programmazione

### A chi si rivolge questo manuale?
- **Tecnici industriali** esperti di macchinari
- **Responsabili formazione** aziendali
- **Istruttori tecnici** che vogliono creare contenuti
- **Nessuna esperienza di programmazione richiesta**

---

## SLIDE 2: STRUTTURA DEL SISTEMA

### File principali per la programmazione:
```
C:\Users\mloffredo\claude\
├── home_config.txt        ← CONFIGURAZIONE SCENARI
├── scenes\
│   ├── Test\
│   │   └── tutorial.txt   ← TUTORIAL SCENARIO TEST
│   └── Pompa_Becker\
│       └── tutorial.txt   ← TUTORIAL POMPA DEL VUOTO
└── models\               ← MODELLI 3D (.glb, .obj, .stl)
```

### Due livelli di configurazione:
1. **home_config.txt** → Definisce SCENARI disponibili
2. **tutorial.txt** → Definisce PASSI di ogni scenario

---

## SLIDE 3: CONFIGURAZIONE SCENARI (home_config.txt)

### Struttura base di uno scenario:
```
[Nome Scenario Mostrato]                    ← Titolo nella home page
// === CONFIGURAZIONE CAMERA E LUCI ===
CameraPos=(-1.5, 0.5, -0.2)               ← Posizione camera 3D
CameraTarget=(0, 0, 0)                     ← Punto osservato
AmbientLight=0x404040,1.5                  ← Luce ambiente
DirectionalLight=0xffffff,2.5,(-8,15,10)  ← Luce direzionale

// === INFORMAZIONI SCENARIO ===
description=Descrizione operazione tecnica  ← Testo nella card
image=menuimages/1.png                      ← Immagine anteprima
tutorial=scenes/NomeCartella/tutorial.txt   ← File tutorial

// === MODELLI 3D E MOVIMENTI ===
model=models/componente.glb                 ← Modello 3D
direzione=0,0,1                            ← Direzione movimento
```

### Esempio pratico - Manutenzione Pompa:
```
[Manutenzione pompa del vuoto]
CameraPos=(-1.5, 0.5,-0.2)
CameraTarget=(0, 0, 0)
description=Controlli periodici, pulizia filtri, sostituzione palette
image=menuimages/pompavuoto.png
tutorial=scenes/Pompa_Becker/tutorial.txt
model=models/filtro.glb
direzione=-1,0,0
```

---

## SLIDE 4: PARAMETRI CAMERA E ILLUMINAZIONE

### Parametri Camera:
- **CameraPos=(X, Y, Z)** → Posizione camera nello spazio 3D
  - X: sinistra(-) / destra(+)
  - Y: basso(-) / alto(+)  
  - Z: davanti(-) / dietro(+)
- **CameraTarget=(X, Y, Z)** → Coordinate punto che la camera osserva
- **CameraTarget=nome_oggetto** → Punta automaticamente al centro dell'oggetto
- **Esempio**: `CameraPos=(-1.5, 0.5, -0.2)` = camera sinistra, leggermente alta, davanti

### Parametri Illuminazione:
- **AmbientLight=colore,intensità**
  - `0x404040,1.5` = grigio scuro, intensità 1.5
- **DirectionalLight=colore,intensità,(X,Y,Z)**
  - `0xffffff,2.5,(-8,15,10)` = bianco, intensità 2.5, dall'alto-sinistra
- **BackLight** = luce posteriore per eliminare ombre

---

## SLIDE 5: DEFINIZIONE MODELLI 3D

### Sintassi modelli:
```
model=percorso/file.glb                     ← Percorso modello 3D
direzione=X,Y,Z                            ← Vettore movimento
```

### Direzioni movimento standard:
- `direzione=1,0,0` → movimento verso destra (X+)
- `direzione=-1,0,0` → movimento verso sinistra (X-)
- `direzione=0,1,0` → movimento verso alto (Y+)
- `direzione=0,0,1` → movimento verso avanti (Z+)
- `direzione=-1,0,1` → movimento diagonale (sinistra + avanti)

### Esempio componenti pompa:
```
model=models/culatta.glb
direzione=0,0,1                            ← Estrazione verticale
model=models/filtro.glb  
direzione=-1,0,0                           ← Estrazione laterale
model=models/vite_coperchio_1.glb
direzione=-1,0,0                           ← Svitamento ed estrazione
```

---

## SLIDE 6: CREAZIONE TUTORIAL (tutorial.txt)

### Struttura base tutorial:
```
[Nome Tutorial]                             ← Titolo tutorial
CameraPos=(-1.5, 0.5, -0.2)               ← Posizione camera iniziale
CameraTarget=(0, 0, 0)                     ← Focus camera
CameraZoom=1.2                             ← Livello zoom
CameraTransitionTime=2.5                   ← Durata transizione

[Step N - Descrizione Step]                ← Definizione step
Elemento=models/componente.glb              ← Componente da animare
Utensile=Mani                              ← Strumento richiesto
Descrizione=Testo istruzioni               ← Testo nel fumetto
Azione=tipo_animazione                     ← Tipo movimento
Distanza=valore                            ← Distanza movimento
```

### Esempio step smontaggio:
```
[Step 1 - Prima vite]
Elemento=models/vite_coperchio_1.glb
Utensile=Mani
Descrizione=Rimuovi la prima vite del coperchio
Azione=svita
Distanza=0.5
```

---

## SLIDE 7: TIPI DI ANIMAZIONI DISPONIBILI

### Animazioni semplici:
- **svita** → Rotazione + estrazione (per viti, bulloni)
- **estrai** → Solo traslazione lineare (per coperchi, filtri)
- **ruota** → Solo rotazione sul posto
- **solleva** → Movimento verticale verso alto

### Animazioni complesse (Azione):
```
Azione1=rotazione:(0,0,90,0.8)      ← Ruota 90° in 0.8 secondi
Azione2=traslazione:(X,Y,Z,durata)  ← Sposta in X,Y,Z
Azione3=centro:(X,Y,Z)              ← Centra su posizione
```

### Esempio movimento complesso:
```
[Step 9 - Ingrassatore]
Elemento=models/ingrassatore.glb
Azione1=rotazione:(0,0,90,0.8);traslazione:(0,0.6,0,0.8)
Azione2=traslazione:tappino_grasso_dx,(0,0,0,0.8)
```

### 🆕 NUOVO: Riferimenti a Posizioni Originali (_original)
**Sistema per tornare alle posizioni iniziali dei componenti:**

```
# Traslazione normale (relativa)
Azione1=traslazione:(-0.2,0,0,0.8)

# Traslazione a posizione corrente di altro oggetto
Azione1=traslazione:tappino_grasso_dx,(0.1,0,0,0.8)

# Traslazione a POSIZIONE ORIGINALE di altro oggetto (NUOVO)
Azione1=traslazione:tappino_grasso_dx_original,(0.1,0,0,0.8)
```

#### Casi d'uso tipici _original:
- **Reset componenti**: Riportare filtro/ingrassatore alla posizione iniziale
- **Assemblaggio sequenziale**: Componenti devono occupare posizioni precise
- **Tutorial ripetibili**: Ripristinare configurazione originale per ricominciare

#### Esempi pratici:
```
# Riporta filtro alla posizione iniziale
Azione1=traslazione:filtro_original,(0,0,0,1.0)

# Ingrassatore torna alla sede originale del tappino
Azione2=traslazione:tappino_grasso_dx_original,(0,0,0,1.0)

# Reset completo scenario
Azione1=traslazione:filtro_original,(0,0,0,1.0)
Azione2=traslazione:ingrassatore_original,(0,0,0,1.5)
```

---

## SLIDE 8: PARAMETRI AVANZATI TUTORIAL

### Controllo Camera durante step:
```
CameraPos=ingrassatore:(-1, 0, 0)          ← Posizione relativa al componente
CameraTarget=ingrassatore                  ← Segue il componente  
CameraZoom=2.2                             ← Zoom ravvicinato
CameraTransitionTime=1.2                   ← Durata movimento camera
```

### Parametri movimento:
- **Distanza** → Quanto si muove il componente (0.3 = piccolo, 0.8 = grande)
- **Durata** → Tempo animazione in secondi (0.8 = veloce, 2.0 = lento)
- **Sequenze** → Azione1, Azione2, Azione3 per movimenti complessi

### Utensili disponibili:
- **Mani** → Operazione manuale
- **ChiaveInglese** → Chiave regolabile
- **Cacciavite** → Avvitamento/svitamento
- **Aria** → Strumento pneumatico (ex-Martello) con icona air.png

### Parametri Drag & Drop e Assemblaggio:
```ini
DragDrop=true                          # Abilita trascinamento 3D
DragDropObjects=comp1,comp2            # Lista oggetti draggabili
DragDropDistance=1.5                   # Distanza auto-snap (0.5-3.0)
AssemblyMode=true                      # Abilita assemblaggio sequenziale
AssemblyConfig=configs/assembly.json   # Configurazione JSON assemblaggio
CurrentStep=step_name                  # Step corrente sequenza
AllowedComponents=base,vite            # Componenti montabili
RequiredPrevious=fondamenta            # Prerequisiti step
ShowSnapPoints=base,vite               # Mostra punti aggancio
UndoEnabled=true                       # Abilita undo/redo
```

### 🆕 NUOVO: Drag & Drop con Target Personalizzati (_original)
**Configurazione snap a posizioni specifiche tramite console JavaScript:**

```javascript
// Snap standard - oggetto torna alla propria posizione originale
DragDropSystem.enable(['ingrassatore'])

// Snap personalizzato - oggetto snappe alla posizione corrente di altro oggetto
DragDropSystem.setCustomSnapTarget('ingrassatore', 'tappino_rosso')

// Snap a posizione ORIGINALE di altro oggetto (NUOVO)
DragDropSystem.setCustomSnapTarget('ingrassatore', 'tappino_grasso_dx_original')

// Snap con offset preciso dalla posizione target
DragDropSystem.setCustomSnapTarget('ingrassatore', 'filtro_original', new THREE.Vector3(0.1,0,0))
```

#### Flusso di lavoro completo:
1. **Progetta posizioni** per ogni componente nello scenario
2. **Esporta posizioni correnti**: `Scene3D.exportCurrentModelPositions()` 
3. **Copia coordinate** dalla console e salva nel tutorial.txt
4. **Configura snap personalizzati** per il training drag & drop
5. **Testa scenario** trascinando componenti alle posizioni target

#### Vantaggi sistema _original nel Drag & Drop:
- **Assemblaggio guidato**: L'utente impara posizionamento preciso
- **Feedback immediato**: Snap automatico quando vicino al target corretto  
- **Flessibilità**: Oggetti possono snappare a posizioni di altri oggetti
- **Ripetibilità**: Sempre stesso comportamento per training consistente

---

## SLIDE 9: WORKFLOW CREAZIONE SCENARIO

### Fase 1: Pianificazione
1. **Definire obiettivo** formativo (es. "Sostituzione filtro pompa")
2. **Identificare componenti** coinvolti nell'operazione
3. **Stabilire sequenza** logica degli step
4. **Preparare modelli 3D** dei componenti (.glb consigliato)

### Fase 2: Configurazione scenario
1. **Aprire home_config.txt** con editor di testo
2. **Copiare template** scenario esistente
3. **Modificare nome** e descrizione
4. **Impostare camera** e illuminazione
5. **Elencare modelli** con direzioni movimento

### Fase 3: Creazione tutorial
1. **Creare cartella** in scenes/ (es. "scenes/MioScenario/")
2. **Creare tutorial.txt** nella cartella
3. **Definire step** uno per uno con animazioni
4. **Testare** nel sistema 3D

---

## SLIDE 10: ESEMPI PRATICI - SCENARIO SEMPLICE

### Esempio: Sostituzione filtro aria
```
# In home_config.txt:
[Sostituzione filtro aria]
CameraPos=(-2, 1, -1)
CameraTarget=(0, 0.2, 0)
AmbientLight=0x404040,1.5
DirectionalLight=0xffffff,2.5,(-8, 15, 10)
description=Procedura cambio filtro aria sistema aspirazione
image=menuimages/filtro_aria.png
tutorial=scenes/Filtro_Aria/tutorial.txt
model=models/coperchio_filtro.glb
direzione=0,1,0
model=models/filtro_aria.glb
direzione=0,0,-1
```

```
# In scenes/Filtro_Aria/tutorial.txt:
[Cambio Filtro Aria]
CameraPos=(-2, 1, -1)
CameraTarget=coperchio_filtro     ← Punta automaticamente al coperchio
CameraZoom=1.0

[Step 1 - Apertura coperchio]
Elemento=models/coperchio_filtro.glb
Utensile=Mani
Descrizione=Apri il coperchio del filtro dell'aria
CameraTarget=coperchio_filtro     ← Camera segue il coperchio
Azione=solleva
Distanza=0.3

[Step 2 - Estrazione filtro]
Elemento=models/filtro_aria.glb
Utensile=Mani
Descrizione=Estrai il filtro usurato
CameraTarget=filtro_aria          ← Camera si sposta sul filtro
Azione=estrai
Distanza=0.4
```

---

## SLIDE 11: ESEMPI PRATICI - SCENARIO COMPLESSO

### Esempio: Manutenzione pompa (multi-step)
```
[Step 6 - Filtro complesso]
Elemento=models/filtro.glb
Utensile=Mani
Descrizione=Rimuovi il filtro con movimento articolato
Azione1=traslazione:(-0.8,0,0,1.5)     ← Prima spostalo lateralmente
Azione2=traslazione:(0,0,0.5,1.5)      ← Poi estrailo in avanti
```

### Movimento con allineamento automatico:
```
[Step 9 - Ingrassatore]
Elemento=models/ingrassatore.glb
Descrizione=Posiziona l'ingrassatore sul punto di servizio
Azione1=rotazione:(0,0,90,0.8);traslazione:(0,0.6,0,0.8)
Azione2=traslazione:tappino_grasso_dx,(0,0,0,0.8)  ← Si allinea automaticamente
```

---

## SLIDE 12: RISOLUZIONE PROBLEMI COMUNI

### Problema: Camera non inquadra bene
**Soluzione**: Modificare CameraPos e CameraTarget
```
# Camera troppo vicina:
CameraPos=(-1, 0.5, -0.2) → CameraPos=(-3, 1, -1)

# Camera troppo lontana:  
CameraPos=(-5, 2, -2) → CameraPos=(-2, 1, -1)
```

### Problema: Componente si muove nella direzione sbagliata
**Soluzione**: Invertire direzione
```
direzione=1,0,0 → direzione=-1,0,0    ← Inverte X
direzione=0,1,0 → direzione=0,-1,0    ← Inverte Y
```

### Problema: Animazione troppo veloce/lenta
**Soluzione**: Modificare durata
```
Distanza=0.5 → Distanza=0.8           ← Movimento più ampio
# Oppure per Azione:
traslazione:(0,0,0.5,1.0) → traslazione:(0,0,0.5,2.0)  ← Più lento
```

### Problema: Modello non appare
**Verificare**:
- File .glb esiste in cartella models/
- Percorso scritto correttamente
- Nome file identico (case-sensitive)

---

## SLIDE 13: BEST PRACTICES

### Organizzazione file:
- **Un tutorial per scenario** (non mischiare operazioni diverse)
- **Nomi file descrittivi** (`tutorial_manutenzione_pompa.txt`)
- **Backup** prima di modifiche importanti
- **Modelli 3D ottimizzati** (formato .glb preferito)

### Sequenza step logica:
1. **Preparazione** (posizionamento, strumenti)
2. **Smontaggio** (nell'ordine corretto)
3. **Sostituzione/Manutenzione** (operazione principale)
4. **Rimontaggio** (ordine inverso)
5. **Controllo finale** (verifica funzionamento)

### Descrizioni efficaci:
- **Imperativi chiari**: "Rimuovi", "Svita", "Posiziona"
- **Dettagli tecnici**: "prima vite del coperchio"
- **Avvertenze sicurezza**: "Attenzione: componente pesante"
- **Riferimenti visivi**: "vite angolo superiore destro"

---

## SLIDE 14: COMANDI DEBUG AVANZATI

### Accesso alla Console Debug:
1. **Aprire il sistema 3D** nel browser
2. **Premere F12** per aprire Developer Tools
3. **Cliccare "Console"** per vedere l'area comandi
4. **Digitare comandi** e premere Invio

### Comandi Camera e Posizionamento:
```javascript
// Ottieni posizione camera corrente (con sintassi per tutorial)
Scene3D.getCameraInfo()

// Lista tutti gli oggetti nella scena (con nomi per CameraTarget)
Scene3D.listAvailableObjects()
```

### Esempio Output getCameraInfo():
```
📹 CAMERA INFO:
Position: (2.5, 1.8, 4.2)
Pivot Point: (0, 0.5, 0)
Distance to Pivot: 5.12

📋 TUTORIAL SYNTAX:
CameraPos=(2.5,1.8,4.2)
CameraTarget=(0,0.5,0)

💡 ALTERNATIVE CameraTarget SYNTAX:
CameraTarget=nome_oggetto   # Punta al centro del bounding box dell'oggetto
```

### Esempio Output listAvailableObjects():
```
📦 OGGETTI DISPONIBILI NELLA SCENA:
1. "filtro"
   Centro: (0, 0.3, 0)
   Dimensioni: 0.8 × 0.6 × 0.8

2. "pompa"
   Centro: (0, 0, 0)
   Dimensioni: 2.1 × 1.5 × 1.8

📝 USO NEI TUTORIAL:
CameraTarget=filtro   # Punta al centro di "filtro"
CameraTarget=pompa    # Punta al centro di "pompa"
```

### Comandi Axis Gizmo:
```javascript
// Mostra/nascondi il gizmo degli assi in alto a destra
Scene3D.toggleAxisGizmoUI(true)    // Mostra
Scene3D.toggleAxisGizmoUI(false)   // Nascondi

// Debug status del gizmo
Scene3D.debugAxisGizmoUI()
```

### Workflow Ottimizzato con Comandi Debug:
1. **Posiziona camera** manualmente con mouse nel 3D
2. **Esegui** `Scene3D.getCameraInfo()` in console
3. **Copia** la sintassi generata nel tutorial.txt
4. **Lista oggetti** con `Scene3D.listAvailableObjects()`
5. **Usa nomi oggetti** per CameraTarget invece di coordinate

---

## SLIDE 14.5: SISTEMA DRAG & DROP E ASSEMBLAGGIO AVANZATO

### Cos'è il Sistema Drag & Drop?
Il **Sistema Drag & Drop 3D** consente agli utenti di:
- **Trascinare oggetti 3D** direttamente con il mouse
- **Posizionare componenti** in modo interattivo
- **Assemblare meccanismi** con snap automatico
- **Apprendere per manipolazione diretta** invece che solo osservazione

### Funzionalità Principali:
- ✅ **Trascinamento Fluido**: Raycasting preciso per movimento naturale
- ✅ **Auto-Snap**: Aggancio automatico alle posizioni originali
- ✅ **Feedback Visivo**: Indicatori grafici per zone di aggancio
- ✅ **Controllo Selettivo**: Lista componenti draggabili configurabile
- ✅ **Assemblaggio Sequenziale**: Montaggio in ordine obbligatorio

### Configurazione Base Drag & Drop:
```ini
[Step X - Assemblaggio Interattivo]
Descrizione=Posiziona i componenti trascinandoli
DragDrop=true                          # Abilita sistema drag & drop
DragDropObjects=filtro,vite,coperchio   # Lista oggetti draggabili
DragDropDistance=1.5                    # Distanza snap (0.5-3.0)
```

### Assemblaggio Sequenziale Avanzato:
```ini
[Step X - Assemblaggio Guidato]
Descrizione=Monta i componenti nella sequenza corretta
DragDrop=true                           # Abilita drag & drop
AssemblyMode=true                       # Abilita modalità assemblaggio
AssemblyConfig=assembly_configs/pompa.json  # Configurazione JSON
CurrentStep=step1                       # Step corrente sequenza
AllowedComponents=base,corpo            # Componenti montabili ora
RequiredPrevious=fondamenta             # Prerequisiti step
ShowSnapPoints=base,corpo               # Mostra punti aggancio
UndoEnabled=true                        # Abilita undo/redo
```

### Configurazione Assembly JSON:
```json
{
  "sequence": ["step1", "step2", "step3"],
  "snapPoints": {
    "vite": {
      "positions": [
        {"id": "pos1", "position": [2,0,0], "rotation": [0,0,0]},
        {"id": "pos2", "position": [-2,0,0], "rotation": [0,0,0]}
      ]
    }
  },
  "dependencies": {
    "coperchio": ["vite1", "vite2", "vite3", "vite4"]
  },
  "interchangeableNodes": {
    "viti_gruppo": ["vite_m6", "vite_m8", "vite_m10"]
  }
}
```

### Vantaggi Pedagogici:
- **Apprendimento Cinestetico**: "Imparare facendo" con manipolazione diretta
- **Memoria Procedurale**: Gesti fisici rinforzano apprendimento
- **Feedback Immediato**: Errori visibili subito, correzione guidata
- **Coinvolgimento**: Interazione attiva vs passiva osservazione

### Casi d'Uso Tipici:
1. **Assemblaggio Pompe**: Sequenze precise manutenzione industriale
2. **Training Intercambiabilità**: Componenti alternativi per flessibilità
3. **Quality Control**: Verifiche completezza assemblaggio
4. **Troubleshooting**: Identificazione errori assemblaggio

### Best Practices Drag & Drop:
- **Oggetti Appropriati**: Solo componenti logicamente movibili
- **Snap Distance Ottimale**: 1.0-1.5 per precisione, 2.0+ per tolleranza
- **Feedback Visivo Chiaro**: Cerchi verdi, evidenziazione materiali
- **Sequenza Logica**: Ordine assemblaggio realistico industriale
- **Descrizioni Guida**: Istruzioni chiare per ogni step

---

## SLIDE 15: CHECKLIST CREAZIONE SCENARIO

### Prima di iniziare:
- [ ] **Obiettivo** formativo definito chiaramente
- [ ] **Modelli 3D** disponibili e funzionanti
- [ ] **Sequenza operativa** pianificata su carta
- [ ] **Immagine anteprima** preparata (PNG/JPG)

### Durante la creazione:
- [ ] **Template copiato** da scenario esistente
- [ ] **Nome scenario** univoco e descrittivo
- [ ] **Camera posizionata** per inquadratura ottimale
- [ ] **Ogni step testato** singolarmente
- [ ] **Descrizioni complete** e comprensibili

### Test finale:
- [ ] **Scenario appare** nella home page
- [ ] **Tutorial si avvia** correttamente
- [ ] **Tutti gli step** funzionano in sequenza
- [ ] **Animazioni fluide** e realistiche
- [ ] **Testi leggibili** e istruttivi

---

## SLIDE 15: RISORSE E SUPPORTO

### File di riferimento:
- **home_config.txt** → Esempi scenari funzionanti
- **scenes/Test/tutorial.txt** → Tutorial semplice
- **scenes/Pompa_Becker/tutorial.txt** → Tutorial complesso
- **CLAUDE.md** → Documentazione tecnica completa

### Strumenti consigliati:
- **Editor di testo**: Notepad++, Visual Studio Code, Sublime Text
- **Visualizzatore modelli 3D**: Windows 3D Viewer, Blender
- **Editor immagini**: GIMP, Paint.NET per anteprime

### Formati supportati:
- **Modelli 3D**: .glb (consigliato), .obj+.mtl, .stl
- **Immagini**: .png (consigliato), .jpg, .jpeg
- **Testo**: UTF-8 senza BOM

### Supporto tecnico:
- **Documentazione**: CLAUDE.md nel progetto
- **Debug**: Console browser (F12) per errori
- **Backup**: Copiare sempre file prima modifiche

---

## SLIDE 16: CONCLUSIONI

### Cosa hai imparato:
- **Struttura** del sistema Campus Virtual Training
- **Sintassi** per configurazione scenari e tutorial
- **Parametri** camera, illuminazione, animazioni
- **Workflow** completo creazione contenuti
- **Risoluzione** problemi comuni

### Prossimi passi:
1. **Praticare** con scenario semplice
2. **Sperimentare** parametri camera e animazioni
3. **Creare** primi contenuti personalizzati
4. **Testare** con utenti target
5. **Iterare** e migliorare basandosi su feedback

### Vantaggi ottenuti:
- **Autonomia** nella creazione contenuti formativi
- **Personalizzazione** per esigenze specifiche aziendali
- **Aggiornamento** rapido procedure operative
- **Standardizzazione** formazione tecnica
- **Riduzione** tempi e costi sviluppo

**Il sistema è ora nelle vostre mani esperte!**