import { useEffect } from 'react';
import { useRepo } from './AppProviders';
import { fetchCatalogIndex } from './catalog';

/**
 * Once per start: catalog decks added before names were kept in every language get them from the catalog
 * index (a small file of this site). Without network nothing happens; the stored name is shown.
 */
export function useCatalogNames(): void {
  const repo = useRepo();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!(await repo.needsCatalogNames())) return;
        const index = await fetchCatalogIndex();
        if (cancelled || !index.ok) return;
        await repo.fillCatalogNames(index.value.decks);
      } catch {
        // the stored name stays; next start tries again
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo]);
}
