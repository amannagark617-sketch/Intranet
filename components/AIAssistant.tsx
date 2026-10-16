
import React from 'react';

interface AIAssistantProps {
  onGenerate: () => void;
  insights: string;
  isLoading: boolean;
  error: string | null;
}

const LoadingBubble: React.FC = () => (
  <div className="flex items-center space-x-2">
    <div className="w-2 h-2 bg-neutral-400 rounded-full animate-pulse"></div>
    <div className="w-2 h-2 bg-neutral-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
    <div className="w-2 h-2 bg-neutral-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
  </div>
);

const AIAvatar: React.FC = () => (
    <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center mr-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8V4H8"/>
            <rect width="16" height="12" x="4" y="8" rx="2"/>
            <path d="M2 14h2"/>
            <path d="M20 14h2"/>
            <path d="M15 13v2"/>
            <path d="M9 13v2"/>
        </svg>
    </div>
);

const AIAssistant: React.FC<AIAssistantProps> = ({ onGenerate, insights, isLoading, error }) => {
  const showInitialState = !isLoading && !insights && !error;
  const showResponse = insights || error;

  return (
    <div className="bg-neutral-800 text-white rounded-lg p-6 animate-fade-in">
      <h2 className="text-xl font-semibold mb-1 text-white">AI Generated Insights</h2>
      
      {showInitialState && (
        <>
          <p className="text-sm text-neutral-400 mb-4">Click the button to get automated insights from your current data.</p>
          <button
            onClick={onGenerate}
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50"
          >
            Generate Insights
          </button>
        </>
      )}

      {isLoading && (
         <div className="flex items-start mt-4">
             <AIAvatar />
             <div className="bg-neutral-700/50 rounded-lg p-3">
                <LoadingBubble />
             </div>
         </div>
      )}

      {showResponse && (
        <div className="flex items-start mt-4 animate-slide-up">
            <AIAvatar />
            <div className="bg-neutral-700/50 text-neutral-200 rounded-lg p-4 flex-1">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {error ? `Sorry, an error occurred: ${error}` : insights}
                </p>
            </div>
        </div>
      )}

    </div>
  );
};

export default AIAssistant;
