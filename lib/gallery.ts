export type GalleryLeague = "football" | "badminton";

export type GalleryPhoto = { id: string; createdAt: number };
export type GalleryPage = { photos: GalleryPhoto[]; next: string | null };

export const GALLERY_MAX_BYTES = 600_000;
export const GALLERY_MAX_DIMENSION = 1600;
export const GALLERY_THUMB_MAX_BYTES = 70_000;
export const GALLERY_THUMB_MAX_DIMENSION = 480;
export const GALLERY_ORIGINAL_MAX_BYTES = 8_000_000;
