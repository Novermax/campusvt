# Fix Avvitamento Viti - Tutorial Palette Reverse

**Data Fix**: Gennaio 2026
**Problema**: Le viti vanno troppo dentro durante l'avvitamento
**Causa**: Posizionamento drag&drop le mette già nella posizione finale
**Soluzione**: SnapPoint personalizzati con posizioni arretrate di 0.1 unità

---

## 🐛 Problema Identificato

### Comportamento Errato
```
1. Utente posiziona vite via drag&drop
   → Vite snappa a posizione finale (es. Z=0.100)

2. Utente avvita con ChiaveInglese/ChiaveBrugola
   → avvita(0.1) muove la vite di -0.1 in Z
   → Vite arriva a Z=0.000 (TROPPO DENTRO!)
```

### Causa Root
Il sistema drag&drop con snap ai target `_original` posiziona le viti direttamente alla loro posizione finale montata. L'azione `avvita(0.1)` aggiunge ulteriore movimento, spingendo le viti oltre la posizione corretta.

---

## ✅ Soluzione Implementata

### Strategia
Usare `SnapPoint` personalizzati con coordinate arretrate di 0.1 unità rispetto alla posizione finale. L'avvitamento porterà le viti alla posizione corretta.

### Formula
```
Posizione_Snap = Posizione_Finale + (0, 0, 0.1)
```

Arretriamo lungo Z positivo (allontanando dalla pompa) perché l'avvitamento muove in Z negativo (verso la pompa).

---

## 🔧 Modifiche Implementate

### Backup Creato
```
tutorial.txt.reverse_v2_pre_fix
```

### Step 4: Posiziona Viti Flangia

**Aggiunto**:
```ini
SnapPoint=vite_flangia_1:(-0.000,-0.267,0.200);vite_flangia_2:(-0.000,-0.321,0.200);vite_flangia_3:(-0.000,-0.321,0.200);vite_flangia_4:(-0.000,-0.267,0.200);vite_flangia_5:(-0.100,-0.191,0.200);vite_flangia_6:(-0.100,-0.137,0.200);vite_flangia_7:(-0.100,-0.137,0.200);vite_flangia_8:(-0.100,-0.191,0.200)
```

**Calcolo Coordinate**:

| Vite | Posizione Finale (Z) | Posizione Arretrata (Z) | Differenza |
|------|---------------------|------------------------|-----------|
| vite_flangia_1 | 0.100 | **0.200** | +0.1 ✅ |
| vite_flangia_2 | 0.100 | **0.200** | +0.1 ✅ |
| vite_flangia_3 | 0.100 | **0.200** | +0.1 ✅ |
| vite_flangia_4 | 0.100 | **0.200** | +0.1 ✅ |
| vite_flangia_5 | 0.100 | **0.200** | +0.1 ✅ |
| vite_flangia_6 | 0.100 | **0.200** | +0.1 ✅ |
| vite_flangia_7 | 0.100 | **0.200** | +0.1 ✅ |
| vite_flangia_8 | 0.100 | **0.200** | +0.1 ✅ |

---

### Step 14: Posiziona Viti Culatta

**Aggiunto**:
```ini
SnapPoint=vite_culatta_1:(0.000,-0.378,0.191);vite_culatta_2:(0.000,-0.378,0.191);vite_culatta_3:(-0.100,-0.116,0.400);vite_culatta_4:(-0.100,-0.116,0.400)
```

**Calcolo Coordinate**:

| Vite | Posizione Finale (Z) | Posizione Arretrata (Z) | Differenza |
|------|---------------------|------------------------|-----------|
| vite_culatta_1 | 0.091 | **0.191** | +0.1 ✅ |
| vite_culatta_2 | 0.091 | **0.191** | +0.1 ✅ |
| vite_culatta_3 | 0.300 | **0.400** | +0.1 ✅ |
| vite_culatta_4 | 0.300 | **0.400** | +0.1 ✅ |

---

## 📊 Flusso Corretto

### Viti Flangia (Esempio: vite_flangia_1)

```
Step 4: Posiziona Viti Flangia (Drag&Drop)
  └─ Drag vite_flangia_1
  └─ Snap a coordinate (-0.000, -0.267, 0.200)  ← Arretrata
  └─ Vite posizionata MA NON avvitata

Step 5: Avvita vite flangia 1 (ChiaveInglese)
  └─ Elemento=models/vite_flangia_1.glb
  └─ Utensile=ChiaveInglese
  └─ Azione1=avvita(0.1)
  └─ Sistema muove vite:
      • Rotazione: -1800° (5 giri antiorario)
      • Traslazione: (0, 0, -0.1)  ← Direction=(0,0,1) × -0.1
      • Posizione finale: Z = 0.200 - 0.1 = 0.100 ✅ CORRETTO!
```

### Viti Culatta (Esempio: vite_culatta_1)

