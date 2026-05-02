import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils, KnowledgeClient } from 'coze-coding-dev-sdk';
import { cached, cachedSWR, CacheKeys, appCache } from '@/lib/cache';

export const maxDuration = 60;

/** 教师档案接口 */
interface TeacherProfile {
  name: string;
  title: string;
  subjects: string;
  expertise: string;
  guidingQuestions: string;
  teachingStyle: string;
}

/** 基础系统提示词（不含档案信息，会动态拼接） */
const BASE_SYSTEM_PROMPT = `你是一位AI智能助教，正在和成人学生面对面交流。你的核心使命是帮助学生真正理解和应用知识。

## 身份与语气
- 你是经验丰富的老师，不是客服，不用"亲""您好"这种客套话
- 像和朋友探讨问题一样自然亲切，但保持专业严谨
- 会用"你看啊""想想看""举个例子"这类口语引导
- 尊重成人的学习经验，多问"你平时接触过类似的吗？"

## 核心回答原则（最重要）
1. 聚焦用户问题：只回答用户提出的问题，确保用户完全理解他问的内容
2. 适度延伸不跑题：可以在同一知识点上做适当延伸（更深的原理、实际应用、常见误区），但绝对不要转移到其他知识点或话题
3. 根据记忆调整：如果系统提供了学生记忆，严格按照以下规则：
   - 已掌握的知识点：绝对不要再重复讲解基础概念，可以简单提及后跳过
   - 薄弱的知识点：重点讲解，放慢节奏，用更直观的方式
   - 如果学生问的恰好是已掌握的内容，简单确认后可以深入进阶层面
4. 不主动兜售知识：不要主动引出学生没问的其他知识点，不要"顺便讲讲""另外还有一个"
5. 禁止虚假回忆：不能说"我们之前讲过""刚刚提到过""你还记得吗"来指代知识库内容或历史记忆中的内容。只有本次对话中你亲口说过的，才能用"刚才讲到"回顾

## 讲授方式（成人学习适配）
- 先讲"为什么重要"：说明这个知识在实际工作/生活中的应用场景
- 善用比喻和类比：把抽象概念和成人熟悉的事物联系起来
- 从具体到抽象：先举生活例子，再提炼概念，最后回到应用
- 讲清楚"来龙去脉"：这个知识是怎么来的、解决什么问题
- 点明"常见误区"：提醒成人学习者容易混淆或出错的地方

## 语言要求
- 绝对不用 Markdown 格式（# ** * - 代码块等）
- 不用编号列表，用"首先""然后""另外"连接
- 不用数学符号和公式，用文字描述（如"F等于m乘以a"而不是"F=ma"）
- 短句为主，一口气不超过20个字
- 书面语换口语：因此→所以、此外→还有、即→也就是、综上所述→总的来说
- 专业术语要解释：第一次出现时用通俗的话再讲一遍

## 领域约束
- 只回答与你专业领域和知识库内容相关的问题
- 超出专业范围时，礼貌说明并引导回你擅长的领域
- 不要装作什么都懂，坦诚说明自己的专业边界

## 开场白规则（仅首次对话时）
- 根据教师档案和知识库内容，做一个简短的自我介绍
- 说明你是谁、擅长教什么
- 提出2到3个围绕知识库中已有知识点的问题，激发学习兴趣
- 开场白控制在4到6句话以内，亲切自然

## 引导提问（仅在以下场景）
- 仅在学生首次登录（开场白）或不知道问什么时，才提出引导性问题
- 引导问题必须围绕知识库中已有的知识点，不要凭空编造
- 学生正在提问时，不要主动引导到其他方向，专注回答他的问题

## 图示辅助建议
只有当系统明确指示学生感到困惑时，你才在回复末尾加上这句话：
"我可以生成一张辅助图示来帮你理解，需要吗？"
- 不要主动建议生成图示，除非系统指示你这样做
- 不要在开场白中建议生成图示
- 如果学生说"不用"、"不需要"、"不要"等拒绝的话，绝对不要生成图示，继续讲解或回答学生的问题

## 知识点掌握验证（重要机制）
当学生表示"懂了""明白了""清楚了""理解了""会了""我知道了"等类似话语时，你必须通过小测试来验证是否真正掌握：
1. 出1到2道简单的小测试题，必须优先使用选择题形式（如"以下哪个说法正确？A... B... C..."）
2. 选择题让学生更容易回答，避免开放式问题让学生难以表述
3. 如果选择题难以设计，可以使用判断题或填空题
4. 语气要鼓励："太好了，那我来出一道小题考考你"
5. 学生回答正确：给予肯定并标记掌握
6. 学生回答错误：温和指出问题并重新讲解关键点
7. 只有测试通过才视为真正掌握

## 提问技巧（让学生容易回答）
- 向学生提问时，尽量提供选项，如"你觉得是A还是B？"、"你更倾向于哪种方式？第一种...还是第二种..."
- 避免问开放式问题如"你觉得呢"、"你怎么看"，学生会难以回答
- 引导性问题时给出明确选项，学生只需选择或简短回答即可
- 例如："你想先了解哪个？1. 基本概念 2. 实际应用 3. 常见误区"

始终用中文回答。`;

