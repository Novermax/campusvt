# Campus Virtual Training - Documentazione Tecnica

**Stack**: Three.js r155, ES6, CSS modulare | **Target**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
**Server**: `python -m http.server 8000` → `index.html` → Login (users.txt: `username;password;yyyy-mm-dd`)

---

## Struttura File

```
├── index.html, users.txt, CLAUDE.md
├── css/           base.css, components.css, layout.css, pages.css
├── js/
│   ├── app.js, ui.js, scene3d-modular.js, modelloader.js
│   ├── core/      DragDropSystem, SnapSystem, AnimationSystem, HighlightSystem,
│   │              ScreenSystem, HoldableSystem, AnimatedWindowSystem,
│   │              InteractiveObject3D, StepController, StepGatingManager,
│   │              ToolRegistry, ParticleSystem
│   ├── touch/     index.js, TouchEventDispatcher, GestureRecognizer,
│   │              TouchInputRouter, TouchCameraHandler, TouchDragHandler,
│   │              TouchUIHandler, TouchInteractive3DHandler
│   └── ui/        TutorialManager, ModelManager, ScenarioManager, ToolsManager,
│                  UICore, PageManager, DynamicToolStyles
├── scenes/<Nome>/ config.ini, tutorial.ini, models/
├── cursors/       SVG cursori strumenti
└── utilimages/    Icone strumenti legenda
```

---

## Regole Sviluppo

- Un file = una responsabilità. Non modificare senza aver letto il file.
- Aggiorna questo CLAUDE.md solo per **nuove funzionalità** o **modifiche architetturali**.
- Non aggiungere esempi di log console o diagrammi ASCII: riferisci ai file reali.
- Desktop e touch sono sistemi separati: le modifiche touch **non devono** alterare i controlli mouse.

---

## Sintassi Tutorial (tutorial.ini)

### Struttura base

```ini
# Sezioni globali (prima di [Tutorial]) → applicate al caricamento scenario
[Screen:id]          # Schermo interattivo
[ScreenView:id.view] # Vista schermo (GLB separato)
[Hotspot:id]         # Zona interattiva su schermo
[ScreenAction:id]    # Azione eseguita da hotspot
[InteractiveObject:id] # Oggetto 3D con figli interattivi
[StateGroup:id]      # Varianti visive mutuamente esclusive (es. LED on/off)

[Tutorial]           # Inizio sezione tutorial

[Step N - Titolo]    # Step singolo
Proprieta=Valore
```

---

### Proprietà Step — Riferimento Completo

#### Elemento e utensile

```ini
Elemento=models/vite.glb         # Oggetto target dello step
TargetChild=NomeNodoFiglio       # Anima un child interno al GLB invece del root
Utensile=Aria|Spray|ChiaveBrugola|ChiaveInglese|Mani
Descrizione=Testo fumetto
```

#### Azioni animate

```ini
Azione1=traslazione:(x,y,z,durata)     # Traslazione
Azione1=rotazione:(rx,ry,rz,durata)    # Rotazione (gradi)
Azione1=appoggia(durata)               # Posiziona a Y=0 (calcola BB automaticamente)
Azione1=svita                          # Rotazione + traslazione lungo direction (dist. default 0.5)
Azione1=svita(0.8)                     # Distanza personalizzata
Azione1=avvita                         # Inverso di svita (default 0.5)
Azione1=avvita(0.8)
Azione1=estrai                         # Traslazione lungo direction (default 0.4)
Azione1=estrai(0.6)
Azione1=inserisci                      # Inverso di estrai (default 0.4)
Azione1=inserisci(0.6)
Azione2=...                            # Fino a Azione9
```

> La direzione di svita/estrai viene letta da `home_config.ini` → sezione del modello → `direction=x,y,z`

#### Camera

```ini
CameraPos=(x,y,z)
CameraTarget=nome_oggetto       # Punta al centro del bounding box
CameraPivot=(x,y,z)
CameraRotation=(rx,ry,rz)
CameraDistance=1.5
CameraFOV=75
CameraTransitionTime=1.2        # Durata transizione camera (secondi)
```

#### Posizionamento modelli

```ini
Posizione=modello:(x,y,z)       # Posiziona modello (globale o per-step)
Rotazione=modello:(rx,ry,rz)    # Ruota modello (gradi)
```

#### Drag & Drop

```ini
DragDrop=true
DragDropObjects=obj1,obj2
DragDropDistance=0.3            # Soglia snap

# Snap a coordinate fisse (globale: tutti gli oggetti usano tutti i punti)
SnapPoint=(0.5,0.2,0.3),(-0.1,0,0.5)
# Snap per-oggetto (formato vecchio, con :)
SnapPoint=filtro:(0.5,0.2,0.3);vite:(-0.1,0,0.5)

# Snap a posizioni originali di altri oggetti (globale)
SnapTargets=estrattoresx_original,estrattoredx_original
# Per-oggetto (formato vecchio, con :)
SnapTargets=vite_A:foro_1_original,foro_2_original;vite_B:foro_1_original

ShowSnapIndicators=false        # Nascondi sfere verdi snap (default: false)
```

