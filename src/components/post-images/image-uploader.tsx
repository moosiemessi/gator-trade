"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmPostImageUpload,
  createPostImageUpload,
  deletePostImage,
} from "@/app/posts/[id]/image-actions";
import {
  ALLOWED_IMAGE_CONTENT_TYPES,
  MAX_IMAGES_PER_POST,
  type ImageContentType,
} from "@/lib/validation/post-images";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type UploadStatus = "uploading" | "confirming" | "done" | "error";

type UploadItem = {
  key: string;
  fileName: string;
  previewUrl: string;
  progress: number;
  status: UploadStatus;
  error: string | null;
  // Set once the server confirms the row. This page (posts/new in
  // particular) has no server refetch tying `existingImages` back to this
  // component, so a "done" upload has to keep rendering itself from local
  // state rather than waiting for a prop update that may never come.
  imageId: string | null;
};

type ExistingImage = { id: string; url: string };

function isAllowedContentType(type: string): type is ImageContentType {
  return (ALLOWED_IMAGE_CONTENT_TYPES as readonly string[]).includes(type);
}

// XHR rather than fetch — fetch gives no upload progress events, and the
// spec asks for a per-file progress bar (SPEC.md step 10).
function putToS3(
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

export function ImageUploader({
  postId,
  existingImages,
}: {
  postId: string;
  existingImages: ExistingImage[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const existingIds = new Set(existingImages.map((image) => image.id));
  // Once a server refetch (on the post detail page) brings a newly
  // confirmed image back through `existingImages`, drop it from here so it
  // isn't rendered twice.
  const confirmedLocalUploads = uploads.filter(
    (u) => u.status === "done" && u.imageId !== null && !existingIds.has(u.imageId),
  );
  const inFlightUploads = uploads.filter((u) => u.status !== "done");
  const activeUploadCount = inFlightUploads.filter(
    (u) => u.status === "uploading" || u.status === "confirming",
  ).length;
  const remainingSlots =
    MAX_IMAGES_PER_POST -
    existingImages.length -
    confirmedLocalUploads.length -
    activeUploadCount;

  function updateUpload(key: string, patch: Partial<UploadItem>) {
    setUploads((items) =>
      items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  async function uploadOne(file: File) {
    const key = `${file.name}-${crypto.randomUUID()}`;
    const previewUrl = URL.createObjectURL(file);
    setUploads((items) => [
      ...items,
      {
        key,
        fileName: file.name,
        previewUrl,
        progress: 0,
        status: "uploading",
        error: null,
        imageId: null,
      },
    ]);

    if (file.size > MAX_FILE_BYTES) {
      updateUpload(key, { status: "error", error: "File exceeds 5MB" });
      return;
    }
    if (!isAllowedContentType(file.type)) {
      updateUpload(key, {
        status: "error",
        error: "Only JPEG, PNG, or WebP images are allowed",
      });
      return;
    }

    const created = await createPostImageUpload({
      postId,
      contentType: file.type,
    });
    if (created.error !== null) {
      updateUpload(key, { status: "error", error: created.error });
      return;
    }

    try {
      await putToS3(created.uploadUrl, file, (percent) =>
        updateUpload(key, { progress: percent }),
      );
    } catch {
      updateUpload(key, { status: "error", error: "Upload to storage failed" });
      return;
    }

    updateUpload(key, { status: "confirming", progress: 100 });
    const confirmed = await confirmPostImageUpload({
      postId,
      s3Key: created.s3Key,
    });
    if (confirmed.error !== null) {
      updateUpload(key, { status: "error", error: confirmed.error });
      return;
    }

    updateUpload(key, { status: "done", imageId: confirmed.imageId });
    router.refresh();
  }

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, Math.max(remainingSlots, 0));
    for (const file of files) {
      void uploadOne(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleDelete(imageId: string) {
    setDeleteError(null);
    setDeletingId(imageId);
    const result = await deletePostImage({ imageId });
    setDeletingId(null);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    setUploads((items) => items.filter((item) => item.imageId !== imageId));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {existingImages.length > 0 || confirmedLocalUploads.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3">
          {existingImages.map((image) => (
            <li key={image.id} className="relative">
              <div className="relative aspect-square overflow-hidden rounded-md border border-gray-200">
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 33vw, 200px"
                  className="object-cover"
                />
              </div>
              <button
                type="button"
                disabled={deletingId === image.id}
                onClick={() => handleDelete(image.id)}
                className="mt-1 text-xs font-medium text-red-600 underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId === image.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
          {confirmedLocalUploads.map((upload) => (
            <li key={upload.key} className="relative">
              <div className="relative aspect-square overflow-hidden rounded-md border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, next/image can't optimize it */}
                <img
                  src={upload.previewUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <button
                type="button"
                disabled={deletingId === upload.imageId}
                onClick={() => upload.imageId && handleDelete(upload.imageId)}
                className="mt-1 text-xs font-medium text-red-600 underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId === upload.imageId ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {deleteError ? (
        <p className="text-sm text-red-600" role="alert">
          {deleteError}
        </p>
      ) : null}

      {inFlightUploads.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3">
          {inFlightUploads.map((upload) => (
            <li key={upload.key} className="relative">
              <div className="relative aspect-square overflow-hidden rounded-md border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, next/image can't optimize it */}
                <img
                  src={upload.previewUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {upload.status === "uploading" ||
                upload.status === "confirming" ? (
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-xs text-white">
                    {upload.status === "confirming"
                      ? "Saving…"
                      : `${upload.progress}%`}
                  </div>
                ) : null}
              </div>
              {upload.status === "error" ? (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {upload.error}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {remainingSlots > 0 ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_IMAGE_CONTENT_TYPES.join(",")}
            multiple
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-orange-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-orange-700"
          />
          <p className="mt-1 text-xs text-gray-500">
            Up to {remainingSlots} more image
            {remainingSlots === 1 ? "" : "s"}, 5MB max each.
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          This post has the maximum of {MAX_IMAGES_PER_POST} images.
        </p>
      )}
    </div>
  );
}
