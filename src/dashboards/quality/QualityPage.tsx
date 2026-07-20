import React from 'react';
import QualityLayout from '../../components/layout/QualityLayout';
import { Header } from '../../components/layout/Header';

// Quality dashboard body. QualityLayout renders its own inline header today; the
// Header prop is kept for when it migrates to the shared chrome.
export const QualityPage: React.FC = () => {
  return <QualityLayout header={<Header />} />;
};

export default QualityPage;
