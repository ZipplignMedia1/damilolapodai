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
import { Home, Image as ImageIcon, Video, Layers, Clock } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
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
      { title: "DAMILOLAPOD AI — Create videos with AI" },
      { name: "description", content: "Generate stunning videos from text or images using AI." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
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
    { to: "/", label: "Home", Icon: Home },
    { to: "/image", label: "Image", Icon: ImageIcon },
    { to: "/video", label: "Video", Icon: Video },
    { to: "/storyboard", label: "Board", Icon: Layers },
    { to: "/history", label: "Saved", Icon: Clock },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-screen-md items-center justify-around px-6 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        {items.map(({ to, label, Icon }) => {
          const active = pathname === to;
          return (
            <Link key={to} to={to} className={`flex flex-col items-center gap-1 text-xs font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="h-6 w-6" strokeWidth={active ? 2.25 : 1.75} />
              {label}
            </Link>
          );
        })}
      </div>
      <div className="mx-auto h-1 w-32 rounded-full bg-foreground/30 mb-1" />
    </nav>
  );
}

function Header() {
  return (
    <header className="mx-auto flex max-w-screen-md items-center gap-3 px-5 pt-6 pb-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Video className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-xl font-bold tracking-tight">DAMILOLAPOD AI</h1>
        <p className="text-sm text-muted-foreground">Create videos with AI</p>
      </div>
    </header>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background pb-28">
        <Header />
        <div className="border-t border-border" />
        <main className="mx-auto max-w-screen-md px-4 pt-4">
          <Outlet />
        </main>
        <BottomNav />
        <Toaster position="top-center" />
      </div>
    </QueryClientProvider>
  );
}
