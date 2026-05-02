import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const maxDuration = 30;

/**
 * 学生画像管理 API（按 teacher_id 隔离）
 * GET  /api/memory/profile?student_id=xxx&teacher_id=xxx          — 获取画像
 * GET  /api/memory/profile?name=xxx&teacher_id=xxx&action=resolve — 按姓名查找学生（返回 student_id）
 * POST /api/memory/profile                                         — 创建/更新画像
 * DELETE /api/memory/profile?student_id=xxx&teacher_id=xxx        — 删除画像
 */
export async function GET(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get('action');
    const teacher_id = request.nextUrl.searchParams.get('teacher_id') || 'teacher_default';

    // 按姓名查找学生：返回该教师在数据库中匹配该姓名的学生 student_id
    if (action === 'resolve') {
      const name = request.nextUrl.searchParams.get('name');
      if (!name) {
        return NextResponse.json({ error: '请提供 name' }, { status: 400 });
      }
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('student_profile')
        .select('student_id, name')
        .eq('name', name.trim())
        .eq('teacher_id', teacher_id)
        .maybeSingle();

      if (error) throw new Error(`查询失败: ${error.message}`);

      if (data) {
        return NextResponse.json({ success: true, student_id: data.student_id, name: data.name });
      }
      // 未找到已有记录，返回 null，前端可自行生成
      return NextResponse.json({ success: true, student_id: null });
    }

    // 正常获取画像
    const student_id = request.nextUrl.searchParams.get('student_id');
    if (!student_id) {
      return NextResponse.json({ error: '请提供 student_id' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('student_profile')
      .select('*')
      .eq('student_id', student_id)
      .eq('teacher_id', teacher_id)
      .maybeSingle();

    if (error) throw new Error(`查询失败: ${error.message}`);

    return NextResponse.json({ success: true, profile: data });
  } catch (error) {
    console.error('[MEMORY PROFILE] 查询失败:', error);
    return NextResponse.json(
      { error: `画像查询失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { student_id, teacher_id, ...profileData } = await request.json();

    if (!student_id) {
      return NextResponse.json({ error: '请提供 student_id' }, { status: 400 });
    }

    const tid = teacher_id || 'teacher_default';
    const client = getSupabaseClient();

    // 检查是否已有画像
    const { data: existing, error: findError } = await client
      .from('student_profile')
      .select('id')
      .eq('student_id', student_id)
      .eq('teacher_id', tid)
      .maybeSingle();

    if (findError) throw new Error(`查询失败: ${findError.message}`);

    if (existing) {
      // 更新
      const { error: updateError } = await client
        .from('student_profile')
        .update({
          ...profileData,
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', student_id)
        .eq('teacher_id', tid);

      if (updateError) throw new Error(`更新失败: ${updateError.message}`);
    } else {
      // 创建
      const { error: createError } = await client
        .from('student_profile')
        .insert({
          student_id,
          teacher_id: tid,
          ...profileData,
        });

      if (createError) throw new Error(`创建失败: ${createError.message}`);
    }

    return NextResponse.json({ success: true, action: existing ? 'updated' : 'created' });
  } catch (error) {
    console.error('[MEMORY PROFILE] 操作失败:', error);
    return NextResponse.json(
      { error: `画像操作失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const student_id = request.nextUrl.searchParams.get('student_id');
    const teacher_id = request.nextUrl.searchParams.get('teacher_id') || 'teacher_default';
    if (!student_id) {
      return NextResponse.json({ error: '请提供 student_id' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { error } = await client
      .from('student_profile')
      .delete()
      .eq('student_id', student_id)
      .eq('teacher_id', teacher_id);

    if (error) throw new Error(`删除失败: ${error.message}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[MEMORY PROFILE] 删除失败:', error);
    return NextResponse.json(
      { error: `画像删除失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
