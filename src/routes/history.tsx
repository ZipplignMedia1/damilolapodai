import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, Download, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getHistory, removeFromHistory, type HistoryItem } from "@/lib/history";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — DAMILOLAPOD AI" },
      { name: "description", content: "Your previously generated AI videos." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => { setItems(getHistory()); }, []);

  function handleDelete(id: string) {
    removeFromHistory(id);
    setItems(getHistory());
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Clock className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-lg font-bold">No videos yet</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs">Generated videos will appear here. Create your first one!</p>
        <Link to="/" className="mt-6">
          <Button className="rounded-xl"><Video className="h-4 w-4" /> Create Video</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">History</h2>
      {items.map(item => (
        <div key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <video
            src={item.videoUrl}
            controls
            playsInline
            poster={item.thumbnail}
            className="w-full bg-black aspect-video object-contain"
          />
          <div className="p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary uppercase">{item.mode === "text" ? "Text" : "Image"}</span>
              <span className="text-[11px] text-muted-foreground">{item.aspectRatio} · {item.duration}s</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm line-clamp-2">{item.prompt}</p>
            <div className="mt-3 flex gap-2">
              <a href={item.videoUrl} download={`video-${item.id}.mp4`} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button variant="outline" className="w-full rounded-lg"><Download className="h-4 w-4" /> Download</Button>
              </a>
              <Button variant="outline" onClick={() => handleDelete(item.id)} className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
