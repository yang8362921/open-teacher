'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, BookOpen, Users, Settings, ChevronRight, ChevronLeft, Check, Plus, X, FileText, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TeacherProfile {
  id: string;
  name: string;
  title: string | null;
  subjects: string | null;
  expertise: string | null;
  teaching_style: string | null;
  guiding_questions: string | null;
  voice_speaker: string;
  voice_speed: number;
  voice_volume: number;
  avatar_url: string | null;
  avatar_key: string | null;
  knowledge_table: string;
  is_setup_complete: boolean | null;
}

interface StudentSummary {
  student_id: string;
  name: string | null;
  grade: string | null;
  main_subjects: string | null;
  total_conversations: number;
  updated_at: string;
  knowledge_summary: {
    mastered: number;
    learning: number;
    weak: number;
    details: {
      mastered: { topic: string; subtopic: string | null; strong_points: string | null }[];
      learning: { topic: string; subtopic: string | null; weak_points: string | null }[];
      weak: { topic: string; subtopic: string | null; weak_points: string | null }[];
    };
  };
}

interface StudentDetail {
  profile: Record<string, unknown> | null;
  knowledge_mastery: Record<string, unknown>[];
  conversations: Record<string, unknown>[];
  strategies: Record<string, unknown>[];
}

interface TeacherDashboardProps {
  teacherId: string;
  teacherName: string;
  onLogout: () => void;
  onStartTeaching: () => void;
  onProfileSaved?: (profile: TeacherProfile) => void;
}

type WizardStep = 0 | 1 | 2 | 3;
type ManagementTab = 'profile' | 'knowledge' | 'digital-human' | 'students';

const QUICK_TEMPLATES = [
  {
    label: '物理教师',
    title: '物理助教',
    subjects: '物理',
    expertise: '力学、电磁学、光学、热学',
    teaching_style: '用生活中的物理现象引入概念，通过实验思维帮助学生理解抽象原理，注重物理直觉的培养',
    guiding_questions: '你对物理的哪个领域最感兴趣？\n你觉得物理和日常生活有什么联系？\n有没有什么物理现象让你特别好奇？',
  },
  {
    label: '数学教师',
    title: '数学助教',
    subjects: '数学',
    expertise: '代数、几何、微积分、概率统计',
    teaching_style: '从具体问题出发，逐步抽象到一般规律，鼓励学生多动手练习，用图形辅助理解抽象概念',
    guiding_questions: '你在数学学习中觉得哪部分最有挑战？\n你喜欢用图形来理解数学问题吗？\n有没有什么数学定理让你印象深刻？',
  },
  {
    label: '英语教师',
    title: '英语助教',
    subjects: '英语',
    expertise: '词汇语法、阅读理解、听力口语、写作翻译',
    teaching_style: '创设真实语境，通过对话和场景练习巩固知识点，注重语感培养和实际应用',
    guiding_questions: '你学英语最想提高哪个方面？\n你有看英文电影或听英文歌的习惯吗？\n你觉得英语学习中最大的困难是什么？',
  },
  {
    label: 'AI/计算机教师',
    title: 'AI智能助教',
    subjects: '人工智能、计算机科学',
    expertise: '机器学习、深度学习、自然语言处理、计算机视觉、Python编程',
    teaching_style: '用通俗的语言和生动的实例来解释技术概念，让抽象的技术变得易懂实用，善于类比生活场景',
    guiding_questions: '你想了解人工智能的哪些方面？\n在工作中遇到过哪些与AI相关的问题？\n你希望AI能帮你解决什么问题？',
  },
];

