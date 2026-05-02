import { pgTable, serial, varchar, timestamp, integer, real, text, jsonb, boolean, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ===== 记忆系统表 =====

/**
 * 学生画像表 - 存储学生的基本信息、学习风格、兴趣方向、性格特点
 */
export const studentProfile = pgTable(
  "student_profile",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    student_id: varchar("student_id", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 128 }),
    grade: varchar("grade", { length: 64 }),
    main_subjects: text("main_subjects"),
    learning_style: varchar("learning_style", { length: 32 }),
    learning_preference: text("learning_preference"),
    interests_topics: text("interests_topics"),
    interests_apps: text("interests_apps"),
    personality_type: varchar("personality_type", { length: 32 }),
    engagement_level: varchar("engagement_level", { length: 32 }),
    question_frequency: varchar("question_frequency", { length: 32 }),
    metadata: jsonb("metadata"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("student_profile_student_id_idx").on(table.student_id),
  ]
);

/**
 * 知识掌握表 - 追踪学生对各知识点的掌握程度
 */
export const knowledgeMastery = pgTable(
  "knowledge_mastery",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    student_id: varchar("student_id", { length: 64 }).notNull(),
    subject: varchar("subject", { length: 64 }).notNull(),
    topic: varchar("topic", { length: 128 }).notNull(),
    subtopic: varchar("subtopic", { length: 128 }),
    mastery_level: real("mastery_level").default(0).notNull(),
    practice_count: integer("practice_count").default(0).notNull(),
    correct_rate: real("correct_rate"),
    last_practice: timestamp("last_practice", { withTimezone: true }),
    weak_points: text("weak_points"),
    strong_points: text("strong_points"),
    needs_review: boolean("needs_review").default(false),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_mastery_student_id_idx").on(table.student_id),
    index("knowledge_mastery_subject_topic_idx").on(table.subject, table.topic),
  ]
);

/**
 * 对话记录表 - 存储对话摘要和关键时刻
 */
export const conversationLog = pgTable(
  "conversation_log",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    student_id: varchar("student_id", { length: 64 }).notNull(),
    session_id: varchar("session_id", { length: 64 }),
    topic: varchar("topic", { length: 256 }),
    summary: text("summary"),
    breakthrough: text("breakthrough"),
    confusion: text("confusion"),
    next_steps: text("next_steps"),
    key_moment_type: varchar("key_moment_type", { length: 32 }),
    key_moment_content: text("key_moment_content"),
    key_moment_context: text("key_moment_context"),
    user_message: text("user_message"),
    assistant_message: text("assistant_message"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("conversation_log_student_id_idx").on(table.student_id),
    index("conversation_log_session_id_idx").on(table.session_id),
    index("conversation_log_created_at_idx").on(table.created_at),
  ]
);

/**
 * 教学策略表 - 记录对每个学生有效/无效的教学方法
 */
export const teachingStrategy = pgTable(
  "teaching_strategy",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    student_id: varchar("student_id", { length: 64 }).notNull(),
    method: text("method").notNull(),
    effectiveness: varchar("effectiveness", { length: 16 }).notNull(),
    context: text("context"),
    student_reaction: text("student_reaction"),
    subject: varchar("subject", { length: 64 }),
    topic: varchar("topic", { length: 128 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("teaching_strategy_student_id_idx").on(table.student_id),
    index("teaching_strategy_effectiveness_idx").on(table.effectiveness),
  ]
);
