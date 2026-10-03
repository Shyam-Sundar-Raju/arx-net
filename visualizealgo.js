const safe = x => String(x).replace(/[^\w-]/g, "_");

function visualizeBFS(graphName, startNodeId, container, nodes, edges, svg, arrowId, directed) {
    if (algoGraphs.has(container)) {
        return;
    } else {
        algoGraphs.add(container);
    }

    const originalNodeColors = new Map();

    svg.selectAll("rect.node").each(function (d) {
        originalNodeColors.set(safe(d.id), d3.select(this).attr("fill"));
    });

    // Block user interactions with the graph during visualization
    svg.select('#interaction-blocker').remove();
    svg.append('style')
        .attr('id', 'interaction-blocker')
        .text('rect.node, .link, .link2 { pointer-events: none !important; }');

    startNodeId = safe(startNodeId);

    const animationSteps = [];
    const levels = { [startNodeId]: 0 };

    // Tracking Variables for snapshots
    let queueState = [];
    let visitedState = new Set();
    let currentId = null;
    let currentNeighbors = [];

    const pushStep = (type, line, extras = {}) => {
        animationSteps.push({
            type, // 'node', 'edge', or 'control'
            line, // Python code line number currently executing
            queue: [...queueState],
            visited: Array.from(visitedState),
            current: currentId,
            neighbors: [...currentNeighbors],
            ...extras
        });
    };

    // Code Line 4 & 5: Initialization (Accounting for 2 comment lines added)
    visitedState.add(startNodeId);
    pushStep('control', 4);

    queueState.push(startNodeId);
    pushStep('node', 5, { id: startNodeId, level: 0, fromEdge: null });

    while (queueState.length > 0) {
        pushStep('control', 6); // while queue:

        currentId = queueState.shift();

        // Find all traversable neighbors before we pop so the variables panel updates accurately
        let neighborsData = [];
        let neighborIds = [];
        edges.forEach(edge => {
            const sId = safe(edge.source.id || edge.source);
            const tId = safe(edge.target.id || edge.target);

            if (sId === currentId) {
                neighborsData.push({ neighborId: tId, sId, tId });
                neighborIds.push(tId);
            } else if (!directed && tId === currentId) {
                neighborsData.push({ neighborId: sId, sId, tId });
                neighborIds.push(sId);
            }
        });
        currentNeighbors = neighborIds;

        pushStep('control', 7); // current = queue.pop(0)

        if (neighborsData.length > 0) {
            pushStep('control', 8); // for neighbor in graph[current]:
        }

        for (let n of neighborsData) {
            const { neighborId, sId, tId } = n;

            pushStep('control', 9); // if neighbor not in visited:

            if (!visitedState.has(neighborId)) {
                visitedState.add(neighborId);
                pushStep('edge', 10, { sourceId: sId, targetId: tId }); // visited.add(neighbor)

                queueState.push(neighborId);
                levels[neighborId] = levels[currentId] + 1;
                pushStep('node', 11, {                 // queue.append(neighbor)
                    id: neighborId,
                    level: levels[neighborId],
                    fromEdge: { u: sId, v: tId }
                });
            }
        }
    }
    pushStep('control', 6); // Loop termination check

    // Clear neighbors at the end for clean finish
    currentNeighbors = [];
    pushStep('control', null);

    const totalSteps = animationSteps.length;
    const BASE_DELAY = 450;
    let currentStep = 0;
    let playInterval = null;

    // Python code with built-in dark theme syntax highlighting and type comments
    const pythonCode = [
        `<span style="color: #c678dd;">def</span> <span style="color: #61afef;">BFS</span>(graph, start):`,
        `    <span style="color: #5c6370; font-style: italic;"># graph: adjacency list e.g., {"a": ["b", "c"]}</span>`,
        `    <span style="color: #5c6370; font-style: italic;"># start: starting node identifier</span>`,
        `    visited = {start}`,
        `    queue = [start]`,
        `    <span style="color: #c678dd;">while</span> queue:`,
        `        current = queue.<span style="color: #61afef;">pop</span>(<span style="color: #d19a66;">0</span>)`,
        `        <span style="color: #c678dd;">for</span> neighbor <span style="color: #c678dd;">in</span> graph[current]:`,
        `            <span style="color: #c678dd;">if</span> neighbor <span style="color: #c678dd;">not in</span> visited:`,
        `                visited.<span style="color: #61afef;">add</span>(neighbor)`,
        `                queue.<span style="color: #61afef;">append</span>(neighbor)`
    ];

    const renderGraphState = (targetStep, animate = false) => {
        const activeNodes = new Set();
        const activeEdges = new Set();
        const stepData = targetStep > 0 ? animationSteps[targetStep - 1] : null;

        // --- Build Dynamic Result Log HTML ---
        let logHTML = `<h3 style="color: #ff8a65;">BFS through graph <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        const currentLine = stepData ? stepData.line : null;
        const currentVar = stepData && stepData.current !== null ? stepData.current : 'None';
        const neighborsVar = stepData && stepData.neighbors ? '[' + stepData.neighbors.join(', ') + ']' : '[]';
        const queueVar = stepData ? '[' + stepData.queue.join(', ') + ']' : '[]';
        const visitedVar = stepData ? '{' + stepData.visited.join(', ') + '}' : '{}';

        // Layout container for Code and Variables
        logHTML += '<div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; text-align: left;">';

        // Python Code Block (Dark Theme with Monospace & Line Numbers)
        logHTML += `<div style="flex: 2; min-width: 320px; background: #282c34; color: #abb2bf; padding: 12px 12px 12px 0; border-radius: 6px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.6; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #1e2227;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding-left: 12px;">Algorithm Execution</div>';

        pythonCode.forEach((line, index) => {
            const lineNum = index + 1;
            const isHighlighted = lineNum === currentLine;
            // Highlight uses a subtle dark background with a blue left border so syntax colors stay visible
            const bg = isHighlighted ? '#3b4048' : 'transparent';
            const borderLeft = isHighlighted ? '3px solid #61afef' : '3px solid transparent';

            // Gutter for line numbers
            const lineNumHTML = `<span style="display: inline-block; width: 24px; text-align: right; margin-right: 12px; color: #4b5263; border-right: 1px solid #3b4048; padding-right: 8px; user-select: none;">${lineNum}</span>`;

            logHTML += `<div style="display: flex; padding: 2px 6px 2px 0; border-radius: 2px; white-space: pre; background-color: ${bg}; border-left: ${borderLeft}; transition: all 0.2s; margin-bottom: 2px;">${lineNumHTML}<span>${line}</span></div>`;
        });
        logHTML += '</div>';

        // Variables Block (Dark Theme with Monospace)
        logHTML += `<div style="flex: 1; min-width: 180px; background: #282c34; padding: 12px; border-radius: 6px; border: 1px solid #1e2227; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.8; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #abb2bf;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Variables</div>';
        logHTML += `<div><span style="color: #c678dd;">current:</span> <span style="color: #e5c07b; font-weight: bold; word-break: break-all;">${currentVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">neighbors:</span> <span style="color: #56b6c2; font-weight: bold; word-break: break-all;">${neighborsVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">queue:</span> <span style="color: #98c379; font-weight: bold; word-break: break-all;">${queueVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">visited:</span> <span style="color: #61afef; font-weight: bold; word-break: break-all;">${visitedVar}</span></div>`;
        logHTML += '</div>';

        logHTML += '</div>'; // End flex container

        // Traversal Text Log
        let textLogHTML = '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #aaa; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Traversal Log</div>';

        for (let i = 0; i < targetStep; i++) {
            const step = animationSteps[i];

            if (step.type === 'node') activeNodes.add(safe(step.id));
            if (step.type === 'edge') activeEdges.add(`${safe(step.sourceId)}-${safe(step.targetId)}`);

            if (step.type === 'node') {
                if (step.level === 0) {
                    textLogHTML += `<div style="margin-bottom: 8px;">Started BFS at vertex <span style="color: #ff8a65; font-weight: bold;">${step.id}</span> at level <span style="color: #ff8a65; font-weight: bold;">0</span></div>`;
                } else {
                    textLogHTML += `<div style="margin-bottom: 8px;">Visited vertex <span style="color: #ff8a65; font-weight: bold;">${step.id}</span> through edge <span style="color: #a3bf60; font-weight: bold;">(${step.fromEdge.u},${step.fromEdge.v})</span> at level <span style="color: #ff8a65; font-weight: bold;">${step.level}</span></div>`;
                }
            }
        }

        logHTML += textLogHTML;

        resultLog.innerHTML = logHTML;
        resultLog.scrollTop = resultLog.scrollHeight;

        // --- Apply Graph Visual Updates ---
        svg.selectAll('rect.node').each(function (d) {
            const el = d3.select(this);
            const nodeId = safe(d.id);

            const isActive = activeNodes.has(nodeId);
            const targetColor = isActive ? nodeVisitColor : originalNodeColors.get(nodeId);

            const lastStepIndex = targetStep - 1;
            const isLatestNode = lastStepIndex >= 0 &&
                animationSteps[lastStepIndex].type === 'node' &&
                safe(animationSteps[lastStepIndex].id) === nodeId;

            if (animate && isLatestNode) {
                el.transition().duration(300).attr('fill', targetColor);
            } else {
                el.interrupt().attr('fill', targetColor);
            }
        });

        svg.selectAll('.link').each(function () {
            const el = d3.select(this);
            const sId = safe(el.attr('source-id').replace(arrowId, ''));
            const tId = safe(el.attr('target-id').replace(arrowId, ''));

            const isActive = activeEdges.has(`${sId}-${tId}`);
            const targetColor = isActive ? nodeVisitColor : edgeColor;

            const lastStepIndex = targetStep - 1;
            const isLatestEdge = lastStepIndex >= 0 &&
                animationSteps[lastStepIndex].type === 'edge' &&
                safe(animationSteps[lastStepIndex].sourceId) === sId &&
                safe(animationSteps[lastStepIndex].targetId) === tId;

            if (animate && isLatestEdge) {
                el.transition().duration(300).attr('stroke', targetColor);
            } else {
                el.interrupt().attr('stroke', targetColor);
            }

            if (directed) {
                const uniqueMarkerId = safe(`${arrowId}-${sId}-${tId}`);
                const markerPath = svg.select(`#${uniqueMarkerId} path`);

                if (!markerPath.empty()) {
                    if (animate && isLatestEdge) {
                        markerPath.transition().duration(300).attr('fill', targetColor);
                    } else {
                        markerPath.interrupt().attr('fill', targetColor);
                    }
                }
            }
        });
    };

    const startLoop = () => {
        if (currentStep >= totalSteps) {
            currentStep = 0;
            playback.updateTimeline(0);
        }

        if (currentStep === 0) renderGraphState(0, false);

        playInterval = setInterval(() => {
            if (currentStep < totalSteps) {
                currentStep++;
                playback.updateTimeline(currentStep);
                renderGraphState(currentStep, true);
            } else {
                stopLoop();
                playback.togglePlayState(false);
            }
        }, BASE_DELAY / playback.speed);
    };

    const stopLoop = () => {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    };

    // Instantiate controller
    const playback = new GraphPlaybackController(svg, totalSteps, container, {
        onPlay: startLoop,
        onPause: stopLoop,
        onSeek: (step) => {
            currentStep = step;
            renderGraphState(currentStep, false);
        },
        onSpeedChange: () => {
            if (playInterval) {
                stopLoop();
                startLoop();
            }
        },
        onEnd: () => {
            stopLoop();
            renderGraphState(0, false);
        }
    });

    startLoop();
    renderGraphState(0, false);
}

function visualizeDFS(graphName, startNodeId, container, nodes, edges, svg, arrowId, directed) {
    if (algoGraphs.has(container)) {
        return;
    } else {
        algoGraphs.add(container);
    }

    const originalNodeColors = new Map();

    svg.selectAll("rect.node").each(function (d) {
        originalNodeColors.set(safe(d.id), d3.select(this).attr("fill"));
    });

    // Block user interactions with the graph during visualization
    svg.select('#interaction-blocker').remove();
    svg.append('style')
        .attr('id', 'interaction-blocker')
        .text('rect.node, .link, .link2 { pointer-events: none !important; }');

    startNodeId = safe(startNodeId);

    const animationSteps = [];

    // Tracking Variables for snapshots
    let stackData = [{ id: startNodeId, level: 0, fromEdge: null }];
    let stackState = [startNodeId];
    let visitedState = new Set();
    let currentId = null;
    let currentNeighbors = [];

    const pushStep = (type, line, extras = {}) => {
        animationSteps.push({
            type, // 'node', 'edge', or 'control'
            line, // Python code line number currently executing
            stack: [...stackState],
            visited: Array.from(visitedState),
            current: currentId,
            neighbors: [...currentNeighbors],
            ...extras
        });
    };

    // Code Line 4 & 5
    pushStep('control', 4);
    pushStep('control', 5);

    while (stackData.length > 0) {
        pushStep('control', 6); // while stack:

        const current = stackData.pop();
        currentId = safe(current.id);
        stackState.pop();

        pushStep('control', 7); // current = stack.pop()

        // Find all traversable neighbors
        let neighborsData = [];
        let neighborIds = [];
        edges.forEach(edge => {
            const sId = safe(edge.source.id || edge.source);
            const tId = safe(edge.target.id || edge.target);

            if (sId === currentId) {
                neighborsData.push({ id: tId, level: current.level + 1, sId, tId });
                neighborIds.push(tId);
            } else if (!directed && tId === currentId) {
                neighborsData.push({ id: sId, level: current.level + 1, sId, tId });
                neighborIds.push(sId);
            }
        });
        currentNeighbors = neighborIds;

        pushStep('control', 8); // if current not in visited:

        if (!visitedState.has(currentId)) {
            visitedState.add(currentId);

            if (current.fromEdge) {
                pushStep('edge', 9, { sourceId: safe(current.fromEdge.u), targetId: safe(current.fromEdge.v) });
            }

            pushStep('node', 9, {
                id: currentId,
                level: current.level,
                fromEdge: current.fromEdge ? { u: safe(current.fromEdge.u), v: safe(current.fromEdge.v) } : null
            });

            if (neighborsData.length > 0) {
                pushStep('control', 10); // for neighbor in reversed(graph[current]):
            }

            const reversedNeighbors = [...neighborsData].reverse();
            for (let n of reversedNeighbors) {
                pushStep('control', 11); // if neighbor not in visited:
                if (!visitedState.has(n.id)) {
                    stackData.push({
                        id: n.id,
                        level: n.level,
                        fromEdge: { u: n.sId, v: n.tId }
                    });
                    stackState.push(n.id);
                    pushStep('control', 12); // stack.append(neighbor)
                }
            }
        }
    }
    pushStep('control', 6); // Loop termination check

    // Clear neighbors at the end for clean finish
    currentNeighbors = [];
    pushStep('control', null);

    const totalSteps = animationSteps.length;
    const BASE_DELAY = 450;
    let currentStep = 0;
    let playInterval = null;

    // Python code with built-in dark theme syntax highlighting and type comments
    const pythonCode = [
        `<span style="color: #c678dd;">def</span> <span style="color: #61afef;">DFS</span>(graph, start):`,
        `    <span style="color: #5c6370; font-style: italic;"># graph: adjacency list e.g., {"a": ["b", "c"]}</span>`,
        `    <span style="color: #5c6370; font-style: italic;"># start: starting node identifier</span>`,
        `    visited = <span style="color: #56b6c2;">set</span>()`,
        `    stack = [start]`,
        `    <span style="color: #c678dd;">while</span> stack:`,
        `        current = stack.<span style="color: #61afef;">pop</span>()`,
        `        <span style="color: #c678dd;">if</span> current <span style="color: #c678dd;">not in</span> visited:`,
        `            visited.<span style="color: #61afef;">add</span>(current)`,
        `            <span style="color: #c678dd;">for</span> neighbor <span style="color: #c678dd;">in</span> <span style="color: #56b6c2;">reversed</span>(graph[current]):`,
        `                <span style="color: #c678dd;">if</span> neighbor <span style="color: #c678dd;">not in</span> visited:`,
        `                    stack.<span style="color: #61afef;">append</span>(neighbor)`
    ];

    const renderGraphState = (targetStep, animate = false) => {
        const activeNodes = new Set();
        const activeEdges = new Set();
        const stepData = targetStep > 0 ? animationSteps[targetStep - 1] : null;

        // --- Build Dynamic Result Log HTML ---
        let logHTML = `<h3 style="color: #ff8a65;">DFS through graph <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        const currentLine = stepData ? stepData.line : null;
        const currentVar = stepData && stepData.current !== null ? stepData.current : 'None';
        const neighborsVar = stepData && stepData.neighbors ? '[' + stepData.neighbors.join(', ') + ']' : '[]';
        const stackVar = stepData ? '[' + stepData.stack.join(', ') + ']' : '[]';
        const visitedVar = stepData ? '{' + stepData.visited.join(', ') + '}' : '{}';

        // Layout container for Code and Variables
        logHTML += '<div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; text-align: left;">';

        // Python Code Block (Dark Theme with Monospace & Line Numbers)
        logHTML += `<div style="flex: 2; min-width: 320px; background: #282c34; color: #abb2bf; padding: 12px 12px 12px 0; border-radius: 6px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.6; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #1e2227;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding-left: 12px;">Algorithm Execution</div>';

        pythonCode.forEach((line, index) => {
            const lineNum = index + 1;
            const isHighlighted = lineNum === currentLine;
            // Highlight uses a subtle dark background with a blue left border so syntax colors stay visible
            const bg = isHighlighted ? '#3b4048' : 'transparent';
            const borderLeft = isHighlighted ? '3px solid #61afef' : '3px solid transparent';

            // Gutter for line numbers
            const lineNumHTML = `<span style="display: inline-block; width: 24px; text-align: right; margin-right: 12px; color: #4b5263; border-right: 1px solid #3b4048; padding-right: 8px; user-select: none;">${lineNum}</span>`;

            logHTML += `<div style="display: flex; padding: 2px 6px 2px 0; border-radius: 2px; white-space: pre; background-color: ${bg}; border-left: ${borderLeft}; transition: all 0.2s; margin-bottom: 2px;">${lineNumHTML}<span>${line}</span></div>`;
        });
        logHTML += '</div>';

        // Variables Block (Dark Theme with Monospace)
        logHTML += `<div style="flex: 1; min-width: 180px; background: #282c34; padding: 12px; border-radius: 6px; border: 1px solid #1e2227; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.8; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #abb2bf;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Variables</div>';
        logHTML += `<div><span style="color: #c678dd;">current:</span> <span style="color: #e5c07b; font-weight: bold; word-break: break-all;">${currentVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">neighbors:</span> <span style="color: #56b6c2; font-weight: bold; word-break: break-all;">${neighborsVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">stack:</span> <span style="color: #98c379; font-weight: bold; word-break: break-all;">${stackVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">visited:</span> <span style="color: #61afef; font-weight: bold; word-break: break-all;">${visitedVar}</span></div>`;
        logHTML += '</div>';

        logHTML += '</div>'; // End flex container

        // Traversal Text Log
        let textLogHTML = '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #aaa; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Traversal Log</div>';

        for (let i = 0; i < targetStep; i++) {
            const step = animationSteps[i];

            if (step.type === 'node') activeNodes.add(safe(step.id));
            if (step.type === 'edge') activeEdges.add(`${safe(step.sourceId)}-${safe(step.targetId)}`);

            if (step.type === 'node') {
                if (step.level === 0) {
                    textLogHTML += `<div style="margin-bottom: 8px;">Started DFS at vertex <span style="color: #ff8a65; font-weight: bold;">${step.id}</span> at level <span style="color: #ff8a65; font-weight: bold;">0</span></div>`;
                } else {
                    textLogHTML += `<div style="margin-bottom: 8px;">Visited vertex <span style="color: #ff8a65; font-weight: bold;">${step.id}</span> through edge <span style="color: #a3bf60; font-weight: bold;">(${step.fromEdge.u},${step.fromEdge.v})</span> at level <span style="color: #ff8a65; font-weight: bold;">${step.level}</span></div>`;
                }
            }
        }

        logHTML += textLogHTML;

        resultLog.innerHTML = logHTML;
        resultLog.scrollTop = resultLog.scrollHeight;

        // --- Apply Graph Visual Updates ---
        svg.selectAll('rect.node').each(function (d) {
            const el = d3.select(this);
            const nodeId = safe(d.id);

            const isActive = activeNodes.has(nodeId);
            const targetColor = isActive ? nodeVisitColor : originalNodeColors.get(nodeId);

            const lastStepIndex = targetStep - 1;
            const isLatestNode = lastStepIndex >= 0 &&
                animationSteps[lastStepIndex].type === 'node' &&
                safe(animationSteps[lastStepIndex].id) === nodeId;

            if (animate && isLatestNode) {
                el.transition().duration(300).attr('fill', targetColor);
            } else {
                el.interrupt().attr('fill', targetColor);
            }
        });

        svg.selectAll('.link').each(function () {
            const el = d3.select(this);
            const sId = safe(el.attr('source-id').replace(arrowId, ''));
            const tId = safe(el.attr('target-id').replace(arrowId, ''));

            const isActive = activeEdges.has(`${sId}-${tId}`);
            const targetColor = isActive ? nodeVisitColor : edgeColor;

            const lastStepIndex = targetStep - 1;
            const isLatestEdge = lastStepIndex >= 0 &&
                animationSteps[lastStepIndex].type === 'edge' &&
                safe(animationSteps[lastStepIndex].sourceId) === sId &&
                safe(animationSteps[lastStepIndex].targetId) === tId;

            if (animate && isLatestEdge) {
                el.transition().duration(300).attr('stroke', targetColor);
            } else {
                el.interrupt().attr('stroke', targetColor);
            }

            if (directed) {
                const uniqueMarkerId = safe(`${arrowId}-${sId}-${tId}`);
                const markerPath = svg.select(`#${uniqueMarkerId} path`);

                if (!markerPath.empty()) {
                    if (animate && isLatestEdge) {
                        markerPath.transition().duration(300).attr('fill', targetColor);
                    } else {
                        markerPath.interrupt().attr('fill', targetColor);
                    }
                }
            }
        });
    };

    const startLoop = () => {
        if (currentStep >= totalSteps) {
            currentStep = 0;
            playback.updateTimeline(0);
        }

        if (currentStep === 0) renderGraphState(0, false);

        playInterval = setInterval(() => {
            if (currentStep < totalSteps) {
                currentStep++;
                playback.updateTimeline(currentStep);
                renderGraphState(currentStep, true);
            } else {
                stopLoop();
                playback.togglePlayState(false);
            }
        }, BASE_DELAY / playback.speed);
    };

    const stopLoop = () => {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    };

    // Instantiate controller
    const playback = new GraphPlaybackController(svg, totalSteps, container, {
        onPlay: startLoop,
        onPause: stopLoop,
        onSeek: (step) => {
            currentStep = step;
            renderGraphState(currentStep, false);
        },
        onSpeedChange: () => {
            if (playInterval) {
                stopLoop();
                startLoop();
            }
        },
        onEnd: () => {
            stopLoop();
            renderGraphState(0, false);
        }
    });

    startLoop();
    renderGraphState(0, false);
}

function visualizeDijkstra(graphName, startNodeId, container, nodes, edges, svg, arrowId, directed) {
    if (algoGraphs.has(container)) {
        return;
    } else {
        algoGraphs.add(container);
    }

    const originalNodeColors = new Map();

    svg.selectAll("rect.node").each(function (d) {
        originalNodeColors.set(safe(d.id), d3.select(this).attr("fill"));
    });

    // Block user interactions with the graph during visualization
    svg.select('#interaction-blocker').remove();
    svg.append('style')
        .attr('id', 'interaction-blocker')
        .text('rect.node, .link, .link2 { pointer-events: none !important; }');

    startNodeId = safe(startNodeId);

    const animationSteps = [];

    // Track states
    let distancesState = {};
    nodes.forEach(n => {
        distancesState[safe(n.id !== undefined ? n.id : n)] = Infinity;
    });
    
    let visitedState = new Set();
    let currentId = null;
    let currentNeighbors = [];
    let currentDistState = null;
    let pqState = [];

    const pushStep = (type, line, extras = {}) => {
        const dists = {};
        for(let k in distancesState) dists[k] = distancesState[k];
        
        animationSteps.push({
            type, // 'node', 'edge', or 'control'
            line,
            pq: [...pqState],
            visited: Array.from(visitedState),
            distances: dists,
            current: currentId,
            currentDist: currentDistState,
            neighbors: [...currentNeighbors],
            ...extras
        });
    };

    pushStep('control', 2); // distances = {node: inf for node in graph}

    distancesState[startNodeId] = 0;
    pushStep('control', 3); // distances[start] = 0

    pqState.push(`(0, ${startNodeId})`);
    pushStep('control', 4); // pq = [(0, start)]

    pushStep('control', 5); // visited = set()

    const distances = {};
    nodes.forEach(n => { distances[safe(n.id !== undefined ? n.id : n)] = Infinity; });
    distances[startNodeId] = 0;

    const pq = new PriorityQueue();
    pq.enqueue({ id: startNodeId, fromEdge: null }, 0);
    const visited = new Set();

    while (!pq.isEmpty()) {
        pushStep('control', 6); // while pq:

        const current = pq.dequeue();
        const u = safe(current.element.id);
        const currentDist = current.priority;
        const fromEdge = current.element.fromEdge;

        currentId = u;
        currentDistState = currentDist;
        pqState = pq.items.map(i => `(${i.priority}, ${i.element.id})`);

        pushStep('control', 7); // current_dist, current = heappop(pq)
        
        pushStep('control', 8); // if current in visited:

        if (visited.has(u)) {
            pushStep('control', 9); // continue
            continue;
        }

        visited.add(u);
        visitedState.add(u);

        if (fromEdge) {
            pushStep('edge', 10, { sourceId: safe(fromEdge.u), targetId: safe(fromEdge.v) });
        }

        pushStep('node', 10, { // visited.add(current)
            id: u,
            dist: currentDist,
            fromEdge: fromEdge ? { u: safe(fromEdge.u), v: safe(fromEdge.v), weight: fromEdge.weight } : null
        });

        // Evaluate all neighbors
        let validNeighbors = [];
        let neighborIds = [];
        
        for (const { source, target, weight } of edges) {
            const sId = safe(source.id !== undefined ? source.id : source);
            const tId = safe(target.id !== undefined ? target.id : target);
            const edgeWeight = weight !== undefined ? weight : 1;

            let isTraversable = false;
            let v = null;
            let edgeU = null;
            let edgeV = null;

            if (sId === u) {
                isTraversable = true;
                v = tId;
                edgeU = sId; edgeV = tId;
            } else if ((!directed) && tId === u) {
                isTraversable = true;
                v = sId;
                edgeU = tId; edgeV = sId;
            }

            if (isTraversable) {
                validNeighbors.push({
                    v, edgeWeight, edgeU, edgeV
                });
                neighborIds.push(v);
            }
        }
        
        currentNeighbors = neighborIds;
        if (validNeighbors.length > 0) pushStep('control', 11); // for neighbor, weight in graph[current]:

        for(const neighborObj of validNeighbors) {
            const { v, edgeWeight, edgeU, edgeV } = neighborObj;
            
            pushStep('control', 12, { evalNeighbor: v }); // if neighbor not in visited:

            if (!visited.has(v)) {
                const alt = distances[u] + edgeWeight;
                pushStep('control', 13, { evalNeighbor: v, evalAlt: alt }); // new_dist = current_dist + weight

                pushStep('control', 14, { evalNeighbor: v }); // if new_dist < distances[neighbor]:
                
                if (alt < distances[v]) {
                    distances[v] = alt;
                    distancesState[v] = alt;
                    pushStep('control', 15, { evalNeighbor: v }); // distances[neighbor] = new_dist

                    pq.enqueue({ id: v, fromEdge: { u: edgeU, v: edgeV, weight: edgeWeight } }, alt);
                    pqState = pq.items.map(i => `(${i.priority}, ${i.element.id})`);
                    pushStep('control', 16, { evalNeighbor: v }); // heappush(pq, (new_dist, neighbor))
                }
            }
        }
    }
    pushStep('control', 6); // Loop end

    currentNeighbors = [];
    currentId = null;
    currentDistState = null;
    pushStep('control', null);

    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600;
    let currentStep = 0;
    let playInterval = null;

    const pythonCode = [
        `<span style="color: #c678dd;">def</span> <span style="color: #61afef;">dijkstra</span>(graph, start):`,
        `    distances = {node: <span style="color: #61afef;">float</span>(<span style="color: #98c379;">'inf'</span>) <span style="color: #c678dd;">for</span> node <span style="color: #c678dd;">in</span> graph}`,
        `    distances[start] = <span style="color: #d19a66;">0</span>`,
        `    pq = [(<span style="color: #d19a66;">0</span>, start)]`,
        `    visited = <span style="color: #56b6c2;">set</span>()`,
        `    <span style="color: #c678dd;">while</span> pq:`,
        `        current_dist, current = heapq.<span style="color: #61afef;">heappop</span>(pq)`,
        `        <span style="color: #c678dd;">if</span> current <span style="color: #c678dd;">in</span> visited:`,
        `            <span style="color: #c678dd;">continue</span>`,
        `        visited.<span style="color: #61afef;">add</span>(current)`,
        `        <span style="color: #c678dd;">for</span> neighbor, weight <span style="color: #c678dd;">in</span> graph[current]:`,
        `            <span style="color: #c678dd;">if</span> neighbor <span style="color: #c678dd;">not in</span> visited:`,
        `                new_dist = current_dist + weight`,
        `                <span style="color: #c678dd;">if</span> new_dist <span style="color: #56b6c2;">&lt;</span> distances[neighbor]:`,
        `                    distances[neighbor] = new_dist`,
        `                    heapq.<span style="color: #61afef;">heappush</span>(pq, (new_dist, neighbor))`
    ];

    const formatDistances = (dists) => {
        let items = [];
        for (let k in dists) {
            items.push(`${k}: ${dists[k] === Infinity ? 'inf' : dists[k]}`);
        }
        return '{' + items.join(', ') + '}';
    };

    const renderGraphState = (targetStep, animate = false) => {
        const activeNodes = new Set();
        const activeEdges = new Set();
        const stepData = targetStep > 0 ? animationSteps[targetStep - 1] : null;

        let logHTML = `<h3 style="color: #ff8a65;">Dijkstra's Algorithm through graph <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        const currentLine = stepData ? stepData.line : null;
        const currentVar = stepData && stepData.current !== null ? stepData.current : 'None';
        const currentDistVar = stepData && stepData.currentDist !== null ? stepData.currentDist : 'None';
        const neighborsVar = stepData && stepData.neighbors ? '[' + stepData.neighbors.join(', ') + ']' : '[]';
        const pqVar = stepData ? '[' + stepData.pq.join(', ') + ']' : '[]';
        const visitedVar = stepData ? '{' + stepData.visited.join(', ') + '}' : '{}';
        const distancesVar = stepData ? formatDistances(stepData.distances) : '{}';

        logHTML += '<div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; text-align: left;">';

        // Python Code Block
        logHTML += `<div style="flex: 2; min-width: 320px; background: #282c34; color: #abb2bf; padding: 12px 12px 12px 0; border-radius: 6px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.6; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #1e2227;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding-left: 12px;">Algorithm Execution</div>';

        pythonCode.forEach((line, index) => {
            const lineNum = index + 1;
            const isHighlighted = lineNum === currentLine;
            const bg = isHighlighted ? '#3b4048' : 'transparent';
            const borderLeft = isHighlighted ? '3px solid #61afef' : '3px solid transparent';
            const lineNumHTML = `<span style="display: inline-block; width: 24px; text-align: right; margin-right: 12px; color: #4b5263; border-right: 1px solid #3b4048; padding-right: 8px; user-select: none;">${lineNum}</span>`;

            logHTML += `<div style="display: flex; padding: 2px 6px 2px 0; border-radius: 2px; white-space: pre; background-color: ${bg}; border-left: ${borderLeft}; transition: all 0.2s; margin-bottom: 2px;">${lineNumHTML}<span>${line}</span></div>`;
        });
        logHTML += '</div>';

        // Variables Block
        logHTML += `<div style="flex: 1; min-width: 180px; background: #282c34; padding: 12px; border-radius: 6px; border: 1px solid #1e2227; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.8; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #abb2bf;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Variables</div>';
        logHTML += `<div><span style="color: #c678dd;">current:</span> <span style="color: #e5c07b; font-weight: bold;">${currentVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">current_dist:</span> <span style="color: #d19a66; font-weight: bold;">${currentDistVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">neighbors:</span> <span style="color: #56b6c2; font-weight: bold; word-break: break-all;">${neighborsVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">pq:</span> <span style="color: #98c379; font-weight: bold; word-break: break-all;">${pqVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">visited:</span> <span style="color: #61afef; font-weight: bold; word-break: break-all;">${visitedVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">distances:</span> <span style="color: #abb2bf; font-weight: bold; word-break: break-all;">${distancesVar}</span></div>`;
        logHTML += '</div>';

        logHTML += '</div>';

        // Traversal Text Log
        let textLogHTML = '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #aaa; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Traversal Log</div>';

        for (let i = 0; i < targetStep; i++) {
            const step = animationSteps[i];

            if (step.type === 'node') activeNodes.add(safe(step.id));
            if (step.type === 'edge') activeEdges.add(`${safe(step.sourceId)}-${safe(step.targetId)}`);

            if (step.type === 'node') {
                if (step.dist === 0) {
                    textLogHTML += `<div style="margin-bottom: 8px;">Started at vertex <span style="color: #ff8a65; font-weight: bold;">${step.id}</span> (Distance: <span style="color: #ff8a65; font-weight: bold;">0</span>)</div>`;
                } else {
                    textLogHTML += `<div style="margin-bottom: 8px;">Finalized vertex <span style="color: #ff8a65; font-weight: bold;">${step.id}</span> via edge <span style="color: #a3bf60; font-weight: bold;">(${step.fromEdge.u},${step.fromEdge.v})</span> [w: ${step.fromEdge.weight}] - Total Dist: <span style="color: #ff8a65; font-weight: bold;">${step.dist}</span></div>`;
                }
            }
        }

        logHTML += textLogHTML;

        resultLog.innerHTML = logHTML;
        resultLog.scrollTop = resultLog.scrollHeight;

        // Apply Node Colors
        svg.selectAll('rect.node').each(function (d) {
            const el = d3.select(this);
            const nodeId = safe(d.id);

            const isActive = activeNodes.has(nodeId);
            const targetColor = isActive ? nodeVisitColor : originalNodeColors.get(nodeId);

            const lastStepIndex = targetStep - 1;
            const isLatestNode = lastStepIndex >= 0 &&
                animationSteps[lastStepIndex].type === 'node' &&
                safe(animationSteps[lastStepIndex].id) === nodeId;

            if (animate && isLatestNode) {
                el.transition().duration(300).attr('fill', targetColor);
            } else {
                el.interrupt().attr('fill', targetColor);
            }
        });

        // Apply Edge Colors
        svg.selectAll('.link').each(function () {
            const el = d3.select(this);
            const sId = safe(el.attr('source-id').replace(arrowId, ''));
            const tId = safe(el.attr('target-id').replace(arrowId, ''));

            const isActive = activeEdges.has(`${sId}-${tId}`) || 
                             (!directed && activeEdges.has(`${tId}-${sId}`));

            const targetColor = isActive ? nodeVisitColor : edgeColor;

            if (animate && isActive) {
                el.transition().duration(300).attr('stroke', targetColor);
            } else {
                el.interrupt().attr('stroke', targetColor);
            }

            if (directed) {
                const uniqueMarkerId = safe(`${arrowId}-${sId}-${tId}`);
                const markerPath = svg.select(`#${uniqueMarkerId} path`);
                if (!markerPath.empty()) {
                    if (animate && isActive) {
                        markerPath.transition().duration(300).attr('fill', targetColor);
                    } else {
                        markerPath.interrupt().attr('fill', targetColor);
                    }
                }
            }
        });
    };

    const startLoop = () => {
        if (currentStep >= totalSteps) {
            currentStep = 0;
            playback.updateTimeline(0);
        }

        if (currentStep === 0) renderGraphState(0, false);

        playInterval = setInterval(() => {
            if (currentStep < totalSteps) {
                currentStep++;
                playback.updateTimeline(currentStep);
                renderGraphState(currentStep, true);
            } else {
                stopLoop();
                playback.togglePlayState(false);
            }
        }, BASE_DELAY / playback.speed);
    };

    const stopLoop = () => {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    };

    const playback = new GraphPlaybackController(svg, totalSteps, container, {
        onPlay: startLoop,
        onPause: stopLoop,
        onSeek: (step) => {
            currentStep = step;
            renderGraphState(currentStep, false);
        },
        onSpeedChange: () => {
            if (playInterval) {
                stopLoop();
                startLoop();
            }
        },
        onEnd: () => {
            stopLoop();
            renderGraphState(0, false);
        }
    });

    startLoop();
    renderGraphState(0, false);
}

function visualizeFloydWarshall(graphName, startNodeId, container, nodes, edges, svg, arrowId, directed) {
    if (algoGraphs.has(container)) {
        return;
    } else {
        algoGraphs.add(container);
    }

    const originalNodeColors = new Map();

    svg.selectAll("rect.node").each(function (d) {
        originalNodeColors.set(safe(d.id), d3.select(this).attr("fill"));
    });

    // Block user interactions with the graph during visualization
    svg.select('#interaction-blocker').remove();
    svg.append('style')
        .attr('id', 'interaction-blocker')
        .text('rect.node, .link, .link2 { pointer-events: none !important; }');

    const nodeIds = nodes.map(n => safe(n.id !== undefined ? n.id : n));

    const dist = {};
    nodeIds.forEach(u => {
        dist[u] = {};
        nodeIds.forEach(v => {
            dist[u][v] = (u === v) ? 0 : Infinity;
        });
    });

    // Populate matrix
    edges.forEach(edge => {
        const u = safe(edge.source.id !== undefined ? edge.source.id : edge.source);
        const v = safe(edge.target.id !== undefined ? edge.target.id : edge.target);
        const weight = edge.weight !== undefined ? edge.weight : 1;

        dist[u][v] = Math.min(dist[u][v], weight);
        if (!directed) {
            dist[v][u] = Math.min(dist[v][u], weight);
        }
    });

    const animationSteps = [];
    
    // Track states
    let kState = null, iState = null, jState = null;
    let newDistState = null;
    let distsClone = () => {
        let clone = {};
        for (let u in dist) {
            clone[u] = {};
            for (let v in dist[u]) clone[u][v] = dist[u][v];
        }
        return clone;
    };

    const pushStep = (type, line, extras = {}) => {
        animationSteps.push({
            type,
            line,
            k: kState,
            i: iState,
            j: jState,
            newDist: newDistState,
            distMatrix: distsClone(),
            ...extras
        });
    };

    pushStep('control', 2);

    nodeIds.forEach(k => {
        kState = k;
        iState = null;
        jState = null;
        newDistState = null;
        pushStep('control', 3); 
        pushStep('pivot', 3, {k: k});

        nodeIds.forEach(i => {
            nodeIds.forEach(j => {
                if (dist[i][k] !== Infinity && dist[k][j] !== Infinity) {
                    const alt = dist[i][k] + dist[k][j];
                    if (alt < dist[i][j]) {
                        iState = i;
                        jState = j;
                        newDistState = alt;
                        
                        pushStep('control', 4);
                        pushStep('control', 5);
                        pushStep('control', 6);
                        pushStep('control', 7);
                        
                        const oldDist = dist[i][j];
                        dist[i][j] = alt;
                        pushStep('control', 8);

                        pushStep('relax', 8, {
                            k: k,
                            i: i,
                            j: j,
                            oldDist: oldDist,
                            newDist: alt
                        });
                    }
                }
            });
        });
    });
    
    kState = null; iState = null; jState = null; newDistState = null;
    pushStep('control', null);

    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600; // ms per step at 1x speed
    let currentStep = 0;
    let playInterval = null;

    const pythonCode = [
        `<span style="color: #c678dd;">def</span> <span style="color: #61afef;">floyd_warshall</span>(graph, nodes):`,
        `    <span style="color: #5c6370; font-style: italic;"># dist initialized to adjacency matrix</span>`,
        `    <span style="color: #c678dd;">for</span> k <span style="color: #c678dd;">in</span> nodes:`,
        `        <span style="color: #c678dd;">for</span> i <span style="color: #c678dd;">in</span> nodes:`,
        `            <span style="color: #c678dd;">for</span> j <span style="color: #c678dd;">in</span> nodes:`,
        `                new_dist = dist[i][k] + dist[k][j]`,
        `                <span style="color: #c678dd;">if</span> new_dist <span style="color: #56b6c2;">&lt;</span> dist[i][j]:`,
        `                    dist[i][j] = new_dist`
    ];

    const formatDistMatrix = (matrix) => {
        let rows = [];
        for (let u in matrix) {
            let cols = [];
            for (let v in matrix[u]) {
                cols.push(`${v}: ${matrix[u][v] === Infinity ? 'inf' : matrix[u][v]}`);
            }
            rows.push(`  ${u}: {${cols.join(', ')}}`);
        }
        return '{\n' + rows.join(',\n') + '\n}';
    };

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        const stepData = targetStep > 0 ? animationSteps[targetStep - 1] : null;

        let logHTML = `<h3 style="color: #ff8a65;">Floyd-Warshall (All-Pairs) on <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        const currentLine = stepData ? stepData.line : null;
        const kVar = stepData && stepData.k !== null ? stepData.k : 'None';
        const iVar = stepData && stepData.i !== null ? stepData.i : 'None';
        const jVar = stepData && stepData.j !== null ? stepData.j : 'None';
        const newDistVar = stepData && stepData.newDist !== null ? stepData.newDist : 'None';
        const distMatrixVar = stepData ? formatDistMatrix(stepData.distMatrix) : '{}';

        logHTML += '<div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; text-align: left;">';

        // Python Code Block
        logHTML += `<div style="flex: 2; min-width: 320px; background: #282c34; color: #abb2bf; padding: 12px 12px 12px 0; border-radius: 6px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.6; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #1e2227;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding-left: 12px;">Algorithm Execution</div>';

        pythonCode.forEach((line, index) => {
            const lineNum = index + 1;
            const isHighlighted = lineNum === currentLine;
            const bg = isHighlighted ? '#3b4048' : 'transparent';
            const borderLeft = isHighlighted ? '3px solid #61afef' : '3px solid transparent';
            const lineNumHTML = `<span style="display: inline-block; width: 24px; text-align: right; margin-right: 12px; color: #4b5263; border-right: 1px solid #3b4048; padding-right: 8px; user-select: none;">${lineNum}</span>`;

            logHTML += `<div style="display: flex; padding: 2px 6px 2px 0; border-radius: 2px; white-space: pre; background-color: ${bg}; border-left: ${borderLeft}; transition: all 0.2s; margin-bottom: 2px;">${lineNumHTML}<span>${line}</span></div>`;
        });
        logHTML += '</div>';

        // Variables Block
        logHTML += `<div style="flex: 1; min-width: 180px; background: #282c34; padding: 12px; border-radius: 6px; border: 1px solid #1e2227; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.8; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #abb2bf;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Variables</div>';
        logHTML += `<div><span style="color: #c678dd;">k:</span> <span style="color: #e5c07b; font-weight: bold;">${kVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">i:</span> <span style="color: #e5c07b; font-weight: bold;">${iVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">j:</span> <span style="color: #e5c07b; font-weight: bold;">${jVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">new_dist:</span> <span style="color: #d19a66; font-weight: bold;">${newDistVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">dist:</span> <pre style="margin: 0; color: #abb2bf; font-family: inherit; font-size: 11px; overflow-x: auto; max-height: 200px;">${distMatrixVar}</pre></div>`;
        logHTML += '</div>';

        logHTML += '</div>';

        // Traversal Text Log
        let textLogHTML = '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #aaa; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Traversal Log</div>';

        let currentActiveNodes = new Set();
        
        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'pivot') {
                textLogHTML += `<div style="margin-top: 10px;"><strong>Phase:</strong> Evaluating intermediate node <span style="color: #ff8a65">${step.k}</span></div>`;
            } else if (step.type === 'relax') {
                const oldStr = step.oldDist === Infinity ? '∞' : step.oldDist;
                textLogHTML += `<div>Relaxed <span style="color: #a3bf60">${step.i} &rarr; ${step.j}</span> via <span style="color: #ff8a65">${step.k}</span> (Dist: ${oldStr} &rarr; <span style="color: #ff8a65">${step.newDist}</span>)</div>`;
            }

            if (idx === targetStep - 1) {
                if (step.k) currentActiveNodes.add(safe(step.k));
                if (step.i) currentActiveNodes.add(safe(step.i));
                if (step.j) currentActiveNodes.add(safe(step.j));
            }
        }

        logHTML += textLogHTML;
        resultLog.innerHTML = logHTML;
        resultLog.scrollTop = resultLog.scrollHeight;

        // Apply Node Colors based on CURRENT frame isolated state
        svg.selectAll('rect.node').each(function (d) {
            const el = d3.select(this);
            const nodeId = safe(d.id);
            const isActive = currentActiveNodes.has(nodeId);

            const targetColor = isActive ? nodeVisitColor : originalNodeColors.get(nodeId);

            if (animate && isActive) {
                el.transition().duration(300).attr('fill', targetColor);
            } else {
                el.interrupt().attr('fill', targetColor);
            }
        });

        // Keep all edges static
        svg.selectAll('.link').interrupt().attr('stroke', edgeColor);
        if (directed) {
            svg.selectAll(`[id^="${arrowId}"] path`).interrupt().attr('fill', edgeColor);
        }
    };

    const startLoop = () => {
        if (currentStep >= totalSteps) {
            currentStep = 0;
            playback.updateTimeline(0);
        }

        if (currentStep === 0) renderGraphState(0, false);

        playInterval = setInterval(() => {
            if (currentStep < totalSteps) {
                currentStep++;
                playback.updateTimeline(currentStep);
                renderGraphState(currentStep, true);
            } else {
                stopLoop();
                playback.togglePlayState(false);
            }
        }, BASE_DELAY / playback.speed);
    };

    const stopLoop = () => {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    };

    const playback = new GraphPlaybackController(svg, totalSteps, container, {
        onPlay: startLoop,
        onPause: stopLoop,
        onSeek: (step) => {
            currentStep = step;
            renderGraphState(currentStep, false);
        },
        onSpeedChange: () => {
            if (playInterval) {
                stopLoop();
                startLoop();
            }
        },
        onEnd: () => {
            stopLoop();
            renderGraphState(0, false);
        }
    });

    startLoop();
    renderGraphState(0, false);
}

function visualizeBellmanFord(graphName, startNodeId, container, nodes, edges, svg, arrowId, directed) {
    if (algoGraphs.has(container)) {
        return;
    } else {
        algoGraphs.add(container);
    }

    const originalNodeColors = new Map();

    svg.selectAll("rect.node").each(function (d) {
        originalNodeColors.set(safe(d.id), d3.select(this).attr("fill"));
    });

    // Block user interactions with the graph during visualization
    svg.select('#interaction-blocker').remove();
    svg.append('style')
        .attr('id', 'interaction-blocker')
        .text('rect.node, .link, .link2 { pointer-events: none !important; }');

    const nodeIds = nodes.map(n => safe(n.id !== undefined ? n.id : n));
    const V = nodeIds.length;

    startNodeId = safe(startNodeId);

    const distances = {};
    nodeIds.forEach(id => distances[id] = Infinity);
    distances[startNodeId] = 0;

    let distancesState = {};
    for (let id of nodeIds) distancesState[id] = Infinity;
    distancesState[startNodeId] = 0;
    
    let iState = null;
    let uState = null;
    let vState = null;
    let wState = null;
    
    const animationSteps = [];

    const pushStep = (type, line, extras = {}) => {
        const dists = {};
        for(let k in distancesState) dists[k] = distancesState[k];
        
        animationSteps.push({
            type,
            line,
            i: iState,
            u: uState,
            v: vState,
            w: wState,
            distances: dists,
            ...extras
        });
    };

    pushStep('control', 2);
    pushStep('control', 3);

    // Helper for edge evaluation
    const evaluateEdge = (u, v, weight, line5, line6, line7) => {
        uState = u;
        vState = v;
        wState = weight;
        
        pushStep('control', line5);
        
        const typeEval = line5 === 5 ? 'eval' : 'eval_cycle';

        animationSteps.push({
            type: typeEval,
            line: line6,
            i: iState, u: uState, v: vState, w: wState,
            distances: {...distancesState},
            distU: distancesState[u],
            distV: distancesState[v]
        });

        if (distances[u] !== Infinity && distances[u] + weight < distances[v]) {
            distances[v] = distances[u] + weight;
            distancesState[v] = distances[v];
            
            pushStep('control', line7);
            
            if (line7 === 7) {
                animationSteps.push({
                    type: 'relax',
                    line: line7,
                    i: iState, u: uState, v: vState, w: wState,
                    distances: {...distancesState},
                    newDist: distances[v]
                });
            } else {
                animationSteps.push({
                    type: 'cycle_found',
                    line: line7,
                    i: iState, u: uState, v: vState, w: wState,
                    distances: {...distancesState},
                });
            }
            return true;
        }
        return false;
    };

    let cycleCheckNeeded = true;

    for (let i = 1; i < V; i++) {
        iState = i;
        uState = null; vState = null; wState = null;
        pushStep('control', 4);
        animationSteps.push({ type: 'phase', line: 4, phase: i, total: V - 1, i: iState, u: uState, v: vState, w: wState, distances: {...distancesState} });
        
        let relaxedInThisPhase = false;

        for (const edge of edges) {
            const u = safe(edge.source.id !== undefined ? edge.source.id : edge.source);
            const v = safe(edge.target.id !== undefined ? edge.target.id : edge.target);
            const weight = edge.weight !== undefined ? edge.weight : 1;

            const relaxed = evaluateEdge(u, v, weight, 5, 6, 7);
            if (relaxed) relaxedInThisPhase = true;

            if (!directed) {
                const relaxedReverse = evaluateEdge(v, u, weight, 5, 6, 7);
                if (relaxedReverse) relaxedInThisPhase = true;
            }
        }

        if (!relaxedInThisPhase) {
            animationSteps.push({ type: 'early_stop', line: 4, phase: i, i: iState, u: uState, v: vState, w: wState, distances: {...distancesState} });
            cycleCheckNeeded = false;
            break;
        }
    }

    iState = null;
    uState = null; vState = null; wState = null;
    pushStep('control', 8);

    if (cycleCheckNeeded) {
        animationSteps.push({ type: 'cycle_check', line: 8, i: iState, u: uState, v: vState, w: wState, distances: {...distancesState} });
        for (const edge of edges) {
            const u = safe(edge.source.id !== undefined ? edge.source.id : edge.source);
            const v = safe(edge.target.id !== undefined ? edge.target.id : edge.target);
            const weight = edge.weight !== undefined ? edge.weight : 1;
            
            if(evaluateEdge(u, v, weight, 8, 9, 10)) break;
            if(!directed) {
                if(evaluateEdge(v, u, weight, 8, 9, 10)) break;
            }
        }
    }

    pushStep('control', null);

    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600; // ms per step
    let currentStep = 0;
    let playInterval = null;

    const pythonCode = [
        `<span style="color: #c678dd;">def</span> <span style="color: #61afef;">bellman_ford</span>(graph, V, start):`,
        `    distances = {node: <span style="color: #61afef;">float</span>(<span style="color: #98c379;">'inf'</span>) <span style="color: #c678dd;">for</span> node <span style="color: #c678dd;">in</span> graph}`,
        `    distances[start] = <span style="color: #d19a66;">0</span>`,
        `    <span style="color: #c678dd;">for</span> i <span style="color: #c678dd;">in</span> <span style="color: #56b6c2;">range</span>(<span style="color: #d19a66;">1</span>, V):`,
        `        <span style="color: #c678dd;">for</span> u, v, w <span style="color: #c678dd;">in</span> graph.edges:`,
        `            <span style="color: #c678dd;">if</span> distances[u] != <span style="color: #56b6c2;">inf</span> <span style="color: #c678dd;">and</span> distances[u] + w <span style="color: #56b6c2;">&lt;</span> distances[v]:`,
        `                distances[v] = distances[u] + w`,
        `    <span style="color: #c678dd;">for</span> u, v, w <span style="color: #c678dd;">in</span> graph.edges:`,
        `        <span style="color: #c678dd;">if</span> distances[u] != <span style="color: #56b6c2;">inf</span> <span style="color: #c678dd;">and</span> distances[u] + w <span style="color: #56b6c2;">&lt;</span> distances[v]:`,
        `            <span style="color: #61afef;">print</span>(<span style="color: #98c379;">"Negative-weight cycle"</span>)`
    ];

    const formatDistances = (dists) => {
        let items = [];
        for (let k in dists) {
            items.push(`${k}: ${dists[k] === Infinity ? 'inf' : dists[k]}`);
        }
        return '{' + items.join(', ') + '}';
    };

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        const stepData = targetStep > 0 ? animationSteps[targetStep - 1] : null;

        let logHTML = `<h3 style="color: #ff8a65;">Bellman-Ford on <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        const currentLine = stepData ? stepData.line : null;
        const iVar = stepData && stepData.i !== null ? stepData.i : 'None';
        const uVar = stepData && stepData.u !== null ? stepData.u : 'None';
        const vVar = stepData && stepData.v !== null ? stepData.v : 'None';
        const wVar = stepData && stepData.w !== null ? stepData.w : 'None';
        const distancesVar = stepData ? formatDistances(stepData.distances) : '{}';

        logHTML += '<div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; text-align: left;">';

        // Python Code Block
        logHTML += `<div style="flex: 2; min-width: 320px; background: #282c34; color: #abb2bf; padding: 12px 12px 12px 0; border-radius: 6px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.6; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #1e2227;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding-left: 12px;">Algorithm Execution</div>';

        pythonCode.forEach((line, index) => {
            const lineNum = index + 1;
            const isHighlighted = lineNum === currentLine;
            const bg = isHighlighted ? '#3b4048' : 'transparent';
            const borderLeft = isHighlighted ? '3px solid #61afef' : '3px solid transparent';
            const lineNumHTML = `<span style="display: inline-block; width: 24px; text-align: right; margin-right: 12px; color: #4b5263; border-right: 1px solid #3b4048; padding-right: 8px; user-select: none;">${lineNum}</span>`;

            logHTML += `<div style="display: flex; padding: 2px 6px 2px 0; border-radius: 2px; white-space: pre; background-color: ${bg}; border-left: ${borderLeft}; transition: all 0.2s; margin-bottom: 2px;">${lineNumHTML}<span>${line}</span></div>`;
        });
        logHTML += '</div>';

        // Variables Block
        logHTML += `<div style="flex: 1; min-width: 180px; background: #282c34; padding: 12px; border-radius: 6px; border: 1px solid #1e2227; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.8; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #abb2bf;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Variables</div>';
        logHTML += `<div><span style="color: #c678dd;">i:</span> <span style="color: #e5c07b; font-weight: bold;">${iVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">u:</span> <span style="color: #e5c07b; font-weight: bold;">${uVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">v:</span> <span style="color: #e5c07b; font-weight: bold;">${vVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">w:</span> <span style="color: #d19a66; font-weight: bold;">${wVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">distances:</span> <span style="color: #abb2bf; font-weight: bold; word-break: break-all;">${distancesVar}</span></div>`;
        logHTML += '</div>';

        logHTML += '</div>';

        let currentActiveNodes = new Set();
        let currentActiveEdges = new Set();
        let isRelaxing = false;

        let textLogHTML = '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #aaa; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Traversal Log</div>';

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'phase') {
                textLogHTML += `<div style="margin-top: 15px;"><strong>Pass <span style="color: #ff8a65">${step.phase}</span> of ${step.total}:</strong> Relaxing all edges</div>`;
            } else if (step.type === 'eval' || step.type === 'eval_cycle') {
                const distUStr = step.distU === Infinity ? '∞' : step.distU;
                const distVStr = step.distV === Infinity ? '∞' : step.distV;
                textLogHTML += `<div>Eval <span style="color: #a3bf60">${step.u} &rarr; ${step.v}</span> (w: ${step.w}) | Dist[${step.u}]=${distUStr}, Dist[${step.v}]=${distVStr}</div>`;
            } else if (step.type === 'relax') {
                textLogHTML += `<div style="padding-left: 10px; color: #ff8a65;">↳ Relaxed! New Dist[${step.v}] = ${step.newDist}</div>`;
            } else if (step.type === 'early_stop') {
                textLogHTML += `<div style="color: #a3bf60; margin-top: 15px;"><strong>Early Stop:</strong> No relaxations in Pass ${step.phase}. Algorithm complete!</div>`;
            } else if (step.type === 'cycle_check') {
                textLogHTML += `<div style="margin-top: 15px;"><strong>Final Pass:</strong> Checking for negative-weight cycles...</div>`;
            } else if (step.type === 'cycle_found') {
                textLogHTML += `<div style="color: #ff8a65; font-weight: bold;">Error: Negative-weight cycle detected involving ${step.u} &rarr; ${step.v}!</div>`;
            }

            if (idx === targetStep - 1) {
                if (step.u) currentActiveNodes.add(safe(step.u));
                if (step.v) currentActiveNodes.add(safe(step.v));
                if (step.u && step.v) currentActiveEdges.add(`${safe(step.u)}-${safe(step.v)}`);
                if (step.type === 'relax' || step.type === 'cycle_found') {
                    isRelaxing = true;
                }
            }
        }

        logHTML += textLogHTML;
        resultLog.innerHTML = logHTML;
        resultLog.scrollTop = resultLog.scrollHeight;

        // Dynamic Colors: standard highlight for 'eval', visit/accent color for 'relax'
        const highlightColor = isRelaxing ? nodeVisitColor : edgeEvalColor;
        const baseEdgeColor = edgeColor;

        // Apply Node Colors
        svg.selectAll('rect.node').each(function (d) {
            const el = d3.select(this);
            const nodeId = safe(d.id);
            const isActive = currentActiveNodes.has(nodeId);

            const targetColor = isActive ? nodeVisitColor : originalNodeColors.get(nodeId);

            if (animate && isActive) {
                el.transition().duration(200).attr('fill', targetColor);
            } else {
                el.interrupt().attr('fill', targetColor);
            }
        });

        // Apply Edge & Arrow Colors
        svg.selectAll('.link').each(function () {
            const el = d3.select(this);
            const sId = safe(el.attr('source-id').replace(arrowId, ''));
            const tId = safe(el.attr('target-id').replace(arrowId, ''));
            const isActive = currentActiveEdges.has(`${sId}-${tId}`);

            const targetColor = isActive ? highlightColor : baseEdgeColor;

            if (animate && isActive) {
                el.transition().duration(200).attr('stroke', targetColor);
            } else {
                el.interrupt().attr('stroke', targetColor);
            }

            if (directed) {
                const uniqueMarkerId = safe(`${arrowId}-${sId}-${tId}`);
                const markerPath = svg.select(`#${uniqueMarkerId} path`);
                if (!markerPath.empty()) {
                    if (animate && isActive) {
                        markerPath.transition().duration(200).attr('fill', targetColor);
                    } else {
                        markerPath.interrupt().attr('fill', targetColor);
                    }
                }
            }
        });
    };

    const startLoop = () => {
        if (currentStep >= totalSteps) {
            currentStep = 0;
            playback.updateTimeline(0);
        }

        if (currentStep === 0) renderGraphState(0, false);

        playInterval = setInterval(() => {
            if (currentStep < totalSteps) {
                currentStep++;
                playback.updateTimeline(currentStep);
                renderGraphState(currentStep, true);
            } else {
                stopLoop();
                playback.togglePlayState(false);
            }
        }, BASE_DELAY / playback.speed);
    };

    const stopLoop = () => {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    };

    const playback = new GraphPlaybackController(svg, totalSteps, container, {
        onPlay: startLoop,
        onPause: stopLoop,
        onSeek: (step) => {
            currentStep = step;
            renderGraphState(currentStep, false);
        },
        onSpeedChange: () => {
            if (playInterval) {
                stopLoop();
                startLoop();
            }
        },
        onEnd: () => {
            stopLoop();
            renderGraphState(0, false);
        }
    });

    startLoop();
    renderGraphState(0, false);
}

