/**
 * One-time script to get a YouTube OAuth refresh token with upload scope.
 *
 * Usage:
 *   npx tsx scripts/youtube-auth.ts
 *
 * 1. Open the auth URL in a browser
 * 2. Log in with the YouTube channel owner account (@XDTVfans)
 * 3. After redirect, copy the FULL URL from the browser address bar
 *    (even if the page shows "connection refused")
 * 4. Paste the full URL or just the code here
 */

import 'dotenv/config';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = 'https://xdtv.fans/api/auth/youtube-upload/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
].join(' ');

function extractCode(input: string): string {
  // Accept full URL or just the code
  if (input.includes('code=')) {
    const url = new URL(input);
    return url.searchParams.get('code') || input;
  }
  return input;
}

async function main() {
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code&scope=${encodeURIComponent(SCOPES)}` +
    `&access_type=offline&prompt=consent`;

  console.log('\n🔗 Otwórz ten URL w przeglądarce:\n');
  console.log(authUrl);
  console.log('\n📋 Zaloguj się na konto Google powiązane z kanałem @XDTVfans.');
  console.log('Po autoryzacji przeglądarka przekieruje na localhost (strona się nie załaduje).');
  console.log('Skopiuj CAŁY URL z paska adresu przeglądarki i wklej poniżej.\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const rawInput = await new Promise<string>((resolve) => {
    rl.question('Wklej URL lub kod: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  const code = extractCode(rawInput);
  console.log(`\nWymieniam kod na token...`);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const data = await res.json();

  if (data.error) {
    console.error('\n❌ Błąd:', data.error, data.error_description);
    process.exit(1);
  }

  console.log('\n✅ Sukces!\n');
  console.log(`YOUTUBE_UPLOAD_REFRESH_TOKEN=${data.refresh_token}`);

  // Auto-append to .env
  const envPath = path.resolve(__dirname, '..', '.env');
  fs.appendFileSync(envPath, `\nYOUTUBE_UPLOAD_REFRESH_TOKEN=${data.refresh_token}\n`);
  console.log(`\n📝 Token dodany do .env`);

  // Verify: get channel info
  const channelRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    { headers: { Authorization: `Bearer ${data.access_token}` } },
  );
  const channelData = await channelRes.json();
  if (channelData.items?.[0]) {
    console.log(`📺 Kanał: ${channelData.items[0].snippet.title}`);
  }
}

main().catch(console.error);
