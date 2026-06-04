# Manuale operativo — Demo "Una giornata di manutenzione sulla ACCORD 500"

> **Obiettivo**: costruire una demo dimostrativa di ~30 minuti di Campus Virtual Training,
> a **taglio commerciale** (clienti), riusando i 2 scenari già funzionanti e aggiungendo
> **un solo scenario nuovo e corto** (manutenzione cono HSK63) per chiudere il quadro delle funzionalità.
>
> **Macchina**: SCM ACCORD 500 / Morbidelli (modello 3D `a500.glb`) — fora-fresatrice CNC.
> **Fonte procedure**: `docs/LUMP_IT_AA10003887.pdf`, Cap. 20 (Manutenzione).
> **Sintassi tutorial**: CVTScript v3 (`docs/docManuale_CVTScript_v3_per_principianti_arial.pdf`).

---

## 0. Cosa otterrai

Una sessione unica e coerente, vissuta dal cliente come **"una giornata di manutenzione sulla macchina vera"**, in tre atti che vanno dal *guidare la macchina* al *metterci le mani dentro*:

| Atto | Scenario | Stato | Durata | Messaggio per il cliente |
|------|----------|-------|--------|--------------------------|
| Apertura | Home + benvenuto | esiste | 1–2 min | "Questa è la tua macchina, in 3D" |
| 1 | Manutenzione Elettromandrino | **esiste** | 10–12 min | "Operi i comandi come quelli reali" |
| 2 | Manutenzione Pompa del vuoto | **esiste** | 14–16 min | "Smonti e rimonti con le tue mani" |
| 3 | Manutenzione cono HSK63 | **da creare** | 3–4 min | "Ogni procedura del manuale diventa interattiva" |
| Chiusura | Messaggio finale | nuovo step | 1 min | "E si scrive con poche righe di testo" |

**Totale ≈ 30 minuti.** Gli atti 1 e 2 sono già funzionanti oggi: il 90% del lavoro è **regia**, non sviluppo.

---

## 1. Prerequisiti

- Server locale attivo: `python -m http.server 8000` dalla root del progetto → `index.html` → login.
- I **42 modelli `.glb` sono già presenti** in `models/` (cartella condivisa alla root, non dentro le scene).
- Strumenti di authoring: un editor di testo. Nessuna programmazione richiesta.
- Per i ritocchi camera: console del browser con le API `Scene3D.getCameraInfo()` (vedi §6).

> **Nota architettura**: ogni scenario è una cartella `scenes/<Nome>/` con `tutorial.cvtscript`,
> `tool.ini`, `objects.ini`. I modelli sono **condivisi** in `models/`. Gli scenari sono
> registrati e ordinati in `scenes/homeconfig.ini`.

---

## 2. I file in gioco

| File | Ruolo | Per la demo |
|------|-------|-------------|
| `scenes/homeconfig.ini` | Vetrina degli scenari (le card della home) | Ordina gli scenari della demo, nascondi i placeholder, registra il nuovo HSK63 |
| `scenes/Manutenzione_Elettromandrino/` | Atto 1 (esiste) | Solo eventuali ritocchi camera/tempi |
| `scenes/Pompa_Becker/` | Atto 2 (esiste) | Solo eventuali ritocchi camera/tempi |
| `scenes/Manutenzione_Cono_HSK63/` | Atto 3 (**da creare**) | Cartella nuova: vedi §4 |

---

## 3. La regia dei 30 minuti (taglio commerciale)

La demo si svolge **selezionando gli scenari in sequenza dalla home**. Non c'è auto-concatenazione:
il presentatore apre uno scenario, lo esegue, torna alla home, apre il successivo.

### Polish della home (consigliato)
In `scenes/homeconfig.ini`:
1. **Ordina** le card nell'ordine della demo: Elettromandrino → Pompa del vuoto → **Cono HSK63**.
2. **Nascondi i placeholder**: gli 8 scenari "Non Attivato" (RTCP, batterie encoder, ecc.) distraggono.
   Commentali o spostali in coda, così il cliente vede solo i 3 scenari della demo.
3. Aggiorna `subtitle=` con una frase d'impatto, es. *"Manutenzione assistita in 3D, dal manuale alla macchina."*

### Atto 0 — Apertura (1–2 min)
- Mostra la home: card con la macchina, titolo, sottotitolo.
- Talk track: *"Tutto quello che vedete nasce dal manuale di manutenzione della macchina. L'operatore non legge un PDF: la macchina gli mostra cosa fare, passo per passo."*

