import { useId } from "react";
import type { RankTier } from "../lib/rating.ts";

export type TierId = RankTier["id"];

type BadgePalette = {
  lit: string;
  mid: string;
  shade: string;
  deep: string;
  base: string;
  coreLit: string;
  coreMid: string;
  coreDeep: string;
  aura: string;
  boltColor: string;
  boltAlt?: string;
};

export const TIER_PALETTES: Record<TierId, BadgePalette> = {
  iron: {
    lit: "#dce4ea",
    mid: "#8796a1",
    shade: "#4a5660",
    deep: "#232b32",
    base: "#14191f",
    coreLit: "#e6edf2",
    coreMid: "#7d8c97",
    coreDeep: "#2c353d",
    aura: "transparent",
    boltColor: "transparent",
  },
  bronze: {
    lit: "#ffdec0",
    mid: "#d1874a",
    shade: "#8a4a1c",
    deep: "#421f09",
    base: "#241106",
    coreLit: "#ffebd6",
    coreMid: "#e39552",
    coreDeep: "#75360d",
    aura: "#d67d3e",
    boltColor: "transparent",
  },
  silver: {
    lit: "#ffffff",
    mid: "#cedee9",
    shade: "#748da3",
    deep: "#36495c",
    base: "#172330",
    coreLit: "#ffffff",
    coreMid: "#cde8ff",
    coreDeep: "#466e91",
    aura: "#9dd2f5",
    boltColor: "transparent",
  },
  gold: {
    lit: "#fff9d4",
    mid: "#f5c445",
    shade: "#ba7912",
    deep: "#5e3604",
    base: "#291703",
    coreLit: "#fffde6",
    coreMid: "#ffd24d",
    coreDeep: "#a35e06",
    aura: "#ffbe2e",
    boltColor: "transparent",
  },
  platinum: {
    lit: "#f5fffe",
    mid: "#96ebe2",
    shade: "#389c95",
    deep: "#154f52",
    base: "#0a2529",
    coreLit: "#f0ffff",
    coreMid: "#5cf5e8",
    coreDeep: "#0e7575",
    aura: "#38e8d8",
    boltColor: "#75fff3",
  },
  diamond: {
    lit: "#f8fbff",
    mid: "#bfd8f0",
    shade: "#4a7eb5",
    deep: "#1a3b6e",
    base: "#081733",
    coreLit: "#e0f5ff",
    coreMid: "#47a8eb",
    coreDeep: "#14499e",
    aura: "#4ca6f5",
    boltColor: "#8ed4ff",
  },
  master: {
    lit: "#fff9eb",
    mid: "#e6c178",
    shade: "#9e722b",
    deep: "#4a300d",
    base: "#1a0733",
    coreLit: "#f4e0ff",
    coreMid: "#9c54e3",
    coreDeep: "#441080",
    aura: "#9f5ae6",
    boltColor: "#d29eff",
    boltAlt: "#f2d28b",
  },
  grandmaster: {
    lit: "#fff7e8",
    mid: "#e8be82",
    shade: "#a6632a",
    deep: "#4a210b",
    base: "#24040a",
    coreLit: "#ffecd6",
    coreMid: "#db1d33",
    coreDeep: "#6e0312",
    aura: "#e32636",
    boltColor: "#ff4747",
    boltAlt: "#ffd073",
  },
  king: {
    lit: "#fff8e0",
    mid: "#ecc363",
    shade: "#ab771c",
    deep: "#4c3006",
    base: "#08080a",
    coreLit: "#ffebd6",
    coreMid: "#c91426",
    coreDeep: "#52000a",
    aura: "#d91c2f",
    boltColor: "#f7d472",
    boltAlt: "#f02b38",
  },
};