/** 构建包含教师档案的完整系统提示词 */
function buildSystemPrompt(profile?: TeacherProfile | null): string {
  if (!profile || (!profile.name && !profile.subjects && !profile.expertise)) {
    return BASE_SYSTEM_PROMPT;
  }

  const profileSection = `

## 你的教师档案（必须遵守）
- 姓名：${profile.name || 'AI智能助教'}
- 角色定位：${profile.title || '智能助教'}
- 专业领域：${profile.subjects || '综合学科'}
- 擅长方向：${profile.expertise || '根据知识库内容动态确定'}
- 教学风格：${profile.teachingStyle || '善于用生活例子解释抽象概念，喜欢追问式引导'}
${profile.guidingQuestions ? `- 常用引导问题：${profile.guidingQuestions}` : ''}

你必须严格按照以上档案信息定义自己的身份和专业范围。你的专业领域仅限于上述列出的方向，超出范围的提问请参照"领域约束"规则处理。`;

  return BASE_SYSTEM_PROMPT + profileSection;
}

export async function POST(request: NextRequest) {
  try {
    const {
      messages,
      useKnowledge = true,
      teacherProfile,
      isIntro = false,
      greetingType,
      student_id,
      session_id,
      student_info,
      needVisualization = false,
      teacher_id,
    } = await request.json();

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: '请提供对话消息' },
        { status: 400 }
      );
    }

    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);
    
    // 获取用户最新问题
    interface ChatMessage {
      role: 'user' | 'assistant' | 'system';
      content: string;
    }
    
    const lastUserMessage = (messages as ChatMessage[]).filter(m => m.role === 'user').pop();
    const userQuery = lastUserMessage?.content || '';

    // ====== 并行加载：教师档案 + 记忆检索 + 知识库搜索 ======
    // 原来3步串行，现在 Promise.all 并行 + 缓存，首token延迟减少200~500ms

    const teacherLoader = async (): Promise<{ profile: TeacherProfile | null; tableName: string }> => {
      if (teacherProfile) {
        return { profile: teacherProfile, tableName: 'coze_doc_knowledge' };
      }
      if (!teacher_id) return { profile: null, tableName: 'coze_doc_knowledge' };

      return cachedSWR(CacheKeys.teacher(teacher_id), 10 * 60 * 1000, async () => {
        try {
          const teacherRes = await fetch(`http://localhost:${process.env.DEPLOY_RUN_PORT || 5000}/api/teacher?teacherId=${encodeURIComponent(teacher_id)}`);
          if (teacherRes.ok) {
            const teacherData = await teacherRes.json();
            if (teacherData.success && teacherData.teacher) {
              const t = teacherData.teacher;
              return {
                profile: {
                  name: t.name,
                  title: t.title,
                  subjects: t.subjects,
                  expertise: t.expertise,
                  teachingStyle: t.teaching_style,
                  guidingQuestions: t.guiding_questions,
                },
                tableName: t.knowledge_table || 'coze_doc_knowledge',
              };
            }
          }
        } catch (e) {
          console.warn('[CHAT] 教师档案加载失败:', e);
        }
        return { profile: null, tableName: 'coze_doc_knowledge' };
      });
    };

    const memoryLoader = async (): Promise<string> => {
      if (!student_id) return '';
      return cachedSWR(CacheKeys.memoryRecall(student_id, teacher_id || 'teacher_default'), 5 * 60 * 1000, async () => {
        try {
          const memoryResponse = await fetch(`http://localhost:${process.env.DEPLOY_RUN_PORT || 5000}/api/memory/recall`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id, teacher_id: teacher_id || 'teacher_default', context: userQuery }),
          });
          if (memoryResponse.ok) {
            const memoryData = await memoryResponse.json();
            if (memoryData.success && memoryData.memory_summary) {
              console.log('[CHAT] 记忆上下文已加载', { student_id, summaryLen: memoryData.memory_summary.length });
              return memoryData.memory_summary;
            }
          }
        } catch (memErr) {
          console.warn('[CHAT] 记忆检索失败，继续对话:', memErr);
        }
        return '';
      });
    };

    const knowledgeLoader = async (tblName: string): Promise<string> => {
      if (!useKnowledge || !userQuery) return '';
      try {
        const knowledgeClient = new KnowledgeClient(config, customHeaders);

        if (isIntro) {
          const introSearches = [
            '数学 物理 化学 英语 语文 代数 牛顿 元素 词汇 阅读',
            '教师档案 专业 擅长 教学',
          ];
          const allChunks: { content: string; score?: number; doc_id?: string }[] = [];
          const seenDocIds = new Set<string>();

          for (const searchQuery of introSearches) {
            const cacheKey = CacheKeys.knowledgeSearch(tblName, searchQuery);
            const searchResponse = await cached(cacheKey, 10 * 60 * 1000, () =>
              knowledgeClient.search(searchQuery, [tblName], 8, 0.2)
            );
            if (searchResponse.code === 0 && searchResponse.chunks.length > 0) {
              for (const chunk of searchResponse.chunks) {
                const docKey = `${chunk.doc_id}-${chunk.content.slice(0, 50)}`;
                if (!seenDocIds.has(docKey)) {
                  seenDocIds.add(docKey);
                  allChunks.push(chunk);
                }
              }
            }
          }

          allChunks.sort((a, b) => (b.score || 0) - (a.score || 0));
          const topChunks = allChunks.slice(0, 8);

          if (topChunks.length > 0) {
            const result = topChunks
              .map((chunk, index) => `[相关资料 ${index + 1}]:\n${chunk.content}`)
              .join('\n\n');
            console.log('[CHAT] 开场白知识库搜索结果:', { totalChunks: allChunks.length, topChunks: topChunks.length });
            return result;
          }
        } else {
          const cacheKey = CacheKeys.knowledgeSearch(tblName, userQuery);
          const searchResponse = await cached(cacheKey, 10 * 60 * 1000, () =>
            knowledgeClient.search(userQuery, [tblName], 3, 0.4)
          );
          if (searchResponse.code === 0 && searchResponse.chunks.length > 0) {
            console.log('[CHAT] 知识库搜索结果:', { chunks: searchResponse.chunks.length, query: userQuery.slice(0, 30) });
            return searchResponse.chunks
              .map((chunk: { content: string; score?: number; doc_id?: string }, index: number) => `[相关资料 ${index + 1}]:\n${chunk.content}`)
              .join('\n\n');
          }
        }
      } catch (searchError) {
        console.warn('知识库搜索失败，继续对话:', searchError);
      }
      return '';
    };

    // 第一阶段：并行加载教师档案和记忆（知识库依赖表名，需等教师档案）
    const [teacherResult, memorySummary] = await Promise.all([
      teacherLoader(),
      memoryLoader(),
    ]);

    let effectiveTeacherProfile = teacherResult.profile;
    const effectiveTableName = teacherResult.tableName;

    // 第二阶段：知识库搜索（依赖表名）
    const knowledgeContext = await knowledgeLoader(effectiveTableName);

    const systemPrompt = buildSystemPrompt(effectiveTeacherProfile);

    // 构建知识库上下文的系统消息
    const knowledgeMessages: { role: 'system'; content: string }[] = [];
    if (isIntro) {
      // 使用前端传递的 greetingType 决定开场白策略
      // greetingType='recall': 老学生，基于记忆个性化问候
      // greetingType='intro' 或未指定: 新学生，自我介绍
      const isRecallGreeting = greetingType === 'recall';

      if (isRecallGreeting) {
        // 老学生：不需要自我介绍，基于记忆个性化问候
        knowledgeMessages.push({
          role: 'system',
          content: `这是你之前教过的学生，记忆信息已在上方给出。请根据记忆用亲切自然的语气打招呼：称呼学生名字，提到上次的学习内容或困惑，自然地引导继续学习。不要做自我介绍，不要重复介绍你的身份和擅长领域。控制在3到5句话以内。`
        });
      } else if (knowledgeContext) {
        // 新学生 + 有知识库内容：自我介绍
        knowledgeMessages.push({
          role: 'system',
          content: `以下是从教师知识库中检索到的全部资料内容。请务必基于这些资料做自我介绍：\n1. 说明你是谁、教什么科目\n2. 具体提到知识库中已有的学科和知识点（比如"我这里有数学代数、物理力学..."）\n3. 提出2到3个引导学生学习的问题\n4. 绝对不要说"还没有教学资料"——以下就是你的教学资料\n\n${knowledgeContext}`
        });
      } else {
        // 新学生 + 无知识库内容：根据档案自我介绍
        knowledgeMessages.push({
          role: 'system',
          content: `知识库搜索暂未返回结果，但你的教师档案信息已在上方系统提示中定义。请根据档案信息做自我介绍，说明你的专业领域和擅长方向，提出2到3个引导学生的问题。不要说"还没有教学资料"。`
        });
      }
    } else if (knowledgeContext) {
      knowledgeMessages.push({
        role: 'system',
        content: `以下是从教师知识库中找到的相关资料，请优先使用这些信息回答学生的问题。注意：这是你的教学参考资料，不是已经和学生讨论过的内容。不要说"我们之前讲过""刚刚提到过"来指代知识库中的内容，只有本次对话中你亲口讲过的才能这样说。\n\n${knowledgeContext}`
      });
    }

    // 构建记忆上下文的系统消息
    // 只有当学生确实有记忆（对话记录或知识掌握）时才注入，避免 LLM 对新学生编造内容
    const memoryMessages: { role: 'system'; content: string }[] = [];
    if (memorySummary) {
      // 只有当 greetingType='recall' 时，说明学生有实质记忆，才注入记忆上下文
      // 新学生只有画像信息，不需要注入（避免 LLM 编造内容）
      if (greetingType === 'recall') {
        memoryMessages.push({
          role: 'system',
          content: `以下是你对这位学生的记忆（从过往对话中积累），请严格遵守以下规则：
1. 记忆中的"近期学习记录"是历史对话的摘要，不是本次对话的内容。绝对不要说"刚刚讲过""我们之前讨论过""刚才提到的"来指代记忆中的内容
2. 知识掌握情况是从历史对话中推断的，不代表本次对话已经涉及。只有本次对话中你亲口讲过的内容，才能说"刚才讲到"
3. 已掌握的知识点绝对不要再重复讲解基础概念
4. 薄弱的知识点要重点讲解
5. 开场白时自然地叫出学生名字，打个招呼即可
6. 不要做自我介绍，不要重复介绍你的身份和擅长领域

${memorySummary}`
        });
      }
    }

    // 当学生表达困惑时，强化图示建议指令
    const visualizationMessages: { role: 'system'; content: string }[] = [];
    if (needVisualization) {
      visualizationMessages.push({
        role: 'system',
        content: `学生当前对某个概念感到困惑或不理解，你必须在回复末尾建议生成辅助图示："我可以生成一张辅助图示来帮你理解，需要吗？"`
      });
    }

    // 注入学生身份信息（仅在新对话开始时：开场白或老学生回访打招呼）
    // 后续对话中不需要重复叫名字，保持对话流畅自然
    const identityMessages: { role: 'system'; content: string }[] = [];
    if (isIntro && student_info?.name) {
      const identityParts: string[] = [];
      identityParts.push(`这位学生的姓名是：${student_info.name}`);
      if (student_info.grade) identityParts.push(`年级：${student_info.grade}`);
      identityParts.push('在开场白中称呼学生名字，自然地打招呼。');
      identityMessages.push({
        role: 'system',
        content: identityParts.join('\n')
      });
    }

    // 构建最终的消息数组
    const finalMessages = [
      { role: 'system', content: systemPrompt },
      ...knowledgeMessages,
      ...memoryMessages,
      ...identityMessages,
      ...visualizationMessages,
      ...messages,
    ];

    // 使用流式响应
    const stream = llmClient.stream(finalMessages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.7,
    });

    // 收集完整回复用于记忆更新
    let fullAssistantReply = '';

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              fullAssistantReply += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

          // ====== 记忆更新：对话结束后异步触发记忆分析 + 缓存失效 ======
          if (student_id && fullAssistantReply) {
            // 先失效记忆缓存，下次对话拿到最新数据
            appCache.deleteByPrefix(`memory:${student_id}:`);
            triggerMemoryUpdate(student_id, session_id, userQuery, fullAssistantReply, student_info, teacher_id).catch(err => {
              console.warn('[CHAT] 记忆更新触发失败:', err);
            });
          }
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('聊天错误:', error);
    return NextResponse.json(
      { error: '对话处理失败' },
      { status: 500 }
    );
  }
}

/**
 * 异步触发记忆更新（不阻塞响应）
 */
async function triggerMemoryUpdate(
  studentId: string,
  sessionId: string | undefined,
  userMessage: string,
  assistantMessage: string,
  studentInfo?: { name?: string; grade?: string; learning_style?: string } | undefined,
  teacherId?: string
): Promise<void> {
  try {
    const port = process.env.DEPLOY_RUN_PORT || 5000;
    const response = await fetch(`http://localhost:${port}/api/memory/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        teacher_id: teacherId || 'teacher_default',
        session_id: sessionId || null,
        user_message: userMessage,
        assistant_message: assistantMessage,
        student_info: studentInfo || null,
      }),
    });
    const result = await response.json();
    if (result.success) {
      console.log('[CHAT] 记忆更新成功', { updates: result.updates });
    } else {
      console.warn('[CHAT] 记忆更新返回失败:', result.error);
    }
  } catch (err) {
    console.warn('[CHAT] 记忆更新请求失败:', err);
  }
}