function visualizeMSTKruskal(graphName, container, nodes, edges, svg, arrowId) {
    if (algoGraphs.has(container)) {
        return;
    } else {
        algoGraphs.add(container);
    }

    const originalNodeColors = new Map();

    svg.selectAll("rect.node").each(function (d) {
        originalNodeColors.set(safe(d.id), d3.select(this).attr("fill"));
    });

    // Block user interactions with the graph during visualization
    svg.select('#interaction-blocker').remove();
    svg.append('style')
        .attr('id', 'interaction-blocker')
        .text('rect.node, .link, .link2 { pointer-events: none !important; }');

    const nodeIds = nodes.map(n => safe(n.id !== undefined ? n.id : n));
    const V = nodeIds.length;
    if (V === 0) return;

    // Extract and sort all edges by weight ascending
    let sortedEdges = edges.map(edge => {
        return {
            u: safe(edge.source.id !== undefined ? edge.source.id : edge.source),
            v: safe(edge.target.id !== undefined ? edge.target.id : edge.target),
            weight: edge.weight !== undefined ? edge.weight : 1
        };
    });
    sortedEdges.sort((a, b) => a.weight - b.weight);

    // Union-Find (Disjoint Set) Data Structure
    const parent = {};
    const rank = {};
    nodeIds.forEach(id => {
        parent[id] = id;
        rank[id] = 0;
    });

    function find(i) {
        if (parent[i] === i) return i;
        return parent[i] = find(parent[i]); // path compression
    }

    function union(i, j) {
        const rootI = find(i);
        const rootJ = find(j);

        if (rootI !== rootJ) {
            if (rank[rootI] < rank[rootJ]) {
                parent[rootI] = rootJ;
            } else if (rank[rootI] > rank[rootJ]) {
                parent[rootJ] = rootI;
            } else {
                parent[rootJ] = rootI;
                rank[rootI]++;
            }
            return true;
        }
        return false;
    }

    const animationSteps = [];
    let mstEdgesState = [];
    let uState = null, vState = null, wState = null;

    const pushStep = (type, line, extras = {}) => {
        animationSteps.push({
            type,
            line,
            u: uState,
            v: vState,
            w: wState,
            mstEdges: [...mstEdgesState],
            ...extras
        });
    };

    pushStep('control', 2); // mst = []
    pushStep('control', 3); // edges = sorted(...)
    pushStep('control', 4); // uf = UnionFind(...)

    animationSteps.push({ type: 'start', line: 4, edgeCount: sortedEdges.length, u: null, v: null, w: null, mstEdges: [] });

    let edgesAccepted = 0;

    for (const edge of sortedEdges) {
        if (edgesAccepted >= V - 1) break;

        const { u, v, weight } = edge;
        uState = u;
        vState = v;
        wState = weight;

        pushStep('control', 5); // for u, v, w in edges:
        animationSteps.push({ type: 'eval', line: 5, u: u, v: v, w: weight, mstEdges: [...mstEdgesState] });

        pushStep('control', 6); // if uf.find(u) != uf.find(v):
        if (find(u) === find(v)) {
            animationSteps.push({ type: 'reject', line: 6, u: u, v: v, w: weight, mstEdges: [...mstEdgesState] });
        } else {
            union(u, v);
            edgesAccepted++;
            mstEdgesState.push(`(${u},${v})`);
            
            pushStep('control', 7); // uf.union(u, v)
            
            pushStep('control', 8); // mst.append(...)
            animationSteps.push({ type: 'accept', line: 8, u: u, v: v, w: weight, mstEdges: [...mstEdgesState] });
            
            pushStep('control', 9); // if len(mst) == len(graph.nodes) - 1:
            if (edgesAccepted === V - 1) {
                pushStep('control', 10); // break
                break;
            }
        }
    }

    uState = null; vState = null; wState = null;
    pushStep('control', null);

    if (edgesAccepted === V - 1) {
        animationSteps.push({ type: 'complete', line: null, mstEdges: [...mstEdgesState], u: null, v: null, w: null });
    }

    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600;
    let currentStep = 0;
    let playInterval = null;

    const pythonCode = [
        `<span style="color: #c678dd;">def</span> <span style="color: #61afef;">kruskal</span>(graph):`,
        `    mst = []`,
        `    edges = <span style="color: #56b6c2;">sorted</span>(graph.edges, key=<span style="color: #c678dd;">lambda</span> e: e.weight)`,
        `    uf = <span style="color: #e5c07b;">UnionFind</span>(graph.nodes)`,
        `    <span style="color: #c678dd;">for</span> u, v, w <span style="color: #c678dd;">in</span> edges:`,
        `        <span style="color: #c678dd;">if</span> uf.<span style="color: #61afef;">find</span>(u) != uf.<span style="color: #61afef;">find</span>(v):`,
        `            uf.<span style="color: #61afef;">union</span>(u, v)`,
        `            mst.<span style="color: #61afef;">append</span>((u, v, w))`,
        `            <span style="color: #c678dd;">if</span> <span style="color: #56b6c2;">len</span>(mst) == <span style="color: #56b6c2;">len</span>(graph.nodes) - <span style="color: #d19a66;">1</span>:`,
        `                <span style="color: #c678dd;">break</span>`
    ];

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        const stepData = targetStep > 0 ? animationSteps[targetStep - 1] : null;

        let logHTML = `<h3 style="color: #ff8a65;">Kruskal's MST on <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        const currentLine = stepData ? stepData.line : null;
        const uVar = stepData && stepData.u !== null ? stepData.u : 'None';
        const vVar = stepData && stepData.v !== null ? stepData.v : 'None';
        const wVar = stepData && stepData.w !== null ? stepData.w : 'None';
        const mstEdgesVar = stepData ? '[' + stepData.mstEdges.join(', ') + ']' : '[]';

        logHTML += '<div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; text-align: left;">';

        // Python Code Block
        logHTML += `<div style="flex: 2; min-width: 320px; background: #282c34; color: #abb2bf; padding: 12px 12px 12px 0; border-radius: 6px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.6; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #1e2227;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding-left: 12px;">Algorithm Execution</div>';

        pythonCode.forEach((line, index) => {
            const lineNum = index + 1;
            const isHighlighted = lineNum === currentLine;
            const bg = isHighlighted ? '#3b4048' : 'transparent';
            const borderLeft = isHighlighted ? '3px solid #61afef' : '3px solid transparent';
            const lineNumHTML = `<span style="display: inline-block; width: 24px; text-align: right; margin-right: 12px; color: #4b5263; border-right: 1px solid #3b4048; padding-right: 8px; user-select: none;">${lineNum}</span>`;

            logHTML += `<div style="display: flex; padding: 2px 6px 2px 0; border-radius: 2px; white-space: pre; background-color: ${bg}; border-left: ${borderLeft}; transition: all 0.2s; margin-bottom: 2px;">${lineNumHTML}<span>${line}</span></div>`;
        });
        logHTML += '</div>';

        // Variables Block
        logHTML += `<div style="flex: 1; min-width: 180px; background: #282c34; padding: 12px; border-radius: 6px; border: 1px solid #1e2227; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.8; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #abb2bf;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Variables</div>';
        logHTML += `<div><span style="color: #c678dd;">u:</span> <span style="color: #e5c07b; font-weight: bold;">${uVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">v:</span> <span style="color: #e5c07b; font-weight: bold;">${vVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">w:</span> <span style="color: #d19a66; font-weight: bold;">${wVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">mst:</span> <span style="color: #56b6c2; font-weight: bold; word-break: break-all;">${mstEdgesVar}</span></div>`;
        logHTML += '</div>';

        logHTML += '</div>';

        const mstEdges = new Set();
        const mstNodes = new Set();
        let evaluatingEdge = null;
        let rejectEdge = null;
        let totalWeight = 0;

        let textLogHTML = '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #aaa; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Traversal Log</div>';

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'start') {
                textLogHTML += `<div>Sorted ${step.edgeCount} edges by weight. Processing from lowest to highest.</div><br>`;
            } else if (step.type === 'eval') {
                textLogHTML += `<div>Evaluating edge <span style="color: #a3bf60">${step.u} - ${step.v}</span> (w: ${step.w})...</div>`;
                if (idx === targetStep - 1) evaluatingEdge = `${safe(step.u)}-${safe(step.v)}`;
            } else if (step.type === 'accept') {
                textLogHTML += `<div style="padding-left: 10px; color: #a3bf60;">↳ Accepted! Nodes ${step.u} and ${step.v} connected.</div>`;
                mstEdges.add(`${safe(step.u)}-${safe(step.v)}`);
                mstEdges.add(`${safe(step.v)}-${safe(step.u)}`);
                mstNodes.add(safe(step.u));
                mstNodes.add(safe(step.v));
                totalWeight += step.w;
                textLogHTML += `<div style="color: #9b59b6; font-size: 0.9em; margin-top: 5px; padding-left: 10px;">Current MST Cost: ${totalWeight}</div><br>`;
            } else if (step.type === 'reject') {
                textLogHTML += `<div style="padding-left: 10px; color: #ff8a65;">↳ Rejected! Edge creates a cycle.</div><br>`;
                if (idx === targetStep - 1) rejectEdge = `${safe(step.u)}-${safe(step.v)}`;
            } else if (step.type === 'complete') {
                textLogHTML += `<div style="color: #ff8a65; margin-top: 10px; font-weight: bold;">MST Complete! Total Weight: ${totalWeight}</div>`;
            }
        }

        logHTML += textLogHTML;
        if (typeof resultLog !== 'undefined') {
            resultLog.innerHTML = logHTML;
            resultLog.scrollTop = resultLog.scrollHeight;
        }

        // Apply Node Colors
        svg.selectAll('rect.node').each(function (d) {
            const el = d3.select(this);
            const nodeId = safe(d.id);
            const isActive = mstNodes.has(nodeId);

            const targetColor = isActive ? nodeVisitColor : originalNodeColors.get(nodeId);

            // Animate node only if it was newly accepted in this exact step
            const justAccepted = animate && isActive && targetStep > 0
                && animationSteps[targetStep - 1].type === 'accept'
                && (safe(animationSteps[targetStep - 1].u) === nodeId || safe(animationSteps[targetStep - 1].v) === nodeId);

            if (justAccepted) {
                el.transition().duration(300).attr('fill', targetColor);
            } else {
                el.interrupt().attr('fill', targetColor);
            }
        });

        // Apply Edge Colors
        svg.selectAll('.link').each(function () {
            const el = d3.select(this);
            const sId = safe(el.attr('source-id').replace(arrowId, ''));
            const tId = safe(el.attr('target-id').replace(arrowId, ''));
            const edgeKey = `${sId}-${tId}`;
            const reverseEdgeKey = `${tId}-${sId}`;

            const isMST = mstEdges.has(edgeKey) || mstEdges.has(reverseEdgeKey);
            const isEval = evaluatingEdge === edgeKey || evaluatingEdge === reverseEdgeKey;
            const isReject = rejectEdge === edgeKey || rejectEdge === reverseEdgeKey;

            let targetColor = edgeColor;

            if (isMST) {
                targetColor = nodeVisitColor;
            } else if (isEval) {
                targetColor = edgeEvalColor;
            } else if (isReject) {
                targetColor = errorColor;
            }

            if (animate) {
                el.transition().duration(200).attr('stroke', targetColor);
            } else {
                el.interrupt().attr('stroke', targetColor);
            }
        });
    };

    const startLoop = () => {
        if (currentStep >= totalSteps) {
            currentStep = 0;
            playback.updateTimeline(0);
        }
        if (currentStep === 0) renderGraphState(0, false);

        playInterval = setInterval(() => {
            if (currentStep < totalSteps) {
                currentStep++;
                playback.updateTimeline(currentStep);
                renderGraphState(currentStep, true);
            } else {
                stopLoop();
                playback.togglePlayState(false);
            }
        }, BASE_DELAY / playback.speed);
    };

    const stopLoop = () => {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    };

    const playback = new GraphPlaybackController(svg, totalSteps, container, {
        onPlay: startLoop,
        onPause: stopLoop,
        onSeek: (step) => {
            currentStep = step;
            renderGraphState(currentStep, false);
        },
        onSpeedChange: () => {
            if (playInterval) { stopLoop(); startLoop(); }
        },
        onEnd: () => {
            stopLoop(); renderGraphState(0, false);
        }
    });

    startLoop();
    renderGraphState(0, false);
}

