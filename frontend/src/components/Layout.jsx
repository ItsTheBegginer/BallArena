import { Link } from 'react-router-dom';

/** @param {{ children: import('react').ReactNode }} props */
export default function Layout({ children }) {
  return (
    <div className="app-shell flex min-h-screen flex-col text-slate-100 antialiased">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#101117]/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/icons/icon-192.png"
              alt=""
              aria-hidden="true"
              className="h-10 w-10 rounded-[14px] shadow-lg shadow-emerald-500/20 transition-transform group-hover:scale-105"
            />
            <div className="min-w-0">
              <p className="text-lg font-black tracking-tight text-white transition-colors group-hover:text-violet-200">
                <span className="truncate">BallArena</span>
              </p>
              <p className="text-[10px] font-medium tracking-wide text-slate-400">FOOTBALL, TOGETHER</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.8)]" />
              Matchday is live
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-8">{children}</main>

      <footer className="border-t border-white/[0.06] bg-[#101117]/70 px-4 py-6 text-center text-xs text-slate-500">
        <p>© BallArena Live Fan Network · Powered by Cloudflare Workers & Durable Objects</p>
      </footer>
    </div>
  );
}
