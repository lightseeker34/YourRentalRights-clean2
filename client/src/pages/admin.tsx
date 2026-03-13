import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Settings, Users, Key, Save, Brain, Trash2, MessageSquare, Plus, Pencil, GripVertical, Search, UserPlus, Shield, Ban, KeyRound, BarChart3, CheckSquare, Square, FileText, Scale, Bot, Download, ArrowUp, ArrowDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Redirect } from "wouter";
import { ForumCategory } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";

type AdminUser = {
  id: number;
  username: string;
  isAdmin: boolean;
  status: string;
  fullName: string | null;
  phone: string | null;
  address: string | null;
  unitNumber: string | null;
  rentalAgency: string | null;
  email: string | null;
  propertyManagerName: string | null;
  propertyManagerPhone: string | null;
  propertyManagerEmail: string | null;
  createdAt: string | null;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
};

// Helper to check if user is online (active within last 5 minutes)
const isUserOnline = (lastActiveAt: string | null): boolean => {
  if (!lastActiveAt) return false;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return new Date(lastActiveAt) > fiveMinutesAgo;
};

// Helper to format relative time
const formatRelativeTime = (dateStr: string | null): string => {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return format(date, "MMM d");
};

type UserStats = {
  incidentCount: number;
  forumPostCount: number;
};

const DEFAULT_SYSTEM_PROMPT = `You are a tenant advocacy assistant for YourRentalRights.com. Your role is to help renters document issues, understand their rights, and take action against negligent landlords.

**Your capabilities:**
- Answer questions about tenant rights, housing laws, and landlord obligations
- Help users document maintenance issues, health hazards, and lease violations
- Draft formal demand letters, complaint letters to management, and notices to landlords
- Guide users on evidence collection (photos, dates, communication logs)
- Explain legal remedies available to tenants (rent withholding, repair-and-deduct, lease termination)

**Guidelines:**
- Only answer questions related to tenant rights, housing issues, and landlord disputes
- If asked about unrelated topics, politely redirect: "I'm here to help with your rental rights. Is there a housing issue I can assist with?"
- Use the user's profile information (name, address, rental agency) when drafting letters
- Be empathetic but professional - tenants are often stressed
- Cite general legal principles but remind users to verify local laws
- When drafting letters, use formal language and include specific dates, incidents, and demands

**You have access to:** The user's incident history, evidence timeline context, profile details, and lease document to provide personalized assistance.

**Image access rules:** You may visually analyze photos only when image files are included in the current AI request. Relevant timeline photos may sometimes be included automatically when the user clearly asks you to inspect a photo, image, picture, or screenshot. If no image files were included in the current request, do not claim that you directly viewed the image; say you only have the timeline/context reference unless the user attaches the file.`;

type AnalyticsData = {
  totalUsers: number;
  activeUsers: number;
  totalCases: number;
  openCases: number;
  closedCases: number;
  totalEvidence: number;
  aiChats: number;
  forumPosts: number;
  forumReplies: number;
  recentUsers: { date: string; count: number }[];
  recentCases: { date: string; count: number }[];
  periodNewUsers: number;
  periodNewCases: number;
  periodDays: number;
};

type LitigationStats = {
  pdfExports: number;
  litigationReviews: number;
  strongCases: number;
};

