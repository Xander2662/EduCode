export const parsePseudocodeToPython = (code) => {
    return code.split('# ----------------------')
        .map(b => b.trim())
        .filter(Boolean)
        .map(blockCode => {
            blockCode = blockCode.replaceAll("THEN", ":").replaceAll("DO", ":").replaceAll("FUNCTION","DEF");
            let numOfTabs = 0;

            return blockCode.split('\n')
                .map(l => l.trim())
                .filter(Boolean)
                .reduce((acc, line) => {
                    if (/(ENDIF|ENDDEF|ENDFOR|ENDWHILE)/.test(line)) {
                        numOfTabs = Math.max(0, numOfTabs - 1);
                        return acc;
                    }

                    if (line.includes("# Pozn.")||line.includes("//")) {
                        return acc;
                    }
                    
                    acc.push('\t'.repeat(numOfTabs) + line);
                    if (line.includes("FUNCTION")) {
                        line = line.replace("FUNCTION", "def") + ':';
                        numOfTabs++;
                    }

                    if (/(DEF|WHILE|IF)/.test(line)) {
                        numOfTabs++;
                    }

                    return acc;
                }, []).join('\n');
        }).join('\n# ----------------------\n');
};