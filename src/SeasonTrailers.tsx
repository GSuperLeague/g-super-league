import { Download, Film } from "lucide-react";
import { footballSeasonPromos } from "../lib/season-promos.ts";
import seasonOneVideo from "./assets/g-super-season-1-trailer.mp4";
import seasonTwoVideo from "./assets/g-super-season-2-trailer.mp4";
import seasonOnePoster from "./assets/g-super-season-1-poster.jpg";
import seasonTwoPoster from "./assets/g-super-season-2-poster.jpg";
import "./season-trailers.css";

const media = {
  s1: { video: seasonOneVideo, poster: seasonOnePoster },
  s2: { video: seasonTwoVideo, poster: seasonTwoPoster },
};

export function SeasonTrailers({
  season,
  withHeading = true,
}: {
  season?: "s1" | "s2";
  withHeading?: boolean;
}) {
  const promos = footballSeasonPromos.filter((promo) => !season || promo.id === season);
  return (
    <div className={`season-showcase${season ? " is-single" : ""}`}>
      {promos.map((promo) => {
        const current = promo.id === "s1";
        const filmLabel = current ? "赛季短片" : "预告片";
        return (
          <section
            className="season-trailers"
            aria-label={current ? "G超当前赛季" : "G超赛季预告"}
            key={promo.id}
          >
            {withHeading && (
              <header className="season-trailers-heading">
                <div>
                  <span>
                    G SUPER LEAGUE / {current ? "CURRENT SEASON" : "NEXT SEASON"}
                  </span>
                  <h2><Film size={21} aria-hidden="true" /> {current ? "当前赛季" : "赛季预告"}</h2>
                </div>
                <p>{current ? "第一赛季已正式开赛，正在进行中。" : "下一季，连续狂转数圈，高速出球。"}</p>
              </header>
            )}
            <article className={`season-trailer-card ${promo.id}`}>
              <video
                controls
                playsInline
                preload="none"
                poster={media[promo.id].poster}
                width={1920}
                height={1080}
                aria-label={`${promo.label}「${promo.theme}」${filmLabel}，26秒，带音乐`}
              >
                <source src={media[promo.id].video} type="video/mp4" />
                浏览器暂不支持视频，请使用下方链接下载观看。
              </video>
              <div className="season-trailer-copy">
                <div className="season-trailer-label">
                  <span>{promo.label}</span>
                  <b>{promo.status}</b>
                </div>
                <h3>{promo.theme}</h3>
                <p>{promo.description}</p>
                <footer>
                  <span>26秒 · 1080p · 含音乐</span>
                  <a href={media[promo.id].video} download={`G超_${promo.label}_${promo.theme}_${filmLabel}.mp4`}>
                    <Download size={14} aria-hidden="true" /> 下载{filmLabel}
                  </a>
                </footer>
              </div>
            </article>
          </section>
        );
      })}
    </div>
  );
}
