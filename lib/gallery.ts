export type GalleryLeague = "football" | "badminton";

export type GalleryPhoto = { id: string; createdAt: number };
export type GalleryPage = { photos: GalleryPhoto[]; next: string | null };
export type HomeGalleryItem = GalleryPhoto & { league: GalleryLeague };

export const GALLERY_MAX_BYTES = 600_000;
export const GALLERY_MAX_DIMENSION = 1600;
export const GALLERY_THUMB_MAX_BYTES = 70_000;
export const GALLERY_THUMB_MAX_DIMENSION = 480;
export const GALLERY_ORIGINAL_MAX_BYTES = 8_000_000;

export function shuffleAndSampleGallery<T>(
  pool: readonly T[],
  limit = 16,
  random: () => number = Math.random,
): T[] {
  if (limit <= 0 || pool.length === 0) return [];
  const copy = pool.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy.slice(0, limit);
}
