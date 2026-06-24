# Campus Virtual Training - Documentazione Tecnica

**Stack**: Three.js r155, ES6, CSS modulare | **Target**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
**Server**: `python -m http.server 8000` → `index.html` → Login (users.txt: `username;password;yyyy-mm-dd`)
**Estensione config**: tutti i file di configurazione usano `.cvtscript` (ex `.ini`)

---

## Struttura File

```
├── index.html, users.txt, AGENTS.md
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
├── scenes/<Nome>/ config.cvtscript, tutorial.cvtscript, models/
├── cursors/       SVG cursori strumenti
└── utilimages/    Icone strumenti legenda
```

---

## Regole Sviluppo

- Un file = una responsabilità. Non modificare senza aver letto il file.
- Aggiorna questo AGENTS.md solo per **nuove funzionalità** o **modifiche architetturali**.
- Non aggiungere esempi di log console o diagrammi ASCII: riferisci ai file reali.
- Desktop e touch sono sistemi separati: le modifiche touch **non devono** alterare i controlli mouse.

---

## Sintassi Tutorial (tutorial.cvtscript)

**Versione corrente: CVTScript v3** (inglese, vocabolario chiuso, una forma per concetto). Pre-processore in `js/ui/CVTScriptV3.js` traduce v3→v2 prima del parser principale (`ui.js` parseTutorialContent). Sintassi v1 (italiano) e v2 (inglese mista) restano supportate per retrocompatibilità — i due format possono coesistere nello stesso file.

Spec completa: `docs/CVTScript_v3_spec.md`. Esempi reali: `scenes/Pompa_Becker/tutorial.cvtscript`, `scenes/Manutenzione_Elettromandrino/tutorial.cvtscript`.

### Sintassi v3 — quick reference

```ini
# Block headers (lowercase, titoli quotati per section/step)
[scene]                              # Proprietà globali (camera + posizioni iniziali)
[section "Titolo"]                   # Sezione/tutorial
[step "Titolo" auto, highlight]      # Step con flags (auto, machine, highlight)
[state nome]                         # StateGroup (varianti mutuamente esclusive)
[object nome]                        # InteractiveObject 3D
[hotspot id]   [screen id]   [screenview id.view]   [screenaction id]

# Step fields (lowercase, prosa quasi naturale)
element     = vite_coperchio_1                       # nome modello (path implicito models/X.glb)
element     = a500.Basamento_Portale_CarroY          # dot notation per child interno
tool        = hand | hex_key | wrench | air | spray  # vocabolario chiuso
description = Testo descrittivo dello step.
camera      = position (x,y,z), target (x,y,z), zoom Z, fade T, pivot (x,y,z), distance D, fov F, rotation (rx,ry,rz)
camera      = position (...), free within (min,max)  # CameraUnlocked + CameraLimits

# Azioni (verbo + named args, ripetibili — ordine = sequenza)
do : unscrew                                          # svita, distanza default 0.5
do : unscrew distance 0.3
do : screw distance 0.005
do : extract distance 0.4
do : insert distance 0.4
do : place duration 0.2                               # appoggia
do : move by (x,y,z) duration t                      # traslazione assoluta
do : move from ref by (x,y,z) duration t             # traslazione relativa a ref
do : rotate by (rx,ry,rz) duration t
do : rotate around (px,py,pz) by (rx,ry,rz) duration t
do : pump along x amplitude 0.08 cycles 10 duration 0.1 from ref
do : pump from ref between (a,b,c) and (d,e,f) cycles N duration T
do : idle reset                                       # resetCenteredOriginal
do : schermo = schermo001 ; tool = tool0             # set di stato DIRETTO (no trigger) →
                                                      # AutoSetVariant. A livello sezione viene
                                                      # applicato alla selezione del tutorial.
                                                      # Usare `do :` (non `after :`) a inizio
                                                      # sezione: lì non esiste alcun trigger.

# Drag & Drop (singola riga compatta)
drag = obj1, obj2 distance 0.3 snap offset (x,y,z)
drag = vite distance 1.5 snap targets foro_1.origin, foro_2.origin
drag = flangia distance 0.3 snap pivot (0, 0, 0.3)

# Click su element (panel button, porta, leva, vite). Una sola keyword: `element`.
# Il pre-processore deduce il tipo di interazione dal contesto dello step:
#  - `element` + `tool` + `do :`           → flusso tool (clic con strumento)
#  - `element` + `do :` (no tool)          → clic diretto → animazione
#  - `element` + `after :` (no do)         → clic → cambio stato → avanza
#  - `element` (solo, no do/after)         → clic → avanza
#  - flag `auto`/`machine` sullo step      → automatico, niente clic
element = pulpito.Pulsante_mdi
after  : schermo = schermo002                         # state.X = Y opzionale, prefisso "state." rimosso

# Click ripetuti (frame animation): aggiungi `repeat N` al valore di element
element   = remote.Pulsante_r_unlock repeat 8
animation = folder screens/mandrino at (60%, 60%) frame 20ms

# `button = ...` resta come ALIAS DEPRECATO per retrocompatibilità (warning in console).

# Holdable — l'oggetto è SEMPRE letto da `element = ...` nello stesso step.
# Forme legacy con obj inline (`pick remote at ...`, `held remote`) restano supportate
# per retrocompatibilità: l'editor le riscrive in forma nuova alla prima edit.
element = remote
hold = pick at (-0.25,-0.07,0.25) facing (0,5,0)
hold = held
hold = release

# Posizioni / rotazioni iniziali (per sezione o globali)
position = nome at (x, y, z)
rotation = nome by (rx, ry, rz)

# Companion (movimenti paralleli) — più righe = uniti in DrivenObjects
companion = flangia follows master
companion = tubograsso moves by (0, 0, 0.005) duration 0.5

# Message modal
message = Testo del messaggio.
title   = ⚠️ Importante
video   = media/x.mp4
image   = scenes/X/img.jpg
```

