import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

/** GET /api/teacher/avatar - 获取教师头像签名 URL */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');
    if (!teacherId) {
      return NextResponse.json({ error: '缺少 teacherId' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('teacher_profile')
      .select('avatar_key, avatar_url')
      .eq('id', teacherId)
      .maybeSingle();

    if (error) throw new Error(`查询头像失败: ${error.message}`);
    if (!data?.avatar_key) {
      return NextResponse.json({ success: true, avatar_url: data?.avatar_url || null });
    }

    // 用 key 生成新的签名 URL
    const avatarUrl = await storage.generatePresignedUrl({
      key: data.avatar_key,
      expireTime: 86400,
    });

    return NextResponse.json({ success: true, avatar_url: avatarUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    console.error('[AVATAR GET] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** POST /api/teacher/avatar - 上传教师头像 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const teacherId = formData.get('teacherId') as string | null;

    if (!file) {
      return NextResponse.json({ error: '请提供图片文件' }, { status: 400 });
    }
    if (!teacherId) {
      return NextResponse.json({ error: '缺少 teacherId' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: '仅支持 JPG/PNG/GIF/WebP 格式' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '图片大小不能超过 5MB' }, { status: 400 });
    }

    // 上传到对象存储
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `avatars/teacher_${teacherId}_${Date.now()}.${ext}`;
    const fileKey = await storage.uploadFile({
      fileContent: buffer,
      fileName,
      contentType: file.type,
    });

    // 生成签名 URL（1天有效期用于即时展示）
    const avatarUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400,
    });

    // 更新数据库：存 key（持久化）+ URL（即时可用）
    const client = getSupabaseClient();

    // 如果之前有旧头像，尝试删除
    const { data: oldTeacher } = await client
      .from('teacher_profile')
      .select('avatar_key')
      .eq('id', teacherId)
      .maybeSingle();

    const { data, error } = await client
      .from('teacher_profile')
      .update({
        avatar_key: fileKey,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teacherId)
      .select('id, name, avatar_url, avatar_key')
      .single();

    if (error) throw new Error(`更新头像失败: ${error.message}`);

    // 异步删除旧头像（不阻塞响应）
    if (oldTeacher?.avatar_key) {
      storage.deleteFile({ fileKey: oldTeacher.avatar_key }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      avatar_url: avatarUrl,
      avatar_key: fileKey,
      teacher: data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    console.error('[AVATAR UPLOAD] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
