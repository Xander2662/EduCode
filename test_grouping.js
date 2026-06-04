import { calculateGroupNodes } from './src/utils/grouping.js';

const nodes = [
    { id: "cond_1", type: "CONDITION", position: { x: 100, y: 100 }, width: 140, height: 70 },
    { id: "action_1", type: "ACTION", position: { x: 100, y: 300 }, width: 100, height: 50 },
    { id: "end_1", type: "END", position: { x: 300, y: 100 }, width: 100, height: 50 }
];

const edges = [
    { source: "cond_1", target: "action_1", sourceHandle: "s-bottom" }, // condition to loop body
    { source: "action_1", target: "cond_1", sourceHandle: "s-bottom" }, // back edge
    { source: "cond_1", target: "end_1", sourceHandle: "s-right" } // condition to end
];

const result = calculateGroupNodes(nodes, edges, true);
console.log(JSON.stringify(result, null, 2));
