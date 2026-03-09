import { Routes, Route, Navigate } from 'react-router-dom';
import { EvalDataContext, useEvalDataProvider } from '@/hooks/useEvalData';
import { AppShell } from '@/components/layout/AppShell';
import { OverviewPage } from '@/components/dashboard/OverviewPage';
import { MisclassificationsPage } from '@/components/misclassifications/MisclassificationsPage';
import { RootCauseAnalysisPage } from '@/components/root-cause/RootCauseAnalysisPage';
import { LandingPage } from '@/components/upload/LandingPage';
import { ROUTES } from '@/lib/constants';

export default function App() {
  const contextValue = useEvalDataProvider();

  // No data loaded yet — show the landing/upload page
  if (!contextValue.data) {
    return (
      <EvalDataContext.Provider value={contextValue}>
        <LandingPage
          onComplete={(testSet, displayName) => {
            contextValue.addTestSet(testSet, displayName);
          }}
        />
      </EvalDataContext.Provider>
    );
  }

  return (
    <EvalDataContext.Provider value={contextValue}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path={ROUTES.OVERVIEW} element={<OverviewPage />} />
          <Route path={ROUTES.MISCLASSIFICATIONS} element={<MisclassificationsPage />} />
          <Route path={ROUTES.ROOT_CAUSE} element={<RootCauseAnalysisPage />} />
          <Route path="*" element={<Navigate to={ROUTES.OVERVIEW} replace />} />
        </Route>
      </Routes>
    </EvalDataContext.Provider>
  );
}
