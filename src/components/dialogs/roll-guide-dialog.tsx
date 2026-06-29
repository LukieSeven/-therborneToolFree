import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, BookOpen } from "lucide-react";

export function RollGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-primary/40 text-primary hover:bg-primary/10 rounded-md cursor-pointer text-xs font-serif">
          <HelpCircle className="w-3.5 h-3.5 mr-1" /> Roll Guide
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-md p-6">
        <DialogHeader className="border-b border-border/20 pb-2">
          <DialogTitle className="font-serif text-lg text-primary font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> AEtherborne Roll Guide
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4 text-xs text-muted-foreground leading-relaxed font-sans">
          <div>
            <h4 className="font-bold text-foreground mb-1 uppercase tracking-wider text-[10px]">1. Basic Dice Notation</h4>
            <p>Use standard dice values like <code className="text-primary font-mono font-bold bg-background px-1 py-0.5 rounded">d20</code>, <code className="text-primary font-mono font-bold bg-background px-1 py-0.5 rounded">2d6</code>, or <code className="text-primary font-mono font-bold bg-background px-1 py-0.5 rounded">d8+3</code>.</p>
          </div>
          
          <div>
            <h4 className="font-bold text-foreground mb-1 uppercase tracking-wider text-[10px]">2. Stat Rolls vs. Base Stats</h4>
            <ul className="list-disc pl-4 space-y-1 mt-1">
              <li>Add <code className="text-primary font-mono font-bold bg-background px-1 py-0.5 rounded">r</code> to roll a stat's mapped dice. For example, if Willpower is 12 (uses a <code className="text-mono">d12</code> die), <code className="text-primary font-mono font-bold bg-background px-1 py-0.5 rounded">wilr</code> rolls a d12.</li>
              <li>Use the raw prefix (no <code className="text-mono">r</code>) to add the static base stat value. For example, <code className="text-primary font-mono font-bold bg-background px-1 py-0.5 rounded">wil</code> adds exactly 12.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-1 uppercase tracking-wider text-[10px]">3. Attribute Prefixes</h4>
            <p>Use the first 3 letters of any stat (case-insensitive):</p>
            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-center font-bold text-foreground mt-1.5">
              <span className="bg-background/50 border border-border/30 p-1 rounded">POW / POWr</span>
              <span className="bg-background/50 border border-border/30 p-1 rounded">VIT / VITr</span>
              <span className="bg-background/50 border border-border/30 p-1 rounded">AGI / AGIr</span>
              <span className="bg-background/50 border border-border/30 p-1 rounded">END / ENDr</span>
              <span className="bg-background/50 border border-border/30 p-1 rounded">SPI / SPIr</span>
              <span className="bg-background/50 border border-border/30 p-1 rounded">PRE / PREr</span>
              <span className="bg-background/50 border border-border/30 p-1 rounded">WIL / WILr</span>
              <span className="bg-background/50 border border-border/30 p-1 rounded">CHA / CHAr</span>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-1 uppercase tracking-wider text-[10px]">4. Multi-Stat Ability Shorthand (STAT)</h4>
            <p>If an ability is linked to multiple attributes (e.g. POW and WIL), you can write <code className="text-primary font-mono font-bold bg-background px-1 py-0.5 rounded">STAT</code> or <code className="text-primary font-mono font-bold bg-background px-1 py-0.5 rounded">STATr</code> in the formula:</p>
            <ul className="list-disc pl-4 space-y-1 mt-1">
              <li><code className="text-primary font-mono font-bold bg-background px-1 py-0.5 rounded">STATr * 3</code> will dynamically roll whichever attribute you select when executing the roll.</li>
              <li>Example: Clicking <code className="text-mono">Roll (POW)</code> automatically replaces the formula with <code className="text-mono">POWr * 3</code>.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-1 uppercase tracking-wider text-[10px]">5. DM-Style Formulas</h4>
            <p>You can write formulas starting with names (e.g., <code className="text-foreground font-mono bg-background px-1 py-0.5 rounded">Health Pool = (VIT * 5) + (END * 2)</code>). The parser automatically strips everything before the <code className="text-foreground font-mono font-bold">=</code>. It also translates the DM's multiplication symbols <code className="text-foreground font-mono font-bold">×</code> and <code className="text-foreground font-mono font-bold">x</code> to standard asterisks <code className="text-foreground font-mono font-bold">*</code>.</p>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-1 uppercase tracking-wider text-[10px]">6. Basic Math Operators</h4>
            <p>All standard math operators <code className="text-foreground font-mono font-bold">+</code>, <code className="text-foreground font-mono font-bold">-</code>, <code className="text-foreground font-mono font-bold">*</code>, <code className="text-foreground font-mono font-bold">/</code>, and parentheses <code className="text-foreground font-mono font-bold">()</code> are supported inside formulas.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
