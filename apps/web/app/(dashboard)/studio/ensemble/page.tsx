import { redirect } from 'next/navigation';

export default function StudioEnsembleRedirect() {
  // Ensemble is now part of the unified Sonificator — redirect to /studio.
  redirect('/studio');
}
