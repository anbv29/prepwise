import { load } from 'cheerio';

export interface ExtractedLink {
  href: string;
  text: string;
}

export interface ExtractedPageContent {
  links: ExtractedLink[];
  text: string;
  title: string;
  truncated: boolean;
}

function normalizeText(value: string) {
  const withoutControls = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    const isUnwantedControl =
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127;
    return isUnwantedControl ? ' ' : character;
  }).join('');

  return withoutControls.replace(/\s+/gu, ' ').trim();
}

export function extractPageContent(
  content: string,
  contentType: string,
  maximumCharacters: number,
): ExtractedPageContent {
  if (contentType === 'text/plain') {
    const normalized = normalizeText(content);
    return {
      links: [],
      text: normalized.slice(0, maximumCharacters),
      title: '',
      truncated: normalized.length > maximumCharacters,
    };
  }

  const document = load(content);
  const title = normalizeText(
    document('meta[property="og:title"]').attr('content') ?? document('title').first().text(),
  ).slice(0, 300);
  const links: ExtractedLink[] = [];

  document('a[href]').each((_index, element) => {
    const href = document(element).attr('href');

    if (href) {
      links.push({
        href: href.trim(),
        text: normalizeText(document(element).text()).slice(0, 200),
      });
    }
  });

  document(
    'script,style,noscript,template,svg,canvas,iframe,object,embed,form,nav,footer',
  ).remove();
  const normalized = normalizeText(document('body').text() || document.root().text());

  return {
    links,
    text: normalized.slice(0, maximumCharacters),
    title,
    truncated: normalized.length > maximumCharacters,
  };
}
