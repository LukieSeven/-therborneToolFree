import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Shield, ArrowLeft, Loader2, Trash2, Heart, Dice5,
  RotateCcw, Swords, Sparkles, Plus, Edit2, Upload, Download,
  Coins, Package, Hammer, Layers, Flame, BookText
} from "lucide-react";
import { format } from "date-fns";

// Storage Hooks & Helpers
import {
  useGetCharacter, useUpdateCharacter, useDeleteCharacter, useApplyDamage,
  useCreateRoll, useListCharacterRolls,
  useListEquipment, useUpdateEquipment, useDeleteEquipment,
  useListCurrencies, useUpdateCurrency, useDeleteCurrency,
  useListInventory, useDeleteInventoryItem,
  useListEssences, useAddEssence, useDeleteEssence,
  useListAbilities, useUpdateAbility,
  useListSkills, useUpdateSkill,
  useListNotes, useCreateNote, useDeleteNote,
  getGetCharacterQueryKey, getListCharacterRollsQueryKey, getListNotesQueryKey
} from "@/hooks/useStorage";
import { getAdjustedStats, getDiceLabel, exportCharacterJSON, importCharacterJSON, Ability, Equipment, Skill } from "@/lib/storage";

// Dialog Modals
import { EditCharacterDialog } from "@/components/dialogs/edit-character-dialog";
import { EditAbilitiesDialog } from "@/components/dialogs/edit-abilities-dialog";
import { EditSkillsDialog } from "@/components/dialogs/edit-skills-dialog";
import { EditInventoryDialog } from "@/components/dialogs/edit-inventory-dialog";

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

// Helper to parse Markdown description cards
function parseMarkdown(text: string): string {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/^### (.*?)$/gm, '<h4 class="font-serif text-sm font-bold text-primary mt-2 mb-0.5">$1</h4>');
  html = html.replace(/^- (.*?)$/gm, '<li class="ml-4 list-disc text-muted-foreground">$1</li>');
  html = html.split("\n").join("<br />");
  return html;
}

function ResourceBar({ current, max, color }: { current: number; max: number; color: string }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const isOverMax = current > max;
  return (
    <div className={`w-full bg-accent/50 h-2 rounded-full overflow-hidden relative ${isOverMax ? "ring-1 ring-amber-400/50 shadow-[0_0_8px_rgba(245,158,11,0.2)]" : ""}`}>
      <div
        className={`h-full rounded-full transition-all duration-300 ${isOverMax ? "animate-pulse" : ""}`}
        style={{ width: `${percent}%`, background: color }}
      />
    </div>
  );
}

