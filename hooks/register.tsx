import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register } from 'claude-code'

import type { Stand } from '../types'

// Panel für ~/Claude/ssh/bin/ssh-zugang: SSH-Server und -Schlüssel für die aktuelle Session
// per Klick freigeben. Änderungen laufen nur über Klicks des Nutzers (onPress).
// Der Mod registriert bewusst kein Tool für das Modell.

const PANE = 'ssh-panel'

const stand = atom({ plugin: 'ssh-panel', key: 'stand' } as const, null as Stand | null, { shape: 'stand-2' })
const meldung = atom({ plugin: 'ssh-panel', key: 'meldung' } as const, '', { shape: 'meldung-1' })
const bestaetigen = atom({ plugin: 'ssh-panel', key: 'bestaetigen' } as const, '', { shape: 'bestaetigen-1' })

// Skript über $HOME aufrufen, ohne Benutzernamen im Code.
const skript = (args: string[]) => [
  '/bin/sh', '-c', 'exec "$HOME/Claude/ssh/bin/ssh-zugang" "$@"', 'ssh-zugang', ...args,
]

let laedt = false

async function laden($: Engine) {
  if (laedt) return
  laedt = true
  try {
    const root = await $.session.root()
    const r = await $.process.run(skript(['json', '--projekt', root]))
    if (r.exitCode !== 0) {
      await update($, meldung, () => `✗ ${r.stderr.trim() || 'ssh-zugang json fehlgeschlagen'}`)
      return
    }
    const s = JSON.parse(r.stdout) as Stand
    await update($, stand, () => s)
    const teile = [
      ...s.hosts.filter(x => x.frei).map(x => x.alias),
      ...s.schluessel.filter(k => k.frei).map(k => `🔑${k.name}`),
    ]
    $.ui.status(`SSH: ${teile.length ? teile.join(', ') : '–'}`)
  } catch (err) {
    await update($, meldung, () => `✗ ${String(err)}`)
  } finally {
    laedt = false
  }
}

async function ausfuehren($: Engine, args: string[], titel: string) {
  await update($, meldung, () => `… ${titel}`)
  const r = await $.process.run(skript(args), { timeoutMs: 120000 })
  const zeilen = `${r.stdout}\n${r.stderr}`.split('\n').map(z => z.trim()).filter(Boolean)
  const wichtig = zeilen.filter(z => z.startsWith('WARNUNG') || z.startsWith('Fehler'))
  const text = r.exitCode === 0
    ? `✓ ${titel}${wichtig.length ? ' – ' + wichtig.join(' · ') : ''}`
    : `✗ ${titel}: ${wichtig.join(' · ') || zeilen.slice(-1)[0] || 'Fehler'}`
  await update($, meldung, () => text)
  await update($, bestaetigen, () => '')
  await laden($)
}

