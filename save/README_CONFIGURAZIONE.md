# Configurazione Automatica per GitHub Pages

Questo visualizzatore 3D può caricare automaticamente la configurazione degli scenari dal server quando viene pubblicato su GitHub Pages.

## Come Funziona

1. **Caricamento Automatico**: All'avvio dell'applicazione, il sistema cerca automaticamente il file `home_config.txt` nella root del progetto
2. **Fallback Manuale**: Se il file non esiste o non può essere caricato, l'utente può ancora caricare manualmente una configurazione
3. **Scenari Dinamici**: Gli scenari vengono generati dinamicamente in base al contenuto del file di configurazione

## File di Configurazione

Il file `home_config.txt` deve seguire questo formato:

```
# Commenti iniziano con #
title=Titolo della Home Page
subtitle=Sottotitolo della Home Page

[Nome Scenario]
description=Descrizione dello scenario che apparirà nella card
image=percorso/alla/immagine.jpg
model=percorso/al/modello.obj
model=percorso/al/materiale.mtl
animation=percorso/all/animazione.txt

[Altro Scenario]
description=Un altro scenario di esempio
image=https://esempio.com/immagine.jpg
model=altro_modello.glb
```

### Campi Supportati

- `title` e `subtitle`: Titolo e sottotitolo della home page
- `[Nome Scenario]`: Inizia un nuovo scenario (il nome va tra parentesi quadre)
- `description`: Descrizione dello scenario
- `image`: Percorso locale o URL dell'immagine (opzionale)
- `model`: Percorso ai file del modello 3D (ripetibile per più file)
- `animation`: Percorso ai file di animazione (opzionale, ripetibile)

## Deploy su GitHub Pages

1. Carica tutti i file nella repository GitHub
2. Assicurati che `home_config.txt` sia nella root del progetto
3. Configura GitHub Pages nelle impostazioni della repository
4. L'applicazione caricherà automaticamente la configurazione

## Vantaggi

- ✅ **Automatico**: Nessun intervento dell'utente necessario
- ✅ **Fallback**: Se il file non esiste, rimane il caricamento manuale
- ✅ **Flessibile**: Facile aggiornare gli scenari modificando solo il file di configurazione
- ✅ **Performance**: Caricamento asincrono senza bloccare l'interfaccia

## Esempio Completo

Vedi il file `home_config.txt` incluso per un esempio completo di configurazione per il training Morbidelli X400.