export default function TeacherDashboard({ teacherId, teacherName, onLogout, onStartTeaching, onProfileSaved }: TeacherDashboardProps) {
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 设置向导状态
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [isWizardMode, setIsWizardMode] = useState(false);

  // 管理面板 tab
  const [activeTab, setActiveTab] = useState<ManagementTab>('profile');
  const [editing, setEditing] = useState(false);

  // 表单字段
  const [formTitle, setFormTitle] = useState('');
  const [formSubjects, setFormSubjects] = useState('');
  const [formExpertise, setFormExpertise] = useState('');
  const [formTeachingStyle, setFormTeachingStyle] = useState('');
  const [formGuidingQuestions, setFormGuidingQuestions] = useState('');

  // 头像上传
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 知识库管理
  const [knowledgeText, setKnowledgeText] = useState('');
  const [knowledgeUrl, setKnowledgeUrl] = useState('');
  const [knowledgeUploading, setKnowledgeUploading] = useState(false);
  const [knowledgeSearchQuery, setKnowledgeSearchQuery] = useState('');
  const [knowledgeSearchResults, setKnowledgeSearchResults] = useState<{ content: string; score: number }[]>([]);
  const [knowledgeSearching, setKnowledgeSearching] = useState(false);
  const knowledgeFileRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/teacher?teacherId=${encodeURIComponent(teacherId)}`);
      const data = await res.json();
      if (data.success && data.teacher) {
        const p = data.teacher as TeacherProfile;
        setProfile(p);
        setFormTitle(p.title || '');
        setFormSubjects(p.subjects || '');
        setFormExpertise(p.expertise || '');
        setFormTeachingStyle(p.teaching_style || '');
        setFormGuidingQuestions(p.guiding_questions || '');
        setAvatarPreview(p.avatar_url || null);

        // 判断是否需要设置向导
        if (!p.is_setup_complete) {
          setIsWizardMode(true);
          setWizardStep(0);
        }
      }
    } catch (e) {
      console.error('加载教师档案失败:', e);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'students', teacherId }),
      });
      const data = await res.json();
      if (data.success) {
        setStudents(data.students || []);
      }
    } catch (e) {
      console.error('加载学生列表失败:', e);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (activeTab === 'students') loadStudents();
  }, [activeTab, loadStudents]);

  // 保存档案
  const handleSaveProfile = async (markComplete = false) => {
    setSaving(true);
    try {
      const updateBody: Record<string, unknown> = {
        action: 'update',
        teacherId,
        title: formTitle,
        subjects: formSubjects,
        expertise: formExpertise,
        teaching_style: formTeachingStyle,
        guiding_questions: formGuidingQuestions,
      };
      if (markComplete) {
        updateBody.is_setup_complete = true;
      }
      const res = await fetch('/api/teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      const data = await res.json();
      if (data.success) {
        const p = data.teacher as TeacherProfile;
        setProfile(p);
        setEditing(false);
        onProfileSaved?.(p);
        toast.success(markComplete ? '设置完成，助教已就绪' : '档案保存成功');
      } else {
        toast.error('保存失败', { description: data.error || '请重试' });
      }
    } catch (e) {
      console.error('保存失败:', e);
      toast.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 头像上传
  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('teacherId', teacherId);
      const res = await fetch('/api/teacher/avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setAvatarPreview(data.avatar_url);
        setProfile(prev => prev ? { ...prev, avatar_url: data.avatar_url, avatar_key: data.avatar_key } : prev);
        toast.success('头像上传成功');
      } else {
        toast.error('头像上传失败', { description: data.error || '请重试' });
      }
    } catch (e) {
      console.error('头像上传失败:', e);
      toast.error('头像上传失败，请重试');
    } finally {
      setAvatarUploading(false);
    }
  };

  // 知识库操作
  const getKnowledgeTableName = () => {
    // 优先使用 profile 中的 knowledge_table
    if (profile?.knowledge_table) return profile.knowledge_table;
    // 兜底：根据 teacherId 生成
    return `kb_${teacherId}`;
  };

  const handleAddKnowledge = async (type: 'text' | 'url') => {
    setKnowledgeUploading(true);
    try {
      const tableName = getKnowledgeTableName();
      if (type === 'text' && knowledgeText.trim()) {
        const res = await fetch('/api/knowledge/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: knowledgeText.trim(), tableName }),
        });
        const data = await res.json();
        if (data.success) {
          setKnowledgeText('');
          toast.success('文本添加成功', { description: '教学资料已加入知识库' });
        } else {
          toast.error('添加失败', { description: data.error || '请检查内容后重试' });
        }
      } else if (type === 'url' && knowledgeUrl.trim()) {
        const res = await fetch('/api/knowledge/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: knowledgeUrl.trim(), tableName }),
        });
        const data = await res.json();
        if (data.success) {
          setKnowledgeUrl('');
          toast.success('链接添加成功', { description: '网页内容已导入知识库' });
        } else {
          toast.error('添加失败', { description: data.error || '请检查链接后重试' });
        }
      }
    } catch (e) {
      console.error('添加知识失败:', e);
      toast.error('添加失败，请重试');
    } finally {
      setKnowledgeUploading(false);
    }
  };

  const handleUploadKnowledgeFile = async (file: File) => {
    setKnowledgeUploading(true);
    try {
      const tableName = getKnowledgeTableName();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tableName', tableName);
      const res = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success('文件上传成功', { description: `"${data.fileName || file.name}" 已加入知识库` });
      } else {
        toast.error('上传失败', { description: data.error || '请检查文件后重试' });
      }
    } catch (e) {
      console.error('上传知识文件失败:', e);
      toast.error('上传失败，请重试');
    } finally {
      setKnowledgeUploading(false);
    }
  };

  const handleSearchKnowledge = async () => {
    if (!knowledgeSearchQuery.trim()) return;
    setKnowledgeSearching(true);
    try {
      const tableName = getKnowledgeTableName();
      const res = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: knowledgeSearchQuery.trim(), tableName }),
      });
      const data = await res.json();
      if (data.success) {
        setKnowledgeSearchResults(data.results || []);
      }
    } catch (e) {
      console.error('搜索失败:', e);
    } finally {
      setKnowledgeSearching(false);
    }
  };

  // 查看学生详情
  const handleViewStudent = async (student: StudentSummary) => {
    setSelectedStudentName(student.name || student.student_id);
    try {
      const res = await fetch('/api/teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'student_detail', teacherId, studentId: student.student_id }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedStudent(data.detail);
      }
    } catch (e) {
      console.error('加载学生详情失败:', e);
    }
  };

  // 快速模板
  const applyTemplate = (t: typeof QUICK_TEMPLATES[number]) => {
    setFormTitle(t.title);
    setFormSubjects(t.subjects);
    setFormExpertise(t.expertise);
    setFormTeachingStyle(t.teaching_style);
    setFormGuidingQuestions(t.guiding_questions);
  };

  const masteryPercent = (level: unknown) => Math.round((level as number) * 100);
  const masteryColor = (level: unknown) => {
    const v = level as number;
    if (v >= 0.6) return 'text-green-600';
    if (v >= 0.3) return 'text-amber-600';
    return 'text-red-500';
  };
  const masteryBarColor = (level: unknown) => {
    const v = level as number;
    if (v >= 0.6) return 'bg-green-500';
    if (v >= 0.3) return 'bg-amber-500';
    return 'bg-red-500';
  };

  // ============ 设置向导 ============
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  if (isWizardMode) {
    const WIZARD_STEPS = ['基本信息', '授课风格', '数字人形象', '知识库初始化'];
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* 顶部进度条 */}
        <div className="border-b border-border bg-card">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-bold text-foreground">创建你的数字助教</h1>
            <span className="text-xs text-muted-foreground">开放智慧助教</span>
              <span className="text-sm text-muted-foreground">{wizardStep + 1} / {WIZARD_STEPS.length}</span>
            </div>
            <div className="flex gap-2">
              {WIZARD_STEPS.map((label, i) => (
                <div key={i} className="flex-1">
                  <div className={`h-1.5 rounded-full transition-colors ${
                    i <= wizardStep ? 'bg-primary' : 'bg-muted/30'
                  }`} />
                  <p className={`text-xs mt-1 transition-colors ${
                    i <= wizardStep ? 'text-primary' : 'text-muted-foreground'
                  }`}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            {/* Step 0: 基本信息 */}
            {wizardStep === 0 && (
              <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-lg">
                <h2 className="text-xl font-bold text-foreground mb-2">基本信息</h2>
                <p className="text-sm text-muted-foreground mb-6">设置你的助教身份和教授科目</p>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">助教称呼</label>
                    <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="如：AI物理助教、王老师的数学课堂" className="rounded-lg h-11" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">教授科目</label>
                    <Input value={formSubjects} onChange={e => setFormSubjects(e.target.value)} placeholder="如：物理、数学、英语" className="rounded-lg h-11" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">专业领域</label>
                    <textarea value={formExpertise} onChange={e => setFormExpertise(e.target.value)} placeholder="如：力学、电磁学、光学" rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>

                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-2">快速模板：</p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_TEMPLATES.map(t => (
                        <button key={t.label} onClick={() => applyTemplate(t)} className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-colors">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-8">
                  <Button onClick={() => setWizardStep(1)} disabled={!formTitle.trim()} className="rounded-lg px-6">
                    下一步 <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 1: 授课风格 */}
            {wizardStep === 1 && (
              <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-lg">
                <h2 className="text-xl font-bold text-foreground mb-2">授课风格</h2>
                <p className="text-sm text-muted-foreground mb-6">定义助教的教学方式和引导问题</p>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">教学风格</label>
                    <textarea value={formTeachingStyle} onChange={e => setFormTeachingStyle(e.target.value)} placeholder="如：善于用生活例子解释抽象概念，循循善诱，注重理解而非记忆" rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">开场引导问题</label>
                    <textarea value={formGuidingQuestions} onChange={e => setFormGuidingQuestions(e.target.value)} placeholder="学生首次对话时，助教提出的问题，每行一个" rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    <p className="text-xs text-muted-foreground mt-1">这些问题将帮助助教在首次对话时引导学生</p>
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <Button onClick={() => setWizardStep(0)} variant="outline" className="rounded-lg px-6">
                    <ChevronLeft className="w-4 h-4 mr-1" /> 上一步
                  </Button>
                  <Button onClick={() => setWizardStep(2)} disabled={!formTeachingStyle.trim()} className="rounded-lg px-6">
                    下一步 <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: 数字人形象 */}
            {wizardStep === 2 && (
              <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-lg">
                <h2 className="text-xl font-bold text-foreground mb-2">数字人形象</h2>
                <p className="text-sm text-muted-foreground mb-6">上传一张照片作为数字助教的形象</p>

                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-xl p-5 sm:p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    {avatarPreview ? (
                      <div className="flex flex-col items-center gap-3">
                        <img src={avatarPreview} alt="头像预览" className="w-32 h-32 rounded-full object-cover border-4 border-primary/20" />
                        <p className="text-sm text-muted-foreground">点击更换头像</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center">
                          <Upload className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">点击上传头像</p>
                          <p className="text-xs text-muted-foreground">支持 JPG/PNG/GIF/WebP，最大 5MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarUpload(file);
                    }}
                  />
                  {avatarUploading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> 上传中...
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">也可以在完成设置后随时更换头像</p>
                </div>

                <div className="flex justify-between mt-8">
                  <Button onClick={() => setWizardStep(1)} variant="outline" className="rounded-lg px-6">
                    <ChevronLeft className="w-4 h-4 mr-1" /> 上一步
                  </Button>
                  <Button onClick={() => setWizardStep(3)} className="rounded-lg px-6">
                    下一步 <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: 知识库初始化 */}
            {wizardStep === 3 && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
                <h2 className="text-lg font-bold text-foreground mb-1">知识库初始化</h2>
                <p className="text-xs text-muted-foreground mb-4">为你的助教添加教学资料，让学生获得更专业的回答</p>

                <div className="space-y-3">
                  {/* 添加文本 */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">添加教学文本</label>
                    <textarea
                      value={knowledgeText}
                      onChange={e => setKnowledgeText(e.target.value)}
                      placeholder="粘贴教学资料内容..."
                      rows={2}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <Button
                      onClick={() => handleAddKnowledge('text')}
                      disabled={!knowledgeText.trim() || knowledgeUploading}
                      size="sm"
                      variant="outline"
                      className="mt-1.5 rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> 添加文本
                    </Button>
                  </div>

                  {/* 添加 URL */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">添加网页链接</label>
                    <div className="flex gap-2">
                      <Input
                        value={knowledgeUrl}
                        onChange={e => setKnowledgeUrl(e.target.value)}
                        placeholder="https://example.com/article"
                        className="rounded-lg flex-1 h-9 text-sm"
                      />
                      <Button
                        onClick={() => handleAddKnowledge('url')}
                        disabled={!knowledgeUrl.trim() || knowledgeUploading}
                        size="sm"
                        variant="outline"
                        className="rounded-lg h-9 px-3"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* 上传文件 */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">上传文件</label>
                    <div
                      onClick={() => knowledgeFileRef.current?.click()}
                      className="border border-dashed border-border rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      <FileText className="w-4 h-4 mx-auto text-muted-foreground mb-0.5" />
                      <p className="text-xs text-muted-foreground">点击上传 .txt / .md / .csv / .json / .html / .xml / .docx / .pdf</p>
                    </div>
                    <input
                      ref={knowledgeFileRef}
                      type="file"
                      accept=".txt,.md,.csv,.json,.html,.xml,.docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadKnowledgeFile(file);
                      }}
                    />
                    {knowledgeUploading && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> 处理中...
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">可以在完成设置后继续添加更多教学资料</p>
                </div>

                <div className="flex justify-between mt-5">
                  <Button onClick={() => setWizardStep(2)} variant="outline" size="sm" className="rounded-lg">
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" /> 上一步
                  </Button>
                  <Button
                    onClick={async () => {
                      await handleSaveProfile(true);
                      setIsWizardMode(false);
                    }}
                    disabled={saving}
                    size="sm"
                    className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {saving ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> 创建中...</>
                    ) : (
                      <><Check className="w-3.5 h-3.5 mr-1" /> 完成创建</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============ 管理面板（已设置完成的教师） ============
  return (
    <div className="min-h-screen bg-background">
      {/* 顶栏 */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="w-9 h-9 rounded-lg object-contain" />
            <div>
              <h1 className="text-lg font-bold text-foreground">{profile?.title || '开放智慧助教'}</h1>
              <p className="text-xs text-muted-foreground">{teacherName} · 管理面板</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onStartTeaching} size="sm" className="rounded-lg">
              进入助教模式
            </Button>
            <Button onClick={onLogout} variant="ghost" size="sm" className="text-muted-foreground">
              退出
            </Button>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 flex gap-0 overflow-x-auto">
          <TabButton icon={<Settings className="w-4 h-4" />} label="助教档案" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
          <TabButton icon={<BookOpen className="w-4 h-4" />} label="知识库" active={activeTab === 'knowledge'} onClick={() => setActiveTab('knowledge')} />
          <TabButton icon={<Users className="w-4 h-4" />} label={`学生记忆${students.length > 0 ? ` (${students.length})` : ''}`} active={activeTab === 'students'} onClick={() => setActiveTab('students')} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* 助教档案 */}
        {activeTab === 'profile' && profile && (
          <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">助教档案</h2>
              {!editing ? (
                <Button onClick={() => setEditing(true)} variant="outline" size="sm" className="rounded-lg">编辑</Button>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={() => setEditing(false)} variant="ghost" size="sm">取消</Button>
                  <Button onClick={() => handleSaveProfile(false)} disabled={saving} size="sm" className="rounded-lg">
                    {saving ? '保存中...' : '保存'}
                  </Button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                {/* 头像上传区 */}
                <div className="flex items-center gap-4 mb-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative cursor-pointer group"
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-border group-hover:border-primary/50 transition-colors" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center border-2 border-dashed border-border group-hover:border-primary/50 transition-colors">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Upload className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">助教头像</p>
                    <p className="text-xs text-muted-foreground">点击更换，支持 JPG/PNG</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarUpload(file);
                    }}
                  />
                  {avatarUploading && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />上传中</span>
                  )}
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">称呼/头衔</label>
                  <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="如：AI智能助教" className="rounded-lg" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">教授科目</label>
                  <Input value={formSubjects} onChange={e => setFormSubjects(e.target.value)} placeholder="如：人工智能、数学" className="rounded-lg" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">专业领域</label>
                  <textarea value={formExpertise} onChange={e => setFormExpertise(e.target.value)} placeholder="如：深度学习、机器学习、自然语言处理" rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">教学风格</label>
                  <textarea value={formTeachingStyle} onChange={e => setFormTeachingStyle(e.target.value)} placeholder="如：善于用生活例子解释抽象概念" rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">引导问题</label>
                  <textarea value={formGuidingQuestions} onChange={e => setFormGuidingQuestions(e.target.value)} placeholder="开场时引导学生思考的问题，每行一个" rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-2">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-border" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center text-2xl">🎓</div>
                  )}
                  <div>
                    <p className="text-lg font-medium text-foreground">{profile.title || '未设置称呼'}</p>
                    <p className="text-sm text-muted-foreground">{profile.subjects || '未设置科目'}</p>
                  </div>
                </div>
                <InfoRow label="专业领域" value={profile.expertise} />
                <InfoRow label="教学风格" value={profile.teaching_style} />
                <InfoRow label="引导问题" value={profile.guiding_questions} />
              </div>
            )}
          </div>
        )}

        {/* 知识库管理 */}
        {activeTab === 'knowledge' && (
          <div className="space-y-4">
            {/* 添加文本 */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> 添加教学文本
              </h3>
              <textarea
                value={knowledgeText}
                onChange={e => setKnowledgeText(e.target.value)}
                placeholder="粘贴教学资料内容，如课程讲义、知识点总结等..."
                rows={4}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button
                onClick={() => handleAddKnowledge('text')}
                disabled={!knowledgeText.trim() || knowledgeUploading}
                size="sm"
                className="rounded-lg mt-2"
              >
                {knowledgeUploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                添加文本
              </Button>
            </div>

            {/* 添加 URL */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                🌐 添加网页链接
              </h3>
              <div className="flex gap-2">
                <Input
                  value={knowledgeUrl}
                  onChange={e => setKnowledgeUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="rounded-lg flex-1"
                />
                <Button
                  onClick={() => handleAddKnowledge('url')}
                  disabled={!knowledgeUrl.trim() || knowledgeUploading}
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                >
                  {knowledgeUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            {/* 上传文件 */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                📁 上传文件
              </h3>
              <div
                onClick={() => knowledgeFileRef.current?.click()}
                className="border border-dashed border-border rounded-lg p-4 sm:p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">点击上传教学资料文件</p>
                <p className="text-xs text-muted-foreground mt-1">支持 .txt / .md / .csv / .json / .html / .xml / .docx / .pdf，最大 5MB</p>
              </div>
              <input
                ref={knowledgeFileRef}
                type="file"
                accept=".txt,.md,.csv,.json,.html,.xml,.docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadKnowledgeFile(file);
                }}
              />
              {knowledgeUploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
                  <Loader2 className="w-4 h-4 animate-spin" /> 处理中...
                </div>
              )}
            </div>

            {/* 搜索知识库 */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Search className="w-4 h-4" /> 搜索知识库
              </h3>
              <div className="flex gap-2">
                <Input
                  value={knowledgeSearchQuery}
                  onChange={e => setKnowledgeSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearchKnowledge()}
                  placeholder="搜索知识库内容..."
                  className="rounded-lg flex-1"
                />
                <Button
                  onClick={handleSearchKnowledge}
                  disabled={!knowledgeSearchQuery.trim() || knowledgeSearching}
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                >
                  {knowledgeSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              {knowledgeSearchResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {knowledgeSearchResults.map((r, i) => (
                    <div key={i} className="bg-muted/30 rounded-lg p-3">
                      <p className="text-sm text-foreground">{r.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">相关度: {Math.round(r.score * 100)}%</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 学生记忆 */}
        {activeTab === 'students' && (
          <div>
            {selectedStudent ? (
              <div className="max-h-[70vh] overflow-y-auto">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="text-muted-foreground hover:text-foreground text-sm mb-4 flex items-center gap-1"
                >
                  ← 返回学生列表
                </button>
                <h3 className="text-lg font-semibold text-foreground mb-4">{selectedStudentName} 的学习记忆</h3>

                {/* 知识掌握 */}
                {selectedStudent.knowledge_mastery.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-5 mb-4">
                    <h4 className="text-sm font-medium text-foreground mb-3">知识掌握情况</h4>
                    <div className="space-y-2">
                      {selectedStudent.knowledge_mastery.map((m: Record<string, unknown>, i: number) => {
                        const subtopic = m.subtopic as string | null;
                        const weakPts = m.weak_points as string | null;
                        const strongPts = m.strong_points as string | null;
                        return (
                          <div key={i} className="flex items-center gap-3 py-1.5">
                            <div className="flex-1">
                              <span className="text-sm text-foreground">{String(m.subject)}-{String(m.topic)}{subtopic ? `/${subtopic}` : ''}</span>
                              {weakPts && <span className="text-xs text-muted-foreground ml-2">({weakPts})</span>}
                              {strongPts && <span className="text-xs text-green-600 ml-2">({strongPts})</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                                <div className={`h-full ${masteryBarColor(m.mastery_level)} rounded-full`} style={{ width: `${masteryPercent(m.mastery_level)}%` }} />
                              </div>
                              <span className={`text-xs font-medium ${masteryColor(m.mastery_level)}`}>{masteryPercent(m.mastery_level)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 对话记录 */}
                {selectedStudent.conversations.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-5 mb-4">
                    <h4 className="text-sm font-medium text-foreground mb-3">近期对话</h4>
                    <div className="space-y-3">
                      {selectedStudent.conversations.slice(0, 10).map((c: Record<string, unknown>, i: number) => {
                        const summary = c.summary as string | null;
                        const confusion = c.confusion as string | null;
                        const breakthrough = c.breakthrough as string | null;
                        const createdAt = c.created_at as string | null;
                        return (
                          <div key={i} className="border-l-2 border-muted pl-3">
                            <div className="text-sm text-foreground">{summary}</div>
                            {confusion && <div className="text-xs text-red-500 mt-0.5">困惑：{confusion}</div>}
                            {breakthrough && <div className="text-xs text-green-600 mt-0.5">突破：{breakthrough}</div>}
                            <div className="text-xs text-muted-foreground mt-0.5">{createdAt ? new Date(createdAt).toLocaleDateString() : ''}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 教学策略 */}
                {selectedStudent.strategies.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h4 className="text-sm font-medium text-foreground mb-3">教学策略</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedStudent.strategies.map((s: Record<string, unknown>, i: number) => {
                        const method = s.method as string;
                        const context = s.context as string | null;
                        return (
                          <span key={i} className="text-xs bg-muted/50 text-foreground px-2 py-1 rounded-md">
                            {method}{context ? `（${context}）` : ''}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {loading ? (
                  <div className="text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> 加载中...
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">暂无学生与你的助教交互</p>
                    <p className="text-sm text-muted-foreground mt-2">学生登录后选择你的助教即可开始</p>
                  </div>
                ) : (
                  <div className="max-h-[60vh] overflow-y-auto space-y-3">
                    {students.map(s => (
                      <button
                        key={s.student_id}
                        onClick={() => handleViewStudent(s)}
                        className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-foreground">{s.name || '未命名学生'}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {s.grade && `${s.grade} · `}共 {s.total_conversations} 次对话
                            </div>
                          </div>
                          <div className="flex gap-3 text-xs">
                            {s.knowledge_summary.mastered > 0 && (
                              <span className="text-green-600">已掌握 {s.knowledge_summary.mastered}</span>
                            )}
                            {s.knowledge_summary.learning > 0 && (
                              <span className="text-amber-600">学习中 {s.knowledge_summary.learning}</span>
                            )}
                            {s.knowledge_summary.weak > 0 && (
                              <span className="text-red-500">薄弱 {s.knowledge_summary.weak}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="text-sm text-muted-foreground">{label}：</span>
      <span className="text-sm text-foreground">{value || '未设置'}</span>
    </div>
  );
}
