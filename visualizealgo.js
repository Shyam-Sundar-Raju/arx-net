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
    svg.select('#interaction-blocker').remove(); // Clear any old ones
    svg.append('style')
        .attr('id', 'interaction-blocker')
        .text('rect.node, .link, .link2 { pointer-events: none !important; }');

    // Calculate BFS path
    startNodeId = safe(startNodeId);

    const queue = [startNodeId];
    const visited = new Set();
    visited.add(startNodeId);

    const levels = {};
    levels[startNodeId] = 0;

    const animationSteps = [];
    animationSteps.push({
        type: 'node',
        id: startNodeId,
        level: 0,
        fromEdge: null
    });

    while (queue.length > 0) {
        const currentId = queue.shift();

        edges.forEach(edge => {
            const sId = safe(edge.source.id || edge.source);
            const tId = safe(edge.target.id || edge.target);

            let isTraversable = false;
            let nextNodeId = null;

            if (sId === currentId && !visited.has(tId)) {
                isTraversable = true;
                nextNodeId = tId;
            } else if (!directed && tId === currentId && !visited.has(sId)) {
                isTraversable = true;
                nextNodeId = sId;
            }

            if (isTraversable) {
                visited.add(nextNodeId);
                queue.push(nextNodeId);

                levels[nextNodeId] = levels[currentId] + 1;

                animationSteps.push({
                    type: 'edge',
                    sourceId: sId,
                    targetId: tId
                });

                animationSteps.push({
                    type: 'node',
                    id: nextNodeId,
                    level: levels[nextNodeId],
                    fromEdge: { u: sId, v: tId }
                });
            }
        });
    }

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600; // ms per step at 1x speed
    let currentStep = 0;
    let playInterval = null;

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        // Build sets of all nodes and edges that should be highlighted up to targetStep
        const activeNodes = new Set();
        const activeEdges = new Set(); // Stored as "sourceId-targetId"

        let logHTML = `<h3 style="color: #ff8a65;">BFS through graph <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        for (let i = 0; i < targetStep; i++) {
            const step = animationSteps[i];

            if (step.type === 'node') {
                activeNodes.add(safe(step.id));
            }

            if (step.type === 'edge') {
                activeEdges.add(`${safe(step.sourceId)}-${safe(step.targetId)}`);
            }

            if (step.type === 'node') {
                if (step.level === 0) {
                    logHTML += `<div>Started BFS at vertex <span style="color: #ff8a65">${step.id}</span> at level <span style="color: #ff8a65">0</span></div><br>`;
                } else {
                    logHTML += `<div>Visited vertex <span style="color: #ff8a65">${step.id}</span> through edge <span style="color: #a3bf60">(${step.fromEdge.u},${step.fromEdge.v})</span> at level <span style="color: #ff8a65">${step.level}</span></div><br>`;
                }
            }
        }

        resultLog.innerHTML = logHTML;
        resultLog.scrollTop = resultLog.scrollHeight;

        // Apply Node Colors
        svg.selectAll('rect.node').each(function (d) {
            const el = d3.select(this);
            const nodeId = safe(d.id);

            const isActive = activeNodes.has(nodeId);
            const targetColor = isActive
                ? nodeVisitColor
                : originalNodeColors.get(nodeId);

            const lastStepIndex = targetStep - 1;
            const isLatestNode =
                lastStepIndex >= 0 &&
                animationSteps[lastStepIndex].type === 'node' &&
                safe(animationSteps[lastStepIndex].id) === nodeId;

            if (animate && isLatestNode) {
                el.transition().duration(300).attr('fill', targetColor);
            } else {
                el.interrupt().attr('fill', targetColor);
            }
        });

        // Apply Edge & Arrow Colors
        svg.selectAll('.link').each(function () {
            const el = d3.select(this);

            const sId = safe(el.attr('source-id').replace(arrowId, ''));
            const tId = safe(el.attr('target-id').replace(arrowId, ''));

            const isActive = activeEdges.has(`${sId}-${tId}`);
            const targetColor = isActive ? nodeVisitColor : edgeColor;

            // Update edge path
            if (animate && isActive) {
                el.transition().duration(300).attr('stroke', targetColor);
            } else {
                el.interrupt().attr('stroke', targetColor);
            }

            // Update associated arrow head
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
            currentStep = 0; // Auto-restart if at end
            playback.updateTimeline(0);
        }

        if (currentStep === 0) {
            renderGraphState(0, false);
        }

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

    const rect = container.getBoundingClientRect();

    const x = rect.left + window.scrollX;
    const y = rect.top + window.scrollY;

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
    svg.select('#interaction-blocker').remove(); // Clear any old ones
    svg.append('style')
        .attr('id', 'interaction-blocker')
        .text('rect.node, .link, .link2 { pointer-events: none !important; }');

    startNodeId = safe(startNodeId);

    // Calculate DFS path using a Stack
    const stack = [{ id: startNodeId, level: 0, fromEdge: null }];
    const visited = new Set();
    const animationSteps = [];

    while (stack.length > 0) {
        const current = stack.pop();
        const currentId = safe(current.id);

        // In DFS, we check if visited after popping
        if (!visited.has(currentId)) {
            visited.add(currentId);

            // Record edge traversal step if we came from another node
            if (current.fromEdge) {
                animationSteps.push({ type: 'edge', sourceId: safe(current.fromEdge.u), targetId: safe(current.fromEdge.v) });
            }

            // Record node visitation step
            animationSteps.push({
                type: 'node',
                id: currentId,
                level: current.level,
                fromEdge: current.fromEdge ? { u: safe(current.fromEdge.u), v: safe(current.fromEdge.v) } : null
            });

            // Gather all valid unvisited neighbors
            const neighbors = [];
            edges.forEach(edge => {
                const sId = safe(edge.source.id || edge.source);
                const tId = safe(edge.target.id || edge.target);

                let isTraversable = false;
                let nextNodeId = null;

                if (sId === currentId && !visited.has(tId)) {
                    isTraversable = true;
                    nextNodeId = tId;
                } else if (!directed && tId === currentId && !visited.has(sId)) {
                    isTraversable = true;
                    nextNodeId = sId;
                }

                if (isTraversable) {
                    neighbors.push({
                        id: nextNodeId,
                        level: current.level + 1,
                        fromEdge: { u: sId, v: tId }
                    });
                }
            });

            // Push neighbors to the stack in reverse order 
            for (let i = neighbors.length - 1; i >= 0; i--) {
                stack.push(neighbors[i]);
            }
        }
    }

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600; // ms per step at 1x speed
    let currentStep = 0;
    let playInterval = null;

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        const activeNodes = new Set();
        const activeEdges = new Set(); // Stored as "sourceId-targetId"

        let logHTML = `<h3 style="color: #ff8a65;">DFS through graph <span style="color: #ff8a65;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        for (let i = 0; i < targetStep; i++) {
            const step = animationSteps[i];
            if (step.type === 'node') activeNodes.add(safe(step.id));
            if (step.type === 'edge') activeEdges.add(`${safe(step.sourceId)}-${safe(step.targetId)}`);

            if (step.type === 'node') {
                if (step.level === 0) {
                    logHTML += `<div>Started DFS at vertex <span style="color: #ff8a65">${step.id}</span> at level <span style="color: #ff8a65">0</span></div><br>`;
                } else {
                    logHTML += `<div>Visited vertex <span style="color: #ff8a65">${step.id}</span> through edge <span style="color: #a3bf60">(${step.fromEdge.u},${step.fromEdge.v})</span> at level <span style="color: #ff8a65">${step.level}</span></div><br>`;
                }
            }
        }

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

        // Apply Edge & Arrow Colors
        svg.selectAll('.link').each(function () {
            const el = d3.select(this);
            const sId = safe(el.attr('source-id').replace(arrowId, ''));
            const tId = safe(el.attr('target-id').replace(arrowId, ''));
            const isActive = activeEdges.has(`${sId}-${tId}`);

            const targetColor = isActive ? nodeVisitColor : edgeColor;

            // Update edge path
            if (animate && isActive) {
                el.transition().duration(300).attr('stroke', targetColor);
            } else {
                el.interrupt().attr('stroke', targetColor);
            }

            // Update associated arrow head
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
            currentStep = 0; // Auto-restart if at end
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

    const rect = container.getBoundingClientRect();

    const x = rect.left + window.scrollX;
    const y = rect.top + window.scrollY;

    // Instantiate controller
    const playback = new GraphPlaybackController(svg, totalSteps, container,
        {
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

    // Initialize Dijkstra's requirements
    const distances = {};
    nodes.forEach(n => {
        const nId = safe(n.id !== undefined ? n.id : n);
        distances[nId] = Infinity;
    });
    distances[startNodeId] = 0;

    // Use the custom PriorityQueue
    const pq = new PriorityQueue();
    pq.enqueue({ id: startNodeId, fromEdge: null }, 0);

    const visited = new Set();
    const animationSteps = [];

    while (!pq.isEmpty()) {
        const current = pq.dequeue();
        const u = safe(current.element.id);
        const currentDist = current.priority;
        const fromEdge = current.element.fromEdge;

        // Skip if we've already finalized the shortest path to this node
        if (visited.has(u)) continue;

        visited.add(u);

        // Record the edge that successfully relaxed this node
        if (fromEdge) {
            animationSteps.push({ type: 'edge', sourceId: safe(fromEdge.u), targetId: safe(fromEdge.v) });
        }

        // Record the node visitation (finalized shortest path)
        animationSteps.push({
            type: 'node',
            id: u,
            dist: currentDist,
            fromEdge: fromEdge ? { u: safe(fromEdge.u), v: safe(fromEdge.v), weight: fromEdge.weight } : null
        });

        // Evaluate all neighbors
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

            if (isTraversable && !visited.has(v)) {
                const alt = distances[u] + edgeWeight;

                // Relaxation step
                if (alt < distances[v]) {
                    distances[v] = alt;
                    pq.enqueue({ id: v, fromEdge: { u: edgeU, v: edgeV, weight: edgeWeight } }, alt);
                }
            }
        }
    }

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600; // ms per step at 1x speed
    let currentStep = 0;
    let playInterval = null;

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        const activeNodes = new Set();
        const activeEdges = new Set();

        let logHTML = `<h3 style="color: #ff8a65;">Dijkstra's Algorithm through graph <span style="color: #00759a;">${graphName}</span> </h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        for (let i = 0; i < targetStep; i++) {
            const step = animationSteps[i];
            if (step.type === 'node') activeNodes.add(safe(step.id));
            if (step.type === 'edge') activeEdges.add(`${safe(step.sourceId)}-${safe(step.targetId)}`);

            if (step.type === 'node') {
                if (step.dist === 0) {
                    logHTML += `<div>Started at vertex <span style="color: #ff8a65">${step.id}</span> (Distance: <span style="color: #ff8a65">0</span>)</div><br>`;
                } else {
                    logHTML += `<div>Finalized vertex <span style="color: #ff8a65">${step.id}</span> via edge <span style="color: #a3bf60">(${step.fromEdge.u},${step.fromEdge.v})</span> [w: ${step.fromEdge.weight}] - Total Dist: <span style="color: #ff8a65">${step.dist}</span></div><br>`;
                }
            }
        }

        resultLog.innerHTML = logHTML;
        resultLog.scrollTop = resultLog.scrollHeight;

        // Apply Node Colors
        svg.selectAll('rect.node').each(function (d) {
            const el = d3.select(this);
            const nodeId = safe(d.id);

            const isActive = activeNodes.has(nodeId);
            const targetColor = isActive
                ? nodeVisitColor
                : originalNodeColors.get(nodeId);

            const lastStepIndex = targetStep - 1;
            const isLatestNode =
                lastStepIndex >= 0 &&
                animationSteps[lastStepIndex].type === 'node' &&
                safe(animationSteps[lastStepIndex].id) === nodeId;

            if (animate && isLatestNode) {
                el.transition().duration(300).attr('fill', targetColor);
            } else {
                el.interrupt().attr('fill', targetColor);
            }
        });

        // Apply Edge & Arrow Colors
        // Apply Edge & Arrow Colors
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

    const rect = container.getBoundingClientRect();
    const x = rect.left + window.scrollX;
    const y = rect.top + window.scrollY;

    const playback = new GraphPlaybackController(svg, totalSteps, container,
        {
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

    nodeIds.forEach(k => {
        // Record phase transition
        animationSteps.push({ type: 'pivot', k: k });

        nodeIds.forEach(i => {
            nodeIds.forEach(j => {
                if (dist[i][k] !== Infinity && dist[k][j] !== Infinity) {
                    const alt = dist[i][k] + dist[k][j];
                    if (alt < dist[i][j]) {
                        const oldDist = dist[i][j];
                        dist[i][j] = alt;

                        // Record successful relaxation
                        animationSteps.push({
                            type: 'relax',
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

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600; // ms per step at 1x speed
    let currentStep = 0;
    let playInterval = null;

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        let currentActiveNodes = new Set();

        let logHTML = `<h3 style="color: #ff8a65;">Floyd-Warshall (All-Pairs) on <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            // Build logging history
            if (step.type === 'pivot') {
                logHTML += `<div style="margin-top: 10px;"><strong>Phase:</strong> Evaluating intermediate node <span style="color: #ff8a65">${step.k}</span></div>`;
            } else if (step.type === 'relax') {
                const oldStr = step.oldDist === Infinity ? '∞' : step.oldDist;
                logHTML += `<div>Relaxed <span style="color: #a3bf60">${step.i} &rarr; ${step.j}</span> via <span style="color: #ff8a65">${step.k}</span> (Dist: ${oldStr} &rarr; <span style="color: #ff8a65">${step.newDist}</span>)</div><br>`;
            }

            // Highlight the nodes involved in the exact CURRENT step.
            if (idx === targetStep - 1) {
                if (step.type === 'pivot') {
                    currentActiveNodes.add(safe(step.k));
                } else if (step.type === 'relax') {
                    currentActiveNodes.add(safe(step.k));
                    currentActiveNodes.add(safe(step.i));
                    currentActiveNodes.add(safe(step.j));
                }
            }
        }

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

    const rect = container.getBoundingClientRect();
    const x = rect.left + window.scrollX;
    const y = rect.top + window.scrollY;

    const playback = new GraphPlaybackController(svg, totalSteps, container,
        {
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

    const animationSteps = [];

    // Helper for edge evaluation
    const evaluateEdge = (u, v, weight) => {
        animationSteps.push({
            type: 'eval',
            u: u,
            v: v,
            w: weight,
            distU: distances[u],
            distV: distances[v]
        });

        if (distances[u] !== Infinity && distances[u] + weight < distances[v]) {
            distances[v] = distances[u] + weight;
            animationSteps.push({
                type: 'relax',
                u: u,
                v: v,
                newDist: distances[v]
            });
            return true;
        }
        return false;
    };

    // Relax all edges V - 1 times
    let cycleCheckNeeded = true;

    for (let i = 1; i < V; i++) {
        animationSteps.push({ type: 'phase', phase: i, total: V - 1 });
        let relaxedInThisPhase = false;

        for (const edge of edges) {
            const u = safe(edge.source.id !== undefined ? edge.source.id : edge.source);
            const v = safe(edge.target.id !== undefined ? edge.target.id : edge.target);
            const weight = edge.weight !== undefined ? edge.weight : 1;

            const relaxed = evaluateEdge(u, v, weight);
            if (relaxed) relaxedInThisPhase = true;

            // Handle undirected edges
            if (!directed) {
                const relaxedReverse = evaluateEdge(v, u, weight);
                if (relaxedReverse) relaxedInThisPhase = true;
            }
        }

        // Optimization: If no distances were updated, shortest paths are finalized.
        if (!relaxedInThisPhase) {
            animationSteps.push({ type: 'early_stop', phase: i });
            cycleCheckNeeded = false;
            break;
        }
    }

    // Check for negative-weight cycles
    if (cycleCheckNeeded) {
        animationSteps.push({ type: 'cycle_check' });
        for (const edge of edges) {
            const u = safe(edge.source.id !== undefined ? edge.source.id : edge.source);
            const v = safe(edge.target.id !== undefined ? edge.target.id : edge.target);
            const weight = edge.weight !== undefined ? edge.weight : 1;

            if (distances[u] !== Infinity && distances[u] + weight < distances[v]) {
                animationSteps.push({ type: 'cycle_found', u: u, v: v });
                break;
            }
            if ((!directed) && distances[v] !== Infinity && distances[v] + weight < distances[u]) {
                animationSteps.push({ type: 'cycle_found', u: v, v: u });
                break;
            }
        }
    }

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600; // ms per step
    let currentStep = 0;
    let playInterval = null;

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        let currentActiveNodes = new Set();
        let currentActiveEdges = new Set();
        let isRelaxing = false;

        let logHTML = `<h3 style="color: #ff8a65;">Bellman-Ford on <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            // Build logging history
            if (step.type === 'phase') {
                logHTML += `<div style="margin-top: 15px;"><strong>Pass <span style="color: #ff8a65">${step.phase}</span> of ${step.total}:</strong> Relaxing all edges</div>`;
            } else if (step.type === 'eval') {
                const distUStr = step.distU === Infinity ? '∞' : step.distU;
                const distVStr = step.distV === Infinity ? '∞' : step.distV;
                logHTML += `<div>Eval <span style="color: #a3bf60">${step.u} &rarr; ${step.v}</span> (w: ${step.w}) | Dist[${step.u}]=${distUStr}, Dist[${step.v}]=${distVStr}</div>`;
            } else if (step.type === 'relax') {
                logHTML += `<div style="padding-left: 10px; color: #ff8a65;">↳ Relaxed! New Dist[${step.v}] = ${step.newDist}</div><br>`;
            } else if (step.type === 'early_stop') {
                logHTML += `<div style="color: #a3bf60; margin-top: 15px;"><strong>Early Stop:</strong> No relaxations in Pass ${step.phase}. Algorithm complete!</div>`;
            } else if (step.type === 'cycle_check') {
                logHTML += `<div style="margin-top: 15px;"><strong>Final Pass:</strong> Checking for negative-weight cycles...</div>`;
            } else if (step.type === 'cycle_found') {
                logHTML += `<div style="color: #ff8a65; font-weight: bold;">Error: Negative-weight cycle detected involving ${step.u} &rarr; ${step.v}!</div>`;
            }

            // Isolate active highlights to the exact current frame
            if (idx === targetStep - 1) {
                if (step.type === 'eval' || step.type === 'relax' || step.type === 'cycle_found') {
                    currentActiveNodes.add(safe(step.u));
                    currentActiveNodes.add(safe(step.v));
                    currentActiveEdges.add(`${safe(step.u)}-${safe(step.v)}`);
                    if (step.type === 'relax' || step.type === 'cycle_found') {
                        isRelaxing = true;
                    }
                }
            }
        }

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

    const rect = container.getBoundingClientRect();
    const playback = new GraphPlaybackController(svg, totalSteps, container,
        {
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
    animationSteps.push({ type: 'start', edgeCount: sortedEdges.length });

    let edgesAccepted = 0;

    // Process sorted edges
    for (const edge of sortedEdges) {
        if (edgesAccepted >= V - 1) break;

        const { u, v, weight } = edge;
        animationSteps.push({ type: 'eval', u: u, v: v, w: weight });

        // Check if adding this edge creates a cycle
        if (find(u) === find(v)) {
            animationSteps.push({ type: 'reject', u: u, v: v, w: weight });
        } else {
            union(u, v);
            edgesAccepted++;
            animationSteps.push({ type: 'accept', u: u, v: v, w: weight });
        }
    }

    if (edgesAccepted === V - 1) {
        animationSteps.push({ type: 'complete' });
    }

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600;
    let currentStep = 0;
    let playInterval = null;

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        const mstEdges = new Set();
        const mstNodes = new Set();
        let evaluatingEdge = null;
        let rejectEdge = null;

        let logHTML = `<h3 style="color: #ff8a65;">Kruskal's MST on <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;
        let totalWeight = 0;

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'start') {
                logHTML += `<div>Sorted ${step.edgeCount} edges by weight. Processing from lowest to highest.</div><br>`;
            } else if (step.type === 'eval') {
                logHTML += `<div>Evaluating edge <span style="color: #a3bf60">${step.u} - ${step.v}</span> (w: ${step.w})...</div>`;
                evaluatingEdge = `${safe(step.u)}-${safe(step.v)}`;
            } else if (step.type === 'accept') {
                logHTML += `<div style="padding-left: 10px; color: #a3bf60;">↳ Accepted! Nodes ${step.u} and ${step.v} connected.</div><br>`;
                mstEdges.add(`${safe(step.u)}-${safe(step.v)}`);
                mstEdges.add(`${safe(step.v)}-${safe(step.u)}`);
                mstNodes.add(safe(step.u));
                mstNodes.add(safe(step.v));
                totalWeight += step.w;
                evaluatingEdge = null;
            } else if (step.type === 'reject') {
                logHTML += `<div style="padding-left: 10px; color: #ff8a65;">↳ Rejected! Edge creates a cycle.</div><br>`;
                rejectEdge = `${safe(step.u)}-${safe(step.v)}`;
                evaluatingEdge = null;
            } else if (step.type === 'complete') {
                logHTML += `<div style="color: #ff8a65; margin-top: 10px; font-weight: bold;">MST Complete! Total Weight: ${totalWeight}</div>`;
            }

            // Clear ephemeral styles on previous steps
            if (idx !== targetStep - 1) {
                evaluatingEdge = null;
                rejectEdge = null;
            }
        }

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

    const animationSteps = [];

    // Auto-select the first node to begin the tree
    const startNode = nodeIds[0];
    const visited = new Set([startNode]);
    animationSteps.push({ type: 'start', node: startNode });

    const pq = new PriorityQueue();
    adj[startNode].forEach(edge => {
        pq.enqueue({ u: startNode, v: edge.to, weight: edge.weight }, edge.weight);
    });

    let edgesAccepted = 0;

    while (!pq.isEmpty() && edgesAccepted < V - 1) {
        const { element } = pq.dequeue();
        const { u, v, weight } = element;

        animationSteps.push({ type: 'eval', u: u, v: v, w: weight });

        // If both nodes are already in the MST, skip (cycle)
        if (visited.has(u) && visited.has(v)) {
            animationSteps.push({ type: 'reject', u: u, v: v, w: weight });
            continue;
        }

        // Accept the edge and add the unvisited node
        const newNode = visited.has(u) ? v : u;
        visited.add(newNode);
        edgesAccepted++;

        animationSteps.push({ type: 'accept', u: u, v: v, w: weight, newNode: newNode });

        if (edgesAccepted === V - 1) {
            animationSteps.push({ type: 'complete' });
            break;
        }

        // Enqueue neighbors of the newly added node
        adj[newNode].forEach(edge => {
            if (!visited.has(edge.to)) {
                pq.enqueue({ u: newNode, v: edge.to, weight: edge.weight }, edge.weight);
            }
        });
    }

    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600;
    let currentStep = 0;
    let playInterval = null;

    const renderGraphState = (targetStep, animate = false) => {
        const mstEdges = new Set();
        const mstNodes = new Set();
        let evaluatingEdge = null;
        let rejectEdge = null;

        let logHTML = `<h3 style="color: #ff8a65;">Prim's MST on <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;
        let totalWeight = 0;

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'start') {
                logHTML += `<div>Started growing tree from node <span style="color: #ff8a65">${step.node}</span></div><br>`;
                mstNodes.add(safe(step.node));
            } else if (step.type === 'eval') {
                logHTML += `<div>Evaluating frontier edge <span style="color: #a3bf60">${step.u} - ${step.v}</span> (w: ${step.w})...</div>`;
                evaluatingEdge = `${safe(step.u)}-${safe(step.v)}`;
            } else if (step.type === 'accept') {
                logHTML += `<div style="padding-left: 10px; color: #a3bf60;">↳ Accepted! Added node ${step.newNode} to MST.</div><br>`;
                mstEdges.add(`${safe(step.u)}-${safe(step.v)}`);
                mstEdges.add(`${safe(step.v)}-${safe(step.u)}`);
                mstNodes.add(safe(step.u));
                mstNodes.add(safe(step.v));
                totalWeight += step.w;
                evaluatingEdge = null;
            } else if (step.type === 'reject') {
                logHTML += `<div style="padding-left: 10px; color: #ff8a65;">↳ Rejected! Both nodes already in MST.</div><br>`;
                rejectEdge = `${safe(step.u)}-${safe(step.v)}`;
                evaluatingEdge = null;
            } else if (step.type === 'complete') {
                logHTML += `<div style="color: #ff8a65; margin-top: 10px; font-weight: bold;">MST Complete! Total Weight: ${totalWeight}</div>`;
            }

            if (idx !== targetStep - 1) {
                evaluatingEdge = null;
                rejectEdge = null;
            }
        }

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
    const queue = [];

    // Find all nodes with 0 in-degree
    nodeIds.forEach(id => {
        if (inDegree[id] === 0) queue.push(id);
    });

    animationSteps.push({ type: 'init', initialQueue: [...queue] });

    let processedCount = 0;
    const sortedOrder = [];

    // Process the queue (Kahn's Algorithm)
    while (queue.length > 0) {
        const u = queue.shift();
        sortedOrder.push(u);
        processedCount++;

        animationSteps.push({ type: 'process_node', u: u, currentOrder: [...sortedOrder] });

        adj[u].forEach(v => {
            animationSteps.push({ type: 'eval_edge', u: u, v: v });

            inDegree[v]--;
            if (inDegree[v] === 0) {
                queue.push(v);
                animationSteps.push({ type: 'enqueue', v: v });
            }
        });
    }

    // Check for cycles
    if (processedCount !== V) {
        animationSteps.push({ type: 'cycle_error' });
    } else {
        animationSteps.push({ type: 'complete', finalOrder: sortedOrder });
    }

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600;
    let currentStep = 0;
    let playInterval = null;

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        const completedNodes = new Set();
        let evaluatingNode = null;
        let evaluatingEdge = null;
        let enqueueNode = null;

        let logHTML = `<h3 style="color: #ff8a65;">Topological Sort (Kahn's) on <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;
        let currentTopoOrder = [];

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'init') {
                logHTML += `<div><strong>Initialization:</strong> Nodes with 0 in-degree: [ <span style="color: #a3bf60">${step.initialQueue.join(', ')}</span> ]</div><br>`;
            } else if (step.type === 'process_node') {
                logHTML += `<div>Processing node <span style="color: #ff8a65">${step.u}</span>...</div>`;
                evaluatingNode = safe(step.u);
                completedNodes.add(safe(step.u));
                currentTopoOrder = step.currentOrder;
            } else if (step.type === 'eval_edge') {
                logHTML += `<div style="padding-left: 10px;">↳ Removing edge <span style="color: #ff8a65">${step.u} &rarr; ${step.v}</span> (Decrements ${step.v}'s in-degree)</div>`;
                evaluatingEdge = `${safe(step.u)}-${safe(step.v)}`;
            } else if (step.type === 'enqueue') {
                logHTML += `<div style="padding-left: 10px; color: #a3bf60;">↳ Node ${step.v} now has 0 in-degree. Added to queue!</div>`;
                enqueueNode = safe(step.v);
            } else if (step.type === 'cycle_error') {
                logHTML += `<br><div style="color: #e74c3c; font-weight: bold;">Error: Cycle detected! A valid topological ordering is impossible.</div>`;
            } else if (step.type === 'complete') {
                logHTML += `<br><div style="color: #ff8a65; font-weight: bold;">Sort Complete!</div>`;
            }

            // Reset ephemeral visual states if we aren't on the exact frame
            if (idx !== targetStep - 1) {
                evaluatingNode = null;
                evaluatingEdge = null;
                enqueueNode = null;
            }
        }

        // Always show the running topological order at the bottom
        if (targetStep > 0 && currentTopoOrder.length > 0) {
            logHTML += `<div style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-left: 3px solid #ff8a65;">
                <strong>Current Order:</strong> <span style="color: #a3bf60">[ ${currentTopoOrder.join(' &rarr; ')} ]</span>
            </div>`;
        }

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
    const stack = [];
    const visited = new Set();
    let sccCount = 0;

    // Phase 1: DFS on original graph to determine finish times
    function dfs1(at) {
        visited.add(at);
        animationSteps.push({ type: 'p1_visit', u: at });

        for (const to of adj[at]) {
            animationSteps.push({ type: 'p1_eval', u: at, v: to });
            if (!visited.has(to)) {
                dfs1(to);
            }
        }

        stack.push(at);
        animationSteps.push({ type: 'p1_finish', u: at });
    }

    for (const node of nodeIds) {
        if (!visited.has(node)) {
            dfs1(node);
        }
    }

    // Record the transition phase between DFS passes
    animationSteps.push({ type: 'transpose', finalStack: [...stack] });

    // Phase 2: DFS on transposed graph in decreasing finish time
    visited.clear();

    function dfs2(at, currentScc) {
        visited.add(at);
        currentScc.push(at);
        animationSteps.push({ type: 'p2_visit', u: at });

        for (const to of revAdj[at]) {
            animationSteps.push({ type: 'p2_eval', u: at, v: to });
            if (!visited.has(to)) {
                dfs2(to, currentScc);
            }
        }
    }

    const workingStack = [...stack];
    while (workingStack.length > 0) {
        const node = workingStack.pop();
        if (!visited.has(node)) {
            const sccNodes = [];
            dfs2(node, sccNodes);

            animationSteps.push({
                type: 'scc_found',
                root: node,
                nodes: sccNodes,
                sccIndex: sccCount
            });
            sccCount++;
        }
    }

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600;
    let currentStep = 0;
    let playInterval = null;

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        let currentPhase = 1;
        let finishedNodesP1 = new Set();
        let resolvedSCCs = {};
        let evaluatingEdge = null;
        let activeNode = null;

        let logHTML = `<h3 style="color: #ff8a65;">Kosaraju's SCC on <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'p1_visit') {
                logHTML += `<div>Phase 1: Discovered node <span style="color: #ff8a65">${step.u}</span>.</div>`;
                activeNode = safe(step.u);
            } else if (step.type === 'p1_eval') {
                logHTML += `<div style="padding-left: 10px;">Evaluating edge <span style="color: #a3bf60">${step.u} &rarr; ${step.v}</span>...</div>`;
                evaluatingEdge = `${safe(step.u)}-${safe(step.v)}`;
                activeNode = safe(step.u);
            } else if (step.type === 'p1_finish') {
                logHTML += `<div style="padding-left: 10px; color: #a3bf60;">↳ Finished ${step.u}. Added to stack.</div><br>`;
                finishedNodesP1.add(safe(step.u));
                activeNode = null;
            } else if (step.type === 'transpose') {
                logHTML += `<div style="margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.05); border-left: 3px solid #fff;">
                    <strong>Phase 2: Graph Transposed!</strong><br>
                    Processing stack: [ <span style="color: #a3bf60">${step.finalStack.slice().reverse().join(', ')}</span> ]
                </div><br>`;
                currentPhase = 2;
                activeNode = null;
            } else if (step.type === 'p2_visit') {
                logHTML += `<div>Phase 2: Visiting node <span style="color: #ff8a65">${step.u}</span>...</div>`;
                activeNode = safe(step.u);
            } else if (step.type === 'p2_eval') {
                logHTML += `<div style="padding-left: 10px;">Evaluating reverse edge <span style="color: #a3bf60">${step.u} &rarr; ${step.v}</span> (Original: ${step.v} &rarr; ${step.u})...</div>`;
                // To map the transposed traversal visually to the DOM edge, we swap u and v
                evaluatingEdge = `${safe(step.v)}-${safe(step.u)}`;
                activeNode = safe(step.u);
            } else if (step.type === 'scc_found') {
                const color = disColors[step.sccIndex % disColors.length];
                logHTML += `<div style="margin-top: 10px; padding: 5px; background: rgba(0,0,0,0.2); border-left: 3px solid ${color};">
                    <strong>SCC Found!</strong> Root: ${step.root}. Nodes: [ <span style="color: #a3bf60">${step.nodes.join(', ')}</span> ]
                </div><br>`;

                step.nodes.forEach(n => resolvedSCCs[safe(n)] = color);
                activeNode = null;
            }

            // Reset ephemeral states
            if (idx !== targetStep - 1) {
                evaluatingEdge = null;
            }
        }

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

    nodeIds.forEach(id => ids[id] = -1); // -1 signifies unvisited

    const animationSteps = [];
    let sccCount = 0;

    // DFS for Tarjan's
    function dfs(at) {
        stack.push(at);
        onStack.add(at);
        ids[at] = idCounter;
        low[at] = idCounter;
        idCounter++;

        animationSteps.push({ type: 'visit', u: at, id: ids[at], low: low[at], stackState: [...stack] });

        for (const to of adj[at]) {
            animationSteps.push({ type: 'eval_edge', u: at, v: to });

            if (ids[to] === -1) {
                // Unvisited neighbor
                dfs(to);
                low[at] = Math.min(low[at], low[to]);
                animationSteps.push({ type: 'update_low', u: at, v: to, newLow: low[at] });
            } else if (onStack.has(to)) {
                // Back-edge found
                low[at] = Math.min(low[at], ids[to]);
                animationSteps.push({ type: 'update_low_back', u: at, v: to, newLow: low[at] });
            }
        }

        // Check if we are at the root of an SCC
        if (ids[at] === low[at]) {
            const sccNodes = [];
            let node;
            do {
                node = stack.pop();
                onStack.delete(node);
                sccNodes.push(node);
            } while (node !== at);

            animationSteps.push({
                type: 'scc_found',
                root: at,
                nodes: sccNodes,
                sccIndex: sccCount,
                stackState: [...stack]
            });
            sccCount++;
        }
    }

    // Run Tarjan's on all unvisited nodes
    for (const node of nodeIds) {
        if (ids[node] === -1) {
            dfs(node);
        }
    }

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600;
    let currentStep = 0;
    let playInterval = null;

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        let currentStack = new Set();
        let resolvedSCCs = {}; // nodeId -> color
        let evaluatingEdge = null;
        let activeNode = null;

        let logHTML = `<h3 style="color: #ff8a65;">Tarjan's SCC on <span style="color: #00759a;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'visit') {
                logHTML += `<div>Discovered node <span style="color: #ff8a65">${step.u}</span> [id: ${step.id}, low: ${step.low}]. Added to Stack.</div>`;
                currentStack = new Set(step.stackState.map(safe));
                activeNode = safe(step.u);
            } else if (step.type === 'eval_edge') {
                logHTML += `<div style="padding-left: 10px;">Evaluating edge <span style="color: #a3bf60">${step.u} &rarr; ${step.v}</span>...</div>`;
                evaluatingEdge = `${safe(step.u)}-${safe(step.v)}`;
                activeNode = safe(step.u);
            } else if (step.type === 'update_low') {
                logHTML += `<div style="padding-left: 10px; color: #ff8a65;">↳ Returned from ${step.v}. Updated ${step.u}'s low-link to ${step.newLow}.</div><br>`;
                activeNode = safe(step.u);
            } else if (step.type === 'update_low_back') {
                logHTML += `<div style="padding-left: 10px; color: #ff8a65;">↳ Back-edge to stack node ${step.v}! Updated ${step.u}'s low-link to ${step.newLow}.</div><br>`;
                activeNode = safe(step.u);
            } else if (step.type === 'scc_found') {
                logHTML += `<div style="margin-top: 10px; padding: 5px; background: rgba(0,0,0,0.2); border-left: 3px solid ${disColors[step.sccIndex % disColors.length]};">
                    <strong>SCC Found!</strong> Root: ${step.root}. Nodes popped: [ <span style="color: #a3bf60">${step.nodes.join(', ')}</span> ]
                </div><br>`;
                currentStack = new Set(step.stackState.map(safe));

                // Assign color to all nodes in this SCC
                const color = disColors[step.sccIndex % disColors.length];
                step.nodes.forEach(n => resolvedSCCs[safe(n)] = color);
                activeNode = null;
            }

            // Reset ephemeral state if not on current step
            if (idx !== targetStep - 1) {
                evaluatingEdge = null;
            }
        }

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
    nodeIds.forEach(id => ids[id] = -1);

    const animationSteps = [];
    let bccCount = 0;

    function dfs(u, p = null) {
        idCounter++;
        ids[u] = low[u] = idCounter;
        let children = 0;

        if (p === null) {
            animationSteps.push({ type: 'root_found', u: u });
        }

        animationSteps.push({ type: 'visit', u: u, id: ids[u], low: low[u] });

        for (const v of adj[u]) {
            if (v === p) continue;

            if (ids[v] === -1) {
                children++;
                stack.push({ u, v });
                animationSteps.push({ type: 'eval_edge', u: u, v: v, edgeType: 'tree' });

                dfs(v, u);

                low[u] = Math.min(low[u], low[v]);
                animationSteps.push({ type: 'update_low', u: u, v: v, newLow: low[u] });

                // Articulation Point / BCC check
                if (low[v] >= ids[u]) {
                    // If it's not the root, it's definitively an AP.
                    if (p !== null) {
                        animationSteps.push({ type: 'ap_found', u: u });
                    }

                    const bccEdges = [];
                    let poppedEdge;
                    do {
                        poppedEdge = stack.pop();
                        bccEdges.push(poppedEdge);
                    } while (!(poppedEdge.u === u && poppedEdge.v === v));

                    animationSteps.push({
                        type: 'bcc_found',
                        u: u,
                        edges: bccEdges,
                        bccIndex: bccCount
                    });
                    bccCount++;
                }
            } else if (ids[v] < ids[u]) {
                stack.push({ u, v });
                low[u] = Math.min(low[u], ids[v]);
                animationSteps.push({ type: 'eval_edge', u: u, v: v, edgeType: 'back', newLow: low[u] });
            }
        }

        // Special case: DFS Root is an AP only if it has > 1 independent children in the DFS tree
        if (p === null && children > 1) {
            animationSteps.push({ type: 'ap_found', u: u, isRootAP: true });
        }
    }

    // Run on all unvisited nodes (handles disconnected graphs)
    for (const node of nodeIds) {
        if (ids[node] === -1) dfs(node);
    }

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 600;
    let currentStep = 0;
    let playInterval = null;

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        let visitedNodes = new Set();
        let dfsRoots = new Set();
        let articulationPoints = new Set();
        let resolvedBCCEdges = {};
        let evaluatingEdge = null;
        let activeNode = null;

        let logHTML = `
            <h3 style="color: #ff8a65;">Hopcroft-Tarjan Biconnected Components on <span style="color: #00759a;">${graphName}</span></h3>
            <div style="font-size: 0.9em; margin-bottom: 10px; display: flex; gap: 15px;">
                <span><span style="color: #9b59b6;">●</span> DFS Root</span>
                <span><span style="color: #e67e22;">●</span> Articulation Point</span>
                <span><span style="color: ${nodeVisitColor};">●</span> Visited</span>
            </div>
            <div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>
        `;

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'root_found') {
                logHTML += `<div style="color: #9b59b6; font-weight: bold;">Starting new DFS component. Root: ${step.u}</div>`;
                dfsRoots.add(safe(step.u));
            } else if (step.type === 'visit') {
                logHTML += `<div>Discovered node <span style="color: #ff8a65">${step.u}</span> [id: ${step.id}].</div>`;
                visitedNodes.add(safe(step.u));
                activeNode = safe(step.u);
            } else if (step.type === 'eval_edge') {
                const eType = step.edgeType === 'tree' ? 'Tree-edge' : 'Back-edge';
                logHTML += `<div style="padding-left: 10px;">Evaluating ${eType}: <span style="color: #a3bf60">${step.u} - ${step.v}</span></div>`;
                evaluatingEdge = `${safe(step.u)}-${safe(step.v)}`;
                activeNode = safe(step.u);
                if (step.edgeType === 'back') {
                    logHTML += `<div style="padding-left: 20px; color: #ff8a65;">↳ Updated ${step.u}'s low-link to ${step.newLow}.</div><br>`;
                }
            } else if (step.type === 'update_low') {
                logHTML += `<div style="padding-left: 10px; color: #ff8a65;">↳ Returned from ${step.v}. Updated ${step.u}'s low-link to ${step.newLow}.</div><br>`;
                activeNode = safe(step.u);
            } else if (step.type === 'ap_found') {
                const reason = step.isRootAP ? "Root with >1 children" : `low[v] >= ids[${step.u}]`;
                logHTML += `<div style="color: #e67e22; font-weight: bold; margin-top: 5px;">Articulation Point Confirmed: ${step.u} (${reason})</div>`;
                articulationPoints.add(safe(step.u));
            } else if (step.type === 'bcc_found') {
                const color = disColors[step.bccIndex % disColors.length];
                const edgeStrs = step.edges.map(e => `(${e.u}-${e.v})`);
                logHTML += `<div style="margin-top: 10px; padding: 5px; background: rgba(0,0,0,0.2); border-left: 3px solid ${color};">
                    <strong>BCC Found!</strong> Triggered at ${step.u}.<br>Edges: <span style="color: #a3bf60">${edgeStrs.join(', ')}</span>
                </div><br>`;

                step.edges.forEach(e => {
                    resolvedBCCEdges[`${safe(e.u)}-${safe(e.v)}`] = color;
                    resolvedBCCEdges[`${safe(e.v)}-${safe(e.u)}`] = color;
                });
                activeNode = null;
            }

            if (idx !== targetStep - 1) {
                evaluatingEdge = null;
            }
        }

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
    let maxFlow = 0;

    animationSteps.push({ type: 'start', source, sink });

    // Classic Ford-Fulkerson Method (using DFS for pathfinding)
    while (true) {
        const parent = {};
        nodeIds.forEach(id => parent[id] = null);

        // STACK implementation for Depth-First Search
        const stack = [source];
        parent[source] = source;

        let pathFound = false;

        while (stack.length > 0 && !pathFound) {
            // LIFO behavior - diving deep into the graph
            const u = stack.pop();

            for (const v of adj[u]) {
                const residual = capacity[u][v] - flow[u][v];
                // If unvisited and has residual capacity
                if (parent[v] === null && residual > 0) {
                    parent[v] = u;
                    if (v === sink) {
                        pathFound = true;
                        break;
                    }
                    stack.push(v);
                }
            }
        }

        // If no augmenting path can be found, max flow is reached
        if (!pathFound) break;

        // Reconstruct path to find bottleneck (minimum residual capacity)
        let bottleneck = Infinity;
        let curr = sink;
        const pathEdges = [];

        while (curr !== source) {
            const p = parent[curr];
            bottleneck = Math.min(bottleneck, capacity[p][curr] - flow[p][curr]);
            pathEdges.push({ u: p, v: curr });
            curr = p;
        }

        pathEdges.reverse();

        animationSteps.push({
            type: 'path_found',
            path: pathEdges,
            bottleneck
        });

        // Augment flow along the path
        for (const edge of pathEdges) {
            flow[edge.u][edge.v] += bottleneck;
            flow[edge.v][edge.u] -= bottleneck; // Residual back-edge
        }

        maxFlow += bottleneck;

        // Deep copy the current flow matrix for the timeline state
        const stateFlow = {};
        nodeIds.forEach(u => {
            stateFlow[u] = {};
            nodeIds.forEach(v => {
                stateFlow[u][v] = flow[u][v];
            });
        });

        animationSteps.push({
            type: 'augment',
            path: pathEdges,
            bottleneck,
            currentMax: maxFlow,
            stateFlow
        });
    }

    animationSteps.push({ type: 'complete', maxFlow });

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 1000;
    let currentStep = 0;
    let playInterval = null;

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        let activePathEdges = new Set();
        let currentFlowState = null;
        let pathNodes = new Set();

        let logHTML = `<h3 style="color: #ff8a65;">Ford-Fulkerson (DFS) Max Flow on <span style="color: #ff8a65;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'start') {
                logHTML += `<div>Initialized Flow Network. Source: <span style="color: #ff8a65">${step.source}</span>, Sink: <span style="color: #ff8a65">${step.sink}</span></div><br>`;
            } else if (step.type === 'path_found') {
                const pathStr = step.path.map(e => e.u).join(' &rarr; ') + ` &rarr; ${step.path[step.path.length - 1].v}`;
                logHTML += `<div>DFS found augmenting path: <span style="color: #a3bf60">${pathStr}</span></div>`;
                logHTML += `<div style="padding-left: 10px;">Bottleneck Capacity (min residual): <strong>${step.bottleneck}</strong></div>`;

                step.path.forEach(e => {
                    activePathEdges.add(`${safe(e.u)}-${safe(e.v)}`);
                    pathNodes.add(safe(e.u));
                    pathNodes.add(safe(e.v));
                });
            } else if (step.type === 'augment') {
                logHTML += `<div style="padding-left: 10px; color: #a3bf60;">↳ Augmented flow by ${step.bottleneck}. Current Max Flow: ${step.currentMax}</div><br>`;
                currentFlowState = step.stateFlow;
                activePathEdges.clear();
                pathNodes.clear();
            } else if (step.type === 'complete') {
                logHTML += `<div style="color: #ff8a65; margin-top: 10px; padding: 10px; border: 2px solid #ff8a65; display: inline-block;"><strong>Algorithm Complete! Max Flow: ${step.maxFlow}</strong></div>`;
            }

            // Reset ephemeral state if not on current step
            if (idx !== targetStep - 1 && step.type === 'path_found') {
                activePathEdges.clear();
                pathNodes.clear();
            }
        }

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
            const isActive = pathNodes.has(nodeId);


            const algorithmRunning = targetStep > 0 && targetStep < totalSteps;
            let targetColor = originalNodeColors.get(nodeId);

            if (algorithmRunning) {
                if (isSource || isSink)
                    targetColor = '#5c6bc0';
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

            const isPath = activePathEdges.has(edgeKey);

            // Check if this physical edge is carrying flow in the current state
            const flowCarried = currentFlowState && currentFlowState[sId][tId] > 0;
            const isSaturated = currentFlowState && currentFlowState[sId][tId] === capacity[sId][tId] && capacity[sId][tId] > 0;

            let targetColor = edgeColor;

            if (isPath) {
                targetColor = edgeEvalColor;
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
    let maxFlow = 0;

    animationSteps.push({ type: 'start', source, sink });

    // Edmonds-Karp Loop (Ford-Fulkerson method via BFS)
    while (true) {
        // BFS to find the shortest augmenting path in terms of number of edges
        const parent = {};
        nodeIds.forEach(id => parent[id] = null);
        const q = [source];
        parent[source] = source;

        let pathFound = false;

        while (q.length > 0 && !pathFound) {
            const u = q.shift();

            for (const v of adj[u]) {
                const residual = capacity[u][v] - flow[u][v];
                // If unvisited and has residual capacity
                if (parent[v] === null && residual > 0) {
                    parent[v] = u;
                    if (v === sink) {
                        pathFound = true;
                        break;
                    }
                    q.push(v);
                }
            }
        }

        // If no augmenting path can be found from source to sink, max flow is reached
        if (!pathFound) break;

        // Reconstruct path to find bottleneck (minimum residual capacity along path)
        let bottleneck = Infinity;
        let curr = sink;
        const pathEdges = [];

        while (curr !== source) {
            const p = parent[curr];
            bottleneck = Math.min(bottleneck, capacity[p][curr] - flow[p][curr]);
            pathEdges.push({ u: p, v: curr });
            curr = p;
        }

        pathEdges.reverse();

        animationSteps.push({
            type: 'path_found',
            path: pathEdges,
            bottleneck
        });

        // Augment flow along the discovered path
        for (const edge of pathEdges) {
            flow[edge.u][edge.v] += bottleneck;
            flow[edge.v][edge.u] -= bottleneck; // Symmetric residual back-edge update
        }

        maxFlow += bottleneck;

        // Snapshot current flow matrix state for timeline seeking accuracy
        const stateFlow = {};
        nodeIds.forEach(u => {
            stateFlow[u] = {};
            nodeIds.forEach(v => {
                stateFlow[u][v] = flow[u][v];
            });
        });

        animationSteps.push({
            type: 'augment',
            path: pathEdges,
            bottleneck,
            currentMax: maxFlow,
            stateFlow
        });
    }

    animationSteps.push({ type: 'complete', maxFlow });

    // Playback State Variables
    const totalSteps = animationSteps.length;
    const BASE_DELAY = 1000;
    let currentStep = 0;
    let playInterval = null;

    // Core Render Function
    const renderGraphState = (targetStep, animate = false) => {
        let activePathEdges = new Set();
        let currentFlowState = null;
        let pathNodes = new Set();

        let logHTML = `<h3 style="color: #ff8a65;">Edmonds-Karp Max Flow on <span style="color: #ff8a65;">${graphName}</span></h3><div style="width: 100%; height: 1px; background-color: #333; margin: 0 0 20px 0;"></div>`;

        for (let idx = 0; idx < targetStep; idx++) {
            const step = animationSteps[idx];

            if (step.type === 'start') {
                logHTML += `<div>Initialized Flow Network. Source: <span style="color: #ff8a65">${step.source}</span>, Sink: <span style="color: #ff8a65">${step.sink}</span></div><br>`;
            } else if (step.type === 'path_found') {
                const pathStr = step.path.map(e => e.u).join(' &rarr; ') + ` &rarr; ${step.path[step.path.length - 1].v}`;
                logHTML += `<div>BFS found shortest augmenting path: <span style="color: #a3bf60">${pathStr}</span></div>`;
                logHTML += `<div style="padding-left: 10px;">Bottleneck Capacity (min residual): <strong>${step.bottleneck}</strong></div>`;

                step.path.forEach(e => {
                    activePathEdges.add(`${safe(e.u)}-${safe(e.v)}`);
                    pathNodes.add(safe(e.u));
                    pathNodes.add(safe(e.v));
                });
            } else if (step.type === 'augment') {
                logHTML += `<div style="padding-left: 10px; color: #a3bf60;">↳ Augmented flow by ${step.bottleneck}. Current Max Flow: ${step.currentMax}</div><br>`;
                currentFlowState = step.stateFlow;
                activePathEdges.clear();
                pathNodes.clear();
            } else if (step.type === 'complete') {
                logHTML += `<div style="color: #ff8a65; margin-top: 10px; padding: 10px; border: 2px solid #ff8a65; display: inline-block;"><strong>Algorithm Complete! Max Flow: ${step.maxFlow}</strong></div>`;
            }

            // Reset ephemeral visualization properties if skipping past a step
            if (idx !== targetStep - 1 && step.type === 'path_found') {
                activePathEdges.clear();
                pathNodes.clear();
            }
        }

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
            const isActive = pathNodes.has(nodeId);


            let targetColor = originalNodeColors.get(nodeId);
            const algorithmRunning = targetStep > 0 && targetStep < totalSteps;

            if (algorithmRunning) {
                if (isSource || isSink) {
                    targetColor = "#5c6bc0";
                } else if (isActive) {
                    targetColor = "#ff8a65";
                }
            }

            if (animate) {
                el.transition().duration(300).attr('fill', targetColor);
            } else {
                el.interrupt().attr('fill', targetColor);
            }
        });

        // Apply Edge Colors and Weights
        svg.selectAll('.link').each(function () {
            const el = d3.select(this);
            const sId = safe(el.attr('source-id').replace(arrowId, ''));
            const tId = safe(el.attr('target-id').replace(arrowId, ''));
            const edgeKey = `${sId}-${tId}`;

            const isPath = activePathEdges.has(edgeKey);

            // Analyze physical usage status
            const flowCarried = currentFlowState && currentFlowState[sId][tId] > 0;
            const isSaturated = currentFlowState && currentFlowState[sId][tId] === capacity[sId][tId] && capacity[sId][tId] > 0;

            let targetColor = edgeColor;

            if (isPath) {
                targetColor = edgeEvalColor;
            } else if (isSaturated) {
                targetColor = errorColor; // Red indicates zero remaining residual capacity
            } else if (flowCarried) {
                targetColor = nodeVisitColor; // Green tracks active distribution routes
            }

            if (animate) {
                el.transition().duration(300).attr('stroke', targetColor);
            } else {
                el.interrupt().attr('stroke', targetColor);
            }

            // Update associated directed arrowheads
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