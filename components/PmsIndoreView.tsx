import React from 'react';

export const PMS_INDORE_PORTAL_URL = 'https://little-nap-subhav-production-dashboard-v1-1033493166417.us-west1.run.app/';

interface PmsIndoreViewProps {
  onBackToDashboard?: () => void;
}

export const PmsIndoreView: React.FC<PmsIndoreViewProps> = () => {
  return (
    <div className="w-full flex-1 flex flex-col h-[calc(100vh-64px)] min-h-[700px] overflow-hidden bg-white">
      <iframe
        src={PMS_INDORE_PORTAL_URL}
        title="Little Nap Recliners - PMS @ Indore Factory Dashboard"
        className="w-full h-full flex-1 border-0 m-0 p-0 block"
        allow="camera; microphone; geolocation"
      />
    </div>
  );
};

export default PmsIndoreView;
