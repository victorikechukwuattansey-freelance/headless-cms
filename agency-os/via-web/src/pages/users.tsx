import { useState } from "react";
import { useListUsers, getListUsersQueryKey, Role, useUpdateUser, useDeleteUser, AuthUser } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { RoleGuard } from "@/components/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { RoleBadge } from "@/components/RoleBadge";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Search, MoreHorizontal, Edit, Trash2, ShieldAlert, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum([Role.USER, Role.AGENT, Role.ADMIN]),
  isActive: z.boolean(),
});

export default function Users() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AuthUser | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryParams = {
    page,
    pageSize: 10,
    ...(search ? { search } : {}),
    ...(roleFilter !== "ALL" ? { role: roleFilter } : {})
  };

  const { data: listData, isLoading } = useListUsers(queryParams, {
    query: { queryKey: getListUsersQueryKey(queryParams) }
  });

  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const form = useForm<z.infer<typeof updateUserSchema>>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: "",
      role: Role.USER,
      isActive: true,
    },
  });

  const handleEditClick = (user: AuthUser) => {
    form.reset({
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    });
    setEditingUser(user);
  };

  const onUpdateSubmit = async (values: z.infer<typeof updateUserSchema>) => {
    if (!editingUser) return;
    try {
      await updateMutation.mutateAsync({ id: editingUser.id, data: values });
      toast({ title: "User updated successfully" });
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey(queryParams) });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to update user", description: e.data?.message });
    }
  };

  const onDeleteConfirm = async () => {
    if (!deletingUser) return;
    try {
      await deleteMutation.mutateAsync({ id: deletingUser.id });
      toast({ title: "User deleted successfully" });
      setDeletingUser(null);
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey(queryParams) });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to delete user", description: e.data?.message });
    }
  };

  return (
    <RoleGuard allowedRoles={[Role.ADMIN]} fallback="card">
      <Layout>
        <div className="space-y-6 animate-in fade-in duration-500">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h1>
            <p className="text-slate-500">View and manage system access, roles, and status.</p>
          </div>

          <Card className="border-0 shadow-sm shadow-slate-200/50">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search users..." 
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as Role | "ALL")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Roles</SelectItem>
                      <SelectItem value={Role.ADMIN}>Admin</SelectItem>
                      <SelectItem value={Role.AGENT}>Agent</SelectItem>
                      <SelectItem value={Role.USER}>User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                        </TableCell>
                      </TableRow>
                    ) : listData?.users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                          No users found matching your criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      listData?.users.map((user, i) => (
                        <TableRow 
                          key={user.id}
                          className="animate-in fade-in slide-in-from-bottom-2"
                          style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
                        >
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{user.name}</span>
                              <span className="text-xs text-slate-500">{user.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <RoleBadge role={user.role} />
                          </TableCell>
                          <TableCell>
                            {user.isActive ? (
                              <span className="inline-flex items-center gap-1.5 py-0.5 px-2 rounded-md text-xs font-medium bg-teal-50 text-teal-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 py-0.5 px-2 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                Inactive
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {format(new Date(user.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleEditClick(user)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit User
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => setDeletingUser(user)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {listData && listData.total > 0 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-slate-500">
                    Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, listData.total)} of {listData.total} users
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={page === 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={page * 10 >= listData.total}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update role and status for {editingUser?.email}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onUpdateSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={Role.USER}>User</SelectItem>
                          <SelectItem value={Role.AGENT}>Agent</SelectItem>
                          <SelectItem value={Role.ADMIN}>Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Active Account</FormLabel>
                        <p className="text-sm text-slate-500">
                          Allow this user to log in and access the system.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save changes
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={!!deletingUser} onOpenChange={(o) => !o && setDeletingUser(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" /> Confirm Deletion
              </DialogTitle>
              <DialogDescription className="pt-2">
                Are you sure you want to delete <strong>{deletingUser?.name}</strong> ({deletingUser?.email})? 
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDeletingUser(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={onDeleteConfirm} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Layout>
    </RoleGuard>
  );
}
