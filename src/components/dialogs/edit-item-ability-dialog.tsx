import React, { useState, useEffect } from "react";
import { useAddAbility, useUpdateAbility } from "@/hooks/useStorage";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Ability } from "@/lib/storage";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: number;
  equipmentId: number | null;
  initialData: Ability | null;
}

export function EditItemAbilityDialog({ isOpen, onOpenChange, characterId, equipmentId, initialData }: Props) {
  const addAbility = useAddAbility();
  const updateAbility = useUpdateAbility();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [range, setRange] = useState("Self");
  const [speed, setSpeed] = useState("Instant");
  const [rollFormula, setRollFormula] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name || "");
        setDescription(initialData.description || "");
        setCost(initialData.cost || 0);
        setCooldown(initialData.cooldown || 0);
        setRange(initialData.range || "Self");
        setSpeed(initialData.speed || "Instant");
        setRollFormula(initialData.rollFormula || "");
      } else {
        setName("");
        setDescription("");
        setCost(0);
        setCooldown(0);
        setRange("Self");
        setSpeed("Instant");
        setRollFormula("");
      }
    }
  }, [isOpen, initialData]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (initialData) {
      // Edit mode
      updateAbility.mutate({
        id: initialData.id,
        data: {
          name,
          description,
          cost,
          cooldown,
          range,
          speed,
          rollFormula,
        }
      }, {
        onSuccess: () => {
          toast.success("Item ability updated.");
          onOpenChange(false);
        }
      });
    } else {
      // Add mode
      if (equipmentId === null) return;
      addAbility.mutate({
        characterId,
        equipmentId,
        name,
        description,
        cost,
        cooldown,
        range,
        speed,
        rollFormula,
        linkedStats: [],
        assignedToQuickRolls: false,
        level: 1,
        active: false,
      }, {
        onSuccess: () => {
          toast.success("Item ability added.");
          onOpenChange(false);
        }
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl">
        <DialogHeader className="border-b border-border/30 pb-2">
          <DialogTitle className="font-serif text-2xl text-primary font-bold">
            {initialData ? "Edit Item Ability" : "Add Item Ability"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-3 font-sans">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Ability Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Cleave, Fireball" className="bg-background font-serif" />
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Description / Effects</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the effects of this ability..." className="bg-background font-serif min-h-[80px]" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Mana Cost (MP)</label>
              <Input type="number" min={0} value={cost} onChange={e => setCost(Number(e.target.value))} required className="bg-background font-mono" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Cooldown (Turns)</label>
              <Input type="number" min={0} value={cooldown} onChange={e => setCooldown(Number(e.target.value))} required className="bg-background font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Range</label>
              <Input value={range} onChange={e => setRange(e.target.value)} required placeholder="e.g. 5 ft, Self" className="bg-background font-serif" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Speed</label>
              <Input value={speed} onChange={e => setSpeed(e.target.value)} required placeholder="e.g. Instant, 1 action" className="bg-background font-serif" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Roll Formula / Modifier (Optional)</label>
            <Input value={rollFormula} onChange={e => setRollFormula(e.target.value)} placeholder="e.g. d20+powr+6, 2d6+prer" className="bg-background font-mono" />
          </div>

          <div className="flex justify-end gap-2 border-t border-border/30 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="bg-primary text-primary-foreground font-serif">
              Save Ability
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