> `modello_original` è un riferimento virtuale alla posizione iniziale di caricamento del modello.

#### DrivenObjects — movimenti secondari paralleli

```ini
# Singolo oggetto driven (si muove in parallelo al master, durata/direzione indipendenti)
DrivenObject=tubo.glb,traslazione:(x,y,z,durata)

# Multipli (separati da ;)
DrivenObjects=flangia.glb,traslazione:(0,0,0.1,0.5);tubo.glb,traslazione:(0,0,0.05,0.5)
```

> Solo il master controlla l'avanzamento step. I driven non bloccano il tutorial.

#### AutoExecute / AutoSetVariant

```ini
AutoExecute=true         # Avvia animazione automaticamente senza click utente
AutoSetVariant=led=on    # Cambia variante StateGroup (sincrono, poi avanza dopo 300ms)
AutoSetVariant=g1=v1;g2=v2  # Multipli cambi
```

> Step con AutoExecute: animazione parte a T+300ms, avanza a T+animazione+200ms.
> Step solo AutoSetVariant: avanza a T+300ms.

#### StepController — trigger da sorgenti diverse

```ini
AcceptTrigger_Physical=pulpito.Pulsante_mdi   # Pulsante 3D (NomeModello.NomeMesh)
AcceptTrigger_Screen=pannello.btn_start        # Hotspot schermo
AcceptTrigger_Holdable=telecomando.use

OnPhysicalTrigger=setVariant:schermo=schermo002
OnScreenTrigger=Animation:pompa,rotazione:(0,0,360,1)
OnAnyTrigger=Sound:sounds/click.mp3
OnPhysicalTrigger_SetView=pulpito.running     # Cambia vista schermo dopo trigger

AutoAdvance=false        # Default: utente clicca → per avanzare. true = automatico dopo 500ms.

# Evidenziazione automatica del pulsante richiesto (giallo emissivo)
HighlightOpacity=0.5     # 0.0-1.0, default 0.5 (emissiveIntensity = opacity × 2.0)
ActiveButtons=Pulsante_mdi,Pulsante_tool  # Solo questi pulsanti rispondono nello step
```

#### ScreenSystem — schermi interattivi

```ini
ScreenMode=true
ScreenView=home                   # Vista iniziale
RequiredHotspot=btn_start         # Hotspot da premere per completare step
RequiredSequence=key_1,key_9,key_ok  # Sequenza obbligatoria
```

#### HoldableSystem — oggetti in mano

```ini
HoldAction=pick          # Prendi oggetto (deve avere Holdable=true nella def. globale)
HoldAction=release       # Rilascia oggetto
HoldState=held           # Step richiede oggetto già in mano
```

#### AnimatedWindow — sequenza immagini 2D

```ini
AnimatedImages=img1.png,img2.png,img3.png
AnimatedPosition=center           # center|top-left|top-right|bottom-left|(x,y)
AnimatedAnchor=center
AnimatedScale=1.0
AnimatedWidth=600                 # px (override scale)
AnimatedHeight=400                # px (override scale)
AnimatedMaxTriggers=2             # Numero trigger avanti+indietro prima di chiusura
AnimatedFrameDelay=100            # ms tra frame
```

#### Modal informativo

```ini
Message=Testo del messaggio. Supporta \n per a capo.
MessageTitle=Titolo Modal         # Default: titolo step
MessageImage=scenes/X/img.jpg    # Mostra immagine nel modal
MessageVideo=scenes/X/video.mp4  # Mostra video con controlli player
```

> Step con solo Message (senza Elemento/DragDrop) avanza automaticamente dopo click OK.

#### StepGatingManager — blocco pre-tutorial / gating camera

```ini
CameraUnlocked=true              # Sblocca rotazione camera completa per questo step
CameraLimits=(minPhi,maxPhi)     # Limiti in radianti
```

> Prima di avviare il tutorial (`currentStepIndex = -1`) **tutti i pulsanti 3D sono bloccati**.

---

### Sezioni Globali (prima di [Tutorial])

#### ScreenSystem

