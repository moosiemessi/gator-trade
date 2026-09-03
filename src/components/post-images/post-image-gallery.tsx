import Image from "next/image";

export function PostImageGallery({
  images,
}: {
  images: { id: string; url: string }[];
}) {
  if (images.length === 0) return null;

  return (
    <ul className="grid grid-cols-3 gap-3">
      {images.map((image) => (
        <li
          key={image.id}
          className="relative aspect-square overflow-hidden rounded-md border border-gray-200"
        >
          <Image
            src={image.url}
            alt=""
            fill
            sizes="(max-width: 640px) 33vw, 200px"
            className="object-cover"
          />
        </li>
      ))}
    </ul>
  );
}
