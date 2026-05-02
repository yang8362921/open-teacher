'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Users, GraduationCap, Plus, Trash2, Edit, Check, X, 
  LogOut, Key, UserPlus, UserCog, Loader2, AlertCircle
} from 'lucide-react';

interface Teacher {
  id: string;
  name: string;
  display_name: string | null;
  username: string | null;
  title: string | null;
  subjects: string | null;
  is_enabled: boolean | null;
  is_setup_complete: boolean | null;
  created_at: string;
}

interface Student {
  student_id: string;
  name: string | null;
  grade: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  is_enabled: boolean | null;
  created_at: string;
}

interface StudentDetail {
  knowledge_mastery: Record<string, unknown>[];
  conversations: Record<string, unknown>[];
  strategies: Record<string, unknown>[];
}

interface AdminDashboardProps {
  onLogout: () => void;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'teachers' | 'students'>('teachers');

  // 登录状态
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // 创建教师
  const [showCreateTeacher, setShowCreateTeacher] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherUsername, setNewTeacherUsername] = useState('');
  const [newTeacherPassword, setNewTeacherPassword] = useState('123456');
  const [newTeacherTitle, setNewTeacherTitle] = useState('');
  const [creating, setCreating] = useState(false);

  // 编辑教师
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // 修改管理员密码
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // 学生记忆详情
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        fetch('/api/admin?action=teachers'),
        fetch('/api/admin?action=students'),
      ]);
      const tData = await tRes.json();
      const sData = await sRes.json();
      if (tData.success) setTeachers(tData.teachers || []);
      if (sData.success) setStudents(sData.students || []);
    } catch (e) {
      console.error('加载数据失败:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) loadData();
  }, [isLoggedIn]);

  // 管理员登录
  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setLoginError('请输入用户名和密码');
      return;
    }
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password }),
      });
      const data = await res.json();
      if (data.success) {
        setIsLoggedIn(true);
        setLoginError('');
      } else {
        setLoginError(data.error || '登录失败');
      }
    } catch {
      setLoginError('网络错误');
    }
  };

  // 创建教师
  const handleCreateTeacher = async () => {
    if (!newTeacherName.trim()) {
      alert('请输入教师姓名');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_teacher',
          adminUsername: username,
          adminPassword: password,
          name: newTeacherName,
          teacherUsername: newTeacherUsername || undefined,
          teacherPassword: newTeacherPassword || undefined,
          title: newTeacherTitle || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateTeacher(false);
        setNewTeacherName('');
        setNewTeacherUsername('');
        setNewTeacherPassword('123456');
        setNewTeacherTitle('');
        loadData();
      } else {
        alert(data.error || '创建失败');
      }
    } catch {
      alert('网络错误');
    } finally {
      setCreating(false);
    }
  };

  // 切换教师启用状态
  const toggleTeacherEnabled = async (teacher: Teacher) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_teacher',
          adminUsername: username,
          adminPassword: password,
          teacherId: teacher.id,
          is_enabled: !teacher.is_enabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTeachers(prev => prev.map(t => 
          t.id === teacher.id ? { ...t, is_enabled: !t.is_enabled } : t
        ));
      }
    } catch {
      alert('操作失败');
    }
  };

  // 删除教师
  const handleDeleteTeacher = async (teacher: Teacher) => {
    if (!confirm(`确定要删除教师"${teacher.name}"吗？该教师的所有学生数据也将被删除！`)) return;
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_teacher',
          adminUsername: username,
          adminPassword: password,
          teacherId: teacher.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || '删除失败');
      }
    } catch {
      alert('网络错误');
    }
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingTeacher) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_teacher',
          adminUsername: username,
          adminPassword: password,
          teacherId: editingTeacher.id,
          display_name: editDisplayName || undefined,
          username: editUsername || undefined,
          password: editPassword || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingTeacher(null);
        loadData();
      } else {
        alert(data.error || '保存失败');
      }
    } catch {
      alert('网络错误');
    } finally {
      setSaving(false);
    }
  };

  // 切换学生启用状态
  const toggleStudentEnabled = async (student: Student) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_student',
          adminUsername: username,
          adminPassword: password,
          studentId: student.student_id,
          teacherId: student.teacher_id,
          is_enabled: !student.is_enabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStudents(prev => prev.map(s => 
          s.student_id === student.student_id ? { ...s, is_enabled: !s.is_enabled } : s
        ));
      }
    } catch {
      alert('操作失败');
    }
  };

  // 删除学生
  const handleDeleteStudent = async (student: Student) => {
    if (!confirm(`确定要删除学生"${student.name || student.student_id}"吗？`)) return;
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_student',
          adminUsername: username,
          adminPassword: password,
          studentId: student.student_id,
          teacherId: student.teacher_id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || '删除失败');
      }
    } catch {
      alert('网络错误');
    }
  };

  // 查看学生记忆详情
  const handleViewStudentDetail = async (student: Student) => {
    setSelectedStudent(student);
    setLoadingDetail(true);
    setStudentDetail(null);
    try {
      const res = await fetch(`/api/admin?action=student_detail&studentId=${student.student_id}&teacherId=${student.teacher_id}`);
      const data = await res.json();
      if (data.success) {
        setStudentDetail(data.detail);
      }
    } catch {
      console.error('加载学生详情失败');
    } finally {
      setLoadingDetail(false);
    }
  };

  // 修改管理员密码
  const handleChangePassword = async () => {
    if (newAdminPassword.length < 6) {
      alert('密码长度至少6位');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          adminUsername: username,
          adminPassword: password,
          newPassword: newAdminPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPassword(newAdminPassword);
        setNewAdminPassword('');
        setShowChangePassword(false);
        alert('密码修改成功');
      } else {
        alert(data.error || '修改失败');
      }
    } catch {
      alert('网络错误');
    } finally {
      setChangingPassword(false);
    }
  };

  // 登录界面
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-lg w-full max-w-sm">
          <div className="text-center mb-6">
            <img src="/logo.png" alt="开放智慧助教" className="w-10 h-10 mx-auto rounded-xl mb-3" />
            <h1 className="text-xl font-bold text-foreground">管理员登录</h1>
            <p className="text-sm text-muted-foreground mt-1">开放智慧助教 · 后台管理</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">用户名</label>
              <Input
                value={username}
                onChange={e => { setUsername(e.target.value); setLoginError(''); }}
                placeholder="请输入用户名"
                className="h-11 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">密码</label>
              <Input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setLoginError(''); }}
                placeholder="请输入密码"
                className="h-11 rounded-lg"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            {loginError && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="w-4 h-4" /> {loginError}
              </div>
            )}

            <Button onClick={handleLogin} className="w-full h-11 rounded-lg">
              登录
            </Button>
            <p className="text-xs text-muted-foreground text-center">默认账号: admin / admin123</p>
          </div>
        </div>
      </div>
    );
  }

  // 管理面板
  return (
    <div className="min-h-screen bg-background">
      {/* 顶栏 */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg object-contain" />
            <h1 className="text-lg font-bold text-foreground">开放智慧助教 · 管理后台</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowChangePassword(true)}
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
            >
              <Key className="w-4 h-4 mr-1" /> 修改密码
            </Button>
            <Button onClick={onLogout} variant="ghost" size="sm" className="text-muted-foreground">
              <LogOut className="w-4 h-4 mr-1" /> 退出
            </Button>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 flex">
          <button
            onClick={() => setActiveTab('teachers')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'teachers' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <GraduationCap className="w-4 h-4" /> 教师管理
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'students' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" /> 学生管理
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* 教师管理 */}
        {activeTab === 'teachers' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">教师列表</h2>
              <Button onClick={() => setShowCreateTeacher(true)} size="sm" className="rounded-lg">
                <Plus className="w-4 h-4 mr-1" /> 添加教师
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> 加载中...
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">姓名</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">登录账号</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">科目</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">状态</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">设置完成</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {teachers.map(t => (
                      <tr key={t.id} className="hover:bg-muted/10">
                        <td className="px-4 py-3 text-foreground">{t.display_name || t.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{t.username || <span className="text-muted-foreground/50">未设置</span>}</td>
                        <td className="px-4 py-3 text-muted-foreground">{t.subjects || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleTeacherEnabled(t)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                              t.is_enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {t.is_enabled ? <><Check className="w-3 h-3" /> 已启用</> : <><X className="w-3 h-3" /> 已禁用</>}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {t.is_setup_complete ? (
                            <span className="text-green-600 text-xs">✓ 完成</span>
                          ) : (
                            <span className="text-amber-600 text-xs">待设置</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button onClick={() => {
                              setEditingTeacher(t);
                              setEditDisplayName(t.display_name || t.name);
                              setEditUsername(t.username || '');
                              setEditPassword('');
                            }} variant="ghost" size="sm" className="h-7 px-2">
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button onClick={() => handleDeleteTeacher(t)} variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {teachers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          暂无教师数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 学生管理 */}
        {activeTab === 'students' && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">学生列表</h2>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> 加载中...
              </div>
            ) : selectedStudent ? (
              /* 学生记忆详情 */
              <div className="max-h-[70vh] overflow-y-auto">
                <button
                  onClick={() => { setSelectedStudent(null); setStudentDetail(null); }}
                  className="text-muted-foreground hover:text-foreground text-sm mb-4 flex items-center gap-1"
                >
                  ← 返回学生列表
                </button>
                <h3 className="text-lg font-semibold text-foreground mb-1">{selectedStudent.name || selectedStudent.student_id} 的学习记忆</h3>
                <p className="text-sm text-muted-foreground mb-4">所属助教：{selectedStudent.teacher_name || selectedStudent.teacher_id}</p>

                {loadingDetail ? (
                  <div className="text-center py-8 text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> 加载中...
                  </div>
                ) : studentDetail ? (
                  <div className="space-y-4">
                    {/* 知识掌握 */}
                    {studentDetail.knowledge_mastery.length > 0 && (
                      <div className="bg-card border border-border rounded-xl p-5">
                        <h4 className="text-sm font-medium text-foreground mb-3">知识掌握情况（{studentDetail.knowledge_mastery.length}个知识点）</h4>
                        <div className="space-y-2">
                          {studentDetail.knowledge_mastery.map((m: Record<string, unknown>, i: number) => {
                            const level = m.mastery_level as number;
                            const pct = Math.round(level * 100);
                            const color = level >= 0.6 ? 'text-green-600' : level >= 0.3 ? 'text-amber-600' : 'text-red-500';
                            const barColor = level >= 0.6 ? 'bg-green-500' : level >= 0.3 ? 'bg-amber-500' : 'bg-red-500';
                            const label = level >= 0.6 ? '已掌握' : level >= 0.3 ? '学习中' : '薄弱';
                            const subtopic = m.subtopic as string | null;
                            return (
                              <div key={i} className="flex items-center gap-3 py-1.5">
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-foreground">{String(m.subject || '')}-{String(m.topic)}{subtopic ? `/${subtopic}` : ''}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                                    <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className={`text-xs font-medium ${color}`}>{label} {pct}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 对话记录 */}
                    {studentDetail.conversations.length > 0 && (
                      <div className="bg-card border border-border rounded-xl p-5">
                        <h4 className="text-sm font-medium text-foreground mb-3">近期对话（{studentDetail.conversations.length}条）</h4>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {studentDetail.conversations.slice(0, 10).map((c: Record<string, unknown>, i: number) => (
                            <div key={i} className="border-l-2 border-muted pl-3">
                              <div className="text-sm text-foreground">{String(c.summary || c.topic || '无摘要')}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{String(c.created_at || '').slice(0, 10)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 教学策略 */}
                    {studentDetail.strategies.length > 0 && (
                      <div className="bg-card border border-border rounded-xl p-5">
                        <h4 className="text-sm font-medium text-foreground mb-3">教学策略</h4>
                        <div className="flex flex-wrap gap-2">
                          {studentDetail.strategies.map((s: Record<string, unknown>, i: number) => (
                            <span key={i} className="text-xs bg-muted/50 text-foreground px-2 py-1 rounded-md">
                              {String(s.method || '')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {studentDetail.knowledge_mastery.length === 0 && studentDetail.conversations.length === 0 && studentDetail.strategies.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">该学生暂无学习记忆数据</div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">姓名</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">年级</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">所属助教</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">状态</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {students.map(s => (
                      <tr key={s.student_id} className="hover:bg-muted/10">
                        <td className="px-4 py-3 text-foreground">{s.name || s.student_id}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.grade || '-'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.teacher_name || s.teacher_id || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleStudentEnabled(s)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                              s.is_enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {s.is_enabled ? <><Check className="w-3 h-3" /> 已启用</> : <><X className="w-3 h-3" /> 已禁用</>}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button onClick={() => handleViewStudentDetail(s)} variant="ghost" size="sm" className="h-7 px-2" title="查看记忆">
                              <Users className="w-3.5 h-3.5" />
                            </Button>
                            <Button onClick={() => handleDeleteStudent(s)} variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:text-red-600" title="删除">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                          暂无学生数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 创建教师弹窗 */}
      {showCreateTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="bg-card border border-border rounded-xl p-4 sm:p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold text-foreground mb-4">添加新教师</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">教师姓名 *</label>
                <Input value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} placeholder="如：张老师" className="rounded-lg" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">登录账号（选填）</label>
                <Input value={newTeacherUsername} onChange={e => setNewTeacherUsername(e.target.value)} placeholder="留空则用姓名登录" className="rounded-lg" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">登录密码</label>
                <Input value={newTeacherPassword} onChange={e => setNewTeacherPassword(e.target.value)} placeholder="默认 123456" className="rounded-lg" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">科目/简介</label>
                <Input value={newTeacherTitle} onChange={e => setNewTeacherTitle(e.target.value)} placeholder="如：数学教师" className="rounded-lg" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setShowCreateTeacher(false)} variant="outline" className="rounded-lg">取消</Button>
              <Button onClick={handleCreateTeacher} disabled={creating} className="rounded-lg">
                {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                创建
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑教师弹窗 */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="bg-card border border-border rounded-xl p-4 sm:p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold text-foreground mb-4">编辑教师</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">显示名称</label>
                <Input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} className="rounded-lg" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">登录账号</label>
                <Input value={editUsername} onChange={e => setEditUsername(e.target.value)} placeholder="留空则用姓名登录" className="rounded-lg" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">新密码（留空不修改）</label>
                <Input value={editPassword} onChange={e => setEditPassword(e.target.value)} type="password" placeholder="输入新密码" className="rounded-lg" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setEditingTeacher(null)} variant="outline" className="rounded-lg">取消</Button>
              <Button onClick={handleSaveEdit} disabled={saving} className="rounded-lg">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                保存
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 修改密码弹窗 */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="bg-card border border-border rounded-xl p-4 sm:p-6 w-full max-w-sm shadow-lg">
            <h3 className="text-lg font-semibold text-foreground mb-4">修改管理员密码</h3>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">新密码</label>
              <Input
                type="password"
                value={newAdminPassword}
                onChange={e => setNewAdminPassword(e.target.value)}
                placeholder="至少6位"
                className="rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setShowChangePassword(false)} variant="outline" className="rounded-lg">取消</Button>
              <Button onClick={handleChangePassword} disabled={changingPassword} className="rounded-lg">
                {changingPassword ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                确认
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
