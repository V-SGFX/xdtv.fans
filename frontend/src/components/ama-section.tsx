'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAuthGate } from '@/lib/auth-gate';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  HelpCircle, Send, ArrowBigUp, CheckCircle2, Clock,
  MessageSquare, ChevronDown, ChevronUp,
} from 'lucide-react';
import { countLabel } from '@/lib/plural';

interface AmaQuestion {
  id: number;
  content: string;
  upvotes: number;
  isAnswered: boolean;
  createdAt: string;
  author: { id: number; username: string; displayName: string | null; avatarUrl: string | null };
  answer?: {
    id: number;
    content: string;
    createdAt: string;
    author: { id: number; username: string; displayName: string | null; avatarUrl: string | null };
  } | null;
}

interface AmaSession {
  id: number;
  endsAt: string;
  isOpen: boolean;
  questionCount: number;
}

interface AmaSectionProps {
  postId: number;
  postAuthorId: number;
}

export function AmaSection({ postId, postAuthorId }: AmaSectionProps) {
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const [session, setSession] = useState<AmaSession | null>(null);
  const [questions, setQuestions] = useState<AmaQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const [newQuestion, setNewQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [answeringId, setAnsweringId] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerSubmitting, setAnswerSubmitting] = useState(false);

  const fetchQuestions = useCallback(async () => {
    try {
      const { data } = await api.get(`/posts/${postId}/ama/questions?sort=${sort}`);
      setSession(data.session);
      setQuestions(data.questions);
    } catch { /* */ }
    setLoading(false);
  }, [postId, sort]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const handleAsk = async () => {
    if (!newQuestion.trim()) return;
    if (!requireAuth('ask')) return;
    setSubmitting(true);
    try {
      await api.post(`/posts/${postId}/ama/questions`, { content: newQuestion.trim() });
      setNewQuestion('');
      fetchQuestions();
    } catch { /* */ }
    setSubmitting(false);
  };

  const handleUpvote = async (questionId: number) => {
    if (!requireAuth('upvote')) return;
    try {
      const { data } = await api.post(`/posts/${postId}/ama/questions/${questionId}/upvote`);
      setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, upvotes: data.upvotes } : q));
    } catch { /* */ }
  };

  const handleAnswer = async (questionId: number) => {
    if (!answerText.trim()) return;
    setAnswerSubmitting(true);
    try {
      await api.post(`/posts/${postId}/ama/questions/${questionId}/answer`, { content: answerText.trim() });
      setAnsweringId(null);
      setAnswerText('');
      fetchQuestions();
    } catch { /* */ }
    setAnswerSubmitting(false);
  };

  const isAuthor = user?.id === postAuthorId;
  const isOpen = session?.isOpen && new Date(session.endsAt) > new Date();

  const timeLeft = session ? (() => {
    const diff = new Date(session.endsAt).getTime() - Date.now();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  })() : null;

  if (loading) {
    return (
      <div className="card-neon p-6 space-y-4">
        <div className="h-6 w-40 bg-white/[0.06] rounded animate-pulse" />
        <div className="h-4 w-60 bg-white/[0.04] rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="card-neon overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06] bg-neon-purple/[0.03]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neon-purple/15 flex items-center justify-center">
              <HelpCircle className="w-4 h-4 text-neon-purple" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Ask Me Anything</h3>
              <p className="text-2xs text-white/40">
                {countLabel(session.questionCount, 'pytanie', 'pytania', 'pytań')}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold ${
            isOpen
              ? 'bg-neon-green/10 text-neon-green'
              : 'bg-white/[0.06] text-white/40'
          }`}>
            <Clock className="w-3 h-3" />
            {isOpen ? `Zostało ${timeLeft}` : 'Zakończone'}
          </div>
        </div>
      </div>

      {/* Ask question form */}
      {isOpen && (
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex gap-3">
            {user && <Avatar src={user.avatarUrl} name={user.displayName || user.username} size="sm" />}
            <div className="flex-1 space-y-2">
              <Textarea
                placeholder="Zadaj pytanie..."
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                rows={2}
              />
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAsk}
                  disabled={submitting || !newQuestion.trim()}
                >
                  <Send className="w-3.5 h-3.5" />
                  Zadaj pytanie
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sort tabs */}
      {questions.length > 1 && (
        <div className="flex gap-1 p-3 border-b border-white/[0.06]">
          {(['top', 'new'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sort === s
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {s === 'top' ? '🔥 Popularne' : '🕒 Nowe'}
            </button>
          ))}
        </div>
      )}

      {/* Questions list */}
      <div className="divide-y divide-white/[0.04]">
        <AnimatePresence>
          {questions.map((q) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4"
            >
              <div className="flex gap-3">
                {/* Upvote */}
                <div className="flex flex-col items-center gap-0.5 pt-1">
                  <button
                    onClick={() => handleUpvote(q.id)}
                    className="p-1 rounded text-white/30 hover:text-neon-purple hover:bg-neon-purple/10 transition-colors"
                  >
                    <ArrowBigUp className="w-5 h-5" />
                  </button>
                  <span className="text-xs font-bold text-white/50">{q.upvotes}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar src={q.author.avatarUrl} name={q.author.displayName || q.author.username} size="xs" />
                    <span className="text-xs font-semibold text-white/70">
                      {q.author.displayName || q.author.username}
                    </span>
                    <span className="text-2xs text-white/25">
                      {formatDistanceToNow(new Date(q.createdAt), { addSuffix: true, locale: pl })}
                    </span>
                    {q.isAnswered && (
                      <span className="flex items-center gap-0.5 text-2xs font-semibold text-neon-green">
                        <CheckCircle2 className="w-3 h-3" /> Odpowiedziano
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/80">{q.content}</p>

                  {/* Answer */}
                  {q.answer && (
                    <div className="mt-3 ml-2 pl-3 border-l-2 border-neon-purple/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar src={q.answer.author.avatarUrl} name={q.answer.author.displayName || q.answer.author.username} size="xs" />
                        <span className="text-xs font-semibold text-neon-purple">
                          {q.answer.author.displayName || q.answer.author.username}
                        </span>
                        <span className="text-2xs text-white/25">
                          {formatDistanceToNow(new Date(q.answer.createdAt), { addSuffix: true, locale: pl })}
                        </span>
                      </div>
                      <p className="text-sm text-white/70">{q.answer.content}</p>
                    </div>
                  )}

                  {/* Answer form (for post author) */}
                  {isAuthor && !q.isAnswered && (
                    <>
                      {answeringId === q.id ? (
                        <div className="mt-3 space-y-2">
                          <Textarea
                            placeholder="Napisz odpowiedź..."
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            rows={2}
                          />
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setAnsweringId(null); setAnswerText(''); }}
                            >
                              Anuluj
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleAnswer(q.id)}
                              disabled={answerSubmitting || !answerText.trim()}
                            >
                              <Send className="w-3.5 h-3.5" />
                              Odpowiedz
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAnsweringId(q.id)}
                          className="mt-2 text-xs text-neon-purple hover:text-neon-purple/80 font-medium transition-colors"
                        >
                          Odpowiedz →
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {questions.length === 0 && (
          <div className="text-center py-10">
            <MessageSquare className="w-8 h-8 text-white/15 mx-auto mb-2" />
            <p className="text-white/40 text-sm">Brak pytań</p>
            <p className="text-white/20 text-xs mt-0.5">
              {isOpen ? 'Bądź pierwszy — zadaj pytanie!' : 'Nikt nie zadał pytania w tej sesji.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
