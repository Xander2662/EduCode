import React from 'react';

export const Tooltip = ({ text, children, position = 'top', fullWidth = false }) => {
    if (!text) return <>{children}</>;
    
    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
        'bottom-left': 'top-full right-0 mt-2',
        'bottom-right': 'top-full left-0 mt-2',
        'top-left': 'bottom-full right-0 mb-2',
        'top-right': 'bottom-full left-0 mb-2'
    };
    
    const arrowClasses = {
        top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-b border-r border-gray-200 dark:border-gray-700',
        bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-t border-l border-gray-200 dark:border-gray-700',
        left: 'right-[-4px] top-1/2 -translate-y-1/2 border-t border-r border-gray-200 dark:border-gray-700',
        right: 'left-[-4px] top-1/2 -translate-y-1/2 border-b border-l border-gray-200 dark:border-gray-700',
        'bottom-left': 'top-[-4px] right-3 border-t border-l border-gray-200 dark:border-gray-700',
        'bottom-right': 'top-[-4px] left-3 border-t border-l border-gray-200 dark:border-gray-700',
        'top-left': 'bottom-[-4px] right-3 border-b border-r border-gray-200 dark:border-gray-700',
        'top-right': 'bottom-[-4px] left-3 border-b border-r border-gray-200 dark:border-gray-700'
    };

    return (
        <div className={`group/tooltip relative ${fullWidth ? 'w-full' : 'w-fit'} h-fit flex items-center justify-center`}>
            {children}
            <div className={`absolute z-[9999] opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 group-hover/tooltip:delay-500 scale-95 group-hover/tooltip:scale-100 whitespace-nowrap px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 border border-gray-200 dark:border-gray-700 text-[11px] font-bold tracking-wide rounded shadow-md pointer-events-none normal-case ${positionClasses[position]}`}>
                {text}
                <div className={`absolute w-2 h-2 bg-white dark:bg-gray-700 transform rotate-45 ${arrowClasses[position]}`}></div>
            </div>
        </div>
    );
};

export default Tooltip;
