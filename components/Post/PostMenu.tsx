import React, { useState, useRef, useEffect } from "react";
import { performPostAction } from "../../postActionRegistry";
import { EditPostModal } from "./EditPostModal";
import { Edit, Trash2, Share2, Flag, AlertCircle, Loader2 } from "lucide-react";

export type PostMenuProps = {
  item: any;
  currentUser?: any;
  onShare?: (post: any) => void;
  onDeleteSuccess?: (deletedId: number | string) => void;
  onEditSuccess?: (updatedItem: any) => void;
  className?: string;
  align?: "left" | "right";
};

export const PostMenu: React.FC<PostMenuProps> = ({
  item,
  currentUser,
  onShare,
  onDeleteSuccess,
  onEditSuccess,
  className = "",
  align = "right",
}) => {
  const [open, setOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const itemId = item.id || item.post_id || item.event_id || item.song_id;
  const currentUserId = currentUser ? Number(currentUser.id) : null;
  const itemOwnerId = Number(
    item.user_id ?? item.creator_id ?? item.author_id ?? item.userId ?? item.author?.id ?? 0
  );

  const isOwner = Boolean(currentUserId && currentUserId === itemOwnerId);
  const isEvent = item.type === "event" || Boolean(item.event_date);
  const isSong = item.type === "song" || Boolean(item.song_url || item.audio_url);
  const isProduct =
    item.type === "product" ||
    Boolean(item.product_id) ||
    Boolean(item.seller_id) ||
    Boolean(item.main_price !== undefined || item.price !== undefined);
  const isStory = item.type === "story" || Boolean(item.story_id);
  const canEdit = isOwner && !isSong && !isStory;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  // ----------------------------
  // Edit
  // ----------------------------
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    setIsEditModalOpen(true);
  };

  const handleEditSaved = (updated: any) => {
    onEditSuccess?.(updated);
    try {
      performPostAction(item.type || "post", "edit", {
        id: itemId,
        ...updated,
      });
    } catch {
      // ignore if registry not populated
    }
  };

  // ----------------------------
  // Delete
  // ----------------------------
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    const uid = currentUserId || itemOwnerId;

    // Trigger visual deleting animation immediately on the feed item card
    window.dispatchEvent(new CustomEvent("post-deleting", { detail: { id: itemId } }));
    window.dispatchEvent(new CustomEvent("product-deleting", { detail: { id: itemId } }));
    window.dispatchEvent(new CustomEvent("event-deleting", { detail: { id: itemId } }));
    window.dispatchEvent(new CustomEvent("song-deleting", { detail: { id: itemId } }));

    // Keep confirm modal open briefly to show the deleting animation feedback
    await new Promise((res) => setTimeout(res, 260));
    setShowDeleteConfirm(false);

    // Trigger optimistic removal
    onDeleteSuccess?.(itemId);

    try {
      if (isSong) {
        // Songs posts: DELETE /api/songs?id=${songId}&user_id=${userId}
        window.dispatchEvent(new CustomEvent("song-deleted", { detail: { id: itemId } }));
        await fetch(`/api/songs?id=${itemId}&user_id=${uid}`, {
          method: "DELETE",
          headers: {
            "x-user-id": String(uid),
          },
        });
      } else if (isProduct) {
        // Products posts: DELETE /api/products?id=${productId}&user_id=${userId}
        window.dispatchEvent(new CustomEvent("product-deleted", { detail: { id: itemId } }));
        window.dispatchEvent(new CustomEvent("post-deleted", { detail: { id: itemId } }));
        await fetch(`/api/products?id=${itemId}&user_id=${uid}`, {
          method: "DELETE",
          headers: {
            "x-user-id": String(uid),
          },
        });
      } else if (isStory) {
        // Stories: DELETE /api/stories/:id?user_id=X
        window.dispatchEvent(new CustomEvent("story-deleted", { detail: { id: itemId } }));
        await fetch(`/api/stories/${itemId}?user_id=${uid}`, {
          method: "DELETE",
          headers: {
            "x-user-id": String(uid),
          },
        });
      } else if (isEvent) {
        // Events posts: DELETE /api/events/${event.id}?user_id=${currentUserId}
        window.dispatchEvent(new CustomEvent("event-deleted", { detail: { id: itemId } }));
        window.dispatchEvent(new CustomEvent("post-deleted", { detail: { id: itemId } }));
        await fetch(`/api/events/${itemId}?user_id=${uid}`, {
          method: "DELETE",
          headers: {
            "x-user-id": String(uid),
          },
        });
      } else {
        // Normal Post/Videos: DELETE /api/posts/:id?user_id=X
        window.dispatchEvent(new CustomEvent("post-deleted", { detail: { id: itemId } }));
        await fetch(`/api/posts/${itemId}?user_id=${uid}`, {
          method: "DELETE",
          headers: {
            "x-user-id": String(uid),
          },
        });
      }

      // Also invoke registry if configured
      try {
        performPostAction(item.type || "post", "delete", {
          id: itemId,
          groupId: item.group_id,
        });
      } catch {
        // fallback
      }
    } catch (err) {
      console.error("Failed to delete post:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // ----------------------------
  // Share
  // ----------------------------
  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    if (onShare) {
      onShare(item);
    } else {
      try {
        performPostAction(item.type || "post", "share", { id: itemId });
      } catch {
        // fallback
      }
    }
  };

  // ----------------------------
  // Report
  // ----------------------------
  const handleReport = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    try {
      performPostAction(item.type || "post", "report", {
        id: itemId,
        type: item.type || "post",
      });
    } catch {
      // fallback
    }
    alert("Thank you. This report has been submitted to moderators.");
  };

  return (
    <>
      <div className={`relative ${className}`} ref={menuRef} onClick={(e) => e.stopPropagation()}>
        {/* Three dot button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC] transition active:scale-95"
          aria-label="Post actions"
        >
          <i className="fas fa-ellipsis-h text-sm"></i>
        </button>

        {open && (
          <div
            className={`absolute ${
              align === "left" ? "left-0" : "right-0"
            } mt-1.5 w-48 bg-[#0F172A] border border-[#1E293B] rounded-xl shadow-2xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-150`}
          >
            {/* Edit (Post Owner Only, not allowed for Songs/Stories) */}
            {canEdit && (
              <button
                type="button"
                onClick={handleEditClick}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-[#1E293B] text-[#F8FAFC] transition-colors group"
              >
                <Edit className="w-4 h-4 text-[#1877F2] group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">
                  {isProduct ? "Edit Product" : isEvent ? "Edit Event" : "Edit Post"}
                </span>
              </button>
            )}

            {/* Delete (Post Owner Only) */}
            {isOwner && (
              <button
                type="button"
                onClick={handleDeleteClick}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-rose-500/10 text-rose-400 transition-colors group"
              >
                <Trash2 className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">
                  {isProduct ? "Delete Product" : isSong ? "Delete Song" : isStory ? "Delete Story" : isEvent ? "Delete Event" : "Delete Post"}
                </span>
              </button>
            )}

            {/* Divider if owner */}
            {isOwner && <div className="h-[1px] bg-[#1E293B] my-1"></div>}

            {/* Share (Available to everyone) */}
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-[#1E293B] text-[#F8FAFC] transition-colors group"
            >
              <Share2 className="w-4 h-4 text-[#94A3B8] group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Share</span>
            </button>

            {/* Report Post (Non-Owner Only) */}
            {!isOwner && (
              <button
                type="button"
                onClick={handleReport}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-[#1E293B] text-amber-400 transition-colors group"
              >
                <Flag className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">Report Post</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Professional Instagram-Style Edit Modal */}
      {isEditModalOpen && (
        <EditPostModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          post={item}
          currentUser={currentUser}
          onSaveSuccess={handleEditSaved}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-sm bg-[#0D1527] border border-[#1E293B] rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-500/15 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#F8FAFC]">
                {isSong ? "Delete Song?" : isEvent ? "Delete Event?" : "Delete Post?"}
              </h3>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Are you sure you want to permanently delete this {isSong ? "song" : isEvent ? "event" : "post"}? This action cannot be undone.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-[#1E293B] hover:bg-[#27354D] text-[#CBD5E1] text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className={`flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 shadow-lg shadow-rose-600/30 active:scale-95 ${
                  isDeleting ? 'animate-pulse bg-rose-700 opacity-95 scale-[0.98]' : ''
                }`}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
