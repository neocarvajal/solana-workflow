import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import {
  Home,
  Users,
  FileCode,
  FilePlus,
  Folder,
  Link,
  Book,
  Bell,
  HelpCircle,
  ChevronDown,
  Database,
  Landmark,
  Menu,
  X
} from 'lucide-react';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
  hasDropdown?: boolean;
  isExpanded: boolean;
}

const NavItem: React.FC<NavItemProps> = ({
  icon: Icon,
  label,
  active = false,
  onClick,
  hasDropdown = false,
  isExpanded
}) => {
  return (
    <button
      type="button"
      className={`sidebar-item w-full min-h-10 ${active ? 'active' : ''} cursor-pointer flex items-center text-left ${isExpanded ? 'gap-2 px-3 py-2 justify-start' : 'justify-center py-2.5'}`}
      onClick={onClick}
      title={!isExpanded ? label : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {isExpanded && <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>}
      {isExpanded && hasDropdown && <ChevronDown className="h-4 w-4 shrink-0" />}
    </button>
  );
};

const Logo = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
    <path d="M3 9L12 5L21 9L12 13L3 9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 14L12 10L21 14L12 18L3 14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 19L12 15L21 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Sidebar: React.FC = () => {
  // Collapsed by default as requested: "El panel izquierdo debe iniciar retraido"
  const [isExpanded, setIsExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const { connected } = useWallet();

  const isScenariosActive = router.pathname === '/dashboard';
  const isOrgActive = router.pathname === '/dashboard/workflows';
  const isDocActive = router.pathname === '/documentation';

  useEffect(() => {
    const open = () => setMobileOpen(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    window.addEventListener('open-mobile-nav', open);
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('open-mobile-nav', open);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const go = (path: string, mobile = false) => {
    if (mobile) setMobileOpen(false);
    router.push(path);
  };

  const comingSoon = (message: string, mobile = false) => {
    if (mobile) setMobileOpen(false);
    toast.info(message);
  };

  const openSheet = (eventName: 'open-vault' | 'open-onchain', mobile = false) => {
    if (mobile) setMobileOpen(false);
    // Let the drawer close before mounting/opening the sheet on top of it.
    window.setTimeout(() => window.dispatchEvent(new Event(eventName)), 80);
  };

  const sections = (expanded: boolean, mobile = false) => (
    <>
      <div className="px-3">
        {expanded ? (
          <div className="mb-1.5 px-2 text-[10px] uppercase tracking-wider font-semibold opacity-50">MY ORGANIZATION</div>
        ) : (
          <hr className="border-white/10 my-3" />
        )}
        <NavItem
          icon={Home}
          label="Home"
          active={router.pathname === '/'}
          isExpanded={expanded}
          onClick={() => go('/', mobile)}
        />
        <NavItem
          icon={FilePlus}
          label="Scenarios"
          active={isScenariosActive}
          isExpanded={expanded}
          onClick={() => go('/dashboard', mobile)}
        />
        <NavItem
          icon={Folder}
          label="My Workflows"
          active={isOrgActive}
          isExpanded={expanded}
          onClick={() => go('/dashboard/workflows', mobile)}
        />
      </div>

      {mobile && connected && (
        <div className="px-3 mt-4">
          <div className="mb-1.5 px-2 text-[10px] uppercase tracking-wider font-semibold opacity-50">
            WALLET
          </div>
          <NavItem
            icon={Landmark}
            label="Bóveda y límites"
            isExpanded={expanded}
            onClick={() => openSheet('open-vault', mobile)}
          />
          <NavItem
            icon={Database}
            label="On-chain workflows"
            isExpanded={expanded}
            onClick={() => openSheet('open-onchain', mobile)}
          />
        </div>
      )}

      <div className="px-3 mt-4">
        {expanded ? (
          <div className="mb-1.5 px-2 text-[10px] uppercase tracking-wider font-semibold opacity-50">MY TEAM</div>
        ) : (
          <hr className="border-white/10 my-3" />
        )}
        <NavItem icon={Users} label="Team" isExpanded={expanded} onClick={() => comingSoon('Team management coming soon!', mobile)} />
        <NavItem icon={FileCode} label="Templates" isExpanded={expanded} onClick={() => comingSoon('Templates coming soon!', mobile)} />
        <NavItem icon={Link} label="Connections" isExpanded={expanded} onClick={() => comingSoon('Connections coming soon!', mobile)} />
      </div>

      <div className="mt-4 px-3">
        {expanded ? (
          <div className="mb-1.5 px-2 text-[10px] uppercase tracking-wider font-semibold opacity-50">HELP</div>
        ) : (
          <hr className="border-white/10 my-3" />
        )}
        <NavItem
          icon={Book}
          label="Documentation"
          active={isDocActive}
          isExpanded={expanded}
          onClick={() => go('/documentation', mobile)}
        />
        <NavItem
          icon={Bell}
          label="Notificaciones"
          isExpanded={expanded}
          onClick={() => {
            if (mobile) setMobileOpen(false);
            window.dispatchEvent(new Event('open-notifications'));
          }}
        />
        <NavItem icon={HelpCircle} label="Help" isExpanded={expanded} onClick={() => comingSoon('Help center coming soon!', mobile)} />
      </div>
    </>
  );

  const userCard = (expanded: boolean) => (
    <div className={`p-3 border-t border-white/10 flex items-center ${expanded ? 'gap-2.5 justify-start' : 'justify-center'}`}>
      <div className="h-9 w-9 rounded-full bg-solana-cyan flex items-center justify-center text-solana-dark font-bold shrink-0">
        S
      </div>
      {expanded && (
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis leading-none">Solana User</span>
          <span className="text-[10px] opacity-50 leading-none mt-1">solana.com</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Rail de escritorio */}
      <aside className={`hidden md:flex h-full bg-solana-purple flex-col text-white transition-all duration-300 select-none ${isExpanded ? 'w-64' : 'w-16'}`}>
        {isExpanded ? (
          <div className="p-4 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 text-white shrink-0">
                <Logo />
              </div>
              <span className="font-bold text-base text-ellipsis whitespace-nowrap">SOLANA WORKFLOW</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="flex h-10 w-10 items-center justify-center hover:bg-white/10 rounded-lg transition-colors shrink-0"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <Menu className="h-5 w-5 text-white" />
            </button>
          </div>
        ) : (
          <div className="p-3 flex items-center justify-center border-b border-white/5">
            <button
              onClick={() => setIsExpanded(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center hover:bg-white/10 rounded-lg transition-colors"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <Menu className="h-5 w-5 text-white" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4">
          {sections(isExpanded)}
        </div>

        {userCard(isExpanded)}
      </aside>

      {/* Drawer móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[80] md:hidden" role="dialog" aria-modal="true" aria-label="Navegación">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          />
          <div className="absolute inset-y-0 left-0 flex w-[84%] max-w-xs flex-col bg-solana-purple text-white shadow-2xl pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 shrink-0">
                  <Logo />
                </div>
                <span className="font-bold text-sm truncate">SOLANA WORKFLOW</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10 shrink-0"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3">
              {sections(true, true)}
            </div>

            {userCard(true)}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
