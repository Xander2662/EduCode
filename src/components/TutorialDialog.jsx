import React, { useState } from 'react';
import { X, HelpCircle, Move, MousePointer, RefreshCcw, Circle, Square, AlignLeft, Diamond } from 'lucide-react';

export default function TutorialDialog({ onClose }) {
  const [tab, setTab] = useState('zaklady');
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><HelpCircle size={20} className="text-indigo-500"/> Nápověda k editoru</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1"><X size={20} /></button>
        </div>
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 overflow-x-auto">
          <button onClick={() => setTab('zaklady')} className={`px-4 py-3 text-sm font-semibold transition-colors shrink-0 ${tab === 'zaklady' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}>Základní bloky</button>
          <button onClick={() => setTab('spojovani')} className={`px-4 py-3 text-sm font-semibold transition-colors shrink-0 ${tab === 'spojovani' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}>Spojování & Cykly</button>
          <button onClick={() => setTab('klavesy')} className={`px-4 py-3 text-sm font-semibold transition-colors shrink-0 ${tab === 'klavesy' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}>Klávesové zkratky</button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh] text-gray-700 dark:text-gray-300 text-sm leading-relaxed space-y-6">
          
          {tab === 'zaklady' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-fuchsia-200 bg-fuchsia-50 dark:bg-fuchsia-900/20 p-4 rounded-lg flex items-start gap-3">
                <Circle size={24} className="text-fuchsia-600 mt-1 shrink-0" />
                <div>
                  <h4 className="font-bold text-fuchsia-800 dark:text-fuchsia-400">Start / Konec</h4>
                  <p className="text-xs mt-1">Povinné bloky. Označují začátek a konec vaší funkce.</p>
                </div>
              </div>
              <div className="border border-blue-200 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start gap-3">
                <Square size={24} className="text-blue-600 mt-1 shrink-0" />
                <div>
                  <h4 className="font-bold text-blue-800 dark:text-blue-400">Akce (Operace)</h4>
                  <p className="text-xs mt-1">Matematické operace (<code>x = x + 1</code>) nebo volání funkcí. Pokud napíšete <code>"Text"</code>, vygeneruje se PRINT.</p>
                </div>
              </div>
              <div className="border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg flex items-start gap-3">
                <AlignLeft size={24} className="text-emerald-600 mt-1 shrink-0" style={{transform: 'skew(-15deg)'}} />
                <div>
                  <h4 className="font-bold text-emerald-800 dark:text-emerald-400">Vstup / Výstup (IO)</h4>
                  <p className="text-xs mt-1">Pro získání hodnoty od uživatele. Blok má vodoznak, takže dovnitř stačí napsat jen proměnnou (např. <code>x</code>) nebo dosazení (<code>x = 1</code>).</p>
                </div>
              </div>
              <div className="border border-orange-200 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg flex items-start gap-3">
                <Diamond size={24} className="text-orange-600 mt-1 shrink-0" />
                <div>
                  <h4 className="font-bold text-orange-800 dark:text-orange-400">Podmínka (IF / WHILE)</h4>
                  <p className="text-xs mt-1">Obsahuje logický test (např. <code>x &gt; 0</code>). Vychází z ní vždy dvě cesty (Pravda / Nepravda).</p>
                </div>
              </div>
            </div>
          )}

          {tab === 'spojovani' && (
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

          {tab === 'klavesy' && (
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
        </div>
      </div>
    </div>
  );
}