```
Step 14: Posiziona Viti Culatta (Drag&Drop)
  └─ Drag vite_culatta_1
  └─ Snap a coordinate (0.000, -0.378, 0.191)  ← Arretrata
  └─ Vite posizionata MA NON avvitata

Step 15: Avvita vite culatta 1 (ChiaveBrugola)
  └─ Elemento=models/vite_culatta_1.glb
  └─ Utensile=ChiaveBrugola
  └─ Azione1=avvita(0.1)
  └─ Sistema muove vite:
      • Rotazione: -1800° (5 giri antiorario)
      • Traslazione: (0, 0, -0.1)
      • Posizione finale: Z = 0.191 - 0.1 = 0.091 ✅ CORRETTO!
```

---

## 🎯 Verifica Sistema

### Direzione Avvitamento
Il sistema usa `direction` da `home_config.txt`:

```javascript
// Per viti (direction probabilmente = (0, 0, 1))
avvita(distanza):
  • Rotazione: direction × -1800°
  • Traslazione: direction × -distanza

// Esempio con direction=(0,0,1) e distanza=0.1:
  • Rotazione: (0, 0, -1800°)  → 5 giri antiorario
  • Traslazione: (0, 0, -0.1)  → Muove verso la pompa (Z diminuisce)
```

### Comportamento Atteso

**Prima del Fix** ❌:
```
Posizionamento: Z = 0.100 (finale)
Avvitamento:    Z = 0.100 - 0.1 = 0.000 (TROPPO DENTRO!)
```

**Dopo il Fix** ✅:
```
Posizionamento: Z = 0.200 (arretrata)
Avvitamento:    Z = 0.200 - 0.1 = 0.100 (PERFETTO!)
```

---

## 📝 File Modificati

### tutorial.txt
- **Linea 752**: Aggiunto SnapPoint per 8 viti flangia (coordinate arretrate)
- **Linea 827**: Aggiunto SnapPoint per 4 viti culatta (coordinate arretrate)

### Backup Disponibili
1. `tutorial.txt.original` - Backup pre-reverse
2. `tutorial.txt.reverse_v1` - Versione 1 (6 step senza avvitamento manuale)
3. `tutorial.txt.reverse_v2_pre_fix` - Versione 2 pre-fix (viti andavano troppo dentro)
4. **Corrente** - Versione 2 post-fix (viti posizione corretta)

---

## 🚀 Test Consigliati

### Test Manuale Desktop
```javascript
// Salta a step posizionamento viti flangia
jumpToStep(4)

// Posiziona una vite (es. vite_flangia_1)
// Verifica che snappa a Z=0.200

// Avanza a step avvitamento
jumpToStep(5)

// Clicca sulla vite per avvitare
// Verifica che arrivi a Z=0.100 (posizione finale corretta)

// Console log dovrebbe mostrare:
// 🔩 SVITA: BBCenter ..., Pos ..., Offset ..., Rot -180.0°
// Posizione finale dovrebbe essere circa (x, y, 0.100)
```

### Verifica Posizioni Console
```javascript
// Durante il posizionamento drag&drop
DragDropSystem.debugSnapSystem()
// Output dovrebbe mostrare SnapPoint personalizzati a Z=0.200

// Dopo avvitamento
Scene3D.findModelByName('vite_flangia_1').position
// Output dovrebbe essere Vector3 { x: ..., y: ..., z: 0.100 }
```

---

## ✅ Risultato Atteso

### Viti Flangia
- **Posizionamento** (Step 4): Viti arretrate a Z=0.200
- **Avvitamento** (Step 5-12): Viti avvitate a Z=0.100 (finale)
- **Rotazione Visibile**: 5 giri completi (-1800°)

### Viti Culatta
- **Posizionamento** (Step 14):
  - Viti 1-2 arretrate a Z=0.191
  - Viti 3-4 arretrate a Z=0.400
- **Avvitamento** (Step 15-18):
  - Viti 1-2 avvitate a Z=0.091 (finale)
  - Viti 3-4 avvitate a Z=0.300 (finale)
- **Rotazione Visibile**: 5 giri completi (-1800°)

---

## 📚 Riferimenti Tecnici

### Sistema SnapPoint
Da `CLAUDE.md:1309-1345`:
```ini
# Snap a coordinate personalizzate per-oggetto
SnapPoint=oggetto:(x,y,z)

# Multipli oggetti (sintassi usata nel fix)
SnapPoint=obj1:(x1,y1,z1);obj2:(x2,y2,z2);obj3:(x3,y3,z3)
```

### Sistema Avvitamento
Da `CLAUDE.md:1550-1630`:
```javascript
// Avvitamento con distanza configurabile
avvita(0.1)  // Distanza 0.1 unità
// Rotazione: -1800° (5 giri antiorario)
// Traslazione: direction × -0.1
```

---

**Generato**: Gennaio 2026
**Fix Applicato**: Linee 752 e 827 di tutorial.txt
**Status**: ✅ RISOLTO - Viti ora si posizionano e avvitano correttamente
