import { storage } from '../config/firebase';

/**
 * Upload a local image URI to Firebase Storage.
 * Path: course-photos/{userId}/{courseId}/{type}/{timestamp}.jpg
 * Returns the public download URL.
 */
export async function uploadCoursePhoto(userId, courseId, type, imageUri) {
  const filename = `${Date.now()}.jpg`;
  const path = `course-photos/${userId}/${courseId}/${type}/${filename}`;
  const ref = storage.ref(path);

  const response = await fetch(imageUri);
  const blob = await response.blob();

  await ref.put(blob, { contentType: 'image/jpeg' });
  return await ref.getDownloadURL();
}

/** Upload a club/equipment photo. quality: 0.7 applied by the caller. */
export async function uploadEquipmentPhoto(userId, clubId, imageUri) {
  const filename = `${Date.now()}.jpg`;
  const path = `equipment-photos/${userId}/${clubId}/${filename}`;
  const ref = storage.ref(path);
  const response = await fetch(imageUri);
  const blob = await response.blob();
  await ref.put(blob, { contentType: 'image/jpeg' });
  return await ref.getDownloadURL();
}

/** Upload a workout card photo. quality: 0.7 applied by the caller. */
export async function uploadWorkoutPhoto(userId, entryId, imageUri) {
  const filename = `${Date.now()}.jpg`;
  const path = `workout-photos/${userId}/${entryId}/${filename}`;
  const ref = storage.ref(path);
  const response = await fetch(imageUri);
  const blob = await response.blob();
  await ref.put(blob, { contentType: 'image/jpeg' });
  return await ref.getDownloadURL();
}

/**
 * Delete a file at a given Storage URL.
 */
export async function deleteCoursePhoto(downloadUrl) {
  try {
    const ref = storage.refFromURL(downloadUrl);
    await ref.delete();
  } catch (_) {
    // Ignore — file may already be gone
  }
}
