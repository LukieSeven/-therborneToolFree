import { useState } from "react";
import { useListAbilities, useAddAbility, useUpdateAbility, useDeleteAbility } from "@/hooks/useStorage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit2, ShieldAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  characterId: number;
}

const STAT_OPTIONS = ["power", "vitality", "spirit", "agility", "endurance", "precision", "willpower", "charisma"];

export function EditAbilitiesDialog({ characterId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: abilities } = useListAbilities(characterId);
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
  const [linkedStat, setLinkedStat] = useState("power");
  const [assignedToQuickRolls, setAssignedToQuickRolls] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setCost(0);
    setCooldown(0);
    setRange("");
    setSpeed("");
    setRollFormula("");
    setLinkedStat("power");
    setAssignedToQuickRolls(false);
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
    setLinkedStat(ability.linkedStat);
    setAssignedToQuickRolls(ability.assignedToQuickRolls);
    setMode("edit");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (mode === "add") {
      addAbility.mutate({
        characterId,
        name,
        description,
        cost,
        cooldown,
        range,
        speed,
        rollFormula,
        linkedStat,
        assignedToQuickRolls,
      }, {
        onSuccess: () => setMode("list"),
      });
    } else if (mode === "edit" && editingId) {
      updateAbility.mutate({
        id: editingId,
        data: {
          name,
          description,
          cost,
          cooldown,
          range,
          speed,
          rollFormula,
          linkedStat,
          assignedToQuickRolls,
        },
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
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Linked Attribute (for Roll modifier)</label>
                <select 
                  value={linkedStat} 
                  onChange={e => setLinkedStat(e.target.value)} 
                  className="w-full h-9 rounded-md border border-border/60 bg-background px-3 py-1 text-sm shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {STAT_OPTIONS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                </select>
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
                <Input value={rollFormula} onChange={e => setRollFormula(e.target.value)} placeholder="e.g. 2d6, d8+2" className="bg-background font-mono" />
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
