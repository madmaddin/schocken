'use client';

import type { GameRules } from '@/game/rules/types';

// ─── Primitive Bausteine ──────────────────────────────────────────────────────

export function RuleGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

export function RuleToggle({
  checked, onToggle, label, description, small = false,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  description: string;
  small?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 cursor-pointer" onClick={onToggle}>
      <div className={`mt-0.5 shrink-0 rounded-full transition-colors flex items-center
        ${small ? 'w-8 h-5' : 'w-10 h-6'}
        ${checked ? 'bg-amber-500' : 'bg-gray-600'}`}
      >
        <div className={`bg-white rounded-full shadow transition-transform
          ${small ? 'w-4 h-4 ml-0.5' : 'w-5 h-5 ml-0.5'}
          ${checked ? (small ? 'translate-x-3' : 'translate-x-4') : 'translate-x-0'}`}
        />
      </div>
      <div>
        <div className={`font-medium text-white ${small ? 'text-xs' : 'text-sm'}`}>{label}</div>
        <div className="text-gray-400 text-xs">{description}</div>
      </div>
    </div>
  );
}

// ─── Interaktives Regelwerk-Panel ─────────────────────────────────────────────

interface RulesConfigPanelProps {
  rules: GameRules;
  onChange: (patch: Partial<GameRules>) => void;
}

export function RulesConfigPanel({ rules, onChange }: RulesConfigPanelProps) {
  const set = (patch: Partial<GameRules>) => onChange(patch);

  const allAusHand =
    rules.strasseAusHand &&
    (!rules.juleEnabled || rules.juleAusHand) &&
    (!rules.generalEnabled || rules.generalAusHand);

  const toggleAllAusHand = () => {
    const next = !allAusHand;
    set({ strasseAusHand: next, juleAusHand: next, generalAusHand: next });
  };

  return (
    <div className="space-y-5">
      <RuleGroup label="Kombinationen">
        <RuleToggle
          checked={rules.generalEnabled}
          onToggle={() => set({ generalEnabled: !rules.generalEnabled })}
          label="mit General"
          description="Drei gleiche Augen (Pasch) gelten als General — eine Sonderkombination über der Straße."
        />
        <RuleToggle
          checked={rules.juleEnabled}
          onToggle={() => set({ juleEnabled: !rules.juleEnabled })}
          label="mit Jule"
          description="1-2-4 ist die zweithöchste Kombination nach Schock Aus (7 Deckel)."
        />
      </RuleGroup>

      <RuleGroup label="Aus der Hand">
        <RuleToggle
          checked={allAusHand}
          onToggle={toggleAllAusHand}
          label="Alles aus der Hand"
          description="Straße, Jule und General gelten nur beim ersten Wurf."
        />
        <div className="pl-5 border-l border-gray-700 space-y-3 mt-1">
          <RuleToggle
            checked={rules.strasseAusHand}
            onToggle={() => set({ strasseAusHand: !rules.strasseAusHand })}
            label="Straße aus der Hand"
            description="Straßen gelten nur beim ersten Wurf."
            small
          />
          {rules.juleEnabled && (
            <RuleToggle
              checked={rules.juleAusHand}
              onToggle={() => set({ juleAusHand: !rules.juleAusHand })}
              label="Jule aus der Hand"
              description="Jule (1-2-4) gilt nur beim ersten Wurf."
              small
            />
          )}
          {rules.generalEnabled && (
            <RuleToggle
              checked={rules.generalAusHand}
              onToggle={() => set({ generalAusHand: !rules.generalAusHand })}
              label="General aus der Hand"
              description="General (Pasch) gilt nur beim ersten Wurf."
              small
            />
          )}
        </div>
        <RuleToggle
          checked={rules.sechsenDrehenEnabled}
          onToggle={() => set({ sechsenDrehenEnabled: !rules.sechsenDrehenEnabled })}
          label="Sechsen drehen"
          description="Zwei 6er → eine 1 drehen. Drei 6er → zwei 1er drehen. Danach ist ein Wurf Pflicht."
        />
      </RuleGroup>

      <RuleGroup label="Weitere Sonderregeln">
        <RuleToggle
          checked={rules.mauernEnabled}
          onToggle={() => set({ mauernEnabled: !rules.mauernEnabled })}
          label="Mauern (Bauen)"
          description="Beliebige Würfel können gehalten werden, nicht nur 1er."
        />
        <RuleToggle
          checked={rules.heldDiceReturnEnabled}
          onToggle={() => set({ heldDiceReturnEnabled: !rules.heldDiceReturnEnabled })}
          label="Gehaltene Würfel zurück"
          description="Rausgelegte Würfel dürfen wieder zurückgelegt und neu gewürfelt werden."
        />
        <RuleToggle
          checked={rules.einwuerfelnEnabled}
          onToggle={() => set({ einwuerfelnEnabled: !rules.einwuerfelnEnabled })}
          label="Einwürfeln"
          description="Ausgeschiedene Spieler dürfen erneut ins Spiel einsteigen."
        />
        <RuleToggle
          checked={rules.ersterHochEnabled}
          onToggle={() => set({ ersterHochEnabled: !rules.ersterHochEnabled })}
          label="Erster Hoch"
          description="In der ersten Runde jeder Halbzeit darf jeder Spieler nur einmal würfeln."
        />
        {rules.ersterHochEnabled && (
          <div className="pl-5 border-l border-gray-700">
            <RuleToggle
              checked={rules.ersterHochHeadsUp}
              onToggle={() => set({ ersterHochHeadsUp: !rules.ersterHochHeadsUp })}
              label="Erster Hoch im Finale"
              description="Gilt auch im Heads-Up-Finale."
              small
            />
          </div>
        )}
        <RuleToggle
          checked={rules.verdecktEnabled}
          onToggle={() => set({ verdecktEnabled: !rules.verdecktEnabled })}
          label="Verdeckt"
          description="Der letzte Wurf bleibt umgedreht; nur gehaltene Würfel sind für andere sichtbar."
        />
      </RuleGroup>
    </div>
  );
}

