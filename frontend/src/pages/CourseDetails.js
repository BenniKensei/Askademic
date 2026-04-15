import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { courseService } from '../services/services';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AnnouncementsTab from '../components/AnnouncementsTab';
import QuestionsTab from '../components/QuestionsTab';
import GuideTab from '../components/GuideTab';
import { ArrowLeft, Bell, MessageCircle, BookOpen, Users } from 'lucide-react';

/**
 * Course details shell for Q&A, announcements, and grading guide subviews.
 *
 * @returns {JSX.Element}
 *
 * State rationale:
 * - activeTab is kept local to avoid route churn when users frequently switch panes.
 * - course data lives at page level so each tab receives a consistent snapshot.
 */
const CourseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('questions');
  const [error, setError] = useState('');
  
  const isProfessor = user?.role === 'PROFESSOR';

  useEffect(() => {
    // Why dependency is [id]: data must be reloaded when navigation switches courses
    // via sidebar/dashboard links while component instance stays mounted.
    fetchCourseDetails();
    // eslint-disable-next-line
  }, [id]);

  useEffect(() => {
    // Set active tab from URL query parameter
    const tab = searchParams.get('tab');
    if (tab && ['questions', 'announcements', 'guide'].includes(tab)) {
      setActiveTab(tab);
    }
    // # TODO: sync tab changes back into URL to improve deep-link sharing.
  }, [searchParams]);

  const fetchCourseDetails = async () => {
    try {
      const response = await courseService.getCourseById(id);
      setCourse(response.data);
    } catch (error) {
      console.error('Failed to fetch course', error);
      setError('Failed to load course details');
      // # FIXME: provide retry CTA instead of static error-only state.
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
        <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`} style={{ fontFamily: 'Inter, sans-serif' }}>Loading...</div>
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
        <div className={`text-xl font-bold ${darkMode ? 'text-rose-400' : 'text-rose-600'}`} style={{ fontFamily: 'Inter, sans-serif' }}>{error}</div>
      </div>
    );
  }

  const tabs = [
    { id: 'questions', label: 'Q&A', icon: MessageCircle, color: 'cyan' },
    { id: 'announcements', label: 'Announcements', icon: Bell, color: 'rose' },
    { id: 'guide', label: 'Grading Guide', icon: BookOpen, color: 'emerald' },
  ];

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`} style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Thin separator line below navbar - dark mode only */}
      {darkMode && <div className="border-t border-white h-px" />}
      {/* Neo-Brutalist Header */}
      <header className={`sticky top-16 z-40 ${darkMode ? 'border-b bg-slate-800 border-white' : 'border-b-4 bg-white border-slate-900'}`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button
            onClick={() => navigate('/dashboard')}
            className={`flex items-center gap-2 mb-4 transition-colors px-4 py-2 rounded-lg border-2 font-bold ${darkMode ? 'text-white hover:bg-slate-700 border-transparent hover:border-white' : 'text-slate-900 hover:bg-slate-100 border-transparent hover:border-slate-900'}`}
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back to Dashboard</span>
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-3xl font-black mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{course?.name}</h1>
              <p className={`font-bold ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>{course?.description}</p>
            </div>
            <div className={`flex items-center gap-2 px-6 py-3 rounded-xl border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] ${darkMode ? 'bg-cyan-400 text-slate-900 border-white' : 'bg-slate-900 text-white border-slate-900'}`}>
              <Users className="w-5 h-5" />
              <span className="text-sm font-black">
                {course?.students?.length || 0} {course?.students?.length === 1 ? 'STUDENT' : 'STUDENTS'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar Navigation - Neo Brutalist Cards */}
          <aside className="lg:col-span-3">
            <div className="space-y-4 sticky top-32">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const bgColor = tab.color === 'cyan' ? 'bg-cyan-400' : tab.color === 'rose' ? 'bg-rose-400' : 'bg-emerald-400';
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-6 py-4 rounded-xl transition-all font-black border-4 ${
                      isActive
                        ? `${bgColor} text-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] translate-x-1 translate-y-1 ${darkMode ? 'border-white' : 'border-slate-900'}`
                        : `${darkMode ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-900 border-slate-900 hover:bg-slate-50'} shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:translate-x-1 hover:translate-y-1`
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    {tab.label}
                  </button>
                );
              })}

              {/* Professor Info Card - Below Guide Tab */}
              {course?.professor && (
                <div className={`mt-6 rounded-xl p-6 border-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] ${darkMode ? 'bg-slate-800 border-white' : 'bg-white border-slate-900'}`}>
                  <p className={`text-xs font-black uppercase tracking-wider mb-4 border-b-2 pb-2 ${darkMode ? 'text-white border-white' : 'text-slate-900 border-slate-900'}`}>
                    Professor
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-rose-400 border-2 border-slate-900 flex items-center justify-center text-slate-900 font-black text-xl">
                      {course.professor.email?.[0]?.toUpperCase() || 'P'}
                    </div>
                    <div>
                      <p className={`font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                        {course.professor.firstname || course.professor.email?.split('@')[0].split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ')}
                        {course.professor.lastname ? ' ' + course.professor.lastname : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Course Code Card - Only visible to professor */}
              {course?.courseCode && isProfessor && (
                <div className={`mt-4 rounded-xl p-6 border-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] ${darkMode ? 'bg-slate-800 border-white' : 'bg-white border-slate-900'}`}>
                  <p className={`text-xs font-black uppercase tracking-wider mb-3 border-b-2 pb-2 ${darkMode ? 'text-white border-white' : 'text-slate-900 border-slate-900'}`}>
                    Course Code
                  </p>
                  <div className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 ${darkMode ? 'bg-slate-700 border-cyan-400' : 'bg-cyan-50 border-cyan-400'}`}>
                    <p className={`font-black text-xl tracking-wider ${darkMode ? 'text-cyan-400' : 'text-slate-900'}`}>
                      {course.courseCode}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Content Area */}
          <main className="lg:col-span-9">
            <div className={`rounded-2xl border-4 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] min-h-[600px] overflow-hidden ${darkMode ? 'bg-slate-800 border-white' : 'bg-white border-slate-900'}`}>
              {activeTab === 'questions' && <QuestionsTab courseId={parseInt(id)} />}
              {activeTab === 'announcements' && <AnnouncementsTab courseId={parseInt(id)} />}
              {activeTab === 'guide' && <GuideTab courseId={parseInt(id)} course={course} />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default CourseDetails;
