import {
  GALLERY_MAX_BYTES,
  GALLERY_MAX_DIMENSION,
  GALLERY_ORIGINAL_MAX_BYTES,
  GALLERY_THUMB_MAX_BYTES,
  GALLERY_THUMB_MAX_DIMENSION,
  type GalleryPage,
  type GalleryPhoto,
} from "../../lib/gallery.ts";

const pageSize = 18;
const maxAlbumPhotos = 300;
const maxDailyPhotos = 50;
const maxAlbumBytes = 160_000_000;
const originalPartBytes = 500_000;
const maxUploadBytes = GALLERY_ORIGINAL_MAX_BYTES + GALLERY_THUMB_MAX_BYTES + 32_768;
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

function validJpeg(bytes: Uint8Array, maxDimension: number, allowMetadata = false) {
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
    if (!allowMetadata && (marker === 0xe1 || marker === 0xed)) return false;
    if (marker === 0xda) return frame && offset + 2 + length < bytes.length - 2;
    if (marker === 0xc0 || marker === 0xc2) {
      if (length < 8 || frame) return false;
      const height = bytes[offset + 5] * 256 + bytes[offset + 6];
      const width = bytes[offset + 7] * 256 + bytes[offset + 8];
      if (!width || !height || Math.max(width, height) > maxDimension || width * height > 50_000_000)
        return false;
      frame = true;
    }
    offset += length + 2;
  }
  return false;
}

function imageType(bytes: Uint8Array) {
  if (validJpeg(bytes, 10_000, true)) return "image/jpeg";
  if (bytes.length < 30) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dimensionsAllowed = (width: number, height: number) =>
    width > 0 && height > 0 && width <= 10_000 && height <= 10_000 && width * height <= 50_000_000;
  if (view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a &&
      view.getUint32(12) === 0x49484452 && dimensionsAllowed(view.getUint32(16), view.getUint32(20)))
    return "image/png";
  if (view.getUint32(0) !== 0x52494646 || view.getUint32(4, true) !== bytes.length - 8 || view.getUint32(8) !== 0x57454250)
    return null;
  const chunk = view.getUint32(12);
  if (chunk === 0x56503858) {
    const width = 1 + bytes[24] + bytes[25] * 256 + bytes[26] * 65_536;
    const height = 1 + bytes[27] + bytes[28] * 256 + bytes[29] * 65_536;
    return dimensionsAllowed(width, height) ? "image/webp" : null;
  }
  if (chunk === 0x5650384c && bytes[20] === 0x2f) {
    const packed = view.getUint32(21, true);
    return dimensionsAllowed((packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1) ? "image/webp" : null;
  }
  if (chunk === 0x56503820 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a &&
      dimensionsAllowed(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff))
    return "image/webp";
  return null;
}

async function readUpload(request: Request, contentType: string) {
  if (Number(request.headers.get("Content-Length")) > maxUploadBytes) {
    await request.body?.cancel();
    return error("原图最多 8 MB，请换一张试试", 413);
  }
  if (!request.body) return error("请选择要上传的照片", 400);
  let size = 0;
  const capped = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      size += chunk.byteLength;
      if (size > maxUploadBytes) throw new RangeError("Photo upload is too large");
      controller.enqueue(chunk);
    },
  }));
  let form: FormData;
  try {
    form = await new Response(capped, { headers: { "Content-Type": contentType } }).formData();
  } catch {
    return size > maxUploadBytes
      ? error("原图最多 8 MB，请换一张试试", 413)
      : error("照片上传内容不完整，请重试", 400);
  }
  const thumbnail = form.get("thumbnail");
  const original = form.get("original");
  if (!(thumbnail instanceof Blob) || !(original instanceof Blob))
    return error("请选择要上传的照片", 400);
  if (original.size > GALLERY_ORIGINAL_MAX_BYTES || thumbnail.size > GALLERY_THUMB_MAX_BYTES)
    return error("原图最多 8 MB，请换一张试试", 413);
  const jpeg = new Uint8Array(await thumbnail.arrayBuffer());
  if (!validJpeg(jpeg, GALLERY_THUMB_MAX_DIMENSION)) return error("缩略图格式无效，请重新选择", 415);
  const bytes = new Uint8Array(await original.arrayBuffer());
  const mime = imageType(bytes);
  if (!mime) return error("请选择有效的 JPG、PNG 或 WebP 照片", 415);
  return { jpeg, original: bytes, mime };
}

function imageResponse(body: BodyInit, mime: string) {
  return new Response(body, {
    headers: { "Content-Type": mime, "Cache-Control": "public, max-age=120" },
  });
}

function streamOriginal(db: D1Database, league: string, id: string, size: number) {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const chunk = await db.prepare("SELECT bytes FROM gallery_original_parts WHERE league = ? AND id = ? AND part = ?")
        .bind(league, id, offset / originalPartBytes).first<number[]>("bytes");
      if (!chunk || chunk.length !== Math.min(originalPartBytes, size - offset)) {
        controller.error(new Error("Original image part is missing"));
        return;
      }
      controller.enqueue(new Uint8Array(chunk));
      offset += chunk.length;
      if (offset === size) controller.close();
    },
  });
}

