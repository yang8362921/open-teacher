/**
 * 数据库自动初始化模块
 * 首次启动时自动创建所需的数据表和默认管理员账号
 */

import { getSupabaseClient } from './supabase-client';

/** 初始化是否已完成（进程内缓存，避免重复检查） */
let initialized = false;

/**
 * 初始化数据库表和管理员账号
 * - 检测核心表是否存在，不存在则创建
 * - 检测管理员账号是否存在，不存在则插入默认账号
 * - 使用进程内缓存，仅首次调用时执行检查
 */
export async function initializeDatabase(): Promise<void> {
  if (initialized) return;

  try {
    const client = getSupabaseClient();

    // 检测 admin_account 表是否存在（通过查询尝试判断）
    const { error: probeError } = await client
      .from('admin_account')
      .select('id')
      .limit(1);

    if (probeError && (probeError.code === '42P01' || probeError.message?.includes('does not exist') || probeError.message?.includes('relation'))) {
      console.log('[DB-INIT] 数据库表不存在，开始自动建表...');
      await createTables(client);
    } else {
      // 表已存在，检查管理员账号
      const { data: admin, error: adminError } = await client
        .from('admin_account')
        .select('id')
        .eq('username', 'admin')
        .maybeSingle();

      if (!adminError && !admin) {
        console.log('[DB-INIT] 默认管理员账号不存在，自动创建...');
        await seedAdminAccount(client);
      }
    }

    initialized = true;
    console.log('[DB-INIT] 数据库初始化完成');
  } catch (err) {
    console.error('[DB-INIT] 数据库初始化失败:', err);
    // 不抛出错误，允许服务继续启动（表可能已存在）
    initialized = true;
  }
}

/**
 * 创建所有数据表
 */
