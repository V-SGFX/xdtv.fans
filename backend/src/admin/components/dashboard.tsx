import React, { useState, useEffect } from 'react';
import { Box, H2, H4, Text, Illustration, Button } from '@adminjs/design-system';

interface Stats {
  users: { total: number; today: number; thisWeek: number; thisMonth: number };
  posts: { total: number; today: number; thisWeek: number; clips: number; text: number };
  messages: { total: number; today: number; thisWeek: number };
  streamers: { total: number; claimed: number; live: number };
  channels: { total: number; global: number; streamer: number };
  follows: { total: number };
  communities: { total: number };
  news: { total: number; published: number };
  comments: { total: number; today: number; thisWeek: number };
  queue: { reports: number; moderators: number };
  dailyPosts: { date: string; count: number }[];
  dailyUsers: { date: string; count: number }[];
  dailyMessages: { date: string; count: number }[];
}

const StatCard = ({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) => (
  <Box
    flex flexDirection="column" alignItems="center" justifyContent="center"
    bg="white" p="xl" style={{
      borderRadius: 12, minWidth: 160, flex: '1 1 180px',
      borderLeft: `4px solid ${color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}
  >
    <Text variant="sm" color="grey60" style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 11, fontWeight: 600 }}>{label}</Text>
    <H2 mt="sm" mb="sm" style={{ color, fontSize: 36, fontWeight: 800 }}>{typeof value === 'number' ? value.toLocaleString('pl-PL') : value}</H2>
    {sub && <Text variant="sm" color="grey40" style={{ fontSize: 12 }}>{sub}</Text>}
  </Box>
);

const BarChart = ({ data, label, color }: { data: { date: string; count: number }[]; label: string; color: string }) => {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <Box bg="white" p="xl" style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flex: '1 1 300px' }}>
      <H4 mb="lg">{label}</H4>
      <Box flex alignItems="flex-end" style={{ gap: 4, height: 140 }}>
        {data.map((d, i) => (
          <Box key={i} flex flexDirection="column" alignItems="center" style={{ flex: 1 }}>
            <Text variant="sm" color="grey40" mb="xs" style={{ fontSize: 10 }}>{d.count}</Text>
            <Box
              style={{
                width: '100%', maxWidth: 32,
                height: Math.max((d.count / max) * 110, 2),
                backgroundColor: color, borderRadius: '4px 4px 0 0',
                transition: 'height 0.3s ease',
              }}
            />
            <Text variant="sm" color="grey40" mt="xs" style={{ fontSize: 9 }}>
              {d.date.slice(5)}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/admin/api/stats')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box flex justifyContent="center" alignItems="center" style={{ minHeight: 400 }}>
        <Text>Ładowanie statystyk...</Text>
      </Box>
    );
  }

  /*
   * Odporność na rozjazd kształtu danych.
   *
   * Komponent i API zmieniają się razem, ale przeglądarka może mieć
   * jeszcze poprzednią paczkę. Sięgnięcie po `stats.cokolwiek.total`
   * z brakującej sekcji wywracało wtedy cały pulpit na biały ekran.
   * Brakująca sekcja pokazuje się teraz jako zero — widać, że czegoś nie
   * ma, a reszta liczb dalej działa.
   */
  const n = (value: number | undefined) => value ?? 0;

  if (!stats) {
    return (
      <Box flex justifyContent="center" alignItems="center" style={{ minHeight: 400 }}>
        <Text color="error">Nie udało się załadować statystyk</Text>
      </Box>
    );
  }

  return (
    <Box p="xxl" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Box mb="xxl">
        <H2 mb="sm" style={{ fontWeight: 800 }}>📊 XDTV Dashboard</H2>
        <Text color="grey60">Przegląd statystyk platformy</Text>
      </Box>

      {/* Main Stats */}
      <Box flex flexWrap="wrap" mb="xl" style={{ gap: 16 }}>
        <StatCard label="Użytkownicy" value={n(stats.users?.total)} sub={`+${n(stats.users?.today)} dzisiaj`} color="#6366f1" />
        <StatCard label="Posty" value={n(stats.posts?.total)} sub={`+${n(stats.posts?.today)} dzisiaj`} color="#8b5cf6" />
        <StatCard label="Wiadomości" value={n(stats.messages?.total)} sub={`+${n(stats.messages?.today)} dzisiaj`} color="#06b6d4" />
        <StatCard label="Streamerzy" value={n(stats.streamers?.total)} sub={`${n(stats.streamers?.claimed)} przejętych`} color="#f43f5e" />
        <StatCard label="Obserwowania" value={n(stats.follows?.total)} color="#10b981" sub="" />
        <StatCard label="Na żywo" value={n(stats.streamers?.live)} color="#ef4444" sub="teraz" />
      </Box>

      {/* Charts */}
      <Box flex flexWrap="wrap" mb="xl" style={{ gap: 16 }}>
        <BarChart data={stats.dailyPosts} label="📝 Posty (ostatnie 14 dni)" color="#8b5cf6" />
        <BarChart data={stats.dailyUsers} label="👤 Nowi użytkownicy (14 dni)" color="#6366f1" />
        <BarChart data={stats.dailyMessages} label="💬 Wiadomości (14 dni)" color="#06b6d4" />
      </Box>

      {/* Detail Cards */}
      <Box flex flexWrap="wrap" mb="xl" style={{ gap: 16 }}>
        <Box bg="white" p="xl" style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flex: '1 1 250px' }}>
          <H4 mb="lg">📺 Treści</H4>
          <Box flex flexDirection="column" style={{ gap: 10 }}>
            <Box flex justifyContent="space-between"><Text color="grey60">Clipy</Text><Text style={{ fontWeight: 700 }}>{n(stats.posts?.clips).toLocaleString('pl-PL')}</Text></Box>
            <Box flex justifyContent="space-between"><Text color="grey60">Posty tekstowe</Text><Text style={{ fontWeight: 700 }}>{n(stats.posts?.text).toLocaleString('pl-PL')}</Text></Box>
            <Box flex justifyContent="space-between"><Text color="grey60">Ten tydzień</Text><Text style={{ fontWeight: 700 }}>{n(stats.posts?.thisWeek).toLocaleString('pl-PL')}</Text></Box>
            <Box flex justifyContent="space-between"><Text color="grey60">News</Text><Text style={{ fontWeight: 700 }}>{n(stats.news?.total)} ({n(stats.news?.published)} opublikowanych)</Text></Box>
          </Box>
        </Box>

        <Box bg="white" p="xl" style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flex: '1 1 250px' }}>
          <H4 mb="lg">💬 Czat</H4>
          <Box flex flexDirection="column" style={{ gap: 10 }}>
            <Box flex justifyContent="space-between"><Text color="grey60">Kanały globalne</Text><Text style={{ fontWeight: 700 }}>{n(stats.channels?.global)}</Text></Box>
            <Box flex justifyContent="space-between"><Text color="grey60">Kanały streamerów</Text><Text style={{ fontWeight: 700 }}>{n(stats.channels?.streamer)}</Text></Box>
            <Box flex justifyContent="space-between"><Text color="grey60">Wiadomości (tydzień)</Text><Text style={{ fontWeight: 700 }}>{n(stats.messages?.thisWeek).toLocaleString('pl-PL')}</Text></Box>
          </Box>
        </Box>

          <Box bg="white" p="xl" style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flex: '1 1 250px' }}>
            <H4 mb="lg">💬 Komentarze</H4>
            <Box flex flexDirection="column" style={{ gap: 10 }}>
              <Box flex justifyContent="space-between"><Text color="grey60">Łącznie</Text><Text style={{ fontWeight: 700 }}>{n(stats.comments?.total).toLocaleString('pl-PL')}</Text></Box>
              <Box flex justifyContent="space-between"><Text color="grey60">Dzisiaj</Text><Text style={{ fontWeight: 700 }}>{n(stats.comments?.today)}</Text></Box>
              <Box flex justifyContent="space-between"><Text color="grey60">Ten tydzień</Text><Text style={{ fontWeight: 700 }}>{n(stats.comments?.thisWeek).toLocaleString('pl-PL')}</Text></Box>
            </Box>
          </Box>

          <Box bg="white" p="xl" style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flex: '1 1 250px' }}>
            <H4 mb="lg">📥 Czeka na decyzję</H4>
            <Box flex flexDirection="column" style={{ gap: 10 }}>
              <Box flex justifyContent="space-between"><Text color="grey60">Zgłoszenia</Text><Text style={{ fontWeight: 700 }}>{n(stats.queue?.reports)}</Text></Box>
              <Box flex justifyContent="space-between"><Text color="grey60">Moderatorzy społeczności</Text><Text style={{ fontWeight: 700 }}>{n(stats.queue?.moderators)}</Text></Box>
            </Box>
          </Box>

          <Box bg="white" p="xl" style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flex: '1 1 250px' }}>
            <H4 mb="lg">📡 Streamerzy</H4>
            <Box flex flexDirection="column" style={{ gap: 10 }}>
              <Box flex justifyContent="space-between"><Text color="grey60">Profile</Text><Text style={{ fontWeight: 700 }}>{n(stats.streamers?.total).toLocaleString('pl-PL')}</Text></Box>
              <Box flex justifyContent="space-between"><Text color="grey60">Przejęte</Text><Text style={{ fontWeight: 700 }}>{n(stats.streamers?.claimed)}</Text></Box>
              <Box flex justifyContent="space-between"><Text color="grey60">Na żywo</Text><Text style={{ fontWeight: 700 }}>{n(stats.streamers?.live).toLocaleString('pl-PL')}</Text></Box>
            </Box>
          </Box>

          <Box bg="white" p="xl" style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flex: '1 1 250px' }}>
            <H4 mb="lg">🌐 Społeczność</H4>
            <Box flex flexDirection="column" style={{ gap: 10 }}>
              <Box flex justifyContent="space-between"><Text color="grey60">Społeczności</Text><Text style={{ fontWeight: 700 }}>{n(stats.communities?.total)}</Text></Box>
              <Box flex justifyContent="space-between"><Text color="grey60">Obserwacje</Text><Text style={{ fontWeight: 700 }}>{n(stats.follows?.total).toLocaleString('pl-PL')}</Text></Box>
              <Box flex justifyContent="space-between"><Text color="grey60">Użytkownicy (tydzień)</Text><Text style={{ fontWeight: 700 }}>+{n(stats.users?.thisWeek)}</Text></Box>
              <Box flex justifyContent="space-between"><Text color="grey60">Użytkownicy (miesiąc)</Text><Text style={{ fontWeight: 700 }}>+{n(stats.users?.thisMonth)}</Text></Box>
            </Box>
          </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
