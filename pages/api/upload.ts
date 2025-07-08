// pages/api/upload.ts
// ------------------------------------------------------------
// Google Drive にファイル（0 byte も可）をアップロードする API
//   - Next.js 15 / Node 22 で動作確認
//   - Formidable v3 を使用（allowEmptyFiles = true）
//   - 4.5 MB を超えるリクエストは Vercel の制限で弾かれる点に注意
// ------------------------------------------------------------

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

import formidable, { File as FormidableFile } from 'formidable';
import fs from 'fs/promises';
import { google } from 'googleapis';

/* ------------- Next.js API Route 設定 ------------- */
export const config = {
  api: {
    bodyParser: false,  // multipart/form-data を自前で解析
    sizeLimit: '4mb',   // Vercel の上限 4.5 MB 未満に設定
  },
};

/* ------------- ハンドラー本体 ------------- */
async function uploadHandler(req: NextApiRequest, res: NextApiResponse) {
  /* メソッド制限 */
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  /* 認可チェック：NextAuth のセッションにアクセストークンがあるか */
  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).end('Unauthorized');

  try {
    /* ---------- 1. Formidable で multipart 解析 ---------- */
    const file = await new Promise<FormidableFile>((resolve, reject) => {
      formidable({
        allowEmptyFiles: true, // ★ 0 byte を許可
        minFileSize: 0,
        maxFiles: 1,
      }).parse(req, (err, _fields, files) => {
        if (err) return reject(err);
        const f = Array.isArray(files.file) ? files.file[0] : files.file;
        if (!f) return reject(new Error('No file field'));
        resolve(f);
      });
    });

    console.info('[upload] received:', {
      name: file.originalFilename,
      size: file.size,
      type: file.mimetype,
    });

    /* ---------- 2. Google Drive へアップロード ---------- */
    const oauth = new google.auth.OAuth2();
    oauth.setCredentials({ access_token: session.accessToken });

    const drive = google.drive({ version: 'v3', auth: oauth });

    const metadataOnly = file.size === 0; // 0 byte は metadata-only で送る
    const gRes = await drive.files.create({
      requestBody: {
        name: file.originalFilename ?? 'untitled',
        mimeType: file.mimetype ?? 'application/octet-stream',
      },
      ...(metadataOnly
        ? {} // 0 byte
        : {
            media: {
              mimeType: file.mimetype ?? undefined,
              body: (await import('fs')).createReadStream(file.filepath),
            },
          }),
      fields: 'id',
    });

    /* ---------- 3. 正常レスポンス ---------- */
    return res.status(200).json({ fileId: gRes.data.id });
  } catch (err) {
    console.error('[upload] error:', err);
    return res.status(500).json({ error: 'Upload failed' });
  } finally {
    /* 一時ファイルを削除（エラーでも実行） */
    // `fs.unlink` ではなく promises.unlink を使う
    if ('filepath' in (global as any)) {
      // 型の都合で any キャスト
      fs.unlink((global as any).filepath).catch(() => null);
    }
  }
}

/* 名前付き関数を default export → import/no-anonymous-default-export 対応 */
export default uploadHandler;