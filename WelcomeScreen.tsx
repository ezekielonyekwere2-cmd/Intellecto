import React from 'react';

interface WelcomeScreenProps {
  onPromptClick: (prompt: string) => void;
}

const PromptCard: React.FC<{ title: string, subtitle: string, onClick: () => void }> = ({ title, subtitle, onClick }) => (
    <button
        onClick={onClick}
        className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
    >
        <p className="font-semibold text-gray-200">{title}</p>
        <p className="text-sm text-gray-400">{subtitle}</p>
    </button>
);


const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onPromptClick }) => {
  const examplePrompts = [
    {
      title: 'Plan a trip',
      subtitle: 'for a 3-day trip to Paris',
      prompt: 'What are some must-see places in Paris for a 3-day trip?',
    },
    {
      title: 'Write a thank-you note',
      subtitle: 'to my interviewer',
      prompt: 'Write a short and professional thank-you note to my interviewer.',
    },
    {
      title: 'Explain a concept',
      subtitle: 'like the theory of relativity',
      prompt: 'Explain the theory of relativity in simple terms.',
    },
     {
      title: 'Write some code',
      subtitle: 'for a python script',
      prompt: 'Write a python script to scrape the headlines from a news website.',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold mb-2 text-gray-200">Intellecto AI</h1>
            <p className="text-lg text-gray-400 mb-8">How can I help you today?</p>
            <div className="w-full grid md:grid-cols-2 gap-4 text-left">
                {examplePrompts.map((item, index) => (
                    <PromptCard 
                        key={index} 
                        title={item.title} 
                        subtitle={item.subtitle}
                        onClick={() => onPromptClick(item.prompt)} 
                    />
                ))}
            </div>
        </div>
    </div>
  );
};

export default WelcomeScreen;