function visualizeMSTPrim(graphName, container, nodes, edges, svg, arrowId) {
    if (algoGraphs.has(container)) {
        return;
    } else {
        algoGraphs.add(container);
    }

    const originalNodeColors = new Map();

    svg.selectAll("rect.node").each(function (d) {
        originalNodeColors.set(safe(d.id), d3.select(this).attr("fill"));
    });

    svg.select('#interaction-blocker').remove();
    svg.append('style')
        .attr('id', 'interaction-blocker')
        .text('rect.node, .link, .link2 { pointer-events: none !important; }');

    const nodeIds = nodes.map(n => safe(n.id !== undefined ? n.id : n));
    const V = nodeIds.length;
    if (V === 0) return;

    // Build undirected adjacency list
    const adj = {};
    nodeIds.forEach(id => adj[id] = []);
    edges.forEach(edge => {
        const u = safe(edge.source.id !== undefined ? edge.source.id : edge.source);
        const v = safe(edge.target.id !== undefined ? edge.target.id : edge.target);
        const w = edge.weight !== undefined ? edge.weight : 1;
        adj[u].push({ to: v, weight: w });
        adj[v].push({ to: u, weight: w });
    });

    const startNode = nodeIds[0];

    const animationSteps = [];
    let visitedState = new Set([startNode]);
    let mstEdgesState = [];
    let uState = null, vState = null, wState = null;

    const pq = new PriorityQueue();
    adj[startNode].forEach(edge => {
        pq.enqueue({ u: startNode, v: edge.to, weight: edge.weight }, edge.weight);
    });

    const pushStep = (type, line, extras = {}) => {
        animationSteps.push({
            type,
            line,
            u: uState,
            v: vState,
            w: wState,
            visited: Array.from(visitedState),
            mstEdges: [...mstEdgesState],
            pqState: pq.items.map(i => `${i.element.v}(${i.priority})`),
            ...extras
        });
    };

    pushStep('control', 2); // mst = []
    pushStep('control', 3); // visited = set([start])
    pushStep('control', 4); // edges = ...
    pushStep('control', 5); // heapq.heapify(edges)

    animationSteps.push({ type: 'start', line: 5, node: startNode, u: null, v: null, w: null, visited: Array.from(visitedState), mstEdges: [], pqState: pq.items.map(i => `${i.element.v}(${i.priority})`) });

    let edgesAccepted = 0;

    while (!pq.isEmpty() && edgesAccepted < V - 1) {
        pushStep('control', 6); // while edges and len(visited) < len(graph.nodes):
        
        const { element } = pq.dequeue();
        const { u, v, weight } = element;
        uState = u;
        vState = v;
        wState = weight;

        pushStep('control', 7); // u, v, w = heapq.heappop(edges)
        animationSteps.push({ type: 'eval', line: 7, u: u, v: v, w: weight, visited: Array.from(visitedState), mstEdges: [...mstEdgesState], pqState: pq.items.map(i => `${i.element.v}(${i.priority})`) });

        pushStep('control', 8); // if v not in visited:
        if (visitedState.has(v) && visitedState.has(u)) {
            animationSteps.push({ type: 'reject', line: 8, u: u, v: v, w: weight, visited: Array.from(visitedState), mstEdges: [...mstEdgesState], pqState: pq.items.map(i => `${i.element.v}(${i.priority})`) });
            continue;
        }

        const newNode = visitedState.has(u) ? v : u;
        visitedState.add(newNode);
        edgesAccepted++;
        mstEdgesState.push(`(${u},${v})`);

        pushStep('control', 9); // visited.add(v)
        pushStep('control', 10); // mst.append((u, v, w))
        
        animationSteps.push({ type: 'accept', line: 10, u: u, v: v, w: weight, newNode: newNode, visited: Array.from(visitedState), mstEdges: [...mstEdgesState], pqState: pq.items.map(i => `${i.element.v}(${i.priority})`) });

        pushStep('control', 11); // for next_v, next_w in graph.adj[v]:
        adj[newNode].forEach(edge => {
            if (!visitedState.has(edge.to)) {
                pushStep('control', 12); // if next_v not in visited:
                pq.enqueue({ u: newNode, v: edge.to, weight: edge.weight }, edge.weight);
                pushStep('control', 13); // heapq.heappush(edges, ...)
            }
        });

        if (edgesAccepted === V - 1) {
            pushStep('control', 6); // While condition evaluates to false
            break;
        }
    }

    uState = null; vState = null; wState = null;
    pushStep('control', null);

    if (edgesAccepted === V - 1) {
        animationSteps.push({ type: 'complete', line: null, u: null, v: null, w: null, visited: Array.from(visitedState), mstEdges: [...mstEdgesState], pqState: pq.items.map(i => `${i.element.v}(${i.priority})`) });
    }

    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600;
    let currentStep = 0;
    let playInterval = null;

    const pythonCode = [
        `<span style="color: #c678dd;">def</span> <span style="color: #61afef;">prim</span>(graph, start):`,
        `    mst = []`,
        `    visited = <span style="color: #56b6c2;">set</span>([start])`,
        `    edges = [(start, v, w) <span style="color: #c678dd;">for</span> v, w <span style="color: #c678dd;">in</span> graph.adj[start]]`,
        `    heapq.<span style="color: #61afef;">heapify</span>(edges)`,
        `    <span style="color: #c678dd;">while</span> edges <span style="color: #c678dd;">and</span> <span style="color: #56b6c2;">len</span>(visited) <span style="color: #56b6c2;">&lt;</span> <span style="color: #56b6c2;">len</span>(graph.nodes):`,
        `        u, v, w = heapq.<span style="color: #61afef;">heappop</span>(edges)`,
        `        <span style="color: #c678dd;">if</span> v <span style="color: #c678dd;">not in</span> visited:`,
        `            visited.<span style="color: #61afef;">add</span>(v)`,
        `            mst.<span style="color: #61afef;">append</span>((u, v, w))`,
        `            <span style="color: #c678dd;">for</span> next_v, next_w <span style="color: #c678dd;">in</span> graph.adj[v]:`,
        `                <span style="color: #c678dd;">if</span> next_v <span style="color: #c678dd;">not in</span> visited:`,
        `                    heapq.<span style="color: #61afef;">heappush</span>(edges, (v, next_v, next_w))`
    ];

    const renderGraphState = (targetStep, animate = false) => {
        const stepData = targetStep > 0 ? animationSteps[targetStep - 1] : null;

        let logHTML = `<h3 style="color: #ff8a65;">Prim's MST on <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        const currentLine = stepData ? stepData.line : null;
        const uVar = stepData && stepData.u !== null ? stepData.u : 'None';
        const vVar = stepData && stepData.v !== null ? stepData.v : 'None';
        const wVar = stepData && stepData.w !== null ? stepData.w : 'None';
        const mstEdgesVar = stepData ? '[' + stepData.mstEdges.join(', ') + ']' : '[]';
        const visitedVar = stepData ? '{' + stepData.visited.join(', ') + '}' : '{}';

        logHTML += '<div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; text-align: left;">';

        // Python Code Block
        logHTML += `<div style="flex: 2; min-width: 320px; background: #282c34; color: #abb2bf; padding: 12px 12px 12px 0; border-radius: 6px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.6; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #1e2227;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding-left: 12px;">Algorithm Execution</div>';

        pythonCode.forEach((line, index) => {
            const lineNum = index + 1;
            const isHighlighted = lineNum === currentLine;
            const bg = isHighlighted ? '#3b4048' : 'transparent';
            const borderLeft = isHighlighted ? '3px solid #61afef' : '3px solid transparent';
            const lineNumHTML = `<span style="display: inline-block; width: 24px; text-align: right; margin-right: 12px; color: #4b5263; border-right: 1px solid #3b4048; padding-right: 8px; user-select: none;">${lineNum}</span>`;

            logHTML += `<div style="display: flex; padding: 2px 6px 2px 0; border-radius: 2px; white-space: pre; background-color: ${bg}; border-left: ${borderLeft}; transition: all 0.2s; margin-bottom: 2px;">${lineNumHTML}<span>${line}</span></div>`;
        });
        logHTML += '</div>';

        // Variables Block
        logHTML += `<div style="flex: 1; min-width: 180px; background: #282c34; padding: 12px; border-radius: 6px; border: 1px solid #1e2227; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.8; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #abb2bf;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Variables</div>';
        logHTML += `<div><span style="color: #c678dd;">u:</span> <span style="color: #e5c07b; font-weight: bold;">${uVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">v:</span> <span style="color: #e5c07b; font-weight: bold;">${vVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">w:</span> <span style="color: #d19a66; font-weight: bold;">${wVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">visited:</span> <span style="color: #56b6c2; font-weight: bold; word-break: break-all;">${visitedVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">mst:</span> <span style="color: #98c379; font-weight: bold; word-break: break-all;">${mstEdgesVar}</span></div>`;
        logHTML += '</div>';

        logHTML += '</div>';

        const mstEdges = new Set();
        const mstNodes = new Set();
        let evaluatingEdge = null;
        let rejectEdge = null;
        let totalWeight = 0;

        let textLogHTML = '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #aaa; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Traversal Log</div>';

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'start') {
                textLogHTML += `<div>Started growing tree from node <span style="color: #ff8a65">${step.node}</span></div>`;
                if (step.pqState) {
                    textLogHTML += `<div style="color: #9b59b6; font-size: 0.9em; margin-top: 5px;">Priority Queue: [${step.pqState.join(', ')}]</div>`;
                }
                textLogHTML += `<br>`;
                mstNodes.add(safe(step.node));
            } else if (step.type === 'eval') {
                textLogHTML += `<div>Evaluating frontier edge <span style="color: #a3bf60">${step.u} - ${step.v}</span> (w: ${step.w})...</div>`;
                if (idx === targetStep - 1) evaluatingEdge = `${safe(step.u)}-${safe(step.v)}`;
            } else if (step.type === 'accept') {
                textLogHTML += `<div style="padding-left: 10px; color: #a3bf60;">↳ Accepted! Added node ${step.newNode} to MST.</div>`;
                mstEdges.add(`${safe(step.u)}-${safe(step.v)}`);
                mstEdges.add(`${safe(step.v)}-${safe(step.u)}`);
                mstNodes.add(safe(step.u));
                mstNodes.add(safe(step.v));
                totalWeight += step.w;
                if (step.pqState) {
                    textLogHTML += `<div style="color: #9b59b6; font-size: 0.9em; margin-top: 5px; padding-left: 10px;">Priority Queue: [${step.pqState.join(', ')}]</div>`;
                }
                textLogHTML += `<div style="color: #9b59b6; font-size: 0.9em; margin-top: 5px; padding-left: 10px;">Current MST Cost: ${totalWeight}</div><br>`;
            } else if (step.type === 'reject') {
                textLogHTML += `<div style="padding-left: 10px; color: #ff8a65;">↳ Rejected! Both nodes already in MST.</div><br>`;
                if (idx === targetStep - 1) rejectEdge = `${safe(step.u)}-${safe(step.v)}`;
            } else if (step.type === 'complete') {
                textLogHTML += `<div style="color: #ff8a65; margin-top: 10px; font-weight: bold;">MST Complete! Total Weight: ${totalWeight}</div>`;
            }
        }

        logHTML += textLogHTML;
        if (typeof resultLog !== 'undefined') {
            resultLog.innerHTML = logHTML;
            resultLog.scrollTop = resultLog.scrollHeight;
        }

        // Apply node colors
        svg.selectAll('rect.node').each(function (d) {
            const el = d3.select(this);
            const nodeId = safe(d.id);
            const isActive = mstNodes.has(nodeId);

            const targetColor = isActive ? nodeVisitColor : originalNodeColors.get(nodeId);

            if (animate && isActive && targetStep > 0 && animationSteps[targetStep - 1].type === 'accept' && safe(animationSteps[targetStep - 1].newNode) === nodeId) {
                el.transition().duration(300).attr('fill', targetColor);
            } else {
                el.interrupt().attr('fill', targetColor);
            }
        });

        svg.selectAll('.link').each(function () {
            const el = d3.select(this);
            const sId = safe(el.attr('source-id').replace(arrowId, ''));
            const tId = safe(el.attr('target-id').replace(arrowId, ''));
            const edgeKey = `${sId}-${tId}`;
            const reverseEdgeKey = `${tId}-${sId}`;

            const isMST = mstEdges.has(edgeKey) || mstEdges.has(reverseEdgeKey);
            const isEval = evaluatingEdge === edgeKey || evaluatingEdge === reverseEdgeKey;
            const isReject = rejectEdge === edgeKey || rejectEdge === reverseEdgeKey;

            let targetColor = edgeColor;

            if (isMST) {
                targetColor = nodeVisitColor;
            } else if (isEval) {
                targetColor = edgeEvalColor;
            } else if (isReject) {
                targetColor = errorColor;
            }

            if (animate) {
                el.transition().duration(200).attr('stroke', targetColor);
            } else {
                el.interrupt().attr('stroke', targetColor);
            }
        });
    };

    const startLoop = () => {
        if (currentStep >= totalSteps) {
            currentStep = 0;
            playback.updateTimeline(0);
        }
        if (currentStep === 0) renderGraphState(0, false);

        playInterval = setInterval(() => {
            if (currentStep < totalSteps) {
                currentStep++;
                playback.updateTimeline(currentStep);
                renderGraphState(currentStep, true);
            } else {
                stopLoop();
                playback.togglePlayState(false);
            }
        }, BASE_DELAY / playback.speed);
    };

    const stopLoop = () => {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    };

    const playback = new GraphPlaybackController(svg, totalSteps, container, {
        onPlay: startLoop,
        onPause: stopLoop,
        onSeek: (step) => {
            currentStep = step;
            renderGraphState(currentStep, false);
        },
        onSpeedChange: () => {
            if (playInterval) { stopLoop(); startLoop(); }
        },
        onEnd: () => {
            stopLoop(); renderGraphState(0, false);
        }
    });

    startLoop();
    renderGraphState(0, false);
}

