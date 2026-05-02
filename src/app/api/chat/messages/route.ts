import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const maxDuration = 30;

/**
 * 聊天消息保存与加载 API
 * POST /api/chat/messages
 * - action: "save" 保存消息
 * - action: "load"  加载会话消息
 * - action: "history" 加载历史会话列表
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    const client = getSupabaseClient();

    if (action === 'save') {
      // 保存单条消息
      const { id, session_id, student_id, teacher_id, role, content, message_type, image_url } = body;
      if (!session_id || !student_id || !teacher_id || !role || !content) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
      }

      const { error } = await client.from('chat_messages').insert({
        id: id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        session_id,
        student_id,
        teacher_id,
        role,
        content,
        message_type: message_type || 'text',
        image_url: image_url || null,
      });

      if (error) throw new Error(`消息保存失败: ${error.message}`);
      return NextResponse.json({ success: true });

    } else if (action === 'save_batch') {
      // 批量保存消息
      const { messages, session_id, student_id, teacher_id } = body;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return NextResponse.json({ error: '消息列表为空' }, { status: 400 });
      }

      const rows = messages.map((m: { id: string; role: string; content: string; message_type?: string; image_url?: string }) => ({
        id: m.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        session_id,
        student_id,
        teacher_id,
        role: m.role,
        content: m.content,
        message_type: m.message_type || 'text',
        image_url: m.image_url || null,
      }));

      const { error } = await client.from('chat_messages').upsert(rows, { onConflict: 'id' });
      if (error) throw new Error(`批量保存失败: ${error.message}`);

      // 保存成功后，返回该学生在此教师下的最新历史会话列表
      const { data: historyData, error: historyError } = await client
        .from('chat_messages')
        .select('session_id, created_at, role, content')
        .eq('student_id', student_id)
        .eq('teacher_id', teacher_id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (historyError) throw new Error(`历史记录加载失败: ${historyError.message}`);

      // 按session分组
      const sessionMap = new Map<string, { session_id: string; first_message: string; created_at: string; message_count: number }>();
      for (const msg of historyData || []) {
        if (!sessionMap.has(msg.session_id)) {
          sessionMap.set(msg.session_id, {
            session_id: msg.session_id,
            first_message: msg.role === 'user' ? msg.content.slice(0, 50) : '',
            created_at: msg.created_at,
            message_count: 1,
          });
        } else {
          const entry = sessionMap.get(msg.session_id)!;
          entry.message_count++;
          if (!entry.first_message && msg.role === 'user') {
            entry.first_message = msg.content.slice(0, 50);
          }
        }
      }

      const sessions = Array.from(sessionMap.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20);

      return NextResponse.json({ success: true, count: rows.length, sessions });

    } else if (action === 'load') {
      // 加载某个会话的所有消息
      const { session_id } = body;
      if (!session_id) {
        return NextResponse.json({ error: '缺少 session_id' }, { status: 400 });
      }

      const { data, error } = await client
        .from('chat_messages')
        .select('*')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true });

      if (error) throw new Error(`消息加载失败: ${error.message}`);
      return NextResponse.json({ success: true, messages: data || [] });

    } else if (action === 'history') {
      // 加载学生的历史会话列表
      const { student_id, teacher_id } = body;
      if (!student_id || !teacher_id) {
        return NextResponse.json({ error: '缺少 student_id 或 teacher_id' }, { status: 400 });
      }

      // 获取最近20个session的摘要信息
      const { data, error } = await client
        .from('chat_messages')
        .select('session_id, created_at, role, content')
        .eq('student_id', student_id)
        .eq('teacher_id', teacher_id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw new Error(`历史记录加载失败: ${error.message}`);

      // 按session分组
      const sessionMap = new Map<string, { session_id: string; first_message: string; created_at: string; message_count: number }>();
      for (const msg of data || []) {
        if (!sessionMap.has(msg.session_id)) {
          sessionMap.set(msg.session_id, {
            session_id: msg.session_id,
            first_message: msg.role === 'user' ? msg.content.slice(0, 50) : '',
            created_at: msg.created_at,
            message_count: 1,
          });
        } else {
          const entry = sessionMap.get(msg.session_id)!;
          entry.message_count++;
          if (!entry.first_message && msg.role === 'user') {
            entry.first_message = msg.content.slice(0, 50);
          }
        }
      }

      const sessions = Array.from(sessionMap.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20);

      return NextResponse.json({ success: true, sessions });

    } else {
      return NextResponse.json({ error: '未知 action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[CHAT_MESSAGES] 操作失败:', error);
    return NextResponse.json(
      { error: `操作失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
