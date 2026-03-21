# Výpočet faktoriálu
Vstup n
vysledek = 1

IF n > 0 THEN
    FOR i = 1 TO n DO
        vysledek = vysledek * i
    ENDFOR
ENDIF

PRINT(vysledek)