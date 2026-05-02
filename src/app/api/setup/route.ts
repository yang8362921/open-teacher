/**
 * 数据库初始化 API
 * GET /api/setup - 获取建表 SQL 和初始化状态
 * POST /api/setup - 触发初始化检查（创建管理员账号等）
 */
import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getCreateTableSQL } from '@/storage/database/init-database';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const client = getSupabaseClient();
    const tableStatus: Record<string, boolean> = {};
    const tables = [
      'admin_account',
      'teacher_profile',
      'student_profile',
      'knowledge_mastery',
      'conversation_log',
      'teaching_strategy',
    ];

    let allExist = true;
    for (const table of tables) {
      const { error } = await client.from(table).select('id').limit(1);
      const exists = !error || !(error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation'));
      tableStatus[table] = exists;
      if (!exists) allExist = false;
    }

    // 检查管理员账号
    const { data: admin } = await client
      .from('admin_account')
      .select('id')
      .eq('username', 'admin')
      .maybeSingle();

    return NextResponse.json({
      initialized: allExist,
      adminAccountExists: !!admin,
      tables: tableStatus,
      sql: allExist ? null : getCreateTableSQL(),
    });
  } catch (err) {
    return NextResponse.json({
      initialized: false,
      error: String(err),
      sql: getCreateTableSQL(),
    }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    await initializeDatabase();
    return NextResponse.json({ success: true, message: '数据库初始化完成' });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
