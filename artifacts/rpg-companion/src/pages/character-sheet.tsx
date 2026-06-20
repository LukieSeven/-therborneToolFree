import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetCharacter,
  getGetCharacterQueryKey,
  useUpdateCharacter,
  useDeleteCharacter,
  useCreateRoll,
  useListCharacterRolls,
  getListCharacterRollsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Zap, ArrowLeft, Loader2, Trash2, Heart, Plus, Minus, Dice5 } from "lucide-react";
import { format } from "date-fns";

const STATS = [
  { key: "power",     label: "POW", desc: "Physical strength & raw force" },
  { key: "vitality",  label: "VIT", desc: "Durability & stamina" },
  { key: "spirit",    label: "SPI", desc: "Magical energy & mana" },
  { key: "agility",   label: "AGI", desc: "Speed & reflexes" },
  { key: "endurance", label: "END", desc: "Resistance to pain & fatigue" },
  { key: "precision", label: "PRE", desc: "Accuracy & critical hits" },
  { key: "willpower", label: "WIL", desc: "Mental toughness & focus" },
  { key: "charisma",  label: "CHA", desc: "Presence & social ability" },
];

const DICE_TYPES = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"] as const;

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

  const [rollMod, setRollMod] = useState("0");
  const [rollLabel, setRollLabel] = useState("");
  const [rollingDice, setRollingDice] = useState<string | null>(null);
  const [lastRollResult, setLastRollResult] = useState<number | null>(null);

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
      deleteChar.mutate(
        { id },
        {
          onSuccess: () => {
            setLocation("/characters");
          }
        }
      );
    }
  };

  const handleRoll = (diceType: any) => {
    setRollingDice(diceType);
    setLastRollResult(null);
    createRoll.mutate(
      { id, data: { diceType, modifier: parseInt(rollMod) || 0, label: rollLabel || undefined } },
      {
        onSuccess: (data) => {
          setTimeout(() => {
            setLastRollResult(data.total);
            setRollingDice(null);
            queryClient.invalidateQueries({ queryKey: getListCharacterRollsQueryKey(id) });
            queryClient.invalidateQueries({ queryKey: ["/api/rolls/recent"] });
          }, 800);
        },
        onError: () => setRollingDice(null)
      }
    );
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
          <Card className="bg-card border-primary/20 shadow-lg">
            <CardContent className="p-8 flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1">
                <h1 className="text-5xl font-serif text-primary font-bold mb-2">{character.name}</h1>
                <p className="text-xl text-muted-foreground uppercase tracking-widest font-serif">
                  Level {character.level} {character.race} {character.className}
                </p>
                <div className="mt-6 flex gap-6">
                  <div className="flex flex-col items-center p-4 bg-background border border-border/50 rounded-lg min-w-[100px]">
                    <Shield className="w-6 h-6 text-primary mb-2" />
                    <span className="text-3xl font-mono font-bold text-foreground">{character.armorClass}</span>
                    <span className="text-xs text-muted-foreground uppercase">Armor Class</span>
                  </div>
                  <div className="flex flex-col items-center p-4 bg-background border border-border/50 rounded-lg min-w-[100px]">
                    <Zap className="w-6 h-6 text-primary mb-2" />
                    <span className="text-3xl font-mono font-bold text-foreground">{character.speed}</span>
                    <span className="text-xs text-muted-foreground uppercase">Speed</span>
                  </div>
                </div>
              </div>

              <div className="bg-background border border-primary/30 p-6 rounded-lg shadow-inner min-w-[200px] text-center">
                <Heart className="w-8 h-8 text-destructive mx-auto mb-2" />
                <div className="flex items-center justify-center gap-4 mb-2">
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleUpdateHp((hp || 0) - 1)}><Minus className="w-4 h-4" /></Button>
                  <span className="text-4xl font-mono font-bold text-foreground">{hp}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleUpdateHp((hp || 0) + 1)}><Plus className="w-4 h-4" /></Button>
                </div>
                <div className="w-full bg-accent h-2 rounded-full mb-1 overflow-hidden">
                  <div className="bg-destructive h-full transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, ((hp || 0) / character.maxHp) * 100))}%` }}></div>
                </div>
                <span className="text-sm text-muted-foreground">Max HP: {character.maxHp}</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {STATS.map(stat => (
              <div key={stat.key} className="bg-card border border-border/50 p-4 rounded-lg text-center shadow-sm">
                <span className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-widest">{stat.label}</span>
                <span className="block text-3xl font-serif text-foreground">{(character as any)[stat.key]}</span>
                <div className="mt-2 text-sm font-mono text-primary bg-primary/10 rounded-full px-2 py-0.5 inline-block">
                  {Math.floor(((character as any)[stat.key] - 10) / 2) >= 0 ? "+" : ""}{Math.floor(((character as any)[stat.key] - 10) / 2)}
                </div>
              </div>
            ))}
          </div>

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

        <div className="space-y-8">
          <Card className="bg-card border-primary/30 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
            <CardHeader>
              <CardTitle className="font-serif flex items-center text-primary">
                <Dice5 className="w-5 h-5 mr-2" /> Roll the Dice
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label className="text-xs uppercase text-muted-foreground mb-1 block">Label (Optional)</Label>
                  <Input value={rollLabel} onChange={e => setRollLabel(e.target.value)} placeholder="e.g. Perception" className="bg-background/50 border-border/50" />
                </div>
                <div className="w-24">
                  <Label className="text-xs uppercase text-muted-foreground mb-1 block">Modifier</Label>
                  <Input type="number" value={rollMod} onChange={e => setRollMod(e.target.value)} className="bg-background/50 border-border/50 text-center font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {DICE_TYPES.map(d => (
                  <Button
                    key={d}
                    variant="outline"
                    className={`font-mono font-bold ${rollingDice === d ? 'animate-pulse bg-primary/20 border-primary' : 'bg-background hover:border-primary/50'}`}
                    disabled={!!rollingDice}
                    onClick={() => handleRoll(d)}
                  >
                    {d}
                  </Button>
                ))}
              </div>

              <div className="mt-8 p-6 border-2 border-dashed border-border/50 rounded-lg text-center relative min-h-[120px] flex items-center justify-center">
                {rollingDice ? (
                  <Dice5 className="w-12 h-12 animate-spin text-primary opacity-50" />
                ) : lastRollResult !== null ? (
                  <div className="animate-in zoom-in duration-300">
                    <span className="text-sm text-muted-foreground block mb-1 uppercase tracking-widest">Result</span>
                    <span className="text-6xl font-serif font-bold text-primary">{lastRollResult}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm font-serif italic">The dice await your command.</span>
                )}
              </div>
            </CardContent>
          </Card>

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
                        <div className="font-medium text-sm text-foreground">{roll.label || "Untyped Roll"}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {roll.diceType}{roll.modifier ? (roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier) : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-serif font-bold text-primary">{roll.total}</div>
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