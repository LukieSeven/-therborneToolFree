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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Zap, ArrowLeft, Loader2, Trash2, Heart, Plus, Minus, Dice5, RotateCcw, Swords } from "lucide-react";
import { format } from "date-fns";

// Row 1: physical / Row 2: arcane/mental
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

// Standard DnD dice tiers
function dieForValue(v: number): number {
  if (v <= 4) return 4;
  if (v <= 6) return 6;
  if (v <= 8) return 8;
  if (v <= 10) return 10;
  if (v <= 12) return 12;
  return 20;
}

// Returns all dice for a stat, e.g. stat 21 → [20, 4]
function getStatDiceSizes(stat: number): number[] {
  if (stat <= 20) return [dieForValue(stat)];
  return [20, ...getStatDiceSizes(stat - 20)];
}

// Human-readable label, e.g. "d20+d4"
function getDiceLabel(stat: number): string {
  return getStatDiceSizes(stat).map(d => `d${d}`).join("+");
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

  const [hp, setHp] = useState<number | null>(null);
  useEffect(() => {
    if (character && hp === null) setHp(character.currentHp);
  }, [character, hp]);

  const applyDamageMut = useApplyDamage();
  const [currentDt, setCurrentDt] = useState<number | null>(null);
  const [dtFlash, setDtFlash] = useState<"hit" | "restore" | null>(null);
  const [damageInput, setDamageInput] = useState("");
  const [damageResult, setDamageResult] = useState<{ hpLost: number; dtDropped: boolean; absorbed: boolean } | null>(null);

  useEffect(() => {
    if (character && currentDt === null) setCurrentDt(character.currentDt);
  }, [character, currentDt]);

  const maxDt = character ? character.endurance * 2 + character.dtBonus : 0;

  const handleDtClick = () => {
    if (currentDt === null || currentDt <= 0) return;
    const newDt = currentDt - 1;
    setCurrentDt(newDt);
    setDtFlash("hit");
    setTimeout(() => setDtFlash(null), 600);
    updateChar.mutate({ id, data: { currentDt: newDt } }, {
      onSuccess: (data) => queryClient.setQueryData(getGetCharacterQueryKey(id), data)
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

  const handleApplyDamage = () => {
    const amount = parseInt(damageInput);
    if (isNaN(amount) || amount <= 0) return;
    applyDamageMut.mutate({ id, data: { amount } }, {
      onSuccess: (data) => {
        setCurrentDt(data.newDt);
        setHp(data.newHp);
        setDamageResult({ hpLost: data.hpLost, dtDropped: data.dtDropped, absorbed: data.absorbed });
        setDtFlash("hit");
        setTimeout(() => setDtFlash(null), 600);
        setDamageInput("");
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(id) });
      }
    });
  };

  const [rollMod, setRollMod] = useState("0");
  const [rollLabel, setRollLabel] = useState("");
  const [rollingDice, setRollingDice] = useState<string | null>(null);
  const [lastRoll, setLastRoll] = useState<{
    rawRoll: number;
    modifier: number;
    total: number;
    isCrit: boolean;
    diceType: string;
    label: string;
  } | null>(null);

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!character) {
    return <div className="p-8 text-center text-muted-foreground">Character not found</div>;
  }

  const handleUpdateHp = (newHp: number) => {
    const clamped = Math.max(0, Math.min(newHp, character.maxHp));
    setHp(clamped);
    updateChar.mutate(
      { id, data: { currentHp: clamped } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetCharacterQueryKey(id), data);
        }
      }
    );
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this character?")) {
      deleteChar.mutate({ id }, {
        onSuccess: () => setLocation("/characters")
      });
    }
  };

  const handleRoll = (diceType: string, label?: string, statValue?: number, autoModifier?: number) => {
    const rollKey = label || diceType;
    const modifier = autoModifier !== undefined ? autoModifier : (parseInt(rollMod) || 0);
    setRollingDice(rollKey);
    setLastRoll(null);
    createRoll.mutate(
      {
        id,
        data: {
          diceType,
          modifier,
          label: label || (rollLabel || undefined),
          ...(statValue !== undefined ? { statValue } : {}),
        }
      },
      {
        onSuccess: (data) => {
          setTimeout(() => {
            setLastRoll({
              rawRoll: data.result ?? 0,
              modifier,
              total: data.total ?? 0,
              isCrit: (data as any).isCrit ?? false,
              diceType,
              label: label || rollLabel || diceType,
            });
            setRollingDice(null);
            queryClient.invalidateQueries({ queryKey: getListCharacterRollsQueryKey(id) });
            queryClient.invalidateQueries({ queryKey: ["/api/rolls/recent"] });
          }, 800);
        },
        onError: () => setRollingDice(null)
      }
    );
  };

  const handleStatRoll = (statKey: string, statLabel: string) => {
    const statValue = (character as any)[statKey] as number;
    const autoModifier = Math.floor(statValue / 3);
    const diceType = getDiceLabel(statValue);
    handleRoll(diceType, `${statLabel} Roll`, statValue, autoModifier);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setLocation("/characters")} className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button variant="destructive" size="icon" onClick={handleDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">

          {/* Header card */}
          <Card className="bg-card border-primary/20 shadow-lg">
            <CardContent className="p-8 flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1">
                <h1 className="text-5xl font-serif text-primary font-bold mb-2">{character.name}</h1>
                <p className="text-xl text-muted-foreground uppercase tracking-widest font-serif">
                  Level {character.level} {character.race} {character.className}
                </p>
                <div className="mt-6 flex gap-4 flex-wrap">
                  {/* DT panel — clickable to degrade */}
                  <button
                    onClick={handleDtClick}
                    disabled={currentDt === 0}
                    title="Click to drop DT by 1"
                    className={`
                      relative flex flex-col items-center p-4 rounded-lg min-w-[110px] border transition-all duration-200 group select-none
                      ${dtFlash === "hit"
                        ? "bg-destructive/20 border-destructive scale-95"
                        : dtFlash === "restore"
                          ? "bg-primary/20 border-primary scale-105"
                          : "bg-background border-border/50 hover:border-destructive/50 hover:bg-destructive/5 hover:scale-95 cursor-pointer"
                      }
                      ${currentDt === 0 ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                  >
                    <Shield className={`w-6 h-6 mb-1 transition-colors ${dtFlash === "hit" ? "text-destructive" : "text-primary group-hover:text-destructive"}`} />
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl font-mono font-bold transition-colors ${dtFlash === "hit" ? "text-destructive" : "text-foreground"}`}>
                        {currentDt ?? character.currentDt}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">/{maxDt}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">DT</span>
                    {/* DT bar */}
                    <div className="w-full bg-accent h-1 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-300"
                        style={{ width: `${maxDt > 0 ? Math.max(0, ((currentDt ?? character.currentDt) / maxDt) * 100) : 0}%` }}
                      />
                    </div>
                  </button>

                  <div className="flex flex-col items-center p-4 bg-background border border-border/50 rounded-lg min-w-[100px]">
                    <Zap className="w-6 h-6 text-primary mb-2" />
                    <span className="text-3xl font-mono font-bold text-foreground">{character.speed}</span>
                    <span className="text-xs text-muted-foreground uppercase">Speed</span>
                  </div>
                </div>

                {/* Damage & DT controls */}
                <div className="mt-4 flex flex-wrap gap-2 items-end">
                  <div className="flex gap-1">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                        <Swords className="w-3 h-3 inline mr-1" />Incoming Damage
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={damageInput}
                        onChange={e => { setDamageInput(e.target.value); setDamageResult(null); }}
                        onKeyDown={e => e.key === "Enter" && handleApplyDamage()}
                        placeholder="0"
                        className="w-20 h-8 text-center font-mono bg-background/50 border-border/50 text-sm"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="self-end h-8 px-3 text-xs"
                      onClick={handleApplyDamage}
                      disabled={!damageInput || applyDamageMut.isPending}
                    >
                      Apply
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-end h-8 px-3 text-xs border-primary/30 text-primary hover:bg-primary/10"
                    onClick={handleRestoreDt}
                    title="Restore DT to max"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" /> Restore DT
                  </Button>
                </div>

                {/* Damage result feedback */}
                {damageResult && (
                  <div className={`mt-2 p-2 rounded text-xs font-mono animate-in fade-in ${damageResult.absorbed ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                    {damageResult.absorbed
                      ? "DT held — damage fully absorbed."
                      : `DT dropped · ${damageResult.hpLost > 0 ? `${damageResult.hpLost} overflow → HP` : "no HP lost"}`
                    }
                  </div>
                )}
              </div>

              <div className="bg-background border border-primary/30 p-6 rounded-lg shadow-inner min-w-[200px] text-center">
                <Heart className="w-8 h-8 text-destructive mx-auto mb-2" />
                <div className="flex items-center justify-center gap-4 mb-2">
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleUpdateHp((hp || 0) - 1)}>
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="text-4xl font-mono font-bold text-foreground">{hp}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleUpdateHp((hp || 0) + 1)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="w-full bg-accent h-2 rounded-full mb-1 overflow-hidden">
                  <div
                    className="bg-destructive h-full transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, ((hp || 0) / character.maxHp) * 100))}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground">Max HP: {character.maxHp}</span>
              </div>
            </CardContent>
          </Card>

          {/* Stats — 4 × 2 grid, clickable */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3 font-semibold">
              Stats — click to roll
            </p>
            <div className="grid grid-cols-4 gap-3">
              {STATS.map((stat) => {
                const value = (character as any)[stat.key] as number;
                const mod = Math.floor(value / 3);
                const isRolling = rollingDice === `${stat.label} Roll`;
                return (
                  <button
                    key={stat.key}
                    onClick={() => handleStatRoll(stat.key, stat.label)}
                    disabled={!!rollingDice}
                    title={`${stat.desc} — rolls ${getDiceLabel(value)}`}
                    className={`
                      relative bg-card border rounded-lg p-4 text-center transition-all group
                      ${isRolling
                        ? "border-primary bg-primary/10 animate-pulse"
                        : "border-border/50 hover:border-primary/60 hover:bg-primary/5 hover:shadow-md cursor-pointer"
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <span className="block text-xs font-bold text-muted-foreground mb-1 uppercase tracking-widest group-hover:text-primary transition-colors">
                      {stat.label}
                    </span>
                    <span className="block text-3xl font-serif text-foreground">{value}</span>
                    <div className="mt-2 text-xs font-mono text-primary bg-primary/10 rounded-full px-2 py-0.5 inline-block">
                      +{mod}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground font-mono opacity-60">
                      {getDiceLabel(value)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Background & Backstory */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="font-serif">Background & Backstory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground uppercase text-xs tracking-wider">Background</Label>
                <p className="text-foreground mt-1">{character.background || "None specified"}</p>
              </div>
              <div className="pt-4 border-t border-border/30">
                <Label className="text-muted-foreground uppercase text-xs tracking-wider">Backstory</Label>
                <p className="text-foreground mt-1 whitespace-pre-wrap leading-relaxed font-serif text-lg opacity-90">
                  {character.backstory || "A mystery waiting to unfold..."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: dice roller + roll history */}
        <div className="space-y-8">
          <Card className="bg-card border-primary/30 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
            <CardHeader>
              <CardTitle className="font-serif flex items-center text-primary">
                <Dice5 className="w-5 h-5 mr-2" /> Roll the Dice
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-xs text-muted-foreground font-serif italic">
                Click any stat to roll, or pick a die below.
              </p>

              <div className="flex gap-4">
                <div className="flex-1">
                  <Label className="text-xs uppercase text-muted-foreground mb-1 block">Label (Optional)</Label>
                  <Input
                    value={rollLabel}
                    onChange={e => setRollLabel(e.target.value)}
                    placeholder="e.g. Perception"
                    className="bg-background/50 border-border/50"
                  />
                </div>
                <div className="w-24">
                  <Label className="text-xs uppercase text-muted-foreground mb-1 block">Modifier</Label>
                  <Input
                    type="number"
                    value={rollMod}
                    onChange={e => setRollMod(e.target.value)}
                    className="bg-background/50 border-border/50 text-center font-mono"
                  />
                </div>
              </div>

              {/* Manual die buttons */}
              <div className="grid grid-cols-4 gap-2">
                {(["d4","d6","d8","d10","d12","d20","d100"] as const).map(d => (
                  <Button
                    key={d}
                    variant="outline"
                    className={`font-mono font-bold text-xs ${rollingDice === d ? "animate-pulse bg-primary/20 border-primary" : "bg-background hover:border-primary/50"}`}
                    disabled={!!rollingDice}
                    onClick={() => handleRoll(d)}
                  >
                    {d}
                  </Button>
                ))}
              </div>

              {/* Result display */}
              <div className="mt-2 p-6 border-2 border-dashed border-border/50 rounded-lg text-center relative min-h-[150px] flex flex-col items-center justify-center">
                {rollingDice ? (
                  <Dice5 className="w-12 h-12 animate-spin text-primary opacity-50" />
                ) : lastRoll ? (
                  <div className="animate-in zoom-in duration-300 w-full">
                    {/* Label */}
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3 font-semibold">
                      {lastRoll.isCrit ? "Critical Hit!" : lastRoll.label}
                    </p>

                    {/* Breakdown row: roll + modifier */}
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <div className="text-center">
                        <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Roll</span>
                        <span className="text-2xl font-mono font-semibold text-foreground">{lastRoll.rawRoll}</span>
                      </div>
                      {lastRoll.modifier !== 0 && (
                        <>
                          <span className="text-xl text-muted-foreground font-light mt-3">+</span>
                          <div className="text-center">
                            <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Mod</span>
                            <span className="text-2xl font-mono font-semibold text-primary">{lastRoll.modifier}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Divider */}
                    <div className={`h-px w-24 mx-auto my-2 ${lastRoll.isCrit ? "bg-yellow-500/50" : "bg-primary/30"}`} />

                    {/* Total — dominant */}
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block">Total</span>
                      <span className={`text-7xl font-serif font-bold leading-none ${lastRoll.isCrit ? "text-yellow-500" : "text-primary"}`}>
                        {lastRoll.total}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm font-serif italic">The dice await your command.</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Roll History */}
          <Card className="bg-card border-border/50">
            <CardHeader className="py-4 border-b border-border/30">
              <CardTitle className="font-serif text-sm">Roll History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingRolls ? (
                <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary/50" /></div>
              ) : rolls && rolls.length > 0 ? (
                <div className="divide-y divide-border/30 max-h-[300px] overflow-y-auto">
                  {rolls.map(roll => (
                    <div key={roll.id} className="p-3 hover:bg-accent/20 transition-colors flex justify-between items-center">
                      <div>
                        <div className="font-medium text-sm text-foreground flex items-center gap-1">
                          {roll.label || "Untyped Roll"}
                          {(roll as any).isCrit && (
                            <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">crit</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {roll.diceType}{roll.modifier ? (roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier) : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-serif font-bold ${(roll as any).isCrit ? "text-yellow-500" : "text-primary"}`}>
                          {roll.total}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{format(new Date(roll.rolledAt), "HH:mm")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground font-serif italic">No history yet.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
