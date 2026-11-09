import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Camera, ImagePlus, Images, Maximize2, X } from "lucide-react";
import {
  GALLERY_ORIGINAL_MAX_BYTES,
  GALLERY_THUMB_MAX_BYTES,
  GALLERY_THUMB_MAX_DIMENSION,
  type GalleryLeague,
  type GalleryPage,
  type GalleryPhoto,
} from "../lib/gallery.ts";
import { adminToken } from "./api";
import { badmintonApiBase, badmintonToken } from "./badminton-api";
import footballLogo from "./assets/g-super-league-logo-640.png";
import badmintonLogo from "./assets/gb-league-logo-640.png";
import "./gallery.css";

const leagues = {
  football: { name: "G超桌足联赛", sport: "桌上足球", logo: footballLogo },
  badminton: { name: "GB 羽毛球联赛", sport: "羽毛球", logo: badmintonLogo },
};
const maxBatch = 6;
const albumUrl = (league: GalleryLeague) => `${badmintonApiBase}/api/gallery/${league}`;
const photoUrl = (league: GalleryLeague, photo: GalleryPhoto) => `${albumUrl(league)}/${photo.id}`;
const thumbnailUrl = (league: GalleryLeague, photo: GalleryPhoto) => `${photoUrl(league, photo)}/thumbnail`;
const formatDate = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Shanghai",
});

async function request(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, credentials: "omit" });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || "图库暂时无法连接，请稍后重试");
  }
  return response;
}

