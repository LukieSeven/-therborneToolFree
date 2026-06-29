import { useState } from "react";
import { useListAbilities, useAddAbility, useUpdateAbility, useDeleteAbility, useListEssences } from "@/hooks/useStorage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit2, ShieldAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "react-hot-toast";

interface Props {
  characterId: number;
}

const STAT_OPTIONS = ["power", "vitality", "spirit", "agility", "endurance", "precision", "willpower", "charisma"];

export function EditAbilitiesDialog({ characterId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: abilities } = useListAbilities(characterId);
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) setMode("list"); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 font-serif text-sm">
          Edit Abilities
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[80vh] overflow-y-auto bg-card border-border shadow-2xl">
        <DialogHeader className="border-b border-border/30 pb-3 flex flex-row items-center justify-between">
          <DialogTitle className="font-serif text-2xl text-primary font-bold">
            {mode === "list" && "Shaped Abilities"}
            {mode === "add" && "Shape New Ability"}
            {mode === "edit" && "Modify Shaped Ability"}
          </DialogTitle>
          {mode === "list" && (
            <Button size="sm" onClick={handleOpenAdd} className="bg-primary text-primary-foreground font-serif">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Ability
            </Button>
          )}
        </DialogHeader>

        {mode === "list" ? (
          <div className="space-y-3 mt-4">
            {abilities && abilities.length > 0 ? (
              <div className="divide-y divide-border/40">
                {abilities.map((ability) => (
                  <div key={ability.id} className="py-3 flex justify-between items-start group">
                    <div className="space-y-1">
                      <div className="font-serif text-lg text-foreground font-semibold flex items-center gap-2">
                        {ability.name}
                        {ability.assignedToQuickRolls && (
                          <span className="text-[9px] uppercase bg-primary/10 border border-primary/30 text-primary px-1.5 py-0.5 rounded">Quick Roll</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        Cost: {ability.cost} MP | Cooldown: {ability.cooldown}s | Range: {ability.range} | Speed: {ability.speed}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(ability)} className="h-8 w-8 text-primary hover:bg-primary/10">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(ability.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
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
          <form onSubmit={handleSave} className="space-y-4 mt-4 text-sm font-sans">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Ability Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Fireball, Cleave" className="bg-background" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Essence Source</label>
                <select 
                  value={essenceId === null ? "" : essenceId} 
                  onChange={e => setEssenceId(e.target.value === "" ? null : Number(e.target.value))} 
                  className="w-full h-9 rounded-md border border-border/60 bg-background px-3 py-1 text-sm shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">Linked Attributes (For Roll Modifiers)</label>
              <div className="grid grid-cols-4 gap-2">
                {STAT_OPTIONS.map(stat => {
                  const isChecked = linkedStats.includes(stat);
                  return (
                    <div key={stat} className="flex items-center gap-2 bg-background border border-border/40 p-2 rounded-md">
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
                      <label htmlFor={`link_${stat}`} className="text-xs font-mono font-bold uppercase cursor-pointer">
                        {stat.substring(0, 3)}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Mana Cost</label>
                <Input type="number" min={0} value={cost} onChange={e => setCost(Number(e.target.value))} required className="bg-background font-mono" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Cooldown (sec)</label>
                <Input type="number" min={0} value={cooldown} onChange={e => setCooldown(Number(e.target.value))} required className="bg-background font-mono" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Range</label>
                <Input value={range} onChange={e => setRange(e.target.value)} placeholder="e.g. Melee, 30ft" className="bg-background" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Speed</label>
                <Input value={speed} onChange={e => setSpeed(e.target.value)} placeholder="e.g. Standard, Instant" className="bg-background" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Roll Formula (Optional)</label>
                <Input value={rollFormula} onChange={e => setRollFormula(e.target.value)} placeholder="e.g. STATr*3, 2d6, d8+2" className="bg-background font-mono" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox 
                  id="quick_roll" 
                  checked={assignedToQuickRolls} 
                  onCheckedChange={(checked) => setAssignedToQuickRolls(!!checked)} 
                />
                <label htmlFor="quick_roll" className="text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer">
                  Assign to Quick Rolls HUD
                </label>
              </div>
            </div>

            {/* Stat & Resource Bonuses */}
            <div className="border-t border-border/30 pt-4 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-2 font-serif">Flat Stat Bonuses</h4>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "POW", val: bonusPower, set: setBonusPower },
                    { label: "VIT", val: bonusVitality, set: setBonusVitality },
                    { label: "SPI", val: bonusSpirit, set: setBonusSpirit },
                    { label: "AGI", val: bonusAgility, set: setBonusAgility },
                    { label: "END", val: bonusEndurance, set: setBonusEndurance },
                    { label: "PRE", val: bonusPrecision, set: setBonusPrecision },
                    { label: "WIL", val: bonusWillpower, set: setBonusWillpower },
                    { label: "CHA", val: bonusCharisma, set: setBonusCharisma },
                  ].map(stat => (
                    <div key={stat.label}>
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">{stat.label}</label>
                      <Input 
                        type="number" 
                        value={stat.val === 0 ? "" : stat.val} 
                        onChange={e => stat.set(e.target.value === "" ? 0 : Number(e.target.value))} 
                        placeholder="+0"
                        className="bg-background h-8 font-mono text-xs text-center" 
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-2 font-serif">Resource Pool Formulas/Bonuses</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Max HP</label>
                    <Input 
                      type="text" 
                      value={bonusHp} 
                      onChange={e => setBonusHp(e.target.value)} 
                      placeholder="e.g. VIT*5, +10"
                      className="bg-background h-8 font-mono text-xs text-center" 
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Max Mana</label>
                    <Input 
                      type="text" 
                      value={bonusMana} 
                      onChange={e => setBonusMana(e.target.value)} 
                      placeholder="e.g. SPI*5, +10"
                      className="bg-background h-8 font-mono text-xs text-center" 
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Max DT</label>
                    <Input 
                      type="text" 
                      value={bonusDt} 
                      onChange={e => setBonusDt(e.target.value)} 
                      placeholder="e.g. WIL*2, +2"
                      className="bg-background h-8 font-mono text-xs text-center" 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Resistances & Immunities */}
            <div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Resistances Granted</label>
                <Input value={resistances} onChange={e => setResistances(e.target.value)} placeholder="e.g. Fire, Pierce" className="bg-background" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Immunities Granted</label>
                <Input value={immunities} onChange={e => setImmunities(e.target.value)} placeholder="e.g. Poison, Stun" className="bg-background" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Description (Markdown Supported)</label>
              <Textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Write details... lists, bolding, and flavor paragraphs fully render." 
                className="min-h-[100px] bg-background font-serif" 
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-border/30 pt-4">
              <Button type="button" variant="ghost" onClick={() => setMode("list")}>Back</Button>
              <Button type="submit" className="bg-primary text-primary-foreground font-serif">
                {mode === "add" ? "Create Ability" : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
