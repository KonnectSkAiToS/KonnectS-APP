import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserAvatar } from '../../components/UserAvatar';
import { haptics } from '../../utils/haptics';
import type { ToastApi } from './useToast';
import { PHOTO_ACCEPT, validatePhotoFile } from './validation';
import { savePhotoURL, uploadProfilePhoto } from './profilePhoto';

interface AvatarUploaderProps {
  toast: ToastApi;
  /** Classes for the avatar itself (size, shape, shadow) */
  avatarClassName?: string;
  /** Radius of the "uploading" overlay; match the avatar's shape */
  overlayClassName?: string;
  badgeClassName?: string;
  /** Classes for the camera button; position and look */
  buttonClassName?: string;
}

/** The profile picture with a clickable camera button that uploads a new one. Falls back to initials. */
export function AvatarUploader({
  toast,
  avatarClassName = 'w-24 h-24 rounded-[40px]',
  overlayClassName = 'rounded-[40px]',
  badgeClassName = 'text-3xl font-black',
  buttonClassName = 'absolute -bottom-1 -right-1 p-2.5 bg-slate-900 text-white rounded-2xl border-4 border-slate-50 shadow-lg active:scale-90 transition-all cursor-pointer',
}: AvatarUploaderProps) {
  const { user, profile, updateProfile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be chosen again later
    if (!file) return;
    if (!user) {
      toast.error('Please sign in to change your profile picture.');
      return;
    }
    const problem = validatePhotoFile(file);
    if (problem) {
      haptics.heavy();
      toast.error(problem);
      return;
    }

    setUploading(true);
    try {
      const url = await uploadProfilePhoto(user.uid, file);
      await savePhotoURL(user.uid, url);
      await updateProfile({ photoURL: url });
      haptics.success();
      toast.success('Profile picture updated!');
    } catch (err: any) {
      console.warn('[AvatarUploader] upload failed:', err);
      const denied = err?.code === 'storage/unauthorized' || err?.code === 'permission-denied';
      toast.error(denied ? "We couldn't save your picture (permission denied). Please try again later." : (err?.message || "We couldn't upload that picture. Please try again."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative inline-block">
      <UserAvatar
        avatarUrl={profile?.photoURL || profile?.avatarUrl}
        firstName={profile?.firstName}
        lastName={profile?.lastName}
        fullName={profile?.fullName || profile?.displayName || profile?.username}
        username={profile?.username}
        className={avatarClassName}
        badgeClassName={badgeClassName}
      />
      {uploading && (
        <div className={`absolute inset-0 flex items-center justify-center bg-slate-900/55 ${overlayClassName}`} role="status" aria-label="Uploading picture">
          <Loader2 size={22} className="animate-spin text-white" />
        </div>
      )}
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} aria-label="Change profile picture" className={buttonClassName}>
        <Camera size={16} />
      </button>
      <input ref={inputRef} type="file" accept={PHOTO_ACCEPT} onChange={handleFile} className="hidden" data-testid="avatar-file-input" />
    </div>
  );
}
