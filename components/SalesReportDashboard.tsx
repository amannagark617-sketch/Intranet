import React from 'react';
import { SALES_REPORT_PORTAL_URL } from '../services/salesReportService';

interface SalesReportDashboardProps {
  onBackToDashboard?: () => void;
}

export const SalesReportDashboard: React.FC<SalesReportDashboardProps> = () => {
  return (
    <div className="w-full flex-1 flex flex-col h-[calc(100vh-64px)] min-h-[700px] overflow-hidden bg-white">
      <iframe
        src={SALES_REPORT_PORTAL_URL}
        title="Little Nap - Sales Report & Team Performance"
        className="w-full h-full flex-1 border-0 m-0 p-0 block"
        allow="camera; microphone; geolocation"
      />
    </div>
  );
};

export default SalesReportDashboard;
