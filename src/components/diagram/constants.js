// Sdílené konstanty pro hrany a vzhled označení
export const edgeLabels = {
  '+-': { t: '+', f: '-' },
  'ano-ne': { t: 'Ano', f: 'Ne' },
  'yes-no': { t: 'Yes', f: 'No' },
  'true-false': { t: 'True', f: 'False' }
};

export const getSelectClass = (selected, defaultBorder) => selected ? 'ring-4 ring-indigo-300 border-indigo-600 dark:border-indigo-500 !shadow-lg' : defaultBorder;
export const extHighlightClass = 'ring-4 ring-emerald-300 border-emerald-500 dark:border-emerald-500 !shadow-lg';