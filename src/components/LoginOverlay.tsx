'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GraduationCap, ChevronRight, Settings } from 'lucide-react';

export interface LoginInfo {
  role: 'student' | 'teacher' | 'admin';
  name: string;
  grade?: string;
  studentType?: 'adult' | 'fulltime';
  learningStyle?: string;
  teacherId?: string;
  teacherName?: string;
  isNewTeacher?: boolean;
}

interface TeacherInfo {
  id: string;
  name: string;
  display_name: string | null;
  title: string | null;
  subjects: string | null;
  expertise: string | null;
  teaching_style: string | null;
  avatar_url: string | null;
  is_setup_complete: boolean | null;
}

interface LoginOverlayProps {
  onLogin: (info: LoginInfo) => void;
  currentLoginInfo: LoginInfo | null;
}

export default function LoginOverlay({ onLogin, currentLoginInfo }: LoginOverlayProps) {
  const [mode, setMode] = useState<'select' | 'student' | 'teacher' | 'admin'>('select');
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [studentType, setStudentType] = useState<'adult' | 'fulltime'>('fulltime');
  const [teacherName, setTeacherName] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 加载教师列表
  useEffect(() => {
    if (mode === 'student') {
      fetch('/api/teacher')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // 只展示已完成设置且已启用的教师
            const ready = (data.teachers || []).filter((t: TeacherInfo) => t.is_setup_complete);
            setTeachers(ready);
            if (ready.length === 1) {
              setSelectedTeacherId(ready[0].id);
            }
          }
        })
        .catch(() => {});
    }
  }, [mode]);

  if (currentLoginInfo) return null;

  const handleStudentLogin = () => {
    if (!studentName.trim()) {
      setError('请输入你的姓名');
      return;
    }
    if (!selectedTeacherId) {
      setError('请选择一位助教老师');
      return;
    }
    const teacher = teachers.find(t => t.id === selectedTeacherId);
    onLogin({
      role: 'student',
      name: studentName.trim(),
      grade: studentGrade.trim() || undefined,
      studentType,
      teacherId: selectedTeacherId,
      teacherName: teacher?.display_name || teacher?.name || '',
    });
  };

  const handleTeacherLogin = async () => {
    if (!teacherName.trim()) {
      setError('请输入账号');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', name: teacherName.trim(), password: teacherPassword || '123456' }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || '登录失败');
        return;
      }
      onLogin({
        role: 'teacher',
        name: data.teacher.display_name || data.teacher.name,
        teacherId: data.teacher.id,
        teacherName: data.teacher.display_name || data.teacher.name,
        isNewTeacher: data.isNew || false,
      });
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!adminUsername.trim() || !adminPassword.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username: adminUsername.trim(), password: adminPassword }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || '登录失败');
        return;
      }
      onLogin({
        role: 'admin',
        name: '管理员',
      });
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') action();
  };

  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4">
        {/* 选择角色 */}
        {mode === 'select' && (
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-lg text-center">
            <div className="mb-6">
              <img src="/logo.png" alt="Open Teacher" className="w-18 h-18 sm:w-24 sm:h-24 mx-auto rounded-xl object-contain shadow-md" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Open Teacher</h2>
            <p className="text-sm text-muted-foreground mb-6">开放智慧助教</p>
            <div className="space-y-3">
              <Button
                onClick={() => { setMode('student'); setError(''); }}
                className="w-full h-12 sm:h-14 text-base sm:text-lg font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              >
                我是学生 — 开始学习
              </Button>
              <Button
                onClick={() => { setMode('teacher'); setError(''); }}
                variant="outline"
                className="w-full h-12 sm:h-14 text-base sm:text-lg font-medium rounded-xl border-border text-foreground hover:bg-muted/50"
              >
                我是教师 — 进入助教
              </Button>
              <Button
                onClick={() => { setMode('admin'); setError(''); }}
                variant="ghost"
                className="w-full h-10 text-sm rounded-xl text-muted-foreground hover:bg-muted/30"
              >
                <Settings className="w-4 h-4 mr-2" /> 管理员入口
              </Button>
            </div>
          </div>
        )}

        {/* 学生登录 */}
        {mode === 'student' && (
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-lg">
            <button
              onClick={() => { setMode('select'); setError(''); }}
              className="text-muted-foreground hover:text-foreground text-sm mb-4 flex items-center gap-1"
            >
              ← 返回
            </button>
            <h2 className="text-xl font-bold text-foreground mb-6">选择你的助教</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">你的姓名</label>
                <Input
                  value={studentName}
                  onChange={e => { setStudentName(e.target.value); setError(''); }}
                  onKeyDown={e => handleKeyDown(e, handleStudentLogin)}
                  placeholder="请输入姓名"
                  className="h-11 rounded-lg"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">学员类型</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStudentType('fulltime')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      studentType === 'fulltime'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:border-primary/30 hover:bg-muted/20'
                    }`}
                  >
                    <span className="text-sm font-medium text-foreground">全日制学员</span>
                    <p className="text-xs text-muted-foreground mt-0.5">在校全日制学习</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentType('adult')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      studentType === 'adult'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:border-primary/30 hover:bg-muted/20'
                    }`}
                  >
                    <span className="text-sm font-medium text-foreground">成人学员</span>
                    <p className="text-xs text-muted-foreground mt-0.5">在职进修/继续教育</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">选择助教老师</label>
                {teachers.length === 0 ? (
                  <div className="text-center py-6 bg-muted/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">暂无可用助教</p>
                    <p className="text-xs text-muted-foreground mt-1">请联系管理员创建助教账号</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {teachers.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { setSelectedTeacherId(t.id); setError(''); }}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          selectedTeacherId === t.id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border hover:border-primary/30 hover:bg-muted/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {t.avatar_url ? (
                            <img src={t.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border border-border flex-shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <GraduationCap className="w-6 h-6 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground">{t.display_name || t.name}</div>
                            {t.subjects && (
                              <div className="text-xs text-primary/80 mt-0.5">{t.subjects}</div>
                            )}
                            {t.teaching_style && (
                              <div className="text-xs text-muted-foreground mt-0.5 truncate">{t.teaching_style}</div>
                            )}
                          </div>
                          {selectedTeacherId === t.id && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button
                onClick={handleStudentLogin}
                disabled={!studentName.trim() || !selectedTeacherId}
                className="w-full h-11 rounded-lg font-medium"
              >
                开始学习 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* 教师登录 */}
        {mode === 'teacher' && (
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-lg">
            <button
              onClick={() => { setMode('select'); setError(''); }}
              className="text-muted-foreground hover:text-foreground text-sm mb-4 flex items-center gap-1"
            >
              ← 返回
            </button>
            <h2 className="text-xl font-bold text-foreground mb-6">教师登录</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">账号</label>
                <Input
                  value={teacherName}
                  onChange={e => { setTeacherName(e.target.value); setError(''); }}
                  onKeyDown={e => handleKeyDown(e, handleTeacherLogin)}
                  placeholder="请输入账号或姓名"
                  className="h-11 rounded-lg"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">密码</label>
                <Input
                  type="password"
                  value={teacherPassword}
                  onChange={e => setTeacherPassword(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, handleTeacherLogin)}
                  placeholder="请输入密码"
                  className="h-11 rounded-lg"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button
                onClick={handleTeacherLogin}
                disabled={!teacherName.trim() || loading}
                className="w-full h-11 rounded-lg font-medium"
              >
                {loading ? '登录中...' : '登录'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">账号由管理员统一创建，如无账号请联系管理员</p>
            </div>
          </div>
        )}

        {/* 管理员登录 */}
        {mode === 'admin' && (
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-lg">
            <button
              onClick={() => { setMode('select'); setError(''); }}
              className="text-muted-foreground hover:text-foreground text-sm mb-4 flex items-center gap-1"
            >
              ← 返回
            </button>
            <h2 className="text-xl font-bold text-foreground mb-6">管理员登录</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">用户名</label>
                <Input
                  value={adminUsername}
                  onChange={e => { setAdminUsername(e.target.value); setError(''); }}
                  onKeyDown={e => handleKeyDown(e, handleAdminLogin)}
                  placeholder="请输入用户名"
                  className="h-11 rounded-lg"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">密码</label>
                <Input
                  type="password"
                  value={adminPassword}
                  onChange={e => { setAdminPassword(e.target.value); setError(''); }}
                  onKeyDown={e => handleKeyDown(e, handleAdminLogin)}
                  placeholder="请输入密码"
                  className="h-11 rounded-lg"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button
                onClick={handleAdminLogin}
                disabled={!adminUsername.trim() || !adminPassword.trim() || loading}
                className="w-full h-11 rounded-lg font-medium"
              >
                {loading ? '登录中...' : '登录'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
