# EduCode

EduCode je webová aplikace určená pro výuku algoritmizace a programování. Systém kombinuje vizuální návrh pomocí vývojových diagramů s textovým zápisem v podobě pseudokódu a zdrojového kódu (Python). Klíčovou architektonickou vlastností je obousměrná synchronizace stavu v reálném čase a vestavěný interpret pro vizuální krokování algoritmu.

---

## Architektura a funkce

### 1. Vizuální editor (Diagram Editor)
Modul je postaven na knihovně React Flow s rozsáhlými vlastními úpravami pro specifické potřeby vývojových diagramů.

* **Typy uzlů:**
  * `START/END` (Ovál): Definuje počátek a konec algoritmu, podporuje přepínání kontextu (FUNCTION / CLASS).
  * `AKCE` (Čtverec): Slouží pro matematické operace a volání funkcí.
  * `VSTUP/VÝSTUP` (Kosoobdélník): Zajišťuje I/O operace, obsahuje fixní identifikátor vstupu.
  * `PODMÍNKA` (Kosočtverec): Zajišťuje větvení (IF / WHILE), dynamicky generuje hrany pro logické stavy.
  * `KOMENTÁŘ`: Textové poznámky, které interpret při exekuci ignoruje.
* **Manipulace s hranami:**
  * **Routování při vkládání (Drag & Drop):** Přesunutí uzlu nad existující hranu automaticky rozdělí cestu a uzel do ní integruje.
  * **Obchvaty cyklů:** Zpětné hrany (vedoucí do podmínek) automaticky vypočítávají vizuální obchvat kolem existujících bloků.
  * **Logické přepínání:** Interakcí s popiskem hrany lze měnit logický stav větve (True/False, Ano/Ne atd.).
* **Vizuální seskupování (Color Grouping):** Systém vyhodnocuje logické celky. Algoritmus prohledávání do hloubky (DFS) vyhledává těla cyklů a vizuálně je ohraničuje, obdobně seskupuje navazující bloky akcí a vstupů.

### 2. Generátor pseudokódu a parser
* **Textové rozhraní:** Editor s podporou číslování řádků a vizuálním ohraničením bloků kódu.
* **Strukturální mapování (NodeLineMap):** Zajišťuje obousměrné zvýraznění aktivních prvků – výběr uzlu v grafu označí odpovídající řádek v textu a naopak.
* **Lexikální a syntaktická analýza:** Parser zpracovává XML strukturu diagramu, detekuje řídící struktury (cykly, podmínky), odstraňuje formátovací balast a generuje validní pseudokód. Zpracovává rovněž izolované uzly (fragmenty).
* **Generování grafu z kódu:** Reverzní proces sestavuje diagram na základě dopsaného pseudokódu při zachování existujících ID a pozic uzlů na plátně.
* **Transpilace do Pythonu:** Samostatný proces v reálném čase převádí pseudokód do validní syntaxe jazyka Python.

### 3. Synchronizační jádro (Sync Engine)
* **Sledování interakcí (Interaction Tracker):** Jádro detekuje zdroj událostí (prostřednictvím DOM eventů typu `onPointerDownCapture`), aby přesně určilo, který panel je aktuálním zdrojem pravdy. Zabráněno je tak vzniku nekonečných smyček a asynchronních přepisů.
* **Řízení toku dat:** Konfigurace umožňuje obousměrný běh nebo striktně jednosměrný přepis. Proces je optimalizován pomocí debounce mechanismu (400 ms).

### 4. Integrovaný ladicí nástroj (Runtime Debugger)
* **Stavový automat (State Machine):** Interpret neanalyzuje vygenerovaný text, ale prochází přímo datovou strukturu grafu. Zahrnuje bezpečné prostředí pro evaluaci matematických a logických výrazů.
* **Nástroje pro ladění:**
  * Krokování algoritmu, plynulé přehrávání a zastavení exekuce.
  * **Správce paměti (Watch List):** Zobrazení aktuálních stavů a hodnot deklarovaných proměnných.
  * **Výstupní konzole:** Zachytávání a chronologický výpis příkazů typu `PRINT`.
  * **Uživatelské vstupy:** Zastavení exekuce a vyžádání dat přes nativní systémový dialog (`prompt`).
* **Vizuální indikace:** Zvýraznění aktuálně zpracovávaného uzlu a řádku. Při aktivním ladění je editační rozhraní uzamčeno (Read-only režim).

### 5. Validace a zpracování chyb (Error Handling)
* Průběžná statická analýza odhaluje formální a logické chyby: chybějící vstupní/výstupní body, duplicity identifikátorů nebo volání proměnných mimo platný rozsah (scope) či před samotnou deklarací.
* Identifikované chyby jsou vypsány v dedikovaném panelu, který obsahuje i kontextovou nápovědu pro nápravu.

### 6. Uživatelské rozhraní (UI/UX)
* **Správa oken:** Konfigurovatelný layout pro souběžné zobrazení 1 až 3 pracovních panelů.
* **Správa témat:** Nativní podpora světlého a tmavého režimu (včetně syntax highlightingu).
* **I/O operace:** Podpora standardního Draw.io formátu i rozšířeného EduCode XML se zachováním interních struktur a metadat.

---

## Použité technologie

* **Frontend:** React 18, Vite
* **Stylování:** Tailwind CSS
* **Vizuální rozhraní diagramů:** `@xyflow/react` (React Flow)
* **Ikony:** `lucide-react`

---

## Instalace a spuštění pro vývojáře

1. Naklonování repozitáře:
```bash
git clone <url-repozitare>
cd educode