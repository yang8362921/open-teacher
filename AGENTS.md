# AI数字教师项目文档

## 项目概述

基于教师个人知识库的智能语音交互教学机器人，支持数字教学（语音问答）、语音识别、语音合成、知识库管理、智能对话、真人照片数字人、教师引导式设置向导、智能助教开场白和**学生记忆系统**。采用温暖亲切风格UI设计（vintage-grey配色）。

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4 + 自定义温暖亲切主题 (vintage-grey色调, vintage阴影, classic字体)
- **AI 集成**: coze-coding-dev-sdk (LLM、ASR、TTS、知识库)
- **数据库**: Supabase (学生记忆系统持久化)

## 核心功能

### 1. 数字教学模式（语音问答）
- **文件位置**: `src/app/page.tsx`
- **功能**: 基于 Web Audio API 的持续监听和实时音频分析
- **特点**:
  - 持久化麦克风管道：通话期间 AudioContext + AnalyserNode + GainNode + ScriptProcessorNode 始终运行
  - **回声防护策略：speaking 状态静音麦克风**：TTS 播放期间将 gainNode.gain.value 设为 0，彻底杜绝回声被当作用户输入。这是唯一可靠的方案——浏览器标签页中的 AEC 无法正确处理 AudioContext 播放的音频，ASR 也会将回声语音识别为文字导致误触。
  - VAD 仅在 listening 状态检测语音，speaking/processing 状态只读取 refAnalyser 做口型同步
  - **手动打断**：speaking 状态显示醒目的停止按钮（带脉冲动画），用户点击后停止 TTS、恢复麦克风增益、切回 listening
  - **参考信号路径（口型同步）**：TTS 音频通过代理获取并在主 AudioContext 播放，接入参考信号路径（`AudioBufferSourceNode → refGain → refAnalyser → destination`），refAnalyser 用于口型同步动画
  - **TTS 预解码**：`speakSentence` 在获取 TTS URI 后立即通过代理 fetch + decodeAudioData 预解码为 AudioBuffer，存储在队列中；`playQueue` 直接播放 AudioBuffer，消除段间代理延迟，实现无缝播放
  - PCM 直采 + WAV 转换：使用 ScriptProcessorNode 捕获原始 PCM 数据，转换为 WAV 发送给 ASR
  - 自动语音结束检测（静音超时触发）、连续对话、音量指示器
  - TTS 文本预处理：自动去除 Markdown 格式，确保语音播报自然流畅
  - 首轮灵敏度优化：noiseFloor 初始值 3，校准使用 25 分位数，listening 阈值倍率 1.3x（sensitivity=3）
- **关键技术**:
  - 所有回调通过 ref 读取最新状态（`voiceSettingsRef`、`callStateRef` 等），保持引用稳定避免闭包陷阱
  - `pendingTTSCountRef` + `llmStreamDoneRef`：防止 LLM 结束但 TTS 还在飞行中时过早切回 listening（含预解码阶段）
  - `abortControllerRef`：取消进行中的 fetch 请求
  - `ttsSessionIdRef`：TTS 会话 ID，手动打断或停止时递增，使飞行中的 TTS 响应自动失效
  - `ttsSeqRef`/`ttsNextPlayRef`/`ttsResultMapRef`：有序 TTS 队列（存储 `AudioBuffer | string`），确保语音严格按文字顺序播放
  - PCM 预缓冲（8 块 ≈ 680ms）+ 捕获缓冲，确保不漏词
  - WAV 格式确保 ASR 服务能可靠解码（避免 webm 缺容器头问题）

### 2. 智能对话 (LLM + 知识库)
- **文件位置**: `src/app/api/chat/route.ts`
- **功能**: 基于教师知识库的智能问答，支持流式输出
- **特点**: 自动检索相关知识库内容，结合大语言模型生成回答
- **口语化**: 系统提示词引导 LLM 以口语化方式回答，不使用 Markdown 格式，适合语音播报

### 3. 语音识别 (ASR)
- **文件位置**: `src/app/api/audio/asr/route.ts`
- **功能**: 将语音转换为文字
- **支持**: URL 或 base64 编码的音频数据（推荐 WAV 格式）
- **容错**: 区分"无语音"和"格式错误"，无语音时返回 `{success:false, reason:"no_speech"}` 而非 500

### 4. 语音合成 (TTS)
- **文件位置**: `src/app/api/audio/tts/route.ts`
- **功能**: 将文字转换为语音
- **支持**: 多种音色（男/女教师）、音频格式和语速调节
- **容错**: speaker 白名单验证，失败自动回退默认 speaker

