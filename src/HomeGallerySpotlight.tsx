import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Images,
  Maximize2,
  Shuffle,
  Sparkles,
  X,
} from "lucide-react";
import {
  type GalleryLeague,
  type GalleryPage,
  type HomeGalleryItem,
} from "../lib/gallery.ts";
import {
  buildRandomOrder,
  getGalleryMemeAnalysis,
} from "../lib/gallery-memes.ts";
import { badmintonApiBase } from "./badminton-api";
import "./home-gallery-spotlight.css";

const AUTO_SWITCH_MS = 30_000;
const MAX_PAGES_PER_LEAGUE = 3;

const LEAGUE_META: Record<GalleryLeague, { name: string; tag: string }> = {
  football: { name: "G超桌足联赛", tag: "G超桌足" },
  badminton: { name: "GB 羽毛球联赛", tag: "GB羽毛球" },
};

const formatDate = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "Asia/Shanghai",
});

const albumUrl = (league: GalleryLeague) =>
  `${badmintonApiBase}/api/gallery/${league}`;

const photoUrl = (item: HomeGalleryItem) =>
  `${albumUrl(item.league)}/${item.id}`;

const thumbnailUrl = (item: HomeGalleryItem) =>
  `${photoUrl(item)}/thumbnail`;

function GeminiStarIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="gemini-star-icon"
    >
      <path
        d="M12 2C12.7 7.2 16.8 11.3 22 12C16.8 12.7 12.7 16.8 12 22C11.3 16.8 7.2 12.7 2 12C7.2 11.3 11.3 7.2 12 2Z"
        fill="url(#gemini-spark-grad)"
      />
      <defs>
        <linearGradient
          id="gemini-spark-grad"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#60A5FA" />
          <stop offset="0.52" stopColor="#A78BFA" />
          <stop offset="1" stopColor="#C5EF83" />
        </linearGradient>
      </defs>
    </svg>
  );
}

async function fetchLeaguePhotos(
  league: GalleryLeague,
  signal: AbortSignal,
): Promise<HomeGalleryItem[]> {
  const items: HomeGalleryItem[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES_PER_LEAGUE; page++) {
    const url =
      albumUrl(league) +
      (cursor ? `?before=${encodeURIComponent(cursor)}` : "");
    const response = await fetch(url, {
      signal,
      credentials: "omit",
      cache: "no-store",
    });
    if (!response.ok) break;
    const data = (await response.json()) as GalleryPage;
    if (!Array.isArray(data.photos)) break;
    for (const photo of data.photos) {
      if (photo?.id) items.push({ ...photo, league });
    }
    if (!data.next) break;
    cursor = data.next;
  }
  return items;
}

function SpotlightLightbox({
  item,
  onClose,
}: {
  item: HomeGalleryItem;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const meta = LEAGUE_META[item.league];
  const meme = getGalleryMemeAnalysis(item);

  useEffect(() => {
    setImageState("loading");
  }, [item.id, item.league]);

  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="home-spotlight-lightbox"
      aria-label="高清原图预览"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className="home-spotlight-lightbox-body">
        <header className="home-spotlight-lightbox-head">
          <div className="home-spotlight-lightbox-meta">
            <span className={`home-spotlight-pill is-${item.league}`}>
              <i />
              {meta.tag}
            </span>
            <b>{meme.title}</b>
            <time dateTime={new Date(item.createdAt).toISOString()}>
              {formatDate.format(item.createdAt)}
            </time>
          </div>
          <div className="home-spotlight-lightbox-actions">
            <a
              className="home-spotlight-jump"
              href={`#gallery/${item.league}`}
              onClick={() => dialogRef.current?.close()}
            >
              前往完整图库 <ArrowUpRight size={14} />
            </a>
            <button
              type="button"
              className="home-spotlight-close"
              aria-label="关闭大图"
              onClick={() => dialogRef.current?.close()}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="home-spotlight-lightbox-stage">
          {imageState !== "ready" && (
            <img
              src={thumbnailUrl(item)}
              alt=""
              className="home-spotlight-lightbox-thumb"
            />
          )}
          {imageState !== "error" && (
            <img
              key={`${item.league}:${item.id}`}
              src={photoUrl(item)}
              alt={`${meta.name}照片：${meme.title}`}
              className={
                imageState === "loading"
                  ? "home-spotlight-lightbox-original is-pending"
                  : "home-spotlight-lightbox-original"
              }
              onLoad={() => setImageState("ready")}
              onError={() => setImageState("error")}
            />
          )}
        </div>

        <footer className="home-spotlight-lightbox-foot">
          <span>
            {imageState === "loading"
              ? "正在加载高清原图…"
              : imageState === "error"
                ? "原图加载失败，当前展示缩略图"
                : meme.verdict}
          </span>
        </footer>
      </div>
    </dialog>
  );
}

