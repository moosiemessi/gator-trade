import { z } from "zod";
import { uuid } from "./ticket-item";

// Allowlisted upload content types (SPEC.md section 9). Anything else is
// rejected before a presigned URL is ever generated.
export const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const imageContentTypeSchema = z.enum(ALLOWED_IMAGE_CONTENT_TYPES);

export type ImageContentType = z.infer<typeof imageContentTypeSchema>;

export const EXTENSION_BY_CONTENT_TYPE: Record<ImageContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_IMAGES_PER_POST = 6;

export const createPostImageUploadSchema = z.object({
  postId: uuid,
  contentType: imageContentTypeSchema,
});

export type CreatePostImageUploadInput = z.infer<
  typeof createPostImageUploadSchema
>;

export const confirmPostImageSchema = z.object({
  postId: uuid,
  s3Key: z.string().trim().min(1).max(512),
});

export type ConfirmPostImageInput = z.infer<typeof confirmPostImageSchema>;

export const deletePostImageSchema = z.object({
  imageId: uuid,
});

export type DeletePostImageInput = z.infer<typeof deletePostImageSchema>;
