export const edgeLabels = {
  '+-': { t: '+', f: '-' },
  'ano-ne': { t: 'Ano', f: 'Ne' },
  'yes-no': { t: 'Yes', f: 'No' },
  'true-false': { t: 'True', f: 'False' }
};

export const getSelectClass = (selected, defaultBorder, isRuntimeActive) => {
    if (isRuntimeActive) return 'ring-4 ring-red-500 border-red-600 dark:border-red-500 !shadow-[0_0_15px_rgba(239,68,68,0.8)] z-50';
    if (selected) return 'ring-4 ring-indigo-300 border-indigo-600 dark:border-indigo-500 !shadow-lg';
    return defaultBorder;
};

export const extHighlightClass = 'ring-4 ring-emerald-300 border-emerald-500 dark:border-emerald-500 !shadow-lg';