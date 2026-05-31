import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/credits.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CreditBadge() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
      setEmail(session?.user?.email ?? null);
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    });
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setEmail(data.session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, [qc]);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
    enabled: authed === true,
    staleTime: 10_000,
  });

  if (authed === null) return null;
  if (!authed) {
    return (
      <Link to="/login" className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent">
        Sign in
      </Link>
    );
  }

  const credits = profile?.credits ?? 0;
  const initial = (profile?.display_name || email || "U").charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <div
        title={`${credits} credits remaining`}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-bold"
      >
        <Coins className="h-3.5 w-3.5 text-primary" />
        <span>{credits}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            initial
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="font-semibold">{profile?.display_name || "Account"}</div>
            <div className="text-xs text-muted-foreground truncate">{email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-xs">
            <Coins className="h-3.5 w-3.5 mr-2" /> {credits} credits
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="text-xs">
            <User className="h-3.5 w-3.5 mr-2" /> Top-ups coming soon
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              await supabase.auth.signOut();
            }}
            className="text-xs"
          >
            <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