### Mapping v3 → semantica interna (v2/v1)

Il pre-processore `window.CVTScriptV3.preprocess(content)` trasforma:

| v3 syntax | → v2/v1 emit | Note |
|---|---|---|
| `[step "X" auto, highlight]` | `[Step - X \| auto, highlight]` | flag space-separated o virgola |
| `[section "X"]` | `[Section - X]` | |
| `[state X]` / `[object X]` | `[StateGroup:X]` / `[InteractiveObject:X]` | |
| `[scene]` | (riga scartata) | proprietà restano globali |
| `element = X` | `Element=X` (poi `Elemento=models/X.glb`) | dot notation per child |
| `tool = hand` | `Tool=Mani` (poi `Utensile=Mani`) | enum chiuso |
| `description =` / `message =` / `title =` / `video =` | `Description=` / `Message=` / `MessageTitle=` / `MessageVideo=` | |
| `do : unscrew distance 0.3` | `Action${n}=unscrew(0.3)` (poi `svita(0.3)`) | auto-numerato per step |
| `do : move by (x,y,z) duration t` | `Action${n}=translate:(x,y,z,t)` (poi `traslazione:`) | |
| `do : key = val [; key2 = val2]` | `AutoSetVariant=key=val;key2=val2` | set stato diretto, valido anche a livello sezione |
| `position = a500.Child at (x,y,z)` | `Posizione=a500.Child:(x,y,z)` | riferimenti annidati risolti da `Scene3D.resolveModelRef` |
| `do : pump along x amplitude A cycles N duration T from ref` | `Action${n}=pump:ref(axis=x, amplitude=A, ...)` | |
| `camera = position (..), target (..), zoom Z, fade T` | righe `CameraPos=(...)`, `CameraTarget=(...)`, `CameraZoom=Z`, `CameraTransitionTime=T` | una riga → multiple |
| `drag = obj distance D snap offset (x,y,z)` | `DragDrop=true` + `DragDropObjects=obj` + `DragDropDistance=D` + `SnapPoint=offset:(x,y,z)` | |
| `hold = pick at (...) facing (...)` | `HoldAction=pick` + `Holdable=true` + `HoldPosition=(...)` + `HoldRotation=(...)` | Oggetto da `element = ...` |
| `hold = pick obj at (...) facing (...)` | `HoldAction=pick` + `Holdable=true` + `Element=obj` + `HoldPosition=(...)` + `HoldRotation=(...)` | Forma legacy (obj inline) |
| `element = X` + `after : key = val` (no tool, no do, no auto/machine) | `Element=X` + `Button=X` + `AfterClick=key=val` (poi espanso) | trigger compatto auto-advance |
| `element = X` + `do : ...` (no tool, no auto/machine) | `Element=X` + `Action${n}=...` + `ActiveButtons=meshName` + `AcceptTrigger_Physical=X` | clic → animazione (no AutoAdvance) |
| `element = X repeat N` + `do :` o `animation =` | `+ AnimatedMaxTriggers=N` | multi-trigger frame |
| `button = X [wait\|repeat N]` (DEPRECATO) | come `element = X` ma forza il flag esplicito wait/repeat | warning in console |
| `companion = X follows master` | segmento `X.glb,follow` aggiunto a `DrivenObjects=` | merge cross-line |
| `position = X at (x,y,z)` / `rotation = X by (rx,ry,rz)` | `Posizione=X:(x,y,z)` / `Rotazione=X:(rx,ry,rz)` | |

