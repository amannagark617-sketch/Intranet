import React from 'react';
import { SERVICE_COMPLAINTS_PORTAL_URL } from '../services/complaintService';

interface ServiceComplaintTrackerDashboardProps {
  onBackToDashboard?: () => void;
}

export const ServiceComplaintTrackerDashboard: React.FC<ServiceComplaintTrackerDashboardProps> = () => {
  return (
    <div className="w-full flex-1 flex flex-col h-[calc(100vh-64px)] min-h-[700px] overflow-hidden bg-white">
      <iframe
        src={SERVICE_COMPLAINTS_PORTAL_URL}
        title="Little Nap - Service Open Complaint Tracker"
        className="w-full h-full flex-1 border-0 m-0 p-0 block"
        allow="camera; microphone; geolocation"
      />
    </div>
  );
};

export default ServiceComplaintTrackerDashboard;
