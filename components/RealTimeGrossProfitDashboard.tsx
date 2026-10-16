import React from 'react';
import { REAL_TIME_GP_PORTAL_URL } from '../services/grossProfitService';

interface RealTimeGrossProfitDashboardProps {
  onBackToDashboard?: () => void;
}

export const RealTimeGrossProfitDashboard: React.FC<RealTimeGrossProfitDashboardProps> = () => {
  return (
    <div className="w-full flex-1 flex flex-col h-[calc(100vh-64px)] min-h-[700px] overflow-hidden bg-white">
      <iframe
        src={REAL_TIME_GP_PORTAL_URL}
        title="Little Nap - Real-Time Gross Profit Dashboard"
        className="w-full h-full flex-1 border-0 m-0 p-0 block"
        allow="camera; microphone; geolocation"
      />
    </div>
  );
};

export default RealTimeGrossProfitDashboard;
