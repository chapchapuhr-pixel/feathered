// functions/api/songs.ts
import type { PagesFunction } from "@cloudflare/workers-types";
import { withNewContentId } from "../utils/ids";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

// ...existing helpers (json, safeStr, safeNum, DEFAULT_SONG_COVER)...

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

/* ---------- POST ---------- */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // ... your existing POST code unchanged ...
};

/* ---------- GET ---------- */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  // ... your existing GET code + is_deleted filter ...
};

/* ---------- DELETE ---------- */
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing" }, 500);

    const url = new URL(request.url);
    const songId = Number(url.searchParams.get("id") || 0);

    const headerUserId = Number(request.headers.get("x-user-id") || 0);
    const queryUserId = Number(url.searchParams.get("user_id") || 0);
    const userId = headerUserId || queryUserId || 0;

    if (!songId) return json({ success: false, error: "Invalid song id" }, 400);
    if (!userId) return json({ success: false, error: "Login required" }, 401);

    const song = await env.DB
      .prepare(
        `SELECT id, uploader_id FROM songs
         WHERE id = ? AND COALESCE(is_deleted, 0) = 0
         LIMIT 1`
      )
      .bind(songId)
      .first<any>();

    if (!song) return json({ success: false, error: "Song not found" }, 404);
    if (Number(song.uploader_id) !== userId) {
      return json({ success: false, error: "Not allowed" }, 403);
    }

    await env.DB
      .prepare(
        `UPDATE songs
         SET is_deleted = 1,
             deleted_by = ?,
             deleted_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(userId, songId)
      .run();

    return json({
      success: true,
      song_id: songId,
      deleted: true,
      deleted_by: userId,
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || "Failed to delete" }, 500);
  }
};
