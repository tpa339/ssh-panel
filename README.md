# ssh-panel

Claude-Code-Mod: ein Panel neben dem Chat, in dem du SSH-Server und -Schlüssel für die aktuelle Session per Klick freigibst oder entziehst. Änderungen passieren nur durch Klicks des Nutzers; die Mod registriert kein Tool für das Modell.

## Voraussetzung

Die Mod ist nur die Oberfläche. Sie ruft ein lokales Kommandozeilenwerkzeug unter `$HOME/Claude/ssh/bin/ssh-zugang` auf, das **nicht** Teil dieses Repos ist. Es muss folgende Unterbefehle bieten:

- `json --projekt <ordner>`: liefert den Stand als JSON (Format siehe `types/index.d.ts`, Typ `Stand`)
- `freigeben|entziehen <host> --projekt <ordner>`
- `schluessel-freigeben|schluessel-entziehen <name> --projekt <ordner>`
- `installieren`, `global --ja`, `global --ja --selbstschutz`

## Installation

Am Prompt einer Terminal-Session:

```
/plugin install ssh-panel --marketplace tpa339/ssh-panel
```

Danach `y` zum Hinzufügen des Marketplace und einen Scope wählen (Enter = User).

Aus einer Shell:

```
claude plugin install ssh-panel --marketplace tpa339/ssh-panel
```

In der Desktop-App: + neben dem Eingabefeld → Plugins → Add marketplace `tpa339/ssh-panel` → Add plugin.

## Nutzung

Das Panel öffnet sich beim Session-Start; sonst `/ssh-panel`.
