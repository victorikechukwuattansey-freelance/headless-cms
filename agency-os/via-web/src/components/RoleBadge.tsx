import { Role } from "@workspace/api-client-react";
import { Badge } from "./ui/badge";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";

interface RoleBadgeProps {
  role: Role;
  showIcon?: boolean;
}

export function RoleBadge({ role, showIcon = false }: RoleBadgeProps) {
  switch (role) {
    case Role.ADMIN:
      return (
        <Badge variant="default" className="bg-orange-600 hover:bg-orange-700 text-white font-mono uppercase tracking-wider text-xs">
          {showIcon && <ShieldAlert className="mr-1.5 h-3 w-3" />}
          Admin
        </Badge>
      );
    case Role.AGENT:
      return (
        <Badge variant="secondary" className="bg-teal-600/10 text-teal-700 hover:bg-teal-600/20 font-mono uppercase tracking-wider text-xs border-teal-600/20">
          {showIcon && <ShieldCheck className="mr-1.5 h-3 w-3" />}
          Agent
        </Badge>
      );
    case Role.USER:
      return (
        <Badge variant="outline" className="text-slate-600 font-mono uppercase tracking-wider text-xs bg-slate-100">
          {showIcon && <Shield className="mr-1.5 h-3 w-3" />}
          User
        </Badge>
      );
    default:
      return <Badge variant="outline">{role}</Badge>;
  }
}
