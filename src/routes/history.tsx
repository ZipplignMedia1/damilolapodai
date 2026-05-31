import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, Download, Trash2, Video, Image as ImageIcon, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getImages,
  removeImage,
  getStoryboards,
  removeStoryboard,
  getVideos,
  removeVideo,
  type ImageItem,
  type StoryboardItem,
  type VideoItem,
} from "@/lib/library";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Saved Projects — DAMILOLAPOD AI" },
      { name: "description", content: "Your generated images, videos, and storyboards." },
    ],
  }),
  component: HistoryPage,
});

type Tab = "videos" | "images" | "storyboards";

function HistoryPage() {
  const [tab, setTab] = useState<Tab>("videos");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [storyboards, setStoryboards] = useState<StoryboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [v, i, s] = await Promise.all([getVideos(), getImages(), getStoryboards()]);
    setVideos(v);
    setImages(i);
    setStoryboards(s);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function delVideo(id: string) {
    await removeVideo(id);
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }
  async function delImage(id: string) {
    await removeImage(id);
    setImages((prev) => prev.filter((v) => v.id !== id));
  }
  async function delStory(id: string) {
    await removeStoryboard(id);
    setStoryboards((prev) => prev.filter((v) => v.id !== id));
  }

  const counts = { videos: videos.length, images: images.length, storyboards: storyboards.length };
  const total = counts.videos + counts.images + counts.storyboards;

  if (loading) {
    return <p className="py-20 text-center text-sm text-muted-foreground">Loading your library…</p>;
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Clock className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-lg font-bold">Nothing here yet</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs">Your generations will appear here.</p>
        <Link to="/" className="mt-6">
          <Button className="rounded-xl">Open Studio</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Saved Projects</h2>

      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted p-1">
        <TabBtn active={tab === "videos"} onClick={() => setTab("videos")} icon={<Video className="h-3.5 w-3.5" />}>
          Videos · {counts.videos}
        </TabBtn>
        <TabBtn active={tab === "images"} onClick={() => setTab("images")} icon={<ImageIcon className="h-3.5 w-3.5" />}>
          Images · {counts.images}
        </TabBtn>
        <TabBtn active={tab === "storyboards"} onClick={() => setTab("storyboards")} icon={<Layers className="h-3.5 w-3.5" />}>
          Boards · {counts.storyboards}
        </TabBtn>
      </div>

      {tab === "videos" && (
        <div className="space-y-3">
          {videos.length === 0 ? (
            <EmptyMini label="No videos yet" />
          ) : (
            videos.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <video src={item.videoUrl} controls playsInline poster={item.thumbnail} className="w-full bg-black aspect-video object-contain" />
                <div className="p-4">
                  <div className="flex items-center gap-2 text-[11px]">
                    {item.mode && <span className="rounded-full bg-primary-soft px-2 py-0.5 font-semibold text-primary uppercase">{item.mode}</span>}
                    <span className="text-muted-foreground">{item.aspectRatio ?? ""} {item.duration ? `· ${item.duration}s` : ""}</span>
                    <span className="ml-auto text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm line-clamp-2">{item.prompt}</p>
                  <div className="mt-3 flex gap-2">
                    <a href={item.videoUrl} download={`video-${item.id}.mp4`} className="flex-1">
                      <Button variant="outline" className="w-full rounded-lg"><Download className="h-4 w-4" /> Download</Button>
                    </a>
                    <Button variant="outline" onClick={() => delVideo(item.id)} className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "images" && (
        <div className="grid grid-cols-2 gap-3">
          {images.length === 0 ? (
            <div className="col-span-2"><EmptyMini label="No images yet" /></div>
          ) : (
            images.map((it) => (
              <div key={it.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <img src={it.dataUrl} alt={it.prompt} className="w-full aspect-square object-cover" />
                <div className="p-3">
                  <p className="text-xs line-clamp-2">{it.prompt}</p>
                  <div className="mt-2 flex gap-1.5">
                    <a href={it.dataUrl} download={`image-${it.id}.png`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full rounded-lg"><Download className="h-3.5 w-3.5" /></Button>
                    </a>
                    <Button variant="outline" size="sm" onClick={() => delImage(it.id)} className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "storyboards" && (
        <div className="space-y-3">
          {storyboards.length === 0 ? (
            <EmptyMini label="No storyboards yet" />
          ) : (
            storyboards.map((sb) => (
              <div key={sb.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold">{sb.story_title}</h3>
                    <p className="text-[11px] text-muted-foreground">{sb.scenes.length} scenes · {new Date(sb.createdAt).toLocaleString()}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => delStory(sb.id)} className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {sb.scenes.map((s) => (
                    <div key={s.scene_number} className="rounded-lg bg-muted p-2 text-[10px]">
                      <div className="font-bold">{s.scene_number}. {s.title}</div>
                      <div className="mt-1 line-clamp-3 text-muted-foreground">{s.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${active ? "bg-background shadow-sm" : "text-muted-foreground"}`}
    >
      {icon} {children}
    </button>
  );
}

function EmptyMini({ label }: { label: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{label}</p>;
}
