export type Host = {
  alias: string
  ziel: string
  schluessel: string
  vorhanden: boolean
  passphrase: boolean
  quelle: 'liste' | 'config'
  frei: boolean
}

export type Schluessel = {
  name: string
  passphrase: boolean
  frei: boolean
  beiHost: boolean
}

export type Stand = {
  projekt: string
  hosts: Host[]
  schluessel: Schluessel[]
  schutz: { sshGesperrt: boolean; selbstschutz: boolean; installiert: boolean }
}

declare module 'claude-code' {
  interface PluginState {
    'ssh-panel': {
      stand: Shaped<Stand | null>
      meldung: Shaped<string>
      bestaetigen: Shaped<string>
    }
  }
}
