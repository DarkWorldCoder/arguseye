// A model type from generated code (Prisma-style) the project does not define in source.
import type { Post, Author } from "@generated/client";

export function PostRow({ post, author }: { post: Pick<Post, "id" | "title" | "published" | "createdAt">; author: Author }) {
  return <p>{String(post.title)} by {typeof author === "object" ? "an author" : "?"} on {post.createdAt.toDateString()}</p>;
}