function visualizeTopologicalSort(graphName, container, nodes, edges, svg, arrowId, directed) {
    if (algoGraphs.has(container)) {
        return;
    } else {
        algoGraphs.add(container);
    }

    const originalNodeColors = new Map();

    svg.selectAll("rect.node").each(function (d) {
        originalNodeColors.set(safe(d.id), d3.select(this).attr("fill"));
    });

    // Block user interactions with the graph during visualization
    svg.select('#interaction-blocker').remove();
    svg.append('style')
        .attr('id', 'interaction-blocker')
        .text('rect.node, .link, .link2 { pointer-events: none !important; }');

    const nodeIds = nodes.map(n => safe(n.id !== undefined ? n.id : n));
    const V = nodeIds.length;

    // Calculate In-Degrees and build Adjacency List
    const inDegree = {};
    const adj = {};
    nodeIds.forEach(id => {
        inDegree[id] = 0;
        adj[id] = [];
    });

    edges.forEach(edge => {
        const u = safe(edge.source.id !== undefined ? edge.source.id : edge.source);
        const v = safe(edge.target.id !== undefined ? edge.target.id : edge.target);

        // Only process as directed. Topo sort on undirected graphs isn't valid.
        adj[u].push(v);
        inDegree[v]++;
    });

    const animationSteps = [];
    
    let uState = null;
    let vState = null;
    let inDegreeState = { ...inDegree };
    const queue = [];
    const sortedOrder = [];
    
    const pushStep = (type, line, extras = {}) => {
        animationSteps.push({
            type,
            line,
            u: uState,
            v: vState,
            q: [...queue],
            topoOrder: [...sortedOrder],
            inDegree: { ...inDegreeState },
            ...extras
        });
    };

    pushStep('control', 2); // in_degree = {u: 0 ...}
    pushStep('control', 3); // for u, v in graph.edges:
    pushStep('control', 4); // in_degree[v] += 1
    
    // Find all nodes with 0 in-degree
    nodeIds.forEach(id => {
        if (inDegree[id] === 0) queue.push(id);
    });

    pushStep('control', 5); // q = deque(...)
    pushStep('control', 6); // topo_order = []
    
    animationSteps.push({ type: 'init', line: 6, initialQueue: [...queue], u: null, v: null, q: [...queue], topoOrder: [], inDegree: {...inDegreeState} });

    let processedCount = 0;

    // Process the queue (Kahn's Algorithm)
    while (queue.length > 0) {
        pushStep('control', 7); // while q:
        
        const u = queue.shift();
        uState = u;
        vState = null;
        
        sortedOrder.push(u);
        processedCount++;

        pushStep('control', 8); // u = q.popleft()
        pushStep('control', 9); // topo_order.append(u)
        animationSteps.push({ type: 'process_node', line: 9, u: u, currentOrder: [...sortedOrder], q: [...queue], topoOrder: [...sortedOrder], inDegree: {...inDegreeState}, v: null });

        pushStep('control', 10); // for v in graph.adj[u]:
        adj[u].forEach(v => {
            vState = v;
            animationSteps.push({ type: 'eval_edge', line: 10, u: u, v: v, q: [...queue], topoOrder: [...sortedOrder], inDegree: {...inDegreeState} });

            inDegree[v]--;
            inDegreeState[v] = inDegree[v];
            pushStep('control', 11); // in_degree[v] -= 1
            
            pushStep('control', 12); // if in_degree[v] == 0:
            if (inDegree[v] === 0) {
                queue.push(v);
                pushStep('control', 13); // q.append(v)
                animationSteps.push({ type: 'enqueue', line: 13, v: v, u: u, q: [...queue], topoOrder: [...sortedOrder], inDegree: {...inDegreeState} });
            }
        });
    }

    pushStep('control', 7); // loop condition fails
    pushStep('control', 14); // if len(topo_order) != len(graph.nodes):

    uState = null;
    vState = null;

    // Check for cycles
    if (processedCount !== V) {
        pushStep('control', 15); // print("Cycle detected")
        animationSteps.push({ type: 'cycle_error', line: 15, q: [...queue], topoOrder: [...sortedOrder], inDegree: {...inDegreeState}, u: null, v: null });
    } else {
        pushStep('control', null);
        animationSteps.push({ type: 'complete', line: null, finalOrder: sortedOrder, q: [...queue], topoOrder: [...sortedOrder], inDegree: {...inDegreeState}, u: null, v: null });
    }

    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600;
    let currentStep = 0;
    let playInterval = null;

    const pythonCode = [
        `<span style="color: #c678dd;">def</span> <span style="color: #61afef;">kahn_topo_sort</span>(graph):`,
        `    in_degree = {u: <span style="color: #d19a66;">0</span> <span style="color: #c678dd;">for</span> u <span style="color: #c678dd;">in</span> graph.nodes}`,
        `    <span style="color: #c678dd;">for</span> u, v <span style="color: #c678dd;">in</span> graph.edges:`,
        `        in_degree[v] += <span style="color: #d19a66;">1</span>`,
        `    q = <span style="color: #56b6c2;">deque</span>([u <span style="color: #c678dd;">for</span> u <span style="color: #c678dd;">in</span> graph.nodes <span style="color: #c678dd;">if</span> in_degree[u] == <span style="color: #d19a66;">0</span>])`,
        `    topo_order = []`,
        `    <span style="color: #c678dd;">while</span> q:`,
        `        u = q.<span style="color: #61afef;">popleft</span>()`,
        `        topo_order.<span style="color: #61afef;">append</span>(u)`,
        `        <span style="color: #c678dd;">for</span> v <span style="color: #c678dd;">in</span> graph.adj[u]:`,
        `            in_degree[v] -= <span style="color: #d19a66;">1</span>`,
        `            <span style="color: #c678dd;">if</span> in_degree[v] == <span style="color: #d19a66;">0</span>:`,
        `                q.<span style="color: #61afef;">append</span>(v)`,
        `    <span style="color: #c678dd;">if</span> <span style="color: #56b6c2;">len</span>(topo_order) != <span style="color: #56b6c2;">len</span>(graph.nodes):`,
        `        <span style="color: #61afef;">print</span>(<span style="color: #98c379;">"Cycle detected"</span>)`
    ];

    const formatInDegree = (indeg) => {
        let items = [];
        for (let k in indeg) items.push(`${k}: ${indeg[k]}`);
        return '{' + items.join(', ') + '}';
    };

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        const stepData = targetStep > 0 ? animationSteps[targetStep - 1] : null;

        let logHTML = `<h3 style="color: #ff8a65;">Topological Sort (Kahn's) on <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        const currentLine = stepData ? stepData.line : null;
        const uVar = stepData && stepData.u !== null ? stepData.u : 'None';
        const vVar = stepData && stepData.v !== null ? stepData.v : 'None';
        const qVar = stepData ? '[' + stepData.q.join(', ') + ']' : '[]';
        const topoOrderVar = stepData ? '[' + stepData.topoOrder.join(', ') + ']' : '[]';
        const inDegreeVar = stepData ? formatInDegree(stepData.inDegree) : '{}';

        logHTML += '<div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; text-align: left;">';

        // Python Code Block
        logHTML += `<div style="flex: 2; min-width: 320px; background: #282c34; color: #abb2bf; padding: 12px 12px 12px 0; border-radius: 6px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.6; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #1e2227;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding-left: 12px;">Algorithm Execution</div>';

        pythonCode.forEach((line, index) => {
            const lineNum = index + 1;
            const isHighlighted = lineNum === currentLine;
            const bg = isHighlighted ? '#3b4048' : 'transparent';
            const borderLeft = isHighlighted ? '3px solid #61afef' : '3px solid transparent';
            const lineNumHTML = `<span style="display: inline-block; width: 24px; text-align: right; margin-right: 12px; color: #4b5263; border-right: 1px solid #3b4048; padding-right: 8px; user-select: none;">${lineNum}</span>`;

            logHTML += `<div style="display: flex; padding: 2px 6px 2px 0; border-radius: 2px; white-space: pre; background-color: ${bg}; border-left: ${borderLeft}; transition: all 0.2s; margin-bottom: 2px;">${lineNumHTML}<span>${line}</span></div>`;
        });
        logHTML += '</div>';

        // Variables Block
        logHTML += `<div style="flex: 1; min-width: 180px; background: #282c34; padding: 12px; border-radius: 6px; border: 1px solid #1e2227; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.8; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #abb2bf;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Variables</div>';
        logHTML += `<div><span style="color: #c678dd;">u:</span> <span style="color: #e5c07b; font-weight: bold;">${uVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">v:</span> <span style="color: #e5c07b; font-weight: bold;">${vVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">q:</span> <span style="color: #56b6c2; font-weight: bold; word-break: break-all;">${qVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">topo_order:</span> <span style="color: #98c379; font-weight: bold; word-break: break-all;">${topoOrderVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">in_degree:</span> <span style="color: #abb2bf; font-weight: bold; word-break: break-all;">${inDegreeVar}</span></div>`;
        logHTML += '</div>';

        logHTML += '</div>';

        const completedNodes = new Set();
        let evaluatingNode = null;
        let evaluatingEdge = null;
        let enqueueNode = null;
        let currentTopoOrder = [];

        let textLogHTML = '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #aaa; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Traversal Log</div>';

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'init') {
                textLogHTML += `<div><strong>Initialization:</strong> Nodes with 0 in-degree: [ <span style="color: #a3bf60">${step.initialQueue.join(', ')}</span> ]</div><br>`;
            } else if (step.type === 'process_node') {
                textLogHTML += `<div>Processing node <span style="color: #ff8a65">${step.u}</span>...</div>`;
                if (idx === targetStep - 1) evaluatingNode = safe(step.u);
                completedNodes.add(safe(step.u));
                currentTopoOrder = step.currentOrder;
            } else if (step.type === 'eval_edge') {
                textLogHTML += `<div style="padding-left: 10px;">↳ Removing edge <span style="color: #ff8a65">${step.u} &rarr; ${step.v}</span> (Decrements ${step.v}'s in-degree)</div>`;
                if (idx === targetStep - 1) evaluatingEdge = `${safe(step.u)}-${safe(step.v)}`;
            } else if (step.type === 'enqueue') {
                textLogHTML += `<div style="padding-left: 10px; color: #a3bf60;">↳ Node ${step.v} now has 0 in-degree. Added to queue!</div>`;
                if (idx === targetStep - 1) enqueueNode = safe(step.v);
            } else if (step.type === 'cycle_error') {
                textLogHTML += `<br><div style="color: #e74c3c; font-weight: bold;">Error: Cycle detected! A valid topological ordering is impossible.</div>`;
            } else if (step.type === 'complete') {
                textLogHTML += `<br><div style="color: #ff8a65; font-weight: bold;">Sort Complete!</div>`;
            }
        }

        // Always show the running topological order at the bottom
        if (targetStep > 0 && currentTopoOrder.length > 0) {
            textLogHTML += `<div style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-left: 3px solid #ff8a65;">
                <strong>Current Order:</strong> <span style="color: #a3bf60">[ ${currentTopoOrder.join(' &rarr; ')} ]</span>
            </div>`;
        }

        logHTML += textLogHTML;
        if (typeof resultLog !== 'undefined') {
            resultLog.innerHTML = logHTML;
            resultLog.scrollTop = resultLog.scrollHeight;
        }

        // Apply Node Colors
        svg.selectAll('rect.node').each(function (d) {
            const el = d3.select(this);
            const nodeId = safe(d.id);
            const isCompleted = completedNodes.has(nodeId);
            const isEvaluating = evaluatingNode === nodeId;
            const isEnqueueing = enqueueNode === nodeId;

            let targetColor = originalNodeColors.get(nodeId);
            if (isEvaluating) targetColor = edgeEvalColor;
            else if (isEnqueueing) targetColor = '#a3bf60';
            else if (isCompleted) targetColor = nodeVisitColor;

            if (animate && (isEvaluating || isEnqueueing || (isCompleted && targetStep > 0 && animationSteps[targetStep - 1].type === 'process_node'))) {
                el.transition().duration(300).attr('fill', targetColor);
            } else {
                el.interrupt().attr('fill', targetColor);
            }
        });

        // Apply Edge Colors
        svg.selectAll('.link').each(function () {
            const el = d3.select(this);
            const sId = safe(el.attr('source-id').replace(arrowId, ''));
            const tId = safe(el.attr('target-id').replace(arrowId, ''));
            const edgeKey = `${sId}-${tId}`;

            const isEval = evaluatingEdge === edgeKey;

            // Fade out edges that belong to completed nodes to visually represent "removing" them
            const isRemoved = completedNodes.has(sId) && !isEval;

            let targetColor = isRemoved ? 'rgba(255,255,255,0.1)' : edgeColor;

            if (isEval) {
                targetColor = edgeEvalColor;
            }

            if (animate) {
                el.transition().duration(200).attr('stroke', targetColor);
            } else {
                el.interrupt().attr('stroke', targetColor);
            }

            // Arrowheads
            if (directed) {
                const uniqueMarkerId = safe(`${arrowId}-${sId}-${tId}`);
                const markerPath = svg.select(`#${uniqueMarkerId} path`);
                if (!markerPath.empty()) {
                    if (animate) {
                        markerPath.transition().duration(200).attr('fill', targetColor);
                    } else {
                        markerPath.interrupt().attr('fill', targetColor);
                    }
                }
            }
        });
    };

    const startLoop = () => {
        if (currentStep >= totalSteps) {
            currentStep = 0;
            playback.updateTimeline(0);
        }
        if (currentStep === 0) renderGraphState(0, false);

        playInterval = setInterval(() => {
            if (currentStep < totalSteps) {
                currentStep++;
                playback.updateTimeline(currentStep);
                renderGraphState(currentStep, true);
            } else {
                stopLoop();
                playback.togglePlayState(false);
            }
        }, BASE_DELAY / playback.speed);
    };

    const stopLoop = () => {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    };

    const playback = new GraphPlaybackController(svg, totalSteps, container, {
        onPlay: startLoop,
        onPause: stopLoop,
        onSeek: (step) => {
            currentStep = step;
            renderGraphState(currentStep, false);
        },
        onSpeedChange: () => {
            if (playInterval) { stopLoop(); startLoop(); }
        },
        onEnd: () => {
            stopLoop(); renderGraphState(0, false);
        }
    });

    startLoop();
    renderGraphState(0, false);
}

