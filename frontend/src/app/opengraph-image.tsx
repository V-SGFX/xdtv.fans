import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'XDTV — Platforma Streamerów';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a1a2e 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 'bold',
            background: 'linear-gradient(90deg, #8b5cf6, #00f5ff)',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          XDTV
        </div>
        <div
          style={{
            fontSize: 32,
            color: '#a8a8b8',
            marginTop: 16,
          }}
        >
          Platforma Streamerów
        </div>
        <div
          style={{
            fontSize: 20,
            color: '#6b6b80',
            marginTop: 8,
          }}
        >
          Profile • Społeczność • Czat • Newsy
        </div>
      </div>
    ),
    { ...size },
  );
}
