import test from "node:test";
import assert from "node:assert/strict";
import { shuffleAndSampleGallery, type HomeGalleryItem } from "../lib/gallery.ts";
import {
  buildRandomOrder,
  GALLERY_MEME_ANALYSES,
  getGalleryMemeAnalysis,
} from "../lib/gallery-memes.ts";

const makePool = (count: number): HomeGalleryItem[] =>
  Array.from({ length: count }, (_, idx) => ({
    id: `${idx}`.padStart(64, "0"),
    createdAt: 1_700_000_000_000 + idx * 1000,
    league: idx % 2 === 0 ? "football" : "badminton",
  }));

test("shuffleAndSampleGallery returns a random subset without mutating input", () => {
  const pool = makePool(25);
  const snapshot = pool.map((item) => item.id);
  let seed = 42;
  const deterministicRandom = () => {
    seed = (seed * 1664525 + 1013904223) % 0x100000000;
    return seed / 0x100000000;
  };

  const sampled = shuffleAndSampleGallery(pool, 16, deterministicRandom);
  assert.equal(sampled.length, 16);
  assert.equal(new Set(sampled.map((item) => item.id)).size, 16);
  assert.deepEqual(
    pool.map((item) => item.id),
    snapshot,
  );
});

test("buildRandomOrder avoids repeating the previous item at cycle boundary", () => {
  for (let avoid = 0; avoid < 8; avoid++) {
    const order = buildRandomOrder(8, avoid, () => 0);
    assert.equal(order.length, 8);
    assert.equal(new Set(order).size, 8);
    assert.notEqual(order[0], avoid);
  }
  assert.deepEqual(buildRandomOrder(0), []);
  assert.deepEqual(buildRandomOrder(1, 0), [0]);
});

test("all pre-authored Gemini meme analyses are complete and fallback works for new photos", () => {
  const entries = Object.entries(GALLERY_MEME_ANALYSES);
  assert.equal(entries.length, 25);
  for (const [id, analysis] of entries) {
    assert.match(id, /^[0-9a-f]{64}$/);
    assert.ok(analysis.title.length > 0);
    assert.ok(analysis.tags.length >= 2);
    assert.ok(analysis.punchline.length > 10);
    assert.ok(analysis.analysis.length > 10);
    assert.ok(analysis.verdict.length > 5);
  }

  const unknownFootball = getGalleryMemeAnalysis({
    id: "f".repeat(64),
    createdAt: Date.now(),
    league: "football",
  });
  assert.ok(unknownFootball.title.includes("G超"));

  const unknownBadminton = getGalleryMemeAnalysis({
    id: "e".repeat(64),
    createdAt: Date.now(),
    league: "badminton",
  });
  assert.ok(unknownBadminton.title.includes("GB"));
});