function visualizeSCCKosaraju(graphName, container, nodes, edges, svg, arrowId, directed) {
    if (algoGraphs.has(container)) {
        return;
    } else {
        algoGraphs.add(container);
    }

    const originalNodeColors = new Map();

    svg.selectAll("rect.node").each(function (d) {
        originalNodeColors.set(safe(d.id), d3.select(this).attr("fill"));
    });

    // Block user interactions with the graph during visualization
    svg.select('#interaction-blocker').remove();
    svg.append('style')
        .attr('id', 'interaction-blocker')
        .text('rect.node, .link, .link2 { pointer-events: none !important; }');

    const nodeIds = nodes.map(n => safe(n.id !== undefined ? n.id : n));

    // Build standard AND transposed adjacency lists
    const adj = {};
    const revAdj = {};
    nodeIds.forEach(id => {
        adj[id] = [];
        revAdj[id] = [];
    });

    edges.forEach(edge => {
        const u = safe(edge.source.id !== undefined ? edge.source.id : edge.source);
        const v = safe(edge.target.id !== undefined ? edge.target.id : edge.target);
        adj[u].push(v);
        revAdj[v].push(u); // Transposed edge for Phase 2
    });

    const animationSteps = [];
    
    let visitedState = new Set();
    let stackState = [];
    let sccsState = [];
    let phase = 1;
    let uState = null;
    let vState = null;
    
    const pushStep = (type, line, extras = {}) => {
        animationSteps.push({
            type,
            line,
            u: uState,
            v: vState,
            phase: phase,
            visited: Array.from(visitedState),
            stack: [...stackState],
            sccs: JSON.parse(JSON.stringify(sccsState)),
            ...extras
        });
    };

    pushStep('control', 2); // visited = set()
    pushStep('control', 3); // stack = []
    
    // Phase 1: DFS on original graph to determine finish times
    function dfs1(at) {
        let prevU = uState;
        let prevV = vState;
        uState = at;
        vState = null;
        
        visitedState.add(at);
        pushStep('control', 5); // visited.add(u)
        animationSteps.push({ type: 'p1_visit', line: 5, u: at, v: null, phase: 1, visited: Array.from(visitedState), stack: [...stackState], sccs: JSON.parse(JSON.stringify(sccsState)) });

        pushStep('control', 6); // for v in graph.adj[u]:
        for (const to of adj[at]) {
            vState = to;
            animationSteps.push({ type: 'p1_eval', line: 6, u: at, v: to, phase: 1, visited: Array.from(visitedState), stack: [...stackState], sccs: JSON.parse(JSON.stringify(sccsState)) });

            pushStep('control', 7); // if v not in visited:
            if (!visitedState.has(to)) {
                pushStep('control', 8); // dfs1(v)
                dfs1(to);
                uState = at; // Restore u after child DFS returns
                pushStep('control', 6); // Back to loop
            }
        }
        
        vState = null;
        stackState.push(at);
        pushStep('control', 9); // stack.append(u)
        animationSteps.push({ type: 'p1_finish', line: 9, u: at, v: null, phase: 1, visited: Array.from(visitedState), stack: [...stackState], sccs: JSON.parse(JSON.stringify(sccsState)) });
        
        uState = prevU;
        vState = prevV;
    }

    pushStep('control', 10); // for node in graph.nodes:
    for (const node of nodeIds) {
        pushStep('control', 11); // if node not in visited:
        if (!visitedState.has(node)) {
            pushStep('control', 12); // dfs1(node)
            dfs1(node);
            pushStep('control', 10); // Back to loop
        }
    }

    visitedState.clear();
    pushStep('control', 13); // visited.clear()
    
    pushStep('control', 14); // sccs = []

    // Record the transition phase between DFS passes
    phase = 2;
    animationSteps.push({ type: 'transpose', line: 14, finalStack: [...stackState], u: null, v: null, phase: 2, visited: Array.from(visitedState), stack: [...stackState], sccs: JSON.parse(JSON.stringify(sccsState)) });

    function dfs2(at, currentScc) {
        let prevU = uState;
        let prevV = vState;
        uState = at;
        vState = null;
        
        visitedState.add(at);
        currentScc.push(at);
        
        pushStep('control', 16); // visited.add(u)
        pushStep('control', 17); // current_scc.append(u)
        
        animationSteps.push({ type: 'p2_visit', line: 17, u: at, v: null, phase: 2, visited: Array.from(visitedState), stack: [...stackState], sccs: JSON.parse(JSON.stringify(sccsState)) });

        pushStep('control', 18); // for v in graph.rev_adj[u]:
        for (const to of revAdj[at]) {
            vState = to;
            animationSteps.push({ type: 'p2_eval', line: 18, u: at, v: to, phase: 2, visited: Array.from(visitedState), stack: [...stackState], sccs: JSON.parse(JSON.stringify(sccsState)) });
            
            pushStep('control', 19); // if v not in visited:
            if (!visitedState.has(to)) {
                pushStep('control', 20); // dfs2(v, current_scc)
                dfs2(to, currentScc);
                uState = at; // Restore u
                pushStep('control', 18); // Back to loop
            }
        }
        
        uState = prevU;
        vState = prevV;
    }

    let sccCount = 0;

    pushStep('control', 21); // while stack:
    while (stackState.length > 0) {
        const node = stackState.pop();
        uState = node;
        vState = null;
        pushStep('control', 22); // u = stack.pop()
        
        pushStep('control', 23); // if u not in visited:
        if (!visitedState.has(node)) {
            const sccNodes = [];
            pushStep('control', 24); // scc = []
            pushStep('control', 25); // dfs2(u, scc)
            dfs2(node, sccNodes);

            sccsState.push(sccNodes);
            pushStep('control', 26); // sccs.append(scc)
            
            animationSteps.push({
                type: 'scc_found',
                line: 26,
                root: node,
                nodes: sccNodes,
                sccIndex: sccCount,
                u: node,
                v: null,
                phase: 2,
                visited: Array.from(visitedState),
                stack: [...stackState],
                sccs: JSON.parse(JSON.stringify(sccsState))
            });
            sccCount++;
        }
        pushStep('control', 21); // back to while
    }
    
    uState = null;
    vState = null;
    pushStep('control', 27); // return sccs

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600;
    let currentStep = 0;
    let playInterval = null;

    const pythonCode = [
        `<span style="color: #c678dd;">def</span> <span style="color: #61afef;">kosaraju</span>(graph):`,
        `    visited = <span style="color: #56b6c2;">set</span>()`,
        `    stack = []`,
        `    <span style="color: #c678dd;">def</span> <span style="color: #61afef;">dfs1</span>(u):`,
        `        visited.<span style="color: #61afef;">add</span>(u)`,
        `        <span style="color: #c678dd;">for</span> v <span style="color: #c678dd;">in</span> graph.adj[u]:`,
        `            <span style="color: #c678dd;">if</span> v <span style="color: #c678dd;">not in</span> visited:`,
        `                <span style="color: #61afef;">dfs1</span>(v)`,
        `        stack.<span style="color: #61afef;">append</span>(u)`,
        `    <span style="color: #c678dd;">for</span> node <span style="color: #c678dd;">in</span> graph.nodes:`,
        `        <span style="color: #c678dd;">if</span> node <span style="color: #c678dd;">not in</span> visited:`,
        `            <span style="color: #61afef;">dfs1</span>(node)`,
        `    visited.<span style="color: #61afef;">clear</span>()`,
        `    sccs = []`,
        `    <span style="color: #c678dd;">def</span> <span style="color: #61afef;">dfs2</span>(u, current_scc):`,
        `        visited.<span style="color: #61afef;">add</span>(u)`,
        `        current_scc.<span style="color: #61afef;">append</span>(u)`,
        `        <span style="color: #c678dd;">for</span> v <span style="color: #c678dd;">in</span> graph.rev_adj[u]:`,
        `            <span style="color: #c678dd;">if</span> v <span style="color: #c678dd;">not in</span> visited:`,
        `                <span style="color: #61afef;">dfs2</span>(v, current_scc)`,
        `    <span style="color: #c678dd;">while</span> stack:`,
        `        u = stack.<span style="color: #61afef;">pop</span>()`,
        `        <span style="color: #c678dd;">if</span> u <span style="color: #c678dd;">not in</span> visited:`,
        `            scc = []`,
        `            <span style="color: #61afef;">dfs2</span>(u, scc)`,
        `            sccs.<span style="color: #61afef;">append</span>(scc)`,
        `    <span style="color: #c678dd;">return</span> sccs`
    ];

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        const stepData = targetStep > 0 ? animationSteps[targetStep - 1] : null;

        let logHTML = `<h3 style="color: #ff8a65;">Kosaraju's SCC on <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        const currentLine = stepData ? stepData.line : null;
        const uVar = stepData && stepData.u !== null ? stepData.u : 'None';
        const vVar = stepData && stepData.v !== null ? stepData.v : 'None';
        const phaseVar = stepData ? (stepData.phase === 1 ? 'DFS 1 (Original)' : 'DFS 2 (Transposed)') : 'DFS 1 (Original)';
        const visitedVar = stepData ? '{' + stepData.visited.join(', ') + '}' : '{}';
        const stackVar = stepData ? '[' + stepData.stack.join(', ') + ']' : '[]';
        
        let sccsStr = '[]';
        if (stepData && stepData.sccs.length > 0) {
            sccsStr = '[' + stepData.sccs.map(scc => '[' + scc.join(', ') + ']').join(', ') + ']';
        }

        logHTML += '<div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; text-align: left;">';

        // Python Code Block
        logHTML += `<div style="flex: 2; min-width: 320px; background: #282c34; color: #abb2bf; padding: 12px 12px 12px 0; border-radius: 6px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.6; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #1e2227;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding-left: 12px;">Algorithm Execution</div>';

        pythonCode.forEach((line, index) => {
            const lineNum = index + 1;
            const isHighlighted = lineNum === currentLine;
            const bg = isHighlighted ? '#3b4048' : 'transparent';
            const borderLeft = isHighlighted ? '3px solid #61afef' : '3px solid transparent';
            const lineNumHTML = `<span style="display: inline-block; width: 24px; text-align: right; margin-right: 12px; color: #4b5263; border-right: 1px solid #3b4048; padding-right: 8px; user-select: none;">${lineNum}</span>`;

            logHTML += `<div style="display: flex; padding: 2px 6px 2px 0; border-radius: 2px; white-space: pre; background-color: ${bg}; border-left: ${borderLeft}; transition: all 0.2s; margin-bottom: 2px;">${lineNumHTML}<span>${line}</span></div>`;
        });
        logHTML += '</div>';

        // Variables Block
        logHTML += `<div style="flex: 1; min-width: 180px; background: #282c34; padding: 12px; border-radius: 6px; border: 1px solid #1e2227; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.8; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #abb2bf;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Variables</div>';
        logHTML += `<div><span style="color: #c678dd;">Phase:</span> <span style="color: #c678dd; font-weight: bold;">${phaseVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">u:</span> <span style="color: #e5c07b; font-weight: bold;">${uVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">v:</span> <span style="color: #e5c07b; font-weight: bold;">${vVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">stack:</span> <span style="color: #56b6c2; font-weight: bold; word-break: break-all;">${stackVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">visited:</span> <span style="color: #56b6c2; font-weight: bold; word-break: break-all;">${visitedVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">sccs:</span> <span style="color: #98c379; font-weight: bold; word-break: break-all;">${sccsStr}</span></div>`;
        logHTML += '</div>';

        logHTML += '</div>';

        let currentPhase = 1;
        let finishedNodesP1 = new Set();
        let resolvedSCCs = {};
        let evaluatingEdge = null;
        let activeNode = null;

        let textLogHTML = '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #aaa; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Traversal Log</div>';

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'p1_visit') {
                textLogHTML += `<div>Phase 1: Discovered node <span style="color: #ff8a65">${step.u}</span>.</div>`;
                if (idx === targetStep - 1) activeNode = safe(step.u);
            } else if (step.type === 'p1_eval') {
                textLogHTML += `<div style="padding-left: 10px;">Evaluating edge <span style="color: #a3bf60">${step.u} &rarr; ${step.v}</span>...</div>`;
                if (idx === targetStep - 1) {
                    evaluatingEdge = `${safe(step.u)}-${safe(step.v)}`;
                    activeNode = safe(step.u);
                }
            } else if (step.type === 'p1_finish') {
                textLogHTML += `<div style="padding-left: 10px; color: #a3bf60;">↳ Finished ${step.u}. Added to stack.</div><br>`;
                finishedNodesP1.add(safe(step.u));
            } else if (step.type === 'transpose') {
                textLogHTML += `<div style="margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.05); border-left: 3px solid #fff;">
                    <strong>Phase 2: Graph Transposed!</strong><br>
                    Processing stack: [ <span style="color: #a3bf60">${step.finalStack.slice().reverse().join(', ')}</span> ]
                </div><br>`;
                currentPhase = 2;
            } else if (step.type === 'p2_visit') {
                textLogHTML += `<div>Phase 2: Visiting node <span style="color: #ff8a65">${step.u}</span>...</div>`;
                if (idx === targetStep - 1) activeNode = safe(step.u);
            } else if (step.type === 'p2_eval') {
                textLogHTML += `<div style="padding-left: 10px;">Evaluating reverse edge <span style="color: #a3bf60">${step.u} &rarr; ${step.v}</span> (Original: ${step.v} &rarr; ${step.u})...</div>`;
                // To map the transposed traversal visually to the DOM edge, we swap u and v
                if (idx === targetStep - 1) {
                    evaluatingEdge = `${safe(step.v)}-${safe(step.u)}`;
                    activeNode = safe(step.u);
                }
            } else if (step.type === 'scc_found') {
                const color = disColors[step.sccIndex % disColors.length];
                textLogHTML += `<div style="margin-top: 10px; padding: 5px; background: rgba(0,0,0,0.2); border-left: 3px solid ${color};">
                    <strong>SCC Found!</strong> Root: ${step.root}. Nodes: [ <span style="color: #a3bf60">${step.nodes.join(', ')}</span> ]
                </div><br>`;

                step.nodes.forEach(n => resolvedSCCs[safe(n)] = color);
            }
        }

        logHTML += textLogHTML;

        if (typeof resultLog !== 'undefined') {
            resultLog.innerHTML = logHTML;
            resultLog.scrollTop = resultLog.scrollHeight;
        }

        // Apply Node Colors
        svg.selectAll('rect.node').each(function (d) {
            const el = d3.select(this);
            const nodeId = safe(d.id);
            const isResolved = nodeId in resolvedSCCs;
            const isActive = activeNode === nodeId;
            const isFinishedP1 = currentPhase === 1 && finishedNodesP1.has(nodeId);

            let targetColor = originalNodeColors.get(nodeId);

            if (isResolved) {
                // Resolved SCC node
                targetColor = resolvedSCCs[nodeId];
            } else if (isActive) {
                // Active node in either phase
                targetColor = '#ff8a65';
            } else if (isFinishedP1) {
                // Nodes that finished their DFS in phase 1 get a subtle distinct color
                targetColor = '#a3bf60';
            }

            if (animate) {
                el.transition().duration(300).attr('fill', targetColor);
            } else {
                el.interrupt().attr('fill', targetColor);
            }
        });

        // Apply Edge Colors
        svg.selectAll('.link').each(function () {
            const el = d3.select(this);
            const sId = safe(el.attr('source-id').replace(arrowId, ''));
            const tId = safe(el.attr('target-id').replace(arrowId, ''));
            const edgeKey = `${sId}-${tId}`;

            const isEval = evaluatingEdge === edgeKey;

            let targetColor = edgeColor;

            if (isEval) {
                targetColor = edgeEvalColor;
            } else if (sId in resolvedSCCs && tId in resolvedSCCs && resolvedSCCs[sId] === resolvedSCCs[tId]) {
                targetColor = resolvedSCCs[sId];
            } else if (sId in resolvedSCCs || tId in resolvedSCCs) {
                // Cross-edges fade out
                targetColor = 'rgba(255,255,255,0.2)';
            }

            if (animate) {
                el.transition().duration(200).attr('stroke', targetColor);
            } else {
                el.interrupt().attr('stroke', targetColor);
            }

            if (directed) {
                const uniqueMarkerId = safe(`${arrowId}-${sId}-${tId}`);
                const markerPath = svg.select(`#${uniqueMarkerId} path`);
                if (!markerPath.empty()) {
                    if (animate) {
                        markerPath.transition().duration(200).attr('fill', targetColor);
                    } else {
                        markerPath.interrupt().attr('fill', targetColor);
                    }
                }
            }
        });
    };

    const startLoop = () => {
        if (currentStep >= totalSteps) {
            currentStep = 0;
            playback.updateTimeline(0);
        }
        if (currentStep === 0) renderGraphState(0, false);

        playInterval = setInterval(() => {
            if (currentStep < totalSteps) {
                currentStep++;
                playback.updateTimeline(currentStep);
                renderGraphState(currentStep, true);
            } else {
                stopLoop();
                playback.togglePlayState(false);
            }
        }, BASE_DELAY / playback.speed);
    };

    const stopLoop = () => {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    };

    const playback = new GraphPlaybackController(svg, totalSteps, container, {
        onPlay: startLoop,
        onPause: stopLoop,
        onSeek: (step) => {
            currentStep = step;
            renderGraphState(currentStep, false);
        },
        onSpeedChange: () => {
            if (playInterval) { stopLoop(); startLoop(); }
        },
        onEnd: () => {
            stopLoop(); renderGraphState(0, false);
        }
    });

    startLoop();
    renderGraphState(0, false);
}

