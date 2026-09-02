import React from 'react';

export const Tooltip = ({ text, children, position = 'top', fullWidth = false }) => {
    if (!text) return <>{children}</>;
    
    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2'
    };
    
    const arrowClasses = {
        top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-b border-r border-gray-200 dark:border-gray-700',
        bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-t border-l border-gray-200 dark:border-gray-700',
        left: 'right-[-4px] top-1/2 -translate-y-1/2 border-t border-r border-gray-200 dark:border-gray-700',
        right: 'left-[-4px] top-1/2 -translate-y-1/2 border-b border-l border-gray-200 dark:border-gray-700'
    };

    return (
        <div className={`group relative ${fullWidth ? 'w-full' : 'w-fit'} h-fit flex items-center justify-center`}>
            {children}
            <div className={`absolute z-[9999] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 group-hover:delay-500 scale-95 group-hover:scale-100 whitespace-nowrap px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 border border-gray-200 dark:border-gray-700 text-[11px] font-bold tracking-wide rounded shadow-md pointer-events-none normal-case ${positionClasses[position]}`}>
                {text}
                <div className={`absolute w-2 h-2 bg-white dark:bg-gray-700 transform rotate-45 ${arrowClasses[position]}`}></div>
            </div>
        </div>
    );
};
