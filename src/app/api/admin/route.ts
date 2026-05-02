import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/** 管理员登录验证 */
async function verifyAdmin(username: string, password: string): Promise<boolean> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('admin_account')
    .select('id')
    .eq('username', username)
    .eq('password', password)
    .maybeSingle();
  return !error && !!data;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const client = getSupabaseClient();

    if (action === 'teachers') {
      // 获取所有教师列表（含启用状态）
      const { data, error } = await client
        .from('teacher_profile')
        .select('id, name, display_name, username, title, subjects, is_enabled, is_setup_complete, created_at')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, teachers: data });
    }

    if (action === 'students') {
      // 获取所有学生列表
      const { data, error } = await client
        .from('student_profile')
        .select('student_id, name, grade, teacher_id, is_enabled, created_at')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      // 附加教师名称
      const studentsWithTeacher = await Promise.all((data || []).map(async (s: Record<string, unknown>) => {
        if (s.teacher_id) {
          const { data: t } = await client
            .from('teacher_profile')
            .select('name, display_name')
            .eq('id', s.teacher_id as string)
            .maybeSingle();
          return { ...s, teacher_name: (t as Record<string, unknown>)?.display_name || (t as Record<string, unknown>)?.name || null };
        }
        return { ...s, teacher_name: null };
      }));

      return NextResponse.json({ success: true, students: studentsWithTeacher });
    }

    if (action === 'student_detail') {
      // 获取学生记忆详情
      const studentId = searchParams.get('studentId');
      const teacherId = searchParams.get('teacherId');
      if (!studentId || !teacherId) {
        return NextResponse.json({ error: '缺少参数' }, { status: 400 });
      }
      const tid = teacherId;

      const [masteryResult, conversationResult, strategyResult] = await Promise.all([
        client.from('knowledge_mastery').select('*').eq('student_id', studentId).eq('teacher_id', tid).order('updated_at', { ascending: false }),
        client.from('conversation_log').select('*').eq('student_id', studentId).eq('teacher_id', tid).order('created_at', { ascending: false }).limit(20),
        client.from('teaching_strategy').select('*').eq('student_id', studentId).eq('teacher_id', tid).order('updated_at', { ascending: false }),
      ]);

      return NextResponse.json({
        success: true,
        detail: {
          knowledge_mastery: masteryResult.data || [],
          conversations: conversationResult.data || [],
          strategies: strategyResult.data || [],
        },
      });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, username, password, ...params } = body;

    const client = getSupabaseClient();

    // 管理员登录
    if (action === 'login') {
      if (!username || !password) {
        return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
      }
      const valid = await verifyAdmin(username, password);
      if (!valid) {
        return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
      }
      return NextResponse.json({ success: true, message: '登录成功' });
    }

    // 以下操作需要管理员验证
    const adminUsername = body.adminUsername;
    const adminPassword = body.adminPassword;
    if (!adminUsername || !adminPassword) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
    }
    const isAdmin = await verifyAdmin(adminUsername, adminPassword);
    if (!isAdmin) {
      return NextResponse.json({ error: '管理员验证失败' }, { status: 403 });
    }

    // 创建教师账号
    if (action === 'create_teacher') {
      const { name, teacherUsername, teacherPassword, title, subjects } = params;
      if (!name) {
        return NextResponse.json({ error: '请输入教师姓名' }, { status: 400 });
      }
      const id = `teacher_${Date.now()}`;
      const knowledgeTable = `kb_${id}`;

      const { data, error } = await client
        .from('teacher_profile')
        .insert({
          id,
          name,
          username: teacherUsername || null,
          password: teacherPassword || '123456',
          display_name: name,
          title: title || '智能助教',
          subjects: subjects || '',
          is_enabled: true,
          is_setup_complete: false,
          knowledge_table: knowledgeTable,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, teacher: data });
    }

    // 更新教师状态
    if (action === 'update_teacher') {
      const { teacherId, is_enabled, username, password, display_name } = params;
      if (!teacherId) {
        return NextResponse.json({ error: '缺少教师ID' }, { status: 400 });
      }

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof is_enabled === 'boolean') updateData.is_enabled = is_enabled;
      if (username) updateData.username = username;
      if (password) updateData.password = password;
      if (display_name) updateData.display_name = display_name;

      const { error } = await client
        .from('teacher_profile')
        .update(updateData)
        .eq('id', teacherId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    // 删除教师
    if (action === 'delete_teacher') {
      const { teacherId } = params;
      if (!teacherId) {
        return NextResponse.json({ error: '缺少教师ID' }, { status: 400 });
      }

      // 同时删除相关的学生数据
      await client.from('student_profile').delete().eq('teacher_id', teacherId);
      await client.from('knowledge_mastery').delete().eq('teacher_id', teacherId);
      await client.from('conversation_log').delete().eq('teacher_id', teacherId);
      await client.from('teaching_strategy').delete().eq('teacher_id', teacherId);

      const { error } = await client
        .from('teacher_profile')
        .delete()
        .eq('id', teacherId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    // 更新学生状态
    if (action === 'update_student') {
      const { studentId, teacherId, is_enabled } = params;
      if (!studentId || !teacherId) {
        return NextResponse.json({ error: '缺少学生ID或教师ID' }, { status: 400 });
      }

      const { error } = await client
        .from('student_profile')
        .update({ is_enabled, updated_at: new Date().toISOString() })
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    // 删除学生
    if (action === 'delete_student') {
      const { studentId, teacherId } = params;
      if (!studentId || !teacherId) {
        return NextResponse.json({ error: '缺少学生ID或教师ID' }, { status: 400 });
      }

      await client.from('knowledge_mastery').delete().eq('student_id', studentId).eq('teacher_id', teacherId);
      await client.from('conversation_log').delete().eq('student_id', studentId).eq('teacher_id', teacherId);
      await client.from('teaching_strategy').delete().eq('student_id', studentId).eq('teacher_id', teacherId);

      const { error } = await client
        .from('student_profile')
        .delete()
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    // 修改管理员密码
    if (action === 'change_password') {
      const { newPassword } = params;
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: '密码长度至少6位' }, { status: 400 });
      }

      const { error } = await client
        .from('admin_account')
        .update({ password: newPassword, updated_at: new Date().toISOString() })
        .eq('username', adminUsername);

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, message: '密码修改成功' });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    console.error('[ADMIN API] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