```ini
[Screen:id]
Container=models/corpo.glb
DefaultView=home
CameraDistance=0.6
CameraAngle=perpendicular
Holdable=true                    # Opzionale: oggetto impugnabile
HoldPosition=(-0.25,-0.15,0.4)
HoldRotation=(15,-30,5)

[ScreenView:id.home]
Model=models/schermo_home.glb
Hotspots=btn_a,btn_b

[Hotspot:btn_a]
Position=(-0.08,0.04,0.002)
Size=(0.06,0.03)
Label=AVVIA
HighlightColor=rgba(0,255,0,0.4)
NextView=id.altro_schermo        # Naviga a un'altra vista
OnClick=Action:nome_azione       # Esegui azione

[ScreenAction:nome_azione]
Target=models/pompa.glb
Animation=rotazione:(0,0,360,1)
Sound=sounds/pump.mp3
```

#### InteractiveObject3D

```ini
[InteractiveObject:pulpito]
Model=models/pulpito.glb
InteractiveChild=chiave,rotary,states:off|on,rotationAxis:z,rotationAngles:off=0|on=45
InteractiveChild=led_on,indicator,visibleWhen:chiave=on
InteractiveChild=led_off,indicator,visibleWhen:chiave=off
InteractiveChild=btn_menu,button,onClick:setVariant:schermo=schermo001
InitialState=chiave:off,currentScreen:home
```

> Tipi child: `button` (click→evento), `rotary` (click→cicla stati+rotazione), `indicator` (visibilità da stato), `screen` (visibilità da currentScreen).

#### StateGroup

```ini
[StateGroup:schermo]
Variants=schermo.000,schermo.001,schermo.002
Default=schermo.000
```

---

## Config Scenario (config.ini)

```ini
[Tools]
Tool=brugola
Tool=chiave_inglese
Tool=mano
Tool=aria

[Tool:brugola]
Label=Chiave a Brugola
Icon=utilimages/brugola.png
Cursor=cursors/brugola_normale.svg
CursorPressed=cursors/brugola_premuto_frame1.svg
CursorPressedFrame2=cursors/brugola_premuto_frame2.svg
CursorHotspotX=4
CursorHotspotY=9
Type=tool                        # tool | hand
TutorialNames=ChiaveBrugola,brugola
```

> Se `Configuration=` non è specificato in `home_config.ini`, il sistema usa i 4 tool di default.
> Icone in `utilimages/`, cursori in `cursors/`.

---

## home_config.ini — Configurazione Scenari e Direzioni

```ini
[NomeScenario]
Scenario=scenes/NomeScenario
Tutorial=scenes/NomeScenario/tutorial.ini
Configuration=scenes/NomeScenario/config.ini

# Direzioni svita/estrai per ogni modello
[models/vite.glb]
direction=0,0,1

[models/filtro.glb]
direction=0,1,0
```

---

## Debug Console

```javascript
// Camera
Scene3D.getCameraInfo()                     // Leggi posizione + sintassi pronta per tutorial
Scene3D.setCameraFromInfo({ position, rotation, pivot, distance, fov, animate, duration })
Scene3D.panCamera(deltaX, deltaY)
Scene3D.listAvailableObjects()
Scene3D.exportCurrentModelPositions()       // Download sintassi Posizione=/Rotazione=
Scene3D.listChildNames(Scene3D.findModelByName('a500'))  // Trova nomi TargetChild

// Navigazione tutorial (da console)
jumpToStep(5)                // Salta con fast-forward (applica trasformazioni precedenti)
jumpToStep(5, false)         // Salta senza fast-forward (solo debug)
listSteps()
findStep("vite")             // Cerca per parola chiave, auto-salta se 1 risultato

// DragDrop
DragDropSystem.isEnabled()
DragDropSystem.debugSnapSystem()
DragDropSystem.setSnapDistance(1.5)
DragDropSystem.setCustomSnapPosition('filtro', 0.5, 0.2, 0.3)
DragDropSystem.setMultipleSnapTargets('vite_A', ['foro_1_original', 'foro_2_original'])

// Sistemi interattivi
ScreenSystem.listScreens()
ScreenSystem.setView('pannello', 'menu')
ScreenSystem.debugInfo()

HoldableSystem.listHoldables()
HoldableSystem.pickObject('telecomando')
HoldableSystem.releaseAll()

InteractiveObject3D.listObjects()
InteractiveObject3D.getState('pulpito')
InteractiveObject3D.setState('pulpito', 'chiave', 'on')
InteractiveObject3D.setStateVariant('schermo', 'schermo.001')
InteractiveObject3D.highlightRequiredButtons(['pulpito.Pulsante_mdi'], 0.5)
InteractiveObject3D.clearButtonHighlights()

StepController.debugInfo()
StepController.simulateTrigger('physical', 'pulpito.Pulsante_mdi')
StepGatingManager.isButtonActive('Pulsante_mdi')

AnimatedWindowSystem.test(5)   // Test con 5 frame placeholder
AnimatedWindowSystem.hide()

// Particelle
ParticleSystem.testAirJet()
ParticleSystem.clearAllEffects()

// Touch
TouchSystem.debugInfo()
TouchSystem.setEnabled(false)
```

