export const edgeLabels = {
  '+-': { t: '+', f: '-' },
  'ano-ne': { t: 'Ano', f: 'Ne' },
  'yes-no': { t: 'Yes', f: 'No' },
  'true-false': { t: 'True', f: 'False' }
};

export const getHighlightClass = (isRuntimeActive, isExternal, isSelected, baseBorder) => {
    if (isRuntimeActive) return 'ring-4 ring-red-500 border-red-600 dark:border-red-500 !shadow-[0_0_15px_rgba(239,68,68,0.8)] z-50';
    if (isExternal) return 'ring-4 ring-emerald-300 border-emerald-500 dark:border-emerald-500 !shadow-lg';
    if (isSelected) return 'ring-4 ring-indigo-300 border-indigo-600 dark:border-indigo-500 !shadow-lg';
    return baseBorder;
};