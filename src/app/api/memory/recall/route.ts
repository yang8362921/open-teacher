import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const maxDuration = 30;

/**
 * 记忆检索 API
 * POST /api/memory/recall
 * 根据 student_id 检索学生画像、知识掌握、对话历史、教学策略
 */
export async function POST(request: NextRequest) {
  try {
    const { student_id, context, teacher_id } = await request.json();

    if (!student_id) {
      return NextResponse.json({ error: '请提供 student_id' }, { status: 400 });
    }

    const tid = teacher_id || 'teacher_default';
    const client = getSupabaseClient();

    // 检查学生是否被禁用
    const { data: studentCheck } = await client
      .from('student_profile')
      .select('is_enabled')
      .eq('student_id', student_id)
      .eq('teacher_id', tid)
      .maybeSingle();

    if (studentCheck && studentCheck.is_enabled === false) {
      return NextResponse.json({ 
        success: false, 
        error: '您的账号已被禁用，请联系管理员' 
      }, { status: 403 });
    }

    // 并行检索四种记忆（按 teacher_id 隔离）
    const [profileResult, masteryResult, conversationResult, strategyResult] = await Promise.all([
      // 1. 学生画像
      client
        .from('student_profile')
        .select('*')
        .eq('student_id', student_id)
        .eq('teacher_id', tid)
        .maybeSingle(),

      // 2. 知识掌握情况
      client
        .from('knowledge_mastery')
        .select('*')
        .eq('student_id', student_id)
        .eq('teacher_id', tid)
        .order('updated_at', { ascending: false })
        .limit(20),

      // 3. 近期对话摘要（最近 10 条）
      client
        .from('conversation_log')
        .select('id, topic, summary, breakthrough, confusion, next_steps, key_moment_type, key_moment_content, created_at')
        .eq('student_id', student_id)
        .eq('teacher_id', tid)
        .order('created_at', { ascending: false })
        .limit(10),

      // 4. 教学策略
      client
        .from('teaching_strategy')
        .select('*')
        .eq('student_id', student_id)
        .eq('teacher_id', tid)
        .order('updated_at', { ascending: false })
        .limit(15),
    ]);

    // 检查错误
    if (profileResult.error) throw new Error(`画像查询失败: ${profileResult.error.message}`);
    if (masteryResult.error) throw new Error(`知识掌握查询失败: ${masteryResult.error.message}`);
    if (conversationResult.error) throw new Error(`对话记录查询失败: ${conversationResult.error.message}`);
    if (strategyResult.error) throw new Error(`教学策略查询失败: ${strategyResult.error.message}`);

    // 构建记忆上下文
    const profile = profileResult.data;
    const mastery = masteryResult.data || [];
    const conversations = conversationResult.data || [];
    const strategies = strategyResult.data || [];

    // 分析知识掌握情况——三档分类，互斥
    // 已掌握(>=0.6)：不重复讲解基础
    // 学习中(0.3~0.5)：有了解但未掌握，可适当延伸
    // 薄弱(<0.3)：重点讲解，放慢节奏
    const masteredTopics = mastery.filter((m: { mastery_level: number }) => m.mastery_level >= 0.6);
    const learningTopics = mastery.filter((m: { mastery_level: number }) => m.mastery_level >= 0.3 && m.mastery_level < 0.6);
    const weakTopics = mastery.filter((m: { mastery_level: number }) => m.mastery_level > 0 && m.mastery_level < 0.3);

    // 分析教学策略
    const effectiveMethods = strategies.filter((s: { effectiveness: string }) => s.effectiveness === 'effective');
    const ineffectiveMethods = strategies.filter((s: { effectiveness: string }) => s.effectiveness === 'ineffective');

    // 提取关键时刻
    const keyMoments = conversations
      .filter((c: { key_moment_type: string | null }) => c.key_moment_type)
      .slice(0, 5);

    const memoryContext = {
      student_id,
      has_profile: !!profile,
      profile: profile ? {
        name: profile.name,
        grade: profile.grade,
        main_subjects: profile.main_subjects,
        learning_style: profile.learning_style,
        learning_preference: profile.learning_preference,
        interests_topics: profile.interests_topics,
        interests_apps: profile.interests_apps,
        personality_type: profile.personality_type,
        engagement_level: profile.engagement_level,
        question_frequency: profile.question_frequency,
      } : null,
      knowledge_mastery: {
        total_topics: mastery.length,
        mastered: masteredTopics.map((m: { subject: string; topic: string; subtopic: string | null; mastery_level: number; strong_points: string | null }) => ({
          subject: m.subject, topic: m.topic, subtopic: m.subtopic, mastery_level: m.mastery_level, strong_points: m.strong_points,
        })),
        learning: learningTopics.map((m: { subject: string; topic: string; subtopic: string | null; mastery_level: number; weak_points: string | null }) => ({
          subject: m.subject, topic: m.topic, subtopic: m.subtopic, mastery_level: m.mastery_level, weak_points: m.weak_points,
        })),
        weak: weakTopics.map((m: { subject: string; topic: string; subtopic: string | null; mastery_level: number; weak_points: string | null }) => ({
          subject: m.subject, topic: m.topic, subtopic: m.subtopic, mastery_level: m.mastery_level, weak_points: m.weak_points,
        })),
      },
      recent_conversations: conversations.slice(0, 5).map((c: { topic: string | null; summary: string | null; breakthrough: string | null; confusion: string | null; next_steps: string | null; created_at: string }) => ({
        topic: c.topic,
        summary: c.summary,
        breakthrough: c.breakthrough,
        confusion: c.confusion,
        next_steps: c.next_steps,
        date: c.created_at,
      })),
      key_moments: keyMoments.map((c: { key_moment_type: string; key_moment_content: string | null; created_at: string }) => ({
        type: c.key_moment_type,
        content: c.key_moment_content,
        date: c.created_at,
      })),
      teaching_strategy: {
        effective_methods: effectiveMethods.map((s: { method: string; context: string | null; subject: string | null }) => ({
          method: s.method, context: s.context, subject: s.subject,
        })),
        ineffective_methods: ineffectiveMethods.map((s: { method: string; context: string | null }) => ({
          method: s.method, context: s.context,
        })),
      },
    };

    // 生成文本形式的记忆摘要（可注入系统提示词）
    const memorySummary = buildMemorySummary(memoryContext, context);

    return NextResponse.json({
      success: true,
      memory: memoryContext,
      memory_summary: memorySummary,
    });
  } catch (error) {
    console.error('[MEMORY] 检索失败:', error);
    return NextResponse.json(
      { error: `记忆检索失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

/**
 * 将记忆上下文构建为可注入系统提示词的文本摘要
 * 三档分类：已掌握(>=0.6)、学习中(0.3~0.5)、薄弱(<0.3)
 * 每个知识点只出现一次，给出精确的交互指导
 */
function buildMemorySummary(memory: Record<string, unknown>, context?: string): string {
  const parts: string[] = [];

  // 学生画像
  const profile = memory.profile as Record<string, unknown> | null;
  if (profile) {
    const profileParts: string[] = [];
    if (profile.name) profileParts.push(`姓名：${profile.name}`);
    if (profile.grade) profileParts.push(`年级：${profile.grade}`);
    if (profile.main_subjects) profileParts.push(`主要学科：${profile.main_subjects}`);
    if (profile.learning_style) profileParts.push(`学习风格：${profile.learning_style}`);
    if (profile.learning_preference) profileParts.push(`学习偏好：${profile.learning_preference}`);
    if (profile.interests_topics) profileParts.push(`兴趣方向：${profile.interests_topics}`);
    if (profile.interests_apps) profileParts.push(`感兴趣的应用：${profile.interests_apps}`);
    if (profileParts.length > 0) {
      parts.push('## 学生画像');
      parts.push(...profileParts);
    }
  }

  // 知识掌握——三档分类，互斥
  const km = memory.knowledge_mastery as {
    total_topics: number;
    mastered: Record<string, unknown>[];
    learning: Record<string, unknown>[];
    weak: Record<string, unknown>[];
  };

  if (km.total_topics > 0) {
    // 已掌握：不需要再讲基础，可以深入进阶
    if (km.mastered.length > 0) {
      parts.push('\n## 已掌握的知识点');
      parts.push('规则：这些知识点学生已经掌握，绝对不要再重复讲解基础概念。如果学生问到这些内容，可以直接进阶讨论或简单确认后跳过。');
      for (const t of km.mastered) {
        const label = `${t.subject}-${t.topic}${t.subtopic ? '/' + t.subtopic : ''}`;
        const detail = t.strong_points ? `——已掌握：${t.strong_points}` : '';
        parts.push(`- ${label}${detail}`);
      }
    }

    // 学习中：有基础了解但未完全掌握，需要巩固和补充
    if (km.learning.length > 0) {
      parts.push('\n## 学习中的知识点');
      parts.push('规则：这些知识点学生有一定了解但尚未掌握，可以在此基础上深入讲解，补充薄弱环节，不需要从零开始。');
      for (const t of km.learning) {
        const label = `${t.subject}-${t.topic}${t.subtopic ? '/' + t.subtopic : ''}`;
        const detail = t.weak_points ? `——还需加强：${t.weak_points}` : '';
        parts.push(`- ${label}${detail}`);
      }
    }

    // 薄弱：需要重点讲解，用更直观的方式，放慢节奏
    if (km.weak.length > 0) {
      parts.push('\n## 薄弱的知识点');
      parts.push('规则：这些知识点学生理解困难，需要重点讲解，放慢节奏，用生活例子和直观方式讲解，不要使用抽象术语。');
      for (const t of km.weak) {
        const label = `${t.subject}-${t.topic}${t.subtopic ? '/' + t.subtopic : ''}`;
        const detail = t.weak_points ? `——困难：${t.weak_points}` : '';
        parts.push(`- ${label}${detail}`);
      }
    }
  }

  // 近期对话——精简，只取关键信息
  const recentConvs = memory.recent_conversations as Record<string, unknown>[];
  if (recentConvs && recentConvs.length > 0) {
    parts.push('\n## 近期学习记录');
    for (const conv of recentConvs.slice(0, 3)) {
      const lines: string[] = [];
      if (conv.topic) lines.push(`${conv.topic}`);
      if (conv.summary) lines.push(`${conv.summary}`);
      if (conv.confusion) lines.push(`困惑：${conv.confusion}`);
      if (conv.breakthrough) lines.push(`突破：${conv.breakthrough}`);
      parts.push('- ' + lines.join('，'));
    }
  }

  // 教学策略
  const ts = memory.teaching_strategy as { effective_methods: Record<string, unknown>[]; ineffective_methods: Record<string, unknown>[] };
  if (ts.effective_methods.length > 0 || ts.ineffective_methods.length > 0) {
    parts.push('\n## 教学策略');
    if (ts.effective_methods.length > 0) {
      // 去重：合并相似方法
      const uniqueMethods = new Map<string, string>();
      for (const m of ts.effective_methods) {
        const key = String(m.method);
        if (!uniqueMethods.has(key)) {
          uniqueMethods.set(key, m.context ? `${key}（${m.context}）` : key);
        }
      }
      parts.push(`有效方法：${Array.from(uniqueMethods.values()).join('、')}`);
    }
    if (ts.ineffective_methods.length > 0) {
      const uniqueMethods = new Map<string, string>();
      for (const m of ts.ineffective_methods) {
        const key = String(m.method);
        if (!uniqueMethods.has(key)) {
          uniqueMethods.set(key, m.context ? `${key}（${m.context}）` : key);
        }
      }
      parts.push(`效果差的方法（避免）：${Array.from(uniqueMethods.values()).join('、')}`);
    }
  }

  return parts.join('\n');
}
