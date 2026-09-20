import React, { useState, useMemo } from 'react';
import { User } from '../types';
import { useSavedPosts, SavedPostItem, removeSavedPost } from '../utils/savedPosts';
import { InstagramVideoCard } from './InstagramVideoCard';
import { Post } from './Feed';

interface SavedPostsPageProps {
  currentUser: User | null;
  users?: User[];
  onBack?: () => void;
  onProfileClick: (userId: number) => void;
  onVideoClick?: (reel: any) => void;
  onViewImage?: (imageUrl: string) => void;
  onOpenComments?: (post: any) => void;
  onReact?: (postId: number, type: any) => void;
  onShare?: (post: any) => void;
}

type TabType = 'all' | 'video' | 'normal';

export const SavedPostsPage: React.FC<SavedPostsPageProps> = ({
  currentUser,
  users = [],
  onBack,
  onProfileClick,
  onVideoClick,
  onViewImage,
  onOpenComments,
  onReact,
  onShare,
}) => {
  const { savedPosts, remove } = useSavedPosts();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'feed' | 'grid'>('feed');

  // Filter by search query
  const filteredPosts = useMemo(() => {
    let list = savedPosts;

    if (activeTab === 'video') {
      list = list.filter((item) => item.type === 'video');
    } else if (activeTab === 'normal') {
      list = list.filter((item) => item.type === 'normal');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        const text = (item.post?.content || item.post?.caption || item.post?.title || '').toLowerCase();
        const authorName = (
          item.post?.author?.name ||
          item.post?.user?.name ||
          item.post?.name ||
          item.post?.username ||
          ''
        ).toLowerCase();
        return text.includes(q) || authorName.includes(q);
      });
    }

    return list;
  }, [savedPosts, activeTab, searchQuery]);

  // Counts for each category
  const counts = useMemo(() => {
    const videoCount = savedPosts.filter((item) => item.type === 'video').length;
    const normalCount = savedPosts.filter((item) => item.type === 'normal').length;
    return {
      all: savedPosts.length,
      video: videoCount,
      normal: normalCount,
    };
  }, [savedPosts]);

  return (
    <div className="w-full mx-auto min-h-screen pb-28 font-sans animate-fade-in text-[#F8FAFC]">
      {/* Top Header & Controls wrapped in readable max-width */}
      <div className="w-full max-w-[700px] mx-auto px-3.5 sm:px-4 pt-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-4 bg-[#0B1120] border border-[#1E293B] rounded-2xl p-4 shadow-md">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="w-10 h-10 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] border border-[#1E293B] text-[#F8FAFC] flex items-center justify-center transition-colors shadow-sm shrink-0"
                aria-label="Back"
              >
                <i className="fas fa-arrow-left text-base"></i>
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B] shadow-inner">
                <i className="fas fa-bookmark text-lg"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#F8FAFC] leading-tight">Saved Posts</h1>
                <p className="text-xs text-[#94A3B8]">
                  {counts.all} saved item{counts.all === 1 ? '' : 's'} • Stored locally
                </p>
              </div>
            </div>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center bg-[#0F172A] border border-[#1E293B] rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode('feed')}
              className={`p-1.5 rounded-lg text-sm transition-colors ${
                viewMode === 'feed'
                  ? 'bg-[#1E293B] text-[#38BDF8]'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
              title="Feed view"
            >
              <i className="fas fa-stream"></i>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-sm transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#1E293B] text-[#38BDF8]'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
              title="Grid view"
            >
              <i className="fas fa-th-large"></i>
            </button>
          </div>
        </div>

        {/* Category Tabs: Video Posts & Normal Posts */}
        <div className="grid grid-cols-3 gap-2 mb-4 bg-[#0B1120] border border-[#1E293B] p-1.5 rounded-2xl shadow-sm">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-[#1E293B] text-[#F8FAFC] shadow-sm border border-[#334155]'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#0F172A]'
            }`}
          >
            <i className="fas fa-layer-group text-sm"></i>
            <span>All</span>
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                activeTab === 'all' ? 'bg-[#38BDF8]/20 text-[#38BDF8]' : 'bg-[#1E293B] text-[#94A3B8]'
              }`}
            >
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('video')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'video'
                ? 'bg-[#1E293B] text-[#F8FAFC] shadow-sm border border-[#334155]'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#0F172A]'
            }`}
          >
            <i className="fas fa-play-circle text-sm text-[#38BDF8]"></i>
            <span className="truncate">Video Posts</span>
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                activeTab === 'video' ? 'bg-[#38BDF8]/20 text-[#38BDF8]' : 'bg-[#1E293B] text-[#94A3B8]'
              }`}
            >
              {counts.video}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('normal')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'normal'
                ? 'bg-[#1E293B] text-[#F8FAFC] shadow-sm border border-[#334155]'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#0F172A]'
            }`}
          >
            <i className="fas fa-newspaper text-sm text-[#F59E0B]"></i>
            <span className="truncate">Normal Posts</span>
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                activeTab === 'normal' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-[#1E293B] text-[#94A3B8]'
              }`}
            >
              {counts.normal}
            </span>
          </button>
        </div>

        {/* Search Bar if items exist */}
        {savedPosts.length > 0 && (
          <div className="relative">
            <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] text-sm"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab === 'video' ? 'video' : activeTab === 'normal' ? 'normal' : 'all'} saved posts...`}
              className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#F8FAFC] placeholder-[#64748B] outline-none focus:border-[#38BDF8] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#F8FAFC] text-sm"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredPosts.length === 0 && (
        <div className="w-full max-w-[700px] mx-auto px-3.5 sm:px-4">
          <div className="bg-[#0B1120] border border-[#1E293B] rounded-2xl p-8 sm:p-12 text-center shadow-md">
            <div className="w-16 h-16 rounded-2xl bg-[#0F172A] border border-[#1E293B] mx-auto mb-4 flex items-center justify-center text-[#F59E0B]">
              <i className="fas fa-bookmark text-2xl"></i>
            </div>
            <h3 className="text-lg font-bold text-[#F8FAFC] mb-1">
              {searchQuery
                ? 'No matching saved posts found'
                : activeTab === 'video'
                ? 'No saved video posts'
                : activeTab === 'normal'
                ? 'No saved normal posts'
                : 'No saved posts yet'}
            </h3>
            <p className="text-sm text-[#94A3B8] max-w-md mx-auto mb-5 leading-relaxed">
              {searchQuery
                ? `No results match "${searchQuery}". Try a different keyword.`
                : 'Tap the bookmark icon in the action bar of any post or reel to save it here. Your saved items are preserved locally on this device.'}
            </p>
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 bg-[#1E293B] hover:bg-[#334155] text-[#38BDF8] rounded-xl text-xs font-semibold transition-colors"
              >
                Clear search
              </button>
            ) : (
              onBack && (
                <button
                  onClick={onBack}
                  className="px-5 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl text-sm font-semibold transition-colors inline-flex items-center gap-2"
                >
                  <i className="fas fa-compass"></i>
                  <span>Explore Posts</span>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Saved Posts Grid / Feed */}
      {filteredPosts.length > 0 && (
        <>
          {viewMode === 'grid' ? (
            <div className="w-full max-w-[700px] mx-auto px-3.5 sm:px-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredPosts.map((item) => {
                  const post = {
                    ...item.post,
                    id: Number(item.post?.id ?? item.id),
                    post_id: Number(item.post?.post_id ?? item.post?.id ?? item.id),
                  };
                  const author = post?.author || post?.user || {};
                  const authorName = author?.name || post?.name || 'User';
                  const mediaUrl =
                    post?.media_url ||
                    post?.video_url ||
                    (Array.isArray(post?.media_urls) && post?.media_urls[0]) ||
                    post?.thumbnail_url ||
                    null;

                  return (
                    <div
                      key={`grid-${item.id}`}
                      onClick={() => {
                        if (item.type === 'video') {
                          onVideoClick?.(post);
                        } else if (mediaUrl && onViewImage) {
                          onViewImage(mediaUrl);
                        } else if (onOpenComments) {
                          onOpenComments(post);
                        }
                      }}
                      className="group relative bg-[#0B1120] border border-[#1E293B] rounded-xl overflow-hidden aspect-[4/5] flex flex-col hover:border-[#38BDF8]/40 transition-all shadow-sm cursor-pointer"
                    >
                      {/* Media Thumbnail */}
                      <div className="relative w-full h-full bg-[#050B18] overflow-hidden flex items-center justify-center">
                        {mediaUrl ? (
                          item.type === 'video' ? (
                            <div className="relative w-full h-full">
                              <video
                                src={mediaUrl}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                              />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                                <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white text-sm">
                                  <i className="fas fa-play ml-0.5"></i>
                                </div>
                              </div>
                              <span className="absolute top-2 left-2 bg-black/70 text-[#38BDF8] text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                <i className="fas fa-video text-[10px]"></i> Video
                              </span>
                            </div>
                          ) : (
                            <img
                              src={mediaUrl}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          )
                        ) : (
                          <div className="p-4 text-xs text-[#94A3B8] line-clamp-6 text-center italic">
                            "{post?.content || post?.caption || 'Text post'}"
                          </div>
                        )}

                        {/* Top action buttons */}
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                          {/* Discuss button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenComments?.(post);
                            }}
                            className="w-8 h-8 rounded-full bg-black/70 hover:bg-[#1877F2] text-white flex items-center justify-center transition-colors shadow-md"
                            title="Discuss"
                          >
                            <i className="far fa-comment text-xs"></i>
                          </button>

                          {/* Unsave button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              remove(item.id);
                            }}
                            className="w-8 h-8 rounded-full bg-black/70 hover:bg-red-500/80 text-[#F59E0B] hover:text-white flex items-center justify-center transition-colors shadow-md"
                            title="Remove from saved"
                          >
                            <i className="fas fa-bookmark text-xs"></i>
                          </button>
                        </div>

                        {/* Bottom author pill */}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2.5 pt-6 flex items-center gap-2">
                          <img
                            src={author?.profile_image_url || 'https://via.placeholder.com/40'}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover border border-white/20"
                          />
                          <span className="text-xs font-semibold text-white truncate flex-1">
                            {authorName}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Fullwidth posts container identical to Feeds.tsx */
            <div className="w-full flex flex-col divide-y divide-[#1E293B]">
              {filteredPosts.map((item) => {
                const post = {
                  ...item.post,
                  id: Number(item.post?.id ?? item.id),
                  post_id: Number(item.post?.post_id ?? item.post?.id ?? item.id),
                };

                if (item.type === 'video' && (post.video_url || post.media_url || post.reel_url)) {
                  // Render video post card
                  return (
                    <div key={`saved-vid-${item.id}`} className="w-full">
                      <div className="w-full max-w-[700px] mx-auto px-3.5 sm:px-4 py-1.5 flex items-center justify-between bg-[#0B1120]/60 border-b border-[#1E293B]/40">
                        <span className="text-xs font-semibold text-[#38BDF8] flex items-center gap-1.5">
                          <i className="fas fa-play-circle"></i> Video Post
                        </span>
                        <button
                          onClick={() => remove(item.id)}
                          className="text-xs text-[#94A3B8] hover:text-red-400 flex items-center gap-1 transition-colors px-2 py-0.5 rounded-md hover:bg-red-500/10"
                        >
                          <i className="fas fa-trash-alt text-[11px]"></i> Unsave
                        </button>
                      </div>
                      <div className="w-full">
                        <InstagramVideoCard
                          reel={post}
                          currentUser={currentUser}
                          users={users}
                          onProfileClick={onProfileClick}
                          onHashtagClick={() => {}}
                          onVideoClick={() => onVideoClick?.(post)}
                          onOpenComments={onOpenComments}
                          onReact={(postOrId, type) => onReact?.(Number(postOrId?.id ?? postOrId), type)}
                          onShare={(postId, count) => onShare?.(post)}
                        />
                      </div>
                    </div>
                  );
                }

                // Render normal post card
                return (
                  <div key={`saved-post-${item.id}`} className="w-full">
                    <div className="w-full max-w-[700px] mx-auto px-3.5 sm:px-4 py-1.5 flex items-center justify-between bg-[#0B1120]/60 border-b border-[#1E293B]/40">
                      <span className="text-xs font-semibold text-[#F59E0B] flex items-center gap-1.5">
                        <i className="fas fa-newspaper"></i> Normal Post
                      </span>
                      <button
                        onClick={() => remove(item.id)}
                        className="text-xs text-[#94A3B8] hover:text-red-400 flex items-center gap-1 transition-colors px-2 py-0.5 rounded-md hover:bg-red-500/10"
                      >
                        <i className="fas fa-trash-alt text-[11px]"></i> Unsave
                      </button>
                    </div>
                    <div className="w-full">
                      <Post
                        post={post}
                        author={post.author || post.user || post}
                        currentUser={currentUser}
                        users={users}
                        onProfileClick={onProfileClick}
                        onReact={onReact}
                        onShare={onShare}
                        onViewImage={onViewImage}
                        onOpenComments={onOpenComments}
                        onVideoClick={onVideoClick}
                        isFollowing={false}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
