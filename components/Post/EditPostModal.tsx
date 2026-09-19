import React, { useState, useRef, useEffect } from 'react';
import { X, Image as ImageIcon, Film, Plus, Trash2, Calendar, MapPin, Globe, Loader2, Check } from 'lucide-react';
import { User } from '../../types';

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: any;
  currentUser: User | null;
  onSaveSuccess?: (updatedPost: any) => void;
}

const EMOJIS = ['❤️', '🔥', '✨', '👏', '🙌', '😍', '🎉', '💯'];

export const EditPostModal: React.FC<EditPostModalProps> = ({
  isOpen,
  onClose,
  post,
  currentUser,
  onSaveSuccess,
}) => {
  if (!isOpen || !post) return null;

  const isEvent = post.type === 'event' || post.item_type === 'event' || Boolean(post.event_date);
  const postId = post.id || post.post_id || post.event_id;

  // Text / Caption state
  const [content, setContent] = useState<string>(() => {
    return post.content || post.caption || post.description || post.text || '';
  });

  // Event specific fields
  const [eventTitle, setEventTitle] = useState<string>(() => post.title || '');
  const [eventDate, setEventDate] = useState<string>(() => {
    if (!post.event_date) return '';
    try {
      const d = new Date(post.event_date);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 16);
      }
    } catch {
      // fallback
    }
    return String(post.event_date || '');
  });
  const [eventLocation, setEventLocation] = useState<string>(() => post.location || '');
  const [eventVisibility, setEventVisibility] = useState<string>(() => post.visibility || 'public');
  const [eventCoverUrl, setEventCoverUrl] = useState<string>(() => post.cover_url || post.coverUrl || '');

  // Media items state (for posts and videos)
  const [existingMedia, setExistingMedia] = useState<any[]>(() => {
    if (Array.isArray(post.media) && post.media.length > 0) {
      return post.media;
    }
    if (Array.isArray(post.media_urls) && post.media_urls.length > 0) {
      return post.media_urls.map((url: string) => (typeof url === 'string' ? { url, type: url.endsWith('.mp4') ? 'video' : 'image' } : url));
    }
    if (post.video_url || post.videoUrl) {
      return [{ url: post.video_url || post.videoUrl, type: 'video' }];
    }
    if (post.image_url || post.imageUrl) {
      return [{ url: post.image_url || post.imageUrl, type: 'image' }];
    }
    return [];
  });

  // Newly attached local files
  const [newFiles, setNewFiles] = useState<{ file: File; preview: string; type: 'image' | 'video' }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      newFiles.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, [newFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const added: { file: File; preview: string; type: 'image' | 'video' }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith('video/');
      const preview = URL.createObjectURL(file);
      added.push({ file, preview, type: isVideo ? 'video' : 'image' });
    }
    setNewFiles((prev) => [...prev, ...added]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        const uploadedUrl = data.url || data.media_urls?.full || data.uploaded?.original?.url || '';
        if (uploadedUrl) {
          setEventCoverUrl(uploadedUrl);
        }
      }
    } catch {
      // local preview fallback
      setEventCoverUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveExistingMedia = (index: number) => {
    setExistingMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNewFile = (index: number) => {
    setNewFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleInsertEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
  };

  // Upload helper for newly attached files
  const uploadNewFiles = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    for (const item of newFiles) {
      try {
        const fd = new FormData();
        fd.append('file', item.file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (res.ok) {
          const data = await res.json();
          const url = data.url || data.media_urls?.full || data.uploaded?.original?.url || item.preview;
          uploadedUrls.push(url);
        } else {
          uploadedUrls.push(item.preview);
        }
      } catch {
        uploadedUrls.push(item.preview);
      }
    }
    return uploadedUrls;
  };

  const handleSave = async () => {
    setIsUploading(true);
    setErrorMsg(null);

    const userId = currentUser ? currentUser.id : post.user_id;

    try {
      if (isEvent) {
        // Event Edit Endpoint:
        // PATCH /api/events/${event.id}
        // body: { title, description, event_date, location, cover_url, visibility }
        const eventPayload = {
          title: eventTitle.trim() || post.title || 'Untitled Event',
          description: content.trim(),
          event_date: eventDate || post.event_date,
          location: eventLocation.trim(),
          cover_url: eventCoverUrl || post.cover_url,
          visibility: eventVisibility,
        };

        const res = await fetch(`/api/events/${postId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(userId ? { 'x-user-id': String(userId) } : {}),
          },
          body: JSON.stringify(eventPayload),
        });

        const updatedEvent = {
          ...post,
          ...eventPayload,
          id: postId,
        };

        // Notify and trigger events
        onSaveSuccess?.(updatedEvent);
        window.dispatchEvent(new CustomEvent('event-updated', { detail: updatedEvent }));
        window.dispatchEvent(new CustomEvent('post-updated', { detail: updatedEvent }));
        onClose();
        return;
      }

      // Regular Post / Video Edit
      // Upload any new media attachments first
      const uploadedMediaUrls = await uploadNewFiles();
      const preservedMedia = existingMedia.map((m) => (typeof m === 'string' ? m : m.url || m));
      const allMediaUrls = [...preservedMedia, ...uploadedMediaUrls];

      const postPayload: any = {
        content: content.trim(),
        caption: content.trim(),
      };

      if (allMediaUrls.length > 0) {
        postPayload.media_urls = allMediaUrls;
        postPayload.media = allMediaUrls.map((url) => ({
          url,
          type: url.endsWith('.mp4') || url.includes('video') ? 'video' : 'image',
        }));
      }

      // PATCH /api/posts/:id (Author only)
      await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': String(userId) } : {}),
        },
        body: JSON.stringify(postPayload),
      });

      const updatedPost = {
        ...post,
        ...postPayload,
        id: postId,
      };

      onSaveSuccess?.(updatedPost);
      window.dispatchEvent(new CustomEvent('post-updated', { detail: updatedPost }));
      onClose();
    } catch (err: any) {
      console.error('Failed to update post:', err);
      setErrorMsg(err.message || 'Failed to update. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const authorName = post.author?.name || post.user?.name || currentUser?.name || 'You';
  const authorAvatar =
    post.author?.profile_image_url ||
    post.user?.profile_image_url ||
    currentUser?.profile_image_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=1877F2&color=fff`;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#0D1527] border border-[#1E293B] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Instagram-style Navigation Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E293B] bg-[#0A0F1D]">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
          >
            Cancel
          </button>

          <h2 className="text-base font-bold text-[#F8FAFC]">
            {isEvent ? 'Edit Event' : 'Edit Post'}
          </h2>

          <button
            type="button"
            onClick={handleSave}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1877F2] hover:bg-[#166FE5] text-white text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Done</span>
              </>
            )}
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Author Card Profile Info */}
          <div className="flex items-center gap-3">
            <img
              src={authorAvatar}
              alt={authorName}
              className="w-10 h-10 rounded-full object-cover border border-[#1E293B]"
            />
            <div>
              <div className="font-bold text-[#F8FAFC] text-[15px] leading-tight">{authorName}</div>
              <div className="text-xs text-[#94A3B8]">
                {isEvent ? 'Event Organizer' : 'Original Author'}
              </div>
            </div>
          </div>

          {/* Event Specific Editable Fields */}
          {isEvent && (
            <div className="space-y-3 p-3.5 rounded-xl bg-[#0F172A]/70 border border-[#1E293B]">
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="What is the event called?"
                  className="w-full bg-[#1E293B]/70 border border-[#334155] rounded-lg px-3 py-2 text-sm text-[#F8FAFC] focus:outline-none focus:border-[#1877F2]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#1877F2]" />
                    <span>Date & Time</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-[#1E293B]/70 border border-[#334155] rounded-lg px-3 py-2 text-xs text-[#F8FAFC] focus:outline-none focus:border-[#1877F2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    <span>Location</span>
                  </label>
                  <input
                    type="text"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    placeholder="City, venue or online"
                    className="w-full bg-[#1E293B]/70 border border-[#334155] rounded-lg px-3 py-2 text-xs text-[#F8FAFC] focus:outline-none focus:border-[#1877F2]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Visibility</span>
                </label>
                <select
                  value={eventVisibility}
                  onChange={(e) => setEventVisibility(e.target.value)}
                  className="w-full bg-[#1E293B]/70 border border-[#334155] rounded-lg px-3 py-2 text-xs text-[#F8FAFC] focus:outline-none focus:border-[#1877F2]"
                >
                  <option value="public">Public (Everyone)</option>
                  <option value="targeted">Targeted (Nearby / Following)</option>
                  <option value="private">Private</option>
                </select>
              </div>

              {/* Event Cover Photo Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#94A3B8]">Cover Image</label>
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="text-xs text-[#1877F2] hover:underline font-medium"
                  >
                    Change Cover
                  </button>
                  <input
                    type="file"
                    ref={coverInputRef}
                    accept="image/*"
                    onChange={handleCoverSelect}
                    className="hidden"
                  />
                </div>
                {eventCoverUrl ? (
                  <div className="relative h-32 rounded-lg overflow-hidden border border-[#334155]">
                    <img src={eventCoverUrl} alt="Cover" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setEventCoverUrl('')}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black text-rose-400 transition"
                      title="Remove cover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => coverInputRef.current?.click()}
                    className="h-24 rounded-lg border-2 border-dashed border-[#334155] flex flex-col items-center justify-center cursor-pointer hover:border-[#1877F2] transition text-[#94A3B8]"
                  >
                    <ImageIcon className="w-5 h-5 mb-1" />
                    <span className="text-xs font-medium">Add Event Cover Photo</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main Content / Caption Input */}
          <div>
            <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
              {isEvent ? 'Event Description' : 'Caption / Text'}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={isEvent ? 'Describe the event details...' : 'Write a caption...'}
              rows={4}
              className="w-full bg-[#0F172A] border border-[#1E293B] rounded-xl p-3 text-sm text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#1877F2] transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* Quick Emoji Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs text-[#94A3B8] mr-1">Add:</span>
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleInsertEmoji(emoji)}
                className="w-8 h-8 rounded-lg bg-[#1E293B]/70 hover:bg-[#334155] flex items-center justify-center text-base transition-transform active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Media Attachments Section (for regular Posts and Videos) */}
          {!isEvent && (
            <div className="pt-2 border-t border-[#1E293B]">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider">
                  Post Media ({existingMedia.length + newFiles.length})
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-xs text-[#1877F2] hover:text-[#38BDF8] font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Attach Media</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {existingMedia.length === 0 && newFiles.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="py-6 rounded-xl border-2 border-dashed border-[#1E293B] hover:border-[#1877F2]/60 transition flex flex-col items-center justify-center cursor-pointer bg-[#0F172A]/40 group"
                >
                  <div className="flex items-center gap-2 text-[#94A3B8] group-hover:text-[#F8FAFC] transition">
                    <ImageIcon className="w-5 h-5 text-[#1877F2]" />
                    <Film className="w-5 h-5 text-sky-400" />
                    <span className="text-xs font-semibold">Attach photos or video to this post</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {/* Existing media items */}
                  {existingMedia.map((m, idx) => {
                    const url = typeof m === 'string' ? m : m.url;
                    const isVideo = url?.endsWith('.mp4') || m.type === 'video';
                    return (
                      <div
                        key={`existing-${idx}`}
                        className="relative group rounded-xl overflow-hidden border border-[#1E293B] aspect-square bg-black"
                      >
                        {isVideo ? (
                          <video src={url} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveExistingMedia(idx)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center transition shadow"
                          title="Remove media"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        {isVideo && (
                          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-bold text-white flex items-center gap-1">
                            <Film className="w-2.5 h-2.5" />
                            <span>Video</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Newly selected files */}
                  {newFiles.map((item, idx) => (
                    <div
                      key={`new-${idx}`}
                      className="relative group rounded-xl overflow-hidden border-2 border-[#1877F2] aspect-square bg-black"
                    >
                      {item.type === 'video' ? (
                        <video src={item.preview} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={item.preview} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveNewFile(idx)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center transition shadow"
                        title="Remove attached file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-[#1877F2] text-[9px] font-bold text-white">
                        New
                      </div>
                    </div>
                  ))}

                  {/* Add more button tile */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl border border-dashed border-[#334155] hover:border-[#1877F2] aspect-square flex flex-col items-center justify-center text-[#94A3B8] hover:text-[#F8FAFC] transition bg-[#0F172A]/40"
                  >
                    <Plus className="w-5 h-5 mb-1 text-[#1877F2]" />
                    <span className="text-[11px] font-semibold">Add More</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
