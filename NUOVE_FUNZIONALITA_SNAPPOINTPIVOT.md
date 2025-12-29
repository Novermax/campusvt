# Nuova Funzionalità: SnapPointPivot

## Descrizione

Il comando `SnapPointPivot` permette di posizionare il **pivot** dell'oggetto direttamente alle coordinate specificate, invece del centro del bounding box (comportamento di `SnapPoint`).

## Differenza tra SnapPoint e SnapPointPivot

| Comando | Comportamento |
|---------|--------------|
| `SnapPoint=(x,y,z)` | Il **centro del bounding box** dell'oggetto viene posizionato alle coordinate (x,y,z) |
| `SnapPointPivot=(x,y,z)` | Il **pivot** dell'oggetto viene posizionato alle coordinate (x,y,z) |

## Quando usare SnapPointPivot

Usa `SnapPointPivot` quando:
- Il modello 3D ha il pivot non centrato rispetto alla geometria
- Vuoi un controllo preciso sulla posizione del punto di origine dell'oggetto
- L'oggetto deve essere posizionato in base al suo punto di ancoraggio, non al centro geometrico

## Sintassi

### Formato Globale (raccomandato)
Applica lo stesso snap point a tutti gli oggetti in `DragDropObjects`:

```ini
SnapPointPivot=(x,y,z)                           # Singolo punto
SnapPointPivot=(x1,y1,z1),(x2,y2,z2)             # Multipli punti
```

### Formato Per-Oggetto
Specifica snap point diversi per oggetti diversi:

```ini
SnapPointPivot=filtro:(0.5,0.2,0.3)                          # Singolo oggetto
SnapPointPivot=filtro:(0.5,0.2,0.3);vite:(-0.1,0,0.5)        # Multipli oggetti
```

## Esempi di Utilizzo

### Esempio 1: Posizionamento preciso filtro
```ini
[Next Step - Riposiziona filtro]
Elemento=models/filtro.glb
Descrizione=Trascina il filtro nella sua sede
DragDrop=true
DragDropObjects=filtro
DragDropDistance=0.5
SnapPointPivot=(0.0,0.236,0.493)
```

### Esempio 2: Multipli oggetti stesso punto
```ini
[Next Step - Assembla componenti]
DragDrop=true
DragDropObjects=vite_1,vite_2,vite_3
DragDropDistance=0.3
SnapPointPivot=(0.5,0.1,0.2)
```

### Esempio 3: Oggetti diversi, punti diversi
```ini
[Next Step - Assemblaggio complesso]
DragDrop=true
DragDropObjects=filtro,coperchio
DragDropDistance=0.4
SnapPointPivot=filtro:(0.0,0.236,0.493);coperchio:(0.0,0.5,0.0)
```

## Debug

Nella console del browser, puoi verificare il funzionamento con:

```javascript
// Verifica stato snap
DragDropSystem.debugSnapSystem()

// Verifica se un oggetto ha snap pivot configurato
DragDropSystem.customSnapTargets.forEach((config, uuid) => {
    console.log('UUID:', uuid, 'usePivot:', config.usePivot);
})
```

## Note Tecniche

- Il flag `usePivot` viene salvato nella configurazione dello snap e propagato attraverso `findSnapTarget` → `performSnap`
- La distanza di snap viene calcolata dal **pivot** (non dal centro BB) quando `usePivot=true`
- L'animazione di snap porta direttamente il pivot alla posizione target senza compensazione offset

## File Modificati

1. `js/core/DragDropSystem.js` - Aggiunta funzione `setCustomSnapPositionPivot()`
2. `js/core/SnapSystem.js` - Modificate `findSnapTarget()` e `performSnap()` per gestire flag `usePivot`
3. `js/ui.js` - Aggiunto parsing del comando `SnapPointPivot`

## Compatibilità

- ✅ Backward compatible: `SnapPoint` continua a funzionare come prima
- ✅ Può coesistere con `SnapPoint` nello stesso tutorial
- ✅ Funziona con tutti i formati (globale e per-oggetto)
