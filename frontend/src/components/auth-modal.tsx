'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Zap, LogIn, UserPlus, Mail, Lock, User } from 'lucide-react';
import { SocialLoginButtons } from '@/components/social-login-buttons';
import { useTranslations } from 'next-intl';

type Tab = 'login' | 'register';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  /** Reason the modal was triggered — shown as a subtitle */
  reason?: string;
}

export function AuthModal({ open, onClose, reason }: AuthModalProps) {
  const { login, register } = useAuth();
  const t = useTranslations('auth');
  const [tab, setTab] = useState<Tab>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Login fields
  const [loginStr, setLoginStr] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Register fields
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPass, setRegPass] = useState('');

  const resetForm = () => {
    setError('');
    setLoginStr('');
    setLoginPass('');
    setRegEmail('');
    setRegUsername('');
    setRegPass('');
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginStr, loginPass);
      resetForm();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || t('loginFailed'));
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (regPass.length < 8) {
      setError(t('passwordMinLength'));
      return;
    }
    setLoading(true);
    try {
      await register(regEmail, regUsername, regPass);
      resetForm();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || t('registerFailed'));
    }
    setLoading(false);
  };

  const reasonTexts: Record<string, string> = {
    like: t('loginToLike'),
    vote: t('loginToVote'),
    comment: t('loginToComment'),
    chat: t('loginToChat'),
    follow: t('loginToFollow'),
    react: t('loginToReact'),
    default: t('loginToContinue'),
  };

  const subtitle = reason ? (reasonTexts[reason] || reasonTexts.default) : t('joinCommunity');

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-neon p-6 space-y-5">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-dark-700"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-xl bg-neon-purple/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-neon-cyan" />
                </div>
                <h2 className="text-xl font-display font-bold text-text-primary">
                  {tab === 'login' ? t('login') : t('register')}
                </h2>
                <p className="text-sm text-text-muted">{subtitle}</p>
              </div>

              {/* Social login */}
              <SocialLoginButtons label={tab === 'register' ? 'register' : 'login'} />

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border-default" />
                <span className="text-xs text-text-dimmed uppercase">{t('or')}</span>
                <div className="flex-1 h-px bg-border-default" />
              </div>

              {/* Tab switcher */}
              <div className="flex bg-dark-800 rounded-lg p-0.5">
                <button
                  onClick={() => switchTab('login')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all ${
                    tab === 'login'
                      ? 'bg-dark-700 text-neon-cyan shadow-sm'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  {t('loginTab')}
                </button>
                <button
                  onClick={() => switchTab('register')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all ${
                    tab === 'register'
                      ? 'bg-dark-700 text-neon-cyan shadow-sm'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {t('registerTab')}
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="text-sm text-neon-red text-center bg-neon-red/5 border border-neon-red/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {/* Forms */}
              {tab === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-3">
                  <Input
                    label={t('emailOrUsername')}
                    type="text"
                    placeholder="jan@example.com"
                    value={loginStr}
                    onChange={(e) => setLoginStr(e.target.value)}
                    required
                  />
                  <Input
                    label={t('password')}
                    type="password"
                    placeholder="••••••••"
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    required
                  />
                  <Button type="submit" disabled={loading} className="w-full" size="lg">
                    <LogIn className="w-4 h-4" />
                    {loading ? t('loggingIn') : t('login')}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3">
                  <Input
                    label={t('email')}
                    type="email"
                    placeholder="jan@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                  <Input
                    label={t('username')}
                    type="text"
                    placeholder="jan123"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    required
                  />
                  <Input
                    label={t('password')}
                    type="password"
                    placeholder={t('minChars')}
                    value={regPass}
                    onChange={(e) => setRegPass(e.target.value)}
                    required
                  />
                  <Button type="submit" disabled={loading} className="w-full" size="lg">
                    <UserPlus className="w-4 h-4" />
                    {loading ? t('registering') : t('register')}
                  </Button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