### 5. 知识库管理
- **添加文档**: `src/app/api/knowledge/add/route.ts`
- **上传文件**: `src/app/api/knowledge/upload/route.ts`
- **搜索文档**: `src/app/api/knowledge/search/route.ts`
- **功能**: 支持文本输入、文件上传（.txt/.md/.csv/.json/.html/.xml）、URL 导入、语义搜索
- **统一表名**: 默认使用 `coze_doc_knowledge`，搜索时兼容旧表 `teacher_knowledge_base`
- **教师档案**: 可一键添加教师专业档案模板，定义助教的专业范围

### 6. 数字人与语音设置
- **数字人组件**: `src/components/DigitalHuman.tsx` - 真人照片+口型同步
- **设置组件**: `src/components/VoiceSettings.tsx` - 声音选择、语速音量、头像和嘴巴位置
- **持久化**: 设置保存到 localStorage，刷新页面不丢失

### 7. 教师引导式设置向导与管理面板
- **档案编辑**: `src/components/KnowledgeManager.tsx` - 教师档案编辑表单
- **管理面板**: `src/components/TeacherDashboard.tsx` - 教师管理中心
- **设置向导**: 新教师首次登录进入4步引导设置（Step 1: 基本信息→Step 2: 授课风格→Step 3: 上传数字人头像→Step 4: 初始化知识库）
- **管理面板 Tab**: 助教档案（编辑/查看）| 知识库（添加/上传/搜索）| 学生记忆（列表+详情）
- **头像上传**: `src/app/api/teacher/avatar/route.ts` - 使用 S3Storage 上传头像，数据库存 avatar_key（S3 key），动态生成签名 URL
- **设置完成标志**: `is_setup_complete` 字段，完成后学生在登录页才可见该助教
- **快速模板**: 物理教师/数学教师/英语教师/AI计算机教师预设档案
- **数据流**: 档案保存到数据库 → 学生选择时展示头像+简介 → 对话时注入系统提示词

### 8. 学生记忆系统
- **记忆检索 API**: `src/app/api/memory/recall/route.ts` - 对话前检索学生画像、知识掌握、对话历史、教学策略（按 teacher_id 隔离）
- **记忆更新 API**: `src/app/api/memory/update/route.ts` - 对话结束后 LLM 自动分析对话内容，提取记忆信息写入数据库（按 teacher_id 隔离）
- **学生画像 API**: `src/app/api/memory/profile/route.ts` - 学生画像的 CRUD 管理（按 teacher_id 隔离）
- **学生身份组件**: `src/components/StudentIdentity.tsx` - 学生身份管理和画像编辑
- **学习记忆面板**: `src/components/KnowledgeManager.tsx` 内的 MemoryPanel - 查看学习记忆
- **数据库表**:
  - `teacher_profile` - 教师档案（姓名、科目、专业、教学风格、声音设置、知识库表名）
  - `student_profile` - 学生画像（含 teacher_id，同一学生在不同教师下有独立画像）
  - `knowledge_mastery` - 知识掌握追踪（含 teacher_id，按教师隔离）
  - `conversation_log` - 对话记录（含 teacher_id，按教师隔离）
  - `teaching_strategy` - 教学策略记忆（含 teacher_id，按教师隔离）
- **知识掌握评价机制**:
  - mastery_level 三档分类：已掌握(>=0.6)、学习中(0.3~0.5)、薄弱(<0.3)
  - 已掌握：不重复讲解基础概念，可进阶讨论
  - 学习中：有了解但未完全掌握，需巩固和补充，不需从零开始
  - 薄弱：理解困难，需重点讲解，放慢节奏，用直观方式
  - 已废弃 needs_review 字段，完全由 mastery_level 数值驱动分类
  - mastered 更新策略：通过验证测试后直接设为 0.8，清空 weak_points，设置 strong_points
  - practice 更新策略：+0.1（上限 0.6，不超过"已掌握"阈值）
  - confused 更新策略：-0.1（下限 0）
  - 知识点模糊匹配与自动合并：精确匹配 → subtopic 关键词匹配 → topic+subtopic 全文关键词匹配，找到重复记录后自动合并删除
  - 重复记录检测：匹配到最佳记录后，扫描所有同 topic 或 subtopic 关键词重叠的记录作为重复，合并 practice_count 后删除
  - LLM 分析提示词：严格区分 mastered（通过测试）/ practice（说懂了但没测试）/ confused（困惑或答错）
- **记忆摘要格式**:
  - 三档分类：已掌握、学习中、薄弱，每档附带精确交互规则
  - 已掌握项包含 strong_points，学习中/薄弱项包含 weak_points
  - 每个知识点只出现一次，不会在多个分类中重复
  - 记忆注入时附带明确的规则指令（不重复已掌握、重点讲薄弱等）
  - 教学策略去重：相同方法名只保留一条
