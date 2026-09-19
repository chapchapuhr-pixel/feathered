// functions/api/posts/[id].ts
import type { PagesFunction } from "@cloudflare/workers-types";

type Env = {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;         // or remove if using Cloudinary
  MEDIA_PUBLIC_URL: string;       // e.g. https://cdn.example.com
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE,PUT,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

/* =========================================================
   HELPERS
========================================================= */
const MAX_FILES = 10;
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/webm", "video/quicktime",
];

const safeParse = (v: any, fallback: any = []) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return fallback; }
  }
  return fallback;
};

const extFromMime = (mime: string) =>
  mime.split("/")[1].replace("quicktime", "mov").replace("jpeg", "jpg");

async function uploadToR2(env: Env, file: File, postId: number) {
  const key = `posts/${postId}/${crypto.randomUUID()}.${extFromMime(file.type)}`;
  await env.MEDIA_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });
  return {
    key,
    url: `${env.MEDIA_PUBLIC_URL}/${key}`,
    type: file.type.startsWith("video") ? "video" : "image",
    mime: file.type,
    size: file.size,
  };
}

async function deleteFromR2(env: Env, url: string) {
  try {
    const key = url.replace(`${env.MEDIA_PUBLIC_URL}/`, "");
    await env.MEDIA_BUCKET.delete(key);
  } catch { /* swallow */ }
}

/* =========================================================
   DELETE POST
========================================================= */
export const onRequestDelete: PagesFunction<Env> = async ({
  request, env, params,
}) => {
  try {
    const postId = Number(params.id);
    const userId = Number(request.headers.get("x-user-id"));

    if (!postId) return json({ error: "Invalid post id" }, 400);
    if (!userId) return json({ error: "Login required" }, 401);

    const post: any = await env.DB.prepare(
      `SELECT user_id, media_url, media_urls FROM posts WHERE id=?`
    ).bind(postId).first();

    if (!post) return json({ error: "Post not found" }, 404);
    if (Number(post.user_id) !== userId)
      return json({ error: "Not allowed" }, 403);

    // 1. delete related rows
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM post_comments WHERE post_id=?`).bind(postId),
      env.DB.prepare(`DELETE FROM post_likes    WHERE post_id=?`).bind(postId),
      env.DB.prepare(`DELETE FROM post_shares   WHERE post_id=?`).bind(postId),
      env.DB.prepare(`DELETE FROM post_saves    WHERE post_id=?`).bind(postId),
    ]);

    // 2. delete post row
    await env.DB.prepare(`DELETE FROM posts WHERE id=?`).bind(postId).run();

    // 3. delete media from storage
    const urls: string[] = [];
    if (post.media_url) urls.push(post.media_url);
    urls.push(...safeParse(post.media_urls));
    await Promise.all(urls.map((u) => deleteFromR2(env, u)));

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};

/* =========================================================
   EDIT POST (PUT / PATCH)
========================================================= */
export const onRequestPut: PagesFunction<Env> = onRequestEdit;
export const onRequestPatch: PagesFunction<Env> = onRequestEdit;

const onRequestEdit: PagesFunction<Env> = async ({
  request, env, params,
}) => {
  try {
    const postId = Number(params.id);
    const userId = Number(request.headers.get("x-user-id"));
    if (!postId) return json({ error: "Invalid post id" }, 400);
    if (!userId) return json({ error: "Login required" }, 401);

    const post: any = await env.DB.prepare(
      `SELECT user_id, media_urls, media_types, media_meta FROM posts WHERE id=?`
    ).bind(postId).first();

    if (!post) return json({ error: "Post not found" }, 404);
    if (Number(post.user_id) !== userId)
      return json({ error: "Not allowed" }, 403);

    // ---- parse request: JSON or multipart ----
    const ct = request.headers.get("content-type") || "";
    let content = "";
    let visibility: string | undefined;
    let keepUrls: string[] = safeParse(post.media_urls);
    let mediaMeta: any[] = safeParse(post.media_meta);
    let newFiles: File[] = [];

    if (ct.includes("multipart/form-data")) {
      const form = await request.formData();
      content = String(form.get("content") || "").trim();
      visibility = form.get("visibility")?.toString();
      if (form.get("keep_media_urls"))
        keepUrls = safeParse(form.get("keep_media_urls"));
      if (form.get("media_meta"))
        mediaMeta = safeParse(form.get("media_meta"));
      newFiles = form.getAll("files").filter((f) => f instanceof File) as File[];
    } else {
      const body: any = await request.json();
      content = String(body.content || "").trim();
      visibility = body.visibility;
      if (body.keep_media_urls !== undefined)
        keepUrls = safeParse(body.keep_media_urls);
      if (body.media_meta !== undefined)
        mediaMeta = safeParse(body.media_meta);
    }

    // ---- validate new files ----
    if (newFiles.length > MAX_FILES)
      return json({ error: `Max ${MAX_FILES} files` }, 400);
    for (const f of newFiles) {
      if (f.size > MAX_SIZE) return json({ error: "File too large" }, 400);
      if (!ALLOWED.includes(f.type))
        return json({ error: `Unsupported type: ${f.type}` }, 400);
    }

    // ---- compute which old media to delete ----
    const oldUrls: string[] = safeParse(post.media_urls);
    const toDelete = oldUrls.filter((u) => !keepUrls.includes(u));

    // ---- upload new files ----
    const uploaded = await Promise.all(
      newFiles.map((f) => uploadToR2(env, f, postId))
    );

    // ---- merge final media list ----
    const finalUrls = [...keepUrls, ...uploaded.map((u) => u.url)];
    const finalTypes = [
      ...safeParse(post.media_types).filter((_: any, i: number) =>
        keepUrls.includes(oldUrls[i])
      ),
      ...uploaded.map((u) => u.type),
    ];
    const finalMeta = [
      ...mediaMeta.filter((m: any) => keepUrls.includes(m?.url)),
      ...uploaded.map((u) => ({
        url: u.url, mime: u.mime, size: u.size, type: u.type,
      })),
    ];

    // ---- build dynamic update ----
    const fields: string[] = ["content=?"];
    const values: any[] = [content];

    if (visibility) {
      fields.push("visibility=?");
      values.push(visibility);
    }

    fields.push("media_urls=?", "media_types=?", "media_meta=?");
    values.push(
      JSON.stringify(finalUrls),
      JSON.stringify(finalTypes),
      JSON.stringify(finalMeta),
    );

    // legacy single-media columns
    fields.push("media_url=?", "media_type=?");
    values.push(finalUrls[0] || null, finalTypes[0] || null);

    fields.push("edited_at=CURRENT_TIMESTAMP");
    values.push(postId);

    // ---- DB update ----
    await env.DB.prepare(
      `UPDATE posts SET ${fields.join(", ")} WHERE id=?`
    ).bind(...values).run();

    // ---- delete removed media from storage (after DB success) ----
    await Promise.all(toDelete.map((u) => deleteFromR2(env, u)));

    return json({
      success: true,
      post: {
        id: postId,
        content,
        visibility,
        media_urls: finalUrls,
        media_types: finalTypes,
        media_meta: finalMeta,
      },
    });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
