import React from 'react';
import { getProfileInitials } from '../utils/avatarUtils';

interface UserAvatarProps {
  avatarUrl?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  username?: string;
  className?: string;
  badgeClassName?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  firstName,
  lastName,
  fullName,
  username,
  className = "w-12 h-12 rounded-2xl",
  badgeClassName = "text-sm font-black"
}) => {
  const initials = getProfileInitials(firstName, lastName, fullName, username);

  if (avatarUrl && avatarUrl.trim() !== '' && !avatarUrl.startsWith('initials:')) {
    return (
      <img
        src={avatarUrl}
        alt={fullName || username || 'User Avatar'}
        className={`${className} object-cover shadow-xs border border-slate-200/60 dark:border-slate-800`}
      />
    );
  }

  return (
    <div
      className={`${className} bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white flex items-center justify-center shadow-md select-none tracking-wider uppercase border border-indigo-400/30 shrink-0`}
    >
      <span className={badgeClassName}>{initials}</span>
    </div>
  );
};