function LightningBolt({
  d,
  color,
  className,
  width = 2.4,
}: {
  d: string;
  color: string;
  className: string;
  width?: number;
}) {
  return (
    <g className={`ow-bolt ${className}`}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width * 2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.34"
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.92"
      />
      <path
        d={d}
        fill="none"
        stroke="#ffffff"
        strokeWidth={Math.max(0.8, width * 0.4)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function StarGlint({
  cx,
  cy,
  r = 6,
  color = "#ffffff",
  className = "ow-glint-1",
}: {
  cx: number;
  cy: number;
  r?: number;
  color?: string;
  className?: string;
}) {
  const ir = r * 0.2;
  const d = `M${cx} ${cy - r} L${cx + ir} ${cy - ir} L${cx + r} ${cy} L${cx + ir} ${cy + ir} L${cx} ${cy + r} L${cx - ir} ${cy + ir} L${cx - r} ${cy} L${cx - ir} ${cy - ir} Z`;
  return (
    <g className={`ow-glint ${className}`} style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <circle cx={cx} cy={cy} r={r * 0.38} fill={color} opacity="0.38" />
      <path d={d} fill={color} />
    </g>
  );
}

/**
 * Clean 3D ridge-split metallic chevron wing pair:
 * Left arm catches bright brushed highlight on top facet, right arm catches specular contrast.
 * Zero cartoon outlines — form comes purely from sharp architectural planar shading.
 */
function FacetedChevron({
  topY,
  spanX,
  tipY,
  thickness,
  litFill,
  midFill,
  shadeFill,
  deepFill,
  cutX = 0,
}: {
  topY: number;
  spanX: number;
  tipY: number;
  thickness: number;
  litFill: string;
  midFill: string;
  shadeFill: string;
  deepFill: string;
  cutX?: number;
}) {
  const lx = 60 - spanX;
  const rx = 60 + spanX;
  const midY = tipY - thickness * 0.5;
  const outerDrop = topY + thickness;
  const innerL = lx + cutX;
  const innerR = rx - cutX;

  return (
    <g>
      {/* Left arm — upper lit bevel */}
      <polygon points={`${lx},${topY} 60,${tipY - thickness} 60,${midY} ${lx + (innerL - lx) * 0.45},${topY + thickness * 0.52}`} fill={litFill} />
      {/* Left arm — lower brushed bevel */}
      <polygon points={`${lx + (innerL - lx) * 0.45},${topY + thickness * 0.52} 60,${midY} 60,${tipY} ${innerL},${outerDrop}`} fill={midFill} />
      {/* Right arm — upper reflective bevel */}
      <polygon points={`${rx},${topY} 60,${tipY - thickness} 60,${midY} ${rx - (rx - innerR) * 0.45},${topY + thickness * 0.52}`} fill={shadeFill} />
      {/* Right arm — lower deep shadow bevel */}
      <polygon points={`${rx - (rx - innerR) * 0.45},${topY + thickness * 0.52} 60,${midY} 60,${tipY} ${innerR},${outerDrop}`} fill={deepFill} />
      {/* Hairline specular ridge */}
      <polyline
        points={`${lx},${topY} 60,${tipY - thickness} ${rx},${topY}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="0.75"
        opacity="0.62"
      />
    </g>
  );
}

/**
 * Sleek Overwatch-style swept aerospace wing pair (left & right mirrored),
 * each blade cleanly split along its ridge into a lit upper facet and shadowed lower facet.
 */
function SweptWingPair({
  outerX,
  outerY,
  innerX,
  innerY,
  height,
  tipDrop = 9,
  litFill,
  midFill,
  shadeFill,
  deepFill,
}: {
  outerX: number;
  outerY: number;
  innerX: number;
  innerY: number;
  height: number;
  tipDrop?: number;
  litFill: string;
  midFill: string;
  shadeFill: string;
  deepFill: string;
}) {
  const rxOut = 120 - outerX;
  const rxIn = 120 - innerX;
  const ridgeOutY = outerY + tipDrop * 0.5;
  const ridgeInY = innerY + height * 0.48;
  const botOutX = outerX + 5;
  const botOutY = outerY + tipDrop;
  const rBotOutX = 120 - botOutX;

  return (
    <g>
      {/* Left wing blade */}
      <polygon
        points={`${outerX},${outerY} ${innerX},${innerY} ${innerX},${ridgeInY} ${outerX + 2.5},${ridgeOutY}`}
        fill={litFill}
      />
      <polygon
        points={`${outerX + 2.5},${ridgeOutY} ${innerX},${ridgeInY} ${innerX + 2},${innerY + height} ${botOutX},${botOutY}`}
        fill={shadeFill}
      />
      <line
        x1={outerX}
        y1={outerY}
        x2={innerX}
        y2={innerY}
        stroke="#ffffff"
        strokeWidth="0.85"
        opacity="0.78"
      />

      {/* Right wing blade */}
      <polygon
        points={`${rxOut},${outerY} ${rxIn},${innerY} ${rxIn},${ridgeInY} ${rxOut - 2.5},${ridgeOutY}`}
        fill={midFill}
      />
      <polygon
        points={`${rxOut - 2.5},${ridgeOutY} ${rxIn},${ridgeInY} ${rxIn - 2},${innerY + height} ${rBotOutX},${botOutY}`}
        fill={deepFill}
      />
      <line
        x1={rxOut}
        y1={outerY}
        x2={rxIn}
        y2={innerY}
        stroke="#ffffff"
        strokeWidth="0.75"
        opacity="0.52"
      />
    </g>
  );
}

export function TierBadgeSvg({ tierId }: { tierId: TierId }) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const p = TIER_PALETTES[tierId];

  const litG = `url(#${uid}-lit)`;
  const midG = `url(#${uid}-mid)`;
  const shadeG = `url(#${uid}-shade)`;
  const deepG = `url(#${uid}-deep)`;
  const coreG = `url(#${uid}-core)`;
  const auraG = `url(#${uid}-aura)`;
  const sheenG = `url(#${uid}-sheen)`;
  const artId = `${uid}-art`;
  const maskId = `${uid}-sheen-mask`;

  return (
    <svg
      className="tier-emblem-svg"
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-lit`} x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="32%" stopColor={p.lit} />
          <stop offset="100%" stopColor={p.mid} />
        </linearGradient>

        <linearGradient id={`${uid}-mid`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.lit} />
          <stop offset="48%" stopColor={p.mid} />
          <stop offset="100%" stopColor={p.shade} />
        </linearGradient>

        <linearGradient id={`${uid}-shade`} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor={p.mid} />
          <stop offset="55%" stopColor={p.shade} />
          <stop offset="100%" stopColor={p.deep} />
        </linearGradient>

        <linearGradient id={`${uid}-deep`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.shade} />
          <stop offset="62%" stopColor={p.deep} />
          <stop offset="100%" stopColor={p.base} />
        </linearGradient>

        <radialGradient id={`${uid}-core`} cx="40%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="28%" stopColor={p.coreLit} />
          <stop offset="68%" stopColor={p.coreMid} />
          <stop offset="100%" stopColor={p.coreDeep} />
        </radialGradient>

        <radialGradient id={`${uid}-aura`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={p.aura} stopOpacity="0.68" />
          <stop offset="52%" stopColor={p.aura} stopOpacity="0.2" />
          <stop offset="100%" stopColor={p.aura} stopOpacity="0" />
        </radialGradient>

        <linearGradient id={`${uid}-sheen`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="42%" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.72" />
          <stop offset="58%" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {tierId === "master" && (
          <linearGradient id={`${uid}-master-gem`} x1="15%" y1="5%" x2="85%" y2="95%">
            <stop offset="0%" stopColor="#fdf5ff" />
            <stop offset="28%" stopColor="#d49ef7" />
            <stop offset="62%" stopColor="#8638cc" />
            <stop offset="100%" stopColor="#320963" />
          </linearGradient>
        )}

        {tierId === "grandmaster" && (
          <linearGradient id={`${uid}-gm-energy`} x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#ffba7a" />
            <stop offset="38%" stopColor="#d91a2e" />
            <stop offset="100%" stopColor="#57030e" />
          </linearGradient>
        )}

        {tierId === "king" && (
          <>
            <linearGradient id={`${uid}-king-obsidian`} x1="15%" y1="5%" x2="85%" y2="95%">
              <stop offset="0%" stopColor="#38343a" />
              <stop offset="34%" stopColor="#1b191e" />
              <stop offset="72%" stopColor="#0d0c10" />
              <stop offset="100%" stopColor="#040406" />
            </linearGradient>
            <linearGradient id={`${uid}-king-crimson`} x1="15%" y1="5%" x2="85%" y2="95%">
              <stop offset="0%" stopColor="#ffedd6" />
              <stop offset="22%" stopColor="#eb3b44" />
              <stop offset="56%" stopColor="#b8091b" />
              <stop offset="86%" stopColor="#63000c" />
              <stop offset="100%" stopColor="#260005" />
            </linearGradient>
            <radialGradient id={`${uid}-king-aura`} cx="50%" cy="48%" r="50%">
              <stop offset="0%" stopColor="#d91a2e" stopOpacity="0.54" />
              <stop offset="46%" stopColor="#ebc363" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#ebc363" stopOpacity="0" />
            </radialGradient>
          </>
        )}

        <mask id={maskId} style={{ maskType: "alpha" }}>
          <use href={`#${artId}`} />
        </mask>
      </defs>

      {/* ==================== BACKDROP VOLUMETRIC AURA & HALO ==================== */}
      {tierId === "gold" && <circle cx="60" cy="58" r="46" fill={auraG} className="ow-aura-soft" />}
      {tierId === "platinum" && <circle cx="60" cy="58" r="50" fill={auraG} className="ow-aura-pulse" />}
      {tierId === "diamond" && <circle cx="60" cy="58" r="54" fill={auraG} className="ow-aura-pulse" />}
      {tierId === "master" && <circle cx="60" cy="58" r="56" fill={auraG} className="ow-aura-strong" />}
      {tierId === "grandmaster" && <circle cx="60" cy="58" r="57" fill={auraG} className="ow-aura-intense" />}
      {tierId === "king" && (
        <>
          <circle cx="60" cy="58" r="59" fill={`url(#${uid}-king-aura)`} className="ow-aura-king" />
          <g className="ow-king-halo" style={{ transformOrigin: "60px 58px" }}>
            <circle
              cx="60"
              cy="58"
              r="49"
              fill="none"
              stroke="#ecc466"
              strokeWidth="1.2"
              strokeDasharray="12 8 3 8"
              opacity="0.76"
            />
            <circle
              cx="60"
              cy="58"
              r="43.5"
              fill="none"
              stroke="#d91e30"
              strokeWidth="0.95"
              strokeDasharray="4 11"
              opacity="0.68"
            />
            <polygon points="60,4 62.5,12 57.5,12" fill="#f5d882" opacity="0.9" />
            <polygon points="60,112 62.5,104 57.5,104" fill="#e6293c" opacity="0.88" />
          </g>
        </>
      )}

      {/* ==================== SOLID SCULPTED EMBLEM BODY ==================== */}
      <g id={artId}>

      {/* ==================== TIER 1: IRON (黑铁) ==================== */}
      {/* Brutalist single machined gunmetal chevron + solid anchor keel */}
      {tierId === "iron" && (
        <g>
          {/* Subtle anodized center diamond recessed core */}
          <polygon points="60,26 70,38 60,50 50,38" fill={p.base} />
          <polygon points="60,29 67,38 60,47 53,38" fill={midG} />
          <polygon points="60,29 53,38 60,38" fill={litG} />
          <polygon points="60,47 67,38 60,38" fill={deepG} />

          {/* Primary heavy machined steel chevron */}
          <FacetedChevron
            topY={34}
            spanX={42}
            tipY={85}
            thickness={22}
            cutX={9}
            litFill={litG}
            midFill={midG}
            shadeFill={shadeG}
            deepFill={deepG}
          />

          {/* Compact forged anchor wedge */}
          <polygon points="44,82 60,96 60,104 39,86" fill={midG} />
          <polygon points="76,82 60,96 60,104 81,86" fill={deepG} />
        </g>
      )}

      {/* ==================== TIER 2: BRONZE (青铜) ==================== */}
      {/* Clean Overwatch-style twin forged copper-bronze chevrons + top spear */}
      {tierId === "bronze" && (
        <g>
          {/* Minimal central bronze apex kite */}
          <polygon points="60,16 69,31 60,44 51,31" fill={midG} />
          <polygon points="60,16 51,31 60,44" fill={litG} />
          <polygon points="60,16 69,31 60,31" fill={p.lit} opacity="0.55" />
          <polygon points="60,44 69,31 60,31" fill={deepG} />

          {/* Upper machined bronze chevron */}
          <FacetedChevron
            topY={26}
            spanX={45}
            tipY={71}
            thickness={17}
            cutX={8}
            litFill={litG}
            midFill={midG}
            shadeFill={shadeG}
            deepFill={deepG}
          />

          {/* Lower machined bronze chevron with crisp negative space */}
          <FacetedChevron
            topY={50}
            spanX={39}
            tipY={94}
            thickness={16}
            cutX={8}
            litFill={litG}
            midFill={midG}
            shadeFill={shadeG}
            deepFill={deepG}
          />

          {/* Lower bronze pinpoint */}
          <polygon points="60,97 66,104 60,111 54,104" fill={litG} />
          <polygon points="60,97 66,104 60,111" fill={deepG} />
        </g>
      )}

      {/* ==================== TIER 3: SILVER (白银) ==================== */}
      {/* Crisp brushed titanium insignia: twin swept chevrons + upper wings + spearhead */}
      {tierId === "silver" && (
        <g>
          {/* Subtle recessed dark slate anchor behind core for crisp white-bg legibility */}
          <polygon points="60,26 78,44 60,64 42,44" fill={p.base} opacity="0.88" />

          {/* Sleek brushed titanium upper wing-fins */}
          <SweptWingPair
            outerX={8}
            outerY={25}
            innerX={43}
            innerY={41}
            height={14}
            tipDrop={11}
            litFill={litG}
            midFill={midG}
            shadeFill={shadeG}
            deepFill={deepG}
          />

          {/* Central precision-cut titanium spearhead */}
          <polygon points="60,12 73,34 60,55 47,34" fill={midG} />
          <polygon points="60,12 47,34 60,34" fill="#ffffff" />
          <polygon points="60,12 73,34 60,34" fill={litG} />
          <polygon points="47,34 60,55 60,34" fill={shadeG} />
          <polygon points="73,34 60,55 60,34" fill={deepG} />

          {/* Mid titanium chevron */}
          <FacetedChevron
            topY={42}
            spanX={42}
            tipY={82}
            thickness={15}
            cutX={8}
            litFill={litG}
            midFill={midG}
            shadeFill={shadeG}
            deepFill={deepG}
          />

          {/* Bottom titanium chevron */}
          <FacetedChevron
            topY={64}
            spanX={33}
            tipY={102}
            thickness={14}
            cutX={7}
            litFill={litG}
            midFill={midG}
            shadeFill={shadeG}
            deepFill={deepG}
          />
        </g>
      )}

      {/* ==================== TIER 4: GOLD (黄金) ==================== */}
      {/* Iconic Overwatch Gold: clean 24K brushed aero-wings + floating sunburst diamond + V-cradle */}
      {tierId === "gold" && (
        <g>
          {/* Recessed obsidian-bronze inner core backing */}
          <polygon points="60,22 83,46 60,78 37,46" fill={p.base} opacity="0.92" />

          {/* Two clean swept 24K gold wing-blades per side */}
          <SweptWingPair
            outerX={5}
            outerY={24}
            innerX={41}
            innerY={40}
            height={14}
            tipDrop={11}
            litFill={litG}
            midFill={midG}
            shadeFill={shadeG}
            deepFill={deepG}
          />
          <SweptWingPair
            outerX={13}
            outerY={46}
            innerX={43}
            innerY={57}
            height={13}
            tipDrop={10}
            litFill={midG}
            midFill={shadeG}
            shadeFill={shadeG}
            deepFill={deepG}
          />

          {/* Floating faceted 24K central diamond spear */}
          <polygon points="60,12 77,45 60,76 43,45" fill={coreG} />
          <polygon points="60,12 43,45 60,45" fill="#ffffff" opacity="0.88" />
          <polygon points="60,12 77,45 60,45" fill={p.lit} opacity="0.72" />
          <polygon points="43,45 60,76 60,45" fill={p.mid} />
          <polygon points="77,45 60,76 60,45" fill={p.deep} opacity="0.85" />
          {/* Inner sharp table facet */}
          <polygon points="60,26 69,45 60,61 51,45" fill="#fffbe0" opacity="0.55" />

          {/* Clean architectural lower gold V-cradle */}
          <FacetedChevron
            topY={64}
            spanX={39}
            tipY={104}
            thickness={15}
            cutX={9}
            litFill={litG}
            midFill={midG}
            shadeFill={shadeG}
            deepFill={deepG}
          />

          {/* Apex sparkle */}
          <StarGlint cx={54} cy={27} r={5} color="#fffbe0" className="ow-glint-2" />
        </g>
      )}

      {/* ==================== TIER 5: PLATINUM (铂金) ==================== */}
      {/* Sleek aerospace chrome-platinum twin-tier wings + razor-cut aqua-crystal vertical spear */}
      {tierId === "platinum" && (
        <g>
          {/* Deep oceanic-teal precision backing prism */}
          <polygon points="60,18 82,50 60,92 38,50" fill={p.base} opacity="0.92" />

          {/* Three ultra-sleek upswept platinum aero blades */}
          <SweptWingPair
            outerX={4}
            outerY={18}
            innerX={40}
            innerY={38}
            height={13}
            tipDrop={11}
            litFill={litG}
            midFill={midG}
            shadeFill={shadeG}
            deepFill={deepG}
          />
          <SweptWingPair
            outerX={10}
            outerY={40}
            innerX={41}
            innerY={55}
            height={12}
            tipDrop={10}
            litFill={litG}
            midFill={midG}
            shadeFill={shadeG}
            deepFill={deepG}
          />
          <SweptWingPair
            outerX={18}
            outerY={61}
            innerX={44}
            innerY={72}
            height={11}
            tipDrop={9}
            litFill={midG}
            midFill={shadeG}
            shadeFill={shadeG}
            deepFill={deepG}
          />

          {/* Razor-cut aqua-platinum lower V-cradle */}
          <FacetedChevron
            topY={74}
            spanX={33}
            tipY={109}
            thickness={13}
            cutX={7}
            litFill={litG}
            midFill={midG}
            shadeFill={shadeG}
            deepFill={deepG}
          />

          {/* Hero floating aqua-chrome crystal spearhead */}
          <polygon points="60,8 78,50 60,92 42,50" fill={coreG} />
          <polygon points="60,8 42,50 53,50" fill="#ffffff" opacity="0.92" />
          <polygon points="60,8 53,50 60,42" fill="#d9fffb" opacity="0.8" />
          <polygon points="60,8 78,50 67,50" fill="#4cd9cf" opacity="0.72" />
          <polygon points="42,50 60,92 53,50" fill="#5cebe0" opacity="0.68" />
          <polygon points="78,50 60,92 67,50" fill="#0d5457" opacity="0.88" />
          <polygon points="60,26 69,50 60,72 51,50" fill="#ffffff" opacity="0.58" />

          <StarGlint cx={53} cy={35} r={6} color="#f0ffff" className="ow-glint-1" />
        </g>
      )}

      {/* ==================== TIER 6: DIAMOND (钻石 · 悬浮冰钻棱镜) ==================== */}
      {/* Distinct Archetype: Pure 12-facet floating sapphire diamond + 4-way floating platinum orbital prongs & crystal shards — NO wings */}
      {tierId === "diamond" && (
        <g>
          {/* Floating outer ice-crystal shards in crisp negative space */}
          <polygon points="18,22 30,27 25,35 15,28" fill={litG} />
          <polygon points="18,22 25,35 15,28" fill={coreG} opacity="0.72" />
          <polygon points="102,22 90,27 95,35 105,28" fill={midG} />
          <polygon points="102,22 95,35 105,28" fill={shadeG} />
          <polygon points="20,90 31,84 27,96 16,97" fill={midG} opacity="0.9" />
          <polygon points="100,90 89,84 93,96 104,97" fill={shadeG} opacity="0.9" />

          {/* 4-Way Floating Sci-Fi Platinum Containment Brackets (North / South / East / West) */}
          {/* West floating chevron prong */}
          <polygon points="5,60 22,41 27,46 15,60" fill={litG} />
          <polygon points="5,60 15,60 27,74 22,79" fill={shadeG} />
          <line x1="5" y1="60" x2="22" y2="41" stroke="#ffffff" strokeWidth="0.9" opacity="0.85" />
          {/* East floating chevron prong */}
          <polygon points="115,60 98,41 93,46 105,60" fill={midG} />
          <polygon points="115,60 105,60 93,74 98,79" fill={deepG} />
          <line x1="115" y1="60" x2="98" y2="41" stroke="#ffffff" strokeWidth="0.7" opacity="0.6" />
          {/* North floating diamond cap */}
          <polygon points="60,3 73,16 68,20 60,11" fill={midG} />
          <polygon points="60,3 47,16 52,20 60,11" fill={litG} />
          {/* South floating diamond keel */}
          <polygon points="60,117 47,104 52,100 60,109" fill={shadeG} />
          <polygon points="60,117 73,104 68,100 60,109" fill={deepG} />

          {/* Deep sapphire precision shadow housing */}
          <polygon points="60,14 96,60 60,106 24,60" fill={p.base} />

          {/* Hero Monumental 12-Facet Precision-Cut Sapphire Diamond */}
          <polygon points="60,17 93,60 60,103 27,60" fill={coreG} />
          {/* Upper crown left/right facets (Kashmir Sapphire luxury grading) */}
          <polygon points="60,17 27,60 44,60" fill="#ffffff" opacity="0.94" />
          <polygon points="60,17 44,60 60,41" fill="#d8f0ff" opacity="0.88" />
          <polygon points="60,17 76,60 60,41" fill="#59b2f0" opacity="0.76" />
          <polygon points="60,17 93,60 76,60" fill="#1d65bf" opacity="0.86" />
          {/* Lower pavilion left/right facets */}
          <polygon points="27,60 44,60 60,103" fill="#46a3eb" opacity="0.82" />
          <polygon points="44,60 60,79 60,103" fill="#9cd8ff" opacity="0.66" />
          <polygon points="76,60 60,79 60,103" fill="#154ba8" opacity="0.88" />
          <polygon points="76,60 93,60 60,103" fill="#082054" opacity="0.95" />
          {/* Inner precision table octagon/diamond */}
          <polygon points="60,37 77,60 60,81 43,60" fill="#ffffff" opacity="0.78" />
          <polygon points="60,37 77,60 60,81" fill="#5cb8f5" opacity="0.46" />
          <polygon points="60,47 69,60 60,71 51,60" fill="#ffffff" opacity="0.94" />
          {/* Crisp crystal refraction lines */}
          <polyline points="27,60 60,17 93,60" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.88" />
          <line x1="27" y1="60" x2="93" y2="60" stroke="#e0f4ff" strokeWidth="0.65" opacity="0.55" />
        </g>
      )}

      {/* ==================== TIER 7: MASTER (大师 · 紫金八芒圣轮) ==================== */}
      {/* Distinct Archetype: Radial 8-Point Celestial Sunburst Star-Halo — architectural open gold ring + 4 cardinal spears + 4 violet crystal rays */}
      {tierId === "master" && (
        <g>
          {/* 4 Diagonal Faceted Imperial Amethyst Crystal Rays (45° starburst) */}
          {/* Top-Left */}
          <polygon points="18,18 49,41 41,49" fill={`url(#${uid}-master-gem)`} />
          <polygon points="18,18 49,41 37,37" fill="#ffffff" opacity="0.62" />
          {/* Top-Right */}
          <polygon points="102,18 79,49 71,41" fill={`url(#${uid}-master-gem)`} />
          <polygon points="102,18 71,41 83,37" fill="#f3b8ff" opacity="0.55" />
          {/* Bottom-Left */}
          <polygon points="18,102 41,71 49,79" fill={`url(#${uid}-master-gem)`} />
          <polygon points="18,102 49,79 37,83" fill="#4f0d94" opacity="0.72" />
          {/* Bottom-Right */}
          <polygon points="102,102 71,79 79,71" fill={`url(#${uid}-master-gem)`} />
          <polygon points="102,102 79,71 83,83" fill="#3a076e" opacity="0.85" />

          {/* Architectural Open Chamfered 24K Gold Octagonal Halo Ring */}
          {/* 4 diagonal gold ring arcs bridging the cardinal spears */}
          <polygon points="24,41 41,24 46,30 30,46" fill={litG} />
          <polygon points="96,41 79,24 74,30 90,46" fill={midG} />
          <polygon points="24,79 41,96 46,90 30,74" fill={shadeG} />
          <polygon points="96,79 79,96 74,90 90,74" fill={deepG} />
          {/* Inner thin champagne-gold accent ring */}
          <polygon
            points="60,24 85,35 96,60 85,85 60,96 35,85 24,60 35,35"
            fill="none"
            stroke="#f0d599"
            strokeWidth="1.2"
            opacity="0.68"
          />

          {/* 4 Bold Sculpted 24K Gold Cardinal Spears (North / South / East / West) */}
          {/* North spear */}
          <polygon points="60,4 69,36 60,43 51,36" fill={midG} />
          <polygon points="60,4 51,36 60,43" fill={litG} />
          <polygon points="60,4 69,36 60,43" fill={shadeG} />
          {/* South spear */}
          <polygon points="60,116 69,84 60,77 51,84" fill={midG} />
          <polygon points="60,116 51,84 60,77" fill={shadeG} />
          <polygon points="60,116 69,84 60,77" fill={deepG} />
          {/* West spear */}
          <polygon points="4,60 36,51 43,60 36,69" fill={midG} />
          <polygon points="4,60 36,51 43,60" fill={litG} />
          <polygon points="4,60 36,69 43,60" fill={shadeG} />
          {/* East spear */}
          <polygon points="116,60 84,51 77,60 84,69" fill={midG} />
          <polygon points="116,60 84,51 77,60" fill={midG} />
          <polygon points="116,60 84,69 77,60" fill={deepG} />

          {/* Deep Royal Amethyst Octagonal Setting */}
          <polygon points="60,31 80,40 89,60 80,80 60,89 40,80 31,60 40,40" fill={p.base} />
          <polygon
            points="60,31 80,40 89,60 80,80 60,89 40,80 31,60 40,40"
            fill="none"
            stroke="#e6c178"
            strokeWidth="1.5"
          />

          {/* Central Radiant Amethyst 4-Point Star Prism */}
          <polygon
            points="60,34 69,51 86,60 69,69 60,86 51,69 34,60 51,51"
            fill={`url(#${uid}-master-gem)`}
          />
          <polygon points="60,34 51,51 60,60" fill="#ffffff" opacity="0.9" />
          <polygon points="34,60 51,51 60,60" fill="#f0d6ff" opacity="0.8" />
          <polygon points="60,34 69,51 60,60" fill="#c78ef2" opacity="0.72" />
          <polygon points="86,60 69,69 60,60" fill="#3e0b78" opacity="0.88" />
          <polygon points="60,86 69,69 60,60" fill="#24044d" opacity="0.94" />
          <polygon points="60,48 70,60 60,72 50,60" fill="#ffffff" opacity="0.88" />
        </g>
      )}

      {/* ==================== TIER 8: GRANDMASTER (宗师 · 裂空双刃赤炎徽) ==================== */}
      {/* Redesigned Archetype: Ultra-sharp X-swept Stealth Valkyrie Twin-Blades + Vertical Imperial Lance + Molten Scarlet Flame-Prism */}
      {tierId === "grandmaster" && (
        <g>
          {/* Inner Fierce Scarlet-Vermilion Energy Blades slashing along the X-axis */}
          <polygon points="10,16 48,46 42,57 18,34" fill={`url(#${uid}-gm-energy)`} />
          <polygon points="110,16 72,46 78,57 102,34" fill={`url(#${uid}-gm-energy)`} />
          <polygon points="16,90 45,67 49,77 24,96" fill={`url(#${uid}-gm-energy)`} opacity="0.9" />
          <polygon points="104,90 75,67 71,77 96,96" fill={`url(#${uid}-gm-energy)`} opacity="0.9" />

          {/* Upper Swept Razor-Faceted Valkyrie Delta-Blades (soaring outward-upward to (4, 21) & (116, 21)) */}
          {/* Left Upper Blade */}
          <polygon points="4,21 44,44 41,52 10,33" fill={litG} />
          <polygon points="10,33 41,52 39,59 18,45" fill={shadeG} />
          <line x1="4" y1="21" x2="44" y2="44" stroke="#fff9eb" strokeWidth="0.95" opacity="0.88" />
          {/* Right Upper Blade */}
          <polygon points="116,21 76,44 79,52 110,33" fill={midG} />
          <polygon points="110,33 79,52 81,59 102,45" fill={deepG} />
          <line x1="116" y1="21" x2="76" y2="44" stroke="#ffe5bd" strokeWidth="0.75" opacity="0.65" />

          {/* Lower Counter-Swept Stealth Wing Blades (angled downward-outward for crisp X-silhouette!) */}
          {/* Left Lower Blade */}
          <polygon points="12,83 42,64 45,71 20,89" fill={litG} />
          <polygon points="20,89 45,71 48,77 27,94" fill={shadeG} />
          {/* Right Lower Blade */}
          <polygon points="108,83 78,64 75,71 100,89" fill={midG} />
          <polygon points="100,89 75,71 72,77 93,94" fill={deepG} />

          {/* Vertical Imperial Lance Axis — Floating Razor Top Spear & Lower Tail Finial */}
          {/* Top Lance */}
          <polygon points="60,2 68,23 60,31 52,23" fill={midG} />
          <polygon points="60,2 52,23 60,31" fill={litG} />
          <polygon points="60,2 68,23 60,31" fill={shadeG} />
          <polygon points="60,11 63.5,22 60,27 56.5,22" fill="#e62234" />
          {/* Bottom Lance Tail */}
          <polygon points="60,118 68,96 60,89 52,96" fill={midG} />
          <polygon points="60,118 52,96 60,89" fill={shadeG} />
          <polygon points="60,118 68,96 60,89" fill={deepG} />

          {/* Open Architectural Champagne-Gold Side Prongs framing the Flame Core */}
          <polygon points="29,58 41,38 45,42 35,58" fill={litG} />
          <polygon points="29,58 35,58 45,74 41,78" fill={shadeG} />
          <polygon points="91,58 79,38 75,42 85,58" fill={midG} />
          <polygon points="91,58 85,58 75,74 79,78" fill={deepG} />

          {/* Deep Obsidian-Scarlet Recessed Rhombus Core Housing */}
          <polygon points="60,26 83,58 60,91 37,58" fill={p.base} />
          <polygon points="60,26 83,58 60,91 37,58" fill="none" stroke="#ecc38a" strokeWidth="1.2" opacity="0.82" />

          {/* Molten Vermilion-Scarlet Flame-Prism Core (Pure Noble Crimson — zero pink) */}
          <polygon points="60,30 79,58 60,87 41,58" fill={coreG} />
          <polygon points="60,30 41,58 52,58" fill="#fff1d9" opacity="0.92" />
          <polygon points="60,30 52,58 60,46" fill="#ff9e66" opacity="0.84" />
          <polygon points="60,30 79,58 68,58" fill="#d9182c" opacity="0.82" />
          <polygon points="41,58 52,58 60,87" fill="#eb343d" opacity="0.82" />
          <polygon points="68,58 79,58 60,87" fill="#5e020e" opacity="0.94" />
          {/* Incandescent ember-white inner spear */}
          <polygon points="60,42 69,58 60,74 51,58" fill="#ffffff" opacity="0.92" />
          <polygon points="60,48 64.5,58 60,67 55.5,58" fill="#ffd275" />
          <polyline points="41,58 60,30 79,58" fill="none" stroke="#fff5de" strokeWidth="0.9" opacity="0.85" />
        </g>
      )}

      {/* ==================== TIER 9: KING / CHAMPION (王者 · 曜黑鎏金穹顶帝徽) ==================== */}
      {/* Redesigned Archetype: Dark-Luxury Stealth Obsidian-Black Winged Crest + Floating Sculptural 22K Gold Crown + Pigeon-Blood Ruby Star-Core + Rotating Precision Halo (ZERO chunky shield) */}
      {tierId === "king" && (
        <g>
          {/* Floating Minimalist Architectural Tri-Peak Sovereign Crown (22K Gold + Matte Obsidian + Blood Ruby) */}
          <g className="ow-king-crown">
            {/* Left & Right Stealth Obsidian Crown Horns with 22K Gold razor edges */}
            <polygon points="22,12 48,25 43,32 18,21" fill={`url(#${uid}-king-obsidian)`} />
            <polyline points="22,12 48,25" fill="none" stroke="#f0c869" strokeWidth="1.45" />
            <polygon points="98,12 72,25 77,32 102,21" fill={`url(#${uid}-king-obsidian)`} />
            <polyline points="98,12 72,25" fill="none" stroke="#f0c869" strokeWidth="1.45" />
            {/* Supreme Central 22K Gold Crown Spire */}
            <polygon points="60,2 70,22 60,30 50,22" fill={litG} />
            <polygon points="60,2 70,22 60,30" fill={shadeG} />
            <polygon points="60,8 64.5,20 60,26.5 55.5,20" fill={`url(#${uid}-king-crimson)`} />
            <polygon points="60,8 55.5,20 60,20" fill="#ffedd6" opacity="0.85" />
          </g>

          {/* Detached Stealth Matte-Obsidian Carbon Aero-Wings trimmed in 22K Gold & Crimson Plasma Slits */}
          {/* Upper Obsidian Wing Pair */}
          <polygon points="2,28 38,44 36,55 8,42" fill={`url(#${uid}-king-obsidian)`} />
          <polygon points="2,28 38,44 37,48 5,33" fill={litG} />
          <line x1="9" y1="41" x2="35" y2="53" stroke="#e01e31" strokeWidth="1.4" opacity="0.92" />

          <polygon points="118,28 82,44 84,55 112,42" fill={`url(#${uid}-king-obsidian)`} />
          <polygon points="118,28 82,44 83,48 115,33" fill={midG} />
          <line x1="111" y1="41" x2="85" y2="53" stroke="#e01e31" strokeWidth="1.4" opacity="0.92" />

          {/* Lower Obsidian Wing Pair with clean negative-space gap */}
          <polygon points="9,54 37,63 39,75 17,67" fill={`url(#${uid}-king-obsidian)`} />
          <polygon points="9,54 37,63 38,67 12,58" fill={midG} />
          <line x1="17" y1="67" x2="38" y2="74" stroke="#ecc363" strokeWidth="0.95" opacity="0.78" />

          <polygon points="111,54 83,63 81,75 103,67" fill={`url(#${uid}-king-obsidian)`} />
          <polygon points="111,54 83,63 82,67 108,58" fill={shadeG} />
          <line x1="103" y1="67" x2="82" y2="74" stroke="#ecc363" strokeWidth="0.95" opacity="0.78" />

          {/* Architectural Open 22K Gold & Obsidian Lower Cradle Chevrons */}
          <polygon points="22,78 60,104 60,115 18,86" fill={`url(#${uid}-king-obsidian)`} />
          <polygon points="22,78 60,104 60,109 20,82" fill={litG} />
          <polygon points="98,78 60,104 60,115 102,86" fill={`url(#${uid}-king-obsidian)`} />
          <polygon points="98,78 60,104 60,109 100,82" fill={shadeG} />
          <polyline points="22,78 60,104 98,78" fill="none" stroke="#fff6db" strokeWidth="0.9" opacity="0.82" />

          {/* Precision Matte-Obsidian Octagram Star-Setting with 22K Gold Filigree Rim */}
          <polygon
            points="60,28 76,47 90,60 76,73 60,97 44,73 30,60 44,47"
            fill={`url(#${uid}-king-obsidian)`}
          />
          <polygon
            points="60,28 76,47 90,60 76,73 60,97 44,73 30,60 44,47"
            fill="none"
            stroke="#ecc363"
            strokeWidth="1.5"
            opacity="0.94"
          />

          {/* Monumental Imperial Pigeon-Blood Ruby 4-Point Sovereign Star-Core */}
          <polygon
            points="60,33 73,50 85,60 73,70 60,92 47,70 35,60 47,50"
            fill={`url(#${uid}-king-crimson)`}
          />
          {/* Deep luxury gemstone facets */}
          <polygon points="60,33 47,50 60,60" fill="#ffefd9" opacity="0.9" />
          <polygon points="60,33 73,50 60,60" fill="#e6303d" opacity="0.78" />
          <polygon points="35,60 47,50 60,60" fill="#ff948f" opacity="0.76" />
          <polygon points="35,60 47,70 60,60" fill="#c71022" opacity="0.84" />
          <polygon points="85,60 73,70 60,60" fill="#59000b" opacity="0.9" />
          <polygon points="60,92 73,70 60,60" fill="#330007" opacity="0.95" />
          {/* Incandescent 22K gold-white sovereign heart */}
          <polygon points="60,46 70,60 60,75 50,60" fill="#ffffff" opacity="0.92" />
          <polygon points="60,52 65.5,60 60,68.5 54.5,60" fill="#f0c869" />
          <polyline points="35,60 47,50 60,33 73,50 85,60" fill="none" stroke="#fff4d6" strokeWidth="0.9" opacity="0.86" />

          {/* Lower Sovereign Obsidian-Ruby Apex Finial */}
          <polygon points="60,101 66,109 60,118 54,109" fill="#08080a" />
          <polygon points="60,103 64.5,109 60,115.5 55.5,109" fill={`url(#${uid}-king-crimson)`} />
        </g>
      )}
      </g>

      {/* ==================== ALPHA-MASKED METALLIC SPECULAR SHEEN ==================== */}
      <g mask={`url(#${maskId})`} className="ow-sheen-group">
        <rect
          x="-60"
          y="-20"
          width="58"
          height="160"
          fill={sheenG}
          className="ow-sheen-bar"
        />
      </g>

      {/* ==================== FOREGROUND FX: GLINTS & FORKED ELECTRIC LIGHTNING ==================== */}
      {tierId === "diamond" && (
        <>
          <g className="ow-lightning-layer ow-lightning-diamond">
            <LightningBolt
              d="M17,47 L26,41 L24,50 L32,45"
              color={p.boltColor}
              className="ow-bolt-diamond-a"
              width={1.65}
            />
            <LightningBolt
              d="M103,73 L94,79 L96,70 L88,75"
              color={p.boltColor}
              className="ow-bolt-diamond-b"
              width={1.65}
            />
          </g>
          <StarGlint cx={46} cy={41} r={8} color="#ffffff" className="ow-glint-1" />
          <StarGlint cx={77} cy={69} r={6} color="#bae2ff" className="ow-glint-2" />
        </>
      )}

      {tierId === "master" && (
        <>
          <g className="ow-lightning-layer">
            <LightningBolt
              d="M15,24 L27,32 L21,44 L33,54 M27,32 L38,24"
              color={p.boltColor}
              className="ow-bolt-a"
              width={2.2}
            />
            <LightningBolt
              d="M105,96 L93,88 L99,76 L87,66 M93,88 L82,96"
              color={p.boltAlt!}
              className="ow-bolt-b"
              width={2.2}
            />
          </g>
          <StarGlint cx={52} cy={49} r={7} color="#ffffff" className="ow-glint-1" />
          <StarGlint cx={72} cy={70} r={5} color="#f6c2ff" className="ow-glint-2" />
        </>
      )}

      {tierId === "grandmaster" && (
        <>
          <g className="ow-lightning-layer ow-lightning-gm">
            <LightningBolt
              d="M6,23 L22,35 L13,47 L28,58 L15,74 L30,87 M22,35 L34,30 M13,47 L5,55"
              color={p.boltAlt!}
              className="ow-bolt-a"
              width={2.6}
            />
            <LightningBolt
              d="M114,23 L98,35 L107,47 L92,58 L105,74 L90,87 M98,35 L86,30 M107,47 L115,55"
              color={p.boltColor}
              className="ow-bolt-b"
              width={2.6}
            />
            <LightningBolt
              d="M27,15 L44,25 L40,33 L60,18 L80,33 L76,25 L93,15"
              color={p.boltAlt!}
              className="ow-bolt-c"
              width={2.2}
            />
          </g>
          <StarGlint cx={50} cy={45} r={7.5} color="#fff9eb" className="ow-glint-1" />
          <StarGlint cx={74} cy={67} r={5.5} color="#ffd073" className="ow-glint-2" />
        </>
      )}

      {tierId === "king" && (
        <>
          <g className="ow-lightning-layer ow-lightning-king">
            <LightningBolt
              d="M4,29 L20,41 L10,52 L25,65 L14,79 L30,93 M20,41 L33,36 M10,52 L3,60"
              color={p.boltColor}
              className="ow-bolt-a"
              width={2.8}
            />
            <LightningBolt
              d="M116,29 L100,41 L110,52 L95,65 L106,79 L90,93 M100,41 L87,36 M110,52 L117,60"
              color={p.boltAlt!}
              className="ow-bolt-b"
              width={2.8}
            />
            <LightningBolt
              d="M22,12 L38,21 L35,29 L51,16 L60,23 L69,16 L85,29 L82,21 L98,12"
              color={p.boltColor}
              className="ow-bolt-c"
              width={2.3}
            />
            <LightningBolt
              d="M26,86 L43,98 L40,106 L60,117 L80,106 L77,98 L94,86"
              color={p.boltAlt!}
              className="ow-bolt-d"
              width={2.2}
            />
          </g>
          <StarGlint cx={49} cy={49} r={8} color="#fff8e0" className="ow-glint-1" />
          <StarGlint cx={74} cy={70} r={6.5} color="#ecc363" className="ow-glint-2" />
          <StarGlint cx={60} cy={14} r={5.5} color="#eb3b44" className="ow-glint-3" />
        </>
      )}
    </svg>
  );
}
