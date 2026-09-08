import { useGetUserStats, getGetUserStatsQueryKey, useListUsers, getListUsersQueryKey, Role } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, ShieldCheck, Activity } from "lucide-react";
import { RoleBadge } from "@/components/RoleBadge";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetUserStats({
    query: { queryKey: getGetUserStatsQueryKey() }
  });

  const { data: recentUsers, isLoading: recentLoading } = useListUsers(
    { page: 1, pageSize: 5 },
    { query: { queryKey: getListUsersQueryKey({ page: 1, pageSize: 5 }) } }
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Overview of your access control metrics.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-sm shadow-slate-200/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Users</CardTitle>
              <Users className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsLoading ? "—" : stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm shadow-slate-200/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Active Accounts</CardTitle>
              <Activity className="h-4 w-4 text-teal-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsLoading ? "—" : stats?.active || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm shadow-slate-200/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Verified Emails</CardTitle>
              <UserCheck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsLoading ? "—" : stats?.verified || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm shadow-slate-200/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Agents & Admins</CardTitle>
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "—" : (stats?.byRole.AGENT || 0) + (stats?.byRole.ADMIN || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4 border-0 shadow-sm shadow-slate-200/50">
            <CardHeader>
              <CardTitle>Recent Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentLoading ? (
                  <div className="text-sm text-slate-500">Loading...</div>
                ) : recentUsers?.users.length === 0 ? (
                  <div className="text-sm text-slate-500">No users found.</div>
                ) : (
                  recentUsers?.users.map((user, i) => (
                    <div 
                      key={user.id} 
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors animate-in fade-in slide-in-from-bottom-2"
                      style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-medium text-slate-600">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{user.name}</span>
                          <span className="text-xs text-slate-500">{user.email}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-500 hidden sm:inline-block">
                          {format(new Date(user.createdAt), "MMM d, yyyy")}
                        </span>
                        <RoleBadge role={user.role} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card className="col-span-3 border-0 shadow-sm shadow-slate-200/50">
            <CardHeader>
              <CardTitle>Role Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {statsLoading ? (
                  <div className="text-sm text-slate-500">Loading...</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-600" />
                        <span className="text-sm font-medium">Admin</span>
                      </div>
                      <span className="text-sm text-slate-500">{stats?.byRole.ADMIN || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-teal-600" />
                        <span className="text-sm font-medium">Agent</span>
                      </div>
                      <span className="text-sm text-slate-500">{stats?.byRole.AGENT || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-slate-400" />
                        <span className="text-sm font-medium">User</span>
                      </div>
                      <span className="text-sm text-slate-500">{stats?.byRole.USER || 0}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
