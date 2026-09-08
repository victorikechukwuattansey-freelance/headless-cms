import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RoleBadge } from "@/components/RoleBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useResendVerification } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const resendMutation = useResendVerification();

  if (!user) return null;

  const handleResend = async () => {
    try {
      await resendMutation.mutateAsync({ data: { email: user.email } });
      toast({ title: "Verification email sent" });
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Failed to send", 
        description: e.data?.message || "An error occurred" 
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Profile</h1>
          <p className="text-slate-500">Manage your account settings and preferences.</p>
        </div>

        <Card className="max-w-2xl border-0 shadow-sm shadow-slate-200/50">
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>Your personal information and access level</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-slate-900 flex items-center justify-center text-2xl font-medium text-white uppercase shadow-inner">
                {user.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-medium">{user.name}</h3>
                <p className="text-slate-500">{user.email}</p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-slate-500">Role</span>
                <div>
                  <RoleBadge role={user.role} showIcon />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-slate-500">Account Status</span>
                <div>
                  {user.isActive ? (
                    <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Inactive</Badge>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium text-slate-500">Email Verification</span>
                <div className="flex items-center gap-3">
                  {user.isEmailVerified ? (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Verified</Badge>
                  ) : (
                    <>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Unverified</Badge>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-xs" 
                        onClick={handleResend}
                        disabled={resendMutation.isPending}
                      >
                        {resendMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                        Resend
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium text-slate-500">Member Since</span>
                <p className="text-sm font-medium">{format(new Date(user.createdAt), "MMMM d, yyyy")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
