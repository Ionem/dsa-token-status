# DSA – Token-Status, Version 1.0.0

Eine Owlbear-Rodeo-Extension für **DSA 4.1**. Sie zeigt an runden Charakter-Tokens 0–3 Wunden als kleine rote Blutstropfen. Position: **erste Wunde 12 Uhr, zweite 11 Uhr, dritte 1 Uhr**. Die Grafiken bleiben vollständig innerhalb des Tokenkreises.

## Bedienung

1. Token auf der **CHARACTER**-Ebene in Owlbear Rodeo auswählen.
2. Kontextmenü öffnen. Als Spielleiter sind vier Aktionen verfügbar: **DSA · 0 Wunden**, **DSA · 1 Wunde**, **DSA · 2 Wunden**, **DSA · 3 Wunden**.
3. Die gewünschte Wundenzahl direkt anklicken. Bei mehreren ausgewählten Charakter-Tokens wird der gleiche Status auf alle angewendet.
4. **0 Wunden** entfernt die grafische Markierung. Bereits angelegte Token-Metadaten bleiben mit Wert `0` erhalten.

Die Grafik ist ein nicht anklickbares, gesperrtes Attachment und bewegt und skaliert sich mit dem Charakter. Der Status wird außerdem als eigener Metadatenwert gespeichert und mit der Szene synchronisiert. Spieler sehen die Markierung, können aber über diese Extension die Wundenzahl nicht ändern.

**V1-Einschränkung:** Unterstützt quadratische Charakter-Bilder, wie sie bei runden Tokens üblich sind. Andere Ebenen (Props, Mounts, etc.) werden ignoriert. Rotiert das Token, rotiert sein Attachment mit. Die Funktion wurde gegen die SDK-Referenz entwickelt, aber noch nicht in einer realen Owlbear-Rodeo-Szene getestet.

## Installation auf GitHub Pages (empfohlen; kein lokaler Build nötig)

1. Neues GitHub-Repository erstellen, z. B. `dsa-token-status`.
2. Alle **Inhalte** dieses Projektordners in das Repository hochladen. Die Ordnerstruktur (einschließlich `.github/workflows/pages.yml`) beibehalten. Commit auf `main`.
3. In GitHub **Settings → Pages → Build and deployment** die Quelle **GitHub Actions** auswählen.
4. Der enthaltene Workflow installiert die Abhängigkeiten, führt die automatisierten Tests aus, erstellt den Build und veröffentlicht die Website. Außerdem korrigiert er die Manifest-Adressen für das konkrete Repository automatisch.
5. Nach erfolgreichem Workflow in Owlbear Rodeo **Profile → Add Extension** öffnen und diese Adresse verwenden:

   `https://DEIN-NUTZERNAME.github.io/dsa-token-status/manifest.json`

   Falls das Repository einen anderen Namen hat, `dsa-token-status` in der URL ersetzen.
6. Die Extension in deinem Owlbear-Rodeo-Raum aktivieren. Die vier GM-Kontextaktionen erscheinen, sobald ein Character-Token ausgewählt ist.

**Wichtig:** Ein `.zip` nicht als eine einzige Datei in das Repository hochladen. Erst entpacken und dann den Inhalt hochladen. Ohne `.github/workflows/pages.yml` findet kein automatischer Pages-Build statt.

**Hinweis zu GitHub Pages:** Die automatische URL-Generierung setzt die Standardadresse `<owner>.github.io/<repository>` voraus. Bei einem benutzerdefinierten Domainnamen `SITE_URL` im Workflow anpassen. Die URL wird nach dem ersten erfolgreichen Deployment verfügbar.

## Lokales Entwickeln

Voraussetzung Node.js 20.19+ und Internetzugang zur Installation:

```bash
npm install
npm run dev
```

In Owlbear Rodeo die Testadresse `http://localhost:5173/manifest-local.json` als Extension hinzufügen. Die Browser-Sicherheitseinstellungen müssen die lokale iframe-Verbindung zulassen.

Prüfen/Build:

```bash
npm run check
npm run build
```

## Technische Architektur

- **SDK:** `@owlbear-rodeo/sdk@3.1.0`, gepackt mit Vite.
- **Hintergrundseite:** `background.html`; keine externe Datenbank, keine eigene Serverkomponente.
- **Token-Metadaten:** `de.gmtools.dsa-token-status/token-v1` → `{version:1,wounds:0..3}`.
- **Attachment-Metadaten:** `de.gmtools.dsa-token-status/overlay-v1` → `{version:1,wounds:1..3}`.
- **Grafik:** Transparente PNG (1000×1000) aus den freigestellten SVG-Originalen, pro Status ein Asset.
- **Positionierung:** Für das Attachment werden Bildraster/DPI und Offset des Tokens proportional umgerechnet, damit die Overlay-Fläche denselben Weltmaßstab wie das quadratische Token hat. Über `attachedTo` koppelt Owlbear Bewegung/Skalierung/Rotation/Kopieren/Löschen.
- **Rollen:** Kontextmenü über SDK-Filter ausschließlich für GM; zusätzlich wird die Rolle vor jeder Änderung geprüft.
- **Mehrfachauswahl:** Eine Aktion setzt denselben Wert an allen ausgewählten Charakteren.
- **Duplikate:** Bei erneuter Statusänderung werden überzählige Wund-Attachments des betroffenen Tokens entfernt.

## Verifikation / offene Live-Tests

Die automatisierten Tests prüfen Statuslogik, Aktualisieren und Entfernen von Overlays, Mehrfachauswahl, Berechtigung, Geometrieberechnung und Kontextmenüdefinition. Der praktische Owlbear-Test sollte noch prüfen:

- Unterschiedliche runde Token mit 1, 2 und 3 Feldern Durchmesser.
- Verschieben, Skalieren, Drehen, Kopieren, Löschen.
- 0 → 1 → 2 → 3 → 0, wiederholte Aufrufe, Auswahl mehrerer Charaktere.
- GM-/Spieleransicht in zwei Browserfenstern.
- Szenenwechsel und erneutes Öffnen derselben Szene.
- Mögliche Ankerpunktabweichungen bei manuell zugeschnittenen Bildern.

### Verzeichnisübersicht

- `src/core.mjs`: Validierung, Statusverarbeitung, Attachment-Logik.
- `src/main.mjs`: Owlbear SDK-Initialisierung.
- `public/assets/`: Wundgrafiken PNG/SVG.
- `public/icons/`: Kontextmenü- und Erweiterungssymbole.
- `.github/workflows/pages.yml`: Build/Deployment.
- `scripts/patch-manifest.mjs`: absolute Manifest-URLs für Pages.
- `tests/`: automatisierte Unit-Tests.

