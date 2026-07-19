import React from 'react';
import HistoryDrawer from '../components/HistoryDrawer';
import ContinueExpandTransition from '../components/ContinueExpandTransition';
import { useAppSession } from '../context/AppSessionContext';
import { ComprensionPhaseRouter } from '../navigation/PhaseRouter';

export default function ComprensionApp() {
  const session = useAppSession();

  return (
    <>
      <HistoryDrawer
        open={session.historyOpen}
        entries={session.historyStore.entries}
        collections={session.historyStore.collections}
        activeId={session.phase === 'result' && session.data ? session.historyStore.activeId : null}
        phase={session.phase}
        data={session.data}
        currentStep={session.currentStep}
        isComplete={session.isComplete}
        onClose={() => session.closeHistoryDrawer()}
        onOpen={() => session.openHistoryDrawer()}
        onSelect={session.handleSelectHistory}
        onDelete={session.handleDeleteHistory}
        onRename={session.handleRenameHistory}
        onUpdateCategory={session.handleUpdateEntryCategory}
        onTogglePin={session.handlePinHistory}
        onExportPdf={(id) => void session.handleDownloadPdfForEntry(id)}
        onGoToStep={session.goToStep}
        onNewMap={session.handleNewMap}
      >
        <ComprensionPhaseRouter />
      </HistoryDrawer>

      {session.continueTransition ? (
        <ContinueExpandTransition
          transition={session.continueTransition}
          onExpandComplete={session.finishContinueExpandTransition}
          onCollapseComplete={session.finishContinueCollapseTransition}
        />
      ) : null}
    </>
  );
}
