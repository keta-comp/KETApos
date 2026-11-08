import { useEffect, useRef, useState } from 'react';
import { useApp } from './AppContext.jsx';

// Serverdan ma'lumot yuklash: loading / error / data + har yozishdan keyin qayta yuklash.
// version — AppContext'dagi signal: biror joy saqlangandan keyin barcha ochiq ro'yxatlar yangilanadi.
export function useData(loader, deps = []) {
  const { version, ready } = useApp();
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  // deps o'zgarsa eski ma'lumot endi boshqa narsaga tegishli: uni saqlab
  // qolish "hozirgi tanlov" deb o'qiladigan xatolarga olib keladi.
  const depsKey = JSON.stringify(deps);
  const lastDeps = useRef(depsKey);
  if (lastDeps.current !== depsKey) {
    lastDeps.current = depsKey;
    setData(null);
    setError(null);
    setLoading(true);
  }

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    setLoading(true);
    loaderRef.current()
      .then((result) => {
        if (!alive) return;
        setData(result ?? null);
        setError(null);
      })
      .catch((e) => {
        if (alive) setError(e?.message || String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, version, nonce, depsKey]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}
