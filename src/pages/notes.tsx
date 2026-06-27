import { useState } from "react";
import { useListNotes, useCreateNote, useDeleteNote, useUpdateNote, getListNotesQueryKey } from "@/hooks/useStorage";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Loader2, Trash2, Edit2 } from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = ["general", "location", "npc", "item", "lore"] as const;

export default function Notes() {
  const queryClient = useQueryClient();
  // We fetch global notes (characterId = 0 or unspecified)
  const { data: notes, isLoading } = useListNotes(0);
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const updateNote = useUpdateNote();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // New note form state
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCat, setNewCat] = useState<any>("general");

  // Edit note form state
  const [editId, setEditId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCat, setEditCat] = useState<any>("general");

  const filteredNotes = notes?.filter(n => activeCategory === "all" || n.category === activeCategory) || [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    createNote.mutate(
      { title: newTitle, content: newContent, category: newCat, tags: [], characterId: 0 },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
          setIsOpen(false);
          setNewTitle("");
          setNewContent("");
          setNewCat("general");
        }
      }
    );
  };

  const handleEditOpen = (note: any) => {
    setEditId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditCat(note.category);
    setIsEditOpen(true);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !editTitle.trim()) return;

    updateNote.mutate(
      {
        id: editId,
        data: { title: editTitle, content: editContent, category: editCat }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
          setIsEditOpen(false);
          setEditId(null);
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this note?")) {
      deleteNote.mutate(
        { id, charId: 0 },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
          }
        }
      );
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif text-primary mb-2">Campaign Notes</h1>
          <p className="text-muted-foreground font-serif italic">The living journal of your adventures.</p>
        </div>

        {/* New Note Dialog */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-serif font-bold">
              <Plus className="w-4 h-4 mr-2" /> New Note
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] bg-card border-border shadow-2xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-primary font-bold">Pen a new entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div>
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Entry Title" required className="font-serif text-lg bg-background border-border/50" />
              </div>
              <div>
                <Select value={newCat} onValueChange={setNewCat}>
                  <SelectTrigger className="bg-background border-border/50">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Write your thoughts..." className="min-h-[200px] font-serif bg-background border-border/50 leading-relaxed text-base resize-none" />
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" className="bg-primary text-primary-foreground font-serif">Save Entry</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Note Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[600px] bg-card border-border shadow-2xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-primary font-bold">Edit Note Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4 mt-4">
              <div>
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Entry Title" required className="font-serif text-lg bg-background border-border/50" />
              </div>
              <div>
                <Select value={editCat} onValueChange={setEditCat}>
                  <SelectTrigger className="bg-background border-border/50">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Write your thoughts..." className="min-h-[200px] font-serif bg-background border-border/50 leading-relaxed text-base resize-none" />
              </div>
              <div className="flex justify-end pt-4 gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-primary text-primary-foreground font-serif">Update Entry</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 border-b border-border/50 pb-4 overflow-x-auto">
        <Button variant="ghost" onClick={() => setActiveCategory("all")} className={`rounded-none border-b-2 font-serif ${activeCategory === "all" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          All Entries
        </Button>
        {CATEGORIES.map(c => (
          <Button key={c} variant="ghost" onClick={() => setActiveCategory(c)} className={`rounded-none border-b-2 uppercase tracking-wider text-xs font-serif ${activeCategory === c ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {c}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filteredNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredNotes.map(note => (
            <Card key={note.id} className="bg-card border border-border/50 hover:border-primary/30 transition-colors shadow-sm relative group overflow-hidden">
              {/* Card actions hover overlay */}
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleEditOpen(note)} className="h-8 w-8 text-primary hover:bg-primary/10">
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(note.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start pr-16">
                  <CardTitle className="font-serif text-xl text-primary leading-tight font-bold">{note.title}</CardTitle>
                </div>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="uppercase text-[10px] tracking-wider text-muted-foreground border-border/50">{note.category}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground font-serif leading-relaxed line-clamp-4 text-sm opacity-90 whitespace-pre-wrap">
                  {note.content}
                </p>
                <div className="mt-4 pt-4 border-t border-border/30 text-xs text-muted-foreground/50 font-mono text-right">
                  {format(new Date(note.createdAt), "MMM d, yyyy")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-card/30 rounded-lg border border-dashed border-border/50">
          <BookOpen className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-xl font-serif text-foreground mb-2 italic">The pages are blank.</h3>
          <p className="text-muted-foreground mb-6">No entries found for this category.</p>
        </div>
      )}
    </div>
  );
}