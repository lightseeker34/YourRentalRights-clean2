import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MessageSquare, MessageCircle, Pin, Lock, Eye, ThumbsUp, Clock, Bookmark } from "lucide-react";
import { stripHtml } from "@/components/html-content";
import { formatDistanceToNow } from "date-fns";

interface ForumPost {
  id: number;
  title: string;
  content: string;
  categoryId: number;
  authorId: number;
  isPinned: boolean;
  isLocked: boolean;
  viewCount: number;
  replyCount: number;
  createdAt: string;
}

interface ForumReply {
  id: number;
  content: string;
  postId: number;
  authorId: number;
  isAcceptedAnswer: boolean;
  createdAt: string;
}

interface ForumCategory {
  id: number;
  name: string;
  slug: string;
  color: string;
}

interface Bookmark {
  id: number;
  userId: number;
  postId: number;
  createdAt: string;
}

export default function ForumMyPosts() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: myPostsData } = useQuery<{ posts: ForumPost[]; total: number }>({
    queryKey: ["/api/forum/posts", { authorId: user?.id }],
    queryFn: async () => {
      const res = await fetch(`/api/forum/posts?authorId=${user?.id}`);
      return res.json();
    },
    enabled: !!user,
  });
  const myPosts = myPostsData?.posts ?? [];

  const { data: myReplies = [] } = useQuery<ForumReply[]>({
    queryKey: ["/api/forum/replies/user", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/forum/replies/user/${user?.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const { data: bookmarks = [] } = useQuery<Bookmark[]>({
    queryKey: ["/api/forum/bookmarks"],
    enabled: !!user,
  });

  const { data: allPostsData } = useQuery<{ posts: ForumPost[]; total: number }>({
    queryKey: ["/api/forum/posts"],
    queryFn: async () => {
      const res = await fetch("/api/forum/posts");
      return res.json();
    },
  });
  const allPosts = allPostsData?.posts ?? [];

  const { data: categories = [] } = useQuery<ForumCategory[]>({
    queryKey: ["/api/forum/categories"],
  });

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const postMap = new Map(allPosts.map((p) => [p.id, p]));
  
  const bookmarkedPosts = bookmarks
    .map((b) => postMap.get(b.postId))
    .filter((p): p is ForumPost => !!p);

  if (!user) {
    return (
      <div className="container mx-auto p-4 max-w-4xl overflow-x-hidden">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-slate-600">Please log in to view your posts.</p>
            <Button className="mt-4" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl overflow-x-hidden">
      <div className="mb-6">
        <Link href="/forum">
          <Button variant="ghost" size="sm" data-testid="back-to-forum" className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Forum
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 text-center whitespace-nowrap">My Forum Activity</h1>
      </div>

      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="mb-4 w-full h-auto flex flex-nowrap">
          <TabsTrigger value="posts" data-testid="tab-posts" className="flex items-center justify-center gap-1 flex-1 min-w-0 px-2 text-[11px] sm:text-sm whitespace-nowrap">
            <MessageSquare className="w-4 h-4" />
            My Posts ({myPosts.length})
          </TabsTrigger>
          <TabsTrigger value="replies" data-testid="tab-replies" className="flex items-center justify-center gap-1 flex-1 min-w-0 px-2 text-[11px] sm:text-sm whitespace-nowrap">
            <MessageCircle className="w-4 h-4" />
            My Replies ({myReplies.length})
          </TabsTrigger>
          <TabsTrigger value="bookmarks" data-testid="tab-bookmarks" className="flex items-center justify-center gap-1 flex-1 min-w-0 px-2 text-[11px] sm:text-sm whitespace-nowrap">
            <Bookmark className="w-4 h-4" />
            Bookmarks ({bookmarkedPosts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Posts You've Created</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {myPosts.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>You haven't created any posts yet.</p>
                  <Link href="/forum">
                    <Button className="mt-4" variant="outline">
                      Start a Discussion
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y">
                  {myPosts.map((post) => {
                    const category = categoryMap.get(post.categoryId);
                    return (
                      <Link key={post.id} href={`/forum/post/${post.id}`}>
                        <div 
                          className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                          data-testid={`my-post-${post.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 min-w-0">
                                {post.isPinned && (
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    <Pin className="w-3 h-3 mr-1" /> Pinned
                                  </Badge>
                                )}
                                {post.isLocked && (
                                  <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                )}
                                <span className="font-medium text-slate-900 hover:text-blue-600 truncate min-w-0 flex-1">
                                  {post.title}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                                {stripHtml(post.content)}
                              </p>
                              {category && (
                                <div className="mb-2">
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs"
                                    style={{ 
                                      borderColor: category.color,
                                      color: category.color 
                                    }}
                                  >
                                    {category.name}
                                  </Badge>
                                </div>
                              )}
                              <div className="flex items-center justify-between gap-3 whitespace-nowrap min-w-0">
                                <span className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                                  <Clock className="w-3 h-3" />
                                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                                </span>
                                <div className="flex items-center gap-4 text-sm text-slate-700 ml-auto shrink-0">
                                  <span className="flex items-center gap-1">
                                    <Eye className="w-4 h-4" /> {post.viewCount}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MessageCircle className="w-4 h-4" /> {post.replyCount}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="replies">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-center">Replies You've Made</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {myReplies.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>You haven't replied to any posts yet.</p>
                  <Link href="/forum">
                    <Button className="mt-4" variant="outline">
                      Browse Discussions
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y">
                  {myReplies.map((reply) => {
                    const post = postMap.get(reply.postId);
                    return (
                      <Link key={reply.id} href={`/forum/post/${reply.postId}`}>
                        <div 
                          className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                          data-testid={`my-reply-${reply.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              {post && (
                                <p className="text-xs text-slate-400 mb-1">
                                  In reply to: <span className="text-slate-600 font-medium">{post.title}</span>
                                </p>
                              )}
                              <p className="text-sm text-slate-700 line-clamp-3 mb-2">
                                {reply.content}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                                {reply.isAcceptedAnswer && (
                                  <Badge className="bg-green-100 text-green-700 text-xs">
                                    Accepted Answer
                                  </Badge>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookmarks">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bookmarked Posts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {bookmarkedPosts.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>You haven't bookmarked any posts yet.</p>
                  <Link href="/forum">
                    <Button className="mt-4" variant="outline">
                      Browse Discussions
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y">
                  {bookmarkedPosts.map((post) => {
                    const category = categoryMap.get(post.categoryId);
                    return (
                      <Link key={post.id} href={`/forum/post/${post.id}`}>
                        <div 
                          className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                          data-testid={`bookmarked-post-${post.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 min-w-0">
                                {post.isPinned && (
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    <Pin className="w-3 h-3 mr-1" /> Pinned
                                  </Badge>
                                )}
                                {post.isLocked && (
                                  <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                )}
                                <span className="font-medium text-slate-900 hover:text-blue-600 truncate min-w-0 flex-1">
                                  {post.title}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                                {stripHtml(post.content)}
                              </p>
                              {category && (
                                <div className="mb-2">
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs"
                                    style={{ 
                                      borderColor: category.color,
                                      color: category.color 
                                    }}
                                  >
                                    {category.name}
                                  </Badge>
                                </div>
                              )}
                              <div className="flex items-center justify-between gap-3 whitespace-nowrap min-w-0">
                                <span className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                                  <Clock className="w-3 h-3" />
                                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                                </span>
                                <div className="flex items-center gap-4 text-sm text-slate-700 ml-auto shrink-0">
                                  <span className="flex items-center gap-1">
                                    <Eye className="w-4 h-4" /> {post.viewCount}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MessageCircle className="w-4 h-4" /> {post.replyCount}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
