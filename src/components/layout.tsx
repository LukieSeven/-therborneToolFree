import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Users, ScrollText, Dice5 } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Dice5 },
    { href: "/characters", label: "Characters", icon: Users },
    { href: "/notes", label: "Campaign Notes", icon: BookOpen },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
      <aside className="w-64 flex-shrink-0 border-r border-border bg-card/50 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <ScrollText className="w-6 h-6 text-primary mr-3" />
          <h1 className="font-serif text-xl font-bold tracking-wide text-foreground">
            Mythos
          </h1>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                <item.icon className={`w-4 h-4 mr-3 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground font-mono text-center opacity-50">
            v0.1.0 • Campfire
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Subtle noise/texture overlay could go here */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay" 
             style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}>
        </div>
        
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}