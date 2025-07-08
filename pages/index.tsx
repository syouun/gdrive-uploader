import { signIn, signOut } from "next-auth/react";
import { getServerSession } from "next-auth/next";
import type { GetServerSideProps } from "next";
import type { Session } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]";
import { useState, FormEvent } from "react";

type Props = { session: Session | null };

export default function Home({ session }: Props) {
  const [isUploading, setIsUploading] = useState(false);

  /* アップロード処理 */
  const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fileInput = e.currentTarget.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) return alert("ファイルを選択してください");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsUploading(true);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      const { fileId } = (await res.json()) as { fileId: string };
      alert(`アップロード成功！ファイルID: ${fileId}`);
    } catch (err) {
      alert(`アップロード失敗: ${String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  /* 未ログイン画面 */
  if (!session) {
    return (
      <main className="flex flex-col items-center gap-4 py-10">
        <h1 className="text-xl font-bold">Google Drive Uploader</h1>
        <button
          className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:opacity-90"
          onClick={() => signIn("google")}
        >
          Googleでログイン
        </button>
      </main>
    );
  }

  /* ログイン済み画面 */
  return (
    <main className="flex flex-col items-center gap-4 py-10">
      <h1 className="text-xl font-bold">Google Drive Uploader</h1>
      <p>こんにちは、{session.user?.name} さん</p>

      <form onSubmit={handleUpload} className="flex flex-col items-center gap-2">
        <input type="file" name="file" className="border p-2" />
        <button
          type="submit"
          className="rounded bg-green-600 px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          disabled={isUploading}
        >
          {isUploading ? "アップロード中..." : "Google Drive にアップロード"}
        </button>
      </form>

      <button
        className="text-sm text-gray-500 underline underline-offset-2"
        onClick={() => signOut()}
      >
        ログアウト
      </button>
    </main>
  );
}

/* -------- サーバーサイドでセッション注入 -------- */
export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  return { props: { session } };
};