import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Home, 
  Users, 
  FileCode, 
  FilePlus,
  Folder,
  Link, 
  MoreHorizontal, 
  Book, 
  Bell, 
  HelpCircle, 
  ChevronDown,
  Menu
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
    <div 
      className={`sidebar-item ${active ? 'active' : ''} cursor-pointer flex items-center ${isExpanded ? 'gap-2 px-3 py-2 justify-start' : 'justify-center py-2.5'}`}
      onClick={onClick}
      title={!isExpanded ? label : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {isExpanded && <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>}
      {isExpanded && hasDropdown && <ChevronDown className="h-4 w-4 shrink-0" />}
    </div>
  );
};

const Sidebar: React.FC = () => {
  // Collapsed by default as requested: "El panel izquierdo debe iniciar retraido"
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isScenariosActive = location.pathname === '/dashboard';
  const isOrgActive = location.pathname === '/dashboard/workflows';
  const isDocActive = location.pathname === '/documentation';

  return (
    <div className={`h-screen bg-solana-purple flex flex-col text-white transition-all duration-300 select-none ${isExpanded ? 'w-64' : 'w-16'}`}>
      
      {/* Top Header & Toggle Button */}
      {isExpanded ? (
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 text-white shrink-0">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 9L12 5L21 9L12 13L3 9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 14L12 10L21 14L12 18L3 14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 19L12 15L21 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-bold text-base gradient-text whitespace-nowrap">SOLANA FLOWS</span>
          </div>
          <button 
            onClick={() => setIsExpanded(false)} 
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            title="Collapse sidebar"
          >
            <Menu className="h-5 w-5 text-white" />
          </button>
        </div>
      ) : (
        <div className="p-4 flex items-center justify-center border-b border-white/5">
          <button 
            onClick={() => setIsExpanded(true)} 
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center"
            title="Expand sidebar"
          >
            <Menu className="h-5 w-5 text-white" />
          </button>
        </div>
      )}

      {/* Navigation Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4">
        {/* Section 1 */}
        <div className="px-3">
          {isExpanded ? (
            <div className="mb-1.5 px-2 text-[10px] uppercase tracking-wider font-semibold opacity-50">MY ORGANIZATION</div>
          ) : (
            <hr className="border-white/10 my-3" />
          )}
          <NavItem 
            icon={Home} 
            label="Home" 
            active={location.pathname === '/'}
            isExpanded={isExpanded} 
            onClick={() => navigate('/')} 
          />
          <NavItem 
            icon={Folder} 
            label="My Workflows" 
            active={isOrgActive}
            isExpanded={isExpanded} 
            onClick={() => navigate('/dashboard/workflows')} 
          />
        </div>

        {/* Section 2 */}
        <div className="px-3 mt-4">
          {isExpanded ? (
            <div className="mb-1.5 px-2 text-[10px] uppercase tracking-wider font-semibold opacity-50">MY TEAM</div>
          ) : (
            <hr className="border-white/10 my-3" />
          )}
          <NavItem icon={Users} label="Team" isExpanded={isExpanded} onClick={() => toast.info('Team management coming soon!')} />
          <NavItem 
            icon={FilePlus} 
            label="Scenarios" 
            active={isScenariosActive} 
            isExpanded={isExpanded} 
            onClick={() => navigate('/dashboard')}
          />
          <NavItem icon={FileCode} label="Templates" isExpanded={isExpanded} onClick={() => toast.info('Templates coming soon!')} />
          <NavItem icon={Link} label="Connections" isExpanded={isExpanded} onClick={() => toast.info('Connections coming soon!')} />
          <NavItem icon={MoreHorizontal} label="More" hasDropdown={true} isExpanded={isExpanded} />
        </div>

        {/* Section 3 */}
        <div className="mt-8 px-3">
          {!isExpanded && <hr className="border-white/10 my-3" />}
          <NavItem 
            icon={Book} 
            label="Documentation" 
            active={isDocActive}
            isExpanded={isExpanded} 
            onClick={() => navigate('/documentation')} 
          />
          <NavItem icon={Bell} label="What's New" isExpanded={isExpanded} onClick={() => toast.info("What's new coming soon!")} />
          <NavItem icon={HelpCircle} label="Help" isExpanded={isExpanded} onClick={() => toast.info('Help center coming soon!')} />
        </div>
      </div>

      {/* Footer Profile */}
      <div className={`p-3 border-t border-white/10 flex items-center ${isExpanded ? 'gap-2.5 justify-start' : 'justify-center'}`}>
        <div className="h-8 w-8 rounded-full bg-solana-cyan flex items-center justify-center text-solana-dark font-bold shrink-0">
          S
        </div>
        {isExpanded && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis leading-none">Solana User</span>
            <span className="text-[10px] opacity-50 leading-none mt-1">user@solana.com</span>
          </div>
        )}
      </div>

    </div>
  );
};

export default Sidebar;
