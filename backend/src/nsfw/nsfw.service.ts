import { Injectable } from '@nestjs/common';

interface NsfwResult {
  isNsfw: boolean;
  reasons: string[];
}

// Polish + English NSFW keywords (explicit content indicators)
const NSFW_KEYWORDS = [
  // Polish
  'porn', 'porno', 'pornografia', 'nago', 'nagość', 'nagie', 'seks', 'seksualn',
  'erotyk', 'erotyczn', 'xxx', 'nsfw', '18+', 'onlyfans', 'kurwa', 'jebać',
  'cipk', 'chuj', 'pierdol', 'dupczenie', 'ruchanie', 'orgia',
  // English
  'nude', 'nudity', 'naked', 'sexual', 'explicit', 'hentai', 'fetish',
  'hardcore', 'milf', 'blowjob', 'handjob', 'anal',
  'masturbat', 'orgasm', 'dildo', 'vibrator', 'stripper', 'camgirl',
  'fapping', 'cumshot', 'creampie', 'gangbang', 'deepthroat', 'bondage',
];

const NSFW_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'xhamster.com', 'redtube.com',
  'youporn.com', 'xnxx.com', 'chaturbate.com', 'onlyfans.com',
  'fansly.com', 'manyvids.com', 'brazzers.com', 'bangbros.com',
  'spankbang.com', 'eporner.com', 'tube8.com', 'xtube.com',
];

@Injectable()
export class NsfwService {
  /**
   * Checks text content + URLs for NSFW indicators.
   * Returns whether content is NSFW and the matching reasons.
   */
  detect(title: string, content: string, linkUrl?: string | null): NsfwResult {
    const reasons: string[] = [];
    const combined = `${title} ${content}`.toLowerCase();

    // Keyword matching
    for (const keyword of NSFW_KEYWORDS) {
      if (combined.includes(keyword)) {
        reasons.push(`keyword:${keyword}`);
        break; // One keyword match is enough
      }
    }

    // URL/domain check
    if (linkUrl) {
      const domain = this.extractDomain(linkUrl);
      if (domain) {
        for (const nsfwDomain of NSFW_DOMAINS) {
          if (domain.includes(nsfwDomain)) {
            reasons.push(`domain:${nsfwDomain}`);
            break;
          }
        }
      }
    }

    // Check for NSFW URLs embedded in content
    const urlRegex = /https?:\/\/[^\s)]+/gi;
    const urls = combined.match(urlRegex) || [];
    for (const url of urls) {
      const domain = this.extractDomain(url);
      if (domain) {
        for (const nsfwDomain of NSFW_DOMAINS) {
          if (domain.includes(nsfwDomain)) {
            reasons.push(`embedded_domain:${nsfwDomain}`);
            break;
          }
        }
      }
    }

    return {
      isNsfw: reasons.length > 0,
      reasons: [...new Set(reasons)],
    };
  }

  private extractDomain(url: string): string | null {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
}
