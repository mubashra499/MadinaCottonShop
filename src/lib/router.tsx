import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
}

function parseHash(): Route {
  const hash = window.location.hash.slice(1) || '/';
  const [pathPart, queryPart] = hash.split('?');
  return {
    path: (pathPart || '/').split('#')[0] || '/',
    params: {},
    query: new URLSearchParams(queryPart || ''),
  };
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function Link({ to, children, className, onClick, title }: { to: string; children: React.ReactNode; className?: string; onClick?: () => void; title?: string }) {
  return (
    <a
      title={title}
      href={`#${to}`}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
        onClick?.();
      }}
    >
      {children}
    </a>
  );
}