---

## Touch System (mobile)

**Moduli**: `js/touch/` — 8 file coordinati da `index.js`

**Priorità routing** (determineLayer): UI(3) > Interactive3D(2) > Object3D(1) > Camera(0)

**Gesture attive** (v1.2.0):
- 1 dito tap → P1 Actionable (azione tool) oppure P2 Movable (selezione+ghost) oppure P3 Placement
- 1 dito drag → Camera orbit (solo se layer=CAMERA, nessun oggetto sotto)
- 1 dito drag su oggetto movable → DragDrop (solo se step ha `DragDrop=true`)
- 2 dita pinch → Zoom (sensibilità: `TouchCameraHandler.config.zoomSensitivity=0.003`)
- 2 dita drag/double-tap → DISABILITATI

**Ghost Target**: quando oggetto selezionato (P2), mesh semi-trasparente segue il dito in real-time. Verde = snap raggiungibile, Rosso = no.

**Vincolo**: UN SOLO evento per tap. Se l'oggetto ha azione tutorial → SOLO azione (no pivot). Altrimenti → SOLO pivot camera (no azioni). (`TouchDragHandler.hasTutorialAction()`)

**Desktop**: handler mouse (`onMouseDown/Move/Up`) bloccati automaticamente quando `TouchSystem.initialized=true`.

---

## Sistemi Core — File di Riferimento

| Sistema | File principale | API globale |
|---------|----------------|-------------|
| Rendering 3D | `js/scene3d-modular.js` | `window.Scene3D` |
| UI Tutorial | `js/ui.js` | `window.UI` |
| Drag & Drop + Snap | `js/core/DragDropSystem.js`, `SnapSystem.js` | `window.DragDropSystem` |
| Schermi Interattivi | `js/core/ScreenSystem.js` | `window.ScreenSystem` |
| Oggetti in Mano | `js/core/HoldableSystem.js` | `window.HoldableSystem` |
| Pulsanti/LED 3D | `js/core/InteractiveObject3D.js` | `window.InteractiveObject3D` |
| Trigger Step | `js/core/StepController.js` | `window.StepController` |
| Gating Step | `js/core/StepGatingManager.js` | `window.StepGatingManager` |
| Particelle | `js/core/ParticleSystem.js` | `window.ParticleSystem` |
| Finestra Animata | `js/core/AnimatedWindowSystem.js` | `window.AnimatedWindowSystem` |
| Tool Config | `js/core/ToolRegistry.js` | `window.ToolRegistry` |
| CSS Tool Dinamico | `js/ui/DynamicToolStyles.js` | `window.DynamicToolStyles` |
| AutoMode Mobile | `js/AutoMode.js` | `window.AutoMode` |
| Mobile Browser UI | `js/MobileBrowserUI.js` | `window.MobileBrowserUI` |
| Mobile Optimizer | `js/MobileOptimizer.js` | `window.MobileOptimizer` |

---

## Note Architetturali Importanti

**AutoAdvance default**: `false` — gli step con trigger fisico/schermo **aspettano** che l'utente clicchi →. Usare `AutoAdvance=true` solo per step puramente automatici.

**Step bloccanti**: ogni step attende il completamento delle animazioni prima di avanzare (polling interno). Timeout max 5s poi avanza comunque.

**Blender export**: oggetti con nome ≠ datablock vengono esportati come `Group > Mesh`. `InteractiveObject3D` gestisce entrambi i casi. Materiali con nome che contiene `luminoso`/`emissive`/`glow` vengono potenziati automaticamente a `emissiveIntensity=3.0`.

**Riferimento `_original`**: `modello_original` è un riferimento virtuale creato automaticamente alla posizione di caricamento del modello. Usato in SnapTargets e traslazioni relative.

**Fast-forward jumpToStep**: applica automaticamente trasformazioni statiche (Posizione/Rotazione) e animazioni (svita, traslazione, ecc.) di tutti gli step precedenti. Non supporta `centro:...;rotazione:...` (cambio pivot) — usa `jumpToStep(N, false)` per saltare senza fast-forward.

**StepGatingManager**: `currentStepIndex = -1` = tutorial non avviato → tutti i pulsanti 3D bloccati globalmente. I pulsanti si attivano solo con `ActiveButtons=` nello step o con permesso globale.

**Camera reset step**: il pulsante reset camera memorizza la posizione DOPO che l'animazione di highlight è completata. Il delay è dinamico: `CameraTransitionTime * 1000 + 300ms`. Vedere `js/ui.js` metodo `saveStepCameraState()`.

**SnapTargets globale vs per-oggetto**: sistema auto-rileva il formato. Presenza di `:` nel valore = formato vecchio per-oggetto. Assenza = formato nuovo globale (tutti gli oggetti usano tutti i target).
