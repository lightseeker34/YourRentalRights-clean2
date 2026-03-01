import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { User, Save, Upload, FileText, X, MessageSquare, Bell, Eye, EyeOff } from "lucide-react";
import { GuidedTour } from "@/components/guided-tour";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    unitNumber: "",
    rentalAgency: "",
    propertyManagerName: "",
    propertyManagerPhone: "",
    propertyManagerEmail: "",
    leaseStartDate: "",
    monthlyRent: "",
    emergencyContact: "",
    leaseDocumentUrl: "",
    // Forum profile fields
    forumDisplayName: "",
    forumBio: "",
    avatarUrl: "",
    showOnlineStatus: true,
    emailNotifications: true,
  });

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || "",
        phone: user.phone || "",
        email: user.email || "",
        address: user.address || "",
        unitNumber: user.unitNumber || "",
        rentalAgency: user.rentalAgency || "",
        propertyManagerName: user.propertyManagerName || "",
        propertyManagerPhone: user.propertyManagerPhone || "",
        propertyManagerEmail: user.propertyManagerEmail || "",
        leaseStartDate: user.leaseStartDate || "",
        monthlyRent: user.monthlyRent || "",
        emergencyContact: user.emergencyContact || "",
        leaseDocumentUrl: user.leaseDocumentUrl || "",
        forumDisplayName: (user as any).forumDisplayName || "",
        forumBio: (user as any).forumBio || "",
        avatarUrl: (user as any).avatarUrl || "",
        showOnlineStatus: (user as any).showOnlineStatus !== false,
        emailNotifications: (user as any).emailNotifications !== false,
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      return await res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast({ title: "Profile Updated", description: "Your information has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    },
  });

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({ title: "Invalid File", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }

    setUploading(true);
    
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    
    try {
      const res = await fetch("/api/upload/lease", {
        method: "POST",
        body: formDataUpload,
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Upload failed");
      
      const { url } = await res.json();
      setFormData(prev => ({ ...prev, leaseDocumentUrl: url }));
      toast({ title: "Lease Uploaded", description: "Your lease document has been saved." });
    } catch {
      toast({ title: "Upload Failed", description: "Could not upload lease document.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeLease = async () => {
    try {
      await fetch("/api/user/lease", { method: "DELETE", credentials: "include" });
      setFormData(prev => ({ ...prev, leaseDocumentUrl: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Lease Removed", description: "Your lease document has been deleted." });
    } catch {
      toast({ title: "Error", description: "Failed to remove lease.", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-bold text-slate-900 flex items-center gap-3 text-[27px]">
          <User className="w-8 h-8" />
          My Account
        </h1>
        <p className="text-slate-600 mt-2">This information helps the AI assistant provide personalized advice.</p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="space-y-6 [&_input::placeholder]:text-slate-400 [&_textarea::placeholder]:text-slate-400"
      >
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Your contact details for communication and documentation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Input 
                  id="fullName"
                  value={formData.fullName} 
                  onChange={(e) => handleChange("fullName", e.target.value)} 
                  placeholder="Full Name"
                  data-testid="input-fullname"
                />
              </div>
              <div className="space-y-2">
                <Input 
                  id="email"
                  type="email"
                  value={formData.email} 
                  onChange={(e) => handleChange("email", e.target.value)} 
                  placeholder="Email"
                  data-testid="input-email"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Input 
                  id="phone"
                  value={formData.phone} 
                  onChange={(e) => handleChange("phone", e.target.value)} 
                  placeholder="Phone Number"
                  data-testid="input-phone"
                />
              </div>
              <div className="space-y-2">
                <Input 
                  id="emergencyContact"
                  value={formData.emergencyContact} 
                  onChange={(e) => handleChange("emergencyContact", e.target.value)} 
                  placeholder="Emergency Contact"
                  data-testid="input-emergency-contact"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200" data-testid="profile-rental-section">
          <CardHeader>
            <CardTitle>Property Details</CardTitle>
            <CardDescription>
              Information about your rental property and lease.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Input 
                  id="address"
                  value={formData.address} 
                  onChange={(e) => handleChange("address", e.target.value)} 
                  placeholder="Property Address"
                  data-testid="input-address"
                />
              </div>
              <div className="space-y-2">
                <Input 
                  id="unitNumber"
                  value={formData.unitNumber} 
                  onChange={(e) => handleChange("unitNumber", e.target.value)} 
                  placeholder="Unit / Apt #"
                  data-testid="input-unit"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="leaseStartDate">Lease Start Date</Label>
                <Input 
                  id="leaseStartDate"
                  type="date"
                  value={formData.leaseStartDate} 
                  onChange={(e) => handleChange("leaseStartDate", e.target.value)} 
                  data-testid="input-lease-start"
                />
              </div>
              <div className="space-y-2">
                <Input 
                  id="monthlyRent"
                  value={formData.monthlyRent} 
                  onChange={(e) => handleChange("monthlyRent", e.target.value)} 
                  placeholder="Monthly Rent"
                  data-testid="input-rent"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200" data-testid="profile-landlord-section">
          <CardHeader>
            <CardTitle>Property Management</CardTitle>
            <CardDescription>
              Details about your landlord or property management company.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input 
                id="rentalAgency"
                value={formData.rentalAgency} 
                onChange={(e) => handleChange("rentalAgency", e.target.value)} 
                placeholder="Property Management Company"
                data-testid="input-agency"
              />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Input 
                  id="propertyManagerName"
                  value={formData.propertyManagerName} 
                  onChange={(e) => handleChange("propertyManagerName", e.target.value)} 
                  placeholder="Property Manager Name"
                  data-testid="input-pm-name"
                />
              </div>
              <div className="space-y-2">
                <Input 
                  id="propertyManagerPhone"
                  value={formData.propertyManagerPhone} 
                  onChange={(e) => handleChange("propertyManagerPhone", e.target.value)} 
                  placeholder="Property Manager Phone"
                  data-testid="input-pm-phone"
                />
              </div>
              <div className="space-y-2">
                <Input 
                  id="propertyManagerEmail"
                  type="email"
                  value={formData.propertyManagerEmail} 
                  onChange={(e) => handleChange("propertyManagerEmail", e.target.value)} 
                  placeholder="Property Manager Email"
                  data-testid="input-pm-email"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200" data-testid="profile-forum-section">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Forum Profile
            </CardTitle>
            <CardDescription>
              Customize how you appear in the community forum.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Input 
                  id="forumDisplayName"
                  value={formData.forumDisplayName} 
                  onChange={(e) => handleChange("forumDisplayName", e.target.value)} 
                  placeholder="Display Name"
                  data-testid="input-forum-display-name"
                />
                <p className="text-xs text-slate-500">Leave blank to use your username</p>
              </div>
              <div className="space-y-2">
                <Input 
                  id="avatarUrl"
                  value={formData.avatarUrl} 
                  onChange={(e) => handleChange("avatarUrl", e.target.value)} 
                  placeholder="Avatar URL"
                  data-testid="input-avatar-url"
                />
                <p className="text-xs text-slate-500">Link to your profile picture</p>
              </div>
            </div>
            <div className="space-y-2">
              <Textarea 
                id="forumBio"
                value={formData.forumBio} 
                onChange={(e) => handleChange("forumBio", e.target.value)} 
                placeholder="Bio / Signature"
                rows={2}
                data-testid="input-forum-bio"
              />
            </div>
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {formData.showOnlineStatus ? (
                    <Eye className="w-4 h-4 text-green-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-slate-400" />
                  )}
                  <div>
                    <Label className="text-sm font-medium">Show Online Status</Label>
                    <p className="text-xs text-slate-500">Let others see when you're active</p>
                  </div>
                </div>
                <Switch
                  checked={formData.showOnlineStatus}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showOnlineStatus: checked }))}
                  data-testid="toggle-online-status"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-slate-500" />
                  <div>
                    <Label className="text-sm font-medium">Email Notifications</Label>
                    <p className="text-xs text-slate-500">Get notified about replies to your posts</p>
                  </div>
                </div>
                <Switch
                  checked={formData.emailNotifications}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, emailNotifications: checked }))}
                  data-testid="toggle-email-notifications"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200" data-testid="profile-lease-upload">
          <CardHeader>
            <CardTitle>Lease Document</CardTitle>
            <CardDescription>
              Upload your lease so the AI can reference specific terms when assisting you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {formData.leaseDocumentUrl ? (
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <FileText className="w-10 h-10 text-slate-600" />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Lease Document Uploaded</p>
                  <p className="text-sm text-slate-500">PDF file saved and accessible to AI</p>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={removeLease}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4 mr-1" /> Remove
                </Button>
              </div>
            ) : (
              <div 
                className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-slate-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                <p className="font-medium text-slate-700">Click to upload your lease</p>
                <p className="text-sm text-slate-500 mt-1">PDF format only, max 10MB</p>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                  data-testid="input-lease-upload"
                />
              </div>
            )}
            {uploading && (
              <p className="text-center text-slate-500 mt-4">Uploading...</p>
            )}
          </CardContent>
        </Card>

        <Button 
          type="submit" 
          className="w-full h-12 gap-2 text-lg btn-gradient" 
          disabled={updateMutation.isPending}
          data-testid="btn-save-profile"
        >
          <Save className="w-5 h-5" />
          {updateMutation.isPending ? "Saving..." : "Save Profile"}
        </Button>
      </form>
      
      <GuidedTour />
    </div>
  );
}
