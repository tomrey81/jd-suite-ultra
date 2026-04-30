import { redirect } from 'next/navigation';

export default function StudioLibraryRedirect() {
  // Sample packs are now part of the unified Sonificator (Sound palette tab).
  redirect('/studio');
}
