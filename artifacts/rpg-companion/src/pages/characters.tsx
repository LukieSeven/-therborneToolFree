import { useListCharacters } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Shield, Zap } from "lucide-react";
import { Link } from "wouter";

export default function Characters() {
  const { data: characters, isLoading } = useListCharacters();

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif text-primary mb-2">The Party</h1>
          <p className="text-muted-foreground">Manage your heroes and view their current state.</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> New Character
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <Card key={i} className="animate-pulse bg-card/50 h-32"></Card>
          ))}
        </div>
      ) : characters && characters.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map(char => (
            <Link key={char.id} href={`/characters/${char.id}`}>
              <Card className="hover:border-primary/50 transition-all cursor-pointer group bg-card border-border/50 hover:shadow-lg hover:shadow-primary/5">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-serif font-bold text-foreground group-hover:text-primary transition-colors">
                        {char.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Level {char.level} {char.race} {char.className}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/50">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground uppercase flex items-center justify-center gap-1 mb-1">
                        HP
                      </div>
                      <div className="font-mono font-bold text-foreground">
                        {char.currentHp}/{char.maxHp}
                      </div>
                    </div>
                    <div className="text-center border-l border-border/50">
                      <div className="text-xs text-muted-foreground uppercase flex items-center justify-center gap-1 mb-1">
                        <Shield className="w-3 h-3" /> AC
                      </div>
                      <div className="font-mono font-bold text-foreground">
                        {char.armorClass}
                      </div>
                    </div>
                    <div className="text-center border-l border-border/50">
                      <div className="text-xs text-muted-foreground uppercase flex items-center justify-center gap-1 mb-1">
                        <Zap className="w-3 h-3" /> SPD
                      </div>
                      <div className="font-mono font-bold text-foreground">
                        {char.speed}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-card/30 rounded-lg border border-dashed border-border">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-serif text-foreground mb-2">No characters found</h3>
          <p className="text-muted-foreground mb-6">Create your first character to begin the adventure.</p>
          <Button className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Roll a Character
          </Button>
        </div>
      )}
    </div>
  );
}