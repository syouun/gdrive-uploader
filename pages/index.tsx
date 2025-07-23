import { signIn, signOut, useSession } from "next-auth/react";
import { useState, useEffect, FormEvent } from "react";
import type { Session } from "next-auth";

// ── ★ フロント側セッション拡張型 ───────────
type ExtendedSession = Session & {
  accessToken?: string;
  error?: string;
};

export default function Home() {
  // as でキャストしてエラー回避
  const { data: session } = useSession() as { data: ExtendedSession | null };
  const [isUploading, setIsUploading] = useState(false);

  // トークン更新失敗時は自動リダイレクト
  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") signIn("google");
  }, [session]);

  const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fileInput = e.currentTarget.elements.namedItem(
      "file"
    ) as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) return alert("ファイルを選択してください");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsUploading(true);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(await res.text());
      const { fileId } = (await res.json()) as { fileId: string };
      alert(`登録成功！ファイル ID: ${fileId}`);
    } catch (err) {
      alert(`登録失敗: ${String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (!session)
    return (
      <main className="flex flex-col items-center gap-4 py-10">
        <h1 className="text-xl font-bold">マイドライブへの登録</h1>
        <button
          className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:opacity-90"
          onClick={() => signIn("google")}
        >
          マイドライブにログイン
        </button>
      </main>
    );

  return (
    <main className="flex flex-col items-center gap-4 py-10">
      <h1 className="text-xl font-bold">マイドライブへの登録</h1>
      <p>こんにちは、{session.user?.name} さん</p>

      <form onSubmit={handleUpload} className="flex flex-col items-center gap-2">
        <input type="file" name="file" className="border p-2" />
        <button
          type="submit"
          className="rounded bg-green-600 px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          disabled={isUploading}
        >
          {isUploading ? "登録中..." : "マイドライブに登録"}
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