- **交互逻辑规则**（系统提示词）:
  - 只解答用户提出的问题，适当延伸但不转移话题
  - 已掌握的知识点不再重复讲解基础概念
  - 引导提问仅在首次登录或学生没提问时，围绕知识库知识点
  - 学生说"懂了"必须出验证测试，通过才标记 mastered
  - 学生姓名仅在开场白时称呼一次，后续对话保持自然流畅，不重复叫名字
- **工作流程**:
  1. 对话前：Chat API 调用 `/api/memory/recall` 获取记忆摘要，注入系统提示词
  2. 对话中：AI 根据记忆个性化回复（使用学生喜欢的讲解方式、避免重复、针对薄弱点重点讲解）
  3. 对话后：Chat API 异步调用 `/api/memory/update`，LLM 分析对话提取知识点掌握度、教学策略、学生画像
- **学生身份**: 基于 name+teacherId 哈希生成稳定 student_id 并持久化到 localStorage，同一学生在不同教师下有不同 studentId，每次通话生成 session_id
- **记忆应用**: 记忆摘要以 system 消息形式注入对话上下文，指导 AI 个性化回复

### 9. 教师与助教关联
- **教师档案表**: `teacher_profile`（含 id, name, password, title, subjects, expertise, teaching_style, guiding_questions, avatar_url, avatar_key, knowledge_table, is_setup_complete）
- **知识库隔离**: 每个教师有独立的知识库表（表名 = 教师ID，如 `teacher_张三`），知识添加/搜索/对话都使用各自专属表
- **头像存储**: 使用 S3Storage 上传头像图片，数据库存 avatar_key（S3 key），使用时通过 generatePresignedUrl 生成签名 URL
- **设置向导**: 新教师 `is_setup_complete=false`，登录后进入4步引导设置，完成后 `is_setup_complete=true`
- **学生可见性**: 教师列表 API 仅返回 `is_setup_complete=true` 的教师，确保学生只看到已配置好的助教
- **知识库隔离**: 每个教师有独立的知识库表（表名 = 教师ID），Chat API 根据教师档案自动使用对应表
- **档案同步**: 登录时从服务端加载教师档案到前端（teacherProfile + avatar → 数字人头像）
- **对话API**: Chat API 接收 teacher_id 参数，自动从数据库加载教师档案和知识库表名

### 10. 管理员后台
- **管理员表**: `admin_account`（含 id, username, password, created_at）
- **默认账号**: admin / admin123（首次部署自动创建）
- **教师管理**: 创建/编辑/删除教师账号，设置用户名密码，启用/禁用账号
- **学生管理**: 查看所有学生，启用/禁用/删除学生账号
- **权限控制**: 
  - 教师登录需验证账号存在且 is_enabled=true
  - 学生登录时检查是否被禁用
  - 学生选择助教时只显示 is_enabled=true 且 is_setup_complete=true 的教师
- **数据隔离**: 删除教师时级联删除其所有学生数据（知识掌握、对话记录、教学策略）

## 目录结构

