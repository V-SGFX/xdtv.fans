'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const t = useTranslations('password');
  const tAuth = useTranslations('auth');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || t('genericError'));
    }
    setLoading(false);
  };

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
            {sent ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-neon-purple/10 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-neon-cyan" />
                </div>
                <h1 className="text-2xl font-display font-bold text-text-primary">{tAuth('checkEmail')}</h1>
                <p className="text-text-muted">
                  {t('resetSent', { email })}
                </p>
                <p className="text-sm text-text-dimmed">{t('linkValid')}</p>
                <Link href="/login" className="text-neon-purple hover:text-neon-cyan transition-colors font-medium text-sm inline-flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" /> {tAuth('backToLogin')}
                </Link>
              </div>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-neon-purple/10 flex items-center justify-center mb-4">
                    <Mail className="w-6 h-6 text-neon-cyan" />
                  </div>
                  <h1 className="text-2xl font-display font-bold text-text-primary">{t('title')}</h1>
                  <p className="text-sm text-text-muted">{t('enterEmail')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="text-sm text-neon-red text-center bg-neon-red/5 border border-neon-red/20 rounded-lg px-3 py-2">
                      {error}
                    </div>
                  )}
                  <Input
                    label="Email"
                    type="email"
                    placeholder="jan@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? t('sending') : t('sendResetLink')}
                  </Button>
                </form>

                <p className="text-center text-sm text-text-muted">
                  <Link href="/login" className="text-neon-purple hover:text-neon-cyan transition-colors font-medium inline-flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" /> {tAuth('backToLogin')}
                  </Link>
                </p>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