### Atto 1 — Elettromandrino (10–12 min)
È l'atto **"wow tecnologico"**. Punti da far notare al cliente, nell'ordine in cui appaiono:
- **Comandi reali**: si preme il pulsante MDI sul pulpito, le schermate cambiano davvero (`after : schermo = …`).
- **Telecomando in mano**: il Tecpad viene preso in mano e segue la vista (`hold = pick`).
- **Automatismo macchina**: la sequenza di scarico utensile a 5 assi parte da sola (flag `machine`): carrelli, prisma, magazzino. *"La macchina si muove come quella vera."*
- **Porta + spray**: si apre la porta cabina e si ingrassa il naso con lo spray (`tool = spray`), con **camera sbloccata** (`free within`) per girare intorno.
- **Video esplicativo**: si apre un modal con video (`video = …`). *"Possiamo allegare il video reale della procedura."*

> Ritocco opzionale: se vuoi una corsa più "hands-free" durante il talk, puoi alzare leggermente
> i `fade` delle camere per transizioni più cinematografiche (vedi §5).

### Atto 2 — Pompa del vuoto (14–16 min)
È l'atto **"competenza manuale profonda"**. Da far notare:
- **Attrezzi diversi**: mano, chiave a brugola, chiave inglese, aria compressa — la barra strumenti cambia.
- **Smontaggio realistico**: viti che si svitano (`unscrew`), coperchio e filtro che si rimuovono e si **appoggiano a terra** (`place`).
- **Ingrassaggio con pompaggio**: la pompetta fa 10 pompate (`pump … cycles 10`). *"Anche i gesti ripetitivi sono fedeli."*
- **Rimontaggio drag & drop**: l'utente **trascina** i pezzi che si **agganciano** da soli (`drag … snap`). *"L'allievo prova, sbaglia, riprova — senza rischi."*
- **Serraggio a croce**: le 8 viti della flangia si stringono nella sequenza corretta 1-5-3-7-2-6-4-8. *"Insegniamo anche la sequenza giusta, non solo il gesto."*
- **Pezzi solidali**: il tubo del grasso segue la flangia (`companion follows master`).

### Atto 3 — Cono HSK63 (3–4 min) — *lo scenario nuovo*
Il "bis" che dimostra come **qualunque pagina del manuale** diventi interattiva. Da creare in §4.
Talk track di chiusura: *"Questo scenario l'abbiamo scritto in poche ore, riusando i modelli già in macchina."*

### Atto 4 — Chiusura (1 min)
Ultimo step con `message` di riepilogo (già incluso nello script HSK63, §4.3).

---

## 4. Creare lo scenario nuovo: "Manutenzione cono HSK63"

Procedura reale (manuale Cap. 20, pag. 15–17): lubrificazione della pinza portautensile e pulizia del cono HSK63.
Questo scenario è scelto apposta perché copre **le uniche funzioni non mostrate dagli altri due**:
`extract`, `insert`, `hold = held`, `hold = release`, `message` con `image`.

### 4.1 Modelli 3D necessari — **tutti già esistenti**

| Modello | Già presente? | Ruolo nello scenario |
|---------|---------------|----------------------|
| `models/a500.glb` | ✅ sì | Macchina; child usati: `a500.naso`, `a500.porta` |
| `models/pulpito.glb` | ✅ sì | Pulpito comandi (pulsante abilita sblocco) |
| `models/remote.glb` | ✅ sì | Telecomando Tecpad (cicli blocco/sblocco) |
| `models/utensile.glb` | ✅ sì | Cono HSK63 da estrarre/reinserire |
| `models/pavimento.glb` | ✅ sì | Pavimento |

> **Nessun nuovo modello 3D è obbligatorio.** (Opzionali, solo estetica: una bomboletta spray
> "Grafloscon" e un dettaglio close-up dei petali della pinza — entrambi aggirabili con camera + spray + video.)

### 4.2 Creare la cartella e i file di contorno

1. Crea la cartella `scenes/Manutenzione_Cono_HSK63/`.
2. **`tool.ini`**: copia quello dell'elettromandrino (contiene già `mano` + `spray`):
   `scenes/Manutenzione_Elettromandrino/tool.ini` → `scenes/Manutenzione_Cono_HSK63/tool.ini`.
