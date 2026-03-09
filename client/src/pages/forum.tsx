import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ForumCategory, ForumPost } from "@shared/schema";

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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/rich-text-editor";
import { stripHtml } from "@/components/html-content";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { 
  MessageSquare, Users, Eye, Clock, Pin, Lock, Plus, Search,
  TrendingUp, MessageCircle, HelpCircle, ChevronRight, Paperclip, X, FileText, Image, Music, Video, FolderUp,
  Scale, ShieldAlert, FolderArchive, Building2, Wrench, Gavel, Wallet, Bot, ClipboardList
} from "lucide-react";
import { useRef, useEffect } from "react";
import { GuidedTour } from "@/components/guided-tour";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare,
  Users,
  TrendingUp,
  MessageCircle,
  HelpCircle,
  Scale,
  ShieldAlert,
  FolderArchive,
  Building2,
  Wrench,
  Gavel,
  Wallet,
  Bot,
  ClipboardList,
};

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

function CategoryCard({ category, postCount }: { category: ForumCategory; postCount: number }) {
  const [, navigate] = useLocation();
  const IconComponent = iconMap[category.icon || "MessageSquare"] || MessageSquare;

  return (
    <Card 
      className="cursor-pointer hover:bg-slate-50 transition-colors w-full min-w-0 overflow-hidden"
      onClick={() => navigate(`/forum/category/${category.id}`)}
      data-testid={`category-card-${category.id}`}
    >
      <CardContent className="p-4 flex items-center gap-2 sm:gap-4 overflow-hidden min-w-0">
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border"
          style={{
            backgroundColor: `${category.color ?? "#64748b"}14`,
            borderColor: `${category.color ?? "#64748b"}33`,
            color: category.color ?? "#475569",
          }}
        >
          <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-current" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate">{category.name}</h3>
          {category.description && (
            <p className="text-sm text-slate-500 truncate">{category.description}</p>
          )}
        </div>

        <div className="text-sm text-slate-500 shrink-0">
          <span>{postCount} posts</span>
        </div>
      </CardContent>
    </Card>
  );
}

