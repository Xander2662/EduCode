import React, { useState, useEffect } from 'react';
import { X, HelpCircle, Move, MousePointer, RefreshCcw, Circle, Square, AlignLeft, Diamond } from 'lucide-react';

export default function TutorialDialog({ type = 'drawio', focusedBlock = null, onClose }) {
  const [tab, setTab] = useState('zaklady');
  const [activeDeepDive, setActiveDeepDive] = useState(focusedBlock);
  
  useEffect(() => {
      setActiveDeepDive(focusedBlock);
  }, [focusedBlock]);

  useEffect(() => {
      const handleKeyDown = (e) => {
          if (e.key === 'Escape') {
              if (activeDeepDive && !focusedBlock) {
                  setActiveDeepDive(null);
              } else {
                  onClose();
              }
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDeepDive, focusedBlock, onClose]);
  
  const getTitle = () => {
    if (type === 'python') return 'Nápověda: Python';
    if (type === 'pseudocode') return 'Nápověda: Pseudokód';
    return 'Nápověda k editoru';
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <HelpCircle size={20} className="text-indigo-500"/> {activeDeepDive ? "Detail bloku" : getTitle()}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1"><X size={20} /></button>
        </div>

        {activeDeepDive ? (
          <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900/50">
              <div className="p-4 sm:p-6 overflow-y-auto max-h-[70vh]">
                  

                  {activeDeepDive === 'START_END' && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="bg-fuchsia-50 dark:bg-fuchsia-900/20 border-b border-fuchsia-100 dark:border-fuchsia-800/50 p-6 flex items-start justify-between gap-4">
                              <div className="flex items-start gap-4">
                                  <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-fuchsia-200 dark:border-fuchsia-800 shrink-0">
                                      <Circle size={32} className="text-fuchsia-600 dark:text-fuchsia-500" />
                                  </div>
                                  <div>
                                      <h3 className="text-2xl font-bold text-fuchsia-900 dark:text-fuchsia-100">Start / Konec</h3>
                                      <p className="text-fuchsia-700 dark:text-fuchsia-300 text-sm mt-1">Definuje začátek nebo konec funkce.</p>
                                  </div>
                              </div>
                              <button onClick={() => setActiveDeepDive(null)} className="text-gray-800 hover:text-black dark:text-gray-200 dark:hover:text-white font-bold flex items-center gap-1.5 transition-all text-sm bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 shadow-md hover:shadow-lg whitespace-nowrap shrink-0">
                                  Zpět na přehled &rarr;
                              </button>
                          </div>
                          <div className="p-6 space-y-6 text-gray-700 dark:text-gray-300">
                              <div>
                                  <h4 className="font-bold text-gray-900 dark:text-white mb-3 text-lg flex items-center gap-2">Klíčové vlastnosti</h4>
                                  <p className="text-sm leading-relaxed mb-2">
                                      Start označuje místo, kde program začíná – při spuštění debuggeru (Krokování) se zde exekuce poprvé zastaví a inicializuje prostředí. Konec pak logicky určuje místo, kde se program i debugger ukončí. Navíc dvojklikem na text (nebo stiskem F2) můžete blok přejmenovat a definovat tak <strong>název vaší funkce</strong> (např. <code className="bg-gray-100 dark:bg-gray-900 text-fuchsia-600 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">main</code>).
                                  </p>
                              </div>
                              <hr className="border-gray-100 dark:border-gray-700/50" />
                              <div>
                                  <h4 className="font-bold text-gray-900 dark:text-white mb-3 text-lg flex items-center gap-2">Pravidla zapojení</h4>
                                  <ul className="list-disc pl-5 space-y-2 text-sm">
                                      <li><strong>Start:</strong> Může mít pouze odchozí šipky. Z tohoto bloku musí vést šipka do prvního kroku vaší funkce.</li>
                                      <li><strong>Konec:</strong> Slouží jako záchytný bod pro ukončení větve programu a nelze z něj pokračovat dál (nemá odchozí šipky). Je označen textem <code className="bg-gray-100 dark:bg-gray-900 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">ENDFUNCTION</code>.</li>
                                  </ul>
                              </div>
                          </div>
                      </div>
                  )}

                  {activeDeepDive === 'ACTION' && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/50 p-6 flex items-start justify-between gap-4">
                              <div className="flex items-start gap-4">
                                  <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800 shrink-0">
                                      <Square size={32} className="text-blue-600 dark:text-blue-500" />
                                  </div>
                                  <div>
                                      <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100">Akce (Operace)</h3>
                                      <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">Matematické operace, přiřazování hodnot proměnným a volání funkcí.</p>
                                  </div>
                              </div>
                              <button onClick={() => setActiveDeepDive(null)} className="text-gray-800 hover:text-black dark:text-gray-200 dark:hover:text-white font-bold flex items-center gap-1.5 transition-all text-sm bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 shadow-md hover:shadow-lg whitespace-nowrap shrink-0">
                                  Zpět na přehled &rarr;
                              </button>
                          </div>
                          <div className="p-6 space-y-6 text-gray-700 dark:text-gray-300">
                              <div>
                                  <h4 className="font-bold text-gray-900 dark:text-white mb-3 text-lg flex items-center gap-2">Jak používat</h4>
                                  <p className="text-sm leading-relaxed mb-4">
                                      Tento blok představuje jeden výpočetní krok. Provádějí se zde veškeré matematické operace, nastavování hodnot a volání funkcí. Pokud spustíte debugger, přesně na tomto bloku uvidíte, jak se v panelu paměti (Proměnné) mění jejich hodnoty. 
                                      (Print: pokud napíšete pouze text v uvozovkách, systém ho vypíše na obrazovku).
                                  </p>
                              </div>
                              <hr className="border-gray-100 dark:border-gray-700/50" />
                              <div>
                                  <h4 className="font-bold text-gray-900 dark:text-white mb-3 text-lg flex items-center gap-2">Příklady</h4>
                                  <div className="grid gap-3 text-sm">
                                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                          <code className="bg-white dark:bg-gray-800 text-blue-600 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 shadow-sm shrink-0 font-bold min-w-[100px] text-center">x = 10</code>
                                          <span>Uloží číslo 10 do proměnné s názvem <code className="text-xs">x</code>.</span>
                                      </div>
                                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                          <code className="bg-white dark:bg-gray-800 text-blue-600 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 shadow-sm shrink-0 font-bold min-w-[100px] text-center">x = x + 5</code>
                                          <span>Přičte číslo 5 k aktuální hodnotě proměnné <code className="text-xs">x</code>.</span>
                                      </div>
                                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                          <code className="bg-white dark:bg-gray-800 text-blue-600 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 shadow-sm shrink-0 font-bold min-w-[100px] text-center">"Ahoj světe"</code>
                                          <span>Vypíše zadaný text na obrazovku (funguje jako Print). Uvozovky jsou nutné!</span>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {activeDeepDive === 'IO' && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/50 p-6 flex items-start justify-between gap-4">
                              <div className="flex items-start gap-4">
                                  <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-emerald-200 dark:border-emerald-800 shrink-0">
                                      <AlignLeft size={32} className="text-emerald-600 dark:text-emerald-500" style={{transform: 'skew(-15deg)'}} />
                                  </div>
                                  <div>
                                      <h3 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">Vstup / Výstup (IO)</h3>
                                      <p className="text-emerald-700 dark:text-emerald-300 text-sm mt-1">Uložení proměnných a výpis hodnot na obrazovku.</p>
                                  </div>
                              </div>
                              <button onClick={() => setActiveDeepDive(null)} className="text-gray-800 hover:text-black dark:text-gray-200 dark:hover:text-white font-bold flex items-center gap-1.5 transition-all text-sm bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 shadow-md hover:shadow-lg whitespace-nowrap shrink-0">
                                  Zpět na přehled &rarr;
                              </button>
                          </div>
                          <div className="p-6 space-y-6 text-gray-700 dark:text-gray-300">
                              <div>
                                  <h4 className="font-bold text-gray-900 dark:text-white mb-3 text-lg flex items-center gap-2">Jak používat</h4>
                                  <p className="text-sm leading-relaxed mb-4">
                                      Tento blok slouží ke komunikaci s vnějším světem. Při krokování v debuggeru se program na tomto bloku zastaví a počká, dokud uživatel nezadá data do terminálu, případně na obrazovku vypíše zadanou proměnnou.
                                      Kliknutím na vodoznak v levém horním rohu bloku můžete přepínat mezi režimem vstupu (<code className="bg-gray-100 dark:bg-gray-900 text-emerald-600 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">input</code>) a výstupu (<code className="bg-gray-100 dark:bg-gray-900 text-emerald-600 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">print</code>).
                                  </p>
                              </div>
                              <hr className="border-gray-100 dark:border-gray-700/50" />
                              <div>
                                  <h4 className="font-bold text-gray-900 dark:text-white mb-3 text-lg flex items-center gap-2">Příklady</h4>
                                  <div className="grid gap-3 text-sm">
                                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                          <code className="bg-white dark:bg-gray-800 text-emerald-600 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 shadow-sm shrink-0 font-bold min-w-[150px] text-center">vek</code>
                                          <span>Program se při debuggeru zastaví a vyzve uživatele k napsání hodnoty, která se uloží do <code className="text-xs">vek</code>.</span>
                                      </div>
                                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                          <code className="bg-white dark:bg-gray-800 text-emerald-600 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 shadow-sm shrink-0 font-bold min-w-[150px] text-center">jmeno = "Karel"</code>
                                          <span>Přiřadí hodnotu "Karel" proměnné jmeno.</span>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {activeDeepDive === 'CONDITION' && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-800/50 p-6 flex items-start justify-between gap-4">
                              <div className="flex items-start gap-4">
                                  <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-orange-200 dark:border-orange-800 shrink-0">
                                      <Diamond size={32} className="text-orange-600 dark:text-orange-500" />
                                  </div>
                                  <div>
                                      <h3 className="text-2xl font-bold text-orange-900 dark:text-orange-100">Podmínka / Cyklus</h3>
                                      <p className="text-orange-700 dark:text-orange-300 text-sm mt-1">Umožňuje programu reagovat na situace a dělat rozhodnutí.</p>
                                  </div>
                              </div>
                              <button onClick={() => setActiveDeepDive(null)} className="text-gray-800 hover:text-black dark:text-gray-200 dark:hover:text-white font-bold flex items-center gap-1.5 transition-all text-sm bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 shadow-md hover:shadow-lg whitespace-nowrap shrink-0">
                                  Zpět na přehled &rarr;
                              </button>
                          </div>
                          <div className="p-6 space-y-6 text-gray-700 dark:text-gray-300">
                              <div>
                                  <h4 className="font-bold text-gray-900 dark:text-white mb-3 text-lg flex items-center gap-2">Jak používat</h4>
                                  <p className="text-sm leading-relaxed mb-4">
                                      Tento blok funguje jako "rozcestník". Obsahuje logický test (např. zkoumá, zda je hodnota větší než 0). Z bloku pak vždy vychází dvě šipky. 
                                      Při použití debuggeru zde názorně uvidíte, jak počítač vyhodnotí stav paměti a následně "fyzicky" odbočí do správné větve (Ano / Ne) podle toho, zda je podmínka splněna.
                                  </p>
                                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4 rounded-lg flex gap-3 mt-4">
                                      <RefreshCcw className="text-orange-600 shrink-0 mt-0.5" size={20} />
                                      <div>
                                          <strong className="text-orange-800 dark:text-orange-400">Vytvoření cyklu (WHILE):</strong>
                                          <p className="text-sm mt-1 text-orange-700 dark:text-orange-300">Pro vytvoření opakujícího se cyklu nemusíte psát žádný speciální příkaz. Stačí jednoduše vzít odchozí šipku z konce jakékoliv větve a navést ji <strong>zpět do tohoto oranžového bloku</strong>. EduCode z tohoto zapojení cyklus automaticky sestaví.</p>
                                      </div>
                                  </div>
                              </div>
                              <hr className="border-gray-100 dark:border-gray-700/50" />
                              <div>
                                  <h4 className="font-bold text-gray-900 dark:text-white mb-3 text-lg flex items-center gap-2">Příklady</h4>
                                  <div className="grid gap-3 text-sm">
                                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                          <code className="bg-white dark:bg-gray-800 text-orange-600 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 shadow-sm shrink-0 font-bold min-w-[120px] text-center">x &gt; 10</code>
                                          <span>Je číslo <code className="text-xs">x</code> striktně větší než 10?</span>
                                      </div>
                                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                          <code className="bg-white dark:bg-gray-800 text-orange-600 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 shadow-sm shrink-0 font-bold min-w-[120px] text-center">jmeno == "Karel"</code>
                                          <span>Rovná se jméno přesně "Karel"? Znak <code className="text-xs">==</code> znamená porovnání, jedno <code className="text-xs">=</code> slouží pro uložení hodnoty!</span>
                                      </div>
                                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                          <code className="bg-white dark:bg-gray-800 text-orange-600 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 shadow-sm shrink-0 font-bold min-w-[120px] text-center">vek &gt;= 18</code>
                                          <span>Je věk větší <strong>nebo roven</strong> 18?</span>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {activeDeepDive === 'COMMENT' && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-100 dark:border-yellow-800/50 p-6 flex items-start justify-between gap-4">
                              <div className="flex items-start gap-4">
                                  <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-yellow-200 dark:border-yellow-800 shrink-0">
                                      <MessageSquare size={32} className="text-yellow-600 dark:text-yellow-500" />
                                  </div>
                                  <div>
                                      <h3 className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">Komentář</h3>
                                      <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">Poznámky v kódu, které počítač kompletně ignoruje.</p>
                                  </div>
                              </div>
                              <button onClick={() => setActiveDeepDive(null)} className="text-gray-800 hover:text-black dark:text-gray-200 dark:hover:text-white font-bold flex items-center gap-1.5 transition-all text-sm bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 shadow-md hover:shadow-lg whitespace-nowrap shrink-0">
                                  Zpět na přehled &rarr;
                              </button>
                          </div>
                          <div className="p-6 space-y-6 text-gray-700 dark:text-gray-300">
                              <div>
                                  <h4 className="font-bold text-gray-900 dark:text-white mb-3 text-lg flex items-center gap-2">Jak používat</h4>
                                  <p className="text-sm leading-relaxed mb-4">
                                      Slouží pouze pro lidi – ať už pro vás (abyste nezapomněli, co daný výpočet dělá), nebo pro kolegy. 
                                      Jelikož pro počítač nemají význam, debugger tyto bloky během běhu programu kompletně ignoruje a přeskakuje. 
                                      Nemají žádné spojovací šipky a můžete je libovolně umisťovat do prostoru.
                                  </p>
                              </div>
                              <hr className="border-gray-100 dark:border-gray-700/50" />
                              <div>
                                  <h4 className="font-bold text-gray-900 dark:text-white mb-3 text-lg flex items-center gap-2">Formát</h4>
                                  <div className="grid gap-3 text-sm">
                                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                          <code className="bg-white dark:bg-gray-800 text-yellow-600 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 shadow-sm shrink-0 font-bold min-w-[200px] text-center"># Výpočet diskriminantu</code>
                                          <span>Typický jednořádkový komentář. Většina jazyků používá mřížku nebo dvojité lomítko.</span>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          </div>
        ) : (
          <>
            <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 overflow-x-auto">
          <button onClick={() => setTab('zaklady')} className={`px-4 py-3 text-sm font-semibold transition-colors shrink-0 ${tab === 'zaklady' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}>Základní syntaxe</button>
          <button onClick={() => setTab('spojovani')} className={`px-4 py-3 text-sm font-semibold transition-colors shrink-0 ${tab === 'spojovani' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}>{type === 'drawio' ? 'Spojování & Cykly' : 'Podmínky (IF / ELSE)'}</button>
          <button onClick={() => setTab('klavesy')} className={`px-4 py-3 text-sm font-semibold transition-colors shrink-0 ${tab === 'klavesy' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}>{type === 'drawio' ? 'Klávesové zkratky' : 'Cykly (WHILE)'}</button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh] text-gray-700 dark:text-gray-300 text-sm leading-relaxed space-y-6">
          
          {type === 'drawio' && tab === 'zaklady' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div onClick={() => setActiveDeepDive('START_END')} className="border border-fuchsia-200 bg-fuchsia-50 dark:bg-fuchsia-900/20 p-4 rounded-lg flex items-start gap-3 cursor-pointer hover:shadow-md transition-shadow">
                <Circle size={24} className="text-fuchsia-600 mt-1 shrink-0" />
                <div>
                  <h4 className="font-bold text-fuchsia-800 dark:text-fuchsia-400">Start / Konec</h4>
                  <p className="text-xs mt-1">Povinné bloky. Označují začátek a konec vaší funkce.</p>
                </div>
              </div>
              <div onClick={() => setActiveDeepDive('ACTION')} className="border border-blue-200 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start gap-3 cursor-pointer hover:shadow-md transition-shadow">
                <Square size={24} className="text-blue-600 mt-1 shrink-0" />
                <div>
                  <h4 className="font-bold text-blue-800 dark:text-blue-400">Akce (Operace)</h4>
                  <p className="text-xs mt-1">Matematické operace (<code>x = x + 1</code>) nebo volání funkcí. Pokud napíšete <code>"Text"</code>, vygeneruje se PRINT.</p>
                </div>
              </div>
              <div onClick={() => setActiveDeepDive('IO')} className="border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg flex items-start gap-3 cursor-pointer hover:shadow-md transition-shadow">
                <AlignLeft size={24} className="text-emerald-600 mt-1 shrink-0" style={{transform: 'skew(-15deg)'}} />
                <div>
                  <h4 className="font-bold text-emerald-800 dark:text-emerald-400">Vstup / Výstup (IO)</h4>
                  <p className="text-xs mt-1">Pro získání hodnoty od uživatele. Blok má vodoznak, takže dovnitř stačí napsat jen proměnnou (např. <code>x</code>) nebo dosazení (<code>x = 1</code>).</p>
                </div>
              </div>
              <div onClick={() => setActiveDeepDive('CONDITION')} className="border border-orange-200 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg flex items-start gap-3 cursor-pointer hover:shadow-md transition-shadow">
                <Diamond size={24} className="text-orange-600 mt-1 shrink-0" />
                <div>
                  <h4 className="font-bold text-orange-800 dark:text-orange-400">Podmínka (IF / WHILE)</h4>
                  <p className="text-xs mt-1">Obsahuje logický test (např. <code>x &gt; 0</code>). Vychází z ní vždy dvě cesty (Pravda / Nepravda).</p>
                </div>
              </div>
            </div>
          )}

          {type === 'drawio' && tab === 'spojovani' && (
            <>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2 text-base flex items-center gap-2"><Move size={18}/> Vkládání bloků do šipky (Drag & Drop)</h3>
                <p className="mb-4 text-gray-600 dark:text-gray-400">Nemusíte složitě mazat a znovu tvořit spojení. Pokud přesunete nový nebo existující blok <strong>přímo nad existující šipku</strong>, šipka se zbarví modře a blok se do ní sám vklíní a automaticky se propojí.</p>
              </div>
              <hr className="border-gray-200 dark:border-gray-700" />
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2 text-base flex items-center gap-2"><MousePointer size={18}/> Rychlé menu (Pravé tlačítko myši)</h3>
                <p className="mb-4 text-gray-600 dark:text-gray-400">Pro urychlení práce stačí kliknout <strong>pravým tlačítkem myši</strong> do prázdného prostoru. Objeví se kontextové menu a vybraný blok se vytvoří přesně na místě vašeho kurzoru.</p>
              </div>
              <hr className="border-gray-200 dark:border-gray-700" />
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2 text-base flex items-center gap-2"><RefreshCcw size={18}/> Tvorba cyklu (WHILE / FOR)</h3>
                <p className="mb-4 text-gray-600 dark:text-gray-400">Do oranžového kosočtverce <strong>nemusíte psát slovo WHILE</strong>. Stačí napsat pouze samotnou podmínku. Systém automaticky pozná, že jde o cyklus, jakmile vezmete šipku z konce akce a <strong>propojíte ji zpět</strong> do stejného kosočtverce. Modul inteligentního obchvatu se postará o vykreslení trasy mimo bloky.</p>
              </div>
            </>
          )}

          {type === 'drawio' && tab === 'klavesy' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <kbd className="bg-white dark:bg-gray-900 border border-gray-300 px-2 py-1 rounded text-xs mr-2 shadow-sm font-mono">Del</kbd>
                <p className="mt-2 text-xs">Smaže vybraný blok nebo hranu.</p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <kbd className="bg-white dark:bg-gray-900 border border-gray-300 px-2 py-1 rounded text-xs mr-2 shadow-sm font-mono">Ctrl+C</kbd> / <kbd className="bg-white dark:bg-gray-900 border border-gray-300 px-2 py-1 rounded text-xs mr-2 shadow-sm font-mono">Ctrl+V</kbd>
                <p className="mt-2 text-xs">Kopírování a vložení bloků vč. vazeb.</p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <kbd className="bg-white dark:bg-gray-900 border border-gray-300 px-2 py-1 rounded text-xs mr-2 shadow-sm font-mono">F2</kbd>
                <p className="mt-2 text-xs">Okamžitě edituje text vybraného bloku.</p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <kbd className="bg-white dark:bg-gray-900 border border-gray-300 px-2 py-1 rounded text-xs mr-2 shadow-sm font-mono">Shift + Tažení</kbd>
                <p className="mt-2 text-xs">Hromadný výběr pomocí obdélníku.</p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <kbd className="bg-white dark:bg-gray-900 border border-gray-300 px-2 py-1 rounded text-xs mr-2 shadow-sm font-mono">Ctrl + Klik</kbd>
                <p className="mt-2 text-xs">Postupné přidávání bloků do výběru.</p>
              </div>
            </div>
          )}

          {/* PYTHON TUTORIAL */}
          {type === 'python' && tab === 'zaklady' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg mb-2">Struktura programu</h3>
              <p>Každý program by měl být definován jako funkce. Konec funkce se pozná tak, že se zmenší odsazení zleva.</p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs">
{`def hlavni():
    print("Spouštím program...")
    x = 10
    y = x + 5
    print(y)`}
              </pre>
              <h3 className="font-bold text-lg mt-4 mb-2">Vstup (VSTUP)</h3>
              <p>Pro vytvoření Vstupního bloku použijte funkci <code>input()</code>.</p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs">
{`def nacti_vek():
    vek = input()
    jmeno = input()`}
              </pre>
            </div>
          )}
          {type === 'python' && tab === 'spojovani' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg mb-2">Rozhodování (IF/ELSE)</h3>
              <p>Větvení programu provedete pomocí <code>if</code> a <code>else</code>. Můžete využít i <code>elif</code> pro zřetězení více podmínek. Odsazení řídí, co do bloku patří.</p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs">
{`def zkontroluj_vek():
    vek = input()
    if vek >= 18:
        print("Dospělý")
    elif vek >= 15:
        print("Mladistvý")
    else:
        print("Dítě")`}
              </pre>
              <p className="text-xs text-gray-500 mt-2">Tip: Pokud chcete větev nechat prázdnou (např. prázdné else), napište do ní slovo <code>pass</code>.</p>
            </div>
          )}
          {type === 'python' && tab === 'klavesy' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg mb-2">Cykly (WHILE)</h3>
              <p>Cyklus s podmínkou na začátku vytvoříte pomocí klíčového slova <code>while</code>. Nezapomeňte uvnitř cyklu měnit proměnnou, jinak vznikne nekonečná smyčka!</p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs">
{`def odpocet():
    i = 10
    while i > 0:
        print(i)
        i = i - 1
    print("Start!")`}
              </pre>
              <p className="text-xs text-gray-500 mt-2">Tip: Operátory AND, OR a NOT v Pythonu se píší malými písmeny (např. <code>while x &gt; 0 and y &lt; 10:</code>).</p>
            </div>
          )}

          {/* PSEUDOCODE TUTORIAL */}
          {type === 'pseudocode' && tab === 'zaklady' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg mb-2">Struktura programu</h3>
              <p>Pseudokód používá blokovou strukturu ohraničenou klíčovými slovy. Funkci vždy zahájíme a zakončíme příslušným slovem.</p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs">
{`FUNCTION hlavni()
    x = 10
    y = x + 5
    PRINT(y)
ENDFUNCTION`}
              </pre>
              <h3 className="font-bold text-lg mt-4 mb-2">Vstup od uživatele</h3>
              <p>Použijte klíčové slovo <code>VSTUP</code> následované názvem proměnné. Můžete načíst i více proměnných naráz přes čárku.</p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs">
{`FUNCTION nacti()
    VSTUP vek
    VSTUP jmeno, heslo
ENDFUNCTION`}
              </pre>
            </div>
          )}
          {type === 'pseudocode' && tab === 'spojovani' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg mb-2">Rozhodování (IF/ELSE)</h3>
              <p>Větvení programu používá syntaxi <code>IF ... THEN</code>. Konec celého bloku se vždy musí označit jako <code>ENDIF</code>.</p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs">
{`FUNCTION zkontroluj_vek()
    VSTUP vek
    IF vek >= 18 THEN
        PRINT("Dospělý")
    ELSE
        PRINT("Nezletilý")
    ENDIF
ENDFUNCTION`}
              </pre>
              <p className="text-xs text-gray-500 mt-2">Poznámka: Pseudokód nepodporuje ELIF, vícenásobné podmínky tvoříte vnořením dalšího IF do větve ELSE.</p>
            </div>
          )}
          {type === 'pseudocode' && tab === 'klavesy' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg mb-2">Cykly (WHILE)</h3>
              <p>Pro opakování dokud platí podmínka využijte <code>WHILE ... DO</code>. Konec cyklu se uzavírá pomocí <code>ENDWHILE</code>.</p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs">
{`FUNCTION odpocet()
    i = 10
    WHILE i > 0 DO
        PRINT(i)
        i = i - 1
    ENDWHILE
    PRINT("Start!")
ENDFUNCTION`}
              </pre>
              <p className="text-xs text-gray-500 mt-2">Tip: Operátory pište velkými písmeny (AND, OR, NOT, TRUE, FALSE).</p>
            </div>
          )}

        </div>
        </>
        )}
      </div>
    </div>
  );
}