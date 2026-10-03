import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function translateText(text: string, from: string, to: string): Promise<string | null> {
  try {
    const translate = (await import('google-translate-api-x')).default;
    const res = await translate(text, { from, to });
    return res.text || null;
  } catch (err: any) {
    console.warn(`Translation error: ${err.message}`);
    return null;
  }
}

async function main() {
  const news = await prisma.news.findMany({
    orderBy: { id: 'asc' },
  });

  console.log(`Found ${news.length} articles to check/translate`);

  let translated = 0;
  let skipped = 0;

  for (const article of news) {
    // Skip if title looks already Polish (simple heuristic: contains Polish chars)
    const hasPolishChars = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(article.title);
    if (hasPolishChars) {
      skipped++;
      continue;
    }

    console.log(`[${article.id}] Translating: ${article.title.slice(0, 60)}...`);

    try {
      const translatedTitle = await translateText(article.title, 'en', 'pl');
      let translatedSummary = article.summary;
      if (article.summary) {
        translatedSummary = await translateText(article.summary, 'en', 'pl');
      }

      if (translatedTitle) {
        await prisma.news.update({
          where: { id: article.id },
          data: {
            title: translatedTitle,
            summary: translatedSummary,
          },
        });
        translated++;
        console.log(`  → ${translatedTitle.slice(0, 60)}`);
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    } catch (err: any) {
      console.error(`  Error: ${err.message}`);
    }
  }

  console.log(`\nDone! Translated: ${translated}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch(console.error);
