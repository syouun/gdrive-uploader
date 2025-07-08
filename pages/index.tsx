/* pages/index.tsx */
import { useSession, signIn, signOut } from "next-auth/react";
import { FormEvent, useState } from "react";

export default function Home() {
  // NextAuth のセッション情報と認証状態
  const { data: session, status } = useSession();
  // アップロード処理中フラグ
  const [isUploading, setIsUploading] = useState(false);

  /** Google Drive へファイルをアップロード */
  const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // <input type="file" name="file" /> を取得してファイルを取り出す
    const fileInput = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) {
      alert("ファイルを選択してください");
      return;
    }

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

  /* --------- 画面レンダリング --------- */

  // セッション取得中
  if (status === "loading") return <p>Loading...</p>;

  // 未認証：ログインボタンのみ表示
  if (status === "unauthenticated" || !session) {
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

  // 認証済み：アップロードフォームを表示
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