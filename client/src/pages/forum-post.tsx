import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ForumPost as ForumPostType, ForumReply, ForumCategory } from "@shared/schema";

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
import { Link, useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { 
  MessageSquare, Eye, Clock, Pin, Lock, ChevronLeft,
  Bookmark, BookmarkCheck, MoreVertical, Pencil, Trash2, CheckCircle,
  Reply as ReplyIcon, FileText, Image, Music, Video, Paperclip, Download,
  Quote, Flag, Share2, Link as LinkIcon
} from "lucide-react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { HtmlContent } from "@/components/html-content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ImagePreviewModal } from "@/components/image-preview-modal";

type Attachment = { url: string; name: string; type: string };

function getAttachmentIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="w-4 h-4" />;
  if (type.startsWith("audio/")) return <Music className="w-4 h-4" />;
  if (type.startsWith("video/")) return <Video className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
}

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

function UserAvatar({ user, size = "sm" }: { user?: ForumUser; size?: "sm" | "md" | "lg" }) {
  const displayName = user?.forumDisplayName || user?.fullName || user?.username || "?";
  const sizeClasses = size === "sm" ? "w-6 h-6 text-xs" : size === "md" ? "w-8 h-8 text-sm" : "w-10 h-10 text-base";
  const dotSize = size === "lg" ? "w-3 h-3" : "w-2.5 h-2.5";
  
  return (
    <div className="relative flex-shrink-0">
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
        <div className={`absolute -bottom-0.5 -right-0.5 ${dotSize} bg-green-500 rounded-full border-2 border-white`} />
      )}
    </div>
  );
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function ReplyCard({ 
  reply, 
  author, 
  currentUserId,
  isAdmin,
  postAuthorId,
  onDelete,
  onAccept,
  onQuote,
  onReport,
}: { 
  reply: ForumReply; 
  author?: ForumUser;
  currentUserId?: number;
  isAdmin?: boolean;
  postAuthorId: number;
  onDelete: (replyId: number) => void;
  onAccept: (replyId: number) => void;
  onQuote: (content: string, author: string) => void;
  onReport: (replyId: number, type: "reply") => void;
}) {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const canModify = currentUserId === reply.authorId || isAdmin;
  const canAccept = (currentUserId === postAuthorId || isAdmin) && !reply.isAcceptedAnswer;

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#reply-${reply.id}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link Copied", description: "Reply link copied to clipboard." });
  };

  const handleQuote = () => {
    const authorName = author?.forumDisplayName || author?.fullName || author?.username || "Unknown";
    onQuote(reply.content, authorName);
  };

  return (
    <div 
      id={`reply-${reply.id}`}
      className={`p-4 border-b last:border-b-0 ${reply.isAcceptedAnswer ? "bg-green-50 border-l-4 border-l-green-500" : ""}`}
    >
      {reply.isAcceptedAnswer && (
        <Badge className="mb-2 bg-green-100 text-green-700">
          <CheckCircle className="w-3 h-3 mr-1" /> Accepted Answer
        </Badge>
      )}
      <div className="flex items-start gap-3">
        <UserAvatar user={author} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-slate-900">
              {author?.forumDisplayName || author?.fullName || author?.username || "Unknown"}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${getTrustLevelBadge(author?.trustLevel || 0).className}`}>
              {getTrustLevelBadge(author?.trustLevel || 0).label}
            </span>
            <span className="text-xs text-slate-400">
              {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
            </span>
          </div>
          <HtmlContent content={reply.content} className="text-slate-700 break-words [&_*]:break-words" />
          <div className="flex items-center gap-1 mt-3 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleQuote}
              className="text-xs"
              data-testid={`quote-reply-${reply.id}`}
            >
              <Quote className="w-3 h-3 mr-1" /> Quote
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className="text-xs"
              data-testid={`share-reply-${reply.id}`}
            >
              <LinkIcon className="w-3 h-3 mr-1" /> Link
            </Button>
            {currentUserId && currentUserId !== reply.authorId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onReport(reply.id, "reply")}
                className="text-xs text-slate-500"
                data-testid={`report-reply-${reply.id}`}
              >
                <Flag className="w-3 h-3 mr-1" /> Report
              </Button>
            )}
            {canAccept && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAccept(reply.id)}
                className="text-xs text-green-600"
                data-testid={`accept-reply-${reply.id}`}
              >
                <CheckCircle className="w-3 h-3 mr-1" /> Accept
              </Button>
            )}
          </div>
        </div>
        {canModify && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reply?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(reply.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ForumPost() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [replyContent, setReplyContent] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: number; type: "post" | "reply" } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");

  const { data: post, isLoading: postLoading } = useQuery<ForumPostType>({
    queryKey: [`/api/forum/posts/${id}`],
    enabled: !!id,
  });

  const { data: category } = useQuery<ForumCategory>({
    queryKey: [`/api/forum/categories/${post?.categoryId}`],
    enabled: !!post?.categoryId,
  });

  const { data: replies = [] } = useQuery<ForumReply[]>({
    queryKey: [`/api/forum/posts/${id}/replies`],
    enabled: !!id,
  });

  const { data: bookmarks = [] } = useQuery<{ postId: number }[]>({
    queryKey: ["/api/forum/bookmarks"],
    enabled: !!user,
  });

  const { data: allUsers = [] } = useQuery<ForumUser[]>({
    queryKey: ["/api/forum/users"],
  });

  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const postAuthor = post ? userMap.get(post.authorId) : undefined;
  const isBookmarked = bookmarks.some(b => b.postId === Number(id));

  const createReplyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/forum/posts/${id}/replies`, {
        postId: Number(id),
        content: replyContent,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forum/posts/${id}/replies`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forum/posts/${id}`] });
      setReplyContent("");
      toast({ title: "Reply Posted", description: "Your reply has been added." });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/forum/posts/${id}/bookmark`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/bookmarks"] });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/forum/posts/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forum/categories"] });
      toast({ title: "Deleted", description: "Post has been deleted." });
      navigate("/forum");
    },
  });

  const deleteReplyMutation = useMutation({
    mutationFn: async (replyId: number) => {
      await apiRequest("DELETE", `/api/forum/replies/${replyId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forum/posts/${id}/replies`] });
      toast({ title: "Deleted", description: "Reply has been deleted." });
    },
  });

  const acceptReplyMutation = useMutation({
    mutationFn: async (replyId: number) => {
      await apiRequest("POST", `/api/forum/replies/${replyId}/accept`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forum/posts/${id}/replies`] });
      toast({ title: "Accepted", description: "Reply marked as accepted answer." });
    },
  });

  const pinMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/forum/posts/${id}/${post?.isPinned ? "unpin" : "pin"}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forum/posts/${id}`] });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/forum/posts/${id}/${post?.isLocked ? "unlock" : "lock"}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forum/posts/${id}`] });
    },
  });

  const editPostMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/forum/posts/${id}`, {
        title: editTitle,
        content: editContent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forum/posts/${id}`] });
      setShowEditDialog(false);
      toast({ title: "Updated", description: "Post has been updated." });
    },
  });

  const handleOpenEdit = () => {
    if (post) {
      setEditTitle(post.title);
      setEditContent(post.content);
      setShowEditDialog(true);
    }
  };

  const handleQuote = (content: string, author: string) => {
    const plainText = content.replace(/<[^>]*>/g, '').trim();
    const quotedHtml = `<blockquote><p>${plainText}</p></blockquote><p>@${author}: </p>`;
    setReplyContent((prev) => prev + quotedHtml);
  };

  const handleReport = (targetId: number, type: "post" | "reply") => {
    setReportTarget({ id: targetId, type });
    setReportReason("");
    setShowReportDialog(true);
  };

  const handleSubmitReport = () => {
    toast({
      title: "Report Submitted",
      description: "Thank you for reporting. Our moderators will review this content.",
    });
    setShowReportDialog(false);
    setReportTarget(null);
    setReportReason("");
  };

  const handleCopyPostLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link Copied", description: "Post link copied to clipboard." });
  };

  if (postLoading || !post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 overflow-x-hidden">
        <div className="text-center text-slate-500">Loading...</div>
      </div>
    );
  }

  const canModifyPost = user?.id === post.authorId || user?.isAdmin;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 overflow-x-hidden">
      <div className="mb-4 min-w-0">
        <Link href={category ? `/forum/category/${category.id}` : "/forum"}>
          <Button
            variant="ghost"
            size="sm"
            className="w-full sm:w-auto max-w-full justify-start min-w-0"
          >
            <ChevronLeft className="w-4 h-4 mr-1 shrink-0" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline truncate">Back to {category?.name || "Forum"}</span>
          </Button>
        </Link>
      </div>
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
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
              {category && (
                <div className="mb-2 min-w-0">
                  <Badge
                    variant="outline"
                    className="w-full sm:w-auto justify-start max-w-full whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    {category.name}
                  </Badge>
                </div>
              )}
              <h1 className="text-slate-900 mt-[10px] mb-[10px] text-[18px] font-semibold break-words max-w-full">{post.title}</h1>
            </div>
            {canModifyPost && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 p-0">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleOpenEdit}>
                    <Pencil className="w-4 h-4 mr-2" /> Edit
                  </DropdownMenuItem>
                  {user?.isAdmin && (
                    <>
                      <DropdownMenuItem onClick={() => pinMutation.mutate()}>
                        <Pin className="w-4 h-4 mr-2" /> {post.isPinned ? "Unpin" : "Pin"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => lockMutation.mutate()}>
                        <Lock className="w-4 h-4 mr-2" /> {post.isLocked ? "Unlock" : "Lock"}
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4 text-sm text-slate-500">
            <UserAvatar user={postAuthor} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">
                  {postAuthor?.forumDisplayName || postAuthor?.fullName || postAuthor?.username || "Unknown"}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${getTrustLevelBadge(postAuthor?.trustLevel || 0).className}`}>
                  {getTrustLevelBadge(postAuthor?.trustLevel || 0).label}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span>{format(new Date(post.createdAt), "MMM d, yyyy")}</span>
                {postAuthor?.forumBio && (
                  <>
                    <span className="mx-1">·</span>
                    <span className="text-slate-400 truncate max-w-[200px]">{postAuthor.forumBio}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <HtmlContent content={post.content} className="text-slate-700 break-words [&_*]:break-words" />
          
          {/* Attachments */}
          {post.attachments && (post.attachments as Attachment[]).length > 0 && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
                <Paperclip className="w-4 h-4" />
                Attachments ({(post.attachments as Attachment[]).length})
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(post.attachments as Attachment[]).map((att, idx) => (
                  <div key={idx} className="flex items-center">
                    {att.type.startsWith("image/") ? (
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => {
                          setPreviewUrl(att.url);
                          setPreviewName(att.name);
                        }}
                      >
                        <img 
                          src={att.url} 
                          loading="lazy"
                          alt={att.name}
                          className="w-full h-16 sm:h-20 object-cover rounded border cursor-pointer hover:opacity-90"
                        />
                      </button>
                    ) : (
                      <a 
                        href={att.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1.5 bg-white rounded border hover:bg-slate-50 text-xs w-full"
                      >
                        {getAttachmentIcon(att.type)}
                        <span className="truncate flex-1">{att.name}</span>
                        <Download className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <ImagePreviewModal
            open={previewUrl !== null}
            onOpenChange={(open) => {
              if (!open) {
                setPreviewUrl(null);
                setPreviewName("");
              }
            }}
            previewType="image"
            previewUrl={previewUrl}
            previewName={previewName}
            renderImage={() => (
              <img
                src={previewUrl || ""}
                alt={previewName || "Forum attachment preview"}
                className="max-h-full max-w-full object-contain"
                style={{ touchAction: "pan-x pan-y pinch-zoom" }}
              />
            )}
          />

          <div className="flex items-center gap-2 border-t flex-wrap min-w-0 pt-2 mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyPostLink}
              data-testid="share-post-btn"
            >
              <Share2 className="w-4 h-4 mr-1" /> Share
            </Button>
            <Button
              variant={isBookmarked ? "secondary" : "ghost"}
              size="sm"
              onClick={() => user && bookmarkMutation.mutate()}
              disabled={!user}
              data-testid="bookmark-btn"
            >
              {isBookmarked ? (
                <BookmarkCheck className="w-4 h-4 mr-1" />
              ) : (
                <Bookmark className="w-4 h-4 mr-1" />
              )}
              {isBookmarked ? "Saved" : "Save"}
            </Button>
            {user && user.id !== post.authorId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReport(Number(id), "post")}
                className="text-slate-500"
                data-testid="report-post-btn"
              >
                <Flag className="w-4 h-4 mr-1" /> Report
              </Button>
            )}
            <div className="flex-1" />
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" /> {post.viewCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" /> {post.replyCount}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
        </h2>
      </div>
      {replies.length > 0 && (
        <Card className="mb-6">
          {replies.map((reply) => (
            <ReplyCard
              key={reply.id}
              reply={reply}
              author={userMap.get(reply.authorId)}
              currentUserId={user?.id}
              isAdmin={user?.isAdmin ?? false}
              postAuthorId={post.authorId}
              onDelete={(rid) => deleteReplyMutation.mutate(rid)}
              onAccept={(rid) => acceptReplyMutation.mutate(rid)}
              onQuote={handleQuote}
              onReport={handleReport}
            />
          ))}
        </Card>
      )}
      {user && !post.isLocked ? (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
              <ReplyIcon className="w-4 h-4" /> Write a Reply
            </h3>
            <div className="mb-3" data-testid="reply-input">
              <RichTextEditor
                value={replyContent}
                onChange={setReplyContent}
                placeholder="Share your thoughts..."
                minHeight="60px"
              />
            </div>
            <Button
              onClick={() => createReplyMutation.mutate()}
              disabled={!replyContent.trim() || createReplyMutation.isPending}
              data-testid="submit-reply-btn"
            >
              {createReplyMutation.isPending ? "Posting..." : "Post Reply"}
            </Button>
          </CardContent>
        </Card>
      ) : post.isLocked ? (
        <Card>
          <CardContent className="p-4 text-center text-slate-500">
            <Lock className="w-5 h-5 mx-auto mb-2" />
            This discussion is locked and no longer accepting replies.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-slate-500 mb-3">Sign in to join the discussion</p>
            <Link href="/auth">
              <Button variant="outline" data-testid="signin-btn">Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      )}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this post and all its replies.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletePostMutation.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                data-testid="edit-post-title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-content">Content</Label>
              <div data-testid="edit-post-content">
                <RichTextEditor
                  value={editContent}
                  onChange={setEditContent}
                  placeholder="Write your post content..."
                  minHeight="120px"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => editPostMutation.mutate()}
              disabled={!editTitle.trim() || !editContent.trim() || editPostMutation.isPending}
              data-testid="save-edit-btn"
            >
              {editPostMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Content</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-slate-600">
              Please describe why you are reporting this {reportTarget?.type || "content"}.
              Our moderators will review your report.
            </p>
            <Textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Describe the issue..."
              rows={4}
              data-testid="report-reason-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitReport}
              disabled={!reportReason.trim()}
              data-testid="submit-report-btn"
            >
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
