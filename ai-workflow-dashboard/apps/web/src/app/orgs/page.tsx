"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, getToken, getOrg, setOrg, type OrgInfo, type OrgMember } from "@/lib/api";

const ROLES = ["ADMIN", "MANAGER", "DEVELOPER", "OPERATOR", "VIEWER", "BILLING_ADMIN", "AUDITOR"];

const MemberRow = memo(function MemberRow({
  member,
  canManage,
  onRoleChange,
  onRemove,
}: {
  member: OrgMember;
  canManage: boolean;
  onRoleChange: (userId: string, role: string) => void;
  onRemove: (userId: string) => void;
}) {
  return (
    <tr className="bg-slate-900/50">
      <td className="px-4 py-2">
        <div className="text-white">{member.displayName}</div>
        <div className="text-xs text-slate-500">{member.email}</div>
      </td>
      <td className="px-4 py-2">
        {canManage ? (
          <select
            value={member.role}
            onChange={(e) => onRoleChange(member.userId, e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white"
          >
            {[...ROLES, "OWNER"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-slate-300">{member.role}</span>
        )}
      </td>
      <td className="px-4 py-2 text-slate-400">{new Date(member.createdAt).toLocaleDateString()}</td>
      {canManage && (
        <td className="px-4 py-2 text-right">
          <button
            onClick={() => onRemove(member.userId)}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Remove
          </button>
        </td>
      )}
    </tr>
  );
});

export default function OrgsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const [currentOrg, setCurrentOrg] = useState<OrgInfo | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");

  // Derived — the role always lives on the selected org, mirroring it in
  // state only invites drift.
  const canManage =
    currentOrg?.role === "OWNER" || currentOrg?.role === "ADMIN";

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    void loadOrgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadOrgs() {
    try {
      const list = await api<OrgInfo[]>("/orgs");
      setOrgs(list);
      const selected = getOrg();
      const match = list.find((o) => o.id === selected) ?? list[0] ?? null;
      if (match) {
        setOrg(match.id);
        setCurrentOrg(match);
        void loadMembers(match.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organizations");
    }
  }

  async function loadMembers(orgId: string) {
    try {
      const list = await api<OrgMember[]>(`/orgs/${orgId}/members`);
      setMembers(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    }
  }

  function switchOrg(orgId: string) {
    setOrg(orgId);
    const next = orgs.find((o) => o.id === orgId) ?? null;
    setCurrentOrg(next);
    if (next) void loadMembers(next.id);
  }

  async function createOrg() {
    try {
      // Use the POST response directly — no full org-list refetch, and no
      // second lookup via switchOrg (which reads stale state).
      const created = await api<OrgInfo>("/orgs", {
        method: "POST",
        body: JSON.stringify({ name: newOrgName.trim() }),
      });
      setNewOrgName("");
      setOrgs((prev) => [...prev, created]);
      setOrg(created.id);
      setCurrentOrg(created);
      void loadMembers(created.id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    }
  }

  async function invite() {
    if (!currentOrg) return;
    try {
      await api(`/orgs/${currentOrg.id}/members`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setInviteEmail("");
      void loadMembers(currentOrg.id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite member");
    }
  }

  const changeRole = useCallback(
    async (userId: string, role: string) => {
      if (!currentOrg) return;
      try {
        await api(`/orgs/${currentOrg.id}/members/${userId}`, {
          method: "PATCH",
          body: JSON.stringify({ role }),
        });
        void loadMembers(currentOrg.id);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to change role");
      }
    },
    [currentOrg]
  );

  const removeMember = useCallback(
    async (userId: string) => {
      if (!currentOrg) return;
      try {
        await api(`/orgs/${currentOrg.id}/members/${userId}`, { method: "DELETE" });
        void loadMembers(currentOrg.id);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove member");
      }
    },
    [currentOrg]
  );

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-200">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-white">Organizations</h1>
        </div>
        {currentOrg && (
          <select
            value={currentOrg.id}
            onChange={(e) => void switchOrg(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {currentOrg && (
        <>
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-lg font-semibold text-white">{currentOrg.name}</h2>
            <p className="text-sm text-slate-400">
              {currentOrg.slug} · {currentOrg.plan} · your role: {currentOrg.role}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Members ({members.length})</h2>
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Member</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Joined</th>
                    {canManage && <th className="px-4 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {members.map((m) => (
                    <MemberRow
                      key={m.userId}
                      member={m}
                      canManage={canManage}
                      onRoleChange={(userId, role) => void changeRole(userId, role)}
                      onRemove={(userId) => void removeMember(userId)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {canManage && (
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-semibold text-white">Invite member</h2>
              <div className="flex gap-3">
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="member@example.com"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-white"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => void invite()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Invite
                </button>
              </div>
            </section>
          )}
        </>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-lg font-semibold text-white">Create organization</h2>
        <div className="flex gap-3">
          <input
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createOrg();
            }}
            placeholder="Organization name"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
          <button
            onClick={() => void createOrg()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            Create
          </button>
        </div>
      </section>
    </main>
  );
}