async function makeThumbnail(file: File): Promise<Blob> {
  if (file.size > GALLERY_ORIGINAL_MAX_BYTES) throw new Error("原图超过 8 MB，请换一张试试");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error("无法打开这张照片，请试试 JPG、PNG 或 WebP 格式");
    });
    const scale = Math.min(1, GALLERY_THUMB_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("此浏览器暂时无法处理照片");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.88, 0.76, 0.64, 0.52, 0.4, 0.3]) {
      const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (jpeg?.type === "image/jpeg" && jpeg.size <= GALLERY_THUMB_MAX_BYTES) return jpeg;
    }
    throw new Error("缩略图生成失败，请换一张试试");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function UploadDialog({ league, close, published }: {
  league: GalleryLeague;
  close: () => void;
  published: (league: GalleryLeague, count: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef<AbortController | null>(null);
  const [target, setTarget] = useState(league);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    return () => active.current?.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0 || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const failed: File[] = [];
    let detail = "";
    setError("");
    for (let i = 0; i < files.length; i++) {
      setProgress(i + 1);
      try {
        const body = new FormData();
        body.set("thumbnail", await makeThumbnail(files[i]), "thumbnail.jpg");
        body.set("original", files[i]);
        const response = await request(albumUrl(target), {
          method: "POST", body, signal: controller.signal,
        });
        const photo = await response.json() as GalleryPhoto;
        if (!photo.id) throw new Error("服务器未确认照片已保存，请重试");
      } catch (e) {
        if (controller.signal.aborted) return;
        failed.push(files[i]);
        if (!detail) detail = e instanceof Error ? e.message : "上传失败，请重试";
      }
    }
    active.current = null;
    const saved = files.length - failed.length;
    setProgress(null);
    setFiles(failed);
    if (saved) published(target, saved);
    if (!failed.length) dialog.current?.close();
    else setError(`${failed.length} 张照片待重试。${detail}`);
  }

  return (
    <dialog ref={dialog} className="gallery-dialog" aria-labelledby="gallery-upload-title"
      onClose={close} onCancel={(event) => { if (progress !== null) event.preventDefault(); }}>
      <form onSubmit={submit} className="gallery-upload-form">
        <div className="gallery-dialog-heading">
          <div><span className="gallery-eyebrow">SHARE A PHOTO</span><h2 id="gallery-upload-title">上传照片</h2></div>
          <button type="button" className="gallery-icon-button" aria-label="关闭上传"
            disabled={progress !== null} onClick={() => dialog.current?.close()}><X size={21} /></button>
        </div>
        <label className="gallery-field">所属联赛
          <select value={target} disabled={progress !== null}
            onChange={(event) => setTarget(event.target.value === "badminton" ? "badminton" : "football")}>
            <option value="football">G超桌足联赛</option>
            <option value="badminton">GB 羽毛球联赛</option>
          </select>
        </label>
        <label className="gallery-field">选择照片
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={progress !== null}
            onChange={(event) => {
              const chosen = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (!chosen.length) return;
              if (chosen.length > maxBatch) {
                setFiles([]);
                setError(`一次最多选择 ${maxBatch} 张照片`);
              } else {
                setFiles(chosen);
                setError("");
              }
            }} />
        </label>
        {files.length > 0 && <ul className="gallery-file-list" aria-label="已选照片">
          {files.map((file, i) => <li key={i}>{file.name}</li>)}
        </ul>}
        <p className="gallery-hint">一次最多 {maxBatch} 张，单张原图最多 8 MB。照片会公开显示在选定的图库中。</p>
        {error && <p className="gallery-error" role="alert">{error}</p>}
        <button className="gallery-primary" type="submit" disabled={!files.length || progress !== null}>
          <ImagePlus size={18} />{progress === null ? "上传到图库" : `正在上传 ${progress} / ${files.length}`}
        </button>
      </form>
    </dialog>
  );
}

function PhotoDialog({ league, photo, close, removed }: {
  league: GalleryLeague; photo: GalleryPhoto; close: () => void; removed: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading");
  const token = adminToken() || badmintonToken();
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); }, []);
  async function remove() {
    if (!token || deleting || !window.confirm("删除这张照片？")) return;
    setDeleting(true);
    setError("");
    try {
      await request(photoUrl(league, photo), { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      removed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败，请重试");
      setDeleting(false);
    }
  }
  return (
    <dialog ref={dialog} className="gallery-dialog gallery-photo-dialog" aria-label="照片大图" onClose={close}
      onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="gallery-photo-body">
        <div className="gallery-dialog-heading">
          <b>{leagues[league].name}</b>
          <button className="gallery-icon-button" aria-label="关闭照片" onClick={() => dialog.current?.close()}><X size={21} /></button>
        </div>
        <div className="gallery-photo-stage">
          {imageState !== "ready" && <img src={thumbnailUrl(league, photo)} alt="" />}
          {imageState !== "error" && <img src={photoUrl(league, photo)} alt={`${leagues[league].name}照片`}
            className={imageState === "loading" ? "gallery-original-pending" : undefined}
            onLoad={() => setImageState("ready")} onError={() => setImageState("error")} />}
        </div>
        {imageState === "loading" && <p className="gallery-hint" role="status">正在加载大图…</p>}
        {imageState === "error" && <p className="gallery-error" role="alert">大图加载失败，请关闭后重新打开。</p>}
        <footer><time dateTime={new Date(photo.createdAt).toISOString()}>{formatDate.format(photo.createdAt)}上传</time>
          {token && <button className="gallery-delete" onClick={() => void remove()} disabled={deleting}>删除照片</button>}
        </footer>
        {error && <p className="gallery-error" role="alert">{error}</p>}
      </div>
    </dialog>
  );
}

function Album({ league, upload }: { league: GalleryLeague; upload: () => void }) {
  const controller = useRef<AbortController | null>(null);
  const [page, setPage] = useState<GalleryPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GalleryPhoto | null>(null);
  async function load(before?: string) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setError("");
    setLoading(true);
    try {
      const url = albumUrl(league) + (before ? `?before=${encodeURIComponent(before)}` : "");
      const response = await request(url, { signal: current.signal });
      const next = await response.json() as GalleryPage;
      if (!current.signal.aborted) setPage((old) => before && old
        ? { photos: [...old.photos, ...next.photos], next: next.next }
        : next);
    } catch (e) {
      if (!current.signal.aborted) setError(e instanceof Error ? e.message : "图库加载失败");
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [league]);
  return (
    <section aria-label={`${leagues[league].name}图库`} aria-busy={loading}>
      {error && <div className="gallery-load-error" role="alert"><p>{error}</p>
        <button className="gallery-secondary" onClick={() => void load(page?.next ?? undefined)}>重试</button>
      </div>}
      {!page && !error && <p className="gallery-state" role="status">正在加载照片…</p>}
      {page?.photos.length === 0 && <div className="gallery-empty">
        <span className="gallery-empty-icon"><Camera size={32} strokeWidth={1.5} /></span>
        <h2>这个图库还没有照片</h2>
        <p>分享一张比赛现场或联赛合影。</p>
        <button className="gallery-secondary" onClick={upload}><ImagePlus size={17} /> 上传第一张照片</button>
      </div>}
      {page && page.photos.length > 0 && <div className="gallery-grid">
        {page.photos.map((photo) => <figure key={photo.id} className="gallery-card">
          <button aria-label={`查看 ${formatDate.format(photo.createdAt)}上传的照片`} onClick={() => setSelected(photo)}>
            <img src={thumbnailUrl(league, photo)} alt={`${leagues[league].name}照片`} loading="lazy" decoding="async" />
            <span className="gallery-enlarge"><Maximize2 size={16} /></span>
          </button>
          <figcaption><time dateTime={new Date(photo.createdAt).toISOString()}>{formatDate.format(photo.createdAt)}</time></figcaption>
        </figure>)}
      </div>}
      {page?.next && !error && <div className="gallery-more"><button className="gallery-secondary" disabled={loading}
        onClick={() => void load(page.next ?? undefined)}>{loading ? "正在加载…" : "加载更多照片"}</button></div>}
      {selected && <PhotoDialog league={league} photo={selected} close={() => setSelected(null)} removed={() => {
        setPage((old) => old && { ...old, photos: old.photos.filter((photo) => photo.id !== selected.id) });
        setSelected(null);
      }} />}
    </section>
  );
}

export default function Gallery({ league }: { league: GalleryLeague }) {
  const [uploading, setUploading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState("");
  const upload = () => setUploading(true);
  return (
    <div className="league-gallery">
      <header className="gair-header gallery-header">
        <a className="gair-wordmark" href="#home">
          <span className="gair-mark">G<span>★</span></span>
          <span><b>GAIR 超级联赛</b><small>ONE LEAGUE. MORE POSSIBILITIES.</small></span>
        </a>
        <a href="#home" className="gair-nav-link"><ArrowLeft size={16} /> 联赛首页</a>
      </header>
      <main className="gallery-main">
        <section className="gallery-hero">
          <div><span className="gallery-eyebrow"><Images size={15} /> GAIR / MATCHDAY GALLERY</span>
            <h1>联赛图库</h1>
            <p>收集球桌边和球场上的精彩瞬间。</p>
          </div>
          <button className="gallery-primary" onClick={upload}><ImagePlus size={20} /> 上传照片</button>
        </section>
        <nav className="gallery-albums" aria-label="选择联赛图库">
          {(Object.keys(leagues) as GalleryLeague[]).map((key) => <a key={key} href={`#gallery/${key}`}
            aria-current={league === key ? "page" : undefined}>
            <img src={leagues[key].logo} alt="" />
            <span><b>{leagues[key].name}</b><small>{leagues[key].sport} · 照片</small></span>
          </a>)}
        </nav>
        {notice && <p className="gallery-notice" role="status">{notice}</p>}
        <Album key={`${league}:${refresh}`} league={league} upload={upload} />
      </main>
      {uploading && <UploadDialog league={league} close={() => setUploading(false)} published={(target, count) => {
        setNotice(`已在${leagues[target].name}图库保存 ${count} 张照片。`);
        if (target !== league) window.location.hash = `#gallery/${target}`;
        setRefresh((version) => version + 1);
      }} />}
    </div>
  );
}