async function storePhoto(
  db: D1Database,
  league: string,
  jpeg: Uint8Array<ArrayBuffer>,
  original?: Uint8Array<ArrayBuffer>,
  mime?: string,
) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", original ?? jpeg));
  const photoId = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  const originalSize = original?.byteLength ?? 0;
  const statements = [db.prepare(
    `INSERT INTO gallery_photos (league, id, created_at, jpeg, original_type, original_size)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6
     WHERE (SELECT COUNT(*) FROM gallery_photos WHERE league = ?1) < ?7
       AND (SELECT COUNT(*) FROM gallery_photos WHERE league = ?1 AND created_at >= ?8) < ?9
       AND (SELECT COALESCE(SUM(length(jpeg) + COALESCE(length(thumbnail), 0) + original_size), 0)
            FROM gallery_photos WHERE league = ?1) + ?10 <= ?11
     ON CONFLICT(league, id) DO NOTHING
     RETURNING id, created_at AS createdAt`,
  ).bind(league, photoId, now, jpeg.buffer, mime ?? null, originalSize, maxAlbumPhotos,
    now - dayMs, maxDailyPhotos, jpeg.byteLength + originalSize, maxAlbumBytes)];
  if (original) {
    const part = db.prepare(
      `INSERT INTO gallery_original_parts (league, id, part, bytes)
       SELECT ?1, ?2, ?3, unhex(?4)
       WHERE EXISTS (SELECT 1 FROM gallery_photos WHERE league = ?1 AND id = ?2 AND original_size = ?5)
       ON CONFLICT(league, id, part) DO NOTHING`,
    );
    for (let offset = 0; offset < original.length; offset += originalPartBytes) {
      // The Workers runtime supplies the native encoder. Text bindings avoid a JSON array per byte.
      const chunk = original.subarray(offset, offset + originalPartBytes) as Uint8Array & { toHex(): string };
      statements.push(part.bind(league, photoId, offset / originalPartBytes, chunk.toHex(), originalSize));
    }
  }
  const [insert] = await db.batch<GalleryPhoto>(statements);
  if (insert.results[0]) return Response.json(insert.results[0], { status: 201, headers: noStore });
  const existing = await db.prepare("SELECT id, created_at AS createdAt FROM gallery_photos WHERE league = ? AND id = ?")
    .bind(league, photoId).first<GalleryPhoto>();
  if (existing) return Response.json(existing, { headers: noStore });
  return error("这个图库的容量或近 24 小时上传额度已用完", 429);
}

export async function handleGallery(
  request: Request,
  db: D1Database,
  administrator: () => Promise<boolean>,
): Promise<Response> {
  const url = new URL(request.url);
  const route = /^\/api\/gallery\/(football|badminton)(?:\/([0-9a-f]{64})(\/thumbnail)?)?$/.exec(url.pathname);
  if (!route) return error("图库不存在", 404);
  const [, league, id, thumbnail] = route;

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
    if (thumbnail) {
      const jpeg = await db.prepare("SELECT COALESCE(thumbnail, jpeg) AS jpeg FROM gallery_photos WHERE league = ? AND id = ?")
        .bind(league, id).first<number[]>("jpeg");
      return jpeg ? imageResponse(new Uint8Array(jpeg), "image/jpeg") : error("照片不存在", 404);
    }
    const source = await db.prepare("SELECT original_type, original_size FROM gallery_photos WHERE league = ? AND id = ?")
      .bind(league, id).first<{ original_type: string | null; original_size: number }>();
    if (!source) return error("照片不存在", 404);
    if (source.original_type && source.original_size)
      return imageResponse(streamOriginal(db, league, id, source.original_size), source.original_type);
    const photo = await db.prepare("SELECT jpeg FROM gallery_photos WHERE league = ? AND id = ?")
      .bind(league, id).first<{ jpeg: number[] }>();
    if (!photo) return error("照片不存在", 404);
    return imageResponse(new Uint8Array(photo.jpeg), "image/jpeg");
  }

  if (request.method === "POST" && !id) {
    if (!request.headers.has("Origin")) return error("请从联赛网站上传照片", 403);
    const contentType = request.headers.get("Content-Type") ?? "";
    if (contentType.startsWith("multipart/form-data;")) {
      const upload = await readUpload(request, contentType);
      if (upload instanceof Response) return upload;
      return storePhoto(db, league, upload.jpeg, upload.original, upload.mime);
    }
    if (contentType !== "image/jpeg")
      return error("请通过图库页面选择照片并上传", 415);
    const bytes = await readPhoto(request);
    if (bytes instanceof Response) return bytes;
    if (!validJpeg(bytes, GALLERY_MAX_DIMENSION)) return error("照片格式无效，请重新选择", 415);
    return storePhoto(db, league, bytes);
  }

  if (request.method === "DELETE" && id && !thumbnail) {
    if (!(await administrator())) return error("请先登录联赛管理账号", 401);
    await db.prepare("DELETE FROM gallery_photos WHERE league = ? AND id = ?").bind(league, id).run();
    return new Response(null, { status: 204, headers: noStore });
  }
  return error("此操作不受支持", 405);
}
