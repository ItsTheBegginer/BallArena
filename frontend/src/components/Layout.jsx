import { Link } from 'react-router-dom';

/** @param {{ children: import('react').ReactNode }} props */
export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 antialiased">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-3.5">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 font-extrabold text-slate-950 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              ⚽
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black tracking-tight text-slate-100 group-hover:text-emerald-400 transition-colors">
                <span className="truncate">BallArena</span>
              </p>
              <p className="text-[11px] font-medium text-slate-400">Live Match Fan Chat</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">Live Stadiums</span>
              <span className="sm:hidden">Live</span>
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-3 py-4 sm:px-4 sm:py-6">{children}</main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>© BallArena Live Fan Network · Powered by Cloudflare Workers & Durable Objects</p>
      </footer>
    </div>
  );
}