```
├── public/
│   └── teacher-avatar.jpg       # 默认真人头像
├── public/
│   └── ai-teacher-avatar.png   # 默认AI数字教师头像
├── scripts/                     # 构建与启动脚本
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── audio/
│   │   │   │   ├── asr/route.ts    # 语音识别 API
│   │   │   │   ├── tts/route.ts    # 语音合成 API
│   │   │   │   └── proxy/route.ts  # 音频代理 API（解决 CORS，支持回声消除）
│   │   │   ├── chat/route.ts       # 对话聊天 API
│   │   │   ├── image/
│   │   │   │   ├── design/route.ts   # 图示设计 API（LLM 分析概念生成专业 prompt）
│   │   │   │   └── generate/route.ts # 图片生成 API
│   │   │   ├── knowledge/
│   │   │   │   ├── add/route.ts     # 添加知识库文档（文本/URL）
│   │   │   │   ├── upload/route.ts  # 上传文件到知识库（FormData）
│   │   │   │   └── search/route.ts  # 搜索知识库
│   │   │   └── memory/
│   │   │       ├── recall/route.ts  # 记忆检索（对话前加载记忆上下文，按 teacher_id 隔离）
│   │   │       ├── update/route.ts  # 记忆更新（LLM 分析对话后写入，按 teacher_id 隔离）
│   │   │       └── profile/route.ts # 学生画像管理 CRUD（按 teacher_id 隔离）
│   │   ├── teacher/
│   │   │   ├── route.ts            # 教师管理 API（登录、档案、学生列表、学生详情）
│   │   │   └── avatar/route.ts     # 教师头像上传 API（S3Storage + 签名URL）
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx              # 主页面（数字教学+文字对话）
│   ├── components/
│   │   ├── DigitalHuman.tsx      # 数字人组件（真人照片+口型同步）
│   │   ├── VoiceSettings.tsx     # 声音与数字人设置
│   │   ├── KnowledgeManager.tsx  # 知识库管理+学习记忆面板
│   │   ├── StudentIdentity.tsx   # 学生身份管理组件
│   │   ├── StudentMemoryPanel.tsx # 学生学习记忆面板
│   │   ├── TeacherDashboard.tsx  # 教师管理中心（设置向导+档案+知识库+学生记忆）
│   │   ├── AdminDashboard.tsx    # 管理员后台（教师/学生管理+账号启用禁用）
│   │   ├── LoginOverlay.tsx      # 登录页（学生选择助教含头像+简介/教师登录/管理员入口）
│   │   └── ui/                   # Shadcn UI 组件库
│   ├── hooks/
│   ├── lib/
│   │   └── utils.ts
│   └── server.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 快速开始

### 初始化知识库

项目包含预置的教学示例资料，可以通过界面上的"添加示例教学资料"按钮快速初始化知识库。

示例资料包括：
- 数学教学要点 - 代数基础
- 物理教学 - 牛顿运动定律
- 语文教学 - 现代文阅读技巧
- 英语教学 - 词汇记忆方法
- 化学教学 - 元素周期表

### 使用流程

1. **管理员创建教师账号**：管理员登录后台（默认账号 admin/admin123），创建教师账号并设置用户名密码
2. **教师登录设置**：教师使用管理员分配的账号登录，首次登录进入设置向导（4步引导），完成后生成数字助教
3. **管理面板**: 设置完成后进入管理面板（可继续编辑档案、管理知识库、查看学生记忆）
4. **学生登录**: 输入姓名，选择助教（展示头像、名称、科目简介），开始学习
5. **数字教学**: 点击电话按钮开始语音交互
6. **语音交互**: 对着麦克风说话，AI 自动检测并回应
7. **文字对话**: 在输入框输入问题
8. **管理员管理**: 管理员可随时启用/禁用/删除教师和学生账号

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

### 状态管理关键模式（Ref 同步模式）

为避免 `useCallback` 闭包捕获旧状态值的问题，采用 **ref 同步模式**：
- 所有需要跨回调共享的状态都创建对应的 ref（如 `voiceSettingsRef`、`isCallActiveRef`、`messagesRef`）
- 在渲染阶段直接赋值同步：`voiceSettingsRef.current = voiceSettings`
- 回调内部通过 `ref.current` 读取最新值，保持引用稳定
- **禁止** `useRef(fn) + useEffect` 模式（React 19 immutability lint 规则不允许）

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。**必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染**；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. **禁止使用 head 标签**，优先使用 metadata

### AI 集成规范

- **后端调用**: coze-coding-dev-sdk 必须在后端 API 路由中使用，禁止在客户端代码中直接调用
- **Header 转发**: 必须使用 HeaderUtils.extractForwardHeaders 转发请求头
- **流式输出**: 对话 API 默认使用流式输出，通过 SSE 协议传输
- **错误处理**: 所有 API 调用都需要包含 try-catch 错误处理

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**

## API 接口清单

| 接口 | 方法 | 路径 | 功能 |
|------|------|------|------|
| 语音识别 | POST | /api/audio/asr | 将语音转换为文字 |
| 语音合成 | POST | /api/audio/tts | 将文字转换为语音（支持 speaker 参数） |
| 音频代理 | GET | /api/audio/proxy | 代理外部 TTS URL（解决 CORS，支持参考信号回声消除） |
| 智能对话 | POST | /api/chat | 基于知识库的智能问答 |
| 添加文档 | POST | /api/knowledge/add | 添加文本或 URL 文档到知识库 |
| 上传文件 | POST | /api/knowledge/upload | 上传文件到知识库（FormData，≤5MB） |
| 搜索文档 | POST | /api/knowledge/search | 在知识库中搜索内容 |
| 记忆检索 | POST | /api/memory/recall | 检索学生画像、知识掌握、对话历史、教学策略（按 teacher_id 隔离） |
| 记忆更新 | POST | /api/memory/update | LLM 分析对话内容，提取并写入记忆（异步，按 teacher_id 隔离） |
| 学生画像 | GET/POST/DELETE | /api/memory/profile | 学生画像的增删改查（按 teacher_id 隔离） |
| 教师管理 | POST | /api/teacher | 教师登录、更新档案、学生列表、学生详情 |
| 教师信息 | GET | /api/teacher | 获取教师列表（仅已设置完成的）或单个教师信息 |
| 教师头像 | GET/POST | /api/teacher/avatar | 获取头像签名URL / 上传头像（S3Storage） |
| 管理员后台 | GET/POST | /api/admin | 管理员登录、教师/学生管理、账号启用/禁用 |
| 图示设计 | POST | /api/image/design | LLM 分析概念生成专业图示 prompt |
| 图片生成 | POST | /api/image/generate | 根据图示 prompt 生成图片 |
