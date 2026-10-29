import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { auth } from '../../../lib/firebase'; // also initialises the default app

const MAX_EDGE = 1600;
const MAX_BYTES = 10 * 1024 * 1024;

/** Downscale to MAX_EDGE and re-encode as JPEG so listing photos stay well under the 5 MB storage rule. */
async function shrink(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((ok, no) => canvas.toBlob(b => (b ? ok(b) : no(new Error('Could not encode image'))), 'image/jpeg', 0.85));
}

/** Uploads a File/Blob or a data: URL to listings/{uid}/ and returns its download URL. */
export async function uploadListingImage(source: Blob | string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in to upload photos');
  const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source;
  if (!blob.type.startsWith('image/')) throw new Error('Only image files can be uploaded');
  if (blob.size > MAX_BYTES) throw new Error('Image is larger than 10 MB');
  const jpeg = await shrink(blob);
  const fileRef = ref(getStorage(), `listings/${uid}/${crypto.randomUUID()}.jpg`);
  await uploadBytes(fileRef, jpeg, { contentType: 'image/jpeg' });
  return getDownloadURL(fileRef);
}
