import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE,PUT,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toStr = (v: any, fallback = "") => (typeof v === "string" ? v : fallback);

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

/* =========================================================
   DELETE — soft delete (author only)
   ========================================================= */
export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing" }, 500);

    const postId = toNum((params as any)?.id, 0);
    const headerUserId = toNum(request.headers.get("x-user-id"), 0);

    const url = new URL(request.url);
    const queryUserId = toNum(url.searchParams.get("user_id"), 0);
    const userId = headerUserId || queryUserId || 0;

    if (!postId) return json({ success: false, error: "Invalid post id" }, 400);
    if (!userId) return json({ success: false, error: "Login required" }, 401);

    const post = await env.DB
      .prepare(
        `SELECT id, user_id FROM posts
         WHERE id = ? AND COALESCE(is_deleted, 0) = 0
         LIMIT 1`
      )
      .bind(postId)
      .first<any>();

    if (!post) return json({ success: false, error: "Post not found" }, 404);
    if (toNum(post.user_id) !== userId) {
      return json({ success: false, error: "Not allowed" }, 403);
    }

    await env.DB
      .prepare(
        `UPDATE posts
         SET is_deleted = 1,
             deleted_by = ?,
             deleted_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(userId, postId)
      .run();

    return json({
      success: true,
      post_id: postId,
      deleted: true,
      deleted_by: userId,
    });
  } catch (err: any) {
    return json({ success: false, error: err?.message || "Failed to delete post" }, 500);
  }
};

/* =========================================================
   PUT / PATCH — edit post (author only)
   Accepts any subset of: content, media_url, media_type,
   media_urls, media_types, media_meta, visibility, brand_id
   ========================================================= */
const handleEdit = async (request: Request, env: Env, params: any): Promise<Response> => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing" }, 500);

    const postId = toNum(params?.id, 0);
    const headerUserId = toNum(request.headers.get("x-user-id"), 0);

    const body: any = await request.json().catch(() => ({}));
    const bodyUserId = toNum(body.user_id, 0);
    const userId = headerUserId || bodyUserId || 0;

    if (!postId) return json({ success: false, error: "Invalid post id" }, 400);
    if (!userId) return json({ success: false, error: "Login required" }, 401);

    const post = await env.DB
      .prepare(
        `SELECT id, user_id FROM posts
         WHERE id = ? AND COALESCE(is_deleted, 0) = 0
         LIMIT 1`
      )
      .bind(postId)
      .first<any>();

    if (!post) return json({ success: false, error: "Post not found" }, 404);
    if (toNum(post.user_id) !== userId) {
      return json({ success: false, error: "Not allowed" }, 403);
    }

    // -------- Build dynamic UPDATE from provided fields --------
    const updates: string[] = [];
    const bindings: any[] = [];

    // Text content (accept "content" or "text")
    if (body.content !== undefined || body.text !== undefined) {
      const content = toStr(body.content ?? body.text, "").trim();
      if (content.length > 5000) {
        return json({ success: false, error: "Content is too long" }, 400);
      }
      updates.push("content = ?");
      bindings.push(content);
    }

    // Primary media
    if (body.media_url !== undefined) {
      updates.push("media_url = ?");
      bindings.push(toStr(body.media_url, "").trim() || null);
    }
    if (body.media_type !== undefined) {
      updates.push("media_type = ?");
      bindings.push(toStr(body.media_type, "").trim() || null);
    }

    // Multi media (JSON strings)
    if (body.media_urls !== undefined) {
      updates.push("media_urls = ?");
      bindings.push(
        typeof body.media_urls === "string"
          ? body.media_urls
          : JSON.stringify(body.media_urls ?? [])
      );
    }
    if (body.media_types !== undefined) {
      updates.push("media_types = ?");
      bindings.push(
        typeof body.media_types === "string"
          ? body.media_types
          : JSON.stringify(body.media_types ?? [])
      );
    }
    if (body.media_meta !== undefined) {
      updates.push("media_meta = ?");
      bindings.push(
        typeof body.media_meta === "string"
          ? body.media_meta
          : JSON.stringify(body.media_meta ?? {})
      );
    }

    // Visibility
    if (body.visibility !== undefined) {
      const visibility = toStr(body.visibility, "").trim();
      const allowed = new Set(["Public", "Private", "Friends", "Group"]);
      if (!allowed.has(visibility)) {
        return json({ success: false, error: "Invalid visibility" }, 400);
      }
      updates.push("visibility = ?");
      bindings.push(visibility);
    }

    // Brand
    if (body.brand_id !== undefined) {
      updates.push("brand_id = ?");
      bindings.push(body.brand_id === null ? null : toNum(body.brand_id, 0));
    }

    if (!updates.length) {
      return json(
        { success: false, error: "Nothing to update" },
        400
      );
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");

    const sql = `UPDATE posts SET ${updates.join(", ")} WHERE id = ?`;
    bindings.push(postId);

    await env.DB.prepare(sql).bind(...bindings).run();

    const updated = await env.DB
      .prepare(
        `SELECT
           id, user_id, content, media_url, media_type, media_urls, media_types,
           media_meta, visibility, brand_id, is_boosted, views, shares,
           created_at, updated_at
         FROM posts
         WHERE id = ?
         LIMIT 1`
      )
      .bind(postId)
      .first();

    return json({ success: true, post: updated ?? null });
  } catch (err: any) {
    return json({ success: false, error: err?.message || "Failed to edit post" }, 500);
  }
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) =>
  handleEdit(request, env, params);

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) =>
  handleEdit(request, env, params);
