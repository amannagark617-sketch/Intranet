import React from 'react';
import { OVERTIME_PORTAL_URL } from '../services/overtimeService';

interface OvertimeTrackerDashboardProps {
  orders?: any[];
  onBackToDashboard?: () => void;
  onSelectOrder?: (order: any) => void;
}

export const OvertimeTrackerDashboard: React.FC<OvertimeTrackerDashboardProps> = () => {
  return (
    <div className="w-full flex-1 flex flex-col h-[calc(100vh-64px)] min-h-[700px] overflow-hidden bg-white">
      <iframe
        src={OVERTIME_PORTAL_URL}
        title="Little Nap Workforce Overtime Portal"
        className="w-full h-full flex-1 border-0 m-0 p-0 block"
        allow="camera; microphone; geolocation"
      />
    </div>
  );
};

export default OvertimeTrackerDashboard;
