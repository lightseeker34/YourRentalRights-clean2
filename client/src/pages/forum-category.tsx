import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { ForumCategory as ForumCategoryType, ForumPost } from "@shared/schema";

type ForumUser = { 
  id: number; 
  username: string; 
  fullName: string | null;
  forumDisplayName: string | null;
  forumBio: string | null;
  avatarUrl: string | null;
  showOnlineStatus: boolean | null;
  isOnline: boolean;
  trustLevel: number;
};
import { Link, useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { stripHtml } from "@/components/html-content";

function getTrustLevelBadge(level: number) {
  const levels: Record<number, { label: string; className: string }> = {
    0: { label: "New", className: "bg-slate-100 text-slate-600" },
    1: { label: "Member", className: "bg-blue-100 text-blue-700" },
    2: { label: "Regular", className: "bg-green-100 text-green-700" },
    3: { label: "Trusted", className: "bg-purple-100 text-purple-700" },
    4: { label: "Leader", className: "bg-amber-100 text-amber-700" },
  };
  return levels[level] || levels[0];
}

function UserAvatar({ user, size = "sm" }: { user?: ForumUser; size?: "sm" | "md" }) {
  const displayName = user?.forumDisplayName || user?.fullName || user?.username || "?";
  const sizeClasses = size === "sm" ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm";
  
  return (
    <div className="relative">
      {user?.avatarUrl ? (
        <img 
          src={user.avatarUrl} 
          loading="lazy"
          alt={displayName}
          className={`${sizeClasses} rounded-full object-cover`}
        />
      ) : (
        <div className={`${sizeClasses} rounded-full bg-slate-200 flex items-center justify-center font-medium text-slate-600`}>
          {displayName[0].toUpperCase()}
        </div>
      )}
      {user?.isOnline && (
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
      )}
    </div>
  );
}
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  MessageSquare, Eye, Clock, Pin, Lock, ChevronLeft, ArrowUpDown
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SortOption = "recent" | "popular" | "unanswered";

function PostRow({ post, author }: { post: ForumPost; author?: ForumUser }) {
  const [, navigate] = useLocation();
  const displayName = author?.forumDisplayName || author?.fullName || author?.username || "Unknown";
  const trustBadge = getTrustLevelBadge(author?.trustLevel || 0);

  return (
    <div 
      className="p-4 border-b last:border-b-0 hover:bg-slate-50 cursor-pointer transition-colors"
      onClick={() => navigate(`/forum/post/${post.id}`)}
      data-testid={`post-row-${post.id}`}
    >
      <div className="flex items-start gap-3">
        <UserAvatar user={author} size="md" />
        <div className="flex-1 min-w-0">
          <div className="mb-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {post.isPinned && (
                <Badge variant="secondary" className="text-xs">
                  <Pin className="w-3 h-3 mr-1" /> Pinned
                </Badge>
              )}
              {post.isLocked && (
                <Badge variant="outline" className="text-xs">
                  <Lock className="w-3 h-3 mr-1" /> Locked
                </Badge>
              )}
            </div>
            <h3 className="font-medium text-slate-900 break-words">{post.title}</h3>
          </div>
          <p className="text-sm text-slate-500 line-clamp-2 mb-2">{stripHtml(post.content)}</p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-400 flex-wrap min-w-0">
              <span className="flex items-center gap-1 min-w-0">
                <span className="font-medium text-slate-600 truncate max-w-[110px] sm:max-w-none">{displayName}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${trustBadge.className}`}>{trustBadge.label}</span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" />
                <span className="truncate">{formatDistanceToNow(new Date(post.lastActivityAt), { addSuffix: true })}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600 shrink-0">
              <div className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                <span>{post.replyCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                <span>{post.viewCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForumCategory() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [, navigate] = useLocation();

  const { data: category } = useQuery<ForumCategoryType>({
    queryKey: [`/api/forum/categories/${id}`],
    enabled: !!id,
  });

  const { data: postsData } = useQuery<{ posts: ForumPost[]; total: number }>({
    queryKey: ["/api/forum/posts", { categoryId: id }],
    queryFn: async () => {
      const res = await fetch(`/api/forum/posts?categoryId=${id}`);
      return res.json();
    },
    enabled: !!id,
  });
  const posts = postsData?.posts ?? [];

  const { data: allUsers = [] } = useQuery<ForumUser[]>({
    queryKey: ["/api/forum/users"],
  });

  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  const sortedPosts = [...posts].sort((a, b) => {
    switch (sortBy) {
      case "popular":
        return ((b.viewCount || 0) + (b.replyCount || 0) * 5) - ((a.viewCount || 0) + (a.replyCount || 0) * 5);
      case "unanswered":
        if ((a.replyCount || 0) === 0 && (b.replyCount || 0) > 0) return -1;
        if ((b.replyCount || 0) === 0 && (a.replyCount || 0) > 0) return 1;
        return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
      default:
        return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
    }
  });

  const pinnedPosts = sortedPosts.filter(p => p.isPinned);
  const regularPosts = sortedPosts.filter(p => !p.isPinned);
  const finalPosts = [...pinnedPosts, ...regularPosts];

  if (!category) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 overflow-x-hidden">
        <div className="text-center text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 overflow-x-hidden">
      <div className="mb-6">
        <Link href="/forum">
          <Button variant="ghost" size="sm" className="mb-2">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Forum
          </Button>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{category.name}</h1>
            {category.description && (
              <p className="text-slate-500">{category.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-40" data-testid="sort-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="unanswered">Unanswered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card>
        {finalPosts.length === 0 ? (
          <CardContent className="p-8 text-center text-slate-500">
            No discussions in this category yet. Be the first to start one!
          </CardContent>
        ) : (
          finalPosts.map((post) => (
            <PostRow key={post.id} post={post} author={userMap.get(post.authorId)} />
          ))
        )}
      </Card>
    </div>
  );
}
