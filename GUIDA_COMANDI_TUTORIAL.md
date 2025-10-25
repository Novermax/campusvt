# Guida Completa Comandi Tutorial.txt

Questa guida descrive tutti i comandi e funzioni utilizzati nel file `tutorial.txt` per creare tutorial interattivi 3D.

---

## 📋 INDICE

1. [Struttura Tutorial](#struttura-tutorial)
2. [Comandi Globali](#comandi-globali)
3. [Comandi Camera](#comandi-camera)
4. [Comandi Modelli](#comandi-modelli)
5. [Comandi Step](#comandi-step)
6. [Comandi Azioni](#comandi-azioni)
7. [Comandi Drag & Drop](#comandi-drag--drop)
8. [Comandi Assembly](#comandi-assembly)
9. [Comandi Messaggi](#comandi-messaggi)
10. [Esempi Completi](#esempi-completi)

---

## 1. STRUTTURA TUTORIAL

### `[Nome Tutorial]`
**Descrizione**: Definisce un tutorial principale contenente più step.

**Sintassi**:
```ini
[Nome del Tutorial]
```

**Esempio**:
```ini
[Pulizia Filtro e ingrassaggio]
[Sostituzione Palette Smontaggio]
[Riassemblaggio]
```

**Note**:
- I tutorial sono sezioni principali che contengono step multipli
- Ogni tutorial può avere proprietà globali (camera, posizionamento modelli)

---

### `[Step X - Descrizione]` o `[Next Step - Descrizione]`
**Descrizione**: Definisce uno step specifico del tutorial. Usa `[Next Step]` per numerazione automatica.

**Sintassi**:
```ini
[Step 1 - Nome Step]           # Numerazione manuale
[Next Step - Nome Step]        # Numerazione automatica (RACCOMANDATO)
[Next Step]                    # Solo numero automatico senza titolo
```

**Esempio dal file**:
```ini
[Step 1 - Prima vite]          # Manuale
[Next Step - Seconda vite]     # Automatico → diventa "Step 2 - Seconda vite"
[Next Step - Terza vite]       # Automatico → diventa "Step 3 - Terza vite"
```

**Vantaggi `[Next Step]`**:
- ✅ Inserisci step senza rinumerare tutto
- ✅ Manutenzione più semplice
- ✅ Zero errori di numerazione

---

## 2. COMANDI GLOBALI

### `Posizione=modello:(x,y,z)`
**Descrizione**: Posiziona un modello 3D a coordinate specifiche.

**Sintassi**:
```ini
Posizione=nome_modello:(x,y,z)
```

**Esempio dal file**:
```ini
Posizione=planaxis:(-0.5,0.01,-0.5)
Posizione=coperchio:(-1.148,-0.261,0.500)
Posizione=filtro:(-0.300,-0.142,0.500)
```

**Note**:
- Coordinate in unità 3D (metri)
- Può essere specificato più volte per modelli diversi
- Usato principalmente per posizionamento iniziale nei tutorial di assemblaggio

---

### `Rotazione=modello:(rx,ry,rz)`
**Descrizione**: Ruota un modello 3D attorno ai suoi assi.

**Sintassi**:
```ini
Rotazione=nome_modello:(rotazione_x,rotazione_y,rotazione_z)
```

**Esempio dal file**:
```ini
Rotazione=coperchio:(0.0,0.0,-90.0)
Rotazione=vite_coperchio_1:(-360.0,0.0,0.0)
Rotazione=ingrassatore:(0.0,0.0,90.0)
```

**Note**:
- Angoli in gradi (non radianti)
- Rotazioni applicate in ordine: X → Y → Z
- Valori negativi = rotazione oraria, positivi = antioraria

---

### `Azione1=resetCenteredOriginal`
**Descrizione**: Resetta tutti i modelli alle loro posizioni originali centrate.

**Sintassi**:
```ini
Azione1=resetCenteredOriginal
```

**Esempio dal file**:
```ini
[Pulizia Filtro e ingrassaggio]
  Azione1=resetCenteredOriginal  # Reset all'inizio del tutorial
```

**Quando usarlo**:
- All'inizio di ogni tutorial per garantire stato pulito
- Dopo operazioni complesse per tornare a stato iniziale

---

## 3. COMANDI CAMERA

### `CameraPos=(x,y,z)` o `CameraPos=modello:(offset_x,offset_y,offset_z)`
**Descrizione**: Posiziona la camera 3D.

**Sintassi**:
```ini
CameraPos=(x,y,z)                          # Coordinate assolute
CameraPos=nome_modello:(offset_x,offset_y,offset_z)  # Relativa a modello
```

**Esempio dal file**:
```ini
CameraPos=(-1.5, 0.5,-0.2)                 # Assoluta
CameraPos=(-0.2,0.33,0.74)                 # Assoluta per zoom filtro
```

**Coordinate tipiche**:
- `x < 0`: Camera a sinistra
- `y > 0`: Camera sopra
- `z < 0`: Camera davanti

---

### `CameraTarget=(x,y,z)` o `CameraTarget=modello`
**Descrizione**: Punto verso cui la camera guarda.

**Sintassi**:
```ini
CameraTarget=(x,y,z)           # Coordinate assolute
CameraTarget=nome_modello      # Centro del modello
```

**Esempio dal file**:
```ini
CameraTarget=(0, 0, 0)                     # Centro scena
CameraTarget=filtro                        # Zoom su filtro
CameraTarget=tappino_grasso_dx             # Focus su tappino destro
```

**Note**:
- Usare nome modello per follow automatico
- Coordinate assolute per punti fissi

---

### `CameraZoom=valore`
**Descrizione**: Livello di zoom della camera.

**Sintassi**:
```ini
CameraZoom=valore_numerico
```

**Esempio dal file**:
```ini
CameraZoom=1.2    # Visione d'insieme
CameraZoom=0.5    # Zoom ravvicinato su dettagli
CameraZoom=2.2    # Zoom molto ampio
```

**Valori tipici**:
- `0.3-0.5`: Zoom molto stretto (dettagli piccoli)
- `1.0-1.5`: Visione d'insieme
- `2.0+`: Visione panoramica

---

### `CameraTransitionTime=secondi`
**Descrizione**: Durata della transizione camera (movimento fluido).

**Sintassi**:
```ini
CameraTransitionTime=durata_in_secondi
```

**Esempio dal file**:
```ini
CameraTransitionTime=2.5    # Movimento dolce
CameraTransitionTime=1.0    # Movimento veloce
```

**Valori consigliati**:
- `1.0-1.5s`: Transizioni rapide
- `2.0-3.0s`: Transizioni fluide (raccomandate)
- `3.0+s`: Transizioni molto lente (cinematiche)

---

## 4. COMANDI MODELLI

### `Elemento=percorso/modello.glb`
**Descrizione**: Specifica quale modello 3D viene manipolato in questo step.

**Sintassi**:
```ini
Elemento=models/nome_modello.glb
```

**Esempio dal file**:
```ini
Elemento=models/vite_coperchio_1.glb
Elemento=models/filtro.glb
Elemento=models/coperchio.glb
Elemento=models/ingrassatore.glb
```

**Note**:
- Path relativo alla cartella dello scenario
- Formati supportati: `.glb`, `.gltf`, `.obj`, `.stl`
- Un solo elemento per step (per azioni su elemento specifico)

---

## 5. COMANDI STEP

### `Descrizione=testo`
**Descrizione**: Testo mostrato nel fumetto laterale che spiega cosa fare.

**Sintassi**:
```ini
Descrizione=Testo istruzione per l'utente
```

**Esempio dal file**:
```ini
Descrizione=Seleziona il tool "Mano" e rimuovi la prima vite del coperchio
Descrizione=Rimuovi il cappuccio di protezione dell'ingrassatore di destra
Descrizione=Applica il grasso nell'ingrassatore di destra pompando 10 volte
```

**Best Practices**:
- Sii specifico e chiaro
- Menziona l'utensile richiesto
- Indica eventuali precauzioni

---

### `Utensile=NomeUtensile`
**Descrizione**: Specifica quale strumento l'utente deve selezionare.

**Sintassi**:
```ini
Utensile=NomeUtensile
```

**Valori disponibili**:
```ini
Utensile=Mani              # Operazioni manuali
Utensile=ChiaveBrugola     # Chiave a brugola (viti esagonali)
Utensile=ChiaveInglese     # Chiave inglese (bulloni esagonali)
Utensile=Aria              # Pistola aria compressa
```

**Esempio dal file**:
```ini
[Step 1 - Prima vite]
Utensile=Mani

[Next Step - Rimuovi vite culatta]
Utensile=ChiaveBrugola

[Next Step - Rimuovi vite flangia]
Utensile=ChiaveInglese

[Next Step - Aria compressa]
Utensile=Aria
```

---

## 6. COMANDI AZIONI

### `Azione1=svita` / `Azione1=svita(distanza)`
**Descrizione**: Svita un elemento con rotazione + traslazione.

**Sintassi**:
```ini
Azione1=svita              # Distanza default 0.5 unità
Azione1=svita(distanza)    # Distanza personalizzata
```

**Esempio dal file**:
```ini
Azione1=svita              # Svita con distanza default (0.5)
Azione1=svita(0.3)         # Svita con estrazione 0.3 unità
Azione1=svita(0.1)         # Svita con estrazione minima
```

**Comportamento**:
- Rotazione automatica: +1800° (5 giri orari)
- Traslazione lungo `direction` da `home_config.txt`
- Distanza default: 0.5 unità

---

### `Azione1=avvita` / `Azione1=avvita(distanza)`
**Descrizione**: Avvita un elemento (operazione inversa di svita).

**Sintassi**:
```ini
Azione1=avvita             # Distanza default 0.5 unità
Azione1=avvita(distanza)   # Distanza personalizzata
```

**Esempio dal file**:
```ini
Azione1=avvita(0.005)      # Avvita con inserimento minimo
```

**Comportamento**:
- Rotazione automatica: -1800° (5 giri antiorari)
- Traslazione opposta a svita
- Usato principalmente per riassemblaggio

---

### `Azione1=traslazione:(x,y,z,durata)`
**Descrizione**: Sposta linearmente un modello.

**Sintassi**:
```ini
Azione1=traslazione:(offset_x,offset_y,offset_z,durata_secondi)
Azione1=traslazione:modello_original,(x,y,z,durata)  # Verso posizione originale modello
```

**Esempio dal file**:
```ini
Azione1=traslazione:(-0.5,0,0.5,0.8)              # Movimento diagonale
Azione2=traslazione:(-0.3,0,0,1.5)                # Laterale
Azione1=traslazione:tappino_grasso_dx_original,(-0.2,0.0,0,0.5)  # Verso posizione originale
```

**Note**:
- Coordinate relative alla posizione corrente
- `_original` riferisce alla posizione iniziale di un altro modello
- Durata in secondi (movimento fluido)

---

### `Azione1=rotazione:(rx,ry,rz,durata)`
**Descrizione**: Ruota un modello attorno ai suoi assi.

**Sintassi**:
```ini
Azione1=rotazione:(gradi_x,gradi_y,gradi_z,durata_secondi)
```

**Esempio dal file**:
```ini
Azione2=rotazione:(-90,0,0,0.8)    # Ruota di 90° su asse X
Azione2=rotazione:(90,0,0,0.5)     # Ruota opposto
Azione2=rotazione:(0,0,-72,0.5)    # Ruota su asse Z
```

**Note**:
- Angoli in gradi
- Negativo = orario, positivo = antiorario
- Rotazione cumulativa (si somma a rotazione corrente)

---

### `Azione1=appoggia(durata)`
**Descrizione**: Appoggia automaticamente l'elemento al pavimento (Y=0).

**Sintassi**:
```ini
Azione1=appoggia(durata_secondi)
```

**Esempio dal file**:
```ini
Azione2=appoggia(0.2)    # Appoggio rapido
Azione3=appoggia(0.5)    # Appoggio lento
Azione4=appoggia(1.5)    # Appoggio molto lento
```

**Comportamento**:
- Calcola automaticamente bounding box
- Sposta elemento fino a Y=0
- Movimento fluido con durata specificata

---

### `Azione1=centro:(x,y,z);rotazione:(rx,ry,rz,durata)`
**Descrizione**: Cambia il pivot di rotazione e ruota attorno al nuovo centro.

**Sintassi**:
```ini
Azione1=centro:(pivot_x,pivot_y,pivot_z);rotazione:(rx,ry,rz,durata)
```

**Esempio dal file**:
```ini
Azione2=centro:(0,0.1,0);rotazione:(0,0,-90,0.8)
Azione2=centro:(-0.1,0,0);rotazione:(0,0,90,0.8)
```

**Quando usarlo**:
- Per rotazioni attorno a punti diversi dal centro del modello
- Movimenti circolari complessi

**⚠️ Nota**: Non supportato dal sistema fast-forward (jumpToStep)

---

### `Azione1=estrai(distanza)` / `Azione1=inserisci(distanza)`
**Descrizione**: Estrazione/inserimento lineare senza rotazione.

**Sintassi**:
```ini
Azione1=estrai              # Default 0.4 unità
Azione1=estrai(distanza)    # Personalizzato
Azione1=inserisci           # Default 0.4 unità
Azione1=inserisci(distanza) # Personalizzato
```

**Note**:
- Movimento lungo `direction` da `home_config.txt`
- `estrai`: movimento in direzione positiva
- `inserisci`: movimento opposto
- **NON usati nel file tutorial.txt** (preferenza per `traslazione`)

---

## 7. COMANDI DRAG & DROP

### `DragDrop=true`
**Descrizione**: Abilita il sistema drag & drop per questo step.

**Sintassi**:
```ini
DragDrop=true
```

**Esempio dal file**:
```ini
[Next Step - Istruzioni smontaggio flangia]
DragDrop=true
DragDropObjects=vite_culatta_1,vite_culatta_2
```

---

### `DragDropObjects=obj1,obj2,obj3`
**Descrizione**: Lista oggetti che possono essere trascinati.

**Sintassi**:
```ini
DragDropObjects=modello1,modello2,modello3,...
```

**Esempio dal file**:
```ini
DragDropObjects=vite_culatta_1,vite_culatta_2
DragDropObjects=tappino_grasso_dx,tappino_grasso_sx
```

**Note**:
- Separare con virgola
- Nomi senza estensione `.glb`
- Tutti trascinabili contemporaneamente

---

### `DragDropDistance=valore`
**Descrizione**: Distanza massima per snap automatico (in unità 3D).

**Sintassi**:
```ini
DragDropDistance=distanza_in_unità
```

**Esempio dal file**:
```ini
DragDropDistance=0.1    # Snap molto preciso
DragDropDistance=0.2    # Snap normale
DragDropDistance=0.3    # Snap più tollerante
```

**Valori consigliati**:
- `0.1`: Per viti/componenti piccoli (alta precisione)
- `0.2-0.3`: Per componenti medi/grandi

---

### `SnapTargets=target1,target2` (Sintassi Globale Semplificata)
**Descrizione**: Punti di aggancio per oggetti draggabili. TUTTI gli oggetti possono usare TUTTI i target.

**Sintassi**:
```ini
SnapTargets=target1_original,target2_original,...
```

**Esempio dal file**:
```ini
# Formato NUOVO (globale) - RACCOMANDATO
SnapTargets=estrattoresx_original,estrattoredx_original
# Entrambe le viti possono andare su entrambi gli estrattori

# Formato VECCHIO (per-oggetto) - ancora supportato
SnapTargets=vite_A:foro_1_original,foro_2_original;vite_B:foro_1_original,foro_2_original
```

**Comportamento**:
- Sistema "first come, first served"
- Un target occupato non può essere rioccupato
- `_original` usa la posizione iniziale del modello referenziato

---

### `SnapPoint=(x,y,z),(x2,y2,z2)` (Sintassi Globale Semplificata)
**Descrizione**: Punti di snap a coordinate arbitrarie. TUTTI gli oggetti possono usare TUTTI i punti.

**Sintassi**:
```ini
SnapPoint=(x,y,z),(x2,y2,z2),...
```

**Esempio**:
```ini
# Formato NUOVO (globale) - RACCOMANDATO
SnapPoint=(0.5,0.2,0.3),(-0.1,0,0.5)
# Tutti gli oggetti DragDropObjects possono usare entrambi i punti

# Formato VECCHIO (per-oggetto) - ancora supportato
SnapPoint=filtro:(0.5,0.2,0.3);vite:(- 0.1,0,0.5)
```

**Note**:
- Coordinate assolute nello spazio 3D
- Sistema crea riferimenti virtuali `snap_point_N_original`

---

## 8. COMANDI ASSEMBLY

### `AssemblyMode=true`
**Descrizione**: Abilita modalità assemblaggio sequenziale.

**Sintassi**:
```ini
AssemblyMode=true
```

**Esempio dal file**:
```ini
[Step 1 - Tappini Ingrassatori]
DragDrop=true
AssemblyMode=true
AllowedComponents=tappino_grasso_dx,tappino_grasso_sx
```

**Quando usarlo**:
- Tutorial di riassemblaggio
- Sequenze con prerequisiti (es. filtro prima di coperchio)

---

### `AllowedComponents=comp1,comp2`
**Descrizione**: Componenti montabili in questo step (con AssemblyMode).

**Sintassi**:
```ini
AllowedComponents=componente1,componente2,...
```

**Esempio dal file**:
```ini
AllowedComponents=tappino_grasso_dx,tappino_grasso_sx  # Ordine libero
AllowedComponents=filtro                                # Solo filtro
AllowedComponents=coperchio                             # Solo coperchio dopo filtro
AllowedComponents=vite_coperchio_1,vite_coperchio_2,vite_coperchio_3,vite_coperchio_4
```

**Logica**:
- Sistema verifica prerequisiti automaticamente
- Ordine intercambiabile se nello stesso step

---

## 9. COMANDI MESSAGGI

### `Message=testo`
**Descrizione**: Mostra un modal informativo con messaggio prima delle azioni dello step.

**Sintassi**:
```ini
Message=Testo del messaggio informativo
```

**Esempio dal file**:
```ini
Message=Prendi due viti da 8mm e inseriscile nelle apposite sedi per utilizzarle come estrattore.
```

**Comportamento**:
- Modal blocca esecuzione fino a click OK
- Supporta `\n` per andare a capo
- Se step ha solo Message → auto-avanza dopo OK

---

### `MessageTitle=titolo`
**Descrizione**: Titolo personalizzato del modal (default: titolo step).

**Sintassi**:
```ini
MessageTitle=Titolo Personalizzato
```

**Esempio dal file**:
```ini
MessageTitle=⚠️ Importante
```

**Note**:
- Supporta emoji
- Opzionale (usa titolo step se non specificato)

---

### `MessageVideo=percorso/video.mp4`
**Descrizione**: Video dimostrativo nel modal informativo.

**Sintassi**:
```ini
MessageVideo=percorso/file_video.mp4
```

**Esempio dal file**:
```ini
MessageVideo=media/estrattore.mp4
```

**Formati supportati**:
- `.mp4` (raccomandato)
- `.webm`
- `.ogg`

**Comportamento**:
- Player integrato con controlli
- Auto-stop alla chiusura modal
- Max-height: 400px con auto-resize

---

### `MessageImage=percorso/immagine.jpg`
**Descrizione**: Immagine esplicativa nel modal informativo.

**Sintassi**:
```ini
MessageImage=percorso/file_immagine.jpg
```

**Formati supportati**:
- `.jpg`, `.png`, `.gif`, `.webp`

**Comportamento**:
- Auto-resize max 400px altezza
- Bordi arrotondati + ombra

---

## 10. COMANDI AVANZATI

### `SlaveObjects=obj1,obj2`
**Descrizione**: Oggetti che seguono 1:1 il movimento del master (Elemento).

**Sintassi**:
```ini
SlaveObjects=oggetto_slave1,oggetto_slave2
```

**Esempio dal file**:
```ini
[Next Step - traslazione flangia]
Elemento=models/flangia.glb
SlaveObjects=tubograsso.glb  # Tubo segue flangia esattamente
Azione1=traslazione:(0,0,0.2,0.5)
```

**Comportamento**:
- Slave copia ESATTAMENTE tutte le trasformazioni del master
- Posizione + rotazione identiche
- Movimento rigido (senza elasticità)

---

### `DrivenObjects=obj1.glb,traslazione:(x,y,z,dur);obj2.glb,traslazione:(x2,y2,z2,dur2)`
**Descrizione**: Oggetti con movimento indipendente ma sincronizzato temporalmente.

**Sintassi**:
```ini
# Singolo (backward compatible)
DrivenObject=oggetto.glb,traslazione:(x,y,z,durata)

# Multipli (NUOVO)
DrivenObjects=obj1.glb,traslazione:(x1,y1,z1,dur1);obj2.glb,traslazione:(x2,y2,z2,dur2)
```

**Esempio dal file**:
```ini
Elemento=models/vite_culatta_1.glb
Azione1=avvita(0.005)
DrivenObjects=flangia.glb,traslazione:(0,0,0.005,0.5);tubograsso.glb,traslazione:(0,0,0.005,0.5)
# Flangia e tubo si muovono insieme (metà della distanza della vite)
```

**Differenza con SlaveObjects**:
- **Slave**: Movimento 1:1 identico (rigido)
- **Driven**: Movimento completamente indipendente (flessibile/elastico)

**Quando usare**:
- Tubo flessibile che segue con elasticità
- Componenti collegati con movimento differenziato
- Effetti secondari multipli

---

## 📚 ESEMPI COMPLETI

### Esempio 1: Step Semplice con Svita
```ini
[Next Step - Rimuovi vite coperchio]
Elemento=models/vite_coperchio_1.glb
Utensile=Mani
Descrizione=Seleziona il tool "Mano" e rimuovi la prima vite del coperchio
Azione1=svita
Azione2=appoggia(0.2)
```

**Cosa fa**:
1. Mostra descrizione nel fumetto
2. Richiede utensile "Mani"
3. Svita la vite con rotazione + traslazione
4. Appoggia la vite a terra

---

### Esempio 2: Step con Camera e Traslazioni Multiple
```ini
[Next Step - Filtro]
CameraPos=(-0.2,0.33,0.74)
CameraTarget=filtro
CameraZoom=0.5
CameraTransitionTime=2.5
Elemento=models/filtro.glb
Utensile=Mani
Descrizione=Rimuovi il filtro
Azione1=traslazione:(-0.3,0,0,1.5)   # Laterale
Azione2=traslazione:(0,0,0.5,1.5)    # Avanti
Azione3=appoggia(1.5)                # A terra
```

**Cosa fa**:
1. Muove camera verso il filtro con zoom
2. Estrae filtro con 2 movimenti sequenziali
3. Appoggia il filtro a terra

---

### Esempio 3: Step Drag & Drop con Snap
```ini
[Next Step - Istruzioni smontaggio flangia]
Message=Prendi due viti da 8mm e inseriscile nelle apposite sedi per utilizzarle come estrattore.
MessageTitle=⚠️ Importante
MessageVideo=media/estrattore.mp4
DragDrop=true
DragDropObjects=vite_culatta_1,vite_culatta_2
SnapTargets=estrattoresx_original,estrattoredx_original
DragDropDistance=0.1
Utensile=Mani
```

**Cosa fa**:
1. Mostra modal con video esplicativo
2. Utente clicca OK per continuare
3. Abilita drag & drop per 2 viti
4. Viti possono andare su 2 estrattori (in qualsiasi ordine)
5. Snap automatico quando distanza < 0.1
6. Auto-avanza quando entrambe le viti snappate

---

### Esempio 4: Step Assembly Sequenziale
```ini
[Next Step - Filtro]
Descrizione=Inserisci il filtro nella sua sede. Richiede che i tappini siano già stati montati.
Utensile=Mani
DragDrop=true
AssemblyMode=true
AllowedComponents=filtro
DragDropDistance=0.3
```

**Cosa fa**:
1. Sistema verifica prerequisiti (tappini montati)
2. Solo il filtro è montabile
3. Se prerequisiti non soddisfatti → errore
4. Snap automatico quando vicino
5. Auto-avanza quando filtro montato

---

### Esempio 5: Movimento con DrivenObjects
```ini
[Next Step - stringi viti estrattore]
Elemento=models/vite_culatta_1.glb
Utensile=ChiaveBrugola
Descrizione=Stringi la vite culatta 1 con la chiave a brugola
Azione1=avvita(0.005)
DrivenObjects=flangia.glb,traslazione:(0,0,0.005,0.5);tubograsso.glb,traslazione:(0,0,0.005,0.5)
```

**Cosa fa**:
1. Vite si avvita di 0.005 unità
2. Contemporaneamente, flangia e tubo si muovono di 0.005
3. Effetto realistico: l'avvitamento "tira" la flangia

---

## 🎯 BEST PRACTICES

### Numerazione Step
✅ **RACCOMANDATO**:
```ini
[Next Step - Descrizione]
[Next Step - Descrizione]
[Next Step - Descrizione]
```

❌ **EVITARE**:
```ini
[Step 1 - Descrizione]
[Step 2 - Descrizione]
[Step 3 - Descrizione]  # Difficile manutenzione!
```

### Ordine Comandi nello Step
```ini
[Next Step - Titolo]
# 1. Camera (opzionale)
CameraPos=...
CameraTarget=...

# 2. Descrizione e Utensile
Descrizione=...
Utensile=...

# 3. Modal (opzionale)
Message=...
MessageVideo=...

# 4. Drag & Drop / Assembly (opzionale)
DragDrop=true
DragDropObjects=...

# 5. Elemento e Azioni
Elemento=...
Azione1=...
Azione2=...
```

### Commenti
```ini
# Commento su riga singola
Azione1=svita  // Commento inline
```

---

## 🔗 RIFERIMENTI RAPIDI

### Utensili Disponibili
- `Mani` - Operazioni manuali
- `ChiaveBrugola` - Viti esagonali
- `ChiaveInglese` - Bulloni esagonali
- `Aria` - Pulizia aria compressa

### Azioni Principali
- `svita` / `svita(dist)` - Svitamento
- `avvita` / `avvita(dist)` - Avvitamento
- `traslazione:(x,y,z,dur)` - Movimento lineare
- `rotazione:(rx,ry,rz,dur)` - Rotazione
- `appoggia(dur)` - Appoggio a terra

### Comandi Camera
- `CameraPos` - Posizione
- `CameraTarget` - Punto focus
- `CameraZoom` - Livello zoom
- `CameraTransitionTime` - Durata transizione

### Drag & Drop
- `DragDrop=true` - Abilita
- `DragDropObjects` - Oggetti trascinabili
- `SnapTargets` - Target aggancio (globale)
- `DragDropDistance` - Distanza snap

---

## 🛠️ COMANDI DEBUG CONSOLE (F12)

Apri la console del browser (F12) e usa questi comandi per debugging e sviluppo tutorial.

---

### 📍 COMANDI POSIZIONAMENTO E CAMERA

#### `Scene3D.getCameraInfo()`
**Descrizione**: Ottieni posizione corrente camera e target in formato tutorial-ready.

**Esempio**:
```javascript
Scene3D.getCameraInfo()
```

**Output**:
```
📹 CAMERA INFO:
Position: (-1.234, 0.567, -0.890)
Target: (0.123, 0.456, 0.789)
Distance: 2.345

📋 SINTASSI TUTORIAL:
CameraPos=(-1.234, 0.567, -0.890)
CameraTarget=(0.123, 0.456, 0.789)
```

**Quando usarlo**:
- Quando trovi una vista camera perfetta
- Copia/incolla le coordinate nel tutorial.txt

---

#### `Scene3D.exportCurrentModelPositions()`
**Descrizione**: Esporta posizioni e rotazioni di TUTTI i modelli caricati in formato tutorial-ready.

**Esempio**:
```javascript
Scene3D.exportCurrentModelPositions()
```

**Output**:
```
# Modello 1: coperchio
Posizione=coperchio:(-1.148,-0.261,0.500)
Rotazione=coperchio:(0.0,0.0,-90.0)

# Modello 2: filtro
Posizione=filtro:(-0.300,-0.142,0.500)
Rotazione=filtro:(0.0,0.0,0.0)

# Modello 3: vite_coperchio_1
Posizione=vite_coperchio_1:(-0.500,-0.349,0.000)
Rotazione=vite_coperchio_1:(-360.0,0.0,0.0)

... (tutti i modelli)

💾 Download automatico: model_positions_2026-01-22_15-30-45.txt
```

**Quando usarlo**:
- Dopo aver posizionato manualmente modelli per assemblaggio
- Per creare sezioni `[Riassemblaggio]` con posizioni custom
- Salva il file scaricato e copia le righe nel tutorial.txt

**Note**:
- Download automatico del file
- Timestamp nel nome file
- Rotazioni convertite automaticamente radianti → gradi

---

#### `Scene3D.listAvailableObjects()`
**Descrizione**: Lista tutti gli oggetti 3D disponibili nella scena.

**Esempio**:
```javascript
Scene3D.listAvailableObjects()
```

**Output**:
```
📦 OGGETTI DISPONIBILI NELLA SCENA (15):
  1. coperchio
  2. filtro
  3. vite_coperchio_1
  4. vite_coperchio_2
  5. vite_coperchio_3
  6. vite_coperchio_4
  7. tappino_grasso_dx
  8. tappino_grasso_sx
  9. ingrassatore
  10. culatta
  ... (altri)

💡 Usa questi nomi per CameraTarget, Elemento, DragDropObjects, ecc.
```

**Quando usarlo**:
- Verificare nomi esatti modelli
- Controllare se un modello è stato caricato
- Trovare nomi per configurare tutorial

---

#### `Scene3D.findModelByName('nome')`
**Descrizione**: Trova un modello specifico e mostra informazioni dettagliate.

**Esempio**:
```javascript
Scene3D.findModelByName('filtro')
```

**Output**:
```
🔍 MODELLO TROVATO: "filtro"
  Nome completo: filtro.glb
  Posizione: (-0.300, -0.142, 0.500)
  Rotazione: (0.0°, 0.0°, 0.0°)
  Scala: (1.0, 1.0, 1.0)
  Bounding Box Center: (-0.298, -0.140, 0.502)
  Visibile: true
```

**Quando usarlo**:
- Debug posizionamento specifico modello
- Verificare se modello esiste
- Controllare proprietà modello

---

### 🎯 COMANDI NAVIGAZIONE TUTORIAL

#### `jumpToStep(N)` o `UI.jumpToStep(N)`
**Descrizione**: Salta direttamente allo step N del tutorial (numerazione 1-based).

**Sintassi**:
```javascript
jumpToStep(numero_step)              // Con fast-forward (applica step precedenti)
jumpToStep(numero_step, false)       // Senza fast-forward (solo per debug)
```

**Esempio**:
```javascript
jumpToStep(5)          // Salta al 5° step con fast-forward
jumpToStep(10)         // Salta al 10° step con fast-forward
jumpToStep(15, false)  // Salta al 15° step SENZA applicare step precedenti
```

**Output**:
```
⏭️ Saltando allo step 5/18: "Next Step - Coperchio"
🔄 FAST-FORWARD: Applicazione step 1-4...
✅ Step 1: Posizione vite_coperchio_1 applicata
✅ Step 2: Posizione vite_coperchio_2 applicata
✅ Step 3: Posizione vite_coperchio_3 applicata
✅ Step 4: Posizione vite_coperchio_4 applicata
📹 Camera: transizione verso step 5
```

**Quando usarlo**:
- Testing rapido step specifici
- Debug problemi su step avanzati
- Sviluppo tutorial senza ripetere tutto

**Note Fast-Forward**:
- Applica automaticamente `Posizione=` e `Rotazione=`
- Applica automaticamente azioni (svita, traslazione, ecc.)
- ⚠️ Non supporta `centro:(x,y,z);rotazione:...` (warning + skip)

---

#### `listSteps()` o `UI.listTutorialSteps()`
**Descrizione**: Mostra lista completa di tutti gli step del tutorial corrente.

**Esempio**:
```javascript
listSteps()
```

**Output**:
```
📋 Tutorial caricato: 18 step disponibili
═══════════════════════════════════════════════════════════
   Step 1: Step 1 - Prima vite
     └─ Seleziona il tool "Mano" e rimuovi la prima vite
     └─ Utensile: Mani | Elemento: vite_coperchio_1.glb
   Step 2: Next Step - Seconda vite
     └─ Rimuovi la seconda vite del coperchio
     └─ Utensile: Mani
👉 Step 3: Next Step - Terza vite  <-- Step corrente
     └─ Rimuovi la terza vite del coperchio
     └─ Utensile: Mani
   Step 4: Next Step - Quarta vite
     └─ Utensile: Mani
   Step 5: Next Step - Coperchio
     └─ Rimuovi il coperchio del filtro
     └─ Elemento: coperchio.glb | DragDrop: false
   ...
═══════════════════════════════════════════════════════════

💡 Usa jumpToStep(N) per saltare a uno step specifico
💡 Step corrente: 3
```

**Quando usarlo**:
- Vedere struttura completa tutorial
- Trovare numero step per jumpToStep()
- Verificare titoli e proprietà step

---

#### `findStep("keyword")` o `UI.jumpToStepByName("keyword")`
**Descrizione**: Cerca step per parola chiave (case-insensitive) in titolo o descrizione.

**Esempio**:
```javascript
findStep("filtro")         // Cerca "filtro"
findStep("vite")           // Cerca "vite"
findStep("rimuovi")        // Cerca "rimuovi"
```

**Output (match singolo)**:
```
✅ Trovato: Step 6 - Next Step - Filtro
⏭️ Saltando allo step 6/18: "Next Step - Filtro"
```

**Output (match multipli)**:
```
🔍 Trovati 4 step che contengono "vite":
   1. Step 1 - Prima vite
      └─ Seleziona il tool "Mano" e rimuovi la prima vite
   2. Step 2 - Seconda vite
      └─ Rimuovi la seconda vite del coperchio
   3. Step 3 - Terza vite
   4. Step 4 - Quarta vite

💡 Usa jumpToStep(N) per saltare a uno specifico step
```

**Quando usarlo**:
- Ricerca rapida step per nome
- Quando non ricordi il numero step
- Auto-jump se match singolo

---

### 🎮 COMANDI DRAG & DROP SYSTEM

#### `DragDropSystem.isEnabled()`
**Descrizione**: Verifica se il sistema drag & drop è attivo.

**Esempio**:
```javascript
DragDropSystem.isEnabled()
```

**Output**:
```
true   // Sistema attivo
false  // Sistema inattivo
```

---

#### `DragDropSystem.enable(['oggetto1', 'oggetto2'])`
**Descrizione**: Abilita drag & drop per oggetti specifici.

**Esempio**:
```javascript
DragDropSystem.enable(['filtro', 'coperchio'])
```

**Output**:
```
[DragDropSystem] Sistema drag & drop abilitato
[DragDropSystem] Oggetti abilitati: filtro, coperchio
```

---

#### `DragDropSystem.setSnapDistance(distanza)`
**Descrizione**: Imposta distanza di snap automatico.

**Esempio**:
```javascript
DragDropSystem.setSnapDistance(0.5)   // Snap più tollerante
DragDropSystem.setSnapDistance(0.1)   // Snap più preciso
```

**Output**:
```
[DragDropSystem] 📏 setSnapDistance chiamato con: 0.5
[DragDropSystem] ✅ Valore richiesto: 0.500 | Valore applicato: 0.500
```

---

#### `DragDropSystem.setCustomSnapPosition('oggetto', x, y, z)`
**Descrizione**: Imposta punto di snap a coordinate arbitrarie per un oggetto.

**Esempio**:
```javascript
DragDropSystem.setCustomSnapPosition('filtro', 0.5, 0.2, 0.3)
```

**Output**:
```
[DragDropSystem] 📍 Snap customizzato impostato per "filtro" a (0.500, 0.200, 0.300)
```

**Quando usarlo**:
- Testing snap a posizioni specifiche
- Debug posizionamento componenti

---

#### `DragDropSystem.setMultipleSnapTargets('oggetto', ['target1', 'target2'])`
**Descrizione**: Imposta multipli target snap per un oggetto (intercambiabili).

**Esempio**:
```javascript
DragDropSystem.setMultipleSnapTargets('vite_A', ['foro_1_original', 'foro_2_original'])
```

**Output**:
```
[DragDropSystem] 🎯 Multi-target snap configurato per "vite_A"
  Target disponibili: foro_1_original, foro_2_original
```

---

#### `DragDropSystem.debugSnapSystem()`
**Descrizione**: Mostra stato completo del sistema snap (oggetti, target, configurazione).

**Esempio**:
```javascript
DragDropSystem.debugSnapSystem()
```

**Output**:
```
🔍 DEBUG SNAP SYSTEM:

Oggetti abilitati: 2
  - filtro
  - vite_culatta_1

Distanza snap: 0.100

Custom snap targets:
  filtro: (0.500, 0.200, 0.300)
  vite_culatta_1: [estrattoresx_original, estrattoredx_original]

Occupazione target:
  estrattoresx_original: occupato da "vite_culatta_2"
  estrattoredx_original: libero
```

---

### 🎨 COMANDI SISTEMA PARTICELLE (Tool Aria)

#### `ParticleSystem.testAirJet()`
**Descrizione**: Test getto aria compressa (sistema particelle).

**Esempio**:
```javascript
ParticleSystem.testAirJet()
```

**Output**:
- Crea effetto particelle aria compressa al centro scena
- Durata: configurabile in ParticleSystem.js

---

#### `ParticleSystem.clearAllEffects()`
**Descrizione**: Rimuove tutti gli effetti particellari attivi.

**Esempio**:
```javascript
ParticleSystem.clearAllEffects()
```

---

### 🔄 COMANDI ASSEMBLY SYSTEM

#### `DragDropSystem.enableAssemblyMode(config)`
**Descrizione**: Abilita modalità assemblaggio sequenziale con configurazione.

**Esempio**:
```javascript
DragDropSystem.enableAssemblyMode({
    sequence: ['tappino_dx', 'tappino_sx', 'filtro', 'coperchio'],
    snapPoints: { ... }
})
```

---

#### `DragDropSystem.getAssemblyStatus()`
**Descrizione**: Ottieni stato corrente assemblaggio.

**Esempio**:
```javascript
DragDropSystem.getAssemblyStatus()
```

**Output**:
```
{
    currentStep: 'filtro',
    completed: ['tappino_dx', 'tappino_sx'],
    remaining: ['coperchio', 'viti']
}
```

---

#### `DragDropSystem.undoAssembly()`
**Descrizione**: Annulla ultima operazione di assemblaggio.

**Esempio**:
```javascript
DragDropSystem.undoAssembly()
```

---

### 📊 COMANDI INFORMAZIONI SISTEMA

#### `Scene3D.getStats()`
**Descrizione**: Statistiche scena 3D (oggetti, geometrie, materiali).

**Esempio**:
```javascript
Scene3D.getStats()
```

**Output**:
```
📊 SCENE STATS:
  Oggetti totali: 23
  Geometrie: 15
  Materiali: 18
  Texture: 12
  Triangoli: 45,678
  Memoria stimata: 12.3 MB
```

---

#### `AppConfig.log(level, message)`
**Descrizione**: Log personalizzato con livelli (1=error, 2=info, 3=debug).

**Esempio**:
```javascript
AppConfig.log(2, 'Test messaggio info')
AppConfig.log(1, 'Test messaggio errore')
```

---

### 🎯 COMANDI RAPIDI (SHORTCUTS)

```javascript
// Navigazione rapida
jumpToStep(5)                    // Salta a step 5
listSteps()                      // Mostra tutti step
findStep("filtro")               // Cerca step

// Informazioni scena
Scene3D.getCameraInfo()          // Info camera corrente
Scene3D.listAvailableObjects()   // Lista modelli
Scene3D.exportCurrentModelPositions()  // Export posizioni

// Debug drag & drop
DragDropSystem.debugSnapSystem() // Stato completo snap
DragDropSystem.isEnabled()       // Sistema attivo?

// Pulizia
ParticleSystem.clearAllEffects() // Rimuovi particelle
```

---

### 💡 WORKFLOW SVILUPPO TUTORIAL

#### 1. Posizionamento Camera
```javascript
// Muovi manualmente la camera con mouse
// Quando trovi vista perfetta:
Scene3D.getCameraInfo()
// Copia output nel tutorial.txt
```

#### 2. Posizionamento Modelli (Assemblaggio)
```javascript
// Trascina modelli manualmente (drag & drop)
// Quando posizioni finali sono OK:
Scene3D.exportCurrentModelPositions()
// Salva file scaricato
// Copia sezioni Posizione= e Rotazione= nel tutorial.txt
```

#### 3. Testing Step Specifico
```javascript
// Lista tutti step
listSteps()

// Salta a step problema
jumpToStep(14)

// Verifica oggetti disponibili
Scene3D.listAvailableObjects()

// Debug snap se necessario
DragDropSystem.debugSnapSystem()
```

#### 4. Ricerca Rapida
```javascript
// Trova step per nome
findStep("vite")           // Lista tutti step con "vite"
findStep("ingrassatore")   // Auto-jump se match singolo
```

---

### ⚠️ NOTE IMPORTANTI

1. **Numerazione Step**: `jumpToStep()` usa numerazione umana (1-based), non array (0-based)
   - Step 1 = `jumpToStep(1)` ✅
   - Step 1 = `jumpToStep(0)` ❌

2. **Fast-Forward Limitazioni**:
   - ✅ Supporta: `Posizione`, `Rotazione`, `svita`, `avvita`, `traslazione`, `rotazione`, `appoggia`
   - ❌ Non supporta: `centro:(x,y,z);rotazione:...` (pivot custom)
   - ℹ️ Stati drag & drop non replicati (solo posizioni finali)

3. **Export Posizioni**:
   - Usa DOPO aver posizionato modelli manualmente
   - File scaricato automaticamente con timestamp
   - Rotazioni in gradi (non radianti)

4. **Console Browser**:
   - F12 (Chrome/Edge)
   - Ctrl+Shift+K (Firefox)
   - Cmd+Option+C (Safari Mac)

---

**Versione**: 1.1
**Ultimo aggiornamento**: 22 Gennaio 2026
**File di riferimento**: `scenes/Pompa_Becker/tutorial.txt`
