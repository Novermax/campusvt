PROBLEMA 1

File: scenes\Pompa_Becker\tutorial.ini
Tutorial: [Riassemblaggio]
Step: [Next Step - Gruppo Viti Coperchio]

Comportamento attuale (touch)

Durante il drag via touch, le viti possono essere droppate solo nella loro posizione di creazione originale.

Il sistema non utilizza il punto di rilascio del dito per calcolare la posizione di drop.

Non è chiaro se esista un algoritmo di nearest snap point: di fatto sembra ignorato.

Il vincolo “una posizione occupata non può essere riutilizzata” deve rimanere valido.

Comportamento atteso

Il drag touch deve:

intercettare correttamente pointerdown / pointermove / pointerup

calcolare il punto 3D sotto il dito (raycast camera → scene)

individuare lo snap point più vicino tra quelli validi

verificare che lo snap point non sia già occupato

posizionare la vite nel punto valido più vicino al rilascio

Sintesi tecnica del bug

Probabile causa:

Il sistema usa una logica basata su drag origin reference

Oppure il drop viene validato solo contro un ID associato alla vite, ignorando la posizione effettiva del touch.

Serve:

decoupling tra posizione iniziale e posizione di rilascio

gestione coerente pointer events (mouse + touch unificati)

PROBLEMA 2

File: scenes\Pompa_Becker\tutorial.ini
Tutorial: [Sostituzione Palette Reverse]
Step: [Next Step - Posiziona Viti Flangia]

Comportamento attuale (touch)

Con input touch non è possibile selezionare (grab) nessuna delle 8 viti.

Il drag non parte (probabile conflitto con gesture camera orbit/drag).

Le viti possono cadere tutte nello stesso punto casuale.

Non esiste vincolo di unicità sullo snap point.

Comportamento atteso

Il touch deve:

avere priorità rispetto al drag camera quando l’oggetto è selezionabile

attivare correttamente il raycast sul mesh collider della vite

Ogni snap point deve:

essere marcato come occupied = true al primo inserimento

rifiutare inserimenti successivi

Richiesta tecnica per il coder

Verificare:

Gestione unificata eventi:

usare pointer events invece di mouse/touch separati

event.stopPropagation() su oggetti interattivi

priorità oggetti > controlli camera

Raycasting:

layer filtering corretto

collider attivo su tutte le 8 viti

bounding box aggiornata

Logica snap:

array di snap points con:

{
  position: Vector3,
  occupied: boolean,
  allowedObjectIds: []
}

algoritmo:

calcola distanza tra dropPoint e snapPoints

filtra occupied == false

seleziona il più vicino sotto soglia

Stato consistente:

quando una vite viene rimossa → liberare snap point

prevenire più oggetti nello stesso snap index