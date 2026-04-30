import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

const SUPPORTED_LOCALES = ['en', 'pl', 'de', 'fr', 'es', 'sk', 'cs', 'ro', 'sv'] as const;

function isSupported(locale: string): boolean {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get('locale')?.value ?? 'en';
  const locale = isSupported(raw) ? raw : 'en';

  let messages;
  try {
    messages = (await import(`../messages/${locale}.json`)).default;
  } catch {
    messages = (await import('../messages/en.json')).default;
  }

  return { locale, messages };
});
