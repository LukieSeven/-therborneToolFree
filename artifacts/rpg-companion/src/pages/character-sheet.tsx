import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetCharacter,
  getGetCharacterQueryKey,
  useUpdateCharacter,
  useDeleteCharacter,
  useCreateRoll,
  useListCharacterRolls,
  getListCharacterRollsQueryKey,
  useApplyDamage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield, ArrowLeft, Loader2, Trash2, Heart, Dice5,
  RotateCcw, Swords, Sparkles, Plus,
} from "lucide-react";
import { format } from "date-fns";

const STATS = [
  { key: "power",     label: "POW", desc: "Physical strength & raw force" },
  { key: "vitality",  label: "VIT", desc: "Durability & stamina" },
  { key: "agility",   label: "AGI", desc: "Speed & reflexes" },
  { key: "endurance", label: "END", desc: "Resistance to pain & fatigue" },
  { key: "spirit",    label: "SPI", desc: "Magical energy & mana" },
  { key: "precision", label: "PRE", desc: "Accuracy & critical hits" },
  { key: "willpower", label: "WIL", desc: "Mental toughness & focus" },
  { key: "charisma",  label: "CHA", desc: "Presence & social ability" },
];

const CRIT_TIERS = [
  { name: "Common",    color: "#e8e8e8" },
  { name: "Uncommon",  color: "#1eff00" },
  { name: "Rare",      color: "#0070ff" },
  { name: "Epic",      color: "#a335ee" },
  { name: "Legendary", color: "#ffd700" },
  { name: "Artifact",  color: "#ff8000" },
  { name: "Heirloom",  color: "#ff3030" },
];

function dieForValue(v: number): number {
  if (v <= 4) return 4;
  if (v <= 6) return 6;
  if (v <= 8) return 8;
  if (v <= 10) return 10;
  if (v <= 12) return 12;
  return 20;
}

function getStatDiceSizes(stat: number): number[] {
  if (stat <= 20) return [dieForValue(stat)];
  return [20, ...getStatDiceSizes(stat - 20)];
}

function getDiceLabel(stat: number): string {
  return getStatDiceSizes(stat).map(d => `d${d}`).join("+");
}

function ResourceBar({ current, max, color }: { current: number; max: number; color: string }) {
  return (
    <div className="w-full bg-accent/50 h-1.5 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0}%`, background: color }}
      />
    </div>
  );
}

