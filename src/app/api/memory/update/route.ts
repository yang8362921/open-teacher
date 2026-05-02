import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const maxDuration = 60;

/**
 * 记忆更新 API
 * POST /api/memory/update
 * 分析对话内容，提取记忆信息并写入数据库
 */
export async function POST(request: NextRequest) {
  try {
    const { student_id, session_id, user_message, assistant_message, student_info, teacher_id } = await request.json();

    if (!student_id || !user_message) {
      return NextResponse.json({ error: '请提供 student_id 和 user_message' }, { status: 400 });
    }

    const tid = teacher_id || 'teacher_default';
    const client = getSupabaseClient();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 获取教师的专业领域，用于判断问题是否相关
    let teacherSubjects = '';
    try {
      const { data: teacherData } = await client
        .from('teacher_profile')
        .select('subjects, expertise')
        .eq('id', tid)
        .maybeSingle();
      if (teacherData) {
        teacherSubjects = [teacherData.subjects, teacherData.expertise].filter(Boolean).join('、');
      }
    } catch { /* ignore */ }

    // 使用 LLM 分析对话内容，提取记忆信息
    const analysisResult = await analyzeConversation(
      user_message,
      assistant_message || '',
      customHeaders,
      teacherSubjects
    );

    if (!analysisResult) {
      return NextResponse.json({ success: true, message: '对话内容无需记忆更新' });
    }

    const updates: string[] = [];

    // 1. 保存对话摘要
    if (analysisResult.summary) {
      const { error: convError } = await client.from('conversation_log').insert({
        student_id,
        teacher_id: tid,
        session_id: session_id || null,
        topic: analysisResult.topic || null,
        summary: analysisResult.summary,
        breakthrough: analysisResult.breakthrough || null,
        confusion: analysisResult.confusion || null,
        next_steps: analysisResult.next_steps || null,
        key_moment_type: analysisResult.key_moment_type || null,
        key_moment_content: analysisResult.key_moment_content || null,
        key_moment_context: analysisResult.key_moment_context || null,
        user_message: user_message.slice(0, 500),
        assistant_message: (assistant_message || '').slice(0, 500),
      });
      if (convError) throw new Error(`对话记录保存失败: ${convError.message}`);
      updates.push('conversation_log');
    }

    // 2. 更新知识掌握
    if (analysisResult.knowledge_updates && analysisResult.knowledge_updates.length > 0) {
      for (const ku of analysisResult.knowledge_updates) {
        // 查找是否已有该知识点记录——获取该学生所有记录
        const { data: allExisting, error: findAllError } = await client
          .from('knowledge_mastery')
          .select('id, mastery_level, practice_count, topic, subject, subtopic, weak_points, strong_points')
          .eq('student_id', student_id)
          .eq('teacher_id', tid);

        if (findAllError) throw new Error(`知识掌握查询失败: ${findAllError.message}`);

        // 多层匹配：精确 → subtopic关键词 → topic+subtopic全文关键词
        // 找所有相关记录（可能有多条重复的）
        const findRelated = (): { best: typeof allExisting[0] | undefined; duplicates: typeof allExisting } => {
          if (!allExisting || allExisting.length === 0) return { best: undefined, duplicates: [] };

          // 精确匹配
          let best = allExisting.find(r =>
            r.topic === ku.topic && (r.subtopic === (ku.subtopic || null) || r.subtopic === ku.subtopic)
          );

          // subtopic 关键词匹配
          if (!best && ku.subtopic) {
            const subKeywords = ku.subtopic.split(/[\/\-、，,\s]/).filter((w: string) => w.length >= 2);
            best = allExisting.find(r => {
              const rSubKeywords = (r.subtopic || '').split(/[\/\-、，,\s]/).filter((w: string) => w.length >= 2);
              return subKeywords.some((kw: string) => rSubKeywords.some((rkw: string) => rkw.includes(kw) || kw.includes(rkw)));
            });
          }

          // topic+subtopic 全文关键词匹配
          if (!best && ku.topic) {
            const topicKeywords = ku.topic.split(/[\/\-、，,\s]/).filter((w: string) => w.length >= 2);
            best = allExisting.find(r => {
              const rAllText = `${r.topic} ${r.subtopic || ''}`;
              return topicKeywords.some((kw: string) => rAllText.includes(kw));
            });
          }

          if (!best) return { best: undefined, duplicates: [] };

          // 找出所有与 best 语义重复的记录（同 topic 或 subtopic 关键词重叠）
          const duplicates = allExisting.filter(r => {
            if (r.id === best!.id) return false; // 排除 best 自身
            // 同 topic 视为重复
            if (r.topic === best!.topic) return true;
            // subtopic 关键词有交集
            const bestSubs = (best!.subtopic || '').split(/[\/\-、，,\s]/).filter((w: string) => w.length >= 2);
            const rSubs = (r.subtopic || '').split(/[\/\-、，,\s]/).filter((w: string) => w.length >= 2);
            if (bestSubs.length > 0 && rSubs.length > 0) {
              return bestSubs.some((b: string) => rSubs.some((rs: string) => b.includes(rs) || rs.includes(b)));
            }
            return false;
          });

          return { best, duplicates };
        };

        const { best: existing, duplicates } = findRelated();

        if (existing) {
          // 更新已有记录
          // 如果有重复记录，合并 practice_count
          const mergedPracticeCount = (existing.practice_count || 0) +
            duplicates.reduce((sum: number, d: typeof existing) => sum + (d.practice_count || 0), 0) + 1;

          let newMasteryLevel = existing.mastery_level || 0;
          if (ku.update_type === 'mastered') {
            newMasteryLevel = 0.8;
          } else if (ku.update_type === 'confused') {
            newMasteryLevel = Math.max(0, newMasteryLevel - 0.1);
          } else {
            newMasteryLevel = Math.min(0.6, newMasteryLevel + 0.1);
          }

          const { error: updateError } = await client
            .from('knowledge_mastery')
            .update({
              mastery_level: newMasteryLevel,
              practice_count: mergedPracticeCount,
              last_practice: new Date().toISOString(),
              weak_points: ku.update_type !== 'mastered' ? (ku.weak_points || existing.weak_points || null) : null,
              strong_points: ku.update_type === 'mastered' ? (ku.strong_points || '已通过验证测试') : (existing.strong_points || null),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) throw new Error(`知识掌握更新失败: ${updateError.message}`);

          // 删除重复记录
          if (duplicates.length > 0) {
            const dupIds = duplicates.map(d => d.id);
            const { error: deleteError } = await client
              .from('knowledge_mastery')
              .delete()
              .in('id', dupIds);
            if (deleteError) {
              console.warn('[MEMORY] 重复记录删除失败:', deleteError.message);
            } else {
              console.log(`[MEMORY] 合并删除 ${dupIds.length} 条重复知识点记录`);
            }
          }
        } else {
          // 新增记录
          let initialMastery = 0.3;
          if (ku.update_type === 'mastered') initialMastery = 0.7;
          else if (ku.update_type === 'confused') initialMastery = 0.2;

          const { error: insertError } = await client.from('knowledge_mastery').insert({
            student_id,
            teacher_id: tid,
            subject: ku.subject || '综合',
            topic: ku.topic,
            subtopic: ku.subtopic || null,
            mastery_level: initialMastery,
            practice_count: 1,
            last_practice: new Date().toISOString(),
            weak_points: ku.weak_points || null,
            strong_points: ku.strong_points || null,
          });
          if (insertError) throw new Error(`知识掌握插入失败: ${insertError.message}`);
        }
      }
      updates.push('knowledge_mastery');
    }

    // 3. 更新教学策略
    if (analysisResult.strategy_updates && analysisResult.strategy_updates.length > 0) {
      for (const su of analysisResult.strategy_updates) {
        // 检查是否已有相同方法记录
        const { data: existingStrategy, error: findStratError } = await client
          .from('teaching_strategy')
          .select('id')
          .eq('student_id', student_id)
          .eq('teacher_id', tid)
          .eq('method', su.method)
          .eq('effectiveness', su.effectiveness)
          .limit(1);

        if (findStratError) throw new Error(`教学策略查询失败: ${findStratError.message}`);

        if (!existingStrategy || existingStrategy.length === 0) {
          const { error: stratError } = await client.from('teaching_strategy').insert({
            student_id,
            teacher_id: tid,
            method: su.method,
            effectiveness: su.effectiveness,
            context: su.context || null,
            student_reaction: su.student_reaction || null,
            subject: su.subject || null,
            topic: su.topic || null,
          });
          if (stratError) throw new Error(`教学策略插入失败: ${stratError.message}`);
        }
      }
      updates.push('teaching_strategy');
    }

    // 4. 自动补全学生画像
    // 优先级：student_info 参数（用户真实输入） > LLM 分析结果
    // 用户输入的字段始终覆盖 LLM 推断（LLM 可能编造不准确的信息）
    const profileInput = student_info || analysisResult.student_insights;
    const hasUserInput = !!student_info; // 是否有用户真实输入
    const { data: profile, error: profileError } = await client
      .from('student_profile')
      .select('*')
      .eq('student_id', student_id)
      .eq('teacher_id', tid)
      .maybeSingle();

    if (profileError) throw new Error(`画像查询失败: ${profileError.message}`);

    if (!profile && profileInput) {
      // 新学生，创建画像
      const { error: createError } = await client.from('student_profile').insert({
        student_id,
        teacher_id: tid,
        name: profileInput.name || null,
        grade: profileInput.grade || null,
        main_subjects: profileInput.main_subjects || null,
        learning_style: profileInput.learning_style || null,
        learning_preference: profileInput.learning_preference || null,
        interests_topics: profileInput.interests_topics || null,
        interests_apps: profileInput.interests_apps || null,
        personality_type: profileInput.personality_type || null,
      });
      if (createError) throw new Error(`画像创建失败: ${createError.message}`);
      updates.push('student_profile(created)');
    } else if (profile && profileInput) {
      // 已有画像，更新字段
      // 用户真实输入（student_info）始终可覆盖；LLM 推断仅补空字段
      const updates_map: Record<string, string> = {};
      const userFields = ['name', 'grade', 'learning_style'] as const;
      for (const field of userFields) {
        const val = (profileInput as Record<string, string | undefined>)[field];
        if (val) {
          const existing = (profile as Record<string, string | undefined>)[field];
          if (hasUserInput || !existing) {
            updates_map[field] = val;
          }
        }
      }
      // LLM 推断的字段：只在数据库为空时补充
      const llmFields = ['main_subjects', 'learning_preference', 'interests_topics', 'interests_apps', 'personality_type'] as const;
      for (const field of llmFields) {
        const val = (profileInput as Record<string, string | undefined>)[field];
        const existing = (profile as Record<string, string | undefined>)[field];
        if (!existing && val) {
          updates_map[field] = val;
        }
      }

      if (Object.keys(updates_map).length > 0) {
        const { error: updateProfileError } = await client
          .from('student_profile')
          .update({ ...updates_map, updated_at: new Date().toISOString() })
          .eq('student_id', student_id)
          .eq('teacher_id', tid);
        if (updateProfileError) throw new Error(`画像更新失败: ${updateProfileError.message}`);
        updates.push('student_profile(updated)');
      }
    }

    // 提取薄弱环节和学习建议
    const weakPoints: string[] = [];
    const suggestions: string[] = [];

    // 从知识掌握更新中提取薄弱点
    if (analysisResult.knowledge_updates) {
      for (const ku of analysisResult.knowledge_updates) {
        if (ku.weak_points) {
          weakPoints.push(`${ku.topic}${ku.subtopic ? ' - ' + ku.subtopic : ''}: ${ku.weak_points}`);
        }
        if (ku.update_type === 'confused') {
          weakPoints.push(`${ku.topic}${ku.subtopic ? ' - ' + ku.subtopic : ''} 理解困难，需要重点讲解`);
        }
      }
    }

    // 从对话分析中提取建议
    if (analysisResult.confusion) {
      weakPoints.push(analysisResult.confusion);
    }
    if (analysisResult.next_steps) {
      suggestions.push(analysisResult.next_steps);
    }
    if (analysisResult.breakthrough) {
      suggestions.push(`继续保持: ${analysisResult.breakthrough}`);
    }

    return NextResponse.json({
      success: true,
      updates,
      analysis: {
        topic: analysisResult.topic,
        key_moment_type: analysisResult.key_moment_type,
        knowledge_count: analysisResult.knowledge_updates?.length || 0,
        strategy_count: analysisResult.strategy_updates?.length || 0,
      },
      // 新增：学习分析
      learningInsight: {
        weakPoints: [...new Set(weakPoints)].slice(0, 5),  // 去重，最多5条
        suggestions: [...new Set(suggestions)].slice(0, 3), // 去重，最多3条
      },
    });
  } catch (error) {
    console.error('[MEMORY] 更新失败:', error);
    return NextResponse.json(
      { error: `记忆更新失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

/**
 * 使用 LLM 分析对话内容，提取记忆信息
 */
async function analyzeConversation(
  userMessage: string,
  assistantMessage: string,
  customHeaders: Record<string, string>,
  teacherSubjects: string = ''
): Promise<ConversationAnalysis | null> {
  try {
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    const relevanceNote = teacherSubjects
      ? `\n## 教师专业领域\n${teacherSubjects}\n\n**重要规则**：如果学生的问题与教师专业领域无关（如闲聊、问其他学科问题等），则 is_relevant 必须为 false，且 knowledge_updates 和 strategy_updates 必须为空数组。只有与教师专业领域相关的学科问题才需要记录知识掌握和教学策略。`
      : '';

    const analysisPrompt = `你是一个教学分析助手。请分析以下师生对话，提取记忆信息。
${relevanceNote}
## 学生的问题
${userMessage}

## 教师的回答
${assistantMessage || '（无教师回复）'}

## 分析要求
特别注意：
- 如果学生说"懂了""明白了""清楚了"但教师出了验证测试，需要看学生是否通过测试
- 只有学生通过了验证测试（答对问题），才将 update_type 标记为 "mastered"
- 如果学生说懂了但未通过测试或未进行测试，标记为 "practice"
- 如果学生仍然困惑或答错，标记为 "confused"

请严格按照以下 JSON 格式输出分析结果（只输出JSON，不要输出其他内容）：

{
  "is_relevant": true/false,
  "topic": "本次对话的主要学科主题",
  "summary": "本次对话的简要摘要（50字以内）",
  "breakthrough": "学生的突破性理解（如有）",
  "confusion": "学生的困惑点（如有）",
  "next_steps": "建议下次学习内容",
  "key_moment_type": "breakthrough/frustration/confusion/achievement/null",
  "key_moment_content": "关键时刻内容描述",
  "key_moment_context": "关键时刻上下文",
  "knowledge_updates": [
    {
      "subject": "学科",
      "topic": "知识点",
      "subtopic": "子知识点（如有）",
      "update_type": "practice/mastered/confused",
      "weak_points": "薄弱点描述",
      "strong_points": "已掌握点描述"
    }
  ],
  "strategy_updates": [
    {
      "method": "使用的教学方法",
      "effectiveness": "effective/ineffective",
      "context": "适用场景",
      "student_reaction": "学生反应",
      "subject": "相关学科",
      "topic": "相关知识点"
    }
  ],
  "student_insights": {
    "name": "学生姓名（仅在对话中学生明确自我介绍时填写，禁止从上下文推测或编造）",
    "grade": "年级（仅在对话中学生明确提及自己年级时填写）",
    "main_subjects": "主要学科",
    "learning_style": "学习风格推断（视觉型/听觉型/动手型）",
    "learning_preference": "学习偏好",
    "interests_topics": "兴趣方向",
    "interests_apps": "感兴趣的应用场景",
    "personality_type": "性格特点推断"
  }
}

## 判断规则
- knowledge_updates：如果对话涉及具体知识点的学习、练习或困惑，则记录
- update_type 判断规则（非常重要）：
  - mastered = 学生通过了验证测试（教师出了测试题，学生答对了）
  - confused = 学生仍然困惑，或答错了验证测试
  - practice = 一般性练习，学生说懂了但未进行验证测试，或未明确判断
- strategy_updates：如果教师的某种讲解方式明显有效或无效，则记录
- student_insights：仅从本次对话中能直接确认的学生信息。name 字段极其重要——禁止推测或编造学生姓名，只有学生在对话中明确说出自己的名字时才填写，否则留空
- key_moment_type：只在有明显情感变化时记录，否则为 null
- 如果对话内容很简单（如简单问候），大部分字段可以为 null/空数组
- topic 名称要简洁统一（如"神经网络"而非"人工智能/深度学习-神经网络原理"），便于后续匹配
- is_relevant：判断学生的问题是否与教师专业领域相关。闲聊、问其他学科问题、与教学无关的内容设为 false
- 当 is_relevant 为 false 时，knowledge_updates 和 strategy_updates 必须为空数组，summary 可以简要记录即可`;

    const messages = [
      { role: 'system' as const, content: '你是教学分析助手，只输出JSON格式的分析结果，不要输出其他内容。' },
      { role: 'user' as const, content: analysisPrompt },
    ];

    const stream = llmClient.stream(messages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.3,
    });

    let result = '';
    for await (const chunk of stream) {
      if (chunk.content) {
        result += chunk.content.toString();
      }
    }

    // 解析 JSON
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[MEMORY] LLM 分析结果非JSON格式:', result.slice(0, 100));
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // 如果对话太简单，不需要记忆
    if (!parsed.topic && (!parsed.knowledge_updates || parsed.knowledge_updates.length === 0)) {
      return null;
    }

    // 如果问题与教师专业领域无关，仅保留对话摘要，不记录知识掌握和教学策略
    if (parsed.is_relevant === false) {
      console.log('[MEMORY] 对话与教师专业领域无关，跳过知识记录');
      return {
        ...parsed,
        knowledge_updates: [],
        strategy_updates: [],
      } as ConversationAnalysis;
    }

    return parsed as ConversationAnalysis;
  } catch (error) {
    console.warn('[MEMORY] LLM 分析失败:', error);
    return null;
  }
}

interface ConversationAnalysis {
  is_relevant?: boolean;
  topic?: string;
  summary?: string;
  breakthrough?: string;
  confusion?: string;
  next_steps?: string;
  key_moment_type?: string | null;
  key_moment_content?: string | null;
  key_moment_context?: string | null;
  knowledge_updates?: Array<{
    subject?: string;
    topic: string;
    subtopic?: string;
    update_type: 'practice' | 'mastered' | 'confused';
    weak_points?: string;
    strong_points?: string;
  }>;
  strategy_updates?: Array<{
    method: string;
    effectiveness: 'effective' | 'ineffective';
    context?: string;
    student_reaction?: string;
    subject?: string;
    topic?: string;
  }>;
  student_insights?: {
    name?: string;
    grade?: string;
    main_subjects?: string;
    learning_style?: string;
    learning_preference?: string;
    interests_topics?: string;
    interests_apps?: string;
    personality_type?: string;
  };
}
