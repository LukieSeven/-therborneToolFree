import { useState } from "react";
import { useListSkills, useAddSkill, useUpdateSkill, useDeleteSkill } from "@/hooks/useStorage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2 } from "lucide-react";

interface Props {
  characterId: number;
}

export function EditSkillsDialog({ characterId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: skills } = useListSkills(characterId);
  const addSkill = useAddSkill();
  const updateSkill = useUpdateSkill();
  const deleteSkill = useDeleteSkill();

  // Mode: 'list' | 'add' | 'edit'
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [value, setValue] = useState(1);

  const resetForm = () => {
    setName("");
    setValue(1);
    setEditingId(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setMode("add");
  };

  const handleOpenEdit = (skill: any) => {
    setEditingId(skill.id);
    setName(skill.name);
    setValue(skill.value);
    setMode("edit");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (mode === "add") {
      addSkill.mutate({
        characterId,
        name,
        value,
        training: 0,
      }, {
        onSuccess: () => setMode("list"),
      });
    } else if (mode === "edit" && editingId) {
      updateSkill.mutate({
        id: editingId,
        data: {
          name,
          value,
        },
      }, {
        onSuccess: () => setMode("list"),
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this custom skill?")) {
      deleteSkill.mutate({ id, charId: characterId });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) setMode("list"); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 font-serif text-sm">
          Edit Skills
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[75vh] overflow-y-auto bg-card border-border shadow-2xl">
        <DialogHeader className="border-b border-border/30 pb-3 flex flex-row items-center justify-between">
          <DialogTitle className="font-serif text-2xl text-primary font-bold">
            {mode === "list" && "Custom Skills"}
            {mode === "add" && "Create Custom Skill"}
            {mode === "edit" && "Modify Custom Skill"}
          </DialogTitle>
          {mode === "list" && (
            <Button size="sm" onClick={handleOpenAdd} className="bg-primary text-primary-foreground font-serif">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Skill
            </Button>
          )}
        </DialogHeader>

        {mode === "list" ? (
          <div className="space-y-3 mt-4">
            {skills && skills.length > 0 ? (
              <div className="divide-y divide-border/40">
                {skills.map((skill) => (
                  <div key={skill.id} className="py-2.5 flex justify-between items-center group">
                    <div className="font-serif text-lg text-foreground font-semibold">
                      {skill.name} <span className="font-mono text-primary font-bold ml-2">-{skill.value}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(skill)} className="h-8 w-8 text-primary hover:bg-primary/10">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(skill.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground font-serif italic">
                No custom skills registered. Add skills like Beastial, Stealth, or Lore.
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 mt-4 text-sm font-sans">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Skill Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Beast Handling, Arcana" className="bg-background" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Starting Skill Value</label>
              <Input type="number" min={1} max={30} value={value} onChange={e => setValue(Math.min(30, Math.max(1, Number(e.target.value))))} required className="bg-background font-mono" />
            </div>

            <div className="flex justify-end gap-2 border-t border-border/30 pt-4">
              <Button type="button" variant="ghost" onClick={() => setMode("list")}>Back</Button>
              <Button type="submit" className="bg-primary text-primary-foreground font-serif">
                {mode === "add" ? "Add Skill" : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