function AnalyticsDashboard() {
  const [timePeriod, setTimePeriod] = useState<7 | 30 | 90>(30);
  
  const { data: dashboardData, isLoading } = useQuery<{ analytics: AnalyticsData; litigationStats: LitigationStats }>({
    queryKey: [`/api/admin/dashboard?days=${timePeriod}`],
  });

  const analytics = dashboardData?.analytics;
  const litigationStats = dashboardData?.litigationStats;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8 text-slate-500">
        Unable to load analytics data.
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, color = "blue" }: { title: string; value: number | string; icon: any; color?: string }) => (
    <Card className="border-slate-200">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
          </div>
          <div className={`p-3 rounded-lg bg-${color}-100`}>
            <Icon className={`w-6 h-6 text-${color}-600`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Platform Overview</CardTitle>
          <CardDescription>Key metrics for your tenant rights platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-slate-600">Total Users</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{analytics.totalUsers}</p>
              <p className="text-xs text-slate-500 mt-1">{analytics.activeUsers} active this week</p>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-slate-600">Total Cases</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{analytics.totalCases}</p>
              <p className="text-xs text-slate-500 mt-1">{analytics.openCases} open, {analytics.closedCases} closed</p>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-slate-600">AI Chats</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{analytics.aiChats}</p>
              <p className="text-xs text-slate-500 mt-1">Chat messages sent</p>
            </div>
            
            <div className="p-4 bg-amber-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-medium text-slate-600">Evidence</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{analytics.totalEvidence}</p>
              <p className="text-xs text-slate-500 mt-1">Photos, docs, & logs</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Forum Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">Forum Posts</span>
                </div>
                <span className="text-2xl font-bold">{analytics.forumPosts}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  <span className="font-medium">Forum Replies</span>
                </div>
                <span className="text-2xl font-bold">{analytics.forumReplies}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(Number(e.target.value) as 7 | 30 | 90)}
              className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="time-period-select"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-600">New Users</p>
                  <span className="text-2xl font-bold text-blue-600" data-testid="new-users-count">{analytics.periodNewUsers}</span>
                </div>
                <div className="flex items-end gap-1 h-12">
                  {analytics.recentUsers.length > 0 ? (
                    analytics.recentUsers.slice(-14).map((d, i) => (
                      <div 
                        key={i}
                        className="flex-1 bg-blue-500 rounded-t min-h-[4px]"
                        style={{ height: `${Math.max(10, (d.count / Math.max(...analytics.recentUsers.map(x => x.count), 1)) * 100)}%` }}
                        title={`${d.date}: ${d.count} users`}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">No recent signups</p>
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-600">New Cases</p>
                  <span className="text-2xl font-bold text-green-600" data-testid="new-cases-count">{analytics.periodNewCases}</span>
                </div>
                <div className="flex items-end gap-1 h-12">
                  {analytics.recentCases.length > 0 ? (
                    analytics.recentCases.slice(-14).map((d, i) => (
                      <div 
                        key={i}
                        className="flex-1 bg-green-500 rounded-t min-h-[4px]"
                        style={{ height: `${Math.max(10, (d.count / Math.max(...analytics.recentCases.map(x => x.count), 1)) * 100)}%` }}
                        title={`${d.date}: ${d.count} cases`}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">No recent cases</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Litigation Analytics */}
      {litigationStats && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="w-5 h-5" />
              Litigation Analytics
            </CardTitle>
            <CardDescription>PDF exports and case analysis metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-indigo-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="w-5 h-5 text-indigo-600" />
                  <span className="text-sm font-medium text-slate-600">PDF Exports</span>
                </div>
                <p className="text-3xl font-bold text-slate-900">{litigationStats.pdfExports}</p>
                <p className="text-xs text-slate-500 mt-1">Case reports generated</p>
              </div>
              
              <div className="p-4 bg-cyan-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-5 h-5 text-cyan-600" />
                  <span className="text-sm font-medium text-slate-600">AI Analyses</span>
                </div>
                <p className="text-3xl font-bold text-slate-900">{litigationStats.litigationReviews}</p>
                <p className="text-xs text-slate-500 mt-1">Litigation reviews run</p>
              </div>
              
              <div className="p-4 bg-emerald-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium text-slate-600">Strong Cases</span>
                </div>
                <p className="text-3xl font-bold text-slate-900">{litigationStats.strongCases}</p>
                <p className="text-xs text-slate-500 mt-1">Flagged for litigation</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [grokApiKey, setGrokApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ForumCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("MessageSquare");

  // User management state
  const [userSearch, setUserSearch] = useState("");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<AdminUser | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [statsUser, setStatsUser] = useState<AdminUser | null>(null);
  
  // Bulk selection state
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  
  // User form fields
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formUnitNumber, setFormUnitNumber] = useState("");
  const [formRentalAgency, setFormRentalAgency] = useState("");
  const [formPropertyManagerName, setFormPropertyManagerName] = useState("");
  const [formPropertyManagerPhone, setFormPropertyManagerPhone] = useState("");
  const [formPropertyManagerEmail, setFormPropertyManagerEmail] = useState("");
  const [formIsAdmin, setFormIsAdmin] = useState(false);

  const { data: users } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user?.isAdmin,
  });

  const { data: userStats } = useQuery<UserStats>({
    queryKey: ["/api/admin/users", statsUser?.id, "stats"],
    queryFn: () => apiRequest("GET", `/api/admin/users/${statsUser?.id}/stats`).then(r => r.json()),
    enabled: !!statsUser,
  });

  const filteredUsers = users?.filter(u => 
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.fullName?.toLowerCase().includes(userSearch.toLowerCase())) ||
    (u.email?.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const { data: settings } = useQuery<{ key: string; value: string }[]>({
    queryKey: ["/api/admin/settings"],
    enabled: !!user?.isAdmin,
  });

  const { data: forumCategories = [] } = useQuery<ForumCategory[]>({
    queryKey: ["/api/forum/categories"],
    enabled: !!user?.isAdmin,
  });

  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/forum/categories", {
        name: categoryName,
        description: categoryDescription,
        icon: categoryIcon,
        sortOrder: forumCategories.length,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/categories"] });
      setCategoryDialogOpen(false);
      setCategoryName("");
      setCategoryDescription("");
      setCategoryIcon("MessageSquare");
      toast({ title: "Category Created", description: "New forum category has been added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create category.", variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!editingCategory) return;
      await apiRequest("PATCH", `/api/forum/categories/${editingCategory.id}`, {
        name: categoryName,
        description: categoryDescription,
        icon: categoryIcon,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/categories"] });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryName("");
      setCategoryDescription("");
      setCategoryIcon("MessageSquare");
      toast({ title: "Category Updated", description: "Forum category has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update category.", variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/forum/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/categories"] });
      toast({ title: "Category Deleted", description: "Forum category has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete category.", variant: "destructive" });
    },
  });

  const moveCategoryMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: number; direction: "up" | "down" }) => {
      const sorted = [...forumCategories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const index = sorted.findIndex((c) => c.id === id);
      if (index < 0) return;

      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= sorted.length) return;

      const current = sorted[index];
      const target = sorted[swapIndex];

      await Promise.all([
        apiRequest("PATCH", `/api/forum/categories/${current.id}`, { sortOrder: target.sortOrder ?? swapIndex }),
        apiRequest("PATCH", `/api/forum/categories/${target.id}`, { sortOrder: current.sortOrder ?? index }),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/categories"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reorder category.", variant: "destructive" });
    },
  });

  const openEditCategory = (category: ForumCategory) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description || "");
    setCategoryIcon(category.icon || "MessageSquare");
    setCategoryDialogOpen(true);
  };

  const openNewCategory = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDescription("");
    setCategoryIcon("MessageSquare");
    setCategoryDialogOpen(true);
  };

  useEffect(() => {
    if (settings) {
      const prompt = settings.find(s => s.key === "ai_system_prompt");
      if (prompt) {
        setSystemPrompt(prompt.value);
      }
    }
  }, [settings]);

  const settingsMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await apiRequest("POST", "/api/admin/settings", { key, value });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      const label = variables.key === "ai_system_prompt" ? "System Prompt" : "API Key";
      toast({ title: "Setting Saved", description: `${label} has been updated.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save setting.", variant: "destructive" });
    },
  });

  const deleteSettingMutation = useMutation({
    mutationFn: async (key: string) => {
      await apiRequest("DELETE", `/api/admin/settings/${key}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Setting Deleted", description: "API key has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete setting.", variant: "destructive" });
    },
  });

  // User management mutations
  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Created", description: "New user account has been created." });
      setUserDialogOpen(false);
      resetUserForm();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Updated", description: "User account has been updated." });
      setUserDialogOpen(false);
      setEditingUser(null);
      resetUserForm();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Deleted", description: "User and all their data have been removed." });
      setDeleteUserConfirm(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/status`, { status });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Status Updated", description: `User has been ${variables.status === "active" ? "activated" : "suspended"}.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Bulk action mutations
  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ userIds, status }: { userIds: number[]; status: string }) => {
      const res = await apiRequest("POST", "/api/admin/users/bulk-status", { userIds, status });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUsers(new Set());
      toast({ 
        title: "Bulk Action Completed", 
        description: `${variables.userIds.length} user(s) have been ${variables.status === "active" ? "activated" : "suspended"}.` 
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (userIds: number[]) => {
      const res = await apiRequest("POST", "/api/admin/users/bulk-delete", { userIds });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: (_, userIds) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUsers(new Set());
      setBulkDeleteConfirm(false);
      toast({ title: "Users Deleted", description: `${userIds.length} user(s) have been deleted.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/password`, { password });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password Reset", description: "User's password has been updated." });
      setPasswordResetUser(null);
      setNewPassword("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetUserForm = () => {
    setFormUsername("");
    setFormPassword("");
    setFormFullName("");
    setFormEmail("");
    setFormPhone("");
    setFormAddress("");
    setFormUnitNumber("");
    setFormRentalAgency("");
    setFormPropertyManagerName("");
    setFormPropertyManagerPhone("");
    setFormPropertyManagerEmail("");
    setFormIsAdmin(false);
  };

  const openNewUser = () => {
    resetUserForm();
    setEditingUser(null);
    setUserDialogOpen(true);
  };

  const openEditUser = (u: AdminUser) => {
    setEditingUser(u);
    setFormUsername(u.username);
    setFormPassword("");
    setFormFullName(u.fullName || "");
    setFormEmail(u.email || "");
    setFormPhone(u.phone || "");
    setFormAddress(u.address || "");
    setFormUnitNumber(u.unitNumber || "");
    setFormRentalAgency(u.rentalAgency || "");
    setFormPropertyManagerName(u.propertyManagerName || "");
    setFormPropertyManagerPhone(u.propertyManagerPhone || "");
    setFormPropertyManagerEmail(u.propertyManagerEmail || "");
    setFormIsAdmin(u.isAdmin);
    setUserDialogOpen(true);
  };

  const handleUserSubmit = () => {
    if (editingUser) {
      updateUserMutation.mutate({
        id: editingUser.id,
        data: {
          username: formUsername,
          fullName: formFullName || null,
          email: formEmail || null,
          phone: formPhone || null,
          address: formAddress || null,
          unitNumber: formUnitNumber || null,
          rentalAgency: formRentalAgency || null,
          propertyManagerName: formPropertyManagerName || null,
          propertyManagerPhone: formPropertyManagerPhone || null,
          propertyManagerEmail: formPropertyManagerEmail || null,
          isAdmin: formIsAdmin,
        },
      });
    } else {
      if (!formUsername || !formPassword) {
        toast({ title: "Error", description: "Username and password are required.", variant: "destructive" });
        return;
      }
      createUserMutation.mutate({
        username: formUsername,
        password: formPassword,
        fullName: formFullName || null,
        email: formEmail || null,
        phone: formPhone || null,
        isAdmin: formIsAdmin,
      });
    }
  };

  if (!user?.isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Settings className="w-8 h-8" />
          Admin Panel
        </h1>
        <p className="text-slate-600 mt-2">
          Manage API keys, AI behavior, user accounts, and application settings.
        </p>
      </div>

      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-5">
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="w-4 h-4" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="ai-config" className="gap-2">
            <Brain className="w-4 h-4" /> AI Config
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-2">
            <Key className="w-4 h-4" /> API Keys
          </TabsTrigger>
          <TabsTrigger value="forum" className="gap-2">
            <MessageSquare className="w-4 h-4" /> Forum
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" /> Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <AnalyticsDashboard />
        </TabsContent>

        <TabsContent value="ai-config">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>AI System Prompt</CardTitle>
              <CardDescription>
                Configure how the AI assistant behaves and responds to users. This prompt guides the AI's personality, capabilities, and boundaries.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Instructions</Label>
                <Textarea 
                  id="systemPrompt"
                  value={systemPrompt} 
                  onChange={(e) => setSystemPrompt(e.target.value)} 
                  placeholder="Enter instructions for the AI..."
                  className="min-h-[400px] font-mono text-sm"
                  data-testid="textarea-system-prompt"
                />
                <p className="text-xs text-slate-500">
                  This prompt is sent to the AI with every conversation. It defines the AI's role, capabilities, and behavior guidelines.
                </p>
              </div>
              <div className="flex gap-4">
                <Button 
                  onClick={() => settingsMutation.mutate({ key: "ai_system_prompt", value: systemPrompt })}
                  disabled={settingsMutation.isPending}
                  className="gap-2"
                  data-testid="btn-save-prompt"
                >
                  <Save className="w-4 h-4" />
                  Save System Prompt
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
                >
                  Reset to Default
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>AI API Keys</CardTitle>
              <CardDescription>
                Configure API keys for the AI assistant. Keys are stored securely.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="grok">Grok API Key (Real-Time)</Label>
                <div className="flex gap-2">
                  <Input 
                    id="grok"
                    type="password"
                    value={grokApiKey} 
                    onChange={(e) => setGrokApiKey(e.target.value)} 
                    placeholder="xai-..."
                    className="flex-1"
                    data-testid="input-grok-key"
                  />
                  <Button 
                    onClick={() => settingsMutation.mutate({ key: "grok_api_key", value: grokApiKey })}
                    disabled={!grokApiKey || settingsMutation.isPending}
                    data-testid="btn-save-grok"
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500">Used for real-time AI analysis of tenant rights via Grok.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openai">OpenAI API Key (Fallback)</Label>
                <div className="flex gap-2">
                  <Input 
                    id="openai"
                    type="password"
                    value={openaiApiKey} 
                    onChange={(e) => setOpenaiApiKey(e.target.value)} 
                    placeholder="sk-..."
                    className="flex-1"
                    data-testid="input-openai-key"
                  />
                  <Button 
                    onClick={() => settingsMutation.mutate({ key: "openai_api_key", value: openaiApiKey })}
                    disabled={!openaiApiKey || settingsMutation.isPending}
                    data-testid="btn-save-openai"
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500">Optional fallback if Grok is unavailable.</p>
              </div>

              {settings && settings.filter(s => s.key.includes("api_key")).length > 0 && (
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Configured API Keys</h4>
                  <div className="flex flex-wrap gap-2">
                    {settings.filter(s => s.key.includes("api_key")).map((s) => (
                      <div key={s.key} className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {s.key.replace("_api_key", "").replace("_", " ")}: ****{s.value.slice(-4)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-red-600"
                          onClick={() => deleteSettingMutation.mutate(s.key)}
                          disabled={deleteSettingMutation.isPending}
                          data-testid={`delete-${s.key}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forum">
          <Card className="border-slate-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Forum Categories</CardTitle>
                  <CardDescription>
                    Manage discussion categories for the community forum.
                  </CardDescription>
                </div>
                <Button onClick={openNewCategory} className="gap-2" data-testid="add-category-btn">
                  <Plus className="w-4 h-4" /> Add Category
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {forumCategories.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No categories yet. Create one to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {[...forumCategories]
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                    .map((category, index, arr) => (
                    <div 
                      key={category.id}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-slate-50"
                      data-testid={`category-row-${category.id}`}
                    >
                      <GripVertical className="w-4 h-4 text-slate-400" />
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-slate-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-900">{category.name}</h4>
                        {category.description && (
                          <p className="text-sm text-slate-500 truncate">{category.description}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0">Order: {category.sortOrder}</Badge>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveCategoryMutation.mutate({ id: category.id, direction: "up" })}
                          disabled={index === 0 || moveCategoryMutation.isPending}
                          data-testid={`move-up-category-${category.id}`}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveCategoryMutation.mutate({ id: category.id, direction: "down" })}
                          disabled={index === arr.length - 1 || moveCategoryMutation.isPending}
                          data-testid={`move-down-category-${category.id}`}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditCategory(category)}
                          data-testid={`edit-category-${category.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => deleteCategoryMutation.mutate(category.id)}
                          disabled={deleteCategoryMutation.isPending}
                          data-testid={`delete-category-${category.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="catName">Category Name</Label>
                  <Input
                    id="catName"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="e.g., Maintenance Issues"
                    data-testid="input-category-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="catDesc">Description</Label>
                  <Textarea
                    id="catDesc"
                    value={categoryDescription}
                    onChange={(e) => setCategoryDescription(e.target.value)}
                    placeholder="What topics belong in this category?"
                    rows={3}
                    data-testid="input-category-desc"
                  />
                </div>
                <Button
                  onClick={() => editingCategory ? updateCategoryMutation.mutate() : createCategoryMutation.mutate()}
                  disabled={!categoryName.trim() || createCategoryMutation.isPending || updateCategoryMutation.isPending}
                  className="w-full"
                  data-testid="save-category-btn"
                >
                  {editingCategory ? "Update Category" : "Create Category"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="users">
          <Card className="border-slate-200">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>User Accounts</CardTitle>
                  <CardDescription>
                    Manage all registered users, their status, and permissions.
                  </CardDescription>
                </div>
                <Button onClick={openNewUser} className="gap-2" data-testid="add-user-btn">
                  <UserPlus className="w-4 h-4" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by username, name, or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10"
                    data-testid="user-search-input"
                  />
                </div>
                {selectedUsers.size > 0 && (
                  <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                    <span className="text-sm font-medium text-blue-700">
                      {selectedUsers.size} selected
                    </span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => bulkUpdateStatusMutation.mutate({ userIds: Array.from(selectedUsers), status: "active" })}
                      disabled={bulkUpdateStatusMutation.isPending}
                      data-testid="bulk-activate"
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      Activate
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => bulkUpdateStatusMutation.mutate({ userIds: Array.from(selectedUsers), status: "suspended" })}
                      disabled={bulkUpdateStatusMutation.isPending}
                      data-testid="bulk-suspend"
                    >
                      <Ban className="w-3 h-3 mr-1" />
                      Suspend
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      className="h-7 text-xs"
                      onClick={() => setBulkDeleteConfirm(true)}
                      data-testid="bulk-delete"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setSelectedUsers(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox 
                          checked={filteredUsers && filteredUsers.length > 0 && filteredUsers.every(u => u.id === user?.id || selectedUsers.has(u.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const newSelection = new Set(filteredUsers?.filter(u => u.id !== user?.id).map(u => u.id) || []);
                              setSelectedUsers(newSelection);
                            } else {
                              setSelectedUsers(new Set());
                            }
                          }}
                          data-testid="select-all-users"
                        />
                      </TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers?.map((u) => (
                      <TableRow key={u.id} data-testid={`user-row-${u.id}`} className={selectedUsers.has(u.id) ? "bg-blue-50" : ""}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedUsers.has(u.id)}
                            disabled={u.id === user?.id}
                            onCheckedChange={(checked) => {
                              const newSelection = new Set(selectedUsers);
                              if (checked) {
                                newSelection.add(u.id);
                              } else {
                                newSelection.delete(u.id);
                              }
                              setSelectedUsers(newSelection);
                            }}
                            data-testid={`select-user-${u.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              {isUserOnline(u.lastActiveAt) && (
                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" title="Online now" />
                              )}
                              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-sm font-medium text-slate-600">
                                {u.username.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            <div>
                              <div className="font-medium">{u.username}</div>
                              {u.fullName && <div className="text-sm text-slate-500">{u.fullName}</div>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{u.email || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={u.status === "active" ? "default" : "destructive"} className={u.status === "active" ? "bg-green-100 text-green-800" : ""}>
                            {u.status === "active" ? "Active" : "Suspended"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.isAdmin ? "default" : "secondary"}>
                            {u.isAdmin ? "Admin" : "User"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {u.createdAt ? format(new Date(u.createdAt), "MMM d, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="text-slate-600">{formatRelativeTime(u.lastLoginAt)}</div>
                            {u.lastActiveAt && (
                              <div className="text-xs text-slate-400">
                                Active: {formatRelativeTime(u.lastActiveAt)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setStatsUser(u)}
                              title="View Stats"
                              data-testid={`stats-user-${u.id}`}
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditUser(u)}
                              title="Edit User"
                              data-testid={`edit-user-${u.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPasswordResetUser(u)}
                              title="Reset Password"
                              data-testid={`reset-password-${u.id}`}
                            >
                              <KeyRound className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateUserStatusMutation.mutate({
                                id: u.id,
                                status: u.status === "active" ? "suspended" : "active"
                              })}
                              title={u.status === "active" ? "Suspend User" : "Activate User"}
                              disabled={u.id === user?.id}
                              data-testid={`toggle-status-${u.id}`}
                            >
                              {u.status === "active" ? <Ban className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setDeleteUserConfirm(u)}
                              disabled={u.id === user?.id}
                              title="Delete User"
                              data-testid={`delete-user-${u.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {(!filteredUsers || filteredUsers.length === 0) && (
                <div className="text-center py-8 text-slate-500">
                  {userSearch ? "No users match your search." : "No users found."}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add/Edit User Dialog */}
          <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
                <DialogDescription>
                  {editingUser ? "Update user account details." : "Create a new user account."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="space-y-2">
                  <Label htmlFor="formUsername">Username *</Label>
                  <Input
                    id="formUsername"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="Enter username"
                    data-testid="input-user-username"
                  />
                </div>
                {!editingUser && (
                  <div className="space-y-2">
                    <Label htmlFor="formPassword">Password *</Label>
                    <Input
                      id="formPassword"
                      type="password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Enter password"
                      data-testid="input-user-password"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="formFullName">Full Name</Label>
                  <Input
                    id="formFullName"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="Enter full name"
                    data-testid="input-user-fullname"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formEmail">Email</Label>
                  <Input
                    id="formEmail"
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="Enter email"
                    data-testid="input-user-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formPhone">Phone</Label>
                  <Input
                    id="formPhone"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="Enter phone number"
                    data-testid="input-user-phone"
                  />
                </div>
                {editingUser && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="formAddress">Address</Label>
                      <Input
                        id="formAddress"
                        value={formAddress}
                        onChange={(e) => setFormAddress(e.target.value)}
                        placeholder="Enter address"
                        data-testid="input-user-address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="formUnitNumber">Unit Number</Label>
                      <Input
                        id="formUnitNumber"
                        value={formUnitNumber}
                        onChange={(e) => setFormUnitNumber(e.target.value)}
                        placeholder="Enter unit number"
                        data-testid="input-user-unit"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="formRentalAgency">Rental Agency</Label>
                      <Input
                        id="formRentalAgency"
                        value={formRentalAgency}
                        onChange={(e) => setFormRentalAgency(e.target.value)}
                        placeholder="Enter rental agency"
                        data-testid="input-user-agency"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="formPropertyManagerName">Property Manager Name</Label>
                      <Input
                        id="formPropertyManagerName"
                        value={formPropertyManagerName}
                        onChange={(e) => setFormPropertyManagerName(e.target.value)}
                        placeholder="Enter property manager name"
                        data-testid="input-user-pm-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="formPropertyManagerPhone">Property Manager Phone</Label>
                      <Input
                        id="formPropertyManagerPhone"
                        value={formPropertyManagerPhone}
                        onChange={(e) => setFormPropertyManagerPhone(e.target.value)}
                        placeholder="Enter property manager phone"
                        data-testid="input-user-pm-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="formPropertyManagerEmail">Property Manager Email</Label>
                      <Input
                        id="formPropertyManagerEmail"
                        type="email"
                        value={formPropertyManagerEmail}
                        onChange={(e) => setFormPropertyManagerEmail(e.target.value)}
                        placeholder="Enter property manager email"
                        data-testid="input-user-pm-email"
                      />
                    </div>
                  </>
                )}
                <div className="flex items-center gap-2">
                  <Switch
                    id="formIsAdmin"
                    checked={formIsAdmin}
                    onCheckedChange={setFormIsAdmin}
                    data-testid="switch-user-admin"
                  />
                  <Label htmlFor="formIsAdmin">Administrator</Label>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUserSubmit}
                  disabled={createUserMutation.isPending || updateUserMutation.isPending}
                  data-testid="save-user-btn"
                >
                  {editingUser ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete User Confirmation */}
          <AlertDialog open={!!deleteUserConfirm} onOpenChange={(open) => !open && setDeleteUserConfirm(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete User Account</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete <strong>{deleteUserConfirm?.username}</strong>? This will permanently remove the user and all their data including incidents, logs, and forum posts. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => deleteUserConfirm && deleteUserMutation.mutate(deleteUserConfirm.id)}
                  data-testid="confirm-delete-user"
                >
                  Delete User
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Bulk Delete Confirmation */}
          <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Multiple Users</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete <strong>{selectedUsers.size} user(s)</strong>? This will permanently remove all selected users and their data including incidents, logs, and forum posts. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => bulkDeleteMutation.mutate(Array.from(selectedUsers))}
                  disabled={bulkDeleteMutation.isPending}
                  data-testid="confirm-bulk-delete"
                >
                  {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedUsers.size} Users`}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Password Reset Dialog */}
          <Dialog open={!!passwordResetUser} onOpenChange={(open) => !open && setPasswordResetUser(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset Password</DialogTitle>
                <DialogDescription>
                  Set a new password for <strong>{passwordResetUser?.username}</strong>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    data-testid="input-new-password"
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setPasswordResetUser(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => passwordResetUser && resetPasswordMutation.mutate({ id: passwordResetUser.id, password: newPassword })}
                  disabled={newPassword.length < 6 || resetPasswordMutation.isPending}
                  data-testid="confirm-reset-password"
                >
                  Reset Password
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* User Stats Dialog */}
          <Dialog open={!!statsUser} onOpenChange={(open) => !open && setStatsUser(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>User Statistics</DialogTitle>
                <DialogDescription>
                  Activity summary for <strong>{statsUser?.username}</strong>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-100 rounded-lg text-center">
                    <div className="text-3xl font-bold text-slate-900">{userStats?.incidentCount ?? "-"}</div>
                    <div className="text-sm text-slate-500">Incidents</div>
                  </div>
                  <div className="p-4 bg-slate-100 rounded-lg text-center">
                    <div className="text-3xl font-bold text-slate-900">{userStats?.forumPostCount ?? "-"}</div>
                    <div className="text-sm text-slate-500">Forum Posts</div>
                  </div>
                </div>
                <div className="text-sm text-slate-500 space-y-1">
                  <p><strong>Joined:</strong> {statsUser?.createdAt ? format(new Date(statsUser.createdAt), "MMMM d, yyyy") : "Unknown"}</p>
                  <p><strong>Last Login:</strong> {statsUser?.lastLoginAt ? format(new Date(statsUser.lastLoginAt), "MMMM d, yyyy 'at' h:mm a") : "Never"}</p>
                  <p><strong>Status:</strong> {statsUser?.status === "active" ? "Active" : "Suspended"}</p>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button onClick={() => setStatsUser(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
