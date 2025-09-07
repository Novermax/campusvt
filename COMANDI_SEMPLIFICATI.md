# Comandi Semplificati per Sistema Tutorial

## 📋 Lista Comandi Disponibili

### 🔩 **Comandi per Viti**

#### `Azione1=svita`
- **Funzione**: Svitamento completo (rotazione + estrazione)
- **Movimenti**: 
  - Rotazione: 90° oraria (Z)
  - Traslazione: 0.5 unità verso esterno (Z+)
- **Durata totale**: 2.0 secondi
- **Uso**: Rimozione viti, bulloni

#### `Azione1=avvita` 
- **Funzione**: Avvitamento completo (rotazione + inserimento)
- **Movimenti**:
  - Rotazione: 90° antioraria (Z-)
  - Traslazione: 0.5 unità verso interno (Z-)
- **Durata totale**: 2.0 secondi
- **Uso**: Inserimento viti, bulloni

---

### 📦 **Comandi per Componenti**

#### `Azione1=estrai`
- **Funzione**: Estrazione semplice (solo movimento)
- **Movimenti**:
  - Traslazione: 0.4 unità verso esterno (Z+)
- **Durata**: 1.0 secondo
- **Uso**: Rimozione coperchi, filtri, tappini

#### `Azione1=inserisci`
- **Funzione**: Inserimento semplice (solo movimento)
- **Movimenti**:
  - Traslazione: 0.4 unità verso interno (Z-)
- **Durata**: 1.0 secondo
- **Uso**: Inserimento componenti, filtri

#### `Azione1=appoggia(durata)`
- **Funzione**: Appoggiamento automatico al pavimento
- **Movimenti**:
  - Traslazione Y automatica fino a Y=0
- **Durata**: Configurabile (es. `appoggia(1.5)`)
- **Uso**: Posizionamento preciso componenti

---

## 🔧 Esempi d'Uso nel Tutorial

### Step per Vite (Rimozione)
```
[Step 1 - Prima vite]
Elemento=models/vite_coperchio_1.glb
Utensile=Mani
Descrizione=Rimuovi la prima vite del coperchio
Azione1=svita
```

### Step per Vite (Rimontaggio)
```
[Step 10 - Rimonta prima vite]
Elemento=models/vite_coperchio_1.glb
Utensile=Mani
Descrizione=Avvita la prima vite del coperchio
Azione1=avvita
```

### Step per Coperchio
```
[Step 5 - Coperchio]
Elemento=models/coperchio.glb
Utensile=Mani
Descrizione=Rimuovi il coperchio
Azione1=estrai
```

### Step per Filtro con Appoggiamento
```
[Step 6 - Filtro]
Elemento=models/filtro.glb
Utensile=Mani
Descrizione=Rimuovi il filtro e appoggialo
Azione1=estrai
Azione2=appoggia(2.0)
```

---

## ⚙️ Compatibilità Completa

### Sintassi Supportate
✅ **Semplificata**: `Azione1=svita`  
✅ **Dettagliata**: `Azione1=rotazione:(0,0,90,1.0)` + `Azione2=traslazione:(0,0,0.5,1.0)`  
✅ **Mista**: `Azione1=svita` + `Azione2=appoggia(1.5)`  

### Tutte le Combinazioni Valide
- `AzioneX=svita` ← Svitamento completo
- `AzioneX=avvita` ← Avvitamento completo  
- `AzioneX=estrai` ← Estrazione semplice
- `AzioneX=inserisci` ← Inserimento semplice
- `AzioneX=appoggia(durata)` ← Appoggiamento automatico
- `AzioneX=rotazione:(x,y,z,durata)` ← Rotazione personalizzata
- `AzioneX=traslazione:(x,y,z,durata)` ← Traslazione personalizzata
- `AzioneX=centro:(x,y,z)` ← Centro di rotazione personalizzato

---

## 🎯 Vantaggi

### **Semplificazione**
- Un comando invece di due operazioni separate
- Parametri ottimizzati per casi comuni
- Sintassi intuitiva e leggibile

### **Flessibilità**
- Compatibilità totale con sintassi esistente
- Combinazione libera di comandi semplificati e dettagliati
- Estensibile per nuovi comandi futuri

### **Manutenibilità** 
- Meno errori di configurazione
- Tutorial più puliti e comprensibili
- Debugging semplificato

---

**Data implementazione**: 6 Settembre 2025  
**Versione sistema**: 1000010+