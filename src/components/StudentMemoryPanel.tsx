'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, BookOpen, FileText, Brain, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

interface StudentMemoryPanelProps {
  studentId: string;
  studentName: string;
  teacherId?: string;
}

export default function StudentMemoryPanel({ studentId, studentName, teacherId }: StudentMemoryPanelProps) {
  const [memory, setMemory] = useState<MemoryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMemory = useCallback(async () => {
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
  }, [studentId, teacherId]);

  useEffect(() => {
    if (studentId) loadMemory();
  }, [studentId, teacherId, loadMemory]);

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
    <div className="space-y-4">
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
                我的档案
              </CardTitle>
            </CardHeader>
            <CardContent>
              {memory.has_profile && memory.profile ? (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '姓名', value: memory.profile.name || studentName },
                    { label: '年级', value: memory.profile.grade },
                    { label: '主要学科', value: memory.profile.main_subjects },
                    { label: '学习风格', value: memory.profile.learning_style },
                    { label: '兴趣方向', value: memory.profile.interests_topics },
                    { label: '性格特点', value: memory.profile.personality_type },
                  ].filter(item => item.value).map(item => (
                    <div key={item.label} className="p-2.5 bg-muted/15 rounded-lg border border-border/10">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-medium text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">开始对话后，系统会自动了解你并建立学习档案</p>
                </div>
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
                <div className="space-y-4">
                  {/* 已掌握知识点 */}
                  {memory.knowledge_mastery.mastered.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-600 mb-2">已掌握</p>
                      {memory.knowledge_mastery.mastered.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 py-2 px-3 bg-green-50/10 rounded-lg mb-1.5">
                          <div className="flex-1">
                            <span className="text-sm text-foreground">{t.subject} - {t.topic}{t.subtopic ? ` / ${t.subtopic}` : ''}</span>
                            {t.strong_points && <span className="text-xs text-muted-foreground ml-2">({t.strong_points})</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-20 h-2 bg-muted/30 rounded-full overflow-hidden">
                              <div className={`h-full ${masteryBarColor(t.mastery_level)} rounded-full transition-all`} style={{ width: `${masteryPercent(t.mastery_level)}%` }} />
                            </div>
                            <span className={`text-xs font-semibold ${masteryColor(t.mastery_level)}`}>
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
                        <div key={i} className="flex items-center gap-2 py-2 px-3 bg-amber-50/10 rounded-lg mb-1.5">
                          <div className="flex-1">
                            <span className="text-sm text-foreground">{t.subject} - {t.topic}{t.subtopic ? ` / ${t.subtopic}` : ''}</span>
                            {t.weak_points && <span className="text-xs text-muted-foreground ml-2">({t.weak_points})</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-20 h-2 bg-muted/30 rounded-full overflow-hidden">
                              <div className={`h-full ${masteryBarColor(t.mastery_level)} rounded-full transition-all`} style={{ width: `${masteryPercent(t.mastery_level)}%` }} />
                            </div>
                            <span className={`text-xs font-semibold ${masteryColor(t.mastery_level)}`}>
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
                        <div key={i} className="flex items-center gap-2 py-2 px-3 bg-red-50/10 rounded-lg mb-1.5">
                          <div className="flex-1">
                            <span className="text-sm text-foreground">{t.subject} - {t.topic}{t.subtopic ? ` / ${t.subtopic}` : ''}</span>
                            {t.weak_points && <span className="text-xs text-muted-foreground ml-2">({t.weak_points})</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-20 h-2 bg-muted/30 rounded-full overflow-hidden">
                              <div className={`h-full ${masteryBarColor(t.mastery_level)} rounded-full transition-all`} style={{ width: `${masteryPercent(t.mastery_level)}%` }} />
                            </div>
                            <span className={`text-xs font-semibold ${masteryColor(t.mastery_level)}`}>
                              {masteryPercent(t.mastery_level)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <BookOpen className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">开始学习后，这里会显示你的知识掌握情况</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 近期对话 */}
          <Card className="warm-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-primary" />
                近期学习
              </CardTitle>
            </CardHeader>
            <CardContent>
              {memory.recent_conversations.length > 0 ? (
                <div className="space-y-3">
                  {memory.recent_conversations.map((c, i) => (
                    <div key={i} className="p-3 bg-muted/10 rounded-lg border border-border/10">
                      {c.topic && <p className="text-sm font-medium text-foreground mb-1">{c.topic}</p>}
                      {c.summary && <p className="text-xs text-muted-foreground">{c.summary}</p>}
                      <div className="flex gap-2 mt-1.5 flex-wrap">
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
                <div className="text-center py-6">
                  <FileText className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">对话后，学习记录会出现在这里</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 关键时刻 */}
          {memory.key_moments.length > 0 && memory.key_moments.some(km_item => km_item.content) && (
            <Card className="warm-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Brain className="w-4 h-4 text-primary" />
                  学习里程碑
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {memory.key_moments.filter(km_item => km_item.content).map((km_item, i) => {
                    const typeLabel: Record<string, { label: string; color: string }> = {
                      breakthrough: { label: '突破性理解', color: 'bg-green-50/20 text-green-700' },
                      frustration: { label: '遇到困难', color: 'bg-red-50/20 text-red-600' },
                      confusion: { label: '产生困惑', color: 'bg-yellow-50/20 text-yellow-700' },
                      achievement: { label: '学习成就', color: 'bg-blue-50/20 text-blue-700' },
                    };
                    const t = typeLabel[km_item.type] || { label: km_item.type, color: 'bg-muted/20 text-muted-foreground' };
                    return (
                      <div key={i} className="flex items-start gap-2 p-2.5 bg-muted/10 rounded-lg">
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
        <div className="text-center py-16">
          <Brain className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-serif font-semibold text-foreground mb-2">学习记忆</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">开始对话后，系统会自动记住你的学习风格、知识掌握程度和有效的教学方式</p>
          <p className="text-xs text-muted-foreground/60 mt-3">每次对话都能在之前的基础上继续进步</p>
        </div>
      )}
    </div>
  );
}