// ─── Regeln-Zusammenfassung (read-only, fürs Popover) ─────────────────────────

interface RuleEntry {
  label: string;
  detail?: string;
}

function getRuleEntries(rules: GameRules): RuleEntry[] {
  const entries: RuleEntry[] = [];

  if (rules.generalEnabled) entries.push({ label: 'General (Pasch)', detail: rules.generalAusHand ? 'nur aus der Hand' : undefined });
  if (rules.juleEnabled) entries.push({ label: 'Jule (1-2-4)', detail: rules.juleAusHand ? 'nur aus der Hand' : undefined });
  if (!rules.generalEnabled && !rules.juleEnabled && !rules.strasseAusHand) {
    // Nur Straße, normal
  }
  if (rules.strasseAusHand) entries.push({ label: 'Straße aus der Hand' });
  if (rules.sechsenDrehenEnabled) entries.push({ label: 'Sechsen drehen', detail: '2×6 → 1 drehen, 3×6 → 2 drehen' });
  if (rules.mauernEnabled) entries.push({ label: 'Mauern (Bauen)', detail: 'beliebige Würfel halten' });
  if (rules.heldDiceReturnEnabled) entries.push({ label: 'Gehaltene Würfel zurück' });
  if (rules.einwuerfelnEnabled) entries.push({ label: 'Einwürfeln' });
  if (rules.ersterHochEnabled) entries.push({ label: 'Erster Hoch', detail: rules.ersterHochHeadsUp ? 'auch im Finale' : undefined });
  if (rules.verdecktEnabled) entries.push({ label: 'Verdeckt', detail: 'letzter Wurf bleibt verdeckt' });

  return entries;
}

export function RulesSummaryPopover({
  rules,
  roomName,
  onDismiss,
}: {
  rules: GameRules;
  roomName: string;
  onDismiss: () => void;
}) {
  const entries = getRuleEntries(rules);

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Sheet / Modal */}
      <div className="w-full max-w-sm bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-700">
          <h2 className="text-lg font-bold text-amber-400">🎲 {roomName}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Regelwerk für diese Runde</p>
        </div>

        {/* Regellist */}
        <div className="px-5 py-4 max-h-72 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400">Standard-Regeln (keine Sonderregeln aktiv)</p>
          ) : (
            <ul className="space-y-2">
              {entries.map((e, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-amber-400 mt-0.5 shrink-0">✓</span>
                  <span>
                    <span className="text-white font-medium">{e.label}</span>
                    {e.detail && <span className="text-gray-400"> — {e.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 pt-3 border-t border-gray-700 space-y-1 text-xs text-gray-500">
            <p>Schock Aus (1-1-1) ist immer die höchste Kombination.</p>
            <p>Gespielt wird auf {rules.totalCovers} Deckel.</p>
          </div>
        </div>

        {/* Dismiss */}
        <div className="px-5 pb-5">
          <button
            onClick={onDismiss}
            className="w-full py-3.5 rounded-xl font-bold text-base bg-amber-500 hover:bg-amber-400 text-gray-900 transition-all active:scale-95"
          >
            Verstanden, los geht's! 🎲
          </button>
        </div>
      </div>
    </div>
  );
}
