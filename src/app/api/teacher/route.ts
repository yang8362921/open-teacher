import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { cached, CacheKeys, appCache } from '@/lib/cache';

/** GET /api/teacher - 获取教师列表（学生选择教师用）或单个教师信息 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');

    const client = getSupabaseClient();

    if (teacherId) {
      // 获取单个教师信息（缓存10分钟，教师资料变化不频繁）
      const data = await cached(
        CacheKeys.teacher(teacherId),
        10 * 60 * 1000,
        async () => {
          const { data, error } = await client
            .from('teacher_profile')
            .select('id, name, title, subjects, expertise, teaching_style, guiding_questions, voice_speaker, voice_speed, voice_volume, avatar_url, avatar_key, knowledge_table, is_setup_complete, metadata, created_at, updated_at')
            .eq('id', teacherId)
            .maybeSingle();
          if (error) throw new Error(`教师查询失败: ${error.message}`);
          return data;
        }
      );

      if (!data) return NextResponse.json({ success: false, error: '教师不存在' }, { status: 404 });

      return NextResponse.json({ success: true, teacher: data });
    }

    // 获取所有教师列表（学生选择用，只返回基本信息+简介，只显示已启用且设置完成的）
    const { data, error } = await client
      .from('teacher_profile')
      .select('id, name, display_name, title, subjects, expertise, teaching_style, avatar_url, is_setup_complete')
      .eq('is_setup_complete', true)
      .eq('is_enabled', true)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`教师列表查询失败: ${error.message}`);

    return NextResponse.json({ success: true, teachers: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    console.error('[TEACHER API] GET error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** POST /api/teacher - 创建或更新教师信息 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, teacherId, ...fields } = body;

    const client = getSupabaseClient();

    if (action === 'login') {
      // 教师登录验证（只允许已创建且启用的教师登录）
      const { name, password } = body;
      if (!name) return NextResponse.json({ success: false, error: '请输入姓名' }, { status: 400 });

      const { data, error } = await client
        .from('teacher_profile')
        .select('id, name, title, subjects, expertise, teaching_style, guiding_questions, voice_speaker, voice_speed, voice_volume, avatar_url, avatar_key, knowledge_table, is_setup_complete, is_enabled, password, username, display_name, metadata')
        .or(`name.ilike.${name},username.ilike.${name}`)
        .maybeSingle();

      if (error) throw new Error(`登录查询失败: ${error.message}`);

      if (!data) {
        // 教师不存在，提示联系管理员
        return NextResponse.json({ 
          success: false, 
          error: '账号不存在，请联系管理员创建账号' 
        }, { status: 401 });
      }

      // 检查是否被禁用
      if (data.is_enabled === false) {
        return NextResponse.json({ 
          success: false, 
          error: '账号已被禁用，请联系管理员' 
        }, { status: 403 });
      }

      // 验证密码
      const expectedPassword = data.password || '123456';
      if (password !== expectedPassword) {
        return NextResponse.json({ 
          success: false, 
          error: '密码错误' 
        }, { status: 401 });
      }

      // 返回教师信息（不含密码）
      const { password: _, ...teacherData } = data;
      return NextResponse.json({ success: true, teacher: teacherData, isNew: false });
    }

    if (action === 'update') {
      // 更新教师信息
      if (!teacherId) return NextResponse.json({ success: false, error: '缺少teacherId' }, { status: 400 });

      const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const allowedFields = ['name', 'title', 'subjects', 'expertise', 'teaching_style', 'guiding_questions', 'voice_speaker', 'voice_speed', 'voice_volume', 'avatar_url', 'avatar_key', 'knowledge_table', 'password', 'is_setup_complete', 'metadata'];
      for (const field of allowedFields) {
        if (fields[field] !== undefined) {
          updateFields[field] = fields[field];
        }
      }

      const { data, error } = await client
        .from('teacher_profile')
        .update(updateFields)
        .eq('id', teacherId)
        .select('id, name, title, subjects, expertise, teaching_style, guiding_questions, voice_speaker, voice_speed, voice_volume, avatar_url, avatar_key, knowledge_table, is_setup_complete')
        .single();

      if (error) throw new Error(`教师更新失败: ${error.message}`);

      // 失效教师缓存
      appCache.delete(CacheKeys.teacher(teacherId));

      return NextResponse.json({ success: true, teacher: data });
    }

    if (action === 'students') {
      // 获取该教师下的所有学生及其学习记忆概要
      if (!teacherId) return NextResponse.json({ success: false, error: '缺少teacherId' }, { status: 400 });

      // 查询学生画像
      const { data: students, error: studentsError } = await client
        .from('student_profile')
        .select('student_id, name, grade, main_subjects, learning_style, created_at, updated_at')
        .eq('teacher_id', teacherId)
        .order('updated_at', { ascending: false });

      if (studentsError) throw new Error(`学生列表查询失败: ${studentsError.message}`);

      // 查询每个学生的知识掌握概要
      const studentSummaries = [];
      for (const s of (students || [])) {
        const { data: mastery } = await client
          .from('knowledge_mastery')
          .select('topic, subtopic, mastery_level, weak_points, strong_points')
          .eq('student_id', s.student_id)
          .eq('teacher_id', teacherId)
          .order('mastery_level', { ascending: true });

        const { count: convCount } = await client
          .from('conversation_log')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', s.student_id)
          .eq('teacher_id', teacherId);

        const mastered = (mastery || []).filter((m: { mastery_level: number }) => m.mastery_level >= 0.6);
        const learning = (mastery || []).filter((m: { mastery_level: number }) => m.mastery_level >= 0.3 && m.mastery_level < 0.6);
        const weak = (mastery || []).filter((m: { mastery_level: number }) => m.mastery_level > 0 && m.mastery_level < 0.3);

        studentSummaries.push({
          ...s,
          total_conversations: convCount || 0,
          knowledge_summary: {
            mastered: mastered.length,
            learning: learning.length,
            weak: weak.length,
            details: {
              mastered: mastered.map((m: { topic: string; subtopic: string | null; strong_points: string | null }) => ({
                topic: m.topic, subtopic: m.subtopic, strong_points: m.strong_points,
              })),
              learning: learning.map((m: { topic: string; subtopic: string | null; weak_points: string | null }) => ({
                topic: m.topic, subtopic: m.subtopic, weak_points: m.weak_points,
              })),
              weak: weak.map((m: { topic: string; subtopic: string | null; weak_points: string | null }) => ({
                topic: m.topic, subtopic: m.subtopic, weak_points: m.weak_points,
              })),
            },
          },
        });
      }

      return NextResponse.json({ success: true, students: studentSummaries });
    }

    if (action === 'student_detail') {
      // 获取某个学生的详细学习记忆
      const { studentId } = body;
      if (!teacherId || !studentId) return NextResponse.json({ success: false, error: '缺少teacherId或studentId' }, { status: 400 });

      const { data: profile } = await client
        .from('student_profile')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .maybeSingle();

      const { data: mastery } = await client
        .from('knowledge_mastery')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .order('mastery_level', { ascending: true });

      const { data: conversations } = await client
        .from('conversation_log')
        .select('topic, summary, confusion, breakthrough, key_moment_type, created_at')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: strategies } = await client
        .from('teaching_strategy')
        .select('method, effectiveness, context, subject, topic')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId);

      return NextResponse.json({
        success: true,
        detail: {
          profile,
          knowledge_mastery: mastery || [],
          conversations: conversations || [],
          strategies: strategies || [],
        },
      });
    }

    return NextResponse.json({ success: false, error: '未知操作' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    console.error('[TEACHER API] POST error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
