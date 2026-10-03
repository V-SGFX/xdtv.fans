'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, CheckCircle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const t = useTranslations('password');
  const tAuth = useTranslations('auth');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(tAuth('passwordMinLength'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('passwordsMismatch'));
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || t('resetFailed'));
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="card-neon p-8 text-center space-y-4 max-w-sm mx-4">
            <h1 className="text-xl font-bold text-text-primary">{t('noToken')}</h1>
            <p className="text-text-muted">{t('invalidLink')}</p>
            <Link href="/forgot-password" className="text-neon-purple hover:text-neon-cyan transition-colors font-medium text-sm">
              {t('requestNewLink')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-1 flex items-center justify-center relative">
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-neon-purple/5 rounded-full blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-sm mx-4"
        >
          <div className="card-neon p-8 space-y-6">
            {success ? (
              <div className="text-center space-y-4">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                <h1 className="text-2xl font-display font-bold text-text-primary">{t('passwordChanged')}</h1>
                <p className="text-text-muted">{t('redirecting')}</p>
              </div>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-neon-purple/10 flex items-center justify-center mb-4">
                    <Lock className="w-6 h-6 text-neon-cyan" />
                  </div>
                  <h1 className="text-2xl font-display font-bold text-text-primary">{t('newPassword')}</h1>
                  <p className="text-sm text-text-muted">{t('setNewPassword')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="text-sm text-neon-red text-center bg-neon-red/5 border border-neon-red/20 rounded-lg px-3 py-2">
                      {error}
                    </div>
                  )}
                  <Input
                    label={t('newPassword')}
                    type="password"
                    placeholder={tAuth('minChars')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Input
                    label={t('confirmPassword')}
                    type="password"
                    placeholder={tAuth('minChars')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full"
                    size="lg"
                  >
                    <Lock className="w-4 h-4" />
                    {loading ? t('changing') : t('changePassword')}
                  </Button>
                </form>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-neon-purple animate-spin" />
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
