'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Plus, Search, BookOpen, FileText, Link as LinkIcon, 
  CheckCircle2, AlertCircle, Loader2, Upload, X, 
  FileUp, User, GraduationCap, Save, Settings2,
  List, Eye, Brain
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SearchResult {
  content: string;
  score: number;
  docId: string;
}

interface UploadRecord {
  id: string;
  type: 'text' | 'url' | 'file' | 'profile';
  name: string;
  time: Date;
  success: boolean;
}

/** 教师档案接口 */
interface TeacherProfile {
  id?: string;
  name: string;
  title: string;
  subjects: string;
  expertise: string;
  guidingQuestions: string;
  teachingStyle: string;
}

interface KnowledgeManagerProps {
  teacherProfile?: TeacherProfile;
  onProfileChange?: (profile: TeacherProfile) => void;
  knowledgeTable?: string;
  /** 只读模式：仅显示浏览搜索，隐藏添加资料/教师档案/学习记忆 */
  readOnly?: boolean;
}

export default function KnowledgeManager({ teacherProfile, onProfileChange, knowledgeTable, readOnly }: KnowledgeManagerProps) {
  const [activeTab, setActiveTab] = useState('add');
  const [mainTab, setMainTab] = useState(readOnly ? 'browse' : 'materials');
  const [textContent, setTextContent] = useState('');
  const [urlContent, setUrlContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 知识库浏览：通用查询词
  const [browseQuery, setBrowseQuery] = useState('');
  const [browseResults, setBrowseResults] = useState<SearchResult[]>([]);
  const [browseSearched, setBrowseSearched] = useState(false);

  // 教师档案编辑状态
  const [profileForm, setProfileForm] = useState<TeacherProfile>(teacherProfile || {
    name: '',
    title: '',
    subjects: '',
    expertise: '',
    guidingQuestions: '',
    teachingStyle: '',
  });
  const [profileSaved, setProfileSaved] = useState(false);

  // 同步外部传入的 profile
  const [prevProfile, setPrevProfile] = useState(teacherProfile);
  if (teacherProfile !== prevProfile) {
    setPrevProfile(teacherProfile);
    setProfileForm(teacherProfile || {
      name: '',
      title: '',
      subjects: '',
      expertise: '',
      guidingQuestions: '',
      teachingStyle: '',
    });
  }

  const addUploadRecord = useCallback((type: UploadRecord['type'], name: string, success: boolean) => {
    setUploadHistory(prev => [{
      id: Date.now().toString(),
      type,
      name,
      time: new Date(),
      success,
    }, ...prev].slice(0, 20));
  }, []);

  // ====== 知识库浏览搜索 ======
  const browseKnowledge = async (query?: string) => {
    const q = query || browseQuery;
    if (!q.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, topK: 10, minScore: 0.0, tableName: knowledgeTable }),
      });

      const data = await response.json();
      if (data.success) {
        setBrowseResults(data.results);
        setBrowseSearched(true);
      } else {
        setBrowseResults([]);
        setBrowseSearched(true);
      }
    } catch {
      setBrowseResults([]);
      setBrowseSearched(true);
    } finally {
      setIsLoading(false);
    }
  };

  // ====== 教师档案保存 ======
  const saveProfile = async () => {
    setIsLoading(true);
    try {
      if (onProfileChange) {
        onProfileChange(profileForm);
      }

      const hasContent = profileForm.name || profileForm.subjects || profileForm.expertise || profileForm.guidingQuestions;
      if (hasContent) {
        const profileContent = `教师专业档案

姓名：${profileForm.name || 'AI智能助教'}
角色定位：${profileForm.title || '智能助教'}
专业领域：${profileForm.subjects || '综合学科'}
擅长方向：${profileForm.expertise || '根据知识库内容动态确定'}
教学风格：${profileForm.teachingStyle || '善于用生活例子解释抽象概念，喜欢追问式引导，启发学生思考'}
${profileForm.guidingQuestions ? `引导问题：\n${profileForm.guidingQuestions}` : ''}

说明：此档案定义了AI助教的专业范围和行为边界。助教仅回答与上述专业领域相关的问题，超出范围会礼貌引导回来。`;

        const response = await fetch('/api/knowledge/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: profileContent, tableName: knowledgeTable }),
        });

        const data = await response.json();
        if (data.success) {
          addUploadRecord('profile', `教师档案 - ${profileForm.name || 'AI助教'}`, true);
        }
      }

      setProfileSaved(true);
      toast.success('教师档案保存成功！');
      setTimeout(() => setProfileSaved(false), 3000);
    } catch {
      toast.error('档案保存失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // ====== 文本上传 ======
  const addTextDocument = async () => {
    if (!textContent.trim()) {
      toast.error('请输入文档内容');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/knowledge/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: textContent, tableName: knowledgeTable }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('文本内容添加成功！', { description: '教学资料已加入知识库' });
        addUploadRecord('text', textContent.slice(0, 40) + (textContent.length > 40 ? '...' : ''), true);
        setTextContent('');
        // 自动刷新浏览
        browseKnowledge(textContent.slice(0, 20));
      } else {
        toast.error('添加失败', { description: data.error || '请检查内容后重试' });
        addUploadRecord('text', textContent.slice(0, 40), false);
      }
    } catch {
      toast.error('网络错误，请重试');
      addUploadRecord('text', textContent.slice(0, 40), false);
    } finally {
      setIsLoading(false);
    }
  };

  // ====== URL上传 ======
  const addUrlDocument = async () => {
    if (!urlContent.trim()) {
      toast.error('请输入URL');
      return;
    }

    try {
      new URL(urlContent);
    } catch {
      toast.error('URL格式不正确');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/knowledge/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlContent, tableName: knowledgeTable }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('链接添加成功！', { description: '网页内容已导入知识库' });
        addUploadRecord('url', urlContent, true);
        setUrlContent('');
      } else {
        toast.error('添加失败', { description: data.error || '请检查链接后重试' });
        addUploadRecord('url', urlContent, false);
      }
    } catch {
      toast.error('网络错误，请重试');
      addUploadRecord('url', urlContent, false);
    } finally {
      setIsLoading(false);
    }
  };

  // ====== 文件上传 ======
  const uploadFile = async (file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const supportedExts = ['.txt', '.md', '.csv', '.json', '.html', '.xml'];
    if (!supportedExts.includes(ext)) {
      toast.error('不支持的文件类型', { description: `文件类型 ${ext} 不被支持` });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('文件大小超过限制', { description: '最大支持 5MB' });
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (knowledgeTable) formData.append('tableName', knowledgeTable);

      const response = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        toast.success('文件上传成功！', { description: `"${file.name}" 已加入知识库` });
        addUploadRecord('file', file.name, true);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        toast.error('上传失败', { description: data.error || '请检查文件后重试' });
        addUploadRecord('file', file.name, false);
      }
    } catch {
      toast.error('网络错误，请重试');
      addUploadRecord('file', file.name, false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  // ====== 示例教学资料 ======
  const addSampleKnowledge = async () => {
    setIsLoading(true);
    try {
      const samples = [
        {
          title: '数学教学 - 代数基础',
          content: `数学教学要点 - 代数基础\n\n代数是数学的一个重要分支，主要研究数与数之间的关系和运算规律。在教学中，要重点讲解：\n变量的概念和使用：变量就像一个盒子，可以放入不同的数字。比如用x表示一个未知数，它可以是任何数。\n代数式的化简：把复杂的式子变成更简单的形式。比如2x+3x=5x，就像2个苹果加3个苹果等于5个苹果。\n方程的求解方法：方程就像一个天平，两边要保持平衡。我们要做的就是找到让天平平衡的那个数。\n函数的图像和性质：函数描述的是两个量之间的关系，比如你走路的时间和距离就是函数关系。画成图就是一条直线或曲线。`,
        },
        {
          title: '物理教学 - 牛顿运动定律',
          content: `物理教学 - 牛顿运动定律\n\n牛顿运动定律是经典力学的基础，包括三个定律：\n\n第一定律（惯性定律）：物体在不受外力或所受合力为零时，保持静止或匀速直线运动状态。想象你坐在匀速行驶的火车上，如果火车不加速也不减速，你感觉和坐在家里一样——这就是惯性。\n\n第二定律（加速度定律）：物体的加速度与所受合力成正比，与质量成反比。公式为F=ma。简单说就是：推力越大，加速越快；东西越重，加速越慢。就像推购物车，空车一推就走了，装满东西就得用力推。\n\n第三定律（作用与反作用定律）：两个物体之间的作用力和反作用力大小相等、方向相反。你拍桌子，桌子也在拍你，所以手会疼。火箭向下喷气，气向下推，火箭就被推上去了。`,
        },
        {
          title: '语文教学 - 现代文阅读技巧',
          content: `语文教学 - 现代文阅读技巧\n\n现代文阅读是语文学习的重要能力，掌握以下技巧可以有效提升阅读理解水平：\n\n通读全文把握主旨：先快速通读一遍，了解文章写的是什么，作者想表达什么。就像看一幅画，先看整体再看细节。\n\n关注关键词句：文章中的转折词（但是、然而）、总结词（因此、总之）、修辞手法（比喻、拟人）都是理解文章的钥匙。\n\n分析段落结构：每段话都有中心意思，找到段首段尾的关键句，就能抓住段落主旨。\n\n理解作者情感：作者的态度和情感藏在字里行间，褒义词表示赞赏，贬义词表示批评，要细细体会。`,
        },
        {
          title: '英语教学 - 词汇记忆方法',
          content: `英语教学 - 词汇记忆方法\n\n词汇是英语学习的基础，以下是几种高效的记忆方法：\n\n词根词缀法：很多英语单词由词根+词缀构成。比如unhappiness = un(不) + happy(快乐) + ness(名词后缀)。掌握常见词根词缀，可以举一反三。\n\n联想记忆法：把新词和已知的事物联系起来。比如ambulance（救护车），发音像"俺不能死"，这就记住了。\n\n语境记忆法：不要孤立地背单词，放在句子和文章中记忆。比如学apple，不如学I eat an apple every day。\n\n间隔重复法：今天背的词，明天复习一次，三天后再复习，一周后再复习。每次间隔越来越长，记忆就越牢固。`,
        },
        {
          title: '化学教学 - 元素周期表入门',
          content: `化学教学 - 元素周期表入门\n\n元素周期表是化学的核心工具，就像元素的身份证和通讯录：\n\n周期表的结构：横行叫周期，纵列叫族。同一周期的元素电子层数相同，同一族的元素化学性质相似。\n\n金属和非金属：周期表左边和中间是金属元素，比如铁、铜、铝，它们能导电导热。右边是非金属元素，比如氧、氮、碳。\n\n元素的规律：从左到右，原子序数增大，原子半径减小，得电子能力增强。从上到下，原子半径增大，失电子能力增强。这些规律帮助我们预测元素的性质。\n\n生活中的元素：我们呼吸的氧气是O，喝的水是H2O，铅笔芯的碳是C，人体骨骼含钙Ca。元素就在我们身边。`,
        },
      ];

      for (const item of samples) {
        await fetch('/api/knowledge/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: item.content, tableName: knowledgeTable }),
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      toast.success('示例教学资料添加成功！', { description: '共5篇教学资料已加入知识库' });
      samples.forEach(s => addUploadRecord('text', s.title, true));
      // 自动刷新浏览
      browseKnowledge('教学');
    } catch {
      toast.error('添加示例资料失败');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  };

  // 渲染搜索/浏览结果
  const renderResults = (results: SearchResult[], emptyText: string) => {
    if (results.length === 0) {
      return (
        <div className="text-center py-8">
          <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {results.map((result, index) => (
          <div key={index} className="p-3 bg-muted/15 rounded-lg border border-border/15 hover:border-primary/15 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="secondary" className="text-xs bg-primary/8 text-primary border-primary/10">
                匹配度 {(result.score * 100).toFixed(0)}%
              </Badge>
              <span className="text-[10px] text-muted-foreground">ID: {result.docId?.slice(0, 8) || '-'}</span>
            </div>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {result.content}
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-background pb-8">
      <div className="max-w-6xl mx-auto px-6 pt-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-serif font-semibold text-foreground">知识库管理</h2>
            <p className="text-muted-foreground mt-1 text-sm">管理教学资料和教师档案</p>
          </div>
          <div className="flex gap-2">
            {!readOnly && (
              <Button onClick={addSampleKnowledge} disabled={isLoading} variant="outline" className="border-primary/25 text-primary hover:bg-primary/8 text-sm">
                <BookOpen className="w-4 h-4 mr-2" />
                示例资料
              </Button>
            )}
          </div>
        </div>

        {/* Main tabs: 资料管理 / 浏览知识库 / 教师档案 */}
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="bg-muted/20 border border-border/20 h-auto p-1 gap-1">
            {!readOnly && (
              <TabsTrigger value="materials" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-4 py-2 text-sm rounded-lg transition-all">
                <Plus className="w-4 h-4 mr-2" />
                添加资料
              </TabsTrigger>
            )}
            <TabsTrigger value="browse" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-4 py-2 text-sm rounded-lg transition-all">
              <Eye className="w-4 h-4 mr-2" />
              浏览知识库
            </TabsTrigger>
            {!readOnly && (
              <TabsTrigger value="profile" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-4 py-2 text-sm rounded-lg transition-all">
                <GraduationCap className="w-4 h-4 mr-2" />
                教师档案
              </TabsTrigger>
            )}
            {!readOnly && (
              <TabsTrigger value="memory" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-4 py-2 text-sm rounded-lg transition-all">
                <Brain className="w-4 h-4 mr-2" />
                学习记忆
              </TabsTrigger>
            )}
          </TabsList>

          {/* ====== 添加资料 Tab ====== */}
          {!readOnly && (
          <TabsContent value="materials">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
              {/* Left: 上传区域 */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="warm-card">
                  <CardHeader>
                    <CardTitle className="font-serif">添加资料</CardTitle>
                    <CardDescription className="text-xs">将教学资料添加到知识库，AI助教将基于这些内容回答问题</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="bg-muted/30 border border-border/20 w-full h-auto p-1 gap-1">
                        <TabsTrigger value="add" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex-1 py-2 text-sm rounded-lg transition-all">
                          <FileText className="w-4 h-4 mr-1.5" />
                          文本
                        </TabsTrigger>
                        <TabsTrigger value="file" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex-1 py-2 text-sm rounded-lg transition-all">
                          <FileUp className="w-4 h-4 mr-1.5" />
                          文件
                        </TabsTrigger>
                        <TabsTrigger value="url" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex-1 py-2 text-sm rounded-lg transition-all">
                          <LinkIcon className="w-4 h-4 mr-1.5" />
                          链接
                        </TabsTrigger>
                      </TabsList>

                      {/* 文本输入 */}
                      <TabsContent value="add" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="text-content" className="text-foreground font-medium">教学内容</Label>
                          <Textarea
                            id="text-content"
                            placeholder={`输入教学资料内容...\n\n建议格式：\n[学科:xxx] [章节:xxx] 主题\n具体内容...`}
                            value={textContent}
                            onChange={(e) => setTextContent(e.target.value)}
                            className="min-h-[200px] resize-y bg-card/50 border-border/30 text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            {textContent.length > 0 && `${textContent.length} 字符`}
                          </p>
                        </div>
                        <Button onClick={addTextDocument} disabled={isLoading || !textContent.trim()} className="w-full warm-button-primary text-sm">
                          {isLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />添加中...</>
                          ) : (
                            <><Plus className="w-4 h-4 mr-2" />添加到知识库</>
                          )}
                        </Button>
                      </TabsContent>

                      {/* 文件上传 */}
                      <TabsContent value="file" className="space-y-4 mt-4">
                        <div
                          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                            dragOver
                              ? 'border-primary bg-primary/5'
                              : selectedFile
                              ? 'border-primary/30 bg-primary/5'
                              : 'border-border/40 hover:border-primary/25 hover:bg-muted/10'
                          }`}
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".txt,.md,.csv,.json,.html,.xml,.docx,.pdf"
                            onChange={handleFileSelect}
                          />
                          {selectedFile ? (
                            <div className="space-y-2">
                              <FileText className="w-10 h-10 text-primary mx-auto" />
                              <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                              <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedFile(null);
                                  if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                              >
                                <X className="w-3 h-3 mr-1" />移除
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Upload className="w-10 h-10 text-muted-foreground/60 mx-auto" />
                              <p className="text-sm text-muted-foreground">
                                拖拽文件到此处，或点击选择文件
                              </p>
                              <p className="text-xs text-muted-foreground/50">
                                支持 .txt .md .csv .json .html .xml（最大5MB）
                              </p>
                            </div>
                          )}
                        </div>
                        <Button
                          onClick={() => selectedFile && uploadFile(selectedFile)}
                          disabled={isLoading || !selectedFile}
                          className="w-full warm-button-primary text-sm"
                        >
                          {isLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />上传中...</>
                          ) : (
                            <><Upload className="w-4 h-4 mr-2" />上传文件</>
                          )}
                        </Button>
                      </TabsContent>

                      {/* URL输入 */}
                      <TabsContent value="url" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="url-content" className="text-foreground font-medium">网页链接</Label>
                          <Input
                            id="url-content"
                            placeholder="https://example.com/teaching-material"
                            value={urlContent}
                            onChange={(e) => setUrlContent(e.target.value)}
                            className="bg-card/50 border-border/30 text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            输入网页URL，系统自动提取内容。部分网站可能不支持提取。
                          </p>
                        </div>
                        <Button onClick={addUrlDocument} disabled={isLoading || !urlContent.trim()} className="w-full warm-button-primary text-sm">
                          {isLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />添加中...</>
                          ) : (
                            <><LinkIcon className="w-4 h-4 mr-2" />添加URL到知识库</>
                          )}
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>

              {/* Right sidebar */}
              <div className="space-y-6">
                {/* 上传历史 */}
                <Card className="warm-card">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <List className="w-4 h-4 text-primary" />
                      上传记录
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {uploadHistory.length === 0 ? (
                      <div className="text-center py-6">
                        <FileText className="w-8 h-8 text-muted-foreground/25 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">暂无上传记录</p>
                        <p className="text-xs text-muted-foreground/50 mt-1">添加资料后记录会显示在这里</p>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-[300px]">
                        <div className="space-y-2 pr-2">
                          {uploadHistory.map((record) => (
                            <div key={record.id} className="flex items-start gap-2 p-2.5 bg-muted/15 rounded-lg border border-border/10">
                              {record.type === 'text' && <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />}
                              {record.type === 'file' && <FileUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />}
                              {record.type === 'url' && <LinkIcon className="w-4 h-4 text-primary mt-0.5 shrink-0" />}
                              {record.type === 'profile' && <User className="w-4 h-4 text-primary mt-0.5 shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-foreground truncate font-medium">{record.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground">{formatTime(record.time)}</span>
                                  {record.success ? (
                                    <CheckCircle2 className="w-3 h-3 text-primary" />
                                  ) : (
                                    <AlertCircle className="w-3 h-3 text-destructive" />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>

                {/* 快捷操作 */}
                <Card className="warm-card">
                  <CardHeader>
                    <CardTitle className="text-xs">快捷操作</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      onClick={() => setMainTab('browse')}
                      variant="outline"
                      className="w-full justify-start border-border/25 text-foreground/80 hover:bg-primary/8 hover:text-primary text-xs h-9"
                    >
                      <Eye className="w-3.5 h-3.5 mr-2" />
                      浏览知识库内容
                    </Button>
                    <Button
                      onClick={() => setMainTab('profile')}
                      variant="outline"
                      className="w-full justify-start border-border/25 text-foreground/80 hover:bg-primary/8 hover:text-primary text-xs h-9"
                    >
                      <User className="w-3.5 h-3.5 mr-2" />
                      编辑教师档案
                    </Button>
                    <Button
                      onClick={addSampleKnowledge}
                      disabled={isLoading}
                      variant="outline"
                      className="w-full justify-start border-border/25 text-foreground/80 hover:bg-primary/8 hover:text-primary text-xs h-9"
                    >
                      <BookOpen className="w-3.5 h-3.5 mr-2" />
                      添加5篇示例教学资料
                    </Button>
                  </CardContent>
                </Card>

                {/* 使用提示 */}
                <Card className="warm-card">
                  <CardHeader>
                    <CardTitle className="text-xs">使用提示</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <p>1. 上传教学资料后，AI助教可基于知识库回答问题</p>
                      <p>2. 建议为资料添加学科标签，如 [学科:物理]</p>
                      <p>3. 编辑教师档案可定义助教的专业范围</p>
                      <p>4. 点击&ldquo;浏览知识库&rdquo;查看已添加的内容</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          )}

          {/* ====== 浏览知识库 Tab ====== */}
          <TabsContent value="browse">
            <div className="mt-4 space-y-6">
              <Card className="warm-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5 text-primary" />
                    浏览知识库
                  </CardTitle>
                  <CardDescription className="text-xs">
                    搜索关键词查看知识库中的内容，验证上传的资料是否可被正确检索
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <Input
                      placeholder="输入关键词搜索知识库内容..."
                      value={browseQuery}
                      onChange={(e) => setBrowseQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') browseKnowledge(); }}
                      className="flex-1 bg-card/50 border-border/30 text-sm h-10"
                    />
                    <Button onClick={() => browseKnowledge()} disabled={isLoading || !browseQuery.trim()} className="warm-button-primary text-sm px-6">
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                      {isLoading ? '搜索中...' : '搜索'}
                    </Button>
                  </div>

                  {/* 快捷搜索标签 */}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground leading-6">快速搜索:</span>
                    {['教学', '数学', '物理', '英语', '化学', '语文', '教师档案'].map(tag => (
                      <Button
                        key={tag}
                        variant="outline"
                        size="sm"
                        className="h-6 px-2.5 text-xs border-border/25 text-muted-foreground hover:text-primary hover:border-primary/25 hover:bg-primary/5"
                        onClick={() => { setBrowseQuery(tag); browseKnowledge(tag); }}
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>

                  <Separator className="bg-border/15" />

                  {/* 搜索结果 */}
                  {browseSearched ? (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-foreground font-medium">
                          搜索结果
                          <span className="text-muted-foreground ml-2">({browseResults.length} 条)</span>
                        </p>
                      </div>
                      {renderResults(browseResults, '未找到相关内容，试试其他关键词或先添加一些教学资料')}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <BookOpen className="w-12 h-12 text-muted-foreground/25 mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">输入关键词搜索知识库内容</p>
                      <p className="text-xs text-muted-foreground/50 mt-1">搜索可以验证上传的资料是否能被正确检索</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ====== 教师档案 Tab ====== */}
          {!readOnly && (
          <TabsContent value="profile">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
              {/* 左侧：档案编辑表单 */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="warm-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <GraduationCap className="w-5 h-5 text-primary" />
                          教师档案
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          定义AI助教的身份、专业范围和教学风格
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {profileSaved && (
                          <Badge className="bg-primary/10 text-primary border-primary/15 text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />已保存
                          </Badge>
                        )}
                        <Button
                          onClick={saveProfile}
                          disabled={isLoading}
                          size="sm"
                          className="warm-button-primary text-xs"
                        >
                          {isLoading ? (
                            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />保存中...</>
                          ) : (
                            <><Save className="w-3.5 h-3.5 mr-1.5" />保存档案</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* 基本信息 */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <User className="w-4 h-4 text-primary" />
                        <span>基本信息</span>
                      </div>
                      <Separator className="bg-border/20" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="profile-name" className="text-foreground font-medium text-xs">姓名</Label>
                          <Input
                            id="profile-name"
                            placeholder="如：张老师"
                            value={profileForm.name}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                            className="bg-card/50 border-border/30 text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="profile-title" className="text-foreground font-medium text-xs">角色定位</Label>
                          <Input
                            id="profile-title"
                            placeholder="如：高中物理教师 / 数学助教"
                            value={profileForm.title}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, title: e.target.value }))}
                            className="bg-card/50 border-border/30 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 专业范围 */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Settings2 className="w-4 h-4 text-primary" />
                        <span>专业范围</span>
                      </div>
                      <Separator className="bg-border/20" />
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="profile-subjects" className="text-foreground font-medium text-xs">专业领域</Label>
                          <Input
                            id="profile-subjects"
                            placeholder="如：高中物理、力学、电磁学、光学"
                            value={profileForm.subjects}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, subjects: e.target.value }))}
                            className="bg-card/50 border-border/30 text-sm"
                          />
                          <p className="text-[10px] text-muted-foreground">多个领域用逗号分隔。超出这些领域的问题，助教将礼貌拒绝并引导回来。</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="profile-expertise" className="text-foreground font-medium text-xs">擅长方向</Label>
                          <Textarea
                            id="profile-expertise"
                            placeholder="如：擅长用实验和生活实例讲解抽象的物理概念，对牛顿力学有深入研究"
                            value={profileForm.expertise}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, expertise: e.target.value }))}
                            className="min-h-[80px] resize-y bg-card/50 border-border/30 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 教学风格与引导 */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <BookOpen className="w-4 h-4 text-primary" />
                        <span>教学风格与引导</span>
                      </div>
                      <Separator className="bg-border/20" />
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="profile-style" className="text-foreground font-medium text-xs">教学风格</Label>
                          <Textarea
                            id="profile-style"
                            placeholder="如：善于用生活例子解释抽象概念，喜欢追问式引导启发学生思考"
                            value={profileForm.teachingStyle}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, teachingStyle: e.target.value }))}
                            className="min-h-[80px] resize-y bg-card/50 border-border/30 text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="profile-questions" className="text-foreground font-medium text-xs">引导问题</Label>
                          <Textarea
                            id="profile-questions"
                            placeholder={`开场时会提出的引导性问题，每行一个：\n你对哪些知识点感到困惑？\n你能想到生活中的相关例子吗？\n想不想深入了解某个有趣的现象？`}
                            value={profileForm.guidingQuestions}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, guidingQuestions: e.target.value }))}
                            className="min-h-[100px] resize-y bg-card/50 border-border/30 text-sm"
                          />
                          <p className="text-[10px] text-muted-foreground">每行一个问题。通话开始时AI会从中选取2-3个引导学生。</p>
                        </div>
                      </div>
                    </div>

                    {/* 保存按钮 - 底部突出显示 */}
                    <div className="flex items-center justify-between pt-4 mt-4 border-t-2 border-primary/15">
                      <p className="text-xs text-primary/60">
                        档案同时保存到本地和知识库
                      </p>
                      <Button
                        onClick={saveProfile}
                        disabled={isLoading}
                        className="warm-button-primary text-sm px-8 h-10"
                      >
                        {isLoading ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</>
                        ) : (
                          <><Save className="w-4 h-4 mr-2" />保存档案</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 右侧：档案预览 + 模板 */}
              <div className="space-y-6">
                {/* 档案预览 */}
                <Card className="warm-card">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="w-4 h-4 text-primary" />
                      档案预览
                    </CardTitle>
                    <CardDescription className="text-xs">AI将如何理解你的档案</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2.5 text-xs">
                      {[
                        { label: '姓名', value: profileForm.name || '未设置（默认：AI智能助教）' },
                        { label: '角色定位', value: profileForm.title || '未设置' },
                        { label: '专业领域', value: profileForm.subjects || '未设置（将不限制领域）' },
                        { label: '擅长方向', value: profileForm.expertise || '未设置' },
                        { label: '教学风格', value: profileForm.teachingStyle || '未设置（使用默认风格）' },
                      ].map(item => (
                        <div key={item.label} className="p-2.5 bg-muted/15 rounded-lg border border-border/10">
                          <p className="text-muted-foreground mb-0.5">{item.label}</p>
                          <p className="text-foreground">{item.value}</p>
                        </div>
                      ))}
                      {profileForm.guidingQuestions && (
                        <div className="p-2.5 bg-muted/15 rounded-lg border border-border/10">
                          <p className="text-muted-foreground mb-1">引导问题</p>
                          <div className="space-y-0.5">
                            {profileForm.guidingQuestions.split('\n').filter(q => q.trim()).map((q, i) => (
                              <p key={i} className="text-foreground">{i + 1}. {q.trim()}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 快速模板 */}
                <Card className="warm-card">
                  <CardHeader>
                    <CardTitle className="text-xs">快速模板</CardTitle>
                    <CardDescription className="text-xs">一键填充常用配置</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start border-border/25 text-foreground/80 hover:bg-primary/8 hover:text-primary text-xs h-9"
                      onClick={() => setProfileForm({
                        name: '张老师',
                        title: '高中物理教师',
                        subjects: '高中物理、力学、电磁学、光学、热学',
                        expertise: '擅长用实验和生活实例讲解抽象的物理概念，对牛顿力学和电磁学有深入研究，善于帮助学生建立物理直觉',
                        guidingQuestions: '你对哪些物理现象感到好奇？\n生活中有什么让你觉得&ldquo;这不科学&rdquo;的事情？\n想不想了解某个物理定律在现实中的应用？',
                        teachingStyle: '善于用生活例子解释抽象概念，喜欢追问式引导启发学生思考，讲课幽默风趣但逻辑清晰',
                      })}
                    >
                      物理教师
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start border-border/25 text-foreground/80 hover:bg-primary/8 hover:text-primary text-xs h-9"
                      onClick={() => setProfileForm({
                        name: '李老师',
                        title: '初中数学教师',
                        subjects: '初中数学、代数、几何、函数、概率统计',
                        expertise: '擅长将抽象数学概念具象化，对代数和几何教学经验丰富，善于培养学生的数学思维和解题策略',
                        guidingQuestions: '你对哪种数学题最有兴趣？\n有没有觉得某个公式特别难记？\n想不想挑战一道有趣的数学题？',
                        teachingStyle: '善于将抽象数学具象化，喜欢用类比和图解帮助理解，鼓励学生多角度思考问题',
                      })}
                    >
                      数学教师
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start border-border/25 text-foreground/80 hover:bg-primary/8 hover:text-primary text-xs h-9"
                      onClick={() => setProfileForm({
                        name: '王老师',
                        title: '英语教学助教',
                        subjects: '英语、词汇、语法、阅读理解、写作',
                        expertise: '擅长词汇记忆法教学和语法结构化讲解，对英语阅读理解技巧有独到见解，善于帮助学生建立英语思维',
                        guidingQuestions: '你背单词有什么困难吗？\n阅读理解哪个题型最头疼？\n想不想学一种超好用的记忆方法？',
                        teachingStyle: '注重方法和技巧的传授，喜欢用对比和归纳帮助记忆，讲课节奏明快，重点突出',
                      })}
                    >
                      英语教师
                    </Button>
                  </CardContent>
                </Card>

                {/* 说明 */}
                <Card className="warm-card">
                  <CardHeader>
                    <CardTitle className="text-xs">档案说明</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="p-2 bg-primary/5 rounded-lg border border-primary/8">
                        <p className="text-primary/70 font-medium mb-0.5">自我介绍</p>
                        <p>通话开始时，AI会根据档案做自我介绍</p>
                      </div>
                      <div className="p-2 bg-primary/5 rounded-lg border border-primary/8">
                        <p className="text-primary/70 font-medium mb-0.5">领域约束</p>
                        <p>设置专业领域后，AI只回答领域内问题</p>
                      </div>
                      <div className="p-2 bg-primary/5 rounded-lg border border-primary/8">
                        <p className="text-primary/70 font-medium mb-0.5">引导提问</p>
                        <p>引导问题用于开场白，帮助学生找到方向</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          )}

          {/* ====== 学习记忆 Tab ====== */}
          {!readOnly && (
          <TabsContent value="memory">
            <MemoryPanel teacherId={teacherProfile?.id} />
          </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

// ====== 学习记忆面板组件 ======

interface MemoryProfile {
  name: string;
  grade: string;
  main_subjects: string;
  learning_style: string;
  learning_preference: string;
  interests_topics: string;
  interests_apps: string;
  personality_type: string;
}

interface KnowledgeTopic {
  subject: string;
  topic: string;
  subtopic: string | null;
  mastery_level: number;
  weak_points: string | null;
  strong_points: string | null;
}

interface ConvSummary {
  topic: string | null;
  summary: string | null;
  breakthrough: string | null;
  confusion: string | null;
  date: string;
}

interface StrategyItem {
  method: string;
  context: string | null;
  subject: string | null;
}

interface MemoryData {
  has_profile: boolean;
  profile: MemoryProfile | null;
  knowledge_mastery: {
    total_topics: number;
    mastered: KnowledgeTopic[];
    learning: KnowledgeTopic[];
    weak: KnowledgeTopic[];
  };
  recent_conversations: ConvSummary[];
  key_moments: { type: string; content: string | null; date: string }[];
  teaching_strategy: {
    effective_methods: StrategyItem[];
    ineffective_methods: StrategyItem[];
  };
}

function MemoryPanel({ teacherId }: { teacherId?: string }) {
  const [studentId, setStudentId] = useState<string>('');
  const [memory, setMemory] = useState<MemoryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('studentId');
      if (saved) setStudentId(saved);
    } catch { /* ignore */ }
  }, []);

  const loadMemory = async () => {
    if (!studentId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/memory/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, teacher_id: teacherId || 'teacher_default' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMemory(data.memory);
        } else {
          setError(data.error || '加载失败');
        }
      } else {
        setError('请求失败');
      }
    } catch {
      setError('网络错误');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (studentId) loadMemory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const masteryPercent = (level: number) => Math.round(level * 100);
  const masteryColor = (level: number) => {
    if (level >= 0.8) return 'text-green-600';
    if (level >= 0.6) return 'text-yellow-600';
    return 'text-red-500';
  };
  const masteryBarColor = (level: number) => {
    if (level >= 0.8) return 'bg-green-500';
    if (level >= 0.6) return 'bg-yellow-500';
    return 'bg-red-400';
  };

  return (
    <div className="space-y-4 mt-4">
      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">加载学习记忆...</span>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {memory && !isLoading && (
        <>
          {/* 学生画像 */}
          <Card className="warm-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-primary" />
                学生画像
              </CardTitle>
            </CardHeader>
            <CardContent>
              {memory.has_profile && memory.profile ? (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '姓名', value: memory.profile.name },
                    { label: '年级', value: memory.profile.grade },
                    { label: '主要学科', value: memory.profile.main_subjects },
                    { label: '学习风格', value: memory.profile.learning_style },
                    { label: '兴趣方向', value: memory.profile.interests_topics },
                    { label: '性格特点', value: memory.profile.personality_type },
                  ].filter(item => item.value).map(item => (
                    <div key={item.label} className="p-2 bg-muted/15 rounded-lg border border-border/10">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-sm text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无画像记录。对话后系统会自动了解学生并建立画像。</p>
              )}
            </CardContent>
          </Card>

          {/* 知识掌握 */}
          <Card className="warm-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <BookOpen className="w-4 h-4 text-primary" />
                知识掌握
                <Badge variant="secondary" className="text-xs ml-auto">
                  {memory.knowledge_mastery.total_topics} 个知识点
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {memory.knowledge_mastery.total_topics > 0 ? (
                <div className="space-y-3">
                  {/* 已掌握知识点 */}
                  {memory.knowledge_mastery.mastered.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-600 mb-2">已掌握</p>
                      {memory.knowledge_mastery.mastered.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 py-1.5 px-2 bg-green-50/10 rounded-lg mb-1.5">
                          <div className="flex-1">
                            <span className="text-sm text-foreground">{t.subject} - {t.topic}{t.subtopic ? ` / ${t.subtopic}` : ''}</span>
                            {t.strong_points && <span className="text-xs text-muted-foreground ml-2">({t.strong_points})</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                              <div className={`h-full ${masteryBarColor(t.mastery_level)} rounded-full`} style={{ width: `${masteryPercent(t.mastery_level)}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${masteryColor(t.mastery_level)}`}>
                              {masteryPercent(t.mastery_level)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 学习中知识点 */}
                  {memory.knowledge_mastery.learning.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-amber-600 mb-2">学习中</p>
                      {memory.knowledge_mastery.learning.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 py-1.5 px-2 bg-amber-50/10 rounded-lg mb-1.5">
                          <div className="flex-1">
                            <span className="text-sm text-foreground">{t.subject} - {t.topic}{t.subtopic ? ` / ${t.subtopic}` : ''}</span>
                            {t.weak_points && <span className="text-xs text-muted-foreground ml-2">({t.weak_points})</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                              <div className={`h-full ${masteryBarColor(t.mastery_level)} rounded-full`} style={{ width: `${masteryPercent(t.mastery_level)}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${masteryColor(t.mastery_level)}`}>
                              {masteryPercent(t.mastery_level)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 薄弱知识点 */}
                  {memory.knowledge_mastery.weak.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-500 mb-2">薄弱（需重点讲解）</p>
                      {memory.knowledge_mastery.weak.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 py-1.5 px-2 bg-red-50/10 rounded-lg mb-1.5">
                          <div className="flex-1">
                            <span className="text-sm text-foreground">{t.subject} - {t.topic}{t.subtopic ? ` / ${t.subtopic}` : ''}</span>
                            {t.weak_points && <span className="text-xs text-muted-foreground ml-2">({t.weak_points})</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                              <div className={`h-full ${masteryBarColor(t.mastery_level)} rounded-full`} style={{ width: `${masteryPercent(t.mastery_level)}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${masteryColor(t.mastery_level)}`}>
                              {masteryPercent(t.mastery_level)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无知识掌握记录。对话后系统会自动追踪学习进度。</p>
              )}
            </CardContent>
          </Card>

          {/* 近期对话 */}
          <Card className="warm-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-primary" />
                近期学习记录
              </CardTitle>
            </CardHeader>
            <CardContent>
              {memory.recent_conversations.length > 0 ? (
                <div className="space-y-3">
                  {memory.recent_conversations.map((c, i) => (
                    <div key={i} className="p-3 bg-muted/10 rounded-lg border border-border/10">
                      {c.topic && <p className="text-sm font-medium text-foreground mb-1">{c.topic}</p>}
                      {c.summary && <p className="text-xs text-muted-foreground">{c.summary}</p>}
                      <div className="flex gap-2 mt-1.5">
                        {c.breakthrough && (
                          <Badge className="bg-green-50/20 text-green-700 border-green-200/30 text-xs">
                            突破：{c.breakthrough}
                          </Badge>
                        )}
                        {c.confusion && (
                          <Badge className="bg-red-50/20 text-red-600 border-red-200/30 text-xs">
                            困惑：{c.confusion}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无学习记录。</p>
              )}
            </CardContent>
          </Card>

          {/* 教学策略 */}
          <Card className="warm-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Settings2 className="w-4 h-4 text-primary" />
                教学策略记忆
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(memory.teaching_strategy.effective_methods.length > 0 || memory.teaching_strategy.ineffective_methods.length > 0) ? (
                <div className="space-y-3">
                  {memory.teaching_strategy.effective_methods.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-600 mb-2">有效方法</p>
                      {memory.teaching_strategy.effective_methods.map((s, i) => (
                        <div key={i} className="text-sm text-foreground py-1 px-2 bg-green-50/10 rounded-lg mb-1.5">
                          {s.method}
                          {s.context && <span className="text-xs text-muted-foreground ml-2">({s.context})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {memory.teaching_strategy.ineffective_methods.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-500 mb-2">效果差的方法（避免使用）</p>
                      {memory.teaching_strategy.ineffective_methods.map((s, i) => (
                        <div key={i} className="text-sm text-foreground py-1 px-2 bg-red-50/10 rounded-lg mb-1.5">
                          {s.method}
                          {s.context && <span className="text-xs text-muted-foreground ml-2">({s.context})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无教学策略记录。对话后系统会自动记录有效的教学方法。</p>
              )}
            </CardContent>
          </Card>

          {/* 关键时刻 */}
          {memory.key_moments.length > 0 && (
            <Card className="warm-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Brain className="w-4 h-4 text-primary" />
                  关键时刻
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {memory.key_moments.map((km_item, i) => {
                    const typeLabel: Record<string, { label: string; color: string }> = {
                      breakthrough: { label: '突破性理解', color: 'bg-green-50/20 text-green-700' },
                      frustration: { label: '困惑挫折', color: 'bg-red-50/20 text-red-600' },
                      confusion: { label: '困惑', color: 'bg-yellow-50/20 text-yellow-700' },
                      achievement: { label: '成就', color: 'bg-blue-50/20 text-blue-700' },
                    };
                    const t = typeLabel[km_item.type] || { label: km_item.type, color: 'bg-muted/20 text-muted-foreground' };
                    return (
                      <div key={i} className="flex items-start gap-2 p-2 bg-muted/10 rounded-lg">
                        <Badge className={`${t.color} text-xs shrink-0`}>{t.label}</Badge>
                        <span className="text-sm text-foreground">{km_item.content}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!memory && !isLoading && !error && (
        <div className="text-center py-12">
          <Brain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">开始对话后，学习记忆将自动积累</p>
          <p className="text-xs text-muted-foreground/60 mt-1">系统会记住你的学习风格、知识掌握程度和有效的教学方式</p>
        </div>
      )}
    </div>
  );
}