function visualizeSCCTarjan(graphName, container, nodes, edges, svg, arrowId, directed) {
    if (algoGraphs.has(container)) {
        return;
    } else {
        algoGraphs.add(container);
    }

    const originalNodeColors = new Map();

    svg.selectAll("rect.node").each(function (d) {
        originalNodeColors.set(safe(d.id), d3.select(this).attr("fill"));
    });

    // Block user interactions with the graph during visualization
    svg.select('#interaction-blocker').remove();
    svg.append('style')
        .attr('id', 'interaction-blocker')
        .text('rect.node, .link, .link2 { pointer-events: none !important; }');

    const nodeIds = nodes.map(n => safe(n.id !== undefined ? n.id : n));
    const V = nodeIds.length;

    // Build directed adjacency list
    const adj = {};
    nodeIds.forEach(id => adj[id] = []);
    edges.forEach(edge => {
        const u = safe(edge.source.id !== undefined ? edge.source.id : edge.source);
        const v = safe(edge.target.id !== undefined ? edge.target.id : edge.target);
        adj[u].push(v);
        // SCC is strictly for directed graphs
    });

    // Tarjan's Algorithm State
    let idCounter = 0;
    const ids = {};
    const low = {};
    const onStack = new Set();
    const stack = [];
    const sccsState = [];
    let uState = null;
    let vState = null;

    nodeIds.forEach(id => { ids[id] = -1; low[id] = -1; }); // -1 signifies unvisited

    const animationSteps = [];
    let sccCount = 0;

    const pushStep = (type, line, extras = {}) => {
        animationSteps.push({
            type,
            line,
            u: uState,
            v: vState,
            stack: [...stack],
            onStack: Array.from(onStack),
            ids: { ...ids },
            low: { ...low },
            idCounter,
            sccs: JSON.parse(JSON.stringify(sccsState)),
            ...extras
        });
    };

    pushStep('control', 2); // ids = ...
    pushStep('control', 3); // low = ...
    pushStep('control', 4); // on_stack = set()
    pushStep('control', 5); // stack = []
    pushStep('control', 6); // id_counter = 0
    pushStep('control', 7); // sccs = []

    // DFS for Tarjan's
    function dfs(at) {
        let prevU = uState;
        let prevV = vState;
        uState = at;
        vState = null;

        stack.push(at);
        onStack.add(at);
        ids[at] = idCounter;
        low[at] = idCounter;
        idCounter++;

        pushStep('control', 11); // ids[u] = low[u] = id_counter
        pushStep('control', 12); // id_counter += 1
        pushStep('control', 13); // stack.append(u)
        pushStep('control', 14); // on_stack.add(u)

        animationSteps.push({ type: 'visit', line: 14, u: at, v: null, stack: [...stack], onStack: Array.from(onStack), ids: { ...ids }, low: { ...low }, idCounter, sccs: JSON.parse(JSON.stringify(sccsState)) });

        pushStep('control', 16); // for v in graph.adj[u]:
        for (const to of adj[at]) {
            vState = to;
            animationSteps.push({ type: 'eval_edge', line: 16, u: at, v: to, stack: [...stack], onStack: Array.from(onStack), ids: { ...ids }, low: { ...low }, idCounter, sccs: JSON.parse(JSON.stringify(sccsState)) });

            pushStep('control', 17); // if ids[v] == -1:
            if (ids[to] === -1) {
                // Unvisited neighbor
                pushStep('control', 18); // dfs(v)
                dfs(to);
                uState = at;
                
                low[at] = Math.min(low[at], low[to]);
                pushStep('control', 19); // low[u] = min(low[u], low[v])
                animationSteps.push({ type: 'update_low', line: 19, u: at, v: to, newLow: low[at], stack: [...stack], onStack: Array.from(onStack), ids: { ...ids }, low: { ...low }, idCounter, sccs: JSON.parse(JSON.stringify(sccsState)) });
            } else {
                pushStep('control', 20); // elif v in on_stack:
                if (onStack.has(to)) {
                    // Back-edge found
                    low[at] = Math.min(low[at], ids[to]);
                    pushStep('control', 21); // low[u] = min(low[u], ids[v])
                    animationSteps.push({ type: 'update_low_back', line: 21, u: at, v: to, newLow: low[at], stack: [...stack], onStack: Array.from(onStack), ids: { ...ids }, low: { ...low }, idCounter, sccs: JSON.parse(JSON.stringify(sccsState)) });
                }
            }
            pushStep('control', 16);
        }
        
        vState = null;

        // Check if we are at the root of an SCC
        pushStep('control', 23); // if ids[u] == low[u]:
        if (ids[at] === low[at]) {
            const sccNodes = [];
            let node;
            pushStep('control', 24); // scc = []
            
            do {
                pushStep('control', 25); // while True:
                node = stack.pop();
                pushStep('control', 26); // node = stack.pop()
                onStack.delete(node);
                pushStep('control', 27); // on_stack.remove(node)
                sccNodes.push(node);
                pushStep('control', 28); // scc.append(node)
                pushStep('control', 29); // if node == u: break
            } while (node !== at);

            sccsState.push(sccNodes);
            pushStep('control', 31); // sccs.append(scc)

            animationSteps.push({
                type: 'scc_found',
                line: 31,
                root: at,
                nodes: sccNodes,
                sccIndex: sccCount,
                u: at,
                v: null,
                stack: [...stack],
                onStack: Array.from(onStack),
                ids: { ...ids },
                low: { ...low },
                idCounter,
                sccs: JSON.parse(JSON.stringify(sccsState))
            });
            sccCount++;
        }
        
        uState = prevU;
        vState = prevV;
    }

    pushStep('control', 33); // for node in graph.nodes:
    // Run Tarjan's on all unvisited nodes
    for (const node of nodeIds) {
        pushStep('control', 34); // if ids[node] == -1:
        if (ids[node] === -1) {
            pushStep('control', 35); // dfs(node)
            dfs(node);
            pushStep('control', 33); // Back to loop
        }
    }
    
    uState = null;
    vState = null;
    pushStep('control', 37); // return sccs

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600;
    let currentStep = 0;
    let playInterval = null;

    const pythonCode = [
        `<span style="color: #c678dd;">def</span> <span style="color: #61afef;">tarjan</span>(graph):`,
        `    ids = {u: -<span style="color: #d19a66;">1</span> <span style="color: #c678dd;">for</span> u <span style="color: #c678dd;">in</span> graph.nodes}`,
        `    low = {u: -<span style="color: #d19a66;">1</span> <span style="color: #c678dd;">for</span> u <span style="color: #c678dd;">in</span> graph.nodes}`,
        `    on_stack = <span style="color: #56b6c2;">set</span>()`,
        `    stack = []`,
        `    id_counter = <span style="color: #d19a66;">0</span>`,
        `    sccs = []`,
        `    <span style="color: #c678dd;">def</span> <span style="color: #61afef;">dfs</span>(u):`,
        `        <span style="color: #c678dd;">nonlocal</span> id_counter`,
        `        ids[u] = low[u] = id_counter`,
        `        id_counter += <span style="color: #d19a66;">1</span>`,
        `        stack.<span style="color: #61afef;">append</span>(u)`,
        `        on_stack.<span style="color: #61afef;">add</span>(u)`,
        `        <span style="color: #c678dd;">for</span> v <span style="color: #c678dd;">in</span> graph.adj[u]:`,
        `            <span style="color: #c678dd;">if</span> ids[v] == -<span style="color: #d19a66;">1</span>:`,
        `                <span style="color: #61afef;">dfs</span>(v)`,
        `                low[u] = <span style="color: #56b6c2;">min</span>(low[u], low[v])`,
        `            <span style="color: #c678dd;">elif</span> v <span style="color: #c678dd;">in</span> on_stack:`,
        `                low[u] = <span style="color: #56b6c2;">min</span>(low[u], ids[v])`,
        `        <span style="color: #c678dd;">if</span> ids[u] == low[u]:`,
        `            scc = []`,
        `            <span style="color: #c678dd;">while True</span>:`,
        `                node = stack.<span style="color: #61afef;">pop</span>()`,
        `                on_stack.<span style="color: #61afef;">remove</span>(node)`,
        `                scc.<span style="color: #61afef;">append</span>(node)`,
        `                <span style="color: #c678dd;">if</span> node == u: <span style="color: #c678dd;">break</span>`,
        `            sccs.<span style="color: #61afef;">append</span>(scc)`,
        `    <span style="color: #c678dd;">for</span> node <span style="color: #c678dd;">in</span> graph.nodes:`,
        `        <span style="color: #c678dd;">if</span> ids[node] == -<span style="color: #d19a66;">1</span>:`,
        `            <span style="color: #61afef;">dfs</span>(node)`,
        `    <span style="color: #c678dd;">return</span> sccs`
    ];

    const formatDict = (dict) => {
        let items = [];
        for (let k in dict) {
            if (dict[k] !== -1) items.push(`${k}: ${dict[k]}`);
        }
        return '{' + items.join(', ') + '}';
    };

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        const stepData = targetStep > 0 ? animationSteps[targetStep - 1] : null;

        let logHTML = `<h3 style="color: #ff8a65;">Tarjan's SCC on <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        const currentLine = stepData ? stepData.line : null;
        const uVar = stepData && stepData.u !== null ? stepData.u : 'None';
        const vVar = stepData && stepData.v !== null ? stepData.v : 'None';
        const stackVar = stepData ? '[' + stepData.stack.join(', ') + ']' : '[]';
        const onStackVar = stepData ? '{' + stepData.onStack.join(', ') + '}' : '{}';
        const idCounterVar = stepData ? stepData.idCounter : '0';
        const idsVar = stepData ? formatDict(stepData.ids) : '{}';
        const lowVar = stepData ? formatDict(stepData.low) : '{}';

        let sccsStr = '[]';
        if (stepData && stepData.sccs.length > 0) {
            sccsStr = '[' + stepData.sccs.map(scc => '[' + scc.join(', ') + ']').join(', ') + ']';
        }

        logHTML += '<div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; text-align: left;">';

        // Python Code Block
        logHTML += `<div style="flex: 2; min-width: 320px; background: #282c34; color: #abb2bf; padding: 12px 12px 12px 0; border-radius: 6px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.6; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #1e2227;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding-left: 12px;">Algorithm Execution</div>';

        pythonCode.forEach((line, index) => {
            const lineNum = index + 1;
            // 20 is the start of the while loop which encompasses two lines in original representation
            // We map lines carefully based on our trace pushes.
            let displayLine = lineNum;
            if (lineNum >= 22) displayLine = lineNum + 1; // offset because of while true node=stack.pop
            if (lineNum === 26) displayLine = 29;

            const isHighlighted = lineNum === currentLine;
            const bg = isHighlighted ? '#3b4048' : 'transparent';
            const borderLeft = isHighlighted ? '3px solid #61afef' : '3px solid transparent';
            const lineNumHTML = `<span style="display: inline-block; width: 24px; text-align: right; margin-right: 12px; color: #4b5263; border-right: 1px solid #3b4048; padding-right: 8px; user-select: none;">${lineNum}</span>`;

            logHTML += `<div style="display: flex; padding: 2px 6px 2px 0; border-radius: 2px; white-space: pre; background-color: ${bg}; border-left: ${borderLeft}; transition: all 0.2s; margin-bottom: 2px;">${lineNumHTML}<span>${line}</span></div>`;
        });
        logHTML += '</div>';

        // Variables Block
        logHTML += `<div style="flex: 1; min-width: 180px; background: #282c34; padding: 12px; border-radius: 6px; border: 1px solid #1e2227; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.8; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #abb2bf;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Variables</div>';
        logHTML += `<div><span style="color: #c678dd;">u:</span> <span style="color: #e5c07b; font-weight: bold;">${uVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">v:</span> <span style="color: #e5c07b; font-weight: bold;">${vVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">id_counter:</span> <span style="color: #d19a66; font-weight: bold;">${idCounterVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">stack:</span> <span style="color: #56b6c2; font-weight: bold; word-break: break-all;">${stackVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">on_stack:</span> <span style="color: #56b6c2; font-weight: bold; word-break: break-all;">${onStackVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">ids:</span> <span style="color: #abb2bf; font-weight: bold; word-break: break-all;">${idsVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">low:</span> <span style="color: #abb2bf; font-weight: bold; word-break: break-all;">${lowVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">sccs:</span> <span style="color: #98c379; font-weight: bold; word-break: break-all;">${sccsStr}</span></div>`;
        logHTML += '</div>';

        logHTML += '</div>';

        let currentStack = new Set();
        let resolvedSCCs = {}; // nodeId -> color
        let evaluatingEdge = null;
        let activeNode = null;
        
        let textLogHTML = '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #aaa; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Traversal Log</div>';

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'visit') {
                textLogHTML += `<div>Discovered node <span style="color: #ff8a65">${step.u}</span> [id: ${step.ids[safe(step.u)]}, low: ${step.low[safe(step.u)]}]. Added to Stack.</div>`;
                currentStack = new Set(step.stack.map(safe));
                if (idx === targetStep - 1) activeNode = safe(step.u);
            } else if (step.type === 'eval_edge') {
                textLogHTML += `<div style="padding-left: 10px;">Evaluating edge <span style="color: #a3bf60">${step.u} &rarr; ${step.v}</span>...</div>`;
                if (idx === targetStep - 1) {
                    evaluatingEdge = `${safe(step.u)}-${safe(step.v)}`;
                    activeNode = safe(step.u);
                }
            } else if (step.type === 'update_low') {
                textLogHTML += `<div style="padding-left: 10px; color: #ff8a65;">↳ Returned from ${step.v}. Updated ${step.u}'s low-link to ${step.newLow}.</div><br>`;
                if (idx === targetStep - 1) activeNode = safe(step.u);
            } else if (step.type === 'update_low_back') {
                textLogHTML += `<div style="padding-left: 10px; color: #ff8a65;">↳ Back-edge to stack node ${step.v}! Updated ${step.u}'s low-link to ${step.newLow}.</div><br>`;
                if (idx === targetStep - 1) activeNode = safe(step.u);
            } else if (step.type === 'scc_found') {
                textLogHTML += `<div style="margin-top: 10px; padding: 5px; background: rgba(0,0,0,0.2); border-left: 3px solid ${disColors[step.sccIndex % disColors.length]};">
                    <strong>SCC Found!</strong> Root: ${step.root}. Nodes popped: [ <span style="color: #a3bf60">${step.nodes.join(', ')}</span> ]
                </div><br>`;
                currentStack = new Set(step.stack.map(safe));

                // Assign color to all nodes in this SCC
                const color = disColors[step.sccIndex % disColors.length];
                step.nodes.forEach(n => resolvedSCCs[safe(n)] = color);
            }
        }

        logHTML += textLogHTML;

        if (typeof resultLog !== 'undefined') {
            resultLog.innerHTML = logHTML;
            resultLog.scrollTop = resultLog.scrollHeight;
        }

        // Apply Node Colors
        svg.selectAll('rect.node').each(function (d) {
            const el = d3.select(this);
            const nodeId = safe(d.id);
            const isResolved = nodeId in resolvedSCCs;
            const isOnStack = currentStack.has(nodeId);
            const isActive = activeNode === nodeId;

            let targetColor = originalNodeColors.get(nodeId);

            if (isResolved) {
                // Node belongs to a completed SCC
                targetColor = resolvedSCCs[nodeId];
            } else if (isOnStack) {
                // Node is on the recursion stack (visiting phase)
                targetColor = '#ff8a65';
            }

            if (animate) {
                const trans = el.transition().duration(300).attr('fill', targetColor);
            } else {
                el.interrupt().attr('fill', targetColor);
            }
        });

        // Apply Edge Colors
        svg.selectAll('.link').each(function () {
            const el = d3.select(this);
            const sId = safe(el.attr('source-id').replace(arrowId, ''));
            const tId = safe(el.attr('target-id').replace(arrowId, ''));
            const edgeKey = `${sId}-${tId}`;

            const isEval = evaluatingEdge === edgeKey;

            let targetColor = edgeColor;

            if (isEval) {
                targetColor = edgeEvalColor;
            } else if (sId in resolvedSCCs && tId in resolvedSCCs && resolvedSCCs[sId] === resolvedSCCs[tId]) {
                // Both nodes in the same SCC: color the internal edge to match
                targetColor = resolvedSCCs[sId];
            } else if (sId in resolvedSCCs || tId in resolvedSCCs) {
                // Cross-edges between different SCCs or between resolved/unresolved fade out slightly
                targetColor = 'rgba(255,255,255,0.2)';
            }

            if (animate) {
                el.transition().duration(200).attr('stroke', targetColor);
            } else {
                el.interrupt().attr('stroke', targetColor);
            }

            // Update associated arrow head
            if (directed) {
                const uniqueMarkerId = safe(`${arrowId}-${sId}-${tId}`);
                const markerPath = svg.select(`#${uniqueMarkerId} path`);
                if (!markerPath.empty()) {
                    if (animate) {
                        markerPath.transition().duration(200).attr('fill', targetColor);
                    } else {
                        markerPath.interrupt().attr('fill', targetColor);
                    }
                }
            }
        });
    };

    const startLoop = () => {
        if (currentStep >= totalSteps) {
            currentStep = 0;
            playback.updateTimeline(0);
        }
        if (currentStep === 0) renderGraphState(0, false);

        playInterval = setInterval(() => {
            if (currentStep < totalSteps) {
                currentStep++;
                playback.updateTimeline(currentStep);
                renderGraphState(currentStep, true);
            } else {
                stopLoop();
                playback.togglePlayState(false);
            }
        }, BASE_DELAY / playback.speed);
    };

    const stopLoop = () => {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    };

    const playback = new GraphPlaybackController(svg, totalSteps, container, {
        onPlay: startLoop,
        onPause: stopLoop,
        onSeek: (step) => {
            currentStep = step;
            renderGraphState(currentStep, false);
        },
        onSpeedChange: () => {
            if (playInterval) { stopLoop(); startLoop(); }
        },
        onEnd: () => {
            stopLoop(); renderGraphState(0, false);
        }
    });

    startLoop();
    renderGraphState(0, false);
}

function visualizeBCC(graphName, container, nodes, edges, svg, arrowId, directed) {
    if (algoGraphs.has(container)) {
        return;
    } else {
        algoGraphs.add(container);
    }

    const originalNodeColors = new Map();

    svg.selectAll("rect.node").each(function (d) {
        originalNodeColors.set(safe(d.id), d3.select(this).attr("fill"));
    });

    // Block user interactions with the graph during visualization
    svg.select('#interaction-blocker').remove();
    svg.append('style')
        .attr('id', 'interaction-blocker')
        .text('rect.node, .link, .link2 { pointer-events: none !important; }');

    const nodeIds = nodes.map(n => safe(n.id !== undefined ? n.id : n));

    // Build undirected adjacency list
    const adj = {};
    nodeIds.forEach(id => adj[id] = []);
    edges.forEach(edge => {
        const u = safe(edge.source.id !== undefined ? edge.source.id : edge.source);
        const v = safe(edge.target.id !== undefined ? edge.target.id : edge.target);
        adj[u].push(v);
        adj[v].push(u);
    });

    // Hopcroft-Tarjan Algorithm State
    let idCounter = 0;
    const ids = {};
    const low = {};
    const stack = [];
    nodeIds.forEach(id => { ids[id] = -1; low[id] = -1; });
    const bccsState = [];
    
    let uState = null;
    let vState = null;
    let pState = null;

    const animationSteps = [];
    let bccCount = 0;

    const pushStep = (type, line, extras = {}) => {
        animationSteps.push({
            type,
            line,
            u: uState,
            v: vState,
            p: pState,
            stack: [...stack],
            ids: { ...ids },
            low: { ...low },
            idCounter,
            bccs: JSON.parse(JSON.stringify(bccsState)),
            ...extras
        });
    };

    pushStep('control', 2); // ids = ...
    pushStep('control', 3); // low = ...
    pushStep('control', 4); // id_counter = 0
    pushStep('control', 5); // stack = []
    pushStep('control', 6); // bccs = []

    function dfs(at, parent) {
        let prevU = uState;
        let prevV = vState;
        let prevP = pState;
        uState = at;
        vState = null;
        pState = parent;

        idCounter++;
        pushStep('control', 10); // id_counter += 1
        
        ids[at] = low[at] = idCounter;
        pushStep('control', 11); // ids[u] = low[u] = id_counter
        
        let children = 0;
        pushStep('control', 12); // children = 0

        if (parent === null) {
            animationSteps.push({ type: 'root_found', line: 12, u: at, u: uState, v: vState, p: pState, stack: [...stack], ids: { ...ids }, low: { ...low }, idCounter, bccs: JSON.parse(JSON.stringify(bccsState)) });
        }

        animationSteps.push({ type: 'visit', line: 12, u: at, id: ids[at], low: low[at], u: uState, v: vState, p: pState, stack: [...stack], ids: { ...ids }, low: { ...low }, idCounter, bccs: JSON.parse(JSON.stringify(bccsState)) });

        pushStep('control', 13); // for v in graph.adj[u]:
        for (const to of adj[at]) {
            vState = to;
            
            pushStep('control', 14); // if v == p: continue
            if (to === parent) continue;

            pushStep('control', 15); // if ids[v] == -1:
            if (ids[to] === -1) {
                children++;
                pushStep('control', 16); // children += 1
                
                stack.push({ u: at, v: to });
                pushStep('control', 17); // stack.append((u, v))
                
                animationSteps.push({ type: 'eval_edge', line: 17, u: at, v: to, edgeType: 'tree', u: uState, v: vState, p: pState, stack: [...stack], ids: { ...ids }, low: { ...low }, idCounter, bccs: JSON.parse(JSON.stringify(bccsState)) });

                pushStep('control', 18); // dfs(v, u)
                dfs(to, at);
                uState = at;
                pState = parent;

                low[at] = Math.min(low[at], low[to]);
                pushStep('control', 19); // low[u] = min(low[u], low[v])
                animationSteps.push({ type: 'update_low', line: 19, u: at, v: to, newLow: low[at], u: uState, v: vState, p: pState, stack: [...stack], ids: { ...ids }, low: { ...low }, idCounter, bccs: JSON.parse(JSON.stringify(bccsState)) });

                // Articulation Point / BCC check
                pushStep('control', 20); // if low[v] >= ids[u]:
                if (low[to] >= ids[at]) {
                    // If it's not the root, it's definitively an AP.
                    if (parent !== null) {
                        animationSteps.push({ type: 'ap_found', line: 20, u: at, u: uState, v: vState, p: pState, stack: [...stack], ids: { ...ids }, low: { ...low }, idCounter, bccs: JSON.parse(JSON.stringify(bccsState)) });
                    }

                    const bccEdges = [];
                    pushStep('control', 21); // bcc_edges = []
                    
                    let poppedEdge;
                    do {
                        pushStep('control', 22); // while True:
                        poppedEdge = stack.pop();
                        pushStep('control', 23); // edge = stack.pop()
                        bccEdges.push(poppedEdge);
                        pushStep('control', 24); // bcc_edges.append(edge)
                        pushStep('control', 25); // if edge == (u, v): break
                    } while (!(poppedEdge.u === at && poppedEdge.v === to));

                    bccsState.push(bccEdges);
                    pushStep('control', 26); // bccs.append(bcc_edges)

                    animationSteps.push({
                        type: 'bcc_found',
                        line: 26,
                        u: at,
                        edges: bccEdges,
                        bccIndex: bccCount,
                        u: uState, v: vState, p: pState, stack: [...stack], ids: { ...ids }, low: { ...low }, idCounter, bccs: JSON.parse(JSON.stringify(bccsState))
                    });
                    bccCount++;
                }
            } else {
                pushStep('control', 27); // elif ids[v] < ids[u]:
                if (ids[to] < ids[at]) {
                    stack.push({ u: at, v: to });
                    pushStep('control', 28); // stack.append((u, v))
                    low[at] = Math.min(low[at], ids[to]);
                    pushStep('control', 29); // low[u] = min(low[u], ids[v])
                    animationSteps.push({ type: 'eval_edge', line: 29, u: at, v: to, edgeType: 'back', newLow: low[at], u: uState, v: vState, p: pState, stack: [...stack], ids: { ...ids }, low: { ...low }, idCounter, bccs: JSON.parse(JSON.stringify(bccsState)) });
                }
            }
            pushStep('control', 13); // loop top
        }

        // Special case: DFS Root is an AP only if it has > 1 independent children in the DFS tree
        if (parent === null && children > 1) {
            animationSteps.push({ type: 'ap_found', line: 13, u: at, isRootAP: true, u: uState, v: vState, p: pState, stack: [...stack], ids: { ...ids }, low: { ...low }, idCounter, bccs: JSON.parse(JSON.stringify(bccsState)) });
        }
        
        uState = prevU;
        vState = prevV;
        pState = prevP;
    }

    pushStep('control', 30); // for node in graph.nodes:
    // Run on all unvisited nodes (handles disconnected graphs)
    for (const node of nodeIds) {
        pushStep('control', 31); // if ids[node] == -1:
        if (ids[node] === -1) {
            pushStep('control', 32); // dfs(node, None)
            dfs(node, null);
            pushStep('control', 30); // loop top
        }
    }
    
    uState = null;
    vState = null;
    pState = null;
    pushStep('control', 33); // return bccs

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600;
    let currentStep = 0;
    let playInterval = null;

    const pythonCode = [
        `<span style="color: #c678dd;">def</span> <span style="color: #61afef;">bcc</span>(graph):`,
        `    ids = {u: -<span style="color: #d19a66;">1</span> <span style="color: #c678dd;">for</span> u <span style="color: #c678dd;">in</span> graph.nodes}`,
        `    low = {u: -<span style="color: #d19a66;">1</span> <span style="color: #c678dd;">for</span> u <span style="color: #c678dd;">in</span> graph.nodes}`,
        `    id_counter = <span style="color: #d19a66;">0</span>`,
        `    stack = []`,
        `    bccs = []`,
        `    <span style="color: #c678dd;">def</span> <span style="color: #61afef;">dfs</span>(u, p):`,
        `        <span style="color: #c678dd;">nonlocal</span> id_counter`,
        `        id_counter += <span style="color: #d19a66;">1</span>`,
        `        ids[u] = low[u] = id_counter`,
        `        children = <span style="color: #d19a66;">0</span>`,
        `        <span style="color: #c678dd;">for</span> v <span style="color: #c678dd;">in</span> graph.adj[u]:`,
        `            <span style="color: #c678dd;">if</span> v == p: <span style="color: #c678dd;">continue</span>`,
        `            <span style="color: #c678dd;">if</span> ids[v] == -<span style="color: #d19a66;">1</span>:`,
        `                children += <span style="color: #d19a66;">1</span>`,
        `                stack.<span style="color: #61afef;">append</span>((u, v))`,
        `                <span style="color: #61afef;">dfs</span>(v, u)`,
        `                low[u] = <span style="color: #56b6c2;">min</span>(low[u], low[v])`,
        `                <span style="color: #c678dd;">if</span> low[v] >= ids[u]:`,
        `                    bcc_edges = []`,
        `                    <span style="color: #c678dd;">while True</span>:`,
        `                        edge = stack.<span style="color: #61afef;">pop</span>()`,
        `                        bcc_edges.<span style="color: #61afef;">append</span>(edge)`,
        `                        <span style="color: #c678dd;">if</span> edge == (u, v): <span style="color: #c678dd;">break</span>`,
        `                    bccs.<span style="color: #61afef;">append</span>(bcc_edges)`,
        `            <span style="color: #c678dd;">elif</span> ids[v] < ids[u]:`,
        `                stack.<span style="color: #61afef;">append</span>((u, v))`,
        `                low[u] = <span style="color: #56b6c2;">min</span>(low[u], ids[v])`,
        `    <span style="color: #c678dd;">for</span> node <span style="color: #c678dd;">in</span> graph.nodes:`,
        `        <span style="color: #c678dd;">if</span> ids[node] == -<span style="color: #d19a66;">1</span>:`,
        `            <span style="color: #61afef;">dfs</span>(node, <span style="color: #d19a66;">None</span>)`,
        `    <span style="color: #c678dd;">return</span> bccs`
    ];

    const formatDict = (dict) => {
        let items = [];
        for (let k in dict) {
            if (dict[k] !== -1) items.push(`${k}: ${dict[k]}`);
        }
        return '{' + items.join(', ') + '}';
    };

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        const stepData = targetStep > 0 ? animationSteps[targetStep - 1] : null;

        let logHTML = `
            <h3 style="color: #ff8a65;">Hopcroft-Tarjan Biconnected Components on <span style="color: #00759a;">${graphName}</span></h3>
            <div style="font-size: 0.9em; margin-bottom: 10px; display: flex; gap: 15px;">
                <span><span style="color: #9b59b6;">●</span> DFS Root</span>
                <span><span style="color: #e67e22;">●</span> Articulation Point</span>
                <span><span style="color: ${nodeVisitColor};">●</span> Visited</span>
            </div>
            <div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>
        `;

        const currentLine = stepData ? stepData.line : null;
        const uVar = stepData && stepData.u !== null ? stepData.u : 'None';
        const vVar = stepData && stepData.v !== null ? stepData.v : 'None';
        const pVar = stepData && stepData.p !== null ? stepData.p : 'None';
        const idCounterVar = stepData ? stepData.idCounter : '0';
        const idsVar = stepData ? formatDict(stepData.ids) : '{}';
        const lowVar = stepData ? formatDict(stepData.low) : '{}';

        let stackStr = '[]';
        if (stepData && stepData.stack.length > 0) {
            stackStr = '[' + stepData.stack.map(e => `(${e.u},${e.v})`).join(', ') + ']';
        }
        let bccsStr = '[]';
        if (stepData && stepData.bccs.length > 0) {
            bccsStr = '[' + stepData.bccs.map(bcc => '[' + bcc.map(e => `(${e.u},${e.v})`).join(', ') + ']').join(', ') + ']';
        }

        logHTML += '<div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; text-align: left;">';

        // Python Code Block
        logHTML += `<div style="flex: 2; min-width: 320px; background: #282c34; color: #abb2bf; padding: 12px 12px 12px 0; border-radius: 6px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.6; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #1e2227;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding-left: 12px;">Algorithm Execution</div>';

        pythonCode.forEach((line, index) => {
            const lineNum = index + 1;
            
            let displayLine = lineNum;
            // Align mapping
            if (lineNum >= 9) displayLine = lineNum + 1; // nonlocal id_counter doesn't exist in mapping
            if (lineNum >= 22) displayLine = lineNum + 1; // while True block offsets
            if (lineNum === 25) displayLine = 26; 

            const isHighlighted = lineNum === currentLine || displayLine === currentLine;
            const bg = isHighlighted ? '#3b4048' : 'transparent';
            const borderLeft = isHighlighted ? '3px solid #61afef' : '3px solid transparent';
            const lineNumHTML = `<span style="display: inline-block; width: 24px; text-align: right; margin-right: 12px; color: #4b5263; border-right: 1px solid #3b4048; padding-right: 8px; user-select: none;">${lineNum}</span>`;

            logHTML += `<div style="display: flex; padding: 2px 6px 2px 0; border-radius: 2px; white-space: pre; background-color: ${bg}; border-left: ${borderLeft}; transition: all 0.2s; margin-bottom: 2px;">${lineNumHTML}<span>${line}</span></div>`;
        });
        logHTML += '</div>';

        // Variables Block
        logHTML += `<div style="flex: 1; min-width: 180px; background: #282c34; padding: 12px; border-radius: 6px; border: 1px solid #1e2227; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.8; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #abb2bf;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Variables</div>';
        logHTML += `<div><span style="color: #c678dd;">u:</span> <span style="color: #e5c07b; font-weight: bold;">${uVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">v:</span> <span style="color: #e5c07b; font-weight: bold;">${vVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">p (parent):</span> <span style="color: #e5c07b; font-weight: bold;">${pVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">id_counter:</span> <span style="color: #d19a66; font-weight: bold;">${idCounterVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">stack:</span> <span style="color: #56b6c2; font-weight: bold; word-break: break-all;">${stackStr}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">ids:</span> <span style="color: #abb2bf; font-weight: bold; word-break: break-all;">${idsVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">low:</span> <span style="color: #abb2bf; font-weight: bold; word-break: break-all;">${lowVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">bccs:</span> <span style="color: #98c379; font-weight: bold; word-break: break-all;">${bccsStr}</span></div>`;
        logHTML += '</div>';

        logHTML += '</div>';

        let visitedNodes = new Set();
        let dfsRoots = new Set();
        let articulationPoints = new Set();
        let resolvedBCCEdges = {};
        let evaluatingEdge = null;
        let activeNode = null;
        
        let textLogHTML = '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #aaa; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Traversal Log</div>';

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'root_found') {
                textLogHTML += `<div style="color: #9b59b6; font-weight: bold;">Starting new DFS component. Root: ${step.u}</div>`;
                dfsRoots.add(safe(step.u));
            } else if (step.type === 'visit') {
                textLogHTML += `<div>Discovered node <span style="color: #ff8a65">${step.u}</span> [id: ${step.ids[safe(step.u)]}].</div>`;
                visitedNodes.add(safe(step.u));
                if (idx === targetStep - 1) activeNode = safe(step.u);
            } else if (step.type === 'eval_edge') {
                const eType = step.edgeType === 'tree' ? 'Tree-edge' : 'Back-edge';
                textLogHTML += `<div style="padding-left: 10px;">Evaluating ${eType}: <span style="color: #a3bf60">${step.u} - ${step.v}</span></div>`;
                if (idx === targetStep - 1) {
                    evaluatingEdge = `${safe(step.u)}-${safe(step.v)}`;
                    activeNode = safe(step.u);
                }
                if (step.edgeType === 'back') {
                    textLogHTML += `<div style="padding-left: 20px; color: #ff8a65;">↳ Updated ${step.u}'s low-link to ${step.newLow}.</div><br>`;
                }
            } else if (step.type === 'update_low') {
                textLogHTML += `<div style="padding-left: 10px; color: #ff8a65;">↳ Returned from ${step.v}. Updated ${step.u}'s low-link to ${step.newLow}.</div><br>`;
                if (idx === targetStep - 1) activeNode = safe(step.u);
            } else if (step.type === 'ap_found') {
                const reason = step.isRootAP ? "Root with >1 children" : `low[v] >= ids[${step.u}]`;
                textLogHTML += `<div style="color: #e67e22; font-weight: bold; margin-top: 5px;">Articulation Point Confirmed: ${step.u} (${reason})</div>`;
                articulationPoints.add(safe(step.u));
            } else if (step.type === 'bcc_found') {
                const color = disColors[step.bccIndex % disColors.length];
                const edgeStrs = step.edges.map(e => `(${e.u}-${e.v})`);
                textLogHTML += `<div style="margin-top: 10px; padding: 5px; background: rgba(0,0,0,0.2); border-left: 3px solid ${color};">
                    <strong>BCC Found!</strong> Triggered at ${step.u}.<br>Edges: <span style="color: #a3bf60">${edgeStrs.join(', ')}</span>
                </div><br>`;

                step.edges.forEach(e => {
                    resolvedBCCEdges[`${safe(e.u)}-${safe(e.v)}`] = color;
                    resolvedBCCEdges[`${safe(e.v)}-${safe(e.u)}`] = color;
                });
            }
        }

        logHTML += textLogHTML;

        if (typeof resultLog !== 'undefined') {
            resultLog.innerHTML = logHTML;
            resultLog.scrollTop = resultLog.scrollHeight;
        }

        // Apply Node Colors
        svg.selectAll('rect.node').each(function (d) {
            const el = d3.select(this);
            const nodeId = safe(d.id);
            const isVisited = visitedNodes.has(nodeId);
            const isRoot = dfsRoots.has(nodeId);
            const isAP = articulationPoints.has(nodeId);
            const isActive = activeNode === nodeId;

            // Determine base fill color
            let targetColor = isActive ? nodeVisitColor : originalNodeColors.get(nodeId);
            if (isRoot) targetColor = '#b375ee'; // Purple for roots
            else if (isAP) targetColor = '#ffa454'; // Orange for Articulation points

            // Determine stroke (border)
            let targetStroke = null;

            if (isActive) {
                targetStroke = edgeEvalColor; // Active yellow halo takes precedence
            } else if (isRoot && isAP) {
                targetStroke = '#ffa454';
            }

            if (animate) {
                const trans = el.transition().duration(300).attr('fill', targetColor);
                if (targetStroke) trans.attr('stroke', targetStroke);
                else trans.attr('stroke', nodeBorderColor);
            } else {
                el.interrupt().attr('fill', targetColor);
                if (targetStroke) el.attr('stroke', targetStroke);
                else el.attr('stroke', nodeBorderColor);
            }
        });

        // Apply Edge Colors and Marker Colors
        svg.selectAll('.link').each(function () {
            const el = d3.select(this);
            const sId = safe(el.attr('source-id').replace(arrowId, ''));
            const tId = safe(el.attr('target-id').replace(arrowId, ''));
            const edgeKey1 = `${sId}-${tId}`;
            const edgeKey2 = `${tId}-${sId}`;

            const isEval = evaluatingEdge === edgeKey1 || evaluatingEdge === edgeKey2;
            const bccColor = resolvedBCCEdges[edgeKey1] || resolvedBCCEdges[edgeKey2];

            let targetColor = edgeColor;

            if (bccColor) {
                targetColor = bccColor;
            } else if (isEval) {
                targetColor = edgeEvalColor;
            }

            // Animate Edge Line
            if (animate) {
                el.transition().duration(200).attr('stroke', targetColor);
            } else {
                el.interrupt().attr('stroke', targetColor);
            }

            // Animate Directed Arrow Marker (if applicable)
            if (directed) {
                const uniqueMarkerId = safe(`${arrowId}-${sId}-${tId}`);
                const markerPath = svg.select(`#${uniqueMarkerId} path`);
                if (!markerPath.empty()) {
                    if (animate) {
                        markerPath.transition().duration(200).attr('fill', targetColor);
                    } else {
                        markerPath.interrupt().attr('fill', targetColor);
                    }
                }
            }
        });
    };

    const startLoop = () => {
        if (currentStep >= totalSteps) {
            currentStep = 0;
            playback.updateTimeline(0);
        }
        if (currentStep === 0) renderGraphState(0, false);

        playInterval = setInterval(() => {
            if (currentStep < totalSteps) {
                currentStep++;
                playback.updateTimeline(currentStep);
                renderGraphState(currentStep, true);
            } else {
                stopLoop();
                playback.togglePlayState(false);
            }
        }, BASE_DELAY / playback.speed);
    };

    const stopLoop = () => {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    };

    const playback = new GraphPlaybackController(svg, totalSteps, container, {
        onPlay: startLoop,
        onPause: stopLoop,
        onSeek: (step) => {
            currentStep = step;
            renderGraphState(currentStep, false);
        },
        onSpeedChange: () => {
            if (playInterval) { stopLoop(); startLoop(); }
        },
        onEnd: () => {
            stopLoop(); renderGraphState(0, false);
        }
    });

    startLoop();
    renderGraphState(0, false);
}