const AKTIONEN: Record<string, { args: string[]; titel: string; text: string }> = {
  schutz: {
    args: ['global', '--ja'],
    titel: 'Schutz eingeschaltet',
    text: '~/.ssh für alle Agenten sperren, ssh-agent leeren, ~/.ssh/config aufräumen (mit Backup).',
  },
  selbstschutz: {
    args: ['global', '--ja', '--selbstschutz'],
    titel: 'Selbstschutz eingeschaltet',
    text: 'Freigabeliste, Skript und dieses Panel für Agenten schreibschützen.',
  },
  installieren: {
    args: ['installieren'],
    titel: 'Für alle Sessions installiert – neue Sessions zeigen das Panel',
    text: 'Panel, Regel und /ssh-zugang für alle Claude-Sessions verlinken (~/.claude/skills, ~/.claude/rules).',
  },
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'ssh-panel',
      description: 'SSH-Server und -Schlüssel für diese Session per Klick freigeben',
    })
    void laden($)
    void $.ui.open({ id: PANE, title: 'SSH-Zugänge' })
    return next(e)
  })

  on('command.run', { command: 'ssh-panel' }, async $ => {
    await laden($)
    await $.ui.open({ id: PANE, title: 'SSH-Zugänge', focus: true })
    return { text: 'SSH-Panel geöffnet.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const s = await read($, stand)
    const msg = await read($, meldung)
    if (!s) {
      void laden($)
      return <Text dimColor>{msg || 'Lade SSH-Zugänge …'}</Text>
    }
    const frage = await read($, bestaetigen)
    const aktion = frage ? AKTIONEN[frage] : undefined
    const projektName = s.projekt === '.' ? '~/Claude' : s.projekt

    const ip = (ziel: string) => ziel.replace(/^.*@/, '').replace(/:22$/, '')
    const freieKeys = s.schluessel.filter(k => !k.beiHost)

    return (
      <Box flexDirection="column">
        <Text wrap="truncate-start">
          📁 <Text bold>{projektName}</Text>
        </Text>
        <Text> </Text>

        <Text bold>Server</Text>
        {s.hosts.map(host => (
          <Box flexDirection="row">
            <Button
              key={`host-${host.alias}`}
              plain
              onPress={() =>
                void ausfuehren(
                  $,
                  [host.frei ? 'entziehen' : 'freigeben', host.alias, '--projekt', s.projekt],
                  `${host.alias} ${host.frei ? 'entzogen' : 'freigegeben'}`,
                )
              }
            >
              <Text color={host.frei ? 'green' : undefined} bold={host.frei}>
                {host.frei ? '✓ ' : '○ '}
                {host.alias}
              </Text>
            </Button>
            <Text dimColor wrap="truncate">
              {' '}
              {host.passphrase ? '🔒 ' : ''}
              {!host.vorhanden ? '⚠ ' : ''}
              {host.quelle === 'config' ? 'ssh-config' : ip(host.ziel)}
            </Text>
          </Box>
        ))}
        <Text> </Text>

        <Text bold>Weitere Schlüssel</Text>
        {freieKeys.map(k => (
          <Button
            key={`key-${k.name}`}
            plain
            onPress={() =>
              void ausfuehren(
                $,
                [k.frei ? 'schluessel-entziehen' : 'schluessel-freigeben', k.name, '--projekt', s.projekt],
                `Schlüssel ${k.name} ${k.frei ? 'entzogen' : 'freigegeben'}`,
              )
            }
          >
            <Text color={k.frei ? 'green' : undefined} bold={k.frei}>
              {k.frei ? '✓ ' : '○ '}
              {k.passphrase ? '🔒 ' : ''}
              {k.name}
            </Text>
          </Button>
        ))}
        <Text dimColor>🔒 Passphrase: für Agenten nicht nutzbar</Text>
        <Text> </Text>

        <Text bold>Absicherung</Text>
        <Text dimColor={!s.schutz.installiert}>{s.schutz.installiert ? '✓' : '○'} alle Sessions</Text>
        <Text dimColor={!s.schutz.sshGesperrt}>{s.schutz.sshGesperrt ? '✓' : '○'} ~/.ssh gesperrt</Text>
        <Text dimColor={!s.schutz.selbstschutz}>{s.schutz.selbstschutz ? '✓' : '○'} Selbstschutz</Text>
        {aktion ? (
          <Box flexDirection="column">
            <Text color="yellow">{aktion.text} Wirklich?</Text>
            <Box flexDirection="row">
              <Button key="ja" variant="primary" onPress={() => void ausfuehren($, aktion.args, aktion.titel)}>
                Ja, ausführen
              </Button>
              <Text> </Text>
              <Button key="nein" onPress={() => void update($, bestaetigen, () => '')}>
                Abbrechen
              </Button>
            </Box>
          </Box>
        ) : (
          <Box flexDirection="column">
            {!s.schutz.installiert && (
              <Button key="installieren" variant="primary" onPress={() => void update($, bestaetigen, () => 'installieren')}>
                In allen Sessions anzeigen
              </Button>
            )}
            {s.schutz.installiert && !s.schutz.sshGesperrt && (
              <Button key="schutz" onPress={() => void update($, bestaetigen, () => 'schutz')}>
                Schutz einschalten
              </Button>
            )}
            {s.schutz.sshGesperrt && !s.schutz.selbstschutz && (
              <Button key="selbstschutz" onPress={() => void update($, bestaetigen, () => 'selbstschutz')}>
                Selbstschutz einschalten
              </Button>
            )}
            <Button key="neu" onPress={() => void laden($)}>
              Aktualisieren
            </Button>
          </Box>
        )}
        {msg ? <Text dimColor wrap="wrap">{msg}</Text> : null}
      </Box>
    )
  })
}