export default function CharacterSheet() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: character, isLoading } = useGetCharacter(id);
  const { data: rolls, isLoading: loadingRolls } = useListCharacterRolls(id);
  const { data: equipment = [] } = useListEquipment(id);
  const { data: currencies = [] } = useListCurrencies(id);
  const { data: inventory = [] } = useListInventory(id);
  const { data: essences = [] } = useListEssences(id);
  const { data: abilities = [] } = useListAbilities(id);
  const { data: skills = [] } = useListSkills(id);
  const { data: notes = [] } = useListNotes(id);

  // Mutations
  const updateChar = useUpdateCharacter();
  const deleteChar = useDeleteCharacter();
  const createRoll = useCreateRoll();
  const applyDamageMut = useApplyDamage();
  
  // Equipment mutators for toggling equipped/quick status
  const updateEq = useUpdateEquipment();
  const deleteEq = useDeleteEquipment();

  // Notes mutators
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();

  // Essences mutators
  const addEssence = useAddEssence();
  const deleteEssence = useDeleteEssence();

  // Skills mutator
  const updateSkillMut = useUpdateSkill();

  // ── Tab State ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"stats" | "skills" | "inventory" | "essences" | "abilities" | "notes">("stats");

  // ── Resource state ────────────────────────────────────────
  const [hp, setHp] = useState<number | null>(null);
  const [mana, setMana] = useState<number | null>(null);
  const [currentDt, setCurrentDt] = useState<number | null>(null);

  useEffect(() => {
    if (character) {
      if (hp === null) setHp(character.currentHp);
      if (mana === null) setMana(character.currentMana);
      if (currentDt === null) setCurrentDt(character.currentDt);
    }
  }, [character]);

  // Sync state changes from parent queries
  useEffect(() => {
    if (character) {
      setHp(character.currentHp);
      setMana(character.currentMana);
      setCurrentDt(character.currentDt);
    }
  }, [character?.currentHp, character?.currentMana, character?.currentDt]);

  // ── Quick Adjust values ───────────────────────────────────
  const [hpAdjust, setHpAdjust] = useState("");
  const [manaAdjust, setManaAdjust] = useState("");
  const [dtAdjust, setDtAdjust] = useState("");

  const [dtFlash, setDtFlash] = useState<"hit" | "restore" | null>(null);
  const [damageResult, setDamageResult] = useState<{ hpLost: number; absorbed: boolean } | null>(null);

  // ── Inventory Dialog Trigger State ────────────────────────
  const [isInvOpen, setIsInvOpen] = useState(false);
  const [invMode, setInvMode] = useState<"add" | "edit">("add");
  const [invType, setInvType] = useState<"currency" | "equipment" | "item">("item");
  const [invInitialData, setInvInitialData] = useState<any>(null);

  // ── Essence input State ───────────────────────────────────
  const [essenceSlotInput, setEssenceSlotInput] = useState<number | null>(null);
  const [essenceName, setEssenceName] = useState("");
  const [essenceDesc, setEssenceDesc] = useState("");

  // ── Campaign Notes input State ────────────────────────────
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteCat, setNoteCat] = useState<string>("general");

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

  // ── Recalculate adjusted stats from equipment ─────────────
  const { stats: finalStats, modifiers: autoModifiers, diceLabels, maxHp, maxMana, maxDt } = getAdjustedStats(character, equipment);

  // ── DT Quick adjustments ──────────────────────────────────
  const handleApplyDamage = (value?: number) => {
    const amount = value !== undefined ? value : parseInt(dtAdjust);
    if (isNaN(amount) || amount <= 0) return;
    
    applyDamageMut.mutate({ id, data: { amount } }, {
      onSuccess: (data) => {
        setCurrentDt(data.newDt);
        setHp(data.newHp);
        setDamageResult({ hpLost: data.hpLost, absorbed: data.absorbed });
        setDtFlash("hit");
        setDtAdjust("");
        setTimeout(() => setDtFlash(null), 600);
      }
    });
  };

  const handleRestoreDt = () => {
    setCurrentDt(maxDt);
    setDtFlash("restore");
    setDamageResult(null);
    setTimeout(() => setDtFlash(null), 600);
    updateChar.mutate({ id, data: { currentDt: maxDt } });
  };

  const handleDtAdjust = (type: "add" | "buff") => {
    const amount = parseInt(dtAdjust);
    if (isNaN(amount) || amount <= 0) return;
    
    const cur = currentDt ?? character.currentDt;
    let next = cur;
    if (type === "add") {
      // Heal current DT up to maximum
      next = Math.min(maxDt, cur + amount);
    } else {
      // Buff: exceed max
      next = cur + amount;
    }
    
    setCurrentDt(next);
    setDtAdjust("");
    updateChar.mutate({ id, data: { currentDt: next } });
  };

  // ── HP Quick adjustments ──────────────────────────────────
  const handleHpAdjust = (type: "add" | "remove" | "buff") => {
    const amount = parseInt(hpAdjust);
    if (isNaN(amount) || amount <= 0) return;

    const cur = hp ?? character.currentHp;
    let next = cur;
    if (type === "add") {
      next = Math.min(maxHp, cur + amount);
    } else if (type === "remove") {
      // Direct HP damage, depleting temp buffs first naturally
      next = Math.max(0, cur - amount);
    } else {
      // Buff: exceed max HP
      next = cur + amount;
    }

    setHp(next);
    setHpAdjust("");
    updateChar.mutate({ id, data: { currentHp: next } });
  };

  const handleFullRestoreHp = () => {
    setHp(maxHp);
    updateChar.mutate({ id, data: { currentHp: maxHp } });
  };

  // ── Mana Quick adjustments ────────────────────────────────
  const handleManaAdjust = (type: "add" | "remove" | "buff") => {
    const amount = parseInt(manaAdjust);
    if (isNaN(amount) || amount <= 0) return;

    const cur = mana ?? character.currentMana;
    let next = cur;
    if (type === "add") {
      next = Math.min(maxMana, cur + amount);
    } else if (type === "remove") {
      next = Math.max(0, cur - amount);
    } else {
      next = cur + amount;
    }

    setMana(next);
    setManaAdjust("");
    updateChar.mutate({ id, data: { currentMana: next } });
  };

  const handleFullRestoreMana = () => {
    setMana(maxMana);
    updateChar.mutate({ id, data: { currentMana: maxMana } });
  };

  // ── Delete character ──────────────────────────────────────
  const handleDelete = () => {
    if (confirm("Permanently delete this character?")) {
      deleteChar.mutate({ id }, { onSuccess: () => setLocation("/characters") });
    }
  };

  // ── Dice rolling handlers ─────────────────────────────────
  const handleRoll = (diceType: string, label?: string, statValue?: number, autoModifier?: number) => {
    const rollKey = label || diceType;
    const modifier = autoModifier !== undefined ? autoModifier : (parseInt(rollMod) || 0);
    setRollingDice(rollKey);
    setLastRoll(null);
    setCritChain(null);
    
    createRoll.mutate(
      { id, data: { diceType, modifier, label: label || rollLabel || diceType, ...(statValue !== undefined ? { statValue } : {}) } },
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
          }, 600);
        },
        onError: () => setRollingDice(null),
      }
    );
  };

  const handleStatRoll = (statKey: string, statLabel: string) => {
    const statValue = finalStats[statKey];
    const modifier = autoModifiers[statKey];
    handleRoll(diceLabels[statKey], `${statLabel} Roll`, statValue, modifier);
  };

  const handleSkillRoll = (skill: Skill) => {
    const modifier = Math.floor(skill.value / 3) + skill.modifier; // Auto modifier + skill mod
    handleRoll(getDiceLabel(skill.value), `${skill.name} Skill Roll`, undefined, modifier);
  };

  // ── Weapon quick action roll ──────────────────────────────
  const handleWeaponRoll = (item: Equipment) => {
    const dice = item.diceType || "d8";
    // Check if character has a modifier from weapon or linked stat (Power)
    const statMod = autoModifiers.power || 0;
    const flatMod = item.modifier || 0;
    const totalMod = statMod + flatMod;
    
    handleRoll(dice, `${item.name} Strike`, undefined, totalMod);
  };

  // ── Ability Quick Roll / Mana deduction ───────────────────
  const handleAbilityRoll = (ability: Ability) => {
    const curMana = mana ?? character.currentMana;
    if (curMana < ability.cost) {
      toast.error(`Not enough Mana! Requires ${ability.cost} MP (Have ${curMana} MP)`);
      return;
    }

    // Deduct Mana
    const nextMana = curMana - ability.cost;
    setMana(nextMana);
    updateChar.mutate({ id, data: { currentMana: nextMana } });

    // Roll
    if (ability.rollFormula) {
      const statKey = ability.linkedStat || "spirit";
      const mod = autoModifiers[statKey] || 0;
      handleRoll(ability.rollFormula, `${ability.name} Cast`, undefined, mod);
    } else {
      toast.success(`${ability.name} activated! (-${ability.cost} MP)`);
    }
  };

  // ── Edit Inventory helper triggers ────────────────────────
  const triggerAddInventory = (category: "currency" | "equipment" | "item") => {
    setInvType(category);
    setInvMode("add");
    setInvInitialData(null);
    setIsInvOpen(true);
  };

  const triggerEditInventory = (category: "currency" | "equipment" | "item", item: any) => {
    setInvType(category);
    setInvMode("edit");
    setInvInitialData(item);
    setIsInvOpen(true);
  };

  // ── Essence additions ─────────────────────────────────────
  const handleSaveEssence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!essenceName.trim() || essenceSlotInput === null) return;
    
    addEssence.mutate({
      characterId: id,
      name: essenceName,
      description: essenceDesc,
      slot: essenceSlotInput,
    }, {
      onSuccess: () => {
        setEssenceSlotInput(null);
        setEssenceName("");
        setEssenceDesc("");
      }
    });
  };

  // ── Notes additions ───────────────────────────────────────
  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    createNote.mutate(
      {
        characterId: id,
        title: noteTitle,
        content: noteContent,
        category: noteCat,
        tags: [],
      },
      {
        onSuccess: () => {
          setNoteTitle("");
          setNoteContent("");
          setNoteCat("general");
        }
      }
    );
  };

  // ── Stat & Skill Training ──────────────────────────────────
  const handleStatTrain = (statKey: string) => {
    const charStatValue = (character as any)[statKey] as number;
    const trainingKey = `${statKey}Training`;
    const curTraining = (character as any)[trainingKey] as number;

    const nextTraining = curTraining + 1;
    if (nextTraining >= charStatValue) {
      // Level Up!
      updateChar.mutate({
        id,
        data: {
          [statKey]: charStatValue + 1,
          [trainingKey]: 0,
        }
      }, {
        onSuccess: () => toast.success(`${statKey.toUpperCase()} increased to ${charStatValue + 1}!`)
      });
    } else {
      updateChar.mutate({
        id,
        data: {
          [trainingKey]: nextTraining,
        }
      });
    }
  };

  const handleSkillTrain = (skill: Skill) => {
    const nextTraining = skill.training + 1;
    if (nextTraining >= skill.value) {
      // Level Up!
      updateSkillMut.mutate({
        id: skill.id,
        data: {
          value: skill.value + 1,
          training: 0,
        }
      }, {
        onSuccess: () => toast.success(`${skill.name} increased to ${skill.value + 1}!`)
      });
    } else {
      updateSkillMut.mutate({
        id: skill.id,
        data: {
          training: nextTraining,
        }
      });
    }
  };

  // ── Backup Imports ────────────────────────────────────────
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = importCharacterJSON(text);
        toast.success(`Character '${imported.name}' imported successfully!`);
        setLocation(`/characters/${imported.id}`);
      } catch (err) {
        toast.error("Invalid character sheet file format.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  // ── Render Tiers ──────────────────────────────────────────
  const tier = critChain ? CRIT_TIERS[Math.min(critChain.chainCount, CRIT_TIERS.length - 1)] : null;
  const finalTier = lastRoll?.hadCrit ? CRIT_TIERS[Math.min(lastRoll.maxChainCount, CRIT_TIERS.length - 1)] : null;

  return (
    <div className="p-4 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* ── Top Header Controls ── */}
      <div className="flex items-center justify-between mb-4 border-b border-border/30 pb-3 flex-wrap gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/characters")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {/* Export JSON Button */}
          <Button variant="outline" size="sm" onClick={() => exportCharacterJSON(id)} className="h-8 text-xs border-primary/40 text-primary">
            <Download className="w-3.5 h-3.5 mr-1" /> Export JSON
          </Button>

          {/* Import JSON Button */}
          <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 text-xs border-primary/40 text-primary">
            <Upload className="w-3.5 h-3.5 mr-1" /> Import JSON
          </Button>

          {/* Edit Dialog */}
          <EditCharacterDialog character={character} />

          {/* Delete character */}
          <Button variant="destructive" size="icon" className="h-8 w-8" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Double-Column Main Workspace ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">

        {/* ── COLUMN 1: CHARACTER HUD (2/3 width) ── */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card className="bg-card border-primary/20 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/10 via-primary/50 to-primary/10" />
            
            <CardContent className="p-5 space-y-5">
              {/* Profile HUD Row */}
              <div className="flex justify-between items-start flex-wrap gap-4 border-b border-border/30 pb-3">
                <div>
                  <h1 className="text-3xl font-serif text-primary font-bold leading-tight flex items-center gap-2">
                    {character.name}
                  </h1>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                    Level {character.level} · {character.race} · {character.className}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Speed</div>
                  <div className="text-2xl font-serif text-foreground font-bold">{character.speed} ft</div>
                </div>
              </div>

              {/* Resource Management HUD grids */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. HP (Health) */}
                <div className="rounded-lg border border-border/40 bg-background/30 p-3 flex flex-col justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Heart className="w-4 h-4 text-destructive" /> Health (HP)
                  </div>
                  <div className="text-center py-1">
                    <span className={`text-4xl font-mono font-bold ${hp && hp > maxHp ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" : "text-foreground"}`}>
                      {hp ?? character.currentHp}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono"> /{maxHp}</span>
                  </div>
                  <ResourceBar current={hp ?? character.currentHp} max={maxHp} color={hp && hp > maxHp ? "#f59e0b" : "hsl(var(--destructive))"} />
                  
                  {/* hp quick actions: add/remove/buff */}
                  <div className="space-y-1.5 mt-2">
                    <div className="flex gap-1">
                      <Input
                        type="number" min="0" value={hpAdjust} placeholder="Val"
                        onChange={e => setHpAdjust(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-2"
                        onClick={() => handleHpAdjust("add")} disabled={!hpAdjust}>
                        + Heal
                      </Button>
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-2"
                        onClick={() => handleHpAdjust("remove")} disabled={!hpAdjust}>
                        - Dmg
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 flex-1"
                        onClick={() => handleHpAdjust("buff")} disabled={!hpAdjust}>
                        + Buff (Temp)
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground px-1"
                        onClick={handleFullRestoreHp}>
                        Full Restore
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 2. DT (Damage Threshold) */}
                <div className={`rounded-lg border p-3 flex flex-col justify-between gap-3 transition-colors duration-200 ${
                  dtFlash === "hit" ? "border-destructive/70 bg-destructive/10"
                  : dtFlash === "restore" ? "border-primary/70 bg-primary/10"
                  : "border-border/40 bg-background/30"
                }`}>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Shield className="w-4 h-4 text-primary" /> Damage Threshold
                  </div>
                  <div className="text-center py-1">
                    <span className={`text-4xl font-mono font-bold ${
                      dtFlash === "hit" ? "text-destructive" 
                      : currentDt && currentDt > maxDt ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" 
                      : "text-foreground"
                    }`}>
                      {currentDt ?? character.currentDt}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono"> /{maxDt}</span>
                  </div>
                  <ResourceBar current={currentDt ?? character.currentDt} max={maxDt} color={currentDt && currentDt > maxDt ? "#f59e0b" : "hsl(var(--primary))"} />
                  
                  {/* dt quick actions: add/remove/buff */}
                  <div className="space-y-1.5 mt-2">
                    <div className="flex gap-1">
                      <Input
                        type="number" min="0" value={dtAdjust} placeholder="Val"
                        onChange={e => { setDtAdjust(e.target.value); setDamageResult(null); }}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1"
                      />
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-2"
                        onClick={() => handleApplyDamage()} disabled={!dtAdjust || applyDamageMut.isPending}>
                        - Hit
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-2"
                        onClick={() => handleDtAdjust("add")} disabled={!dtAdjust}>
                        + Add
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-2"
                        onClick={() => handleDtAdjust("buff")} disabled={!dtAdjust}>
                        + Buff
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground px-1"
                        onClick={handleRestoreDt}>
                        Reset
                      </Button>
                    </div>
                    {damageResult && (
                      <p className={`text-[10px] font-mono text-center ${damageResult.absorbed ? "text-primary" : "text-destructive"}`}>
                        {damageResult.absorbed ? "✦ Absorbed" : damageResult.hpLost > 0 ? `−${damageResult.hpLost} HP` : "DT hit"}
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. Mana (MP) */}
                <div className="rounded-lg border border-border/40 bg-background/30 p-3 flex flex-col justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-blue-400" /> Mana (MP)
                  </div>
                  <div className="text-center py-1">
                    <span className={`text-4xl font-mono font-bold ${mana && mana > maxMana ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" : "text-foreground"}`}>
                      {mana ?? character.currentMana}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono"> /{maxMana}</span>
                  </div>
                  <ResourceBar current={mana ?? character.currentMana} max={maxMana} color={mana && mana > maxMana ? "#f59e0b" : "#3b82f6"} />
                  
                  {/* mana quick actions: add/remove/buff */}
                  <div className="space-y-1.5 mt-2">
                    <div className="flex gap-1">
                      <Input
                        type="number" min="0" value={manaAdjust} placeholder="Val"
                        onChange={e => setManaAdjust(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-2"
                        onClick={() => handleManaAdjust("add")} disabled={!manaAdjust}>
                        + Add
                      </Button>
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-2"
                        onClick={() => handleManaAdjust("remove")} disabled={!manaAdjust}>
                        - Use
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 flex-1"
                        onClick={() => handleManaAdjust("buff")} disabled={!manaAdjust}>
                        + Buff (Temp)
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground px-1"
                        onClick={handleFullRestoreMana}>
                        Full Restore
                      </Button>
                    </div>
                  </div>
                </div>

              </div>

            </CardContent>
          </Card>

          {/* ── Quick Rolls & Attacks Bar ── */}
          <Card className="bg-card/75 border-border/40 p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Quick Rolls & Actions</h3>
            <div className="flex flex-wrap gap-2">
              {/* Weapons assigned to Quick rolls */}
              {equipment.filter(eq => eq.equipped && eq.assignedToQuickRolls).map(weapon => (
                <Button
                  key={weapon.id}
                  variant="outline"
                  size="sm"
                  className="bg-background/50 hover:border-primary/60 border-border/60 text-xs font-serif flex items-center gap-1.5"
                  onClick={() => handleWeaponRoll(weapon)}
                >
                  <Swords className="w-3.5 h-3.5 text-primary" />
                  {weapon.name} ({weapon.diceType})
                </Button>
              ))}

              {/* Abilities assigned to Quick rolls */}
              {abilities.filter(ab => ab.assignedToQuickRolls).map(ability => (
                <Button
                  key={ability.id}
                  variant="outline"
                  size="sm"
                  className="bg-background/50 hover:border-primary/60 border-border/60 text-xs font-serif flex items-center gap-1.5"
                  onClick={() => handleAbilityRoll(ability)}
                >
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  {ability.name} ({ability.cost} MP)
                </Button>
              ))}

              {equipment.filter(eq => eq.equipped && eq.assignedToQuickRolls).length === 0 &&
               abilities.filter(ab => ab.assignedToQuickRolls).length === 0 && (
                <span className="text-xs text-muted-foreground/60 italic font-serif">Equip weapons or assign shaped abilities to this bar.</span>
              )}
            </div>
          </Card>
        </div>

        {/* ── COLUMN 2: DICE HUD (1/3 width) ── */}
        <div className="lg:col-span-1">
          <Card className="bg-card border-primary/30 shadow-lg relative overflow-hidden h-full">
            <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
            <CardContent className="p-4 flex flex-col gap-3 h-full justify-between">
              
              <div className="space-y-3">
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
                  <div className="grid grid-cols-4 gap-1.5">
                    {STATS.map(stat => {
                      const value = finalStats[stat.key];
                      const mod = autoModifiers[stat.key];
                      const dice = diceLabels[stat.key];
                      const isRolling = rollingDice === `${stat.label} Roll`;
                      return (
                        <button
                          key={stat.key}
                          onClick={() => handleStatRoll(stat.key, stat.label)}
                          disabled={!!rollingDice}
                          title={`${stat.desc} — ${dice}`}
                          className={`rounded-md p-1 text-center border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isRolling ? "border-primary bg-primary/10 animate-pulse"
                            : "border-border/40 hover:border-primary/60 hover:bg-primary/5 cursor-pointer"
                          }`}
                        >
                          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{stat.label}</div>
                          <div className="text-xl font-serif text-foreground leading-tight">{value}</div>
                          <div className="text-[10px] font-mono text-primary">+{mod}</div>
                          <div className="text-[8px] font-mono text-muted-foreground/60">{dice}</div>
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
              </div>

              {/* Roll result display */}
              <div
                className="p-4 border-2 rounded-lg text-center flex flex-col items-center justify-center transition-all duration-500 min-h-[140px] mt-4"
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

      {/* ── TABBED TOOL SCREEN BAR ── */}
      <div className="flex gap-2 border-b border-border/40 mt-6 overflow-x-auto pb-1 flex-wrap">
        {[
          { key: "stats", label: "Stats & Training", icon: Hammer },
          { key: "skills", label: "Skills", icon: BookText },
          { key: "inventory", label: "Inventory", icon: Coins },
          { key: "essences", label: "Essences", icon: Layers },
          { key: "abilities", label: "Shaped Abilities", icon: Flame },
          { key: "notes", label: "Campaign Notes", icon: BookText },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Button
              key={tab.key}
              variant="ghost"
              onClick={() => setActiveTab(tab.key as any)}
              className={`rounded-none border-b-2 font-serif text-sm px-4 py-2 flex items-center gap-1.5 h-10 ${
                isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* ── ACTIVE TOOL SCREEN AREA ── */}
      <div className="mt-4 animate-in fade-in duration-300">

        {/* ── TAB 1: STATS & TRAINING ── */}
        {activeTab === "stats" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map(stat => {
              const baseValue = (character as any)[stat.key] as number;
              const finalValue = finalStats[stat.key];
              const mod = autoModifiers[stat.key];
              const isBuffed = finalValue > baseValue;
              
              const trainingKey = `${stat.key}Training`;
              const curTraining = (character as any)[trainingKey] as number;

              return (
                <Card key={stat.key} className="bg-card border-border/50 shadow-sm flex flex-col justify-between">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</h4>
                        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-1">{stat.desc}</p>
                      </div>
                      <Badge variant="outline" className={`font-mono text-xs ${isBuffed ? "border-amber-500/40 text-amber-500 bg-amber-500/5 animate-pulse" : ""}`}>
                        {isBuffed ? `Base: ${baseValue}` : "No Gear"}
                      </Badge>
                    </div>

                    <div className="flex items-baseline justify-between py-1">
                      <div className="flex items-baseline gap-1">
                        <span className={`text-4xl font-serif font-bold ${isBuffed ? "text-amber-400" : "text-foreground"}`}>{finalValue}</span>
                        <span className="text-xs font-mono text-primary font-bold">+{mod}</span>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground/60">{diceLabels[stat.key]}</span>
                    </div>

                    {/* Stat training tracker */}
                    <div className="border-t border-border/30 pt-3 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-muted-foreground uppercase">Training Points</span>
                        <span className="text-primary font-bold">{curTraining}/{baseValue}</span>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <div className="flex-1 bg-accent/40 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, (curTraining / baseValue) * 100)}%` }}
                          />
                        </div>
                        <Button
                          size="sm"
                          className="h-6 text-[10px] font-bold px-2 bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30"
                          onClick={() => handleStatTrain(stat.key)}
                        >
                          + Train
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── TAB 2: SKILLS ── */}
        {activeTab === "skills" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-serif text-primary font-bold">Custom Skills Log</h3>
              <EditSkillsDialog characterId={id} />
            </div>

            {skills && skills.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {skills.map((skill) => (
                  <Card key={skill.id} className="bg-card border-border/50 flex flex-col justify-between">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <h4 className="font-serif text-lg font-semibold text-foreground">{skill.name}</h4>
                        <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">{getDiceLabel(skill.value)}</Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-serif text-foreground font-bold">{skill.value}</span>
                          <span className="text-xs font-mono text-primary font-bold">+{Math.floor(skill.value / 3)}</span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSkillRoll(skill)}
                          className="h-7 text-xs bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
                        >
                          <Dice5 className="w-3 h-3 mr-1" /> Roll Skill
                        </Button>
                      </div>

                      {/* Skill training */}
                      <div className="border-t border-border/30 pt-3 flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-muted-foreground uppercase">Skill Training</span>
                          <span className="text-primary font-bold">{skill.training}/{skill.value}</span>
                        </div>
                        <div className="flex gap-1.5 items-center">
                          <div className="flex-1 bg-accent/40 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, (skill.training / skill.value) * 100)}%` }}
                            />
                          </div>
                          <Button
                            size="sm"
                            className="h-6 text-[10px] font-bold px-2 bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30"
                            onClick={() => handleSkillTrain(skill)}
                          >
                            + Train
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-card/30 border border-dashed border-border/40 rounded-lg text-sm text-muted-foreground/60 italic font-serif">
                No custom skills added yet. Tap "Edit Skills" to register skills.
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: INVENTORY ── */}
        {activeTab === "inventory" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            
            {/* 1. Currencies column */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-border/30 pb-2">
                <h4 className="font-serif text-lg text-primary font-bold flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-primary" /> Currencies
                </h4>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary px-2" onClick={() => triggerAddInventory("currency")}>
                  [Add]
                </Button>
              </div>

              {currencies && currencies.length > 0 ? (
                <div className="space-y-2">
                  {currencies.map(c => (
                    <Card key={c.id} className="bg-card/50 border-border/40 hover:border-primary/20 transition-all">
                      <CardContent className="p-3 flex justify-between items-center">
                        <div className="font-serif font-semibold text-foreground">{c.name}</div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-lg text-primary">{c.amount}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => triggerEditInventory("currency", c)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic font-serif text-center py-6">No currencies tracked.</p>
              )}
            </div>

            {/* 2. Equipment column */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-border/30 pb-2">
                <h4 className="font-serif text-lg text-primary font-bold flex items-center gap-1.5">
                  <Hammer className="w-4 h-4 text-primary" /> Equipment
                </h4>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary px-2" onClick={() => triggerAddInventory("equipment")}>
                  [Add]
                </Button>
              </div>

              {equipment && equipment.length > 0 ? (
                <div className="space-y-2">
                  {equipment.map(eq => {
                    const bonusList = Object.entries(eq.statModifiers || {}).map(([stat, val]) => `${stat.toUpperCase()}: +${val}`);
                    if (eq.dtBonus > 0) bonusList.push(`DT: +${eq.dtBonus}`);
                    
                    return (
                      <Card key={eq.id} className={`bg-card/50 border-border/40 transition-all ${eq.equipped ? "border-primary/40 shadow-sm" : ""}`}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-serif font-bold text-foreground flex items-center gap-1.5">
                                {eq.name}
                                {eq.equipped && <span className="text-[8px] bg-primary/10 border border-primary/30 text-primary px-1 rounded uppercase font-semibold">Equipped</span>}
                              </div>
                              <p className="text-[10px] text-muted-foreground/80 font-serif line-clamp-1">{eq.description}</p>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={() => triggerEditInventory("equipment", eq)}>
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteEq.mutate({ id: eq.id, charId: id })}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          {bonusList.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {bonusList.map(bonus => (
                                <Badge key={bonus} variant="outline" className="text-[9px] font-mono border-primary/20 text-primary/80 py-0.5 px-1.5">{bonus}</Badge>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between border-t border-border/30 pt-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={eq.equipped}
                                onChange={(e) => updateEq.mutate({ id: eq.id, data: { equipped: e.target.checked } })}
                                className="rounded border-border/50 h-3 w-3 accent-primary"
                              />
                              Equipped
                            </label>
                            {eq.diceType && (
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={eq.assignedToQuickRolls}
                                  onChange={(e) => updateEq.mutate({ id: eq.id, data: { assignedToQuickRolls: e.target.checked } })}
                                  className="rounded border-border/50 h-3 w-3 accent-primary"
                                />
                                Quick roll
                              </label>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic font-serif text-center py-6">No equipment found.</p>
              )}
            </div>

            {/* 3. General Items column */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-border/30 pb-2">
                <h4 className="font-serif text-lg text-primary font-bold flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-primary" /> General Items
                </h4>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary px-2" onClick={() => triggerAddInventory("item")}>
                  [Add]
                </Button>
              </div>

              {inventory && inventory.length > 0 ? (
                <div className="space-y-2">
                  {inventory.map(item => (
                    <Card key={item.id} className="bg-card/50 border-border/40 hover:border-primary/20 transition-all">
                      <CardContent className="p-3 flex justify-between items-center">
                        <div>
                          <div className="font-serif font-semibold text-foreground">
                            {item.name} <span className="font-mono text-muted-foreground/80 font-normal">x{item.quantity}</span>
                          </div>
                          {item.description && <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={() => triggerEditInventory("item", item)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteEq.mutate({ id: item.id, charId: id })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic font-serif text-center py-6">No general items.</p>
              )}
            </div>

            {/* Render single inventory modal dialog */}
            <EditInventoryDialog
              characterId={id}
              isOpen={isInvOpen}
              onOpenChange={setIsInvOpen}
              mode={invMode}
              type={invType}
              initialData={invInitialData}
            />
          </div>
        )}

        {/* ── TAB 4: ESSENCES ── */}
        {activeTab === "essences" && (
          <div className="space-y-4">
            <h3 className="text-lg font-serif text-primary font-bold">Essences (Merging Slots)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(slot => {
                const essence = essences.find(e => e.slot === slot);
                
                // Show slot details
                return (
                  <Card key={slot} className={`bg-card border-border/50 relative overflow-hidden flex flex-col justify-between ${
                    slot === 4 ? "border-amber-500/30 bg-amber-500/[0.02]" : ""
                  }`}>
                    {slot === 4 && (
                      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                    )}
                    
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] uppercase tracking-widest font-mono text-muted-foreground font-bold">
                          {slot === 4 ? "Merged Essence (Slot 4)" : `Essence Slot ${slot}`}
                        </span>
                        {essence && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteEssence.mutate({ id: essence.id, charId: id })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>

                      {essence ? (
                        <div className="space-y-1">
                          <h4 className={`font-serif text-lg font-bold ${slot === 4 ? "text-amber-400" : "text-foreground"}`}>{essence.name}</h4>
                          <p className="text-xs text-muted-foreground/80 font-serif leading-relaxed line-clamp-3">{essence.description}</p>
                        </div>
                      ) : slot === 4 ? (
                        <p className="text-xs text-muted-foreground/60 italic font-serif py-4">
                          Merge active. Slots 1-3 must be filled to unlock the Merged Essence.
                        </p>
                      ) : (
                        <div className="py-4 text-center">
                          <Button
                            size="sm"
                            className="bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 h-7 text-xs font-serif"
                            onClick={() => setEssenceSlotInput(slot)}
                          >
                            + Slot Essence
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Render inline slot assignment form when slot matches */}
            {essenceSlotInput !== null && (
              <Card className="bg-card border-primary/20 mt-4 max-w-lg animate-in slide-in-from-top-4 duration-300">
                <CardContent className="p-4 space-y-4">
                  <h4 className="font-serif text-lg text-primary font-bold">Slot Essence {essenceSlotInput}</h4>
                  <form onSubmit={handleSaveEssence} className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Essence Name</label>
                      <Input value={essenceName} onChange={e => setEssenceName(e.target.value)} required placeholder="e.g. Fire, Earth, Sky" className="bg-background text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Description</label>
                      <Textarea value={essenceDesc} onChange={e => setEssenceDesc(e.target.value)} placeholder="Description of attunements..." className="bg-background text-sm font-serif" />
                    </div>
                    <div className="flex justify-end gap-1.5 pt-2 border-t border-border/30">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEssenceSlotInput(null)}>Cancel</Button>
                      <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-serif">Apply Slot</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── TAB 5: SHAPED ABILITIES ── */}
        {activeTab === "abilities" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-serif text-primary font-bold">Shaped Spells & Abilities</h3>
              <EditAbilitiesDialog characterId={id} />
            </div>

            {abilities && abilities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {abilities.map((ability) => (
                  <Card key={ability.id} className="bg-card border-border/50">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-serif text-xl font-bold text-primary leading-tight">{ability.name}</h4>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <Badge variant="outline" className="text-[9px] font-mono border-primary/20 text-primary">{ability.cost} MP</Badge>
                            <Badge variant="outline" className="text-[9px] font-mono border-border/60 text-muted-foreground">{ability.range}</Badge>
                            <Badge variant="outline" className="text-[9px] font-mono border-border/60 text-muted-foreground">{ability.speed}</Badge>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleAbilityRoll(ability)}
                          className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 h-8 font-serif"
                        >
                          <Dice5 className="w-3.5 h-3.5 mr-1" /> Use Ability
                        </Button>
                      </div>

                      {/* Markdown rendered description */}
                      <div
                        className="text-xs text-muted-foreground font-serif leading-relaxed border-t border-border/30 pt-3 whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(ability.description) }}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-card/30 border border-dashed border-border/40 rounded-lg text-sm text-muted-foreground/60 italic font-serif">
                No shaped abilities prepared. Click "Edit Abilities" to construct skills.
              </div>
            )}
          </div>
        )}

        {/* ── TAB 6: CAMPAIGN NOTES ── */}
        {activeTab === "notes" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            
            {/* Note creation column */}
            <div className="lg:col-span-1">
              <Card className="bg-card border-border/50">
                <CardContent className="p-4 space-y-4">
                  <h4 className="font-serif text-lg text-primary font-bold border-b border-border/30 pb-2">Pen Note entry</h4>
                  <form onSubmit={handleSaveNote} className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Title</label>
                      <Input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} required placeholder="Entry title" className="bg-background text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Category</label>
                      <select 
                        value={noteCat} 
                        onChange={e => setNoteCat(e.target.value)} 
                        className="w-full h-8 rounded-md border border-border/60 bg-background px-3 py-1 text-xs shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="general">GENERAL</option>
                        <option value="location">LOCATION</option>
                        <option value="npc">NPC</option>
                        <option value="item">ITEM</option>
                        <option value="lore">LORE</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Content</label>
                      <Textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Write thoughts..." className="bg-background min-h-[120px] text-sm font-serif" />
                    </div>
                    <Button type="submit" size="sm" className="w-full bg-primary text-primary-foreground font-serif">Save Entry</Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Note listing column */}
            <div className="lg:col-span-2 space-y-3 max-h-[450px] overflow-y-auto pr-1">
              {notes && notes.length > 0 ? (
                notes.map(note => (
                  <Card key={note.id} className="bg-card/50 border-border/40 hover:border-primary/20 transition-all relative group">
                    <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => deleteNote.mutate({ id: note.id, charId: id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-serif text-lg font-bold text-primary">{note.title}</h4>
                          <Badge variant="outline" className="text-[8px] uppercase tracking-wider text-muted-foreground mt-1 border-border/50">{note.category}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground/80 font-serif leading-relaxed whitespace-pre-wrap">{note.content}</p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-muted-foreground/60 italic font-serif text-center py-10">No notes written for this character.</p>
              )}
            </div>

          </div>
        )}

      </div>

      {/* ── Roll History list log ── */}
      <Card className="mt-6 bg-card border-border/50">
        <div className="px-5 py-3 border-b border-border/30 flex justify-between items-center">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Character Roll History</p>
        </div>
        {loadingRolls ? (
          <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary/50" /></div>
        ) : rolls && rolls.length > 0 ? (
          <div className="divide-y divide-border/30 max-h-[160px] overflow-y-auto">
            {rolls.map(roll => (
              <div key={roll.id} className="px-5 py-2 hover:bg-accent/20 transition-colors flex justify-between items-center">
                <div>
                  <div className="font-medium text-xs text-foreground flex items-center gap-1.5">
                    {roll.label || "Roll"}
                    {roll.isCrit && <span className="text-[9px] font-bold text-yellow-500 uppercase tracking-wider">crit</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {roll.diceType}{roll.modifier ? (roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier) : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-base font-serif font-bold ${roll.isCrit ? "text-yellow-500" : "text-primary"}`}>{roll.total}</div>
                  <div className="text-[9px] text-muted-foreground/50">{format(new Date(roll.rolledAt), "HH:mm")}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-muted-foreground font-serif italic">No history yet.</div>
        )}
      </Card>

    </div>
  );
}
