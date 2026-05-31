import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useLocation,
} from "@tanstack/react-router";
import { Home, Library, Plus, User } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { CreditBadge } from "@/components/CreditBadge";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#1a0d0d" },
      { title: "DAMILOLAPOD AI — Create videos with AI" },
      { name: "description", content: "Generate stunning videos from text or images using AI." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function BottomNav() {
  const { pathname } = useLocation();
  const items = [
    { to: "/home", label: "Home", Icon: Home },
    { to: "/history", label: "Library", Icon: Library },
    { to: "/image", label: "Create", Icon: Plus },
    { to: "/profile", label: "Profile", Icon: User },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40">
      <div className="mx-auto max-w-screen-md px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="flex items-center justify-around rounded-2xl border border-border bg-card px-2 py-2">
          {items.map(({ to, label, Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold transition ${active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.75} />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function Header() {
  return (
    <header className="mx-auto flex max-w-screen-md items-center justify-between gap-3 px-5 pt-6 pb-4">
      <div className="flex items-center gap-2.5">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <span className="font-display text-lg font-extrabold">D</span>
        </div>
        <div className="leading-tight">
          <h1 className="font-display text-base font-extrabold tracking-tight">DAMILOLAPOD AI</h1>
          <p className="text-[11px] text-muted-foreground">Your creative studio</p>
        </div>
      </div>
      <CreditBadge />
    </header>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { pathname } = useLocation();
  const isChromeHidden = pathname === "/" || pathname === "/login";

  return (
    <QueryClientProvider client={queryClient}>
      <div className="relative min-h-screen bg-background">
        <div className="relative">
          {!isChromeHidden && <Header />}
          <main className={isChromeHidden ? "" : "mx-auto max-w-screen-md px-4 pt-2 pb-28"}>
            <Outlet />
          </main>
        </div>
        {!isChromeHidden && <BottomNav />}
        <Toaster position="top-center" />
      </div>
    </QueryClientProvider>
  );
}
