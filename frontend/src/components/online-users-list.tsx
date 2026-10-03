'use client';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Crown, Shield, Tv } from 'lucide-react';

interface OnlineUser {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
}

interface OnlineUsersListProps {
  users: OnlineUser[];
}

const roleOrder: Record<string, number> = {
  ADMIN: 0,
  STREAMER: 1,
  MODERATOR: 2,
  USER: 3,
};

const roleSections: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ADMIN: { label: 'Admini', icon: <Shield className="w-3 h-3" />, color: 'text-neon-red' },
  STREAMER: { label: 'Streamerzy', icon: <Tv className="w-3 h-3" />, color: 'text-neon-purple' },
  MODERATOR: { label: 'Moderatorzy', icon: <Crown className="w-3 h-3" />, color: 'text-neon-green' },
  USER: { label: 'Członkowie', icon: <Users className="w-3 h-3" />, color: 'text-text-muted' },
};

const roleColors: Record<string, string> = {
  ADMIN: 'text-neon-red',
  MODERATOR: 'text-neon-green',
  STREAMER: 'text-neon-purple',
  USER: 'text-text-secondary',
};

export function OnlineUsersList({ users }: OnlineUsersListProps) {
  // Group users by role
  const grouped = users.reduce<Record<string, OnlineUser[]>>((acc, user) => {
    const role = user.role || 'USER';
    if (!acc[role]) acc[role] = [];
    acc[role].push(user);
    return acc;
  }, {});

  const sortedRoles = Object.keys(grouped).sort(
    (a, b) => (roleOrder[a] ?? 99) - (roleOrder[b] ?? 99)
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-dark-700/50">
        <h2 className="text-2xs font-bold uppercase tracking-[0.15em] text-text-muted flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-neon-green/10 flex items-center justify-center">
            <Users className="w-3 h-3 text-neon-green" />
          </div>
          Online — {users.length}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {sortedRoles.map((role) => {
          const section = roleSections[role] || roleSections.USER;
          const roleUsers = grouped[role];

          return (
            <div key={role}>
              <h3 className={`px-3 mb-2 text-2xs font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 ${section.color}`}>
                {section.icon}
                {section.label} — {roleUsers.length}
              </h3>
              <div className="space-y-0.5">
                {roleUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-dark-700/30 transition-all duration-200 cursor-pointer group"
                  >
                    <Avatar
                      src={u.avatarUrl}
                      name={u.displayName || u.username}
                      size="xs"
                      status="online"
                    />
                    <span className={`text-xs truncate font-medium ${roleColors[u.role] || 'text-text-secondary'} group-hover:text-text-primary transition-colors duration-200`}>
                      {u.displayName || u.username}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {users.length === 0 && (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-dark-800/60 flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-text-dimmed" />
            </div>
            <p className="text-xs text-text-dimmed">Brak użytkowników online</p>
          </div>
        )}
      </div>
    </div>
  );
}