function PostRow({ post, author }: { post: ForumPost; author?: ForumUser }) {
  const [, navigate] = useLocation();
  const displayName = author?.forumDisplayName || author?.fullName || author?.username || "Unknown";
  const trustBadge = getTrustLevelBadge(author?.trustLevel || 0);

  return (
    <Card 
      className="hover:bg-slate-50 cursor-pointer transition-colors w-full min-w-0 overflow-hidden"
      onClick={() => navigate(`/forum/post/${post.id}`)}
      data-testid={`post-row-${post.id}`}
    >
      <CardContent className="p-3 sm:p-4 flex items-start gap-3 overflow-hidden min-w-0">
        <UserAvatar user={author} size="md" />
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="mb-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap min-w-0">
              {post.isPinned && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  <Pin className="w-3 h-3 mr-1" /> Pinned
                </Badge>
              )}
              {post.isLocked && (
                <Badge variant="outline" className="text-xs shrink-0">
                  <Lock className="w-3 h-3 mr-1" /> Locked
                </Badge>
              )}
            </div>
            <h4 className="font-medium text-slate-900 break-words min-w-0">{post.title}</h4>
          </div>
          <p className="text-sm text-slate-500 line-clamp-2 pt-[4px] pb-[4px]">{stripHtml(post.content)}</p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-2 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-400 flex-wrap min-w-0">
              <span className="flex items-center gap-1 min-w-0">
                <span className="font-medium text-slate-600 truncate max-w-[100px] sm:max-w-none">{displayName}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${trustBadge.className}`}>{trustBadge.label}</span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" />
                <span className="truncate">{formatDistanceToNow(new Date(post.lastActivityAt), { addSuffix: true })}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500 shrink-0">
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
      </CardContent>
    </Card>
  );
}

type Attachment = { url: string; name: string; type: string };

function getAttachmentIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="w-4 h-4" />;
  if (type.startsWith("audio/")) return <Music className="w-4 h-4" />;
  if (type.startsWith("video/")) return <Video className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
}

function NewPostDialog({ categories }: { categories: ForumCategory[] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append("files", file));
    
    try {
      const res = await fetch("/api/forum/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setAttachments(prev => [...prev, ...data.attachments]);
      toast({ title: "Files Attached", description: `${data.attachments.length} file(s) added` });
    } catch {
      toast({ title: "Upload Failed", description: "Could not upload files", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const createPostMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/forum/posts", {
        title,
        content,
        categoryId: parseInt(categoryId),
        attachments,
      });
      return await res.json();
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/posts"] });
      setOpen(false);
      setTitle("");
      setContent("");
      setCategoryId("");
      setAttachments([]);
      toast({ title: "Discussion Created", description: "Your discussion has been posted." });
      navigate(`/forum/post/${post.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create discussion.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="new-discussion-btn">
          <Plus className="w-4 h-4 mr-2" /> New Discussion
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[90%] rounded-xl py-[45px] sm:max-w-[425px] fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] transition-transform duration-200">
        <div className="space-y-4">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger data-testid="category-select" className="bg-slate-50 border-slate-300">
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Discussion Title"
            data-testid="post-title-input"
            className="placeholder:text-slate-400"
          />

          <div data-testid="post-content-input">
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Provide details about your discussion..."
              minHeight="150px"
            />
          </div>

          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.doc,.docx,.txt,audio/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.doc,.docx,.txt,audio/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
              {...({ webkitdirectory: "", directory: "" } as any)}
            />
            
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full justify-start gap-2 bg-[#4d5e700f] border-slate-300"
              data-testid="attach-files-btn"
            >
              <Paperclip className="w-4 h-4 text-slate-500" />
              <span>{uploading ? "Uploading..." : "Upload File"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => folderInputRef.current?.click()}
              disabled={uploading}
              className="w-full justify-start gap-2 bg-[#4d5e700f] border-slate-300"
              data-testid="attach-folder-btn"
            >
              <FolderUp className="w-4 h-4 text-slate-500" />
              <span>{uploading ? "Uploading..." : "Upload Folder"}</span>
            </Button>

            {attachments.length > 0 && (
              <div className="flex gap-2 flex-wrap bg-slate-50 p-2 rounded-lg border border-slate-200">
                {attachments.map((att, idx) => (
                  <div key={idx} className="relative group">
                    <div className="w-10 h-10 flex items-center justify-center rounded border border-slate-200 bg-white shadow-sm">
                      {getAttachmentIcon(att.type)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button 
            onClick={() => createPostMutation.mutate()}
            disabled={!title.trim() || !content.trim() || !categoryId || createPostMutation.isPending || uploading}
            className="w-full"
            data-testid="submit-post-btn"
          >
            {createPostMutation.isPending ? "Posting..." : "Post Discussion"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Forum() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const SEARCH_PAGE_SIZE = 10;

  // Track user activity for online status
  useEffect(() => {
    if (!user) return;
    
    const sendHeartbeat = () => {
      fetch("/api/forum/heartbeat", { 
        method: "POST", 
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      }).catch(() => {});
    };
    
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60000); // Every minute
    return () => clearInterval(interval);
  }, [user]);

  const { data: categories = [] } = useQuery<ForumCategory[]>({
    queryKey: ["/api/forum/categories"],
  });

  const { data: recentPostsData } = useQuery<{ posts: ForumPost[]; total: number }>({
    queryKey: ["/api/forum/posts", { limit: 10 }],
    queryFn: async () => {
      const res = await fetch("/api/forum/posts?limit=10");
      return res.json();
    },
  });
  const recentPosts = recentPostsData?.posts ?? [];

  const { data: allUsers = [] } = useQuery<ForumUser[]>({
    queryKey: ["/api/forum/users"],
  });

  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  const normalizedSearch = searchQuery.trim();

  const { data: searchData, isLoading: searchLoading } = useQuery<{
    posts: ForumPost[];
    total: number;
    categories: ForumCategory[];
  }>({
    queryKey: ["/api/forum/search", normalizedSearch, searchPage],
    queryFn: async () => {
      const offset = (searchPage - 1) * SEARCH_PAGE_SIZE;
      const res = await fetch(
        `/api/forum/search?q=${encodeURIComponent(normalizedSearch)}&limit=${SEARCH_PAGE_SIZE}&offset=${offset}`
      );
      return res.json();
    },
    enabled: normalizedSearch.length >= 2,
  });

  const filteredPosts = normalizedSearch.length >= 2 ? (searchData?.posts ?? []) : recentPosts;
  const matchedCategories = useMemo(() => {
    if (normalizedSearch.length < 2) return [] as ForumCategory[];
    return searchData?.categories ?? [];
  }, [normalizedSearch.length, searchData?.categories]);

  const totalSearchResults = searchData?.total ?? 0;
  const totalSearchPages = Math.max(1, Math.ceil(totalSearchResults / SEARCH_PAGE_SIZE));

  const postCountByCategory = recentPosts.reduce((acc, post) => {
    acc[post.categoryId] = (acc[post.categoryId] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Community Forum</h1>
          <p className="text-slate-500">Discuss tenant rights and share experiences</p>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <Link href="/forum/my-posts">
              <Button variant="outline" data-testid="my-posts-link">
                <MessageSquare className="w-4 h-4 mr-2" />
                My Posts
              </Button>
            </Link>
            <NewPostDialog categories={categories} />
          </div>
        )}
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search discussions, categories, or authors..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSearchPage(1);
          }}
          className="pl-10"
          data-testid="search-forum"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3 min-w-0">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {normalizedSearch.length >= 2 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Search Results ({searchData?.total ?? 0})</h2>
              {matchedCategories.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {matchedCategories.slice(0, 6).map((cat) => (
                    <Link key={cat.id} href={`/forum/category/${cat.id}`}>
                      <Badge
                        variant="outline"
                        className="text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                        data-testid={`search-category-${cat.id}`}
                      >
                        {cat.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
              {searchLoading ? (
                <Card>
                  <CardContent className="p-6 text-center text-slate-500">Searching discussions...</CardContent>
                </Card>
              ) : filteredPosts.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-slate-500">
                    No discussions match your search.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="space-y-3">
                    {filteredPosts.map((post) => (
                      <PostRow key={post.id} post={post} author={userMap.get(post.authorId)} />
                    ))}
                  </div>
                  {totalSearchPages > 1 && (
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchPage((p) => Math.max(1, p - 1))}
                        disabled={searchPage <= 1}
                        data-testid="search-prev-page"
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-slate-600" data-testid="search-page-indicator">
                        Page {searchPage} of {totalSearchPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchPage((p) => Math.min(totalSearchPages, p + 1))}
                        disabled={searchPage >= totalSearchPages}
                        data-testid="search-next-page"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {normalizedSearch.length < 2 && (
            <>
              {normalizedSearch.length > 0 && (
                <p className="text-sm text-slate-500 -mt-2">Type at least 2 characters to search.</p>
              )}
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Categories</h2>
                <div className="space-y-2">
                  {categories.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center text-slate-500">
                        No categories yet. {user?.isAdmin && "Add some from the Admin panel."}
                      </CardContent>
                    </Card>
                  ) : (
                    categories.map((category) => (
                      <CategoryCard
                        key={category.id}
                        category={category}
                        postCount={postCountByCategory[category.id] || 0}
                      />
                    ))
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Recent Discussions</h2>
                {filteredPosts.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-slate-500">
                      No discussions yet. Start one!
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {filteredPosts.map((post) => (
                      <PostRow key={post.id} post={post} author={userMap.get(post.authorId)} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="space-y-6 min-w-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Forum Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Categories</span>
                <span className="font-medium">{categories.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Discussions</span>
                <span className="font-medium">{recentPosts.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Members</span>
                <span className="font-medium">{allUsers.length || "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Community Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 space-y-2">
              <p>Welcome to our community! Please:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Be respectful and constructive</li>
                <li>Share real experiences, not legal advice</li>
                <li>Keep personal info private</li>
                <li>Report inappropriate content</li>
              </ul>
            </CardContent>
          </Card>

          {!user && (
            <Card className="bg-slate-50">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-slate-600 mb-3">Join the discussion!</p>
                <Link href="/auth">
                  <Button variant="outline" className="w-full" data-testid="login-btn">
                    Sign In to Participate
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      <GuidedTour />
    </div>
  );
}
