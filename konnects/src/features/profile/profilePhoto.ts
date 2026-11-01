import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { updateProfile as updateAuthProfile } from 'firebase/auth';
import { auth, db, storage } from '../../lib/firebase';
import { photoContentType, validatePhotoFile } from './validation';

/** Upload to Firebase Storage at profile_pictures/{userId} and return a cache-busted download URL. */
export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  const problem = validatePhotoFile(file);
  if (problem) throw new Error(problem);

  const fileRef = ref(storage, `profile_pictures/${uid}`);
  await uploadBytes(fileRef, file, { contentType: photoContentType(file) ?? undefined, cacheControl: 'public,max-age=3600' });
  const url = await getDownloadURL(fileRef);
  // The path is reused for every upload, so add a version to stop browsers showing the old picture
  return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
}

/** Save the picture URL on the Firestore profile and on the Auth user. */
export async function savePhotoURL(uid: string, photoURL: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { photoURL, updatedAt: serverTimestamp() }, { merge: true });
  if (auth.currentUser) {
    try {
      await updateAuthProfile(auth.currentUser, { photoURL });
    } catch (err) {
      console.warn('[profilePhoto] Auth photoURL not updated (profile document is):', err);
    }
  }
}

