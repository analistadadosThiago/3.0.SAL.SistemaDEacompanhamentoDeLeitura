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
import { DatabaseModal } from './components/DatabaseModal';

const AppContent: React.FC = () => {
  const { isConfigured } = useData();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isDbModalOpen, setIsDbModalOpen] = useState<boolean>(!isConfigured);

  const getSectionTitle = () => {
    switch (activeTab) {
      case 'dashboard': return '1. Dashboard';
      case 'consulta': return '2. Consulta de instalação/medidor';
      case 'controle': return '3.1. Controle de Leiturista';
      case 'evidencias': return '3.2. Controle de Evidência';
      case 'consistencia': return '3.3. Controle de Consistência';
      case 'horario': return '4.1. Controle de Horário';
      case 'sequencia': return '4.2. Sequência de Leitura';
      case 'impressao': return "5.1. N'OSB – Impedimento";
      case 'simulacao': return "5.2. N’OSB SIMULAÇÃO";
      default: return 'Sistema de Análise de Leitura';
    }
  };

  return (
    <>
      <Layout
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        currentSection={getSectionTitle()}
        onOpenDatabaseModal={() => setIsDbModalOpen(true)}
      >
        <div className="animate-fade-in">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'consulta' && <Consulta />}
          {activeTab === 'controle' && <ControleLeiturista />}
          {activeTab === 'evidencias' && <ControleEvidencias />}
          {activeTab === 'consistencia' && <ControleConsistencia />}
          {activeTab === 'horario' && <ControleHorario />}
          {activeTab === 'sequencia' && <SequenciaLeitura />}
          {activeTab === 'impressao' && <ControleImpressao />}
          {activeTab === 'simulacao' && <ControleSimulacao />}
        </div>
      </Layout>

      {/* Database Connection Modal */}
      <DatabaseModal
        isOpen={isDbModalOpen || !isConfigured}
        onClose={() => setIsDbModalOpen(false)}
        canDismiss={isConfigured}
      />
    </>
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