**Regola di disambiguazione**: chiavi totalmente lowercase = v3 (vengono pre-processate). Chiavi TitleCase (`Element=`, `Tool=`, `Action1=`, `ActiveButtons=`, `Posizione=`, ecc.) = v1/v2 native, pass-through inalterato. Questo permette di mescolare v3 con frammenti legacy nello stesso file.

### Struttura base (legacy v1/v2 — ancora supportata)

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
Azione1=oscillazione:ref,(posAx,posAy,posAz,posBx,posBy,posBz,cicli,durata_ciclo)
                                       # Movimento oscillante ripetitivo (es. pompaggio)
                                       # Genera N cicli di traslazione alternata tra posA e posB
                                       # ref = riferimento posizione (es. tappino_grasso_dx_original)
Azione2=...                            # Fino a AzioneN (senza limite)
```

> La direzione di svita/estrai viene letta da `home_config.cvtscript` → sezione del modello → `direction=x,y,z`

#### Camera

```ini
CameraPos=(x,y,z)
CameraTarget=nome_oggetto       # Punta al centro del bounding box
CameraPivot=(x,y,z)
CameraRotation=(rx,ry,rz)
CameraDistance=1.5               # Distanza assoluta dal target (ricalcola posizione)
CameraZoom=1.2                   # Distanza dal pivot (interpola senza richiedere CameraPos)
CameraFOV=75
CameraTransitionTime=1.2        # Durata transizione camera (secondi)
```

> **Ereditarietà camera**: gli step ereditano le proprietà camera dalla sezione tutorial o dallo step precedente. Specificare camera nello step solo se cambia rispetto al contesto precedente. Questo elimina la necessità di copiare le stesse righe camera in ogni step consecutivo.
>
> **CameraDistance vs CameraZoom**: sono diversi. `CameraDistance` ricalcola `targetPosition` lungo la direzione CameraPos→CameraTarget alla distanza esatta. `CameraZoom` interpola la distanza dal pivot senza richiedere CameraPos/CameraTarget. Usare `CameraDistance` quando si specificano CameraPos+CameraTarget, `CameraZoom` quando si vuole solo cambiare la distanza mantenendo l'angolazione corrente.

#### Posizionamento modelli

```ini
Posizione=modello:(x,y,z)       # Posiziona modello (globale o per-step)
Rotazione=modello:(rx,ry,rz)    # Ruota modello (gradi)
```

#### Drag & Drop

```ini
DragDrop=true
DragDropObjects=obj1,obj2       # Oggetti trascinabili (sostituisce AllowedComponents)
DragDropDistance=0.3            # Soglia snap

