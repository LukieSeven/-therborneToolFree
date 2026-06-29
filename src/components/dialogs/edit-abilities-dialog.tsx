import React, { useState } from "react";
import { useListEssences, useAddAbility, useUpdateAbility, useDeleteAbility } from "@/hooks/useStorage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Edit2, Trash2 } from "lucide-react";
import { Ability } from "@/lib/storage";

interface Props {
  characterId: number;
  abilities: Ability[];
}

const STAT_OPTIONS = ["power", "vitality", "spirit", "agility", "endurance", "precision", "willpower", "charisma"];

export function EditAbilitiesDialog({ characterId, abilities }: Props) {
  const { data: essences } = useListEssences(characterId);
  const addAbility = useAddAbility();
  const updateAbility = useUpdateAbility();
  const deleteAbility = useDeleteAbility();

  // Mode: 'list' | 'add' | 'edit'
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [range, setRange] = useState("");
  const [speed, setSpeed] = useState("");
  const [rollFormula, setRollFormula] = useState("");
  const [type, setType] = useState("");
  const [linkedStats, setLinkedStats] = useState<string[]>([]);
  const [assignedToQuickRolls, setAssignedToQuickRolls] = useState(false);
  const [essenceId, setEssenceId] = useState<number | null>(null);
  const [resistances, setResistances] = useState("");
  const [immunities, setImmunities] = useState("");

  // Bonus states
  const [bonusPower, setBonusPower] = useState<number>(0);
  const [bonusVitality, setBonusVitality] = useState<number>(0);
  const [bonusSpirit, setBonusSpirit] = useState<number>(0);
  const [bonusAgility, setBonusAgility] = useState<number>(0);
  const [bonusEndurance, setBonusEndurance] = useState<number>(0);
  const [bonusPrecision, setBonusPrecision] = useState<number>(0);
  const [bonusWillpower, setBonusWillpower] = useState<number>(0);
  const [bonusCharisma, setBonusCharisma] = useState<number>(0);
  const [bonusHp, setBonusHp] = useState<string>("");
  const [bonusMana, setBonusMana] = useState<string>("");
  const [bonusDt, setBonusDt] = useState<string>("");

  const resetForm = () => {
    setName("");
    setDescription("");
    setCost(0);
    setCooldown(0);
    setRange("");
    setSpeed("");
    setRollFormula("");
    setType("");
    setLinkedStats([]);
    setAssignedToQuickRolls(false);
    setEssenceId(null);
    setResistances("");
    setImmunities("");
    setBonusPower(0);
    setBonusVitality(0);
    setBonusSpirit(0);
    setBonusAgility(0);
    setBonusEndurance(0);
    setBonusPrecision(0);
    setBonusWillpower(0);
    setBonusCharisma(0);
    setBonusHp("");
    setBonusMana("");
    setBonusDt("");
    setEditingId(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setMode("add");
  };

  const handleOpenEdit = (ability: any) => {
    setEditingId(ability.id);
    setName(ability.name);
    setDescription(ability.description);
    setCost(ability.cost);
    setCooldown(ability.cooldown);
    setRange(ability.range);
    setSpeed(ability.speed);
    setRollFormula(ability.rollFormula);
    setType(ability.type || "");
    setLinkedStats(ability.linkedStats || (ability.linkedStat ? [ability.linkedStat] : []));
    setAssignedToQuickRolls(ability.assignedToQuickRolls);
    setEssenceId(ability.essenceId || null);
    setResistances(ability.resistances || "");
    setImmunities(ability.immunities || "");
    setBonusPower(ability.bonusPower || 0);
    setBonusVitality(ability.bonusVitality || 0);
    setBonusSpirit(ability.bonusSpirit || 0);
    setBonusAgility(ability.bonusAgility || 0);
    setBonusEndurance(ability.bonusEndurance || 0);
    setBonusPrecision(ability.bonusPrecision || 0);
    setBonusWillpower(ability.bonusWillpower || 0);
    setBonusCharisma(ability.bonusCharisma || 0);
    setBonusHp(ability.bonusHp !== undefined ? String(ability.bonusHp) : "");
    setBonusMana(ability.bonusMana !== undefined ? String(ability.bonusMana) : "");
    setBonusDt(ability.bonusDt !== undefined ? String(ability.bonusDt) : "");
    setMode("edit");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Validate 5-ability cap per Essence
    if (essenceId !== null) {
      const activeEssenceAbilities = abilities?.filter(a => a.essenceId === essenceId && a.id !== editingId) || [];
      if (activeEssenceAbilities.length >= 5) {
        toast.error("This Essence already has the maximum of 5 shaped abilities. Reassign or delete one first.");
        return;
      }
    }

    const payload = {
      characterId,
      name,
      description,
      cost,
      cooldown,
      range,
      speed,
      rollFormula,
      type,
      linkedStats,
      assignedToQuickRolls,
      essenceId,
      resistances,
      immunities,
      bonusPower,
      bonusVitality,
      bonusSpirit,
      bonusAgility,
      bonusEndurance,
      bonusPrecision,
      bonusWillpower,
      bonusCharisma,
      bonusHp,
      bonusMana,
      bonusDt,
      level: editingId ? (abilities.find(a => a.id === editingId)?.level || 1) : 1,
      active: editingId ? !!(abilities.find(a => a.id === editingId)?.active) : false,
    };

    if (mode === "add") {
      addAbility.mutate(payload, {
        onSuccess: () => setMode("list"),
      });
    } else if (mode === "edit" && editingId) {
      updateAbility.mutate({
        id: editingId,
        data: payload,
      }, {
        onSuccess: () => setMode("list"),
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Remove this shaped ability?")) {
      deleteAbility.mutate({ id, charId: characterId });
    }
  };

  const characterAbilities = (abilities || []).filter(a => !a.equipmentId);

  return (
    <Dialog open={mode !== "list" || mode === "list"} onOpenChange={(open) => { if (!open) setMode("list"); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 font-serif text-sm rounded-none">
          Edit Abilities
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-none p-5">
        <DialogHeader className="border-b border-border/30 pb-2">
          <DialogTitle className="font-serif text-2xl text-primary font-bold flex justify-between items-center">
            <span>
              {mode === "list" ? "Manage Abilities" : mode === "add" ? "Shape New Ability" : "Edit Shaped Ability"}
            </span>
            {mode === "list" && (
              <Button size="sm" onClick={handleOpenAdd} className="bg-primary text-primary-foreground font-serif rounded-none cursor-pointer">
                + Add Ability
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {mode === "list" ? (
          <div className="space-y-3 mt-4 text-xs">
            {characterAbilities.length > 0 ? (
              <div className="divide-y divide-border/40">
                {characterAbilities.map((ability) => (
                  <div key={ability.id} className="py-3 flex justify-between items-start group">
                    <div className="space-y-1">
                      <div className="font-serif text-base text-foreground font-semibold flex items-center gap-2 flex-wrap">
                        {ability.name}
                        {ability.type && (
                          <span className="text-[9px] uppercase bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-none font-bold font-sans tracking-wide">{ability.type}</span>
                        )}
                        {ability.assignedToQuickRolls && (
                          <span className="text-[9px] uppercase bg-primary/10 border border-primary/30 text-primary px-1.5 py-0.5 rounded-none font-bold font-sans">Quick Roll</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        Cost: {ability.cost} MP | Cooldown: {ability.cooldown}s | Range: {ability.range} | Speed: {ability.speed}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(ability)} className="h-8 w-8 text-primary hover:bg-primary/10 rounded-none cursor-pointer">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(ability.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-none cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground font-serif italic">
                No abilities shaped. Tap "Add Ability" to build spells or attacks.
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 mt-4 text-xs font-sans">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Ability Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Fireball, Cleave" className="bg-background rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Essence Source</label>
                <select 
                  value={essenceId === null ? "" : essenceId} 
                  onChange={e => setEssenceId(e.target.value === "" ? null : Number(e.target.value))} 
                  className="w-full h-9 rounded-none border border-border/60 bg-background px-3 py-1 text-xs shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">None (Unassigned)</option>
                  {essences?.map(ess => (
                    <option key={ess.id} value={ess.id}>
                      Slot {ess.slot}: {ess.name || "Unnamed Essence"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Linked Attributes checkboxes */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1.5">Linked Attributes (For Roll Modifiers)</label>
              <div className="grid grid-cols-4 gap-2">
                {STAT_OPTIONS.map(stat => {
                  const isChecked = linkedStats.includes(stat);
                  return (
                    <div key={stat} className="flex items-center gap-2 bg-background border border-border/40 p-2 rounded-none">
                      <Checkbox 
                        id={`link_${stat}`} 
                        checked={isChecked} 
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setLinkedStats([...linkedStats, stat]);
                          } else {
                            setLinkedStats(linkedStats.filter(s => s !== stat));
                          }
                        }} 
                      />
                      <label htmlFor={`link_${stat}`} className="text-[10px] font-mono font-bold uppercase cursor-pointer">
                        {stat.substring(0, 3)}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Mana Cost</label>
                <Input type="number" min={0} value={cost} onChange={e => setCost(Number(e.target.value))} required className="bg-background font-mono rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Cooldown (sec)</label>
                <Input type="number" min={0} value={cooldown} onChange={e => setCooldown(Number(e.target.value))} required className="bg-background font-mono rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Range</label>
                <Input value={range} onChange={e => setRange(e.target.value)} placeholder="e.g. Melee, 30ft" className="bg-background rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Speed</label>
                <Input value={speed} onChange={e => setSpeed(e.target.value)} placeholder="e.g. Standard, Instant" className="bg-background rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Type</label>
                <select 
                  value={type} 
                  onChange={e => setType(e.target.value)} 
                  className="w-full h-9 rounded-none border border-border/60 bg-background px-3 py-1 text-xs shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">None</option>
                  <option value="Attack">Attack</option>
                  <option value="Buff">Buff</option>
                  <option value="Debuff">Debuff</option>
                  <option value="Defense">Defense</option>
                  <option value="Movement">Movement</option>
                  <option value="Utility">Utility</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Roll Formula / Modifier (Optional)</label>
              <Input value={rollFormula} onChange={e => setRollFormula(e.target.value)} placeholder="e.g. d20+powr+6, 2d6+prer" className="bg-background font-mono rounded-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Resistances (Granted while active)</label>
                <Input value={resistances} onChange={e => setResistances(e.target.value)} placeholder="e.g. Fire, Piercing" className="bg-background rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Immunities (Granted while active)</label>
                <Input value={immunities} onChange={e => setImmunities(e.target.value)} placeholder="e.g. Poison, Stun" className="bg-background rounded-none" />
              </div>
            </div>

            {/* Description textarea */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Description / Effects</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the effects of this ability..." className="bg-background min-h-[60px] rounded-none font-serif text-sm" />
            </div>

            {/* Stat & Resource Bonuses */}
            <div className="border-t border-border/20 pt-3 space-y-2">
              <h5 className="font-serif font-bold text-primary text-sm">Stat Modifiers (Granted while active)</h5>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Power</label>
                  <Input type="number" value={bonusPower} onChange={e => setBonusPower(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Vitality</label>
                  <Input type="number" value={bonusVitality} onChange={e => setBonusVitality(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Spirit</label>
                  <Input type="number" value={bonusSpirit} onChange={e => setBonusSpirit(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Agility</label>
                  <Input type="number" value={bonusAgility} onChange={e => setBonusAgility(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Endurance</label>
                  <Input type="number" value={bonusEndurance} onChange={e => setBonusEndurance(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Precision</label>
                  <Input type="number" value={bonusPrecision} onChange={e => setBonusPrecision(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Willpower</label>
                  <Input type="number" value={bonusWillpower} onChange={e => setBonusWillpower(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Charisma</label>
                  <Input type="number" value={bonusCharisma} onChange={e => setBonusCharisma(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
              </div>
            </div>

            {/* Vitals Modifiers Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">HP Mod</label>
                <Input value={bonusHp} onChange={e => setBonusHp(e.target.value)} placeholder="e.g. +5, -2" className="bg-background font-mono h-7 text-xs rounded-none" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Mana Mod</label>
                <Input value={bonusMana} onChange={e => setBonusMana(e.target.value)} placeholder="e.g. +10, -5" className="bg-background font-mono h-7 text-xs rounded-none" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">DT Mod</label>
                <Input value={bonusDt} onChange={e => setBonusDt(e.target.value)} placeholder="e.g. +1, -1" className="bg-background font-mono h-7 text-xs rounded-none" />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox 
                id="quick_roll" 
                checked={assignedToQuickRolls} 
                onCheckedChange={(checked) => setAssignedToQuickRolls(!!checked)} 
              />
              <label htmlFor="quick_roll" className="font-bold text-[10px] text-muted-foreground uppercase cursor-pointer">
                Assign to Quick Rolls HUD
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-border/30 pt-4">
              <Button type="button" variant="ghost" onClick={resetForm} className="rounded-none">Reset</Button>
              <Button type="button" variant="ghost" onClick={() => setMode("list")} className="rounded-none">Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground font-serif rounded-none">
                {mode === "add" ? "Shape Ability" : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
