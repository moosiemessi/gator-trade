"use server";

import crypto from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPostImagesBucketName, s3Client } from "@/lib/aws/s3";
import {
  EXTENSION_BY_CONTENT_TYPE,
  MAX_IMAGES_PER_POST,
  confirmPostImageSchema,
  createPostImageUploadSchema,
  deletePostImageSchema,
  type ConfirmPostImageInput,
  type CreatePostImageUploadInput,
  type DeletePostImageInput,
} from "@/lib/validation/post-images";

const PRESIGN_EXPIRY_SECONDS = 60;

export type ActionState = { error: string | null };

export type CreateUploadState =
  | { error: string; uploadUrl: null; s3Key: null }
  | { error: null; uploadUrl: string; s3Key: string };

// Ownership check happens through the RLS-backed client, never the
// service role key (SPEC.md section 8) — a non-owner's query simply
// returns no row, matching what the owns_post() policy helper would say.
async function requireOwnedPost(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
): Promise<{ userId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in" };
  }

  const { data: post, error } = await supabase
    .from("posts")
    .select("id")
    .eq("id", postId)
    .eq("author_id", user.id)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!post) {
    return { error: "You don't own this post" };
  }

  return { userId: user.id };
}

export async function createPostImageUpload(
  input: CreatePostImageUploadInput,
): Promise<CreateUploadState> {
  const parsed = createPostImageUploadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      uploadUrl: null,
      s3Key: null,
    };
  }
  const { postId, contentType } = parsed.data;

  const supabase = await createClient();
  const owned = await requireOwnedPost(supabase, postId);
  if ("error" in owned) {
    return { error: owned.error, uploadUrl: null, s3Key: null };
  }

  const { count, error: countError } = await supabase
    .from("post_images")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);
  if (countError) {
    return { error: countError.message, uploadUrl: null, s3Key: null };
  }
  if ((count ?? 0) >= MAX_IMAGES_PER_POST) {
    return {
      error: `A post can have at most ${MAX_IMAGES_PER_POST} images`,
      uploadUrl: null,
      s3Key: null,
    };
  }

  const extension = EXTENSION_BY_CONTENT_TYPE[contentType];
  const s3Key = `posts/${postId}/${crypto.randomUUID()}.${extension}`;

  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: getPostImagesBucketName(),
      Key: s3Key,
      ContentType: contentType,
    }),
    { expiresIn: PRESIGN_EXPIRY_SECONDS },
  );

  return { error: null, uploadUrl, s3Key };
}

// The s3Key format is fixed by createPostImageUpload; re-deriving the
// expected pattern here stops a caller from recording a row that points
// at an object outside this post's own prefix.
function isKeyForPost(s3Key: string, postId: string): boolean {
  const validExtensions = Object.values(EXTENSION_BY_CONTENT_TYPE).join("|");
  const pattern = new RegExp(
    `^posts/${postId}/[0-9a-f-]{36}\\.(${validExtensions})$`,
  );
  return pattern.test(s3Key);
}

export type ConfirmUploadState =
  | { error: string; imageId: null }
  | { error: null; imageId: string };

export async function confirmPostImageUpload(
  input: ConfirmPostImageInput,
): Promise<ConfirmUploadState> {
  const parsed = confirmPostImageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      imageId: null,
    };
  }
  const { postId, s3Key } = parsed.data;

  if (!isKeyForPost(s3Key, postId)) {
    return { error: "Invalid image key", imageId: null };
  }

  const supabase = await createClient();
  const owned = await requireOwnedPost(supabase, postId);
  if ("error" in owned) {
    return { error: owned.error, imageId: null };
  }

  const { count, error: countError } = await supabase
    .from("post_images")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);
  if (countError) {
    return { error: countError.message, imageId: null };
  }
  if ((count ?? 0) >= MAX_IMAGES_PER_POST) {
    return {
      error: `A post can have at most ${MAX_IMAGES_PER_POST} images`,
      imageId: null,
    };
  }

  const { data: image, error } = await supabase
    .from("post_images")
    .insert({ post_id: postId, s3_key: s3Key })
    .select("id")
    .single();
  if (error) {
    return { error: error.message, imageId: null };
  }

  revalidatePath(`/posts/${postId}`);
  return { error: null, imageId: image.id };
}

export async function deletePostImage(
  input: DeletePostImageInput,
): Promise<ActionState> {
  const parsed = deletePostImageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { imageId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in" };
  }

  // post_images is visible to anyone who can see the parent post, not
  // just its owner, so ownership has to be checked against posts.author_id
  // explicitly rather than assuming a successful select means it's mine.
  const { data: image, error: fetchError } = await supabase
    .from("post_images")
    .select("id, post_id, s3_key, posts!inner(author_id)")
    .eq("id", imageId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }
  if (!image || image.posts.author_id !== user.id) {
    return { error: "You don't own this image" };
  }

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: getPostImagesBucketName(),
      Key: image.s3_key,
    }),
  );

  const { error: deleteError } = await supabase
    .from("post_images")
    .delete()
    .eq("id", imageId);
  if (deleteError) {
    return { error: deleteError.message };
  }

  revalidatePath(`/posts/${image.post_id}`);
  return { error: null };
}