export default function CharacterSheet() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: character, isLoading } = useGetCharacter(id, {
    query: { enabled: !!id, queryKey: getGetCharacterQueryKey(id) }
  });
  const { data: rolls, isLoading: loadingRolls } = useListCharacterRolls(id, {
    query: { enabled: !!id, queryKey: getListCharacterRollsQueryKey(id) }
  });

  const updateChar = useUpdateCharacter();
  const deleteChar = useDeleteCharacter();
  const createRoll = useCreateRoll();
  const applyDamageMut = useApplyDamage();

  // ── Resource state ────────────────────────────────────────
  const [hp, setHp] = useState<number | null>(null);
  const [mana, setMana] = useState<number | null>(null);
  const [currentDt, setCurrentDt] = useState<number | null>(null);

  useEffect(() => {
    if (character && hp === null) setHp(character.currentHp);
  }, [character, hp]);
  useEffect(() => {
    if (character && mana === null) setMana(character.currentMana);
  }, [character, mana]);
  useEffect(() => {
    if (character && currentDt === null) setCurrentDt(character.currentDt);
  }, [character, currentDt]);

  // ── Input state ───────────────────────────────────────────
  const [dtFlash, setDtFlash] = useState<"hit" | "restore" | null>(null);
  const [damageInput, setDamageInput] = useState("");
  const [damageResult, setDamageResult] = useState<{ hpLost: number; absorbed: boolean } | null>(null);
  const [healInput, setHealInput] = useState("");
  const [manaRestoreInput, setManaRestoreInput] = useState("");
  const [manaDrainInput, setManaDrainInput] = useState("");

  // ── Roll state ────────────────────────────────────────────
  const [rollTab, setRollTab] = useState<"stats" | "dice">("stats");
  const [rollMod, setRollMod] = useState("0");
  const [rollLabel, setRollLabel] = useState("");
  const [rollingDice, setRollingDice] = useState<string | null>(null);
  const [critChain, setCritChain] = useState<{
    chainCount: number;
    chainDie: string;
    runningDiceTotal: number;
    modifier: number;
    label: string;
    lastRolledValue: number;
  } | null>(null);
  const [lastRoll, setLastRoll] = useState<{
    rawRoll: number;
    modifier: number;
    total: number;
    hadCrit: boolean;
    maxChainCount: number;
    diceType: string;
    label: string;
  } | null>(null);

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!character) return <div className="p-8 text-center text-muted-foreground">Character not found</div>;

  // ── Computed maximums ─────────────────────────────────────
  const maxDt = character.endurance * 2 + character.dtBonus;
  const computedMaxHp = character.vitality * 10 + character.endurance * 5;
  const computedMaxMana = character.spirit * 10 + character.willpower * 5;

  // ── DT handlers ───────────────────────────────────────────
  const handleApplyDamage = () => {
    const amount = parseInt(damageInput);
    if (isNaN(amount) || amount <= 0) return;
    applyDamageMut.mutate({ id, data: { amount } }, {
      onSuccess: (data) => {
        setCurrentDt(data.newDt);
        setHp(data.newHp);
        setDamageResult({ hpLost: data.hpLost, absorbed: data.absorbed });
        setDtFlash("hit");
        setDamageInput("");
        setTimeout(() => setDtFlash(null), 600);
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(id) });
      }
    });
  };

  const handleRestoreDt = () => {
    setCurrentDt(maxDt);
    setDtFlash("restore");
    setDamageResult(null);
    setTimeout(() => setDtFlash(null), 600);
    updateChar.mutate({ id, data: { currentDt: maxDt } }, {
      onSuccess: (data) => queryClient.setQueryData(getGetCharacterQueryKey(id), data)
    });
  };

  // ── HP handlers ───────────────────────────────────────────
  const handleHealHp = () => {
    const amount = parseInt(healInput);
    if (isNaN(amount) || amount <= 0) return;
    const newHp = Math.min(computedMaxHp, (hp ?? 0) + amount);
    setHp(newHp);
    setHealInput("");
    updateChar.mutate({ id, data: { currentHp: newHp } }, {
      onSuccess: (data) => queryClient.setQueryData(getGetCharacterQueryKey(id), data)
    });
  };

  const handleFullRestoreHp = () => {
    setHp(computedMaxHp);
    updateChar.mutate({ id, data: { currentHp: computedMaxHp } }, {
      onSuccess: (data) => queryClient.setQueryData(getGetCharacterQueryKey(id), data)
    });
  };

  // ── Mana handlers ─────────────────────────────────────────
  const handleRestoreMana = () => {
    const amount = parseInt(manaRestoreInput);
    if (isNaN(amount) || amount <= 0) return;
    const newMana = Math.min(computedMaxMana, (mana ?? 0) + amount);
    setMana(newMana);
    setManaRestoreInput("");
    updateChar.mutate({ id, data: { currentMana: newMana } }, {
      onSuccess: (data) => queryClient.setQueryData(getGetCharacterQueryKey(id), data)
    });
  };

  const handleDrainMana = () => {
    const amount = parseInt(manaDrainInput);
    if (isNaN(amount) || amount <= 0) return;
    const newMana = Math.max(0, (mana ?? 0) - amount);
    setMana(newMana);
    setManaDrainInput("");
    updateChar.mutate({ id, data: { currentMana: newMana } }, {
      onSuccess: (data) => queryClient.setQueryData(getGetCharacterQueryKey(id), data)
    });
  };

  const handleFullRestoreMana = () => {
    setMana(computedMaxMana);
    updateChar.mutate({ id, data: { currentMana: computedMaxMana } }, {
      onSuccess: (data) => queryClient.setQueryData(getGetCharacterQueryKey(id), data)
    });
  };

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = () => {
    if (confirm("Delete this character?")) {
      deleteChar.mutate({ id }, { onSuccess: () => setLocation("/characters") });
    }
  };

  // ── Dice roll handlers ────────────────────────────────────
  const handleRoll = (diceType: string, label?: string, statValue?: number, autoModifier?: number) => {
    const rollKey = label || diceType;
    const modifier = autoModifier !== undefined ? autoModifier : (parseInt(rollMod) || 0);
    setRollingDice(rollKey);
    setLastRoll(null);
    setCritChain(null);
    createRoll.mutate(
      { id, data: { diceType, modifier: 0, label: label || (rollLabel || undefined), ...(statValue !== undefined ? { statValue } : {}) } },
      {
        onSuccess: (data) => {
          setTimeout(() => {
            const rolled = data.result ?? 0;
            const wasCrit = (data as any).isCrit ?? false;
            const chainDie = diceType.split("+").pop() ?? diceType;
            const lbl = label || rollLabel || diceType;
            if (wasCrit) {
              setCritChain({ chainCount: 0, chainDie, runningDiceTotal: rolled, modifier, label: lbl, lastRolledValue: rolled });
            } else {
              setLastRoll({ rawRoll: rolled, modifier, total: rolled + modifier, hadCrit: false, maxChainCount: -1, diceType, label: lbl });
            }
            setRollingDice(null);
            queryClient.invalidateQueries({ queryKey: getListCharacterRollsQueryKey(id) });
            queryClient.invalidateQueries({ queryKey: ["/api/rolls/recent"] });
          }, 600);
        },
        onError: () => setRollingDice(null),
      }
    );
  };

  const handleChainRoll = () => {
    if (!critChain) return;
    const { chainDie, runningDiceTotal, modifier, label, chainCount } = critChain;
    setRollingDice("chain");
    createRoll.mutate(
      { id, data: { diceType: chainDie, modifier: 0, label } },
      {
        onSuccess: (data) => {
          setTimeout(() => {
            const rolled = data.result ?? 0;
            const wasCrit = (data as any).isCrit ?? false;
            const newTotal = runningDiceTotal + rolled;
            if (wasCrit) {
              setCritChain({ chainCount: chainCount + 1, chainDie, runningDiceTotal: newTotal, modifier, label, lastRolledValue: rolled });
            } else {
              setCritChain(null);
              setLastRoll({ rawRoll: newTotal, modifier, total: newTotal + modifier, hadCrit: true, maxChainCount: chainCount, diceType: chainDie, label });
            }
            setRollingDice(null);
            queryClient.invalidateQueries({ queryKey: getListCharacterRollsQueryKey(id) });
            queryClient.invalidateQueries({ queryKey: ["/api/rolls/recent"] });
          }, 600);
        },
        onError: () => setRollingDice(null),
      }
    );
  };

  const handleStatRoll = (statKey: string, statLabel: string) => {
    const statValue = (character as any)[statKey] as number;
    const autoModifier = Math.floor(statValue / 3);
    handleRoll(getDiceLabel(statValue), `${statLabel} Roll`, statValue, autoModifier);
  };

  // ── Crit tier helpers ─────────────────────────────────────
  const tier = critChain ? CRIT_TIERS[Math.min(critChain.chainCount, CRIT_TIERS.length - 1)] : null;
  const finalTier = lastRoll?.hadCrit ? CRIT_TIERS[Math.min(lastRoll.maxChainCount, CRIT_TIERS.length - 1)] : null;

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="p-4 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Nav row */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/characters")} className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button variant="destructive" size="icon" className="h-8 w-8" onClick={handleDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* ── Top 2/3 + 1/3 grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">

        {/* Character panel */}
        <div className="lg:col-span-2">
          <Card className="bg-card border-primary/20 shadow-lg h-full">
            <CardContent className="p-5">
              {/* Name + Rank */}
              <div className="flex items-baseline gap-3 mb-0.5">
                <h1 className="text-2xl font-serif text-primary font-bold leading-tight">{character.name}</h1>
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground border border-border/50 px-2 py-0.5 rounded font-semibold flex-shrink-0">
                  Rank
                </span>
              </div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">
                {character.race} · {character.className}
              </p>

              {/* Three resource squares */}
              <div className="grid grid-cols-3 gap-3">

                {/* DT */}
                <div className={`rounded-lg border p-3 flex flex-col gap-2 transition-all duration-200 ${
                  dtFlash === "hit" ? "border-destructive/70 bg-destructive/10"
                  : dtFlash === "restore" ? "border-primary/70 bg-primary/10"
                  : "border-border/50 bg-background/40"
                }`}>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <Shield className="w-3 h-3" /> Damage Threshold
                  </div>
                  <div className="text-center py-1">
                    <span className={`text-3xl font-mono font-bold transition-colors ${dtFlash === "hit" ? "text-destructive" : "text-foreground"}`}>
                      {currentDt ?? character.currentDt}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono"> /{maxDt}</span>
                  </div>
                  <ResourceBar current={currentDt ?? character.currentDt} max={maxDt} color="hsl(var(--primary))" />
                  <div className="flex gap-1 mt-1">
                    <Input
                      type="number" min="0" value={damageInput} placeholder="DMG"
                      onChange={e => { setDamageInput(e.target.value); setDamageResult(null); }}
                      onKeyDown={e => e.key === "Enter" && handleApplyDamage()}
                      className="h-7 text-xs text-center font-mono flex-1 min-w-0 bg-background/50 border-border/50 px-1"
                    />
                    <Button variant="destructive" size="sm" className="h-7 px-2 flex-shrink-0"
                      onClick={handleApplyDamage} disabled={!damageInput || applyDamageMut.isPending}>
                      <Swords className="w-3 h-3" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
                    onClick={handleRestoreDt}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Restore DT
                  </Button>
                  {damageResult && (
                    <p className={`text-[10px] font-mono text-center ${damageResult.absorbed ? "text-primary" : "text-destructive"}`}>
                      {damageResult.absorbed ? "✦ Absorbed" : damageResult.hpLost > 0 ? `−${damageResult.hpLost} HP` : "DT hit"}
                    </p>
                  )}
                </div>

                {/* HP */}
                <div className="rounded-lg border border-border/50 bg-background/40 p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <Heart className="w-3 h-3 text-destructive" /> Health
                  </div>
                  <div className="text-center py-1">
                    <span className="text-3xl font-mono font-bold text-foreground">{hp ?? character.currentHp}</span>
                    <span className="text-xs text-muted-foreground font-mono"> /{computedMaxHp}</span>
                  </div>
                  <ResourceBar current={hp ?? character.currentHp} max={computedMaxHp} color="hsl(var(--destructive))" />
                  <div className="flex gap-1 mt-1">
                    <Input
                      type="number" min="0" value={healInput} placeholder="Heal"
                      onChange={e => setHealInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleHealHp()}
                      className="h-7 text-xs text-center font-mono flex-1 min-w-0 bg-background/50 border-border/50 px-1"
                    />
                    <Button variant="outline" size="sm" className="h-7 px-2 flex-shrink-0 border-green-600/40 text-green-500 hover:bg-green-500/10"
                      onClick={handleHealHp} disabled={!healInput}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
                    onClick={handleFullRestoreHp}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Full Restore
                  </Button>
                </div>

                {/* Mana */}
                <div className="rounded-lg border border-border/50 bg-background/40 p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-blue-400" /> Mana
                  </div>
                  <div className="text-center py-1">
                    <span className="text-3xl font-mono font-bold text-foreground">{mana ?? 0}</span>
                    <span className="text-xs text-muted-foreground font-mono"> /{computedMaxMana}</span>
                  </div>
                  <ResourceBar current={mana ?? 0} max={computedMaxMana} color="#3b82f6" />
                  {/* Restore row */}
                  <div className="flex gap-1 mt-1">
                    <Input
                      type="number" min="0" value={manaRestoreInput} placeholder="Restore"
                      onChange={e => setManaRestoreInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleRestoreMana()}
                      className="h-7 text-xs text-center font-mono flex-1 min-w-0 bg-background/50 border-border/50 px-1"
                    />
                    <Button variant="outline" size="sm" className="h-7 px-2 flex-shrink-0 border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                      onClick={handleRestoreMana} disabled={!manaRestoreInput}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  {/* Drain row */}
                  <div className="flex gap-1">
                    <Input
                      type="number" min="0" value={manaDrainInput} placeholder="Drain"
                      onChange={e => setManaDrainInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleDrainMana()}
                      className="h-7 text-xs text-center font-mono flex-1 min-w-0 bg-background/50 border-border/50 px-1"
                    />
                    <Button variant="destructive" size="sm" className="h-7 px-2 flex-shrink-0"
                      onClick={handleDrainMana} disabled={!manaDrainInput}>
                      <Swords className="w-3 h-3" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
                    onClick={handleFullRestoreMana}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Full Restore
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Roll panel */}
        <div className="lg:col-span-1">
          <Card className="bg-card border-primary/30 shadow-lg relative overflow-hidden h-full">
            <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
            <CardContent className="p-4 flex flex-col gap-3">
              {/* Tabs */}
              <div className="flex gap-1 bg-background/50 rounded-lg p-1 border border-border/30">
                <button
                  onClick={() => setRollTab("stats")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md uppercase tracking-wider transition-all ${
                    rollTab === "stats" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Stats
                </button>
                <button
                  onClick={() => setRollTab("dice")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md uppercase tracking-wider transition-all ${
                    rollTab === "dice" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Dice
                </button>
              </div>

              {/* Stats tab */}
              {rollTab === "stats" && (
                <div className="grid grid-cols-4 gap-1">
                  {STATS.map(stat => {
                    const value = (character as any)[stat.key] as number;
                    const mod = Math.floor(value / 3);
                    const isRolling = rollingDice === `${stat.label} Roll`;
                    return (
                      <button
                        key={stat.key}
                        onClick={() => handleStatRoll(stat.key, stat.label)}
                        disabled={!!rollingDice}
                        title={`${stat.desc} — ${getDiceLabel(value)}`}
                        className={`rounded-md p-1.5 text-center border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          isRolling ? "border-primary bg-primary/10 animate-pulse"
                          : "border-border/40 hover:border-primary/60 hover:bg-primary/5 cursor-pointer"
                        }`}
                      >
                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{stat.label}</div>
                        <div className="text-xl font-serif text-foreground leading-tight">{value}</div>
                        <div className="text-[10px] font-mono text-primary">+{mod}</div>
                        <div className="text-[9px] font-mono text-muted-foreground/60">{getDiceLabel(value)}</div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Dice tab */}
              {rollTab === "dice" && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={rollLabel}
                      onChange={e => setRollLabel(e.target.value)}
                      placeholder="Label (optional)"
                      className="bg-background/50 border-border/50 text-xs h-7 flex-1"
                    />
                    <Input
                      type="number"
                      value={rollMod}
                      onChange={e => setRollMod(e.target.value)}
                      className="bg-background/50 border-border/50 text-center font-mono text-xs h-7 w-14 flex-shrink-0"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(["d4","d6","d8","d10","d12","d20","d100"] as const).map(d => (
                      <Button
                        key={d}
                        variant="outline"
                        size="sm"
                        className={`font-mono font-bold text-xs h-8 ${rollingDice === d ? "animate-pulse bg-primary/20 border-primary" : "bg-background/50 hover:border-primary/50"}`}
                        disabled={!!rollingDice}
                        onClick={() => handleRoll(d)}
                      >
                        {d}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Roll result */}
              <div
                className="p-4 border-2 rounded-lg text-center flex flex-col items-center justify-center transition-all duration-500 flex-1 min-h-[140px]"
                style={
                  tier
                    ? { borderColor: tier.color + "99", boxShadow: `0 0 20px 4px ${tier.color}44`, background: tier.color + "08" }
                    : finalTier
                      ? { borderColor: finalTier.color + "55", background: finalTier.color + "05" }
                      : { borderColor: "rgba(255,255,255,0.08)" }
                }
              >
                {rollingDice ? (
                  <Dice5 className="w-10 h-10 animate-spin text-primary opacity-50" />
                ) : critChain ? (
                  <div className="animate-in zoom-in duration-200 w-full">
                    <p className="text-[10px] uppercase tracking-[0.25em] mb-2 font-bold animate-pulse" style={{ color: tier!.color }}>
                      ✦ {tier!.name} — Crit #{critChain.chainCount + 1} ✦
                    </p>
                    <div className="mb-1">
                      <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Rolled</span>
                      <span className="text-4xl font-mono font-bold" style={{ color: tier!.color }}>{critChain.lastRolledValue}</span>
                      <span className="text-[10px] uppercase tracking-wider block mt-0.5" style={{ color: tier!.color + "aa" }}>
                        {critChain.chainDie} — Max!
                      </span>
                    </div>
                    <div className="my-1 px-3 py-0.5 rounded-full inline-block text-xs font-mono text-muted-foreground border border-border/30">
                      Running: {critChain.runningDiceTotal}
                      {critChain.modifier !== 0 && <span className="text-primary"> +{critChain.modifier}</span>}
                    </div>
                    <div className="mt-2">
                      <button
                        onClick={handleChainRoll}
                        disabled={!!rollingDice}
                        className="px-5 py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest animate-pulse disabled:opacity-50 hover:scale-105 hover:animate-none transition-transform"
                        style={{
                          color: tier!.color,
                          border: `2px solid ${tier!.color}`,
                          boxShadow: `0 0 10px 2px ${tier!.color}44`,
                          background: tier!.color + "15",
                        }}
                      >
                        One More!
                      </button>
                    </div>
                  </div>
                ) : lastRoll ? (
                  <div className="animate-in zoom-in duration-300 w-full">
                    {lastRoll.hadCrit ? (
                      <p className="text-xs font-bold tracking-[0.25em] uppercase mb-2" style={{ color: finalTier?.color ?? "#ffd700" }}>
                        ✦ {finalTier?.name ?? "Critical"} Hit! ✦
                      </p>
                    ) : (
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2 font-semibold">{lastRoll.label}</p>
                    )}
                    <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                      <div className="text-center">
                        <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Roll</span>
                        <span className="text-2xl font-mono font-semibold text-foreground">{lastRoll.rawRoll}</span>
                      </div>
                      {lastRoll.modifier !== 0 && (
                        <>
                          <span className="text-lg text-muted-foreground font-light mt-2">+</span>
                          <div className="text-center">
                            <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Mod</span>
                            <span className="text-2xl font-mono font-semibold text-primary">{lastRoll.modifier}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="h-px w-24 mx-auto my-2"
                      style={{ background: finalTier ? finalTier.color + "60" : "rgba(255,255,255,0.12)" }} />
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block">Total</span>
                      <span className="text-6xl font-serif font-bold leading-none"
                        style={{ color: finalTier?.color ?? "hsl(var(--primary))" }}>
                        {lastRoll.total}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm font-serif italic">The dice await...</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Background & Backstory */}
      <Card className="mt-4 bg-card border-border/50">
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-3">Background & Backstory</p>
          {character.background && <p className="text-sm text-foreground mb-2">{character.background}</p>}
          {character.backstory ? (
            <p className={`text-foreground whitespace-pre-wrap leading-relaxed font-serif text-base opacity-90 ${character.background ? "border-t border-border/30 pt-3" : ""}`}>
              {character.backstory}
            </p>
          ) : !character.background ? (
            <p className="text-muted-foreground font-serif italic text-sm">A mystery waiting to unfold...</p>
          ) : null}
        </CardContent>
      </Card>

      {/* Roll History */}
      <Card className="mt-4 bg-card border-border/50">
        <div className="px-5 py-3 border-b border-border/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Roll History</p>
        </div>
        {loadingRolls ? (
          <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary/50" /></div>
        ) : rolls && rolls.length > 0 ? (
          <div className="divide-y divide-border/30 max-h-[200px] overflow-y-auto">
            {rolls.map(roll => (
              <div key={roll.id} className="px-5 py-2.5 hover:bg-accent/20 transition-colors flex justify-between items-center">
                <div>
                  <div className="font-medium text-sm text-foreground flex items-center gap-1.5">
                    {roll.label || "Untyped Roll"}
                    {(roll as any).isCrit && <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">crit</span>}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {roll.diceType}{roll.modifier ? (roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier) : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-serif font-bold ${(roll as any).isCrit ? "text-yellow-500" : "text-primary"}`}>{roll.total}</div>
                  <div className="text-[10px] text-muted-foreground">{format(new Date(roll.rolledAt), "HH:mm")}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 text-center text-sm text-muted-foreground font-serif italic">No history yet.</div>
        )}
      </Card>
    </div>
  );
}
