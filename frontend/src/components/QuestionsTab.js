import React, { useState, useEffect } from 'react';
import { questionService, answerService } from '../services/services';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { MessageCircle, CheckCircle, AlertCircle, ChevronRight, Plus, Send, User, Clock, Trash2 } from 'lucide-react';

/**
 * @typedef {Object} QuestionsTabProps
 * @property {number} courseId Active course id used for scoped question retrieval.
 */

/**
 * Q&A workspace with optional semantic grouping mode.
 *
 * @param {QuestionsTabProps} props
 * @returns {JSX.Element}
 *
 * State rationale:
 * - `questions` and `groupedQuestions` are stored separately so toggle latency stays low.
 * - selection sets (`expandedGroupIds`, `selectedBatchQuestions`) use Set for O(1)
 *   membership checks under large groups.
 */
const QuestionsTab = ({ courseId }) => {
  const [questions, setQuestions] = useState([]);
  const [groupedQuestions, setGroupedQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState(new Set());
  const [answerText, setAnswerText] = useState('');
  const [showNewQuestionModal, setShowNewQuestionModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ title: '', content: '', anonymous: false });
  const [statusFilter, setStatusFilter] = useState('all');
  const [smartGrouping, setSmartGrouping] = useState(false);
  const [batchAnswerText, setBatchAnswerText] = useState('');
  const [batchAutoVerify, setBatchAutoVerify] = useState(true);
  const [batchAnonymous, setBatchAnonymous] = useState(false);
  const [answerAnonymous, setAnswerAnonymous] = useState(false);
  const [submittingBatch, setSubmittingBatch] = useState(false);
  const [selectedBatchQuestions, setSelectedBatchQuestions] = useState(new Set());
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const isProfessor = user?.role === 'PROFESSOR';
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    // Why dependencies include smartGrouping:
    // the same course needs a different backend payload shape when grouping mode changes.
    fetchQuestions();
    // eslint-disable-next-line
  }, [courseId, smartGrouping]);

  const fetchQuestions = async () => {
    try {
      if (smartGrouping) {
        const response = await questionService.getGroupedQuestions(courseId);
        setGroupedQuestions(response.data);
        // Also fetch regular questions for filtering
        const regularResponse = await questionService.getQuestions(courseId);
        setQuestions(regularResponse.data);
      } else {
        const response = await questionService.getQuestions(courseId);
        setQuestions(response.data);
      }
      setError(null);
    } catch (error) {
      console.error('Failed to fetch questions', error);
      setError(smartGrouping ? 'Failed to load grouped questions. AI mode may be disabled.' : 'Failed to load questions');
      // # FIXME: show actionable recovery guidance when AI mode is disabled at backend level.
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    try {
      await questionService.createQuestion({ ...newQuestion, courseId });
      setShowNewQuestionModal(false);
      setNewQuestion({ title: '', content: '', anonymous: false });
      fetchQuestions();
    } catch (error) {
      console.error('Failed to create question', error);
      setError('Failed to create question');
      // # TODO: preserve unsent form input on API failures to avoid user retyping.
    }
  };

  const handleSubmitAnswer = async (questionId) => {
    if (!answerText.trim()) return;
    try {
      await answerService.createAnswer({ questionId, content: answerText, anonymous: answerAnonymous });
      setAnswerText('');
      setAnswerAnonymous(false);
      fetchQuestions();
    } catch (error) {
      console.error('Failed to submit answer', error);
      setError('Failed to submit answer');
    }
  };

  const handleVerifyAnswer = async (questionId, answerId) => {
    try {
      await answerService.verifyAnswer(answerId);
      fetchQuestions();
    } catch (error) {
      console.error('Failed to verify answer', error);
      setError('Failed to verify answer');
    }
  };

  // Batch answer handler for professors to answer grouped questions at once
  const handleBatchAnswer = async (groupQuestionIds) => {
    if (!batchAnswerText.trim() || submittingBatch) return;

    setSubmittingBatch(true);
    try {
      await answerService.createBatchAnswer(groupQuestionIds, batchAnswerText, batchAutoVerify, batchAnonymous);
      setBatchAnswerText('');
      setBatchAnonymous(false);
      fetchQuestions();
    } catch (error) {
      console.error('Failed to submit batch answer', error);
      setError('Failed to submit batch answer');
    } finally {
      setSubmittingBatch(false);
    }
  };

  // Delete question handler (author or professor can delete)
  const handleDeleteQuestion = async (questionId) => {
    // Why use explicit confirm:
    // delete cascades to answers, so accidental clicks are expensive for classroom context.
    if (!window.confirm('Are you sure you want to delete this question? This will also delete all answers.')) {
      return;
    }
    try {
      await questionService.deleteQuestion(questionId);
      fetchQuestions();
    } catch (error) {
      console.error('Failed to delete question', error);
      setError('Failed to delete question');
    }
  };

  // Delete answer handler (author or professor can delete)
  const handleDeleteAnswer = async (answerId) => {
    if (!window.confirm('Are you sure you want to delete this answer?')) {
      return;
    }
    try {
      await answerService.deleteAnswer(answerId);
      fetchQuestions();
    } catch (error) {
      console.error('Failed to delete answer', error);
      setError('Failed to delete answer');
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const toggleQuestion = (questionId) => {
    setExpandedQuestionId(expandedQuestionId === questionId ? null : questionId);
  };

  const toggleGroup = (questionId) => {
    const newExpanded = new Set(expandedGroupIds);
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId);
    } else {
      newExpanded.add(questionId);
    }
    setExpandedGroupIds(newExpanded);
  };

  const filteredQuestions = questions.filter(q => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'unanswered') return q.answers.length === 0;
    if (statusFilter === 'answered') return q.answers.length > 0;
    return true;
  });

  const getAuthorName = (question) => {
    if (question.anonymous) return 'Anonymous';
    if (question.author?.firstname && question.author?.lastname) {
      return `${question.author.firstname} ${question.author.lastname}`;
    }
    if (question.author?.email) {
      const nameParts = question.author.email.split('@')[0].split(/[._-]/);
      return nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    return question.author?.role === 'PROFESSOR' ? 'Professor' : 'Student';
  };

  const isProfessorQuestion = (question) => {
    return question.author?.role === 'PROFESSOR';
  };

  // Filter grouped questions based on status filter
  const filteredGroupedQuestions = groupedQuestions.filter(group => {
    if (statusFilter === 'all') return true;

    const allQuestionsInGroup = [
      group.mainQuestion,
      ...(group.similarQuestions || []).map(s => s.question)
    ];

    if (statusFilter === 'unanswered') {
      return allQuestionsInGroup.some(q => q.answers.length === 0);
    }
    if (statusFilter === 'answered') {
      return allQuestionsInGroup.some(q => q.answers.length > 0);
    }
    return true;
  });

  // Batch selection helpers
  const initializeBatchSelection = (mainQuestionId, similarQuestions) => {
    const allIds = new Set([mainQuestionId, ...similarQuestions.map(s => s.question.id)]);
    setSelectedBatchQuestions(allIds);
  };

  const toggleBatchQuestion = (questionId) => {
    setSelectedBatchQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const selectAllInGroup = (mainQuestionId, similarQuestions) => {
    const allIds = [mainQuestionId, ...similarQuestions.map(s => s.question.id)];
    setSelectedBatchQuestions(new Set(allIds));
  };

  const deselectAllInGroup = () => {
    setSelectedBatchQuestions(new Set());
  };

  const unansweredCount = questions.filter(q => q.answers.length === 0).length;
  const answeredCount = questions.filter(q => q.answers.length > 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-slate-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="text-rose-400 text-5xl mb-4">⚠️</div>
        <p className="text-xl font-black text-rose-600">{error}</p>
      </div>
    );
  }

  return (
    <div className={`p-8 min-h-screen ${darkMode ? 'bg-slate-800' : 'bg-white'}`} style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Filter Bar - Neo Brutalist Pills */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-6 py-3 rounded-xl font-black transition-all border-2 ${statusFilter === 'all'
              ? `shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] ${darkMode ? 'bg-white text-slate-900 border-white' : 'bg-slate-900 text-white border-slate-900'}`
              : `${darkMode ? 'bg-slate-700 text-white border-white hover:bg-slate-600' : 'bg-white text-slate-900 border-slate-900 hover:bg-slate-50'}`
              }`}
          >
            ALL ({questions.length})
          </button>
          <button
            onClick={() => setStatusFilter('unanswered')}
            className={`px-6 py-3 rounded-xl font-black transition-all border-2 ${statusFilter === 'unanswered'
              ? `bg-rose-400 text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] ${darkMode ? 'border-white' : 'border-slate-900'}`
              : `${darkMode ? 'bg-slate-700 text-white border-white hover:bg-slate-600' : 'bg-white text-slate-900 border-slate-900 hover:bg-slate-50'}`
              }`}
          >
            UNANSWERED ({unansweredCount})
          </button>
          <button
            onClick={() => setStatusFilter('answered')}
            className={`px-6 py-3 rounded-xl font-black transition-all border-2 ${statusFilter === 'answered'
              ? `bg-emerald-400 text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] ${darkMode ? 'border-white' : 'border-slate-900'}`
              : `${darkMode ? 'bg-slate-700 text-white border-white hover:bg-slate-600' : 'bg-white text-slate-900 border-slate-900 hover:bg-slate-50'}`
              }`}
          >
            ANSWERED ({answeredCount})
          </button>
        </div>

        <button
          onClick={() => setShowNewQuestionModal(true)}
          className={`flex items-center gap-2 px-6 py-3 bg-cyan-400 text-slate-900 rounded-xl font-black hover:translate-x-1 hover:translate-y-1 hover:shadow-none shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] border-2 transition-all ${darkMode ? 'border-white' : 'border-slate-900'}`}
        >
          <Plus className="w-5 h-5" />
          ASK QUESTION
        </button>
      </div>

      {/* Smart Grouping Toggle */}
      <div className={`mb-6 flex items-center justify-between p-5 rounded-2xl border-4 ${darkMode ? 'bg-slate-700 border-white' : 'bg-violet-50 border-violet-600'}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <h3 className={`font-black text-sm uppercase tracking-wide ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              AI Smart Grouping
            </h3>
            <p className={`text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>
              Group similar questions using semantic search
            </p>
          </div>
        </div>
        <button
          onClick={() => setSmartGrouping(!smartGrouping)}
          className={`relative w-16 h-8 rounded-full border-4 transition-all ${smartGrouping
            ? `bg-emerald-400 ${darkMode ? 'border-white' : 'border-slate-900'}`
            : `${darkMode ? 'bg-slate-600 border-white' : 'bg-slate-200 border-slate-900'}`
            }`}
        >
          <div className={`absolute top-0.5 w-5 h-5 bg-slate-900 rounded-full transition-transform ${smartGrouping ? 'translate-x-8' : 'translate-x-0.5'
            }`} />
        </button>
      </div>

      {/* Questions Feed */}
      {smartGrouping ? (
        // Smart Grouped View
        filteredGroupedQuestions.length === 0 ? (
          <div className={`text-center rounded-2xl p-16 border-4 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] ${darkMode ? 'bg-slate-700 border-white' : 'bg-white border-slate-900'}`}>
            <MessageCircle className={`w-16 h-16 mx-auto mb-4 opacity-30 ${darkMode ? 'text-white' : 'text-slate-900'}`} />
            <h3 className={`text-2xl font-black mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              {statusFilter === 'all' ? 'NO GROUPED QUESTIONS' : `NO ${statusFilter.toUpperCase()} GROUPS`}
            </h3>
            <p className={`font-bold ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>
              {statusFilter === 'all'
                ? 'Questions need embeddings to be grouped. AI mode may be disabled.'
                : `No groups match the "${statusFilter}" filter.`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredGroupedQuestions.map((group) => {
              const mainQuestion = group.mainQuestion;
              const similarQuestions = group.similarQuestions || [];
              const isGroupExpanded = expandedGroupIds.has(mainQuestion.id);
              const isMainExpanded = expandedQuestionId === mainQuestion.id;
              const isUnanswered = mainQuestion.answers.length === 0;
              const hasVerifiedAnswer = mainQuestion.answers.some(a => a.verified);

              return (
                <div
                  key={mainQuestion.id}
                  className={`rounded-2xl border-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all overflow-hidden ${user?.id == mainQuestion.author?.id
                    ? darkMode ? 'bg-cyan-900/20 border-cyan-400' : 'bg-cyan-50 border-cyan-400'
                    : isProfessorQuestion(mainQuestion)
                      ? darkMode
                        ? 'bg-indigo-800 border-indigo-400'
                        : 'bg-indigo-50 border-indigo-600'
                      : darkMode
                        ? 'bg-slate-700 border-white'
                        : 'bg-white border-slate-900'
                    }`}
                >
                  {/* Main Question Header */}
                  <div
                    onClick={() => toggleQuestion(mainQuestion.id)}
                    className={`p-6 cursor-pointer transition-colors ${darkMode ? 'hover:bg-slate-600' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          {isProfessorQuestion(mainQuestion) && (
                            <span className={`px-3 py-1 bg-rose-400 text-slate-900 border-2 rounded-full text-xs font-black ${darkMode ? 'border-white' : 'border-slate-900'}`}>
                              👨‍🏫 PROFESSOR
                            </span>
                          )}
                          {similarQuestions.length > 0 && (
                            <span className={`px-3 py-1 bg-violet-400 text-slate-900 border-2 rounded-full text-xs font-black ${darkMode ? 'border-white' : 'border-slate-900'}`}>
                              🤖 {similarQuestions.length} SIMILAR
                            </span>
                          )}
                          <h3 className={`text-xl font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            {mainQuestion.title}
                          </h3>
                          <div className="flex items-center gap-2">
                            {hasVerifiedAnswer && (
                              <span className={`px-3 py-1 bg-emerald-400 text-slate-900 border-2 rounded-full text-xs font-black flex items-center gap-1 ${darkMode ? 'border-white' : 'border-slate-900'}`}>
                                <CheckCircle className="w-3 h-3" />
                                VERIFIED
                              </span>
                            )}
                            {isUnanswered && (
                              <span className={`px-3 py-1 bg-rose-400 text-slate-900 border-2 rounded-full text-xs font-black flex items-center gap-1 ${darkMode ? 'border-white' : 'border-slate-900'}`}>
                                <AlertCircle className="w-3 h-3" />
                                UNANSWERED
                              </span>
                            )}
                          </div>
                        </div>

                        <p className={`text-sm font-medium mb-4 line-clamp-2 ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>
                          {mainQuestion.content}
                        </p>

                        <div className={`flex items-center gap-4 text-xs font-bold ${darkMode ? 'text-slate-400' : 'text-slate-900'}`}>
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            <span>{getAuthorName(mainQuestion)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatTimeAgo(mainQuestion.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageCircle className="w-4 h-4" />
                            <span>{mainQuestion.answers.length} ANSWERS</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {(user?.id === mainQuestion.author?.id || isProfessor || isAdmin) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(mainQuestion.id); }}
                            className={`p-2 rounded-lg transition-colors ${darkMode
                              ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400'
                              : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}
                            title="Delete question"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                        <ChevronRight
                          className={`w-8 h-8 flex-shrink-0 mt-1 transition-transform ${isMainExpanded ? 'rotate-90' : ''
                            } ${darkMode ? 'text-white' : 'text-slate-900'}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Similar Questions Accordion */}
                  {similarQuestions.length > 0 && (
                    <div className={`border-t-4 ${darkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                      <button
                        onClick={() => {
                          const wasExpanded = expandedGroupIds.has(mainQuestion.id);
                          toggleGroup(mainQuestion.id);
                          // Initialize batch selection with all questions when expanding
                          if (!wasExpanded) {
                            initializeBatchSelection(mainQuestion.id, similarQuestions);
                          }
                        }}
                        className={`w-full p-4 flex items-center justify-between font-black text-sm transition-colors ${darkMode ? 'bg-slate-600 hover:bg-slate-500 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-900'
                          }`}
                      >
                        <span>⚡ SIMILAR QUESTIONS ({similarQuestions.length})</span>
                        <ChevronRight className={`w-5 h-5 transition-transform ${isGroupExpanded ? 'rotate-90' : ''}`} />
                      </button>

                      {isGroupExpanded && (
                        <div className={`p-4 space-y-3 ${darkMode ? 'bg-slate-600' : 'bg-slate-50'}`}>
                          {similarQuestions.map((similar) => (
                            <div
                              key={similar.question.id}
                              className={`p-4 rounded-xl border-2 ${darkMode ? 'bg-slate-700 border-white' : 'bg-white border-slate-900'}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className={`font-black text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                      {similar.question.title}
                                    </h4>
                                    <span className={`px-2 py-0.5 bg-violet-400 text-slate-900 border-2 rounded-full text-xs font-black ${darkMode ? 'border-white' : 'border-slate-900'}`}>
                                      {Math.round(similar.similarityScore * 100)}% MATCH
                                    </span>
                                  </div>
                                  <p className={`text-xs font-medium mb-2 line-clamp-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                    {similar.question.content}
                                  </p>
                                  <div className={`flex items-center gap-3 text-xs font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    <span>{getAuthorName(similar.question)}</span>
                                    <span>•</span>
                                    <span>{similar.question.answers.length} answers</span>
                                    <span>•</span>
                                    <span>{formatTimeAgo(similar.question.createdAt)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* PROFESSOR: Batch Answer Panel with Selective Targeting */}
                  {isProfessor && similarQuestions.length > 0 && isGroupExpanded && (() => {
                    const allGroupQuestionIds = [mainQuestion.id, ...similarQuestions.map(s => s.question.id)];
                    const totalQuestions = allGroupQuestionIds.length;
                    const selectedCount = allGroupQuestionIds.filter(id => selectedBatchQuestions.has(id)).length;
                    const allSelected = selectedCount === totalQuestions;
                    const noneSelected = selectedCount === 0;

                    return (
                      <div className={`border-t-4 p-6 ${darkMode ? 'border-violet-400 bg-violet-900/30' : 'border-violet-600 bg-violet-50'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">🚀</span>
                            <div>
                              <h4 className={`font-black text-sm uppercase tracking-wide ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                BATCH ANSWER ({selectedCount}/{totalQuestions} SELECTED)
                              </h4>
                              <p className={`text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                Select which questions should receive your answer
                              </p>
                            </div>
                          </div>

                          {/* Select All / Deselect All */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => selectAllInGroup(mainQuestion.id, similarQuestions)}
                              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${allSelected
                                ? `${darkMode ? 'bg-slate-600 text-slate-400' : 'bg-slate-200 text-slate-500'}`
                                : `${darkMode ? 'bg-emerald-400 text-slate-900 hover:bg-emerald-300' : 'bg-emerald-500 text-white hover:bg-emerald-400'}`
                                }`}
                              disabled={allSelected}
                            >
                              SELECT ALL
                            </button>
                            <button
                              onClick={() => deselectAllInGroup()}
                              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${noneSelected
                                ? `${darkMode ? 'bg-slate-600 text-slate-400' : 'bg-slate-200 text-slate-500'}`
                                : `${darkMode ? 'bg-rose-400 text-slate-900 hover:bg-rose-300' : 'bg-rose-500 text-white hover:bg-rose-400'}`
                                }`}
                              disabled={noneSelected}
                            >
                              DESELECT ALL
                            </button>
                          </div>
                        </div>

                        {/* Question Selection Checkboxes */}
                        <div className={`rounded-xl p-4 mb-4 space-y-2 ${darkMode ? 'bg-slate-700' : 'bg-white'} border-2 ${darkMode ? 'border-slate-500' : 'border-slate-300'}`}>
                          {/* Main Question */}
                          <label className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedBatchQuestions.has(mainQuestion.id)
                            ? darkMode ? 'bg-violet-900/50' : 'bg-violet-100'
                            : darkMode ? 'hover:bg-slate-600' : 'hover:bg-slate-50'
                            }`}>
                            <input
                              type="checkbox"
                              checked={selectedBatchQuestions.has(mainQuestion.id)}
                              onChange={() => toggleBatchQuestion(mainQuestion.id)}
                              className="w-5 h-5 rounded border-2 border-violet-500 text-violet-600 focus:ring-violet-400"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 bg-violet-400 text-slate-900 rounded-full text-xs font-black`}>MAIN</span>
                                <span className={`font-bold text-sm truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {mainQuestion.title}
                                </span>
                                {mainQuestion.answers.length === 0 && (
                                  <span className={`px-2 py-0.5 bg-rose-400 text-slate-900 rounded-full text-xs font-black`}>UNANSWERED</span>
                                )}
                              </div>
                            </div>
                          </label>

                          {/* Similar Questions */}
                          {similarQuestions.map((similar) => (
                            <label
                              key={similar.question.id}
                              className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedBatchQuestions.has(similar.question.id)
                                ? darkMode ? 'bg-violet-900/50' : 'bg-violet-100'
                                : darkMode ? 'hover:bg-slate-600' : 'hover:bg-slate-50'
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedBatchQuestions.has(similar.question.id)}
                                onChange={() => toggleBatchQuestion(similar.question.id)}
                                className="w-5 h-5 rounded border-2 border-violet-500 text-violet-600 focus:ring-violet-400"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 bg-cyan-400 text-slate-900 rounded-full text-xs font-black`}>
                                    {Math.round(similar.similarityScore * 100)}%
                                  </span>
                                  <span className={`font-bold text-sm truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                    {similar.question.title}
                                  </span>
                                  {similar.question.answers.length === 0 && (
                                    <span className={`px-2 py-0.5 bg-rose-400 text-slate-900 rounded-full text-xs font-black`}>UNANSWERED</span>
                                  )}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>

                        <textarea
                          value={batchAnswerText}
                          onChange={(e) => setBatchAnswerText(e.target.value)}
                          className={`w-full px-4 py-3 border-4 rounded-lg focus:outline-none focus:ring-4 focus:ring-violet-400 resize-none text-sm font-medium ${darkMode
                            ? 'bg-slate-700 border-white text-white placeholder-slate-400'
                            : 'bg-white border-slate-900 text-slate-900 placeholder-slate-400'
                            }`}
                          rows="4"
                          placeholder="Write a comprehensive answer that addresses the selected questions..."
                        />

                        <div className="flex items-center justify-between mt-4">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={batchAutoVerify}
                              onChange={(e) => setBatchAutoVerify(e.target.checked)}
                              className="w-5 h-5 border-4 border-slate-900 rounded focus:ring-4 focus:ring-violet-400"
                            />
                            <span className={`text-sm font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                              ✅ Auto-verify answers
                            </span>
                          </label>

                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={batchAnonymous}
                              onChange={(e) => setBatchAnonymous(e.target.checked)}
                              className="w-5 h-5 border-4 border-slate-900 rounded focus:ring-4 focus:ring-violet-400"
                            />
                            <span className={`text-sm font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                              🕵️ Anonymous
                            </span>
                          </label>

                          <button
                            onClick={() => {
                              const selectedIds = Array.from(selectedBatchQuestions);
                              handleBatchAnswer(selectedIds);
                            }}
                            disabled={!batchAnswerText.trim() || submittingBatch || selectedCount === 0}
                            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed ${darkMode
                              ? 'bg-violet-400 text-slate-900 border-2 border-white hover:bg-violet-300'
                              : 'bg-violet-600 text-white border-2 border-slate-900 hover:bg-violet-500'
                              } shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]`}
                          >
                            <Send className="w-4 h-4" />
                            {submittingBatch ? 'POSTING...' : selectedCount === 0 ? 'SELECT QUESTIONS' : `POST TO ${selectedCount} QUESTION${selectedCount !== 1 ? 'S' : ''}`}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Main Question Expanded Answers (same as before) */}
                  {isMainExpanded && (
                    <div className={`p-6 ${darkMode ? 'bg-slate-600' : 'bg-slate-50'}`}>
                      <div className={`mb-6 pb-6 ${darkMode ? 'border-b-2 border-slate-400' : 'border-b-2 border-slate-300'}`}>
                        <h4 className={`font-black mb-3 text-sm uppercase tracking-wide ${darkMode ? 'text-white' : 'text-slate-900'}`}>FULL QUESTION</h4>
                        <p className={`font-medium whitespace-pre-wrap ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>{mainQuestion.content}</p>
                      </div>

                      {mainQuestion.answers.length > 0 ? (
                        <div className="space-y-4 mb-6">
                          <h4 className={`font-black mb-4 text-sm uppercase tracking-wide ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            ANSWERS ({mainQuestion.answers.length})
                          </h4>
                          {mainQuestion.answers.map((answer) => (
                            <div
                              key={answer.id}
                              className={`rounded-2xl p-5 border-4 ${answer.verified
                                ? `bg-emerald-400 ${darkMode ? 'border-white' : 'border-slate-900'}`
                                : `${darkMode ? 'bg-slate-700 border-white' : 'bg-white border-slate-900'}`
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-12 h-12 rounded-full bg-cyan-400 border-2 flex items-center justify-center text-slate-900 font-black flex-shrink-0 ${darkMode ? 'border-white' : 'border-slate-900'}`}>
                                  {answer.anonymous ? '?' : (answer.author?.firstname?.[0] || 'U')}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`font-black text-sm ${answer.verified || !darkMode ? 'text-slate-900' : 'text-white'}`}>
                                      {answer.anonymous
                                        ? 'Anonymous'
                                        : answer.author
                                          ? `${answer.author.role === 'PROFESSOR' ? 'Prof. ' : ''}${answer.author.firstname} ${answer.author.lastname}`
                                          : 'Unknown User'}
                                    </span>
                                    {answer.author?.role === 'PROFESSOR' && !answer.anonymous && (
                                      <span className={`px-2 py-1 bg-rose-400 text-slate-900 border-2 rounded-full text-xs font-black ${darkMode ? 'border-white' : 'border-slate-900'}`}>
                                        PROFESSOR
                                      </span>
                                    )}
                                    {answer.verified && (
                                      <div className="flex items-center gap-1 text-slate-900 text-xs font-black">
                                        <CheckCircle className="w-4 h-4" />
                                        VERIFIED
                                      </div>
                                    )}
                                  </div>
                                  <p className={`font-medium mb-2 text-sm whitespace-pre-wrap ${answer.verified || !darkMode ? 'text-slate-900' : 'text-slate-200'}`}>
                                    {answer.content}
                                  </p>
                                  <div className={`flex items-center gap-2 text-xs font-bold ${answer.verified || !darkMode ? 'text-slate-900' : 'text-slate-400'}`}>
                                    <Clock className="w-3 h-3" />
                                    {formatTimeAgo(answer.createdAt)}
                                  </div>
                                </div>
                                {isProfessor && !answer.verified && (
                                  <button
                                    onClick={() => handleVerifyAnswer(mainQuestion.id, answer.id)}
                                    className={`px-4 py-2 bg-emerald-400 text-slate-900 border-2 rounded-lg text-sm font-black hover:bg-emerald-300 transition-colors flex-shrink-0 ${darkMode ? 'border-white' : 'border-slate-900'}`}
                                  >
                                    VERIFY
                                  </button>
                                )}
                                {(user?.id === answer.author?.id || isProfessor || isAdmin) && (
                                  <button
                                    onClick={() => handleDeleteAnswer(answer.id)}
                                    className={`p-2 rounded-lg transition-colors ml-2 ${darkMode
                                      ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400'
                                      : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}
                                    title="Delete answer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={`rounded-2xl p-8 text-center border-4 mb-6 ${darkMode ? 'bg-slate-700 border-white' : 'bg-white border-slate-900'}`}>
                          <MessageCircle className={`w-12 h-12 opacity-30 mx-auto mb-3 ${darkMode ? 'text-white' : 'text-slate-900'}`} />
                          <p className={`font-bold ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>No answers yet. Be the first to help!</p>
                        </div>
                      )}

                      <div className={`rounded-2xl p-5 border-4 ${darkMode ? 'bg-slate-700 border-white' : 'bg-white border-slate-900'}`}>
                        <label className={`block text-sm font-black mb-3 uppercase tracking-wider ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                          YOUR ANSWER
                        </label>
                        <textarea
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          className={`w-full px-4 py-3 border-4 rounded-lg focus:outline-none focus:ring-4 focus:ring-cyan-400 resize-none text-sm font-medium ${darkMode
                            ? 'bg-slate-600 border-white text-white placeholder-slate-400'
                            : 'bg-white border-slate-900 text-slate-900 placeholder-slate-400'
                            }`}
                          rows="3"
                          placeholder="Share your knowledge..."
                        />
                        <div className="flex items-center justify-between mt-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={answerAnonymous}
                              onChange={(e) => setAnswerAnonymous(e.target.checked)}
                              className={`w-4 h-4 rounded border-2 focus:ring-2 ${darkMode ? 'border-white bg-slate-600' : 'border-slate-900 bg-white'}`}
                            />
                            <span className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              Answer Anonymously
                            </span>
                          </label>
                        </div>
                        <button
                          onClick={() => handleSubmitAnswer(mainQuestion.id)}
                          disabled={!answerText.trim()}
                          className={`mt-4 flex items-center gap-2 px-6 py-3 border-2 rounded-lg font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed ${darkMode
                            ? 'bg-cyan-400 text-slate-900 border-white hover:bg-cyan-300'
                            : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                            }`}
                        >
                          <Send className="w-4 h-4" />
                          SUBMIT ANSWER
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        // Regular View (existing code)
        filteredQuestions.length === 0 ? (
          <div className={`text-center rounded-2xl p-16 border-4 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] ${darkMode ? 'bg-slate-700 border-white' : 'bg-white border-slate-900'}`}>
            <MessageCircle className={`w-16 h-16 mx-auto mb-4 opacity-30 ${darkMode ? 'text-white' : 'text-slate-900'}`} />
            <h3 className={`text-2xl font-black mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              {statusFilter === 'all' ? 'NO QUESTIONS YET' : `NO ${statusFilter.toUpperCase()} QUESTIONS`}
            </h3>
            <p className={`font-bold ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>Be the first to ask a question!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredQuestions.map((question) => {
              const isExpanded = expandedQuestionId === question.id;
              const isUnanswered = question.answers.length === 0;
              const hasVerifiedAnswer = question.answers.some(a => a.verified);

              return (
                <div
                  key={question.id}
                  className={`rounded-2xl border-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all overflow-hidden ${user?.id == question.author?.id
                    ? darkMode ? 'bg-cyan-900/20 border-cyan-400' : 'bg-cyan-50 border-cyan-400'
                    : isProfessorQuestion(question)
                      ? darkMode
                        ? 'bg-indigo-800 border-indigo-400'
                        : 'bg-indigo-50 border-indigo-600'
                      : darkMode
                        ? 'bg-slate-700 border-white'
                        : 'bg-white border-slate-900'
                    }`}
                >
                  {/* Question Header */}
                  <div
                    onClick={() => toggleQuestion(question.id)}
                    className={`p-6 cursor-pointer transition-colors ${darkMode ? 'hover:bg-slate-600' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          {isProfessorQuestion(question) && (
                            <span className={`px-3 py-1 bg-rose-400 text-slate-900 border-2 rounded-full text-xs font-black ${darkMode ? 'border-white' : 'border-slate-900'}`}>
                              👨‍🏫 PROFESSOR
                            </span>
                          )}
                          <h3 className={`text-xl font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            {question.title}
                          </h3>
                          <div className="flex items-center gap-2">
                            {hasVerifiedAnswer && (
                              <span className={`px-3 py-1 bg-emerald-400 text-slate-900 border-2 rounded-full text-xs font-black flex items-center gap-1 ${darkMode ? 'border-white' : 'border-slate-900'}`}>
                                <CheckCircle className="w-3 h-3" />
                                VERIFIED
                              </span>
                            )}
                            {isUnanswered && (
                              <span className={`px-3 py-1 bg-rose-400 text-slate-900 border-2 rounded-full text-xs font-black flex items-center gap-1 ${darkMode ? 'border-white' : 'border-slate-900'}`}>
                                <AlertCircle className="w-3 h-3" />
                                UNANSWERED
                              </span>
                            )}
                          </div>
                        </div>

                        <p className={`text-sm font-medium mb-4 line-clamp-2 ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>
                          {question.content}
                        </p>

                        <div className={`flex items-center gap-4 text-xs font-bold ${darkMode ? 'text-slate-400' : 'text-slate-900'}`}>
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            <span>{getAuthorName(question)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatTimeAgo(question.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageCircle className="w-4 h-4" />
                            <span>{question.answers.length} ANSWERS</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Delete Button (Author or Professor or Admin) */}
                        {(user?.id == question.author?.id || isProfessor || isAdmin) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(question.id); }}
                            className={`p-2 rounded-lg transition-colors ${darkMode
                              ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400'
                              : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}
                            title="Delete question"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                        {/* Expand Icon */}
                        <ChevronRight
                          className={`w-8 h-8 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''
                            } ${darkMode ? 'text-white' : 'text-slate-900'}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Answers Section */}
                  {isExpanded && (
                    <div className={`p-6 ${darkMode ? 'bg-slate-600' : 'bg-slate-50'}`}>
                      {/* Full Question Content */}
                      <div className={`mb-6 pb-6 ${darkMode ? 'border-b-2 border-slate-400' : 'border-b-2 border-slate-300'}`}>
                        <h4 className={`font-black mb-3 text-sm uppercase tracking-wide ${darkMode ? 'text-white' : 'text-slate-900'}`}>FULL QUESTION</h4>
                        <p className={`font-medium whitespace-pre-wrap ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>{question.content}</p>
                      </div>

                      {/* Answers List */}
                      {question.answers.length > 0 ? (
                        <div className="space-y-4 mb-6">
                          <h4 className={`font-black mb-4 text-sm uppercase tracking-wide ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            ANSWERS ({question.answers.length})
                          </h4>
                          {question.answers.map((answer) => (
                            <div
                              key={answer.id}
                              className={`rounded-2xl p-5 border-4 ${user?.id == answer.author?.id
                                  ? darkMode ? 'bg-cyan-900/20 border-cyan-400' : 'bg-cyan-50 border-cyan-400'
                                  : answer.verified
                                    ? `bg-emerald-400 ${darkMode ? 'border-white' : 'border-slate-900'}`
                                    : `${darkMode ? 'bg-slate-700 border-white' : 'bg-white border-slate-900'}`
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-12 h-12 rounded-full bg-cyan-400 border-2 flex items-center justify-center text-slate-900 font-black flex-shrink-0 ${darkMode ? 'border-white' : 'border-slate-900'}`}>
                                  {answer.anonymous ? '?' : (answer.author?.firstname?.[0] || 'U')}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`font-black text-sm ${answer.verified || !darkMode ? 'text-slate-900' : 'text-white'}`}>
                                      {answer.anonymous
                                        ? 'Anonymous'
                                        : answer.author
                                          ? `${answer.author.role === 'PROFESSOR' ? 'Prof. ' : ''}${answer.author.firstname} ${answer.author.lastname}`
                                          : 'Unknown User'}
                                    </span>
                                    {answer.author?.role === 'PROFESSOR' && !answer.anonymous && (
                                      <span className={`px-2 py-1 bg-rose-400 text-slate-900 border-2 rounded-full text-xs font-black ${darkMode ? 'border-white' : 'border-slate-900'}`}>
                                        PROFESSOR
                                      </span>
                                    )}
                                    {answer.verified && (
                                      <div className="flex items-center gap-1 text-slate-900 text-xs font-black">
                                        <CheckCircle className="w-4 h-4" />
                                        VERIFIED
                                      </div>
                                    )}
                                  </div>
                                  <p className={`font-medium mb-2 text-sm whitespace-pre-wrap ${answer.verified || !darkMode ? 'text-slate-900' : 'text-slate-200'}`}>
                                    {answer.content}
                                  </p>
                                  <div className={`flex items-center gap-2 text-xs font-bold ${answer.verified || !darkMode ? 'text-slate-900' : 'text-slate-400'}`}>
                                    <Clock className="w-3 h-3" />
                                    {formatTimeAgo(answer.createdAt)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {isProfessor && !answer.verified && (
                                    <button
                                      onClick={() => handleVerifyAnswer(question.id, answer.id)}
                                      className={`px-4 py-2 bg-emerald-400 text-slate-900 border-2 rounded-lg text-sm font-black hover:bg-emerald-300 transition-colors ${darkMode ? 'border-white' : 'border-slate-900'}`}
                                    >
                                      VERIFY
                                    </button>
                                  )}
                                  {/* Delete button for answer author or professor or admin */}
                                  {(user?.id == answer.author?.id || isProfessor || isAdmin) && (
                                    <button
                                      onClick={() => handleDeleteAnswer(answer.id)}
                                      className={`p-2 rounded-lg transition-colors ${darkMode
                                        ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400'
                                        : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}
                                      title="Delete answer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={`rounded-2xl p-8 text-center border-4 mb-6 ${darkMode ? 'bg-slate-700 border-white' : 'bg-white border-slate-900'}`}>
                          <MessageCircle className={`w-12 h-12 opacity-30 mx-auto mb-3 ${darkMode ? 'text-white' : 'text-slate-900'}`} />
                          <p className={`font-bold ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>No answers yet. Be the first to help!</p>
                        </div>
                      )}

                      {/* Answer Input */}
                      <div className={`rounded-2xl p-5 border-4 ${darkMode ? 'bg-slate-700 border-white' : 'bg-white border-slate-900'}`}>
                        <label className={`block text-sm font-black mb-3 uppercase tracking-wider ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                          YOUR ANSWER
                        </label>
                        <textarea
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          className={`w-full px-4 py-3 border-4 rounded-lg focus:outline-none focus:ring-4 focus:ring-cyan-400 resize-none text-sm font-medium ${darkMode
                            ? 'bg-slate-600 border-white text-white placeholder-slate-400'
                            : 'bg-white border-slate-900 text-slate-900 placeholder-slate-400'
                            }`}
                          rows="3"
                          placeholder="Share your knowledge..."
                        />
                        <div className="flex items-center justify-between mt-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={answerAnonymous}
                              onChange={(e) => setAnswerAnonymous(e.target.checked)}
                              className={`w-4 h-4 rounded border-2 focus:ring-2 ${darkMode ? 'border-white bg-slate-600' : 'border-slate-900 bg-white'}`}
                            />
                            <span className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              Answer Anonymously
                            </span>
                          </label>
                        </div>
                        <button
                          onClick={() => handleSubmitAnswer(question.id)}
                          disabled={!answerText.trim()}
                          className={`mt-4 flex items-center gap-2 px-6 py-3 border-2 rounded-lg font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed ${darkMode
                            ? 'bg-cyan-400 text-slate-900 border-white hover:bg-cyan-300'
                            : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                            }`}
                        >
                          <Send className="w-4 h-4" />
                          SUBMIT ANSWER
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* New Question Modal - Neo Brutalist */}
      {showNewQuestionModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-8 max-w-2xl w-full">
            <h2 className="text-3xl font-black text-slate-900 mb-6 uppercase">ASK A QUESTION</h2>
            <form onSubmit={handleCreateQuestion}>
              <div className="mb-5">
                <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-wide">
                  QUESTION TITLE
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border-4 border-slate-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-cyan-400 font-bold text-slate-900"
                  placeholder="e.g., How do I implement authentication?"
                  value={newQuestion.title}
                  onChange={(e) => setNewQuestion({ ...newQuestion, title: e.target.value })}
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-wide">
                  DETAILS
                </label>
                <textarea
                  required
                  value={newQuestion.content}
                  onChange={(e) => setNewQuestion({ ...newQuestion, content: e.target.value })}
                  className="w-full px-4 py-3 border-4 border-slate-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-cyan-400 resize-none font-medium text-slate-900"
                  rows="6"
                  placeholder="Provide more details about your question..."
                />
              </div>
              <div className="mb-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newQuestion.anonymous}
                    onChange={(e) => setNewQuestion({ ...newQuestion, anonymous: e.target.checked })}
                    className="w-5 h-5 border-4 border-slate-900 rounded focus:ring-4 focus:ring-cyan-400 text-slate-900"
                  />
                  <span className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Ask Anonymously
                  </span>
                </label>
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowNewQuestionModal(false)}
                  className="flex-1 px-5 py-3 border-4 border-slate-900 text-slate-900 rounded-xl font-black hover:bg-slate-100 transition-all uppercase"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="flex-1 px-5 py-3 bg-slate-900 text-white border-4 border-slate-900 rounded-xl font-black hover:bg-slate-800 transition-all uppercase"
                >
                  POST QUESTION
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionsTab;
