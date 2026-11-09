import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import Logo from './Logo';
import { 
  LayoutDashboard, Search, Users, Camera, ShieldCheck,
  Clock, GitCommit, Printer, FileQuestion, Database,
  ChevronLeft, ChevronRight, Menu, ChevronDown, TrendingUp
} from 'lucide-react';

export type TabType = 
  | 'dashboard'
  | 'consulta'
  | 'controle'
  | 'evidencias'
  | 'consistencia'
  | 'producao'
  | 'horario'
  | 'sequencia'
  | 'impressao'
  | 'simulacao';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  currentSection: string;
}

interface MenuItem {
  id: TabType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  num: string;
}

interface MenuCategory {
  id: string;
  title: string;
  items: MenuItem[];
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange, 
  currentSection,
}) => {
  const { records, loading, reloadSupabaseData } = useData();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [time, setTime] = useState(new Date());

  // Category collapse states
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    controles: true,
    relatorios: true,
    impressoes: true,
  });

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleCategory = (catId: string) => {
    setOpenCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const topMenuItems: MenuItem[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: '1. Dashboard', num: '1' },
    { id: 'consulta', icon: Search, label: '2. Consulta de instalação/medidor', num: '2' },
  ];

  const categories: MenuCategory[] = [
    {
      id: 'controles',
      title: 'CONTROLES',
      items: [
        { id: 'controle', icon: Users, label: '3.1. Controle de Leiturista', num: '3.1' },
        { id: 'evidencias', icon: Camera, label: '3.2. Controle de Evidência', num: '3.2' },
        { id: 'consistencia', icon: ShieldCheck, label: '3.3. Controle de Consistência', num: '3.3' },
        { id: 'producao', icon: TrendingUp, label: '3.4. Controle de Produção', num: '3.4' },
      ],
    },
    {
      id: 'relatorios',
      title: 'RELATÓRIOS',
      items: [
        { id: 'horario', icon: Clock, label: '4.1. Controle de Horário', num: '4.1' },
        { id: 'sequencia', icon: GitCommit, label: '4.2. Sequência de Leitura', num: '4.2' },
      ],
    },
    {
      id: 'impressoes',
      title: 'IMPRESSÕES',
      items: [
        { id: 'impressao', icon: Printer, label: "5.1. N'OSB – Impedimento", num: '5.1' },
        { id: 'simulacao', icon: FileQuestion, label: "5.2. N’OSB SIMULAÇÃO", num: '5.2' },
      ],
    },
  ];

  const formattedDateTime = () => {
    const d = String(time.getDate()).padStart(2, '0');
    const m = String(time.getMonth() + 1).padStart(2, '0');
    const y = time.getFullYear();
    const h = String(time.getHours()).padStart(2, '0');
    const min = String(time.getMinutes()).padStart(2, '0');
    const s = String(time.getSeconds()).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}:${s}`;
  };

  const renderMenuItem = (item: MenuItem) => {
    const isActive = activeTab === item.id;
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        onClick={() => onTabChange(item.id)}
        title={item.label}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left group cursor-pointer ${
          isActive
            ? 'bg-blue-600/20 text-cyan-400 border border-blue-500/40 shadow-sm shadow-blue-500/10 font-bold'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
        {!isSidebarCollapsed && (
          <span className="text-xs truncate leading-tight">
            {item.label}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans'] antialiased">
      <div className="flex-1 flex overflow-hidden">
        {/* COLLAPSIBLE SIDEBAR */}
        <aside
          className={`${
            isSidebarCollapsed ? 'w-16' : 'w-72'
          } bg-[#0b0f19] border-r border-slate-800/80 transition-all duration-300 flex flex-col z-40 shrink-0 select-none`}
        >
          {/* Logo & Brand Header */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80 shrink-0">
            {!isSidebarCollapsed ? (
              <div className="flex items-center gap-2 overflow-hidden">
                <Logo showText={true} imgClassName="h-10 w-auto object-contain" iconSize="w-10 h-10" />
              </div>
            ) : (
              <div className="w-full flex justify-center">
                <Logo showText={false} imgClassName="h-9 w-auto object-contain" iconSize="w-9 h-9" />
              </div>
            )}
            
            {/* Collapse toggle button */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors shrink-0 cursor-pointer"
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Section Title */}
          <div className="px-4 py-2.5 border-b border-slate-800/50">
            {!isSidebarCollapsed ? (
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Selecione menus
              </span>
            ) : (
              <div className="text-center text-[10px] text-slate-500 font-bold tracking-wider">
                MENU
              </div>
            )}
          </div>

          {/* Categorized Menu Items List */}
          <div className="flex-1 p-2 space-y-3 overflow-y-auto custom-scrollbar">
            {/* Top Principal Menus */}
            <div className="space-y-1">
              {topMenuItems.map(renderMenuItem)}
            </div>

            {/* Categorized Groups */}
            {categories.map((cat) => {
              const isOpen = openCategories[cat.id] ?? true;
              const hasActiveChild = cat.items.some((it) => it.id === activeTab);

              return (
                <div key={cat.id} className="pt-1">
                  {!isSidebarCollapsed ? (
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase rounded-lg transition-colors cursor-pointer ${
                        hasActiveChild ? 'text-blue-400' : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500/70"></span>
                        {cat.title}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  ) : (
                    <div className="h-px bg-slate-800/80 my-2 mx-1" />
                  )}

                  {/* Category Children */}
                  {(isOpen || isSidebarCollapsed) && (
                    <div className="mt-1 space-y-1">
                      {cat.items.map(renderMenuItem)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Database & Toggle Bar at bottom */}
          <div className="p-3 border-t border-slate-800/80 bg-[#080c14] space-y-2">
            <button
              onClick={() => reloadSupabaseData()}
              disabled={loading}
              title="Atualizar dados do Supabase"
              className={`w-full py-2 px-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center cursor-pointer ${
                isSidebarCollapsed ? 'justify-center' : 'justify-between'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Database className={`w-3.5 h-3.5 text-emerald-400 shrink-0 ${loading ? 'animate-spin' : ''}`} />
                {!isSidebarCollapsed && <span className="truncate">Supabase</span>}
              </div>
              {!isSidebarCollapsed && (
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                  {records.length}
                </span>
              )}
            </button>
          </div>
        </aside>

        {/* MAIN VIEWPORT */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* TOPBAR */}
          <header className="h-16 bg-[#0b0f19] border-b border-slate-800/80 px-6 flex items-center justify-between shrink-0 z-30">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
                title={isSidebarCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="h-5 w-px bg-slate-800"></div>

              {/* Logo + Title in Topbar */}
              <div className="flex items-center gap-3">
                <Logo showText={false} imgClassName="h-9 w-auto object-contain" iconSize="w-9 h-9" />
                <span className="text-sm font-extrabold text-white tracking-tight">
                  Sistema de Análise de Leitura
                </span>
                <span className="text-slate-600 hidden sm:inline">/</span>
                <span className="text-xs text-cyan-400 font-bold hidden sm:inline">{currentSection}</span>
              </div>
            </div>

            {/* Topbar Right */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => reloadSupabaseData()}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:border-emerald-500/50 hover:text-white transition-all cursor-pointer shadow-sm"
                title="Recarregar dados do Supabase"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                <Database className={`w-3.5 h-3.5 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline font-medium">Supabase Conectado</span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold hidden md:inline">
                  ({records.length})
                </span>
              </button>
            </div>
          </header>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar">
            <div className="max-w-[1600px] mx-auto min-h-full">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* RODAPÉ OBRIGATÓRIO FIXO EM TODAS AS TELAS */}
      <footer className="bg-[#050811] border-t border-slate-800/80 py-2.5 px-6 shrink-0 text-center select-none z-50">
        <div className="text-xs text-slate-300 font-medium tracking-tight">
          Copyright SAL: Sistema de Análise de Leitura © 2026 | Criado por Thiago Marques Lopes
        </div>
        <div className="text-[11px] text-slate-400 font-mono mt-0.5 tracking-wider">
          {formattedDateTime()}
        </div>
      </footer>
    </div>
  );
};

export default Layout;