# Snap a coordinate fisse (globale: tutti gli oggetti usano tutti i punti)
SnapPoint=(0.5,0.2,0.3),(-0.1,0,0.5)
# Snap per-oggetto (formato vecchio, con :)
SnapPoint=filtro:(0.5,0.2,0.3);vite:(-0.1,0,0.5)
# Snap usando pivot point (invece del centro bounding box)
SnapPoint=pivot:(0.5,0.2,0.3)
# Snap a posizione originale + offset
SnapPoint=offset:(0,0,0.02)

# Snap a posizioni originali di altri oggetti (globale)
SnapTargets=estrattoresx_original,estrattoredx_original
# Per-oggetto (formato vecchio, con :)
SnapTargets=vite_A:foro_1_original,foro_2_original;vite_B:foro_1_original

ShowSnapIndicators=false        # Nascondi sfere verdi snap (default: false)
```

> `modello_original` è un riferimento virtuale alla posizione iniziale di caricamento del modello.
>
> **Comandi deprecati** (ancora supportati per retrocompatibilità): `AssemblyMode=true`, `AllowedComponents=` (usare `DragDropObjects=`), `ValidateAssembly=true`, `SnapPointPivot=` (usare `SnapPoint=pivot:`), `SnapOffset=` (usare `SnapPoint=offset:`).

#### DrivenObjects — movimenti secondari paralleli

```ini
# Oggetto con azione propria (si muove in parallelo al master)
DrivenObjects=flangia.glb,traslazione:(0,0,0.1,0.5)

# Oggetto slave (segue rigidamente il master 1:1)
DrivenObjects=tubograsso.glb,follow

# Multipli (separati da ;)
DrivenObjects=flangia.glb,traslazione:(0,0,0.1,0.5);tubo.glb,follow
```

> Solo il master controlla l'avanzamento step. I driven non bloccano il tutorial.
> **Comando deprecato**: `SlaveObjects=` (usare `DrivenObjects=xxx,follow`).

#### AutoExecute / AutoSetVariant / Autoaction

```ini
AutoExecute=true         # Avvia animazione automaticamente senza click utente
AutoSetVariant=led=on    # Cambia variante StateGroup (sincrono, poi avanza dopo 300ms)
AutoSetVariant=g1=v1;g2=v2  # Multipli cambi
Autoaction=true          # Esecuzione completamente automatica: equipaggia Utensile,
                         # esegue tutte le Azioni, avanza allo step successivo
```

> Step con AutoExecute: animazione parte a T+300ms, avanza a T+animazione+200ms.
> Step solo AutoSetVariant: avanza a T+300ms.
> Step con Autoaction: equivale a `AutoExecute=true` + `AutoAdvance=true` + auto-equip Utensile. Utile per sequenze ripetitive (es. rimozione viti consecutive).
> Step con Autoaction + DragDrop: gli oggetti vengono automaticamente snappati alla posizione target (auto-snap senza trascinamento utente), poi avanza allo step successivo.

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

# Evidenziazione automatica del pulsante richiesto (velatura gialla emissiva)
HighlightOpacity=0.5     # 0.0-1.0, default 0.5. Forza della tinta gialla.
                         # emissiveIntensity = HighlightOpacity × highlightIntensityScale (default 0.6).
                         # Il materiale resta opaco di default (i dettagli del pulsante restano visibili
                         # sotto la velatura). Per il vecchio look "see-through" abilita
                         # InteractiveObject3D.setHighlightFadeMaterial(true).
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

## Config Scenario (config.cvtscript)

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

> Se `Configuration=` non è specificato in `home_config.cvtscript`, il sistema usa i 4 tool di default.
> Icone in `utilimages/`, cursori in `cursors/`.

---

## home_config.cvtscript — Configurazione Scenari e Direzioni

```ini
[NomeScenario]
Scenario=scenes/NomeScenario
Tutorial=scenes/NomeScenario/tutorial.cvtscript
Configuration=scenes/NomeScenario/config.cvtscript

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
InteractiveObject3D.setHighlightColor(0xffaa00)        // Cambia colore tinta (default 0xffff00)
InteractiveObject3D.setHighlightIntensity(0.6)         // Cambia scala emissive (default 0.6)
InteractiveObject3D.setHighlightFadeMaterial(true,0.5) // Riabilita "see-through" se desiderato

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
| Snap schermate (ScreenSnap) | `js/core/ScreenSnapRegistry.js` | `window.ScreenSnapRegistry` |
| PNG→GLB utility | `js/core/PngToGlbUtility.js` | `window.PngToGlbUtility` |
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
| Pannello editor Schermate | `js/editor/ScreenPanel.js` | `window.EditorScreenPanel` |

