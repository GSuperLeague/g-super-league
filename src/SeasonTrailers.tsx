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
    <section className="season-trailers" aria-label="G超赛季预告">
      {withHeading && (
        <header className="season-trailers-heading">
          <div>
            <span>G SUPER LEAGUE / SEASON FILMS</span>
            <h2><Film size={21} aria-hidden="true" /> 赛季预告</h2>
          </div>
          <p>这一季，借力弹反。下一季，准备爆冲。</p>
        </header>
      )}
      <div className={`season-trailer-grid${season ? " is-single" : ""}`}>
        {promos.map((promo) => (
          <article className={`season-trailer-card ${promo.id}`} key={promo.id}>
            <video
              controls
              playsInline
              preload="none"
              poster={media[promo.id].poster}
              width={1920}
              height={1080}
              aria-label={`${promo.label}「${promo.theme}」预告片，26秒，带音乐`}
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
                <a href={media[promo.id].video} download={`G超_${promo.label}_${promo.theme}_预告片.mp4`}>
                  <Download size={14} aria-hidden="true" /> 下载预告片
                </a>
              </footer>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