3. **`objects.ini`**: copia quello dell'elettromandrino:
   `scenes/Manutenzione_Elettromandrino/objects.ini` → `scenes/Manutenzione_Cono_HSK63/objects.ini`.
   Definisce già `pulpito` (pulsanti), `remote` (pulsanti) e lo stato `schermo`: così
   `pulpito.Pulsante_LU`, `remote.Pulsante_r_unlock` e `after : schermo = …` funzionano subito.
4. **Media**: gli asset NON vanno in una sottocartella della scena. Nel progetto i media
   stanno tutti in **`media/` alla root** e si richiamano con path root-relativo
   (es. l'elettromandrino usa `video = media/lubelett.mp4`). Quindi:
   - metti l'immagine di avviso in `media/sicurezza.jpg`;
   - per il video puoi **riusare direttamente `media/lubelett.mp4`** (già presente) oppure
     copiarlo in `media/lubpinza.mp4`. La cartella `media/` contiene già `lubelett.mp4`,
     `estrattore.mp4`, `1.jpg`, `2.jpg` — riusabili come segnaposto.
5. `tutorial.cvtscript`: vedi §4.3.

### 4.3 Lo script completo (`scenes/Manutenzione_Cono_HSK63/tutorial.cvtscript`)

```ini
# ============================================================
# DEMO – Manutenzione cono HSK63 / lubrificazione pinza
# Procedura reale: SCM ACCORD 500 – Manuale Cap.20, pag.15–17
# Sintassi: CVTScript v3
# ============================================================

[scene]
camera = position (2.74, 1.34, 2.45), target (2.79, 1.27, 1.99), pivot (2.79, 1.27, 1.99), distance 0.47, fov 75.0, fade 2.0

[section "Manutenzione cono HSK63"]

# --- 1. Avviso di sicurezza: dimostra message + title + image ---
[step "Sicurezza" highlight]
title       = Sicurezza
message     = Prima di iniziare: indossa guanti e occhiali di protezione, ventila l'ambiente e non inalare i vapori dei lubrificanti spray.
image       = media/sicurezza.jpg
description = Leggi le avvertenze di sicurezza, poi premi OK.

# --- 2. Pulpito: abilita blocco/sblocco pinza: dimostra element + after (cambio schermo) ---
[step "Abilita sblocco pinza" highlight]
camera      = position (0.95, 1.21, 3.91), target (0.97, 1.15, 3.52), pivot (0.97, 1.15, 3.52), distance 0.4, fov 75, fade 2.0
description = Sul pulpito, premi il pulsante per abilitare il blocco/sblocco della pinza dell'elettromandrino.
element     = pulpito.Pulsante_LU
after       : schermo = schermo010

# --- 3. Prendi il telecomando: dimostra hold = pick (oggetto in mano) ---
[step "Prendi il Tecpad" highlight]
camera      = position (1.17, 1.15, 4.12), target (1.02, 0.83, 3.63), pivot (1.02, 0.83, 3.63), zoom 0.59, fov 75, fade 1.0
description = Prendi in mano il telecomando Tecpad.
tool        = hand
hold        = pick remote at (-0.25, -0.07, 0.25) facing (0, 5, 0)
view        = main

# --- 4. Estrai il cono dal naso: dimostra il verbo extract ---
[step "Estrai il cono HSK63" highlight]
camera      = position (2.78, 0.91, 2.29), target (2.79, 1.27, 1.99), pivot (2.79, 1.27, 1.99), distance 0.47, fov 75.0, free within (-3.14, 3.14)
description = Estrai il cono portautensili dal naso dell'elettromandrino e appoggialo.
tool        = hand
element     = utensile
do          : extract distance 0.25
do          : move by (0, -0.20, 0) duration 0.6
do          : place duration 0.4

# --- 5. Lubrifica i petali della pinza: dimostra tool = spray + message con video ---
[step "Lubrifica la pinza" highlight]
title       = Lubrificazione pinza
message     = Inserisci la cannula tra i petali della pinza e spruzza il grasso (Kluber Grafloscon). Ripeti per ogni fessura.
video       = media/lubpinza.mp4
description = Spruzza il grasso lubrificante tra i petali della pinza.
tool        = spray
element     = a500.naso
do          : move by (0, 0, 0) duration 0.5

# --- 6. Cicli blocco/sblocco col telecomando: dimostra repeat N + animation + hold = held ---
[step "Cicli blocco/sblocco" highlight]
description = Esegui 10 cicli di blocco/sblocco premendo UNLOCK sul telecomando, per distribuire il grasso.
tool        = hand
hold        = held remote
element     = remote.Pulsante_r_unlock repeat 10
animation   = folder screens/mandrino at (60%, 60%) frame 20ms

# --- 7. Reinserisci il cono: dimostra il verbo insert ---
[step "Reinserisci il cono" highlight]
camera      = position (2.78, 0.91, 2.29), target (2.79, 1.27, 1.99), pivot (2.79, 1.27, 1.99), distance 0.47, fov 75.0, fade 1.0
description = Reinserisci il cono pulito nel naso dell'elettromandrino.
tool        = hand
element     = utensile
do          : insert distance 0.25

# --- 8. Riponi il telecomando: dimostra hold = release ---
[step "Riponi il Tecpad" highlight]
description = Rimetti a posto il telecomando Tecpad.
tool        = hand
hold        = release

# --- 9. Chiusura della demo: message di riepilogo ---
[step "Manutenzione completata" highlight]
title       = Manutenzione completata
message     = Pinza lubrificata e cono reinserito. Dal manuale alla macchina, ogni procedura diventa interattiva — e si scrive con poche righe di testo.
description = Procedura completata. Grazie!
```

> **Mappa funzioni → step** (così sai cosa stai dimostrando):
> `message/title/image` (1), `element`+`after` (2), `hold = pick` (3), **`extract`** (4),
> `tool = spray` + `message`/`video` (5), `repeat N` + `animation` + `hold = held` (6),
> **`insert`** (7), **`hold = release`** (8), `message` di chiusura (9).

### 4.4 Registrare lo scenario in `homeconfig.ini`

Aggiungi una card (mettila **dopo** la pompa del vuoto). La riga `direction=` di `utensile`
è ciò che permette a `extract`/`insert` di sapere lungo quale asse muovere il cono.

> **Perché qui l'`utensile` è nella card e nell'elettromandrino no?** Nello scenario
> elettromandrino il cono viene caricato da `objects.ini` (`Elemento=models/utensile.glb`) e
> rimosso con uno scambio di stato (`after : tool = tool0`), quindi non serve una `direction`.
> Nello scenario HSK63 invece lo **estrai/reinserisci fisicamente** con `extract`/`insert`:
> per questi verbi il sistema legge la `direction` del modello dalla card, perciò `utensile`
> **deve** comparire qui con la sua riga `direction=`.

```ini
[Manutenzione cono HSK63]
CameraPos=(1.01, 1.22, 3.87)
CameraTarget=(0, 0, 0)
AmbientLight=0xffffff,1.05
DirectionalLight=0xffffff,1.05,(-8, 15, 0)
BackLight=0xffffff,2,(-8, 15, 5)
description=Pulizia e lubrificazione della pinza portautensile e del cono HSK63 dell'elettromandrino.
image=menuimages/1.png
tutorial=scenes/Manutenzione_Cono_HSK63/tutorial.cvtscript
tool=scenes/Manutenzione_Cono_HSK63/tool.ini
model=models/a500.glb
direction=0,0,1
model=models/pulpito.glb
direction=0,0,1
model=models/remote.glb
direction=0,0,1
model=models/utensile.glb
direction=0,-1,0
model=models/pavimento.glb
direction=0,0,1
```

> **Da verificare in collaudo** (unico punto a rischio): che `utensile.glb` si muova lungo l'asse
> giusto con `extract`/`insert`, **e che la camera lo inquadri**. Attenzione: in `objects.ini`
> l'utensile parte in posizione `(2.8, 2.5, -0.7)`, mentre lo step "Estrai il cono" (§4.3) usa
> una camera che guarda `(2.79, 1.27, 1.99)` — sono due punti molto distanti (soprattutto sulla Z:
> `-0.7` contro `+1.99`). Quasi certamente dovrai **riquadrare la camera** dello step di estrazione
> sull'effettiva posizione del cono: aprila in browser, posizionati con il mouse e copia i valori
> con `Scene3D.getCameraInfo()` (vedi §6). Solo dopo regola asse e distanza: se non convincono,
> cambia `direction=0,-1,0` (prova `0,0,1` / `0,0,-1`) e la `distance` nello step. In ultima istanza
> puoi sostituire `extract`/`insert` con `move by (…)` espliciti — ma la versione con `extract`/`insert`
> è quella che vuoi mostrare al cliente.

---

## 5. Ritocchi per il taglio commerciale

- **Camere cinematografiche**: alza i `fade` (1.5–2.5) per transizioni morbide tra gli step "narrati".
  Usa `pivot` + `distance` per orbite eleganti attorno al pezzo (già fatto negli atti 1 e 2).
- **Descrizioni brevi e orientate al beneficio**: in modalità demo le leggi tu a voce; tienile corte.
- **Video come momento "wow"**: i modal `video =` sono ottimi per inserire la procedura reale.
- **Camera libera nei momenti chiave**: `free within (-3.14, 3.14)` lascia ruotare la vista a 360°
  durante l'ingrassaggio (già usato sul naso) — utile per "mostrare da ogni angolo".
- **Niente fretro di scena**: nascondi gli 8 scenari placeholder dalla home (§3).

---

## 6. Checklist di collaudo (la demo DEVE funzionare)

Prima della presentazione, esegui questo giro per ogni scenario:

1. **Avvio**: `python -m http.server 8000`, login, la home mostra **solo le 3 card** della demo nell'ordine giusto.
2. **Atto 1 e 2**: percorri ogni step fino in fondo, verifica che animazioni, drag&drop e schermi rispondano.
3. **Atto 3 (nuovo)**, controlla in particolare:
   - lo **spray** equipaggia il cursore corretto;
   - **`extract`/`insert`** muovono il cono nel verso giusto (vedi nota §4.4);
   - i pulsanti `pulpito.Pulsante_LU` e `remote.Pulsante_r_unlock` rispondono (dipende dal copia di `objects.ini`);
   - i modal `image`/`video` si aprono e si chiudono con OK.
4. **Strumenti di debug** (console del browser):
   - `listSteps()` — elenca gli step dello scenario corrente;
   - `jumpToStep(N)` — salta a uno step (utile per provare l'atto 3 senza rifare tutto);
   - `findStep("cono")` — cerca per parola chiave;
   - `Scene3D.getCameraInfo()` — leggi la camera attuale e copiala nello step se vuoi riquadrare;
   - `Scene3D.listChildNames(Scene3D.findModelByName('a500'))` — verifica i nomi `naso`/`porta`.
5. **Prova a freddo**: fai girare la demo intera una volta a vuoto cronometrando: deve stare in ~30 min.

---

## 7. Riepilogo: quali modelli 3D servono

- **Atti 0–2 (cuore della demo)**: **nessun modello nuovo**. I 42 `.glb` esistenti bastano.
- **Atto 3 (HSK63)**: **nessun modello nuovo obbligatorio** — riusa `a500`, `pulpito`, `remote`, `utensile`, `pavimento`.
- **Opzionali (solo rifinitura, non bloccanti)**: bomboletta spray "Grafloscon", close-up petali pinza, straccio.
- **Asset 2D da preparare** (non sono modelli 3D): `media/sicurezza.jpg`, `media/lubpinza.mp4` (riusabile da `lubelett.mp4`), ed eventuali thumbnail card in `menuimages/`.

> Conclusione: la demo è **realizzabile quasi interamente per riuso**, quindi a basso rischio e già
> dimostrabilmente funzionante. L'unico contenuto realmente nuovo è uno scenario di ~9 step che
> non richiede modellazione.

---

## 8. Errori comuni da evitare (dal manuale v3)

- Le chiavi v3 vanno **tutte minuscole** (`element`, `tool`, `do :`) — il TitleCase è sintassi legacy.
- **Virgolette obbligatorie** nei titoli: `[step "Titolo" highlight]`, `[section "Titolo"]`.
- **Non numerare** le azioni a mano: più `do :` di fila vengono auto-numerati e fusi in un'unica animazione.
- Nell'`element` scrivi il **nome del modello senza `.glb`** (`element = utensile`, non `utensile.glb`).
- Usa i **nomi inglesi degli attrezzi** (`hand`, `spray`, `hex_key`, `wrench`, `air`).
- **Spazi attorno all'`=`** e ai `:` come negli esempi.
- I commenti iniziano con `#`, non con `//`.
- Per cambiare schermo usa `after : schermo = …`, **non** `AutoSetVariant` (deprecato).
```