export function HomeGallerySpotlight() {
  const [pool, setPool] = useState<HomeGalleryItem[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");
  const [remainingMs, setRemainingMs] = useState(AUTO_SWITCH_MS);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [transitionKey, setTransitionKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const loadAll = async () => {
      try {
        const [football, badminton] = await Promise.all([
          fetchLeaguePhotos("football", controller.signal).catch(() => []),
          fetchLeaguePhotos("badminton", controller.signal).catch(() => []),
        ]);
        if (controller.signal.aborted) return;
        const combined = [...football, ...badminton];
        if (combined.length === 0) {
          setPool([]);
          setOrder([]);
          setStatus("empty");
          return;
        }
        setPool(combined);
        setOrder(buildRandomOrder(combined.length));
        setCursor(0);
        setRemainingMs(AUTO_SWITCH_MS);
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) setStatus("empty");
      }
    };
    void loadAll();
    return () => controller.abort();
  }, []);

  const currentItem =
    status === "ready" && pool.length > 0 && order.length > 0
      ? pool[order[cursor % order.length]]
      : null;

  const advanceRandom = useCallback(() => {
    if (pool.length <= 1) {
      setRemainingMs(AUTO_SWITCH_MS);
      return;
    }
    const nextCursor = cursor + 1;
    if (nextCursor < order.length) {
      setCursor(nextCursor);
    } else {
      const currentPoolIndex = order[cursor % order.length];
      setOrder(buildRandomOrder(pool.length, currentPoolIndex));
      setCursor(0);
    }
    setRemainingMs(AUTO_SWITCH_MS);
    setTransitionKey((k) => k + 1);
  }, [cursor, order, pool.length]);

  // 30-second auto-switch countdown (pauses cleanly while lightbox is open)
  useEffect(() => {
    if (status !== "ready" || pool.length <= 1 || lightboxOpen) {
      return;
    }
    const tickMs = 100;
    const timer = window.setInterval(() => {
      setRemainingMs((prev) => Math.max(0, prev - tickMs));
    }, tickMs);
    return () => window.clearInterval(timer);
  }, [status, pool.length, lightboxOpen]);

  useEffect(() => {
    if (status === "ready" && pool.length > 1 && remainingMs <= 0) {
      advanceRandom();
    }
  }, [status, pool.length, remainingMs, advanceRandom]);

  // Preload next thumbnail in the shuffled queue so switching feels instant
  useEffect(() => {
    if (status !== "ready" || pool.length <= 1 || order.length <= 1) return;
    const nextItem = pool[order[(cursor + 1) % order.length]];
    if (!nextItem) return;
    const img = new Image();
    img.src = thumbnailUrl(nextItem);
  }, [status, pool, order, cursor]);

  const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const progressPercent = Math.min(
    100,
    Math.max(0, ((AUTO_SWITCH_MS - remainingMs) / AUTO_SWITCH_MS) * 100),
  );
  const meme = currentItem ? getGalleryMemeAnalysis(currentItem) : null;
  const meta = currentItem ? LEAGUE_META[currentItem.league] : null;

  return (
    <section
      className="home-spotlight"
      aria-label="赛场梗图精选与 Gemini 解读"
    >
      <header className="home-spotlight-head">
        <div>
          <span className="gair-eyebrow home-spotlight-eyebrow">
            <GeminiStarIcon size={14} /> MATCHDAY MEME THEATER · GEMINI 梗图解读
          </span>
          <h2>赛场名场面 · 随机盲盒</h2>
          <p>
            每次随机抽取一张图库名场面，搭配 Gemini 深度笑点解析；每 30 秒自动切下一张，点击图片立刻抽下一张。
          </p>
        </div>
        <div className="home-spotlight-controls">
          {status === "ready" && pool.length > 1 && (
            <button
              type="button"
              className="home-spotlight-ctrl is-accent"
              onClick={advanceRandom}
            >
              <Shuffle size={14} aria-hidden="true" /> 随机下一张
            </button>
          )}
          <a
            className="home-spotlight-all-link"
            href={`#gallery/${currentItem?.league ?? "football"}`}
          >
            全部图库
            {pool.length > 0 && (
              <span className="home-spotlight-count">{pool.length}</span>
            )}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      </header>

      {status === "loading" && (
        <div className="home-spotlight-skeleton" aria-busy="true">
          <div className="home-spotlight-skeleton-photo" />
          <div className="home-spotlight-skeleton-copy">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      )}

      {status === "empty" && (
        <div className="home-spotlight-empty">
          <Images size={24} aria-hidden="true" />
          <div>
            <b>联赛图库还没有照片</b>
            <span>前往图库上传赛场精彩瞬间，首页将随机展示并附上梗图解读。</span>
          </div>
          <a className="home-spotlight-all-link" href="#gallery/football">
            前往图库 <ArrowUpRight size={15} />
          </a>
        </div>
      )}

      {status === "ready" && currentItem && meme && meta && (
        <div className="home-spotlight-card">
          <div className="home-spotlight-progress" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>

          <div
            className="home-spotlight-grid"
            key={`${currentItem.id}-${transitionKey}`}
          >
            <div className="home-spotlight-media-wrap">
              <button
                type="button"
                className="home-spotlight-stage"
                onClick={advanceRandom}
                aria-label={`当前展示：${meme.title}。点击切换到随机下一张`}
              >
                <img
                  src={thumbnailUrl(currentItem)}
                  alt=""
                  aria-hidden="true"
                  className="home-spotlight-backdrop"
                />
                <img
                  src={thumbnailUrl(currentItem)}
                  alt={`${meta.name}：${meme.title}`}
                  className="home-spotlight-photo"
                  decoding="async"
                />
                <span
                  className={`home-spotlight-pill is-${currentItem.league}`}
                >
                  <i />
                  {meta.tag} · {formatDate.format(currentItem.createdAt)}
                </span>
                <span className="home-spotlight-tap-hint">
                  点击画面 · 随机切下一张
                </span>
              </button>

              <button
                type="button"
                className="home-spotlight-zoom-btn"
                aria-label="查看高清原图"
                title="查看高清原图"
                onClick={() => setLightboxOpen(true)}
              >
                <Maximize2 size={14} aria-hidden="true" /> 看原图
              </button>
            </div>

            <article
              className="home-spotlight-commentary"
              aria-label="Gemini 梗图解读"
            >
              <div className="gemini-badge-row">
                <span className="gemini-badge">
                  <GeminiStarIcon size={15} />
                  <span>Gemini 梗图解读</span>
                </span>
                <span className="home-spotlight-timer-pill">
                  {remainingSeconds}s 后随机切换
                </span>
              </div>

              <h3>{meme.title}</h3>

              <div className="gemini-tags">
                {meme.tags.map((tag) => (
                  <span key={tag} className="gemini-tag">
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="gemini-block">
                <span className="gemini-block-label">
                  <Sparkles size={13} aria-hidden="true" /> 笑点直击
                </span>
                <p>{meme.punchline}</p>
              </div>

              <div className="gemini-block">
                <span className="gemini-block-label">画面解析</span>
                <p>{meme.analysis}</p>
              </div>

              <blockquote className="gemini-verdict">
                <b>Gemini 锐评</b>
                <p>“{meme.verdict}”</p>
              </blockquote>

              <footer className="gemini-commentary-foot">
                <span>
                  图库第 {cursor + 1} / {pool.length} 抽 · 不重复随机轮播
                </span>
                <button
                  type="button"
                  className="gemini-next-inline"
                  onClick={advanceRandom}
                >
                  再抽一张 <Shuffle size={13} aria-hidden="true" />
                </button>
              </footer>
            </article>
          </div>
        </div>
      )}

      {lightboxOpen && currentItem && (
        <SpotlightLightbox
          item={currentItem}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </section>
  );
}