function visualizeFordFulkerson(graphName, startNodeId, sinkNodeId, container, nodes, edges, svg, arrowId, directed) {
    if (algoGraphs.has(container)) {
        return;
    } else {
        algoGraphs.add(container);
    }

    const originalNodeColors = new Map();

    svg.selectAll("rect.node").each(function (d) {
        originalNodeColors.set(safe(d.id), d3.select(this).attr("fill"));
    });

    // Block user interactions with the graph during visualization
    svg.select('#interaction-blocker').remove();
    svg.append('style')
        .attr('id', 'interaction-blocker')
        .text('rect.node, .link, .link2 { pointer-events: none !important; }');

    const nodeIds = nodes.map(n => safe(n.id !== undefined ? n.id : n));
    const V = nodeIds.length;
    if (V < 2) return;

    // Use explicitly passed source and sink nodes
    const source = safe(startNodeId);
    const sink = safe(sinkNodeId);

    // Build Capacity Matrix, Flow Matrix, and undirected adjacency list for residual graph
    const capacity = {};
    const flow = {};
    const adj = {};

    nodeIds.forEach(id => {
        capacity[id] = {};
        flow[id] = {};
        adj[id] = [];
        nodeIds.forEach(id2 => {
            capacity[id][id2] = 0;
            flow[id][id2] = 0;
        });
    });

    edges.forEach(edge => {
        const u = safe(edge.source.id !== undefined ? edge.source.id : edge.source);
        const v = safe(edge.target.id !== undefined ? edge.target.id : edge.target);
        // Treat edge weight as capacity. Default to 10 if missing.
        const w = edge.weight !== undefined ? edge.weight : (edge.capacity !== undefined ? edge.capacity : 10);

        capacity[u][v] += w;

        // Add residual connections to the adjacency list
        if (!adj[u].includes(v)) adj[u].push(v);
        if (!adj[v].includes(u)) adj[v].push(u);
    });

    const animationSteps = [];
    
    // State variables
    let maxFlow = 0;
    let uState = null;
    let vState = null;
    let parentState = {};
    let stackState = [];
    let pathFoundState = false;
    let bottleneckState = 'inf';
    let pathState = [];
    
    const copyFlow = () => {
        const f = {};
        for (let u of nodeIds) {
            f[u] = {};
            for (let v of nodeIds) {
                f[u][v] = flow[u][v];
            }
        }
        return f;
    };

    const pushStep = (type, line, extras = {}) => {
        animationSteps.push({
            type,
            line,
            u: uState,
            v: vState,
            parent: { ...parentState },
            stack: [...stackState],
            pathFound: pathFoundState,
            bottleneck: bottleneckState,
            path: [...pathState],
            maxFlow,
            stateFlow: copyFlow(),
            source,
            sink,
            ...extras
        });
    };

    pushStep('control', 2); // flow = ...
    pushStep('control', 3); // max_flow = 0
    animationSteps.push({ type: 'start', line: 3, source, sink, stateFlow: copyFlow(), maxFlow: 0, stack: [], parent: {}, path: [] });

    // Classic Ford-Fulkerson Method (using DFS for pathfinding)
    pushStep('control', 5); // while True:
    while (true) {
        nodeIds.forEach(id => parentState[id] = null);
        pushStep('control', 6); // parent = {u: None for u in graph.nodes}
        
        parentState[source] = source;
        pushStep('control', 7); // parent[source] = source
        
        stackState = [source];
        pushStep('control', 8); // stack = [source]
        
        pathFoundState = false;
        pushStep('control', 9); // path_found = False
        
        uState = null;
        vState = null;

        pushStep('control', 11); // while stack and not path_found:
        while (stackState.length > 0 && !pathFoundState) {
            uState = stackState.pop();
            pushStep('control', 12); // u = stack.pop()
            
            animationSteps.push({ type: 'visit', line: 12, u: uState, v: null, stack: [...stackState], parent: { ...parentState }, maxFlow, stateFlow: copyFlow(), source, sink, path: [] });

            pushStep('control', 14); // for v in graph.adj[u]:
            for (const to of adj[uState]) {
                vState = to;
                
                const residual = capacity[uState][vState] - flow[uState][vState];
                pushStep('control', 15); // residual = graph.capacity[u][v] - flow[u][v]
                
                animationSteps.push({ type: 'eval_edge', line: 15, u: uState, v: vState, residual, stack: [...stackState], parent: { ...parentState }, maxFlow, stateFlow: copyFlow(), source, sink, path: [] });

                pushStep('control', 16); // if parent[v] is None and residual > 0:
                // If unvisited and has residual capacity
                if (parentState[vState] === null && residual > 0) {
                    parentState[vState] = uState;
                    pushStep('control', 17); // parent[v] = u
                    
                    pushStep('control', 18); // if v == sink:
                    if (vState === sink) {
                        pathFoundState = true;
                        pushStep('control', 19); // path_found = True
                        pushStep('control', 20); // break
                        break;
                    }
                    
                    stackState.push(vState);
                    pushStep('control', 21); // stack.append(v)
                }
                pushStep('control', 14); // loop top
            }
            pushStep('control', 11); // outer loop top
        }

        uState = null;
        vState = null;

        pushStep('control', 23); // if not path_found:
        // If no augmenting path can be found, max flow is reached
        if (!pathFoundState) {
            pushStep('control', 24); // break
            break;
        }

        bottleneckState = Infinity;
        pushStep('control', 26); // bottleneck = float('inf')
        
        let curr = sink;
        pushStep('control', 27); // curr = sink
        
        pathState = [];
        pushStep('control', 28); // path = []

        pushStep('control', 30); // while curr != source:
        while (curr !== source) {
            const p = parentState[curr];
            pushStep('control', 31); // p = parent[curr]
            
            bottleneckState = Math.min(bottleneckState, capacity[p][curr] - flow[p][curr]);
            pushStep('control', 32); // bottleneck = min(bottleneck, graph.capacity[p][curr] - flow[p][curr])
            
            pathState.push({ u: p, v: curr });
            pushStep('control', 33); // path.append((p, curr))
            
            curr = p;
            pushStep('control', 34); // curr = p
            pushStep('control', 30); // while curr != source:
        }

        pathState.reverse();
        pushStep('control', 36); // path.reverse()

        animationSteps.push({
            type: 'path_found',
            line: 36,
            path: [...pathState],
            bottleneck: bottleneckState,
            maxFlow, stateFlow: copyFlow(), source, sink, stack: [], parent: { ...parentState }
        });

        // Augment flow along the path
        pushStep('control', 38); // for u, v in path:
        for (const edge of pathState) {
            flow[edge.u][edge.v] += bottleneckState;
            pushStep('control', 39); // flow[u][v] += bottleneck
            
            flow[edge.v][edge.u] -= bottleneckState; // Residual back-edge
            pushStep('control', 40); // flow[v][u] -= bottleneck
            pushStep('control', 38); // for top
        }

        maxFlow += bottleneckState;
        pushStep('control', 42); // max_flow += bottleneck

        animationSteps.push({
            type: 'augment',
            line: 42,
            path: [...pathState],
            bottleneck: bottleneckState,
            currentMax: maxFlow,
            stateFlow: copyFlow(),
            maxFlow, source, sink, stack: [], parent: { ...parentState }
        });
        
        pushStep('control', 5); // main while true loop
    }

    pushStep('control', 44); // return max_flow
    animationSteps.push({ type: 'complete', line: 44, maxFlow, stateFlow: copyFlow(), source, sink, stack: [], parent: { ...parentState }, path: [] });

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600;
    let currentStep = 0;
    let playInterval = null;
    
    const pythonCode = [
        `<span style="color: #c678dd;">def</span> <span style="color: #61afef;">ford_fulkerson</span>(graph, source, sink):`,
        `    flow = {u: {v: <span style="color: #d19a66;">0</span> <span style="color: #c678dd;">for</span> v <span style="color: #c678dd;">in</span> graph.nodes} <span style="color: #c678dd;">for</span> u <span style="color: #c678dd;">in</span> graph.nodes}`,
        `    max_flow = <span style="color: #d19a66;">0</span>`,
        `    `,
        `    <span style="color: #c678dd;">while True</span>:`,
        `        parent = {u: <span style="color: #d19a66;">None</span> <span style="color: #c678dd;">for</span> u <span style="color: #c678dd;">in</span> graph.nodes}`,
        `        parent[source] = source`,
        `        stack = [source]`,
        `        path_found = <span style="color: #d19a66;">False</span>`,
        `        `,
        `        <span style="color: #c678dd;">while</span> stack <span style="color: #c678dd;">and not</span> path_found:`,
        `            u = stack.<span style="color: #61afef;">pop</span>()`,
        `            `,
        `            <span style="color: #c678dd;">for</span> v <span style="color: #c678dd;">in</span> graph.adj[u]:`,
        `                residual = graph.capacity[u][v] - flow[u][v]`,
        `                <span style="color: #c678dd;">if</span> parent[v] <span style="color: #c678dd;">is None and</span> residual > <span style="color: #d19a66;">0</span>:`,
        `                    parent[v] = u`,
        `                    <span style="color: #c678dd;">if</span> v == sink:`,
        `                        path_found = <span style="color: #d19a66;">True</span>`,
        `                        <span style="color: #c678dd;">break</span>`,
        `                    stack.<span style="color: #61afef;">append</span>(v)`,
        `                    `,
        `        <span style="color: #c678dd;">if not</span> path_found:`,
        `            <span style="color: #c678dd;">break</span>`,
        `            `,
        `        bottleneck = <span style="color: #56b6c2;">float</span>(<span style="color: #98c379;">'inf'</span>)`,
        `        curr = sink`,
        `        path = []`,
        `        `,
        `        <span style="color: #c678dd;">while</span> curr != source:`,
        `            p = parent[curr]`,
        `            bottleneck = <span style="color: #56b6c2;">min</span>(bottleneck, graph.capacity[p][curr] - flow[p][curr])`,
        `            path.<span style="color: #61afef;">append</span>((p, curr))`,
        `            curr = p`,
        `            `,
        `        path.<span style="color: #61afef;">reverse</span>()`,
        `        `,
        `        <span style="color: #c678dd;">for</span> u, v <span style="color: #c678dd;">in</span> path:`,
        `            flow[u][v] += bottleneck`,
        `            flow[v][u] -= bottleneck`,
        `            `,
        `        max_flow += bottleneck`,
        `        `,
        `    <span style="color: #c678dd;">return</span> max_flow`
    ];
    
    const formatDict = (dict) => {
        let items = [];
        for (let k in dict) {
            if (dict[k] !== null && dict[k] !== undefined) items.push(`${k}: ${dict[k]}`);
        }
        return '{' + items.join(', ') + '}';
    };

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        const stepData = targetStep > 0 ? animationSteps[targetStep - 1] : null;
        let activePathEdges = new Set();
        let currentFlowState = stepData ? stepData.stateFlow : null;
        let pathNodes = new Set();

        let logHTML = `
            <h3 style="color: #ff8a65;">Ford-Fulkerson Max Flow on <span style="color: #ff8a65;">${graphName}</span></h3>
            <div style="font-size: 0.9em; margin-bottom: 10px; display: flex; gap: 15px;">
                <span><span style="color: #5c6bc0;">●</span> Source / Sink</span>
                <span><span style="color: #ff8a65;">●</span> Active Node</span>
                <span><span style="color: ${nodeVisitColor};">▬</span> Flow Positive</span>
            </div>
            <div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>
        `;

        const currentLine = stepData ? stepData.line : null;
        const uVar = stepData && stepData.u !== null ? stepData.u : 'None';
        const vVar = stepData && stepData.v !== null ? stepData.v : 'None';
        const bottleneckVar = stepData ? stepData.bottleneck : 'inf';
        const maxFlowVar = stepData ? stepData.maxFlow : '0';
        const parentVar = stepData ? formatDict(stepData.parent) : '{}';

        let stackStr = '[]';
        if (stepData && stepData.stack.length > 0) stackStr = '[' + stepData.stack.join(', ') + ']';
        
        let pathStrVar = '[]';
        if (stepData && stepData.path.length > 0) pathStrVar = '[' + stepData.path.map(e => `(${e.u},${e.v})`).join(', ') + ']';

        logHTML += '<div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; text-align: left;">';

        // Python Code Block
        logHTML += `<div style="flex: 2; min-width: 320px; background: #282c34; color: #abb2bf; padding: 12px 12px 12px 0; border-radius: 6px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.6; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #1e2227;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding-left: 12px;">Algorithm Execution</div>';

        pythonCode.forEach((line, index) => {
            const lineNum = index + 1;
            const isHighlighted = lineNum === currentLine;
            const bg = isHighlighted ? '#3b4048' : 'transparent';
            const borderLeft = isHighlighted ? '3px solid #61afef' : '3px solid transparent';
            const lineNumHTML = `<span style="display: inline-block; width: 24px; text-align: right; margin-right: 12px; color: #4b5263; border-right: 1px solid #3b4048; padding-right: 8px; user-select: none;">${lineNum}</span>`;

            logHTML += `<div style="display: flex; padding: 2px 6px 2px 0; border-radius: 2px; white-space: pre; background-color: ${bg}; border-left: ${borderLeft}; transition: all 0.2s; margin-bottom: 2px;">${lineNumHTML}<span>${line}</span></div>`;
        });
        logHTML += '</div>';

        // Variables Block
        logHTML += `<div style="flex: 1; min-width: 180px; background: #282c34; padding: 12px; border-radius: 6px; border: 1px solid #1e2227; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.8; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #abb2bf;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Variables</div>';
        logHTML += `<div><span style="color: #c678dd;">u:</span> <span style="color: #e5c07b; font-weight: bold;">${uVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">v:</span> <span style="color: #e5c07b; font-weight: bold;">${vVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">max_flow:</span> <span style="color: #d19a66; font-weight: bold;">${maxFlowVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">bottleneck:</span> <span style="color: #d19a66; font-weight: bold;">${bottleneckVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">stack:</span> <span style="color: #56b6c2; font-weight: bold; word-break: break-all;">${stackStr}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">path:</span> <span style="color: #56b6c2; font-weight: bold; word-break: break-all;">${pathStrVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">parent:</span> <span style="color: #abb2bf; font-weight: bold; word-break: break-all;">${parentVar}</span></div>`;
        logHTML += '</div>';

        logHTML += '</div>';
        
        let textLogHTML = '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #aaa; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Traversal Log</div>';
        
        let evaluatingEdge = null;

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'start') {
                textLogHTML += `<div>Initialized Flow Network. Source: <span style="color: #ff8a65">${step.source}</span>, Sink: <span style="color: #ff8a65">${step.sink}</span></div><br>`;
            } else if (step.type === 'visit') {
                textLogHTML += `<div>DFS popped node <span style="color: #ff8a65">${step.u}</span> from stack.</div>`;
            } else if (step.type === 'eval_edge') {
                textLogHTML += `<div style="padding-left: 10px;">Evaluating edge <span style="color: #a3bf60">${step.u} &rarr; ${step.v}</span> (Residual Capacity: ${step.residual})</div>`;
                if (idx === targetStep - 1) evaluatingEdge = `${safe(step.u)}-${safe(step.v)}`;
            } else if (step.type === 'path_found') {
                const pathStr = step.path.map(e => e.u).join(' &rarr; ') + ` &rarr; ${step.path[step.path.length - 1].v}`;
                textLogHTML += `<div style="margin-top: 10px; font-weight: bold;">DFS found augmenting path: <span style="color: #a3bf60">${pathStr}</span></div>`;
                textLogHTML += `<div style="padding-left: 10px;">Bottleneck Capacity (min residual): <strong>${step.bottleneck}</strong></div><br>`;

                step.path.forEach(e => {
                    activePathEdges.add(`${safe(e.u)}-${safe(e.v)}`);
                    pathNodes.add(safe(e.u));
                    pathNodes.add(safe(e.v));
                });
            } else if (step.type === 'augment') {
                textLogHTML += `<div style="padding-left: 10px; color: #a3bf60; font-weight: bold;">↳ Augmented flow by ${step.bottleneck}. Current Max Flow: ${step.currentMax}</div><br>`;
                activePathEdges.clear();
                pathNodes.clear();
            } else if (step.type === 'complete') {
                textLogHTML += `<div style="color: #ff8a65; margin-top: 10px; padding: 10px; border: 2px solid #ff8a65; display: inline-block;"><strong>Algorithm Complete! Max Flow: ${step.maxFlow}</strong></div>`;
            }

            if (idx !== targetStep - 1 && step.type === 'path_found') {
                activePathEdges.clear();
                pathNodes.clear();
            }
            if (idx !== targetStep - 1 && step.type === 'eval_edge') {
                evaluatingEdge = null;
            }
        }

        logHTML += textLogHTML;

        if (typeof resultLog !== 'undefined') {
            resultLog.innerHTML = logHTML;
            resultLog.scrollTop = resultLog.scrollHeight;
        }

        // Apply Node Colors
        svg.selectAll('rect.node').each(function (d) {
            const el = d3.select(this);
            const nodeId = safe(d.id);
            const isSource = nodeId === source;
            const isSink = nodeId === sink;
            
            const isPathActive = pathNodes.has(nodeId);
            const isU = stepData && stepData.u === nodeId;
            const isV = stepData && stepData.v === nodeId;
            const isActive = isPathActive || isU || isV;

            const algorithmRunning = targetStep > 0 && targetStep < totalSteps;
            let targetColor = originalNodeColors.get(nodeId);

            if (algorithmRunning) {
                if (isSource || isSink)
                    targetColor = '#5c6bc0'; // Indigo for source/sink
                else if (isActive)
                    targetColor = '#ff8a65';
            }

            if (animate) {
                el.transition().duration(300).attr('fill', targetColor);
            } else {
                el.interrupt().attr('fill', targetColor);
            }
        });

        // Apply Edge Colors
        svg.selectAll('.link').each(function () {
            const el = d3.select(this);
            const sId = safe(el.attr('source-id').replace(arrowId, ''));
            const tId = safe(el.attr('target-id').replace(arrowId, ''));
            const edgeKey = `${sId}-${tId}`;
            const isEval = evaluatingEdge === edgeKey;

            const isPath = activePathEdges.has(edgeKey);

            // Check if this physical edge is carrying flow in the current state
            const flowCarried = currentFlowState && currentFlowState[sId] && currentFlowState[sId][tId] > 0;
            const isSaturated = currentFlowState && currentFlowState[sId] && currentFlowState[sId][tId] === capacity[sId][tId] && capacity[sId][tId] > 0;

            let targetColor = edgeColor;

            if (isPath) {
                targetColor = edgeEvalColor;
            } else if (isEval) {
                targetColor = edgeEvalColor; // same for evaluation
            } else if (isSaturated) {
                targetColor = errorColor;
            } else if (flowCarried) {
                targetColor = nodeVisitColor;
            }

            if (animate) {
                el.transition().duration(300).attr('stroke', targetColor);
            } else {
                el.interrupt().attr('stroke', targetColor);
            }

            // Update associated arrow head
            if (directed) {
                const uniqueMarkerId = safe(`${arrowId}-${sId}-${tId}`);
                const markerPath = svg.select(`#${uniqueMarkerId} path`);
                if (!markerPath.empty()) {
                    if (animate) {
                        markerPath.transition().duration(300).attr('fill', targetColor);
                    } else {
                        markerPath.interrupt().attr('fill', targetColor);
                    }
                }
            }
        });
    };

    const startLoop = () => {
        if (currentStep >= totalSteps) {
            currentStep = 0;
            playback.updateTimeline(0);
        }
        if (currentStep === 0) renderGraphState(0, false);

        playInterval = setInterval(() => {
            if (currentStep < totalSteps) {
                currentStep++;
                playback.updateTimeline(currentStep);
                renderGraphState(currentStep, true);
            } else {
                stopLoop();
                playback.togglePlayState(false);
            }
        }, BASE_DELAY / playback.speed);
    };

    const stopLoop = () => {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    };

    const playback = new GraphPlaybackController(svg, totalSteps, container, {
        onPlay: startLoop,
        onPause: stopLoop,
        onSeek: (step) => {
            currentStep = step;
            renderGraphState(currentStep, false);
        },
        onSpeedChange: () => {
            if (playInterval) { stopLoop(); startLoop(); }
        },
        onEnd: () => {
            stopLoop(); renderGraphState(0, false);
        }
    });

    startLoop();
    renderGraphState(0, false);
}

