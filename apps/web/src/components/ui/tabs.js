import React, { createContext, useContext, useState } from 'react';

// Create context for tabs state
const TabsContext = createContext();

export const Tabs = ({ children, value, onValueChange, className = '', ...props }) => {
  const [activeTab, setActiveTab] = useState(value);
  
  const handleValueChange = (newValue) => {
    setActiveTab(newValue);
    if (onValueChange) onValueChange(newValue);
  };
  
  return (
    <TabsContext.Provider value={{ activeTab, onValueChange: handleValueChange }}>
      <div className={`w-full ${className}`} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ children, className = '', ...props }) => {
  return (
    <div 
      className={`
        inline-flex items-center justify-center w-full
        bg-gray-100/80 backdrop-blur-sm p-1.5 rounded-xl 
        border border-gray-200/60 shadow-sm
        transition-all duration-300 ease-out
        ${className}
      `} 
      {...props}
    >
      <div className="grid grid-cols-4 w-full gap-1">
        {children}
      </div>
    </div>
  );
};

export const TabsTrigger = ({ children, value, className = '', ...props }) => {
  const { activeTab, onValueChange } = useContext(TabsContext);
  const isActive = activeTab === value;
  
  return (
    <button
      onClick={() => onValueChange(value)}
      className={`
        relative inline-flex items-center justify-center whitespace-nowrap 
        px-4 py-3 text-sm font-semibold rounded-lg
        transition-all duration-300 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
        disabled:pointer-events-none disabled:opacity-50
        group overflow-hidden min-h-[44px]
        ${
          isActive
            ? 'bg-white text-blue-700 shadow-md border border-blue-200/60 transform scale-105 z-10'
            : 'text-gray-600 hover:text-gray-900 hover:bg-white/60 active:bg-white/80 hover:scale-102'
        }
        ${className}
      `}
      {...props}
    >
      {/* Background glow for active state */}
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-purple-50 opacity-50 rounded-lg" />
      )}
      
      {/* Content */}
      <span className="relative z-10 transition-transform duration-200 group-hover:scale-105">
        {children}
      </span>
      
      {/* Active indicator */}
      {isActive && (
        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-blue-500 rounded-full" />
      )}
      
      {/* Hover effect */}
      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-200 rounded-lg" />
    </button>
  );
};

export const TabsContent = ({ children, value, className = '', ...props }) => {
  const { activeTab } = useContext(TabsContext);
  const isActive = activeTab === value;
  
  if (!isActive) return null;
  
  return (
    <div 
      className={`
        mt-6 animate-fade-in
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
        ${className}
      `} 
      {...props}
    >
      <div className="animate-slide-up">
        {children}
      </div>
    </div>
  );
};

// Enhanced tab animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slide-up {
    from { 
      opacity: 0; 
      transform: translateY(10px); 
    }
    to { 
      opacity: 1; 
      transform: translateY(0); 
    }
  }
  
  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }
  
  .animate-slide-up {
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  
  .hover\\5C:scale-102:hover {
    transform: scale(1.02);
  }
`;
document.head.appendChild(style);