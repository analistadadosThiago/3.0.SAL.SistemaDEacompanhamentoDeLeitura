import React, { useState } from 'react';
import { DataProvider, useData } from './context/DataContext';
import Layout, { TabType } from './components/Layout';
import Dashboard from './components/Dashboard';
import Consulta from './components/Consulta';
import ControleLeiturista from './components/ControleLeiturista';
import ControleEvidencias from './components/ControleEvidencias';
import ControleConsistencia from './components/ControleConsistencia';
import ControleImpressao from './components/ControleImpressao';
import ControleSimulacao from './components/ControleSimulacao';
import ControleHorario from './components/ControleHorario';
import SequenciaLeitura from './components/SequenciaLeitura';
import ControleProducao from './components/ControleProducao';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const AppContent: React.FC = () => {
  const { error, records, reloadSupabaseData } = useData();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const getSectionTitle = () => {
    switch (activeTab) {
      case 'dashboard': return '1. Dashboard';
      case 'consulta': return '2. Consulta de instalação/medidor';
      case 'controle': return '3.1. Controle de Leiturista';
      case 'evidencias': return '3.2. Controle de Evidência';
      case 'consistencia': return '3.3. Controle de Consistência';
      case 'producao': return '3.4. Controle de Produção';
      case 'horario': return '4.1. Controle de Horário';
      case 'sequencia': return '4.2. Sequência de Leitura';
      case 'impressao': return "5.1. N'OSB – Impedimento";
      case 'simulacao': return "5.2. N’OSB SIMULAÇÃO";
      default: return 'Sistema de Análise de Leitura';
    }
  };

  // Se houver erro de conexão inicial sem registros
  if (error && records.length === 0) {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center p-6 text-slate-100 font-sans">
        <div className="bg-[#111827] border border-red-800/80 rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center space-y-4 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Falha ao Conectar com o Supabase</h2>
            <p className="text-xs text-slate-400 mt-1.5">{error}</p>
          </div>
          <button
            onClick={() => reloadSupabaseData()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20"
          >
            <RefreshCw className="w-4 h-4" /> Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={(tab) => setActiveTab(tab)}
      currentSection={getSectionTitle()}
    >
      <div className="animate-fade-in">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'consulta' && <Consulta />}
        {activeTab === 'controle' && <ControleLeiturista />}
        {activeTab === 'evidencias' && <ControleEvidencias />}
        {activeTab === 'consistencia' && <ControleConsistencia />}
        {activeTab === 'producao' && <ControleProducao />}
        {activeTab === 'horario' && <ControleHorario />}
        {activeTab === 'sequencia' && <SequenciaLeitura />}
        {activeTab === 'impressao' && <ControleImpressao />}
        {activeTab === 'simulacao' && <ControleSimulacao />}
      </div>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
};

export default App;