function visualizeEdmondsKarp(graphName, startNodeId, sinkNodeId, container, nodes, edges, svg, arrowId, directed) {
    if (algoGraphs.has(container)) {
        return;
    } else {
        algoGraphs.add(container);
    }

    const originalNodeColors = new Map();

    svg.selectAll("rect.node").each(function (d) {
        originalNodeColors.set(safe(d.id), d3.select(this).attr("fill"));
    });

    // Block user interactions with the graph during visualization
    svg.select('#interaction-blocker').remove();
    svg.append('style')
        .attr('id', 'interaction-blocker')
        .text('rect.node, .link, .link2 { pointer-events: none !important; }');

    const nodeIds = nodes.map(n => safe(n.id !== undefined ? n.id : n));
    const V = nodeIds.length;
    if (V < 2) return;

    // Use explicitly passed source and sink nodes
    const source = safe(startNodeId);
    const sink = safe(sinkNodeId);

    // Build Capacity Matrix, Flow Matrix, and undirected adjacency list for residual graph
    const capacity = {};
    const flow = {};
    const adj = {};

    nodeIds.forEach(id => {
        capacity[id] = {};
        flow[id] = {};
        adj[id] = [];
        nodeIds.forEach(id2 => {
            capacity[id][id2] = 0;
            flow[id][id2] = 0;
        });
    });

    edges.forEach(edge => {
        const u = safe(edge.source.id !== undefined ? edge.source.id : edge.source);
        const v = safe(edge.target.id !== undefined ? edge.target.id : edge.target);
        // Treat edge weight as capacity. Default to 10 if missing.
        const w = edge.weight !== undefined ? edge.weight : (edge.capacity !== undefined ? edge.capacity : 10);

        capacity[u][v] += w;

        // Add residual connections to the adjacency list
        if (!adj[u].includes(v)) adj[u].push(v);
        if (!adj[v].includes(u)) adj[v].push(u);
    });

    const animationSteps = [];
    
    // State variables
    let maxFlow = 0;
    let uState = null;
    let vState = null;
    let parentState = {};
    let qState = [];
    let pathFoundState = false;
    let bottleneckState = 'inf';
    let pathState = [];
    
    const copyFlow = () => {
        const f = {};
        for (let u of nodeIds) {
            f[u] = {};
            for (let v of nodeIds) {
                f[u][v] = flow[u][v];
            }
        }
        return f;
    };

    const pushStep = (type, line, extras = {}) => {
        animationSteps.push({
            type,
            line,
            u: uState,
            v: vState,
            parent: { ...parentState },
            queue: [...qState],
            pathFound: pathFoundState,
            bottleneck: bottleneckState,
            path: [...pathState],
            maxFlow,
            stateFlow: copyFlow(),
            source,
            sink,
            ...extras
        });
    };

    pushStep('control', 2); // flow = ...
    pushStep('control', 3); // max_flow = 0
    animationSteps.push({ type: 'start', line: 3, source, sink, stateFlow: copyFlow(), maxFlow: 0, queue: [], parent: {}, path: [] });

    // Edmonds-Karp Loop (Ford-Fulkerson method via BFS)
    pushStep('control', 5); // while True:
    while (true) {
        nodeIds.forEach(id => parentState[id] = null);
        pushStep('control', 6); // parent = {u: None for u in graph.nodes}
        
        parentState[source] = source;
        pushStep('control', 7); // parent[source] = source
        
        qState = [source];
        pushStep('control', 8); // queue = [source]
        
        pathFoundState = false;
        pushStep('control', 9); // path_found = False
        
        uState = null;
        vState = null;

        pushStep('control', 11); // while queue and not path_found:
        while (qState.length > 0 && !pathFoundState) {
            uState = qState.shift();
            pushStep('control', 12); // u = queue.pop(0)
            
            animationSteps.push({ type: 'visit', line: 12, u: uState, v: null, queue: [...qState], parent: { ...parentState }, maxFlow, stateFlow: copyFlow(), source, sink, path: [] });

            pushStep('control', 14); // for v in graph.adj[u]:
            for (const to of adj[uState]) {
                vState = to;
                
                const residual = capacity[uState][vState] - flow[uState][vState];
                pushStep('control', 15); // residual = graph.capacity[u][v] - flow[u][v]
                
                animationSteps.push({ type: 'eval_edge', line: 15, u: uState, v: vState, residual, queue: [...qState], parent: { ...parentState }, maxFlow, stateFlow: copyFlow(), source, sink, path: [] });

                pushStep('control', 16); // if parent[v] is None and residual > 0:
                // If unvisited and has residual capacity
                if (parentState[vState] === null && residual > 0) {
                    parentState[vState] = uState;
                    pushStep('control', 17); // parent[v] = u
                    
                    pushStep('control', 18); // if v == sink:
                    if (vState === sink) {
                        pathFoundState = true;
                        pushStep('control', 19); // path_found = True
                        pushStep('control', 20); // break
                        break;
                    }
                    
                    qState.push(vState);
                    pushStep('control', 21); // queue.append(v)
                }
                pushStep('control', 14); // loop top
            }
            pushStep('control', 11); // outer loop top
        }

        uState = null;
        vState = null;

        pushStep('control', 23); // if not path_found:
        // If no augmenting path can be found, max flow is reached
        if (!pathFoundState) {
            pushStep('control', 24); // break
            break;
        }

        bottleneckState = Infinity;
        pushStep('control', 26); // bottleneck = float('inf')
        
        let curr = sink;
        pushStep('control', 27); // curr = sink
        
        pathState = [];
        pushStep('control', 28); // path = []

        pushStep('control', 30); // while curr != source:
        while (curr !== source) {
            const p = parentState[curr];
            pushStep('control', 31); // p = parent[curr]
            
            bottleneckState = Math.min(bottleneckState, capacity[p][curr] - flow[p][curr]);
            pushStep('control', 32); // bottleneck = min(bottleneck, graph.capacity[p][curr] - flow[p][curr])
            
            pathState.push({ u: p, v: curr });
            pushStep('control', 33); // path.append((p, curr))
            
            curr = p;
            pushStep('control', 34); // curr = p
            pushStep('control', 30); // while curr != source:
        }

        pathState.reverse();
        pushStep('control', 36); // path.reverse()

        animationSteps.push({
            type: 'path_found',
            line: 36,
            path: [...pathState],
            bottleneck: bottleneckState,
            maxFlow, stateFlow: copyFlow(), source, sink, queue: [], parent: { ...parentState }
        });

        // Augment flow along the path
        pushStep('control', 38); // for u, v in path:
        for (const edge of pathState) {
            flow[edge.u][edge.v] += bottleneckState;
            pushStep('control', 39); // flow[u][v] += bottleneck
            
            flow[edge.v][edge.u] -= bottleneckState; // Residual back-edge
            pushStep('control', 40); // flow[v][u] -= bottleneck
            pushStep('control', 38); // for top
        }

        maxFlow += bottleneckState;
        pushStep('control', 42); // max_flow += bottleneck

        animationSteps.push({
            type: 'augment',
            line: 42,
            path: [...pathState],
            bottleneck: bottleneckState,
            currentMax: maxFlow,
            stateFlow: copyFlow(),
            maxFlow, source, sink, queue: [], parent: { ...parentState }
        });
        
        pushStep('control', 5); // main while true loop
    }

    pushStep('control', 44); // return max_flow
    animationSteps.push({ type: 'complete', line: 44, maxFlow, stateFlow: copyFlow(), source, sink, queue: [], parent: { ...parentState }, path: [] });

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600;
    let currentStep = 0;
    let playInterval = null;
    
    const pythonCode = [
        `<span style="color: #c678dd;">def</span> <span style="color: #61afef;">edmonds_karp</span>(graph, source, sink):`,
        `    flow = {u: {v: <span style="color: #d19a66;">0</span> <span style="color: #c678dd;">for</span> v <span style="color: #c678dd;">in</span> graph.nodes} <span style="color: #c678dd;">for</span> u <span style="color: #c678dd;">in</span> graph.nodes}`,
        `    max_flow = <span style="color: #d19a66;">0</span>`,
        `    `,
        `    <span style="color: #c678dd;">while True</span>:`,
        `        parent = {u: <span style="color: #d19a66;">None</span> <span style="color: #c678dd;">for</span> u <span style="color: #c678dd;">in</span> graph.nodes}`,
        `        parent[source] = source`,
        `        queue = [source]`,
        `        path_found = <span style="color: #d19a66;">False</span>`,
        `        `,
        `        <span style="color: #c678dd;">while</span> queue <span style="color: #c678dd;">and not</span> path_found:`,
        `            u = queue.<span style="color: #61afef;">pop</span>(<span style="color: #d19a66;">0</span>)`,
        `            `,
        `            <span style="color: #c678dd;">for</span> v <span style="color: #c678dd;">in</span> graph.adj[u]:`,
        `                residual = graph.capacity[u][v] - flow[u][v]`,
        `                <span style="color: #c678dd;">if</span> parent[v] <span style="color: #c678dd;">is None and</span> residual > <span style="color: #d19a66;">0</span>:`,
        `                    parent[v] = u`,
        `                    <span style="color: #c678dd;">if</span> v == sink:`,
        `                        path_found = <span style="color: #d19a66;">True</span>`,
        `                        <span style="color: #c678dd;">break</span>`,
        `                    queue.<span style="color: #61afef;">append</span>(v)`,
        `                    `,
        `        <span style="color: #c678dd;">if not</span> path_found:`,
        `            <span style="color: #c678dd;">break</span>`,
        `            `,
        `        bottleneck = <span style="color: #56b6c2;">float</span>(<span style="color: #98c379;">'inf'</span>)`,
        `        curr = sink`,
        `        path = []`,
        `        `,
        `        <span style="color: #c678dd;">while</span> curr != source:`,
        `            p = parent[curr]`,
        `            bottleneck = <span style="color: #56b6c2;">min</span>(bottleneck, graph.capacity[p][curr] - flow[p][curr])`,
        `            path.<span style="color: #61afef;">append</span>((p, curr))`,
        `            curr = p`,
        `            `,
        `        path.<span style="color: #61afef;">reverse</span>()`,
        `        `,
        `        <span style="color: #c678dd;">for</span> u, v <span style="color: #c678dd;">in</span> path:`,
        `            flow[u][v] += bottleneck`,
        `            flow[v][u] -= bottleneck`,
        `            `,
        `        max_flow += bottleneck`,
        `        `,
        `    <span style="color: #c678dd;">return</span> max_flow`
    ];
    
    const formatDict = (dict) => {
        let items = [];
        for (let k in dict) {
            if (dict[k] !== null && dict[k] !== undefined) items.push(`${k}: ${dict[k]}`);
        }
        return '{' + items.join(', ') + '}';
    };

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        const stepData = targetStep > 0 ? animationSteps[targetStep - 1] : null;
        let activePathEdges = new Set();
        let currentFlowState = stepData ? stepData.stateFlow : null;
        let pathNodes = new Set();

        let logHTML = `
            <h3 style="color: #ff8a65;">Edmonds-Karp Max Flow on <span style="color: #ff8a65;">${graphName}</span></h3>
            <div style="font-size: 0.9em; margin-bottom: 10px; display: flex; gap: 15px;">
                <span><span style="color: #5c6bc0;">●</span> Source / Sink</span>
                <span><span style="color: #ff8a65;">●</span> Active Node</span>
                <span><span style="color: ${nodeVisitColor};">▬</span> Flow Positive</span>
            </div>
            <div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>
        `;

        const currentLine = stepData ? stepData.line : null;
        const uVar = stepData && stepData.u !== null ? stepData.u : 'None';
        const vVar = stepData && stepData.v !== null ? stepData.v : 'None';
        const bottleneckVar = stepData ? stepData.bottleneck : 'inf';
        const maxFlowVar = stepData ? stepData.maxFlow : '0';
        const parentVar = stepData ? formatDict(stepData.parent) : '{}';

        let queueStr = '[]';
        if (stepData && stepData.queue.length > 0) queueStr = '[' + stepData.queue.join(', ') + ']';
        
        let pathStrVar = '[]';
        if (stepData && stepData.path.length > 0) pathStrVar = '[' + stepData.path.map(e => `(${e.u},${e.v})`).join(', ') + ']';

        logHTML += '<div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; text-align: left;">';

        // Python Code Block
        logHTML += `<div style="flex: 2; min-width: 320px; background: #282c34; color: #abb2bf; padding: 12px 12px 12px 0; border-radius: 6px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.6; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #1e2227;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding-left: 12px;">Algorithm Execution</div>';

        pythonCode.forEach((line, index) => {
            const lineNum = index + 1;
            const isHighlighted = lineNum === currentLine;
            const bg = isHighlighted ? '#3b4048' : 'transparent';
            const borderLeft = isHighlighted ? '3px solid #61afef' : '3px solid transparent';
            const lineNumHTML = `<span style="display: inline-block; width: 24px; text-align: right; margin-right: 12px; color: #4b5263; border-right: 1px solid #3b4048; padding-right: 8px; user-select: none;">${lineNum}</span>`;

            logHTML += `<div style="display: flex; padding: 2px 6px 2px 0; border-radius: 2px; white-space: pre; background-color: ${bg}; border-left: ${borderLeft}; transition: all 0.2s; margin-bottom: 2px;">${lineNumHTML}<span>${line}</span></div>`;
        });
        logHTML += '</div>';

        // Variables Block
        logHTML += `<div style="flex: 1; min-width: 180px; background: #282c34; padding: 12px; border-radius: 6px; border: 1px solid #1e2227; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.8; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #abb2bf;">`;
        logHTML += '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #5c6370; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Variables</div>';
        logHTML += `<div><span style="color: #c678dd;">u:</span> <span style="color: #e5c07b; font-weight: bold;">${uVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">v:</span> <span style="color: #e5c07b; font-weight: bold;">${vVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">max_flow:</span> <span style="color: #d19a66; font-weight: bold;">${maxFlowVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">bottleneck:</span> <span style="color: #d19a66; font-weight: bold;">${bottleneckVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">queue:</span> <span style="color: #56b6c2; font-weight: bold; word-break: break-all;">${queueStr}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">path:</span> <span style="color: #56b6c2; font-weight: bold; word-break: break-all;">${pathStrVar}</span></div>`;
        logHTML += `<div><span style="color: #c678dd;">parent:</span> <span style="color: #abb2bf; font-weight: bold; word-break: break-all;">${parentVar}</span></div>`;
        logHTML += '</div>';

        logHTML += '</div>';
        
        let textLogHTML = '<div style="margin-bottom: 10px; font-weight: bold; font-family: sans-serif; color: #aaa; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Traversal Log</div>';
        
        let evaluatingEdge = null;

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'start') {
                textLogHTML += `<div>Initialized Flow Network. Source: <span style="color: #ff8a65">${step.source}</span>, Sink: <span style="color: #ff8a65">${step.sink}</span></div><br>`;
            } else if (step.type === 'visit') {
                textLogHTML += `<div>BFS dequeued node <span style="color: #ff8a65">${step.u}</span>.</div>`;
            } else if (step.type === 'eval_edge') {
                textLogHTML += `<div style="padding-left: 10px;">Evaluating edge <span style="color: #a3bf60">${step.u} &rarr; ${step.v}</span> (Residual Capacity: ${step.residual})</div>`;
                if (idx === targetStep - 1) evaluatingEdge = `${safe(step.u)}-${safe(step.v)}`;
            } else if (step.type === 'path_found') {
                const pathStr = step.path.map(e => e.u).join(' &rarr; ') + ` &rarr; ${step.path[step.path.length - 1].v}`;
                textLogHTML += `<div style="margin-top: 10px; font-weight: bold;">BFS found shortest augmenting path: <span style="color: #a3bf60">${pathStr}</span></div>`;
                textLogHTML += `<div style="padding-left: 10px;">Bottleneck Capacity (min residual): <strong>${step.bottleneck}</strong></div><br>`;

                step.path.forEach(e => {
                    activePathEdges.add(`${safe(e.u)}-${safe(e.v)}`);
                    pathNodes.add(safe(e.u));
                    pathNodes.add(safe(e.v));
                });
            } else if (step.type === 'augment') {
                textLogHTML += `<div style="padding-left: 10px; color: #a3bf60; font-weight: bold;">↳ Augmented flow by ${step.bottleneck}. Current Max Flow: ${step.currentMax}</div><br>`;
                activePathEdges.clear();
                pathNodes.clear();
            } else if (step.type === 'complete') {
                textLogHTML += `<div style="color: #ff8a65; margin-top: 10px; padding: 10px; border: 2px solid #ff8a65; display: inline-block;"><strong>Algorithm Complete! Max Flow: ${step.maxFlow}</strong></div>`;
            }

            // Reset ephemeral state if not on current step
            if (idx !== targetStep - 1 && step.type === 'path_found') {
                activePathEdges.clear();
                pathNodes.clear();
            }
            if (idx !== targetStep - 1 && step.type === 'eval_edge') {
                evaluatingEdge = null;
            }
        }

        logHTML += textLogHTML;

        if (typeof resultLog !== 'undefined') {
            resultLog.innerHTML = logHTML;
            resultLog.scrollTop = resultLog.scrollHeight;
        }

        // Apply Node Colors
        svg.selectAll('rect.node').each(function (d) {
            const el = d3.select(this);
            const nodeId = safe(d.id);
            const isSource = nodeId === source;
            const isSink = nodeId === sink;
            
            const isPathActive = pathNodes.has(nodeId);
            const isU = stepData && stepData.u === nodeId;
            const isV = stepData && stepData.v === nodeId;
            const isActive = isPathActive || isU || isV;

            const algorithmRunning = targetStep > 0 && targetStep < totalSteps;
            let targetColor = originalNodeColors.get(nodeId);

            if (algorithmRunning) {
                if (isSource || isSink)
                    targetColor = '#5c6bc0'; // Indigo for source/sink
                else if (isActive)
                    targetColor = '#ff8a65';
            }

            if (animate) {
                el.transition().duration(300).attr('fill', targetColor);
            } else {
                el.interrupt().attr('fill', targetColor);
            }
        });

        // Apply Edge Colors
        svg.selectAll('.link').each(function () {
            const el = d3.select(this);
            const sId = safe(el.attr('source-id').replace(arrowId, ''));
            const tId = safe(el.attr('target-id').replace(arrowId, ''));
            const edgeKey = `${sId}-${tId}`;
            const isEval = evaluatingEdge === edgeKey;

            const isPath = activePathEdges.has(edgeKey);

            // Check if this physical edge is carrying flow in the current state
            const flowCarried = currentFlowState && currentFlowState[sId] && currentFlowState[sId][tId] > 0;
            const isSaturated = currentFlowState && currentFlowState[sId] && currentFlowState[sId][tId] === capacity[sId][tId] && capacity[sId][tId] > 0;

            let targetColor = edgeColor;

            if (isPath) {
                targetColor = edgeEvalColor;
            } else if (isEval) {
                targetColor = edgeEvalColor; // same for evaluation
            } else if (isSaturated) {
                targetColor = errorColor;
            } else if (flowCarried) {
                targetColor = nodeVisitColor;
            }

            if (animate) {
                el.transition().duration(300).attr('stroke', targetColor);
            } else {
                el.interrupt().attr('stroke', targetColor);
            }

            // Update associated arrow head
            if (directed) {
                const uniqueMarkerId = safe(`${arrowId}-${sId}-${tId}`);
                const markerPath = svg.select(`#${uniqueMarkerId} path`);
                if (!markerPath.empty()) {
                    if (animate) {
                        markerPath.transition().duration(300).attr('fill', targetColor);
                    } else {
                        markerPath.interrupt().attr('fill', targetColor);
                    }
                }
            }
        });
    };

    const startLoop = () => {
        if (currentStep >= totalSteps) {
            currentStep = 0;
            playback.updateTimeline(0);
        }
        if (currentStep === 0) renderGraphState(0, false);

        playInterval = setInterval(() => {
            if (currentStep < totalSteps) {
                currentStep++;
                playback.updateTimeline(currentStep);
                renderGraphState(currentStep, true);
            } else {
                stopLoop();
                playback.togglePlayState(false);
            }
        }, BASE_DELAY / playback.speed);
    };

    const stopLoop = () => {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    };

    const playback = new GraphPlaybackController(svg, totalSteps, container, {
        onPlay: startLoop,
        onPause: stopLoop,
        onSeek: (step) => {
            currentStep = step;
            renderGraphState(currentStep, false);
        },
        onSpeedChange: () => {
            if (playInterval) { stopLoop(); startLoop(); }
        },
        onEnd: () => {
            stopLoop(); renderGraphState(0, false);
        }
    });

    startLoop();
    renderGraphState(0, false);
}