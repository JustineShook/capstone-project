import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { OnsiteMechanicProviderProfile } from "../types/onsiteMechanicProfile";
import { db } from "./firebase";

// Firestore collections need a document ID. The fixed profile document keeps
// this data user-owned at users/{uid}/providerProfile/profile.
const providerProfileRef = (uid: string) =>
  doc(db, "users", uid, "providerProfile", "profile");

export async function getProviderProfile(
  uid: string
): Promise<OnsiteMechanicProviderProfile | null> {
  const snapshot = await getDoc(providerProfileRef(uid));
  return snapshot.exists() ? (snapshot.data() as OnsiteMechanicProviderProfile) : null;
}

export async function saveProviderProfile(
  uid: string,
  profile: OnsiteMechanicProviderProfile
): Promise<void> {
  await setDoc(providerProfileRef(uid), {
    ...profile,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export interface UploadableFile {
  uri: string;
  mimeType?: string | null;
  name?: string | null;
  size?: number | null;
}

type VerificationUploadKind = "valid-id" | "profile-photo" | "certificate";

const contentTypeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
};

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

type UploadError = Error & { code: string };

function createUploadError(code: string, message: string): UploadError {
  return Object.assign(new Error(message), { code });
}

function inferContentType(file: UploadableFile): string | null {
  const suppliedType = file.mimeType?.toLowerCase();
  if (suppliedType && Object.values(contentTypeByExtension).includes(suppliedType)) {
    return suppliedType;
  }

  const filename = file.name ?? file.uri;
  const extension = filename.split("?")[0].split(".").pop()?.toLowerCase();
  return extension ? contentTypeByExtension[extension] ?? null : null;
}

function isAllowedContentType(kind: VerificationUploadKind, contentType: string): boolean {
  return kind === "certificate"
    ? contentType === "application/pdf" || contentType === "image/jpeg" || contentType === "image/png"
    : contentType === "image/jpeg" || contentType === "image/png";
}

function uploadLimitFor(kind: VerificationUploadKind): number {
  return kind === "certificate" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
}

/** Uploads a selected verification file to Cloudinary and returns its secure URL. */
export async function uploadVerificationFile(
  _uid: string,
  kind: VerificationUploadKind,
  file: UploadableFile
): Promise<string> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw createUploadError(
      "cloudinary/config-missing",
      "Cloudinary cloud name or upload preset is not configured."
    );
  }

  const contentType = inferContentType(file);
  if (!contentType) {
    throw createUploadError(
      "cloudinary/unsupported-file-type",
      "Only JPG, JPEG, PNG, and PDF files are supported."
    );
  }

  if (!isAllowedContentType(kind, contentType)) {
    throw createUploadError(
      "cloudinary/unsupported-file-type",
      kind === "certificate"
        ? "Certificates must be a JPG, JPEG, PNG, or PDF."
        : "Profile photos and valid IDs must be a JPG, JPEG, or PNG."
    );
  }

  if (file.size != null && file.size > uploadLimitFor(kind)) {
    throw createUploadError(
      "cloudinary/file-too-large",
      kind === "certificate"
        ? "Certificates must be 10 MB or smaller."
        : "Profile photos and valid IDs must be 5 MB or smaller."
    );
  }

  const filename = file.name?.trim() || `verification-${kind}.${contentType.split("/")[1]}`;
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/auto/upload`;

  try {
    const formData = new FormData();
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("file", {
      uri: file.uri,
      type: contentType,
      name: filename,
    } as unknown as Blob);

    const response = await fetch(endpoint, { method: "POST", body: formData });
    const responseText = await response.text();
    const payload = responseText ? (JSON.parse(responseText) as { secure_url?: unknown; error?: { message?: unknown } }) : {};

    if (!response.ok) {
      const message = typeof payload.error?.message === "string"
        ? payload.error.message
        : `Cloudinary returned HTTP ${response.status}.`;
      throw createUploadError("cloudinary/upload-failed", message);
    }

    if (typeof payload.secure_url !== "string" || !payload.secure_url) {
      throw createUploadError("cloudinary/invalid-response", "Cloudinary did not return a secure URL.");
    }

    return payload.secure_url;
  } catch (error: unknown) {
    const uploadError = error as { code?: string; message?: string };
    console.error("Verification Cloudinary upload failed", {
      code: uploadError.code ?? "cloudinary/unknown",
      message: uploadError.message ?? String(error),
      kind,
      endpoint,
    });
    throw error;
  }
}
