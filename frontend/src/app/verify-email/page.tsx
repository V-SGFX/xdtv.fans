'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { loginWithToken } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const t = useTranslations('verify');
  const tAuth = useTranslations('auth');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage(t('noToken'));
      return;
    }
    api.get(`/auth/verify-email?token=${token}`)
      .then(async ({ data }) => {
        setStatus('success');
        setMessage(data.message || t('confirmed'));
        if (data.token) {
          await loginWithToken(data.token);
          setTimeout(() => router.push('/'), 2000);
        }
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.message || t('failed'));
      });
  }, [searchParams, loginWithToken, router]);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-1 flex items-center justify-center relative">
        <div className="absolute inset-0 bg-mesh" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full max-w-sm mx-4"
        >
          <div className="card-neon p-8 text-center space-y-4">
            {status === 'loading' && (
              <>
                <Loader2 className="w-12 h-12 text-neon-purple mx-auto animate-spin" />
                <p className="text-text-muted">{t('verifying')}</p>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                <h1 className="text-2xl font-display font-bold text-text-primary">{t('done')}</h1>
                <p className="text-text-muted">{message}</p>
                <p className="text-sm text-text-dimmed">{t('redirecting')}</p>
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="w-16 h-16 text-neon-red mx-auto" />
                <h1 className="text-2xl font-display font-bold text-text-primary">{t('error')}</h1>
                <p className="text-text-muted">{message}</p>
                <Link href="/login" className="text-neon-purple hover:text-neon-cyan transition-colors font-medium text-sm">
                  {tAuth('backToLogin')}
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-neon-purple animate-spin" />
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
