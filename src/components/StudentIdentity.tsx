'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Save, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StudentProfileData {
  student_id: string;
  name: string;
  grade: string;
  main_subjects: string;
  learning_style: string;
  learning_preference: string;
  interests_topics: string;
  interests_apps: string;
  personality_type: string;
}

interface StudentIdentityProps {
  studentId: string;
  teacherId?: string;
  onStudentIdChange: (id: string) => void;
}

const DEFAULT_PROFILE: Omit<StudentProfileData, 'student_id'> = {
  name: '',
  grade: '',
  main_subjects: '',
  learning_style: '',
  learning_preference: '',
  interests_topics: '',
  interests_apps: '',
  personality_type: '',
};

const QUICK_TEMPLATES: Record<string, { label: string; data: Partial<StudentProfileData> }> = {
  high_school_stem: {
    label: '高中生-理科',
    data: {
      grade: '高一',
      main_subjects: '数学, 物理, 化学',
      learning_style: '视觉型',
      learning_preference: '图解, 动画, 实例演示',
      interests_topics: '游戏, 编程, 科技',
      personality_type: '活跃型',
    },
  },
  college_cs: {
    label: '大学生-计算机',
    data: {
      grade: '大学本科',
      main_subjects: '计算机科学, 数学, 人工智能',
      learning_style: '动手型',
      learning_preference: '代码实践, 项目驱动, 案例分析',
      interests_topics: '编程, AI, 游戏开发',
      interests_apps: '软件开发, 数据分析',
      personality_type: '严谨型',
    },
  },
  adult_learner: {
    label: '成人学员',
    data: {
      grade: '成人教育',
      main_subjects: '人工智能技术, 计算机应用',
      learning_style: '听觉型',
      learning_preference: '实例讲解, 互动问答, 步骤拆解',
      interests_topics: '工作效率提升, 新技术, 实用技能',
      interests_apps: '办公自动化, AI工具应用',
      personality_type: '沉稳型',
    },
  },
};

export default function StudentIdentity({ studentId, teacherId, onStudentIdChange }: StudentIdentityProps) {
  const [profile, setProfile] = useState<StudentProfileData>({
    ...DEFAULT_PROFILE,
    student_id: studentId,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // 从后端加载画像
  const loadProfile = useCallback(async () => {
    if (!studentId) return;
    try {
      const res = await fetch(`/api/memory/profile?student_id=${studentId}&teacher_id=${teacherId || 'teacher_default'}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.profile) {
          setProfile({
            student_id: studentId,
            name: data.profile.name || '',
            grade: data.profile.grade || '',
            main_subjects: data.profile.main_subjects || '',
            learning_style: data.profile.learning_style || '',
            learning_preference: data.profile.learning_preference || '',
            interests_topics: data.profile.interests_topics || '',
            interests_apps: data.profile.interests_apps || '',
            personality_type: data.profile.personality_type || '',
          });
        }
      }
    } catch { /* ignore */ }
  }, [studentId, teacherId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    setIsLoading(true);
    setSaveStatus('saving');
    try {
      const { student_id, ...profileData } = profile;
      const res = await fetch('/api/memory/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id, teacher_id: teacherId || 'teacher_default', ...profileData }),
      });
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
    setIsLoading(false);
  };

  const applyTemplate = (templateKey: string) => {
    const template = QUICK_TEMPLATES[templateKey];
    if (!template) return;
    setProfile(prev => ({
      ...prev,
      ...template.data,
      name: prev.name || template.data.name || '',
    }));
  };

  const resetStudentId = () => {
    const newId = 'stu_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    localStorage.setItem('studentId', newId);
    onStudentIdChange(newId);
    setProfile({ ...DEFAULT_PROFILE, student_id: newId });
  };

  const updateField = (field: keyof StudentProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      {/* 折叠头部 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-2xl"
      >
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">学生身份</span>
          {profile.name && (
            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
              {profile.name}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* 学生ID和重置 */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">学生ID</Label>
              <div className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded-md mt-0.5">
                {studentId}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetStudentId}
              className="mt-4 text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              重置身份
            </Button>
          </div>

          {/* 快速模板 */}
          <div>
            <Label className="text-xs text-muted-foreground">快速模板</Label>
            <div className="flex gap-2 mt-1">
              {Object.entries(QUICK_TEMPLATES).map(([key, tmpl]) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(key)}
                  className="text-xs"
                >
                  {tmpl.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 画像表单 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">姓名</Label>
              <Input
                value={profile.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="学生姓名"
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">年级</Label>
              <Input
                value={profile.grade}
                onChange={e => updateField('grade', e.target.value)}
                placeholder="如：高一、大学本科"
                className="h-8 text-sm mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">主要学科</Label>
            <Input
              value={profile.main_subjects}
              onChange={e => updateField('main_subjects', e.target.value)}
              placeholder="如：数学, 物理, 化学"
              className="h-8 text-sm mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">学习风格</Label>
              <Select value={profile.learning_style} onValueChange={v => updateField('learning_style', v)}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue placeholder="选择风格" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="视觉型">视觉型</SelectItem>
                  <SelectItem value="听觉型">听觉型</SelectItem>
                  <SelectItem value="动手型">动手型</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">性格特点</Label>
              <Select value={profile.personality_type} onValueChange={v => updateField('personality_type', v)}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue placeholder="选择特点" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="活跃型">活跃型</SelectItem>
                  <SelectItem value="内向型">内向型</SelectItem>
                  <SelectItem value="严谨型">严谨型</SelectItem>
                  <SelectItem value="沉稳型">沉稳型</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">学习偏好</Label>
            <Input
              value={profile.learning_preference}
              onChange={e => updateField('learning_preference', e.target.value)}
              placeholder="如：图解, 动画, 实例演示"
              className="h-8 text-sm mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">兴趣方向</Label>
            <Input
              value={profile.interests_topics}
              onChange={e => updateField('interests_topics', e.target.value)}
              placeholder="如：游戏, 编程, 科技"
              className="h-8 text-sm mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">感兴趣的应用场景</Label>
            <Input
              value={profile.interests_apps}
              onChange={e => updateField('interests_apps', e.target.value)}
              placeholder="如：游戏开发, 数据分析"
              className="h-8 text-sm mt-1"
            />
          </div>

          {/* 保存按钮 */}
          <div className="pt-2 border-t border-border">
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="w-full h-9"
              size="sm"
            >
              {saveStatus === 'saving' ? (
                <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />保存中...</>
              ) : saveStatus === 'saved' ? (
                <span className="text-green-600">已保存</span>
              ) : saveStatus === 'error' ? (
                <span className="text-destructive">保存失败，重试</span>
              ) : (
                <><Save className="w-3 h-3 mr-1" />保存画像</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
