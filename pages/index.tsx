import { useEffect, useState, FormEvent } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Home() {
  const sessionHook = useSession();
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState<"loading" | "unauthenticated" | "authenticated">("loading");

  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setSession(sessionHook.data);
    setStatus(sessionHook.status);
  }, [sessionHook]);

  const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const target = e.target as HTMLFormElement & { file: HTMLInputElement };
    const file = target.file.files?.[0];
    if (!file) return alert("ファイルを選択してください");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsUploading(true);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      const { fileId } = await res.json();
      alert(`アップロード成功！ファイルID: ${fileId}`);
    } catch (err) {
      alert(`アップロード失敗: ${err}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (status === "loading") return <p>Loading...</p>;
  if (!session)
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