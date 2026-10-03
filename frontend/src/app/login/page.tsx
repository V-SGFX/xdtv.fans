'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/navbar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Zap, LogIn } from 'lucide-react';
import { SocialLoginButtons } from '@/components/social-login-buttons';
import { useTranslations } from 'next-intl';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [loginStr, setLoginStr] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const t = useTranslations('auth');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginStr, password);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.error || t('loginFailed'));
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-1 flex items-center justify-center relative">
        {/* Background */}
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-neon-purple/5 rounded-full blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-sm mx-4"
        >
          <div className="card-neon p-8 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-xl bg-neon-purple/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-neon-cyan" />
              </div>
              <h1 className="text-2xl font-display font-bold text-text-primary">{t('login')}</h1>
              <p className="text-sm text-text-muted">{t('welcomeBack')}</p>
            </div>

            <SocialLoginButtons label="login" />

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border-default" />
              <span className="text-xs text-text-dimmed uppercase">{t('or')}</span>
              <div className="flex-1 h-px bg-border-default" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-sm text-neon-red text-center bg-neon-red/5 border border-neon-red/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-xs text-neon-purple hover:text-neon-cyan transition-colors">
                  {t('forgotPassword')}
                </Link>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                size="lg"
              >
                <LogIn className="w-4 h-4" />
                {loading ? t('loggingIn') : t('login')}
              </Button>
            </form>

            <p className="text-center text-sm text-text-muted">
              {t('noAccount')}{' '}
              <Link href="/register" className="text-neon-purple hover:text-neon-cyan transition-colors font-medium">
                {t('register')}
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