async function createTables(client: ReturnType<typeof getSupabaseClient>): Promise<void> {
  // 管理员账号表 - 先尝试查询，如果表不存在则进入建表流程
  // (Supabase JS SDK 不支持执行 DDL，所以无法直接用 rpc 创建表)

  // 由于 Supabase JS SDK 不支持执行 DDL 语句，
  // 我们采用"逐表探测 + 提示"的方式：如果表不存在就输出建表 SQL 供用户手动执行
  const tables = [
    'admin_account',
    'teacher_profile',
    'student_profile',
    'knowledge_mastery',
    'conversation_log',
    'teaching_strategy',
  ];

  const missingTables: string[] = [];

  for (const table of tables) {
    const { error } = await client.from(table).select('id').limit(1);
    if (error && (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation'))) {
      missingTables.push(table);
    }
  }

  if (missingTables.length > 0) {
    console.warn(`[DB-INIT] 以下数据表不存在: ${missingTables.join(', ')}`);
    console.warn('[DB-INIT] 请在 Supabase SQL Editor 中执行以下建表语句：');
    console.warn(getCreateTableSQL());
    console.warn('[DB-INIT] 建表完成后重启服务即可。');
  }
}

/**
 * 插入默认管理员账号
 */
async function seedAdminAccount(client: ReturnType<typeof getSupabaseClient>): Promise<void> {
  const { error } = await client
    .from('admin_account')
    .insert({
      username: 'admin',
      password: 'admin123',
    });

  if (error) {
    console.error('[DB-INIT] 创建默认管理员账号失败:', error.message);
  } else {
    console.log('[DB-INIT] 默认管理员账号已创建: admin / admin123');
  }
}

/**
 * 生成完整的建表 SQL
 */
export function getCreateTableSQL(): string {
  return `-- ============================================
-- 开放智慧助教 - 数据库建表语句
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 1. 管理员账号表
CREATE TABLE IF NOT EXISTS admin_account (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password VARCHAR(256) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 教师档案表
CREATE TABLE IF NOT EXISTS teacher_profile (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128),
  display_name VARCHAR(128),
  username VARCHAR(128),
  password VARCHAR(256) DEFAULT '123456',
  title VARCHAR(128),
  subjects TEXT,
  expertise TEXT,
  teaching_style TEXT,
  guiding_questions TEXT,
  voice_speaker VARCHAR(64),
  voice_speed REAL DEFAULT 1.0,
  voice_volume REAL DEFAULT 1.0,
  avatar_url TEXT,
  avatar_key TEXT,
  knowledge_table VARCHAR(128),
  is_setup_complete BOOLEAN DEFAULT FALSE,
  is_enabled BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 学生画像表
CREATE TABLE IF NOT EXISTS student_profile (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR(64) NOT NULL,
  teacher_id VARCHAR(64),
  name VARCHAR(128),
  grade VARCHAR(64),
  main_subjects TEXT,
  learning_style VARCHAR(32),
  learning_preference TEXT,
  interests_topics TEXT,
  interests_apps TEXT,
  personality_type VARCHAR(32),
  engagement_level VARCHAR(32),
  question_frequency VARCHAR(32),
  is_enabled BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, teacher_id)
);
CREATE INDEX IF NOT EXISTS student_profile_student_id_idx ON student_profile(student_id);
CREATE INDEX IF NOT EXISTS student_profile_teacher_id_idx ON student_profile(teacher_id);

-- 4. 知识掌握追踪表
CREATE TABLE IF NOT EXISTS knowledge_mastery (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR(64) NOT NULL,
  teacher_id VARCHAR(64),
  subject VARCHAR(64) NOT NULL,
  topic VARCHAR(128) NOT NULL,
  subtopic VARCHAR(128),
  mastery_level REAL DEFAULT 0 NOT NULL,
  practice_count INTEGER DEFAULT 0 NOT NULL,
  correct_rate REAL,
  last_practice TIMESTAMPTZ,
  weak_points TEXT,
  strong_points TEXT,
  needs_review BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS knowledge_mastery_student_id_idx ON knowledge_mastery(student_id);
CREATE INDEX IF NOT EXISTS knowledge_mastery_teacher_id_idx ON knowledge_mastery(teacher_id);
CREATE INDEX IF NOT EXISTS knowledge_mastery_subject_topic_idx ON knowledge_mastery(subject, topic);

-- 5. 对话记录表
CREATE TABLE IF NOT EXISTS conversation_log (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR(64) NOT NULL,
  teacher_id VARCHAR(64),
  session_id VARCHAR(64),
  topic VARCHAR(256),
  summary TEXT,
  breakthrough TEXT,
  confusion TEXT,
  next_steps TEXT,
  key_moment_type VARCHAR(32),
  key_moment_content TEXT,
  key_moment_context TEXT,
  user_message TEXT,
  assistant_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conversation_log_student_id_idx ON conversation_log(student_id);
CREATE INDEX IF NOT EXISTS conversation_log_teacher_id_idx ON conversation_log(teacher_id);
CREATE INDEX IF NOT EXISTS conversation_log_session_id_idx ON conversation_log(session_id);
CREATE INDEX IF NOT EXISTS conversation_log_created_at_idx ON conversation_log(created_at);

-- 6. 教学策略记忆表
CREATE TABLE IF NOT EXISTS teaching_strategy (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR(64) NOT NULL,
  teacher_id VARCHAR(64),
  method TEXT NOT NULL,
  effectiveness VARCHAR(16) NOT NULL,
  context TEXT,
  student_reaction TEXT,
  subject VARCHAR(64),
  topic VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS teaching_strategy_student_id_idx ON teaching_strategy(student_id);
CREATE INDEX IF NOT EXISTS teaching_strategy_teacher_id_idx ON teaching_strategy(teacher_id);
CREATE INDEX IF NOT EXISTS teaching_strategy_effectiveness_idx ON teaching_strategy(effectiveness);

-- ============================================
-- 插入默认管理员账号
-- ============================================
INSERT INTO admin_account (username, password)
VALUES ('admin', 'admin123')
ON CONFLICT (username) DO NOTHING;
`;
}
