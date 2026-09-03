import Image from "next/image";

export function PostThumbnail({ url }: { url: string | null }) {
  if (!url) return null;

  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-gray-200">
      <Image src={url} alt="" fill sizes="64px" className="object-cover" />
    </div>
  );
}
