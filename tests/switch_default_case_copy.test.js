import { describe, it, expect } from 'vitest';

describe('Switch Default Case: Duplicate & Copy/Paste Rules', () => {
    // Helper replicating handleDuplicate rule logic
    const filterNodesForDuplicate = (selectedNodes, allNodes) => {
        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        let added = true;
        while (added) {
            added = false;
            allNodes.forEach(n => {
                if ((n.parentId && selectedNodeIds.has(n.parentId) && !selectedNodeIds.has(n.id)) ||
                    (n.data?.switchId && selectedNodeIds.has(n.data.switchId) && !selectedNodeIds.has(n.id))) {
                    selectedNodeIds.add(n.id);
                    added = true;
                }
            });
        }

        // Spatial cascade to inner blocks
        const caseNodes = allNodes.filter(n => selectedNodeIds.has(n.id) && n.type === 'CASE_CONTAINER');
        caseNodes.forEach(caseNode => {
            const switchNode = caseNode.parentId ? allNodes.find(p => p.id === caseNode.parentId) : null;
            const cAbsX = (switchNode ? switchNode.position.x : 0) + caseNode.position.x;
            const cAbsY = (switchNode ? switchNode.position.y : 0) + caseNode.position.y;
            const cW = 250;
            const cH = 166;
            allNodes.forEach(n => {
                if (selectedNodeIds.has(n.id)) return;
                if (['GROUP_BG', 'START_END', 'CASE_CONTAINER', 'SWITCH_CONTAINER', 'LOOP_CONTAINER', 'FOR_CONTAINER'].includes(n.type)) return;
                const cx = n.position.x + 50;
                const cy = n.position.y + 25;
                if (cx >= cAbsX && cx <= cAbsX + cW && cy >= cAbsY && cy <= cAbsY + cH + 30) {
                    selectedNodeIds.add(n.id);
                }
            });
        });

        // Rule: you cannot duplicate default at all!
        if (!selectedNodes.some(n => n.type === 'SWITCH_CONTAINER')) {
            const defaultCases = allNodes.filter(n => selectedNodeIds.has(n.id) && n.type === 'CASE_CONTAINER' && n.data?.isDefault);
            defaultCases.forEach(defNode => {
                selectedNodeIds.delete(defNode.id);
                const switchNode = defNode.parentId ? allNodes.find(p => p.id === defNode.parentId) : null;
                const cAbsX = (switchNode ? switchNode.position.x : 0) + defNode.position.x;
                const cAbsY = (switchNode ? switchNode.position.y : 0) + defNode.position.y;
                const cW = 250;
                const cH = 166;
                allNodes.forEach(n => {
                    if (n.parentId === defNode.id) {
                        selectedNodeIds.delete(n.id);
                    } else {
                        const cx = n.position.x + 50;
                        const cy = n.position.y + 25;
                        if (cx >= cAbsX && cx <= cAbsX + cW && cy >= cAbsY && cy <= cAbsY + cH + 30) {
                            selectedNodeIds.delete(n.id);
                        }
                    }
                });
            });

            if (selectedNodeIds.size === 0) {
                return [];
            }
        }

        return allNodes.filter(n => selectedNodeIds.has(n.id));
    };

    // Helper replicating handlePaste rule logic for cases
    const filterCasesForPaste = (copiedCases, targetSwitch, allNodes) => {
        const targetCases = allNodes.filter(n => n.type === 'CASE_CONTAINER' && (n.parentId === targetSwitch.id || n.data?.switchId === targetSwitch.id));
        const targetHasDefault = targetCases.some(c => c.data?.isDefault);

        return copiedCases.filter(c => {
            if (!c.data?.isDefault) return true;
            const sourceSwitchId = c.parentId || c.data?.switchId;
            if (targetSwitch.id === sourceSwitchId) return false;
            if (targetHasDefault) return false;
            return true;
        });
    };

    it('Nesmí umožnit duplikovat větev DEFAULT (při výběru DEFAULT neprovede nic)', () => {
        const sw = { id: 'sw1', type: 'SWITCH_CONTAINER', position: { x: 100, y: 100 } };
        const case1 = { id: 'case1', type: 'CASE_CONTAINER', parentId: 'sw1', position: { x: 15, y: 44 }, data: { caseVal: '1' } };
        const defCase = { id: 'def1', type: 'CASE_CONTAINER', parentId: 'sw1', position: { x: 280, y: 44 }, data: { isDefault: true } };
        const defInner = { id: 'act_def', type: 'ACTION', position: { x: 390, y: 190 }, data: { label: 'default action' } };

        const allNodes = [sw, case1, defCase, defInner];

        // Pokus o duplikaci pouze DEFAULT větve
        const duplicatedOnlyDef = filterNodesForDuplicate([defCase], allNodes);
        expect(duplicatedOnlyDef).toEqual([]);

        // Pokus o duplikaci Case 1 i DEFAULT najednou -> DEFAULT i jeho vnitřní bloky musí být vynechány
        const duplicatedMixed = filterNodesForDuplicate([case1, defCase], allNodes);
        const dupIds = duplicatedMixed.map(n => n.id);
        expect(dupIds).toContain('case1');
        expect(dupIds).not.toContain('def1');
        expect(dupIds).not.toContain('act_def');
    });

    it('Nesmí umožnit vložit zkopírovaný DEFAULT do stejného Switch kontejneru (neprovede nic)', () => {
        const sw1 = { id: 'sw1', type: 'SWITCH_CONTAINER', position: { x: 100, y: 100 } };
        const defCase = { id: 'def1', type: 'CASE_CONTAINER', parentId: 'sw1', position: { x: 280, y: 44 }, data: { isDefault: true, switchId: 'sw1' } };
        const allNodes = [sw1, defCase];

        const copiedCases = [defCase];
        const validForSameSwitch = filterCasesForPaste(copiedCases, sw1, allNodes);

        // Vložení do stejného switche: neprovede nic
        expect(validForSameSwitch.length).toBe(0);
    });

    it('Umožní vložit zkopírovaný DEFAULT do jiného Switch kontejneru, pokud tam ještě DEFAULT není', () => {
        const sw1 = { id: 'sw1', type: 'SWITCH_CONTAINER', position: { x: 100, y: 100 } };
        const defCase = { id: 'def1', type: 'CASE_CONTAINER', parentId: 'sw1', position: { x: 280, y: 44 }, data: { isDefault: true, switchId: 'sw1' } };
        
        const sw2 = { id: 'sw2', type: 'SWITCH_CONTAINER', position: { x: 600, y: 100 } };
        const sw2Case1 = { id: 'sw2_c1', type: 'CASE_CONTAINER', parentId: 'sw2', position: { x: 15, y: 44 }, data: { caseVal: '1', switchId: 'sw2' } };

        const allNodes = [sw1, defCase, sw2, sw2Case1];

        const copiedCases = [defCase];
        const validForDiffSwitch = filterCasesForPaste(copiedCases, sw2, allNodes);

        // Vložení do jiného switche bez defaultu: povolí zkopírování
        expect(validForDiffSwitch.length).toBe(1);
        expect(validForDiffSwitch[0].id).toBe('def1');
        expect(validForDiffSwitch[0].data.isDefault).toBe(true);
    });

    it('Nesmí umožnit vložit DEFAULT do jiného Switch kontejneru, pokud ten už DEFAULT má', () => {
        const sw1 = { id: 'sw1', type: 'SWITCH_CONTAINER', position: { x: 100, y: 100 } };
        const defCase1 = { id: 'def1', type: 'CASE_CONTAINER', parentId: 'sw1', position: { x: 280, y: 44 }, data: { isDefault: true, switchId: 'sw1' } };
        
        const sw2 = { id: 'sw2', type: 'SWITCH_CONTAINER', position: { x: 600, y: 100 } };
        const defCase2 = { id: 'def2', type: 'CASE_CONTAINER', parentId: 'sw2', position: { x: 280, y: 44 }, data: { isDefault: true, switchId: 'sw2' } };

        const allNodes = [sw1, defCase1, sw2, defCase2];

        const copiedCases = [defCase1];
        const validForDiffSwitchWithDef = filterCasesForPaste(copiedCases, sw2, allNodes);

        // Jiný switch už default má -> neprovede nic
        expect(validForDiffSwitchWithDef.length).toBe(0);
    });
});