---

## PNG→GLB utility (schermate software macchina)

**Obiettivo**: una schermata 2D del software macchina (PNG screen-grab) viene trasformata in un quad 3D (`PlaneGeometry(1, 1/aspect)`) con `MeshBasicMaterial` map+`toneMapped:false`+`SRGBColorSpace` → schermo sempre "acceso", non oscurato dalle luci di scena. Il quad viene poi agganciato automaticamente al frame del monitor di un modello macchina già in scena, con fit "contain".

**API** (`window.PngToGlbUtility`):
- `loadPngTexture(File|Blob|Uint8Array|url) → Promise<{texture, image, pngBytes, width, height, aspect}>`
- `buildScreenMesh(textureData) → THREE.Mesh` (con `userData.aspect`, `userData.isPngScreen`)
- `exportMeshAsGlb(mesh, {pngBytes, meshName?, filename?, download?}) → Promise<Blob>` (`model/gltf-binary`)
- `pngToGlb(input, opts) → Promise<{blob, mesh, width, height, aspect}>` — pipeline end-to-end

Il GLB esportato dichiara `KHR_materials_unlit`: ricaricato dal `GLTFLoader` esistente, il materiale viene mappato a `MeshBasicMaterial` (schermo acceso). L'aspect viene salvato in `node.extras` e su `mesh.userData.aspect`.

### Snap point "screen" — sintassi `[ScreenSnap:id]`

Definisce il frame di un monitor (posa + dimensioni reali in metri). Dichiarato come blocco globale del `tutorial.cvtscript` (o `config.cvtscript`):

```ini
[ScreenSnap:monitor_a500]
Name=Monitor Principale         # opzionale
Position=(0.32, 1.05, -0.18)    # centro del frame in coord. mondo
Rotation=(0, -15, 0)            # gradi (alternativa a Normal)
# Normal=(0, 0, 1)              # vettore normale al frame (alternativa a Rotation)
Width=0.32                      # metri
Height=0.18                     # metri
Target=a500.SchermoMonitor      # opzionale: ref al child del modello macchina
```

Registrazione: il parser `UITutorialParser` accumula i blocchi in `screenDefinitions.screenSnaps` e li passa a `window.ScreenSnapRegistry.register(id, props)`.

### Snap runtime

`DragDropSystem.setScreenSnapTarget(objectName, screenSnapId)` registra l'aggancio. Al drag, `SnapSystem.findSnapTarget` rileva la condizione `isScreenSnap` e ritorna la posizione del frame con offset `+0.001` lungo la normale (anti z-fighting). `SnapSystem._performScreenSnap` allinea rotazione al frame e applica il fit "contain": `scale = min(Width, Height * aspect)` (uniforme).

Un solo schermo per frame: lo slot viene marcato occupato con chiave `screensnap:<id>` nello `occupiedSnapPositions`.

### UI editor — tab "Schermate"

Aperto via Editor scenari (richiede ruolo admin). Flusso:
1. Drop/selezione PNG → preview + aspect
2. "Carica in viewport" → mesh aggiunto alla scena live, draggabile
3. Dropdown ScreenSnap registrati nella scena corrente → "Aggancia allo schermo" simula lo snap con la stessa logica del runtime
4. "Esporta GLB" → scarica `<nome>.glb` (`model/gltf-binary`) ricaricabile come modello di scenario.

---

## Note Architetturali Importanti

**`element` unificato (CVTScript v3.1)**: in v3.1 la keyword `button` dello step è stata assorbita da `element`. Tutto quello su cui l'utente clicca si chiama `element`. Il pre-processore `js/ui/CVTScriptV3.js` deduce a fine step se l'`element` è anche un trigger fisico, in base alla presenza di `tool`, `do :`, `after :` e dei flag `auto`/`machine` (vedi tabella di disambiguazione in `docs/CVTScript_v3_spec.md` §3.2.1). `button = ...` resta come alias deprecato con warning in console — i tutorial nuovi devono usare solo `element`. La parola `button` continua a esistere come **tipo di child** dentro `[InteractiveObject ...]` / `[object ...]` (`InteractiveChild=Pulsante_mdi,button,...`): è un altro contesto, non un campo di step.

**AutoAdvance default**: `false` — gli step con trigger fisico/schermo **aspettano** che l'utente clicchi →. Usare `AutoAdvance=true` solo per step puramente automatici.

**Step bloccanti**: ogni step attende il completamento delle animazioni prima di avanzare (polling interno). Timeout max 5s poi avanza comunque.

**Blender export**: oggetti con nome ≠ datablock vengono esportati come `Group > Mesh`. `InteractiveObject3D` gestisce entrambi i casi. Materiali con nome che contiene `luminoso`/`emissive`/`glow` vengono potenziati automaticamente a `emissiveIntensity=3.0`.

**Riferimento `_original`**: `modello_original` è un riferimento virtuale creato automaticamente alla posizione di caricamento del modello. Usato in SnapTargets e traslazioni relative.

**Fast-forward jumpToStep**: applica automaticamente trasformazioni statiche (Posizione/Rotazione) e animazioni (svita, traslazione, ecc.) di tutti gli step precedenti. Non supporta `centro:...;rotazione:...` (cambio pivot) — usa `jumpToStep(N, false)` per saltare senza fast-forward.

**StepGatingManager**: `currentStepIndex = -1` = tutorial non avviato → tutti i pulsanti 3D bloccati globalmente. I pulsanti si attivano solo con `ActiveButtons=` nello step o con permesso globale.

**Camera reset step**: il pulsante reset camera memorizza la posizione DOPO che l'animazione di highlight è completata. Il delay è dinamico: `CameraTransitionTime * 1000 + 300ms`. Vedere `js/ui.js` metodo `saveStepCameraState()`.

**SnapTargets globale vs per-oggetto**: sistema auto-rileva il formato. Presenza di `:` nel valore = formato vecchio per-oggetto. Assenza = formato nuovo globale (tutti gli oggetti usano tutti i target).

**Ereditarietà camera**: il parser (`TutorialManager.js`) applica ereditarietà automatica delle proprietà camera. Le proprietà camera definite nella sezione tutorial vengono ereditate da tutti gli step. Ogni step può sovrascrivere singole proprietà camera. Se uno step non specifica camera, eredita tutto dal contesto precedente (sezione o step precedente). Proprietà ereditabili: CameraPos, CameraTarget, CameraRotation, CameraPivot, CameraDistance, CameraFOV, CameraTransitionTime, CameraZoom.

**Oscillazione**: il comando `oscillazione:ref,(posAx,posAy,posAz,posBx,posBy,posBz,cicli,durata_ciclo)` viene espanso dal `MovementParser` in N coppie di traslazione alternata (posA→posB). L'AnimationSystem lo esegue come step multipli normali.
