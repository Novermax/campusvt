/**
 * HelpSystem.js - Help contestuale dell'editor.
 *
 * Ogni controllo importante dell'editor ha accanto un'icona "?" che apre un
 * popup non invasivo con: a cosa serve, quando usarla, effetti, limitazioni
 * ed esempi. Il contenuto è centralizzato qui (registry HELP) così il tono e
 * la struttura restano uniformi in tutta l'applicazione.
 *
 * Uso nei componenti:
 *   HelpSystem.icon('wz-element')  → stringa HTML del bottone "?"
 *   HelpSystem.attach(rootEl)      → delega i click su [data-help] dentro rootEl
 *   HelpSystem.inject(el, key)     → aggiunge l'icona accanto a un elemento DOM
 *
 * Esposto come window.HelpSystem.
 */
(function () {
    'use strict';

    /* ============================ Contenuti ============================ */
    // Struttura voce: { t: titolo, what, when, fx, lim, ex }
    // Tutti i campi tranne t/what sono opzionali.
    const HELP = {
        /* ----- Toolbar ----- */
        'tb-scenario': {
            t: 'Scelta della scena',
            what: 'Seleziona quale scenario (scena 3D + tutorial) modificare. L\'elenco mostra gli scenari definiti in home_config.cvtscript che hanno un file tutorial associato.',
            when: 'È il primo passo: senza una scena caricata l\'editor resta vuoto.',
            fx: 'Carica i modelli 3D reali nell\'anteprima e il testo del tutorial nei pannelli Step/Wizard/Codice.',
            lim: 'Cambiando scena si perde il lavoro non salvato: l\'editor chiede conferma se ci sono modifiche in sospeso.'
        },
        'tb-addstep': {
            t: 'Nuovo step',
            what: 'Aggiunge uno step vuoto subito dopo lo step selezionato (o in fondo se nessuno è selezionato).',
            when: 'Per inserire un nuovo passaggio del tutorial nel punto in cui ti trovi.',
            fx: 'Crea un blocco [step "Nuovo step"] nel file e lo seleziona per la modifica immediata nel Wizard.',
            ex: 'Seleziona lo step 3 e premi "＋ Step": il nuovo step diventa il numero 4.'
        },
        'tb-addsection': {
            t: 'Nuova sezione (tutorial)',
            what: 'Crea una nuova sezione, cioè un nuovo tutorial selezionabile dall\'utente. La sezione viene inserita DOPO la sezione corrente, con un primo step vuoto.',
            when: 'Quando vuoi aggiungere un nuovo argomento/procedura alla scena (es. "Sostituzione filtro").',
            fx: 'Aggiunge un blocco [section "Titolo"] + uno step iniziale. Nel runtime apparirà come voce nel menu dei tutorial.',
            lim: 'Il titolo può essere cambiato in seguito con il pulsante ✎ accanto alla sezione.'
        },
        'tb-validate': {
            t: 'Verifica del tutorial',
            what: 'Controlla tutto il file alla ricerca di problemi: campi obbligatori mancanti, tool sconosciuti, azioni non valide, parentesi non bilanciate, sezioni vuote.',
            when: 'Prima di salvare, o quando l\'anteprima non si comporta come previsto.',
            fx: 'Mostra un report con errori (❌ da correggere) e avvisi (⚠️ consigliati). Non modifica il file.',
            lim: 'La verifica è sintattica: non può garantire che i nomi di modelli/mesh esistano nei GLB della scena.'
        },
        'tb-save': {
            t: 'Salva',
            what: 'Salva il tutorial modificato sul file .cvtscript della scena.',
            when: 'Appena hai completato un blocco di modifiche. Il pallino ● sul pulsante indica modifiche non ancora salvate.',
            fx: 'Nell\'app desktop scrive direttamente il file. Nel browser scarica il file (va poi copiato a mano nella cartella della scena).',
            lim: 'Se la verifica trova errori, l\'editor chiede conferma prima di salvare comunque.'
        },
        'tb-download': {
            t: 'Scarica',
            what: 'Scarica una copia del tutorial corrente come file .cvtscript (e la copia negli appunti).',
            when: 'Per fare un backup o condividere il file senza sovrascrivere quello della scena.',
            fx: 'Genera un download del browser. Il file della scena NON viene toccato.'
        },
        'tb-close': {
            t: 'Chiudi editor',
            what: 'Chiude l\'editor e torna alla home dell\'applicazione.',
            fx: 'Ripristina la scena 3D e l\'interfaccia del runtime.',
            lim: 'Se ci sono modifiche non salvate viene chiesta conferma prima di uscire.'
        },
        /* ----- Tabs ----- */
        'tab-wizard': {
            t: 'Scheda Wizard',
            what: 'Form guidato per modificare lo step selezionato campo per campo, senza scrivere sintassi a mano.',
            when: 'È la modalità consigliata per l\'uso quotidiano.',
            fx: 'Ogni modifica aggiorna in tempo reale il testo (scheda Codice) e l\'anteprima 3D.'
        },
        'tab-code': {
            t: 'Scheda Codice',
            what: 'Editor testuale del file .cvtscript con evidenziazione della sintassi v3.',
            when: 'Per modifiche avanzate, blocchi globali ([state], [object], [screen]…) o step in sintassi legacy.',
            fx: 'Il testo è la fonte di verità: ciò che scrivi qui si riflette su timeline, wizard e anteprima.',
            lim: 'Errori di sintassi possono rendere lo step invisibile alla timeline: usa "Verifica" per individuarli.'
        },
        'tab-screens': {
            t: 'Scheda Schermate',
            what: 'Utility per trasformare uno screenshot PNG del software macchina in un modello GLB agganciabile al monitor 3D.',
            when: 'Quando devi mostrare una schermata del software su uno schermo del modello.',
            fx: 'Genera un quad 3D sempre "acceso" (non influenzato dalle luci) ed esportabile come .glb.'
        },
        /* ----- Timeline ----- */
        'tl-panel': {
            t: 'Elenco step',
            what: 'Mostra la struttura del tutorial: sezioni e step nell\'ordine del file. Clicca uno step per selezionarlo e modificarlo.',
            fx: 'La selezione sincronizza il Wizard e porta l\'anteprima 3D esattamente a quello step (con fast-forward delle trasformazioni precedenti).',
            ex: 'I badge colorati indicano i flag (auto, machine, highlight), "legacy" segnala step in sintassi vecchia (modificabili solo dalla scheda Codice). Il badge ⚠/❌ segnala problemi rilevati dalla verifica.'
        },
        /* ----- Wizard fields ----- */
        'wz-title': {
            t: 'Titolo step',
            what: 'Il nome dello step, mostrato nella barra degli step del runtime e nella timeline dell\'editor.',
            lim: 'Obbligatorio: uno step senza titolo genera un errore in verifica.'
        },
        'wz-flags': {
            t: 'Flag dello step',
            what: 'Modificatori del comportamento: “auto” esegue lo step automaticamente senza click; “machine” indica un\'operazione della macchina (anch\'essa automatica); “highlight” evidenzia l\'elemento con una velatura gialla.',
            when: 'auto/machine per sequenze non interattive; highlight per guidare l\'occhio dell\'utente sul pulsante/elemento richiesto.',
            fx: 'Con auto o machine l\'utente non deve cliccare: l\'animazione parte da sola e lo step avanza.'
        },
        'wz-description': {
            t: 'Descrizione (fumetto)',
            what: 'Il testo mostrato nel fumetto sopra la scena durante lo step: spiega all\'utente cosa fare o cosa sta succedendo.',
            when: 'Consigliata in ogni step interattivo.',
            ex: '«Svita le 4 viti del coperchio con la chiave a brugola.»'
        },
        'wz-element': {
            t: 'Element',
            what: 'L\'oggetto 3D su cui agisce lo step: un modello (es. vite_coperchio_1) o un child interno con dot notation (es. a500.Basamento).',
            when: 'Obbligatorio negli step con azioni, tool, drag o click.',
            fx: 'Determina cosa viene animato, evidenziato o reso cliccabile. Il tipo di interazione è dedotto dal contesto: element+tool+azioni = clic con strumento; element+azioni = clic diretto; element da solo = clic per avanzare.',
            ex: 'Usa 📋 per scegliere dall\'elenco gerarchico dei modelli o 🎯 per cliccare direttamente l\'oggetto nell\'anteprima.'
        },
        'wz-tree': {
            t: 'Elenco modelli (📋)',
            what: 'Apre l\'albero dei modelli caricati in scena con tutti i loro child, filtrabile per nome.',
            fx: 'Cliccando un nodo, il suo percorso (modello.child) viene inserito nel campo Element.',
            lim: 'Il simbolo ↺ segnala nomi duplicati: a runtime viene usato il primo trovato.'
        },
        'wz-pick': {
            t: 'Pick dall\'anteprima (🎯)',
            what: 'Attiva la modalità "clicca per scegliere": il prossimo click nell\'anteprima 3D imposta l\'oggetto cliccato come Element.',
            when: 'Quando è più facile indicare l\'oggetto a video che ricordarne il nome.',
            lim: 'Restituisce il nome del modello root; per un child interno usa l\'elenco 📋.'
        },
        'wz-repeat': {
            t: 'Repeat',
            what: 'Numero di click ripetuti richiesti sull\'element (frame animation): l\'utente deve cliccare N volte.',
            when: 'Per pulsanti da premere ripetutamente, es. jog manuale.',
            ex: 'element = remote.Pulsante_r_unlock con repeat 8.'
        },
        'wz-tool': {
            t: 'Tool (strumento)',
            what: 'Lo strumento che l\'utente deve equipaggiare per completare lo step: mano, brugola, chiave inglese, aria compressa o spray.',
            fx: 'Il cursore cambia e il click sull\'element è accettato solo con lo strumento giusto.',
            lim: 'Vocabolario chiuso: hand, hex_key, wrench, air, spray.'
        },
        'wz-actions': {
            t: 'Azioni (do)',
            what: 'Le animazioni eseguite sull\'element, una per riga, nell\'ordine scritto. Verbi: unscrew, screw, extract, insert, place, move, rotate, pump, idle. È valida anche la forma "gruppo = variante" per cambiare stato direttamente.',
            when: 'In ogni step in cui l\'oggetto deve muoversi.',
            fx: 'Ogni riga diventa "do : …" nel file. Lo step attende la fine delle animazioni prima di avanzare.',
            ex: 'unscrew distance 0.3\nextract distance 0.4\nmove by (0,0,0.1) duration 0.5',
            lim: 'La direzione di unscrew/extract viene letta da home_config.cvtscript (direction=x,y,z del modello).'
        },
        'wz-camera': {
            t: 'Camera',
            what: 'Inquadratura dello step: position, target, zoom, fade (durata transizione), pivot, distance, fov, rotation.',
            when: 'Solo se l\'inquadratura cambia rispetto allo step precedente: gli step ereditano la camera dal contesto.',
            fx: 'All\'ingresso nello step la camera si sposta con una transizione di "fade" secondi.',
            ex: 'Inquadra la scena nell\'anteprima 3D e premi 📷 per catturare la sintassi già pronta.'
        },
        'wz-camerabtn': {
            t: 'Cattura camera (📷)',
            what: 'Copia l\'inquadratura corrente dell\'anteprima 3D nel campo Camera, già formattata in sintassi v3.',
            when: 'Dopo aver ruotato/zoomato l\'anteprima fino all\'inquadratura desiderata.'
        },
        'wz-drag': {
            t: 'Drag & drop',
            what: 'Rende trascinabili uno o più oggetti e definisce dove possono essere rilasciati (snap).',
            fx: 'Lo step si completa quando l\'oggetto viene agganciato a un punto di snap valido.',
            ex: 'vite distance 1.5 snap targets foro_1.origin, foro_2.origin\nflangia distance 0.3 snap offset (0,0,0.02)',
            lim: '"distance" è la soglia di aggancio; "offset" è relativo alla posizione originale; "pivot" usa il pivot invece del centro.'
        },
        'wz-after': {
            t: 'Dopo il click (after)',
            what: 'Cambio di stato eseguito quando l\'utente clicca l\'element: assegna una variante a uno StateGroup (es. schermo = schermo002). Più assegnazioni separate da ";".',
            when: 'Per pulsanti che cambiano schermate, LED o altri stati visivi.',
            fx: 'Dopo il click lo stato cambia e lo step avanza.',
            ex: 'Con 🎨 scegli la variante da un\'anteprima grafica dei gruppi di stato della scena.'
        },
        'wz-hold': {
            t: 'Hold (oggetto in mano)',
            what: 'Gestisce oggetti impugnabili: "pick at (pos) facing (rot)" prende in mano l\'oggetto del campo Element; "held" richiede che sia già in mano; "release" lo rilascia.',
            when: 'Per telecomandi, utensili o pezzi che l\'utente deve portare con sé per più step.',
            lim: 'L\'oggetto deve essere dichiarato Holdable nella definizione globale (blocco [screen] / [object]).'
        },
        'wz-message': {
            t: 'Messaggio (modal)',
            what: 'Testo mostrato in una finestra modale all\'inizio dello step. Supporta \\n per andare a capo.',
            when: 'Per avvisi di sicurezza, spiegazioni lunghe o istruzioni con immagine/video.',
            fx: 'Uno step con solo Messaggio (senza element/azioni) avanza automaticamente dopo l\'OK dell\'utente.'
        },
        'wz-msgtitle': {
            t: 'Titolo del messaggio',
            what: 'Titolo della finestra modale. Se vuoto viene usato il titolo dello step.',
            ex: '⚠️ Importante'
        },
        'wz-image': {
            t: 'Immagine del messaggio',
            what: 'Percorso di un\'immagine mostrata dentro la finestra modale.',
            ex: 'scenes/Pompa_Becker/schema.jpg'
        },
        'wz-video': {
            t: 'Video del messaggio',
            what: 'Percorso di un video mostrato nella modale con i controlli del player.',
            ex: 'media/procedura.mp4'
        },
        'wz-view': {
            t: 'View (schermo)',
            what: 'Vista di uno schermo interattivo da attivare in questo step (es. "main" per la vista principale del telecomando).',
            when: 'Negli step che prendono in mano un oggetto con schermo (hold) o che devono mostrare una vista specifica.',
            ex: 'view = main'
        },
        'wz-sound': {
            t: 'Sound',
            what: 'File audio riprodotto durante lo step.',
            ex: 'sounds/click.mp3'
        },
        'wz-animation': {
            t: 'Animation (frame 2D)',
            what: 'Sequenza di immagini 2D mostrata in sovraimpressione, avanzata dai click sull\'element (usato con "repeat N").',
            fx: 'Ogni click sull\'element avanza i frame della cartella indicata.',
            ex: 'folder screens/mandrino at (60%, 60%) frame 20ms',
            lim: 'La cartella deve contenere i frame numerati; la posizione è in percentuale dello schermo.'
        },
        /* ----- Editor sezione / scena ----- */
        'sec-editor': {
            t: 'Proprietà della sezione',
            what: 'Impostazioni che valgono per tutta la sezione (tutorial): titolo, camera iniziale, stato iniziale degli StateGroup e posizioni iniziali dei modelli.',
            when: 'Si apre cliccando il titolo di una sezione nell\'elenco a sinistra.',
            fx: 'Le proprietà vengono applicate quando l\'utente seleziona il tutorial, prima del primo step.'
        },
        'sec-title': {
            t: 'Titolo sezione',
            what: 'Il nome del tutorial mostrato nel menu di selezione del runtime.',
            lim: 'Obbligatorio. Titoli duplicati generano un avviso in verifica.'
        },
        'sec-camera': {
            t: 'Camera della sezione',
            what: 'Inquadratura iniziale del tutorial: tutti gli step la ereditano finché non definiscono una camera propria.',
            ex: 'Inquadra la scena nell\'anteprima e premi 📷.'
        },
        'sec-do': {
            t: 'Stato iniziale (do)',
            what: 'Cambi di stato applicati alla selezione del tutorial, una riga per assegnazione (senza "do :"). Più assegnazioni sulla stessa riga separate da ";".',
            when: 'Per portare schermi, LED e utensili nello stato di partenza corretto della procedura.',
            ex: 'schermo = schermo001 ; tool = tool0',
            lim: 'A inizio sezione non esiste alcun trigger: usa queste righe (non "after").'
        },
        'sec-extra': {
            t: 'Posizioni iniziali',
            what: 'Righe complete position/rotation/companion applicate all\'avvio della sezione: portano i modelli nella posizione di partenza della procedura.',
            ex: 'position = a500.Basamento_Portale_CarroY at (0, 0, 2.623)',
            lim: 'Scrivi le righe complete, inclusa la parola chiave iniziale (position = …).'
        },
        'scene-editor': {
            t: 'Proprietà globali della scena',
            what: 'Il blocco [scene] del file: impostazioni applicate al caricamento dello scenario, prima di scegliere un tutorial.',
            when: 'Si apre cliccando "🎬 Proprietà scena" in cima all\'elenco.'
        },
        'scene-camera': {
            t: 'Camera iniziale della scena',
            what: 'L\'inquadratura mostrata appena lo scenario è caricato, prima che l\'utente avvii un tutorial.',
            ex: 'position (1.01, 1.22, 3.87), target (0, 0, 0), fov 75.0, fade 2.0'
        },
        /* ----- Screen panel ----- */
        'sp-png': {
            t: 'Sorgente PNG',
            what: 'Lo screenshot del software macchina da trasformare in schermo 3D. Trascina il file o clicca per selezionarlo.',
            lim: 'Solo formato PNG. L\'aspect ratio viene mantenuto nel fit al monitor.'
        },
        'sp-viewport': {
            t: 'Inserimento in scena',
            what: 'Crea il quad 3D dalla PNG e lo aggiunge alla scena live, trascinabile con il mouse.',
            fx: 'Il mesh usa un materiale "unlit": appare sempre acceso, non oscurato dalle luci.',
            when: 'Per verificare l\'aspetto della schermata prima dell\'export.'
        },
        'sp-snap': {
            t: 'Aggancio al monitor',
            what: 'Aggancia il quad al frame di un monitor definito con [ScreenSnap:id] nel tutorial della scena, con la stessa logica del runtime (fit "contain", allineamento alla normale).',
            lim: 'Se la tendina è vuota, la scena non definisce blocchi ScreenSnap.'
        },
        'sp-export': {
            t: 'Esportazione GLB',
            what: 'Esporta la schermata come file .glb (model/gltf-binary) ricaricabile come modello di scenario.',
            fx: 'Il GLB dichiara KHR_materials_unlit: ricaricato, lo schermo resta sempre acceso.',
            ex: 'Salva il file in scenes/<Scena>/models/ e usalo come un normale modello.'
        }
    };

    /* ============================ Componente ============================ */
    const HelpSystem = {
        _pop: null,
        _docHandler: null,
        _keyHandler: null,

        /** HTML dell'icona "?" per la chiave data (stringa vuota se la voce non esiste). */
        icon: function (key) {
            if (!HELP[key]) return '';
            return `<button type="button" class="hlp-btn" data-help="${key}" title="Aiuto" aria-label="Aiuto">?</button>`;
        },

        /** Inietta l'icona "?" come fratello successivo di `el`. */
        inject: function (el, key) {
            if (!el || !HELP[key]) return;
            if (el.nextElementSibling && el.nextElementSibling.classList &&
                el.nextElementSibling.classList.contains('hlp-btn')) return; // già presente
            const span = document.createElement('span');
            span.innerHTML = this.icon(key);
            el.insertAdjacentElement('afterend', span.firstElementChild);
        },

        /** Delega i click su [data-help] dentro rootEl (chiamare una volta). */
        attach: function (rootEl) {
            const root = rootEl || document;
            if (root._helpAttached) return;
            root._helpAttached = true;
            root.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-help]');
                if (!btn) return;
                e.preventDefault();
                e.stopPropagation();
                const key = btn.getAttribute('data-help');
                if (this._pop && this._pop.getAttribute('data-key') === key) this.close();
                else this.show(key, btn);
            });
        },

        show: function (key, anchorEl) {
            const entry = HELP[key];
            if (!entry) return;
            this.close();

            const esc = (s) => String(s == null ? '' : s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const section = (label, text, mono) => text
                ? `<div class="hlp-sec"><div class="hlp-sec-label">${label}</div>
                   <div class="hlp-sec-text${mono ? ' hlp-mono' : ''}">${esc(text).replace(/\n/g, '<br>')}</div></div>`
                : '';

            const pop = document.createElement('div');
            pop.className = 'hlp-popover';
            pop.setAttribute('data-key', key);
            pop.innerHTML = `
                <div class="hlp-head">
                    <span class="hlp-title">💡 ${esc(entry.t)}</span>
                    <button type="button" class="hlp-close" aria-label="Chiudi">✕</button>
                </div>
                <div class="hlp-body">
                    ${section('A cosa serve', entry.what)}
                    ${section('Quando usarla', entry.when)}
                    ${section('Effetti', entry.fx)}
                    ${section('Limitazioni', entry.lim)}
                    ${section('Esempio', entry.ex, true)}
                </div>`;
            document.body.appendChild(pop);
            this._pop = pop;

            // Posizionamento accanto all'ancora, dentro la finestra
            const r = anchorEl.getBoundingClientRect();
            const margin = 8;
            const w = pop.offsetWidth, h = pop.offsetHeight;
            let left = r.right + 6;
            if (left + w > window.innerWidth - margin) left = Math.max(margin, r.left - w - 6);
            if (left + w > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - w - margin);
            let top = r.top;
            if (top + h > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - h - margin);
            pop.style.left = left + 'px';
            pop.style.top = top + 'px';

            pop.querySelector('.hlp-close').addEventListener('click', () => this.close());
            setTimeout(() => {
                this._docHandler = (e) => {
                    if (!pop.contains(e.target) && !e.target.closest('[data-help]')) this.close();
                };
                this._keyHandler = (e) => { if (e.key === 'Escape') this.close(); };
                document.addEventListener('mousedown', this._docHandler, true);
                document.addEventListener('keydown', this._keyHandler, true);
            }, 0);
        },

        close: function () {
            if (this._pop) { this._pop.remove(); this._pop = null; }
            if (this._docHandler) {
                document.removeEventListener('mousedown', this._docHandler, true);
                this._docHandler = null;
            }
            if (this._keyHandler) {
                document.removeEventListener('keydown', this._keyHandler, true);
                this._keyHandler = null;
            }
        }
    };

    window.HelpSystem = HelpSystem;
})();
