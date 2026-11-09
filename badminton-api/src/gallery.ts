import {
  GALLERY_MAX_BYTES,
  GALLERY_MAX_DIMENSION,
  type GalleryPage,
  type GalleryPhoto,
} from "../../lib/gallery.ts";

const pageSize = 18;
const maxAlbumPhotos = 300;
const maxDailyPhotos = 50;
const dayMs = 24 * 60 * 60 * 1000;
const noStore = { "Cache-Control": "no-store" };
const error = (message: string, status: number) =>
  Response.json({ error: message }, { status, headers: noStore });

async function readPhoto(request: Request) {
  if (Number(request.headers.get("Content-Length")) > GALLERY_MAX_BYTES) {
    await request.body?.cancel();
    return error("照片压缩后仍超过 600 KB，请换一张试试", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) return error("请选择要上传的照片", 400);
  const bytes = new Uint8Array(GALLERY_MAX_BYTES);
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > bytes.byteLength) {
      await reader.cancel();
      return error("照片压缩后仍超过 600 KB，请换一张试试", 413);
    }
    bytes.set(value, size);
    size += value.byteLength;
  }
  return bytes.slice(0, size);
}

function validJpeg(bytes: Uint8Array) {
  if (
    bytes.length < 20 || bytes[0] !== 0xff || bytes[1] !== 0xd8 ||
    bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9
  ) return false;
  let frame = false;
  let offset = 2;
  while (offset + 4 < bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset++;
      continue;
    }
    const length = bytes[offset + 2] * 256 + bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length - 2) return false;
    if (marker === 0xe1 || marker === 0xed) return false;
    if (marker === 0xda) return frame && offset + 2 + length < bytes.length - 2;
    if (marker === 0xc0 || marker === 0xc2) {
      if (length < 8 || frame) return false;
      const height = bytes[offset + 5] * 256 + bytes[offset + 6];
      const width = bytes[offset + 7] * 256 + bytes[offset + 8];
      if (!width || !height || Math.max(width, height) > GALLERY_MAX_DIMENSION)
        return false;
      frame = true;
    }
    offset += length + 2;
  }
  return false;
}

export async function handleGallery(
  request: Request,
  db: D1Database,
  administrator: () => Promise<boolean>,
): Promise<Response> {
  const url = new URL(request.url);
  const route = /^\/api\/gallery\/(football|badminton)(?:\/([0-9a-f]{64}))?$/.exec(url.pathname);
  if (!route) return error("图库不存在", 404);
  const [, league, id] = route;

  if (request.method === "GET" && !id) {
    const before = url.searchParams.get("before");
    const cursor = before === null ? null : /^(\d{1,13})\.([0-9a-f]{64})$/.exec(before);
    if (before !== null && !cursor) return error("分页位置无效，请刷新后重试", 400);
    const { results } = await db.prepare(
      `SELECT id, created_at AS createdAt FROM gallery_photos
       WHERE league = ?1 AND (created_at, id) < (?2, ?3)
       ORDER BY created_at DESC, id DESC LIMIT ?4`,
    ).bind(league, cursor ? Number(cursor[1]) : 9_999_999_999_999, cursor?.[2] ?? "", pageSize + 1)
      .all<GalleryPhoto>();
    const photos = results.slice(0, pageSize);
    const last = photos.at(-1);
    const page: GalleryPage = {
      photos,
      next: results.length > pageSize && last ? `${last.createdAt}.${last.id}` : null,
    };
    return Response.json(page, { headers: noStore });
  }

  if (request.method === "GET" && id) {
    const photo = await db.prepare("SELECT jpeg FROM gallery_photos WHERE league = ? AND id = ?")
      .bind(league, id).first<{ jpeg: number[] }>();
    if (!photo) return error("照片不存在", 404);
    return new Response(new Uint8Array(photo.jpeg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=120" },
    });
  }

  if (request.method === "POST" && !id) {
    if (!request.headers.has("Origin")) return error("请从联赛网站上传照片", 403);
    if (request.headers.get("Content-Type") !== "image/jpeg")
      return error("请通过图库页面选择照片并上传", 415);
    const bytes = await readPhoto(request);
    if (bytes instanceof Response) return bytes;
    if (!validJpeg(bytes)) return error("照片格式无效，请重新选择", 415);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const photoId = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const now = Date.now();
    const inserted = await db.prepare(
      `INSERT INTO gallery_photos (league, id, created_at, jpeg)
       SELECT ?1, ?2, ?3, ?4
       WHERE (SELECT COUNT(*) FROM gallery_photos WHERE league = ?1) < ?5
         AND (SELECT COUNT(*) FROM gallery_photos WHERE league = ?1 AND created_at >= ?6) < ?7
       ON CONFLICT(league, id) DO NOTHING
       RETURNING id, created_at AS createdAt`,
    ).bind(league, photoId, now, bytes.buffer, maxAlbumPhotos, now - dayMs, maxDailyPhotos)
      .first<GalleryPhoto>();
    if (inserted) return Response.json(inserted, { status: 201, headers: noStore });
    const existing = await db.prepare("SELECT id, created_at AS createdAt FROM gallery_photos WHERE league = ? AND id = ?")
      .bind(league, photoId).first<GalleryPhoto>();
    if (existing) return Response.json(existing, { headers: noStore });
    return error("这个图库的容量或近 24 小时上传额度已用完", 429);
  }

  if (request.method === "DELETE" && id) {
    if (!(await administrator())) return error("请先登录联赛管理账号", 401);
    await db.prepare("DELETE FROM gallery_photos WHERE league = ? AND id = ?").bind(league, id).run();
    return new Response(null, { status: 204, headers: noStore });
  }
  return error("此操作不受支持", 405);
}
