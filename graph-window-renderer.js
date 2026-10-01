const _nodeTextMeasureCtx = document.createElement('canvas').getContext('2d');
const NODE_MIN_WIDTH = 60;
const NODE_HEIGHT = 60;
const NODE_PADDING_X = 20;
const NODE_CORNER_RADIUS = 30;

function measureNodeTextWidth(text, font = '25px sans-serif') {
    _nodeTextMeasureCtx.font = font; // keep in sync with .node-label's actual font
    return _nodeTextMeasureCtx.measureText(String(text)).width;
}

function nodeRectWidth(d) {
    const displayText = d.label !== undefined ? d.label : d.id;
    return Math.max(NODE_MIN_WIDTH, measureNodeTextWidth(displayText) + NODE_PADDING_X * 2);
}

// Sizes a <rect class="node"> selection to fit its label, with a rounded corner.
function sizeNodeRect(selection) {
    return selection
        .attr('width', d => nodeRectWidth(d))
        .attr('height', NODE_HEIGHT)
        .attr('x', d => -nodeRectWidth(d) / 2)
        .attr('y', -NODE_HEIGHT / 2)
        .attr('rx', NODE_CORNER_RADIUS)
        .attr('ry', NODE_CORNER_RADIUS);
}

// Positions a node <rect> (or a selection being transitioned) at d.x/d.y
function positionNode(selection) {
    return selection.attr('transform', d => `translate(${d.x},${d.y})`);
}

/* Function to align edges */
function setEdgePositions(link, edgeLabel, node, label, directed, weighted, svg, arrowId) {
    const safe = x => String(x).replace(/[^\w-]/g, "_");
    const ARROW_REFX = 9;
    const BIDIRECTIONAL_SEPARATION = -8;
    function rectBorderPoint(cx, cy, halfW, halfH, px, py, cornerRadius) {
        const dx = px - cx;
        const dy = py - cy;
        if (dx === 0 && dy === 0) return { x: cx, y: cy };

        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len;
        const uy = dy / len;

        const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
        const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
        // Cap at 1 so we never overshoot past the other node's own center
        // (guards against nodes that are overlapping / very close together).
        const scale = Math.min(scaleX, scaleY, 1);
        const flatX = dx * scale;
        const flatY = dy * scale;

        const r = Math.min(cornerRadius || 0, halfW, halfH);
        if (r <= 0) {
            return { x: cx + flatX, y: cy + flatY };
        }

        const iw = halfW - r; // where the flat edge ends and the corner curve begins
        const ih = halfH - r;
        const hitVerticalEdge = scaleX <= scaleY;
        const inCornerZone = hitVerticalEdge ? Math.abs(flatY) > ih : Math.abs(flatX) > iw;

        if (!inCornerZone) {
            return { x: cx + flatX, y: cy + flatY };
        }
        const qx = Math.sign(dx) * iw;
        const qy = Math.sign(dy) * ih;
        const b = ux * qx + uy * qy;
        const c = qx * qx + qy * qy - r * r;
        const s = Math.min(b + Math.sqrt(Math.max(b * b - c, 0)), len);

        return { x: cx + ux * s, y: cy + uy * s };
    }
    function computeEdgeGeometry(d) {
        if (d.selfLoop) {
            const x = d.source.x;
            const y = d.source.y;
            const loopRadius = 50;
            const offsetX = 0;
            const offsetY = -35;

            return {
                path: `M${x + offsetX},${y + offsetY - loopRadius}
                    a${loopRadius},${loopRadius} 0 1,1 0,${2 * loopRadius}
                    a${loopRadius},${loopRadius} 0 1,1 0,${-2 * loopRadius}`,
                labelX: x + offsetX - 5,
                labelY: y - 40
            };
        }

        if (d.bidirectional) {
            const sHalfW = nodeRectWidth(d.source) / 2;
            const sHalfH = NODE_HEIGHT / 2;
            const tHalfW = nodeRectWidth(d.target) / 2;
            const tHalfH = NODE_HEIGHT / 2;
            const start = rectBorderPoint(d.source.x, d.source.y, sHalfW, sHalfH, d.target.x, d.target.y, NODE_CORNER_RADIUS);
            const end = rectBorderPoint(d.target.x, d.target.y, tHalfW, tHalfH, d.source.x, d.source.y, NODE_CORNER_RADIUS);

            const cdx = d.target.x - d.source.x;
            const cdy = d.target.y - d.source.y;
            const centerLen = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
            const dr = centerLen * 1.2; // curvature stays based on true center distance
            const px = (-cdy / centerLen) * BIDIRECTIONAL_SEPARATION;
            const py = (cdx / centerLen) * BIDIRECTIONAL_SEPARATION;
            start.x += px; start.y += py;
            end.x += px; end.y += py;
            const adx = end.x - start.x;
            const ady = end.y - start.y;
            const len = Math.sqrt(adx * adx + ady * ady) || 1;
            const mx = (start.x + end.x) / 2;
            const my = (start.y + end.y) / 2;
            const h = Math.sqrt(Math.max(dr * dr - (len / 2) * (len / 2), 0));

            return {
                path: `M${start.x},${start.y}A${dr},${dr} 0 0,1 ${end.x},${end.y}`,
                labelX: mx + (dr - h) * (ady / len),
                labelY: my - (dr - h) * (adx / len)
            };
        }
        const halfW = nodeRectWidth(d.target) / 2;
        const halfH = NODE_HEIGHT / 2;
        const end = rectBorderPoint(d.target.x, d.target.y, halfW, halfH, d.source.x, d.source.y, NODE_CORNER_RADIUS);

        return {
            path: `M${d.source.x},${d.source.y}L${end.x},${end.y}`,
            labelX: (d.source.x + end.x) / 2,
            labelY: (d.source.y + end.y) / 2
        };
    }

    link.attr('d', d => computeEdgeGeometry(d).path);

    if (link.attr('class') === 'link') {
        link.each(function (d) {
            const path = d3.select(this);
            const uniqueArrowId = `${arrowId}-${safe(d.source.id)}-${safe(d.target.id)}`;

            if (directed) {
                if (!svg.select(`#${uniqueArrowId}`).node()) {
                    svg.append('defs')
                        .append('marker')
                        .attr('id', uniqueArrowId)
                        .attr('class', 'directed-arrow')
                        .attr('viewBox', '0 -5 10 10')
                        .attr('refX', ARROW_REFX)
                        .attr('refY', 0)
                        .attr('markerWidth', 5)
                        .attr('markerHeight', 5)
                        .attr('orient', 'auto')
                        .append('path')
                        .attr('d', 'M0,-5L10,0L0,5');
                }

                path.attr('marker-end', `url(#${uniqueArrowId})`);
            }

            const marker = svg.select(`#${uniqueArrowId}`);

            if (d.selfLoop) {
                marker
                    .attr('refX', 4)
                    .attr('refY', -0.5)
                    .attr('orient', 'auto');
            } else {
                marker.attr('orient', 'auto');
            }
        });
        if (weighted) {
            edgeLabel
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('x', d => computeEdgeGeometry(d).labelX)
                .attr('y', d => computeEdgeGeometry(d).labelY);
        }

        positionNode(node);
        label.attr('x', d => d.x).attr('y', d => d.y);
    }
}
/* End of align edges */

// Function to even spaces nodes in a circle
function autoLayoutNodes(nodes, simulation, width, height, edges = null, treeFor) {
    simulation.alphaDecay(1);
    simulation.alphaTarget(0);

    if (treeFor) {
        const getId = (n) => n.id !== undefined ? n.id : n.label || n.name;
        const getEdgeId = (n) => typeof n === 'object' ? getId(n) : n;

        const isBTreeFamily = treeFor === 'b' || treeFor === 'bPlus';

        let hierarchyEdges = edges;
        if (treeFor === 'bPlus') {
            const outDegree = new Map();
            edges.forEach(e => {
                const s = getEdgeId(e.source);
                outDegree.set(s, (outDegree.get(s) || 0) + 1);
            });
            hierarchyEdges = edges.filter(e => outDegree.get(getEdgeId(e.source)) >= 2);
        }

        // Calculate in-degrees to find the root
        const inDegree = new Map(nodes.map(n => [getId(n), 0]));

        hierarchyEdges.forEach(e => {
            const targetId = getEdgeId(e.target);
            if (inDegree.has(targetId)) {
                inDegree.set(targetId, inDegree.get(targetId) + 1);
            }
        });

        // Identify the root (in-degree of 0). Fallback to 'root' named node, or just the first node.
        let rootId = null;
        for (const [id, deg] of inDegree.entries()) {
            if (deg === 0) {
                rootId = id;
                break;
            }
        }
        if (!rootId) {
            const rootNode = nodes.find(n => getId(n) === 'rt');
            rootId = rootNode ? getId(rootNode) : getId(nodes[0]);
        }

        const levels = [];
        const queue = [{ id: rootId, depth: 0 }];
        const visited = new Set([rootId]);

        while (queue.length > 0) {
            const { id, depth } = queue.shift();

            if (!levels[depth]) levels[depth] = [];
            levels[depth].push(id);

            hierarchyEdges.forEach(e => {
                const s = getEdgeId(e.source);
                const t = getEdgeId(e.target);

                if (s === id && !visited.has(t)) {
                    visited.add(t);
                    queue.push({ id: t, depth: depth + 1 });
                } else if (t === id && !visited.has(s)) {
                    visited.add(s);
                    queue.push({ id: s, depth: depth + 1 });
                }
            });
        }

        const maxDepth = levels.length;
        const NODE_GAP = isBTreeFamily ? 320 : 200; // minimum breathing room between adjacent node edges
        const verticalPadding = isBTreeFamily ? 1.3 : 1;
        const verticalSpacing = (height / (maxDepth + 1)) * verticalPadding;

        levels.forEach((levelNodes, depth) => {
            const levelNodeObjs = levelNodes
                .map(nodeId => nodes.find(n => getId(n) === nodeId))
                .filter(Boolean);

            const widths = levelNodeObjs.map(n => nodeRectWidth(n));
            const totalWidth = widths.reduce((sum, w) => sum + w, 0) + NODE_GAP * Math.max(0, levelNodeObjs.length - 1);

            let cursorX = (width - totalWidth) / 2;

            levelNodeObjs.forEach((node, index) => {
                const w = widths[index];
                node.x = cursorX + w / 2;
                node.y = verticalSpacing * (depth + 1);
                cursorX += w + NODE_GAP;
            });
        });

    } else {
        const NODE_GAP = 200;
        const totalWidth = nodes.reduce((sum, n) => sum + nodeRectWidth(n) + NODE_GAP, 0);
        const radius = Math.max(150, totalWidth / (2 * Math.PI));
        const angleStep = (2 * Math.PI) / nodes.length;

        nodes.forEach((node, index) => {
            node.x = width / 2 + radius * Math.cos(index * angleStep);
            node.y = height / 2 + radius * Math.sin(index * angleStep);
        });
    }
}

/* Drag Functions - Move nodes */
function dragStarted(event, d, simulation, thisNode) {
    d.previousFill = d3.select(thisNode).attr("fill");
    d3.select(thisNode).attr('fill', dragNodeColor);
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d, thisNode) {
    d3.select(thisNode).attr('fill', dragNodeColor);
    document.body.style.cursor = 'grabbing';
    d.fx = event.x;
    d.fy = event.y;
}

function dragEnded(event, d, simulation, thisNode, treej) {
    d3.select(thisNode).attr("fill", d.previousFill);
    document.body.style.cursor = 'default';
    simulation.alphaDecay(1);
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}
/* End of Drag Functions */

function handleEdgeMouseOver(pathElement, edgeHoverColor, directed, svgElement) {
    d3.select(pathElement).attr('stroke', edgeHoverColor);

    if (directed) {
        const markerUrl = d3.select(pathElement).attr('marker-end');
        const match = markerUrl?.match(/url\(#([^)]+)\)/);
        if (match) {
            d3.select(svgElement)
                .select(`#${match[1]}`)
                .select('path')
                .attr('fill', edgeHoverColor);
        }
    }
}

function handleEdgeMouseOut(pathElement, edgeColor, directed, svgElement) {
    d3.select(pathElement).attr('stroke', edgeColor);

    if (directed) {
        const markerUrl = d3.select(pathElement).attr('marker-end');
        const match = markerUrl?.match(/url\(#([^)]+)\)/);
        if (match) {
            d3.select(svgElement)
                .select(`#${match[1]}`)
                .select('path')
                .attr('fill', edgeColor);
        }
    }
}

// Helper to add an item to a floating menu. Usable anywhere a FloatingMenu instance exists, so it is defined globally instead of being scoped to a single function.
function addMenuItem(menuElement, menu, label, title, onClick) {
    const item = document.createElement('button');
    item.textContent = label;
    if (title) item.title = title;
    item.addEventListener('click', (event) => {
        onClick(event);
        menu.hide();
    });
    menuElement.appendChild(item);
    return item;
}

function removeMenuItem(menuElement, label) {
    const items = menuElement.querySelectorAll('button');
    for (const item of items) {
        if (item.textContent === label) {
            item.remove();
            return true; // Item found and removed
        }
    }
    return false; // No matching item found
}

function showEdgeContextMenu(event, d, svg, edgeLabel, edges, edgesRaw, node, label, directed, weighted, arrowId, link, link2, updateStatistics) {
    event.preventDefault();
    event.stopPropagation();

    const menuElement = document.createElement('div');
    menuElement.className = 'floating-menu';
    document.body.appendChild(menuElement);
    const menu = new FloatingMenu(menuElement);

    addMenuItem(menuElement, menu, 'Delete this edge', null, () => {
        const idx = edges.indexOf(d);
        if (idx !== -1) {
            edges.splice(idx, 1);
            edgesRaw.splice(idx, 1);
        }
        // Remove from raw edges as well if needed
        const rawIdx = edgesRaw.indexOf(d);
        if (rawIdx !== -1) {
            edgesRaw.splice(rawIdx, 1);
        }

        svg.selectAll('.link').filter(e => e === d).remove();
        if (edgeLabel) edgeLabel.filter(e => e === d).remove();
        svg.selectAll('.link2').filter(e => e === d).remove();

        if (d.bidirectional) {
            const reverse = edges.find(e =>
                (e.source.id || e.source) === (d.target.id || d.target) &&
                (e.target.id || e.target) === (d.source.id || d.source)
            );
            if (reverse) {
                reverse.bidirectional = false;
                d.bidirectional = false;
            }
        }

        setEdgePositions(link, edgeLabel, node, label, directed, weighted, svg, arrowId);
        setEdgePositions(link2, edgeLabel, node, label, directed, weighted, svg, arrowId);
        if (updateStatistics) {
            updateStatistics();
        }
    });

    if (weighted) {
        addMenuItem(menuElement, menu, 'Change edge weight', null, () => {
            let newWeight = parseFloat(prompt('Enter new weight for this edge:', d.weight));
            if (newWeight == null || isNaN(newWeight)) {
                alert('Weight must be a valid number.');
            } else {
                d.weight = newWeight;
                if (edgeLabel) edgeLabel.filter(e => e === d).text(newWeight);
                const raw = edgesRaw.find(e =>
                    e.source === (d.source.id || d.source) &&
                    e.target === (d.target.id || d.target)
                );
                if (raw) raw.weight = newWeight;
            }
        });
    }

    menu.show(event);
}

function removeSelectElement(methodsSelect, name) {
    for (const option of methodsSelect.options) {
        if (option.text === name || option.value === name) {
            option.remove();
            return true;
        }
    }
    return false;
}

function addGraph(edgesInput = null, nodes = null, inputName = null, directed = null, weighted = null, isTreeType = null) { // Core function will all functionalities
    // Graph value details
    let edgesInputValue = document.getElementById('edges').value;
    edgesInput = edgesInput === null ? edgesInputValue.toUpperCase() : edgesInput; // Use the provided edgesInput or the value from the input field
    directed = directed ?? isDirected.checked;
    weighted = weighted ?? isWeighted.checked;

    if (isTreeType === true) {
        // directed = false; // Can be modified for directed, weighted trees in the future
        weighted = false;
        if (!isTree(edgesInput)) {
            alert("Invalid edges for a tree");
            return;
        }
    } else if (isTreeType === null) {
        if (isTypeTree.checked) {
            isTreeType = true;
            // directed = false; // Can be modified for directed, weighted trees in the future
            weighted = false;
            if (!isTree(edgesInput)) {
                alert("Invalid edges for a tree");
                return;
            }
        }
    }

    // Common arrow head ID for this graph
    const arrowId = `arrowHead${graphCount}`; // Creating separate arrow heads for each graph, while also grouping the similar ones
    graphCount++;

    // Graph name details
    if (inputName === null) {
        inputName = document.getElementById('graphName').value;
    }
    let displayName;
    if (!isTreeType) {
        displayName = inputName.trim() ? inputName.trim() : `Graph`; // Give a default name if the name field is empty
    } else {
        displayName = inputName.trim() ? inputName.trim() : `Tree`;
    }
    let baseName = displayName;

    let counter = 1;
    while (availableGraphs.has(displayName)) {
        displayName = `${baseName}.${String(counter).padStart(3, '0')}`;
        counter++;
    }
    availableGraphs.add(displayName); // Add the graph to the list of available graphs
    const titleName = displayName.length > 10 ? displayName.substring(0, 7) + '...' : displayName;

    const graphData = [edgesInput, directed, weighted];
    graphMap.set(displayName, graphData);

    // container is the graph window, and it contains the graph and svg functionalities.
    const container = document.createElement('div');
    document.body.appendChild(container); // Append the container initially to calculate child properties
    container.className = 'graphContainer';

    // Container that is interacted with will have the highest z-index
    container.addEventListener('mousedown', () => {
        focusOnThisContainer(container);
    });
    // Create the resize handles for the container
    const resizeHandleElements = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
    resizeHandleElements.forEach(corner => {
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        handle.classList.add(corner);
        handle.setAttribute('data-corner', corner);
        container.appendChild(handle);
    });

    /* Content of container */
    // Create the graphHeader div - contains the graph name, show grid checkbox, auto-rearrange radius input, and auto-rearrange button, and close button (The entire window functionality)
    const graphHeader = document.createElement('div');
    graphHeader.className = 'graphHeader';

    /* Graph Header content */
    // Create the span element - contains the graph name, show grid checkbox, and Rearrange button
    const headerSpan = document.createElement('span');

    /* Header span content */
    // Create a new span for the graph name
    const graphNameSpan = document.createElement('span');
    graphNameSpan.style.fontWeight = 'bold';
    graphNameSpan.style.cursor = 'default';
    graphNameSpan.textContent = titleName;
    graphNameSpan.title = displayName; // Add title attribute to display full name on hover
    graphNameSpan.id = `${displayName}span`;
    headerSpan.appendChild(graphNameSpan);

    // Create the "Show grid" checkbox
    const gridCheckbox = document.createElement('input');
    gridCheckbox.type = 'checkbox';
    gridCheckbox.title = 'Show/Hide grid';
    gridCheckbox.checked = true;
    headerSpan.appendChild(gridCheckbox);
    headerSpan.appendChild(document.createTextNode('Grid'));

    // Create a div for the rearrange nodes and applicable methods
    const operationPanel = document.createElement('div');
    operationPanel.className = 'operation-panel';

    headerSpan.appendChild(operationPanel);

    // Input Validation - Parse edges
    let edges = parseEdges(edgesInput, directed);
    let edgesRaw = parseEdges(edgesInput, directed);
    if (edges.length === 0) {
        return;
    }
    const applicableAlgorithms = filterAlgorithms(algorithms, directed, weighted);

    /* Available methods */
    const methodsSelect = document.createElement('select');
    methodsSelect.className = 'methodsSelect';

    // Placeholder option
    const placeholder = document.createElement('option');
    placeholder.textContent = 'Available Methods';
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    methodsSelect.appendChild(placeholder);

    // Add algorithm options
    applicableAlgorithms.forEach(algorithm => {
        const option = document.createElement('option');
        option.value = algorithm.name;
        option.textContent = algorithm.text;
        option.title = algorithm.title;
        option.dataset.algorithm = algorithm.name;
        methodsSelect.appendChild(option);
    });

    if (isTreeType) {
        function bstValue(node) {
            return Number(String(node.id).replace(/_\d+$/, ''));
        }

        function insertBST() {
            if (!isBSTJSON(convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed)).valid) {
                alert("This structure is not a BST.");
                return;
            }
            value = prompt("Enter numeric value to insert:");
            if (!value) return; // User cancelled or entered empty string

            const numericVal = Number(value);
            if (Number.isNaN(numericVal)) {
                alert("BST nodes must be numeric.");
                return;
            }

            let baseVertex = String(numericVal);
            let uniqueId = baseVertex;
            let counter = 1;

            while (nodes.some(node => node.id === uniqueId)) {
                uniqueId = `${baseVertex}_${counter++}`;
            }

            let newX, newY;
            let parentNode = null;

            if (nodes.length === 0) {
                // First node (Root) - place near the top center of the SVG
                const svgRect = svg.node().getBoundingClientRect();
                newX = svgRect.width / 2 || 400;
                newY = 50;
            } else {
                // Find the root (a node with no incoming edges)
                const targetIds = new Set(edgesRaw.map(e => String(e.target)));
                let curr = nodes.find(n => !targetIds.has(String(n.id)));
                if (!curr) curr = nodes[0]; // Fallback just in case

                let depth = 1;

                // Traverse the tree to find the correct parent
                while (curr) {
                    parentNode = curr;
                    const currVal = bstValue(curr);

                    // Get children of the current node
                    const childrenEdges = edgesRaw.filter(e => String(e.source) === String(curr.id));
                    const childrenNodes = childrenEdges.map(e => nodes.find(n => String(n.id) === String(e.target)));

                    if (numericVal < currVal) {
                        curr = childrenNodes.find(c => bstValue(c) < currVal); // Move left
                    } else {
                        curr = childrenNodes.find(c => bstValue(c) > currVal); // Move right
                    }

                    if (curr) depth++;
                }

                // Calculate visual coordinates for the new node
                const dy = 70; // Fixed vertical spacing
                // Horizontal spacing decreases as depth increases to prevent branch overlap
                const dx = Math.max(30, 200 / Math.pow(1.4, depth));

                newY = parentNode.y + dy;
                newX = numericVal < bstValue(parentNode) ? parentNode.x - dx : parentNode.x + dx;
            }

            // Create and push the new node (id only, matching addVertex - no separate label)
            const newNodeObj = { id: uniqueId, x: newX, y: newY, vx: 0, vy: 0 };
            nodes.push(newNodeObj);

            // Create and push the edges (if it has a parent)
            if (parentNode) {
                let weight = 1;
                if (weighted) {
                    weight = prompt("Enter edge weight", "1");
                    weight = (weight === null || weight.trim() === "") ? 1 : Number(weight);
                }
                edges.push({ source: parentNode, target: newNodeObj, weight });
                edgesRaw.push({ source: parentNode.id, target: uniqueId, weight });

                // Update visual links
                link = edgeLayer.selectAll('.link')
                    .data(edges)
                    .join(
                        enter => enter.append('path')
                            .attr('class', 'link')
                            .attr('source-id', d => `${arrowId}${d.source.id}`)
                            .attr('target-id', d => `${arrowId}${d.target.id}`)
                            .attr('fill', 'none')
                            .attr('stroke', edgeColor)
                            .attr('stroke-width', 4)
                            .on('mouseover', function () { handleEdgeMouseOver(this, edgeHoverColor, directed, svgElement); })
                            .on('mouseout', function () { handleEdgeMouseOut(this, edgeColor, directed, svgElement); })
                            .on('contextmenu', function (event, d) { showEdgeContextMenu(event, d, svg, edgeLabel, edges, edgesRaw, node, label, directed, weighted, arrowId, link, link2, updateStatistics); }),
                        update => update,
                        exit => exit.remove()
                    );

                link2 = edgeBufferLayer.selectAll('.link2')
                    .data(edges)
                    .join(
                        enter => enter.append('path')
                            .attr('class', 'link2')
                            .attr('fill', 'none')
                            .attr('stroke', 'transparent')
                            .attr('stroke-width', 20)
                            .style('pointer-events', 'stroke')
                            .on('mouseover', function (event, d) {
                                d3.select(`.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`).dispatch('mouseover');
                            })
                            .on('mouseout', function (event, d) {
                                d3.select(`.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`).dispatch('mouseout');
                            })
                            .on('contextmenu', function (event, d) {
                                d3.select(`.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`)
                                    .node().dispatchEvent(new MouseEvent('contextmenu', { bubbles: false, cancelable: true, clientX: event.clientX, clientY: event.clientY, view: window }));
                            }),
                        update => update,
                        exit => exit.remove()
                    );

                if (weighted) {
                    edgeLabel = labelLayer.selectAll('.edge-label')
                        .data(edges)
                        .join(
                            enter => enter.append('text').attr('class', 'edge-label').text(d => d.weight),
                            update => update.text(d => d.weight),
                            exit => exit.remove()
                        );
                }
            }

            // Update visual nodes
            let nodeSelection = nodeLayer.selectAll('rect')
                .data(nodes, d => d.id);

            let nodeEnter = nodeSelection.enter()
                .append("rect")
                .attr('class', 'node')
                .attr('fill', nodeColor)
                .attr('stroke', primaryBG)
                .call(sizeNodeRect)
                .call(positionNode)
                .call(
                    d3.drag()
                        .on('start', function (event, d) { dragStarted(event, d, simulation, this); })
                        .on('drag', function (event, d) { dragged(event, d, this); })
                        .on('end', function (event, d) { dragEnded(event, d, simulation, this, convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed)); updateStatistics(); })
                )
                .on('contextmenu', function (event, d) {
                    event.preventDefault();
                    event.stopPropagation();
                });

            nodeSelection.exit().remove();
            node = nodeEnter.merge(nodeSelection);

            // Update visual labels (falls back to id since no separate label field)
            let labelSelection = labelLayer.selectAll('.node-label')
                .data(nodes, d => d.id);

            let labelEnter = labelSelection.enter()
                .append('text')
                .attr('x', d => d.x)
                .attr('y', d => d.y)
                .attr('dy', 7)
                .attr('text-anchor', 'middle')
                .text(d => d.label !== undefined ? d.label : d.id)
                .attr('class', 'node-label')
                .style('pointer-events', 'none')
                .style('font-weight', 'bold');

            label = labelEnter.merge(labelSelection);

            // Apply final positioning mapping
            setEdgePositions(link, edgeLabel, node, label, directed, weighted, svg, arrowId);
            setEdgePositions(link2, edgeLabel, node, label, directed, weighted, svg, arrowId);
            adjustViewBox(svg, nodes, grid);
        }

        function deleteBST() {
            if (!isBSTJSON(convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed)).valid) {
                alert("This structure is not a BST.");
                return;
            }

            value = prompt("Enter numeric value to delete:");
            if (!value) return; // User cancelled or entered empty string

            const numericVal = Number(value);
            if (Number.isNaN(numericVal)) {
                alert("BST nodes must be numeric.");
                return;
            }

            if (nodes.length === 0) {
                alert("The tree is empty.");
                return;
            }

            // Find the root (a node with no incoming edges)
            const targetIds = new Set(edgesRaw.map(e => String(e.target)));
            let root = nodes.find(n => !targetIds.has(String(n.id)));
            if (!root) root = nodes[0]; // Fallback just in case

            // Helper: get the children of a node (by object reference)
            const getChildren = (n) => {
                const childEdges = edgesRaw.filter(e => String(e.source) === String(n.id));
                return childEdges
                    .map(e => nodes.find(node => String(node.id) === String(e.target)))
                    .filter(Boolean);
            };

            // Traverse the tree to find the node to delete
            let curr = root;
            while (curr && bstValue(curr) !== numericVal) {
                const currVal = bstValue(curr);
                const childrenNodes = getChildren(curr);

                curr = numericVal < currVal
                    ? childrenNodes.find(c => bstValue(c) < currVal)   // Move left
                    : childrenNodes.find(c => bstValue(c) > currVal);  // Move right
            }

            if (!curr) {
                alert("Value not found in tree.");
                return;
            }

            let target = curr; // The node object we'll ultimately splice out of the tree
            let children = getChildren(target);

            if (children.length === 2) {
                let successor = children.find(c => bstValue(c) > bstValue(target));

                while (true) {
                    const leftChild = getChildren(successor).find(c => bstValue(c) < bstValue(successor));
                    if (!leftChild) break;
                    successor = leftChild;
                }

                const oldTargetId = target.id;
                target.id = successor.id;

                edgesRaw.forEach(e => {
                    if (String(e.source) === String(oldTargetId)) e.source = target.id;
                    if (String(e.target) === String(oldTargetId)) e.target = target.id;
                });
                target = successor;
                children = getChildren(target);
            }

            // `target` now has 0 or 1 children - splice it out
            const parentEdgeRaw = edgesRaw.find(e => String(e.target) === String(target.id));
            const child = children[0]; // undefined if target is a leaf

            if (child) {
                // One child: reconnect parent directly to that child
                if (parentEdgeRaw) parentEdgeRaw.target = child.id;

                const parentEdgeObj = edges.find(e => e.target === target);
                if (parentEdgeObj) parentEdgeObj.target = child;
            } else if (parentEdgeRaw) {
                // Leaf: just drop the incoming edge
                edgesRaw.splice(edgesRaw.indexOf(parentEdgeRaw), 1);

                const parentEdgeObj = edges.find(e => e.target === target);
                if (parentEdgeObj) edges.splice(edges.indexOf(parentEdgeObj), 1);
            }

            nodes.splice(nodes.indexOf(target), 1);

            // Redraw edges
            link = edgeLayer.selectAll('.link')
                .data(edges)
                .join(
                    enter => enter.append('path')
                        .attr('class', 'link')
                        .attr('source-id', d => `${arrowId}${d.source.id}`)
                        .attr('target-id', d => `${arrowId}${d.target.id}`)
                        .attr('fill', 'none')
                        .attr('stroke', edgeColor)
                        .attr('stroke-width', 4)
                        .on('mouseover', function () { handleEdgeMouseOver(this, edgeHoverColor, directed, svgElement); })
                        .on('mouseout', function () { handleEdgeMouseOut(this, edgeColor, directed, svgElement); })
                        .on('contextmenu', function (event, d) { showEdgeContextMenu(event, d, svg, edgeLabel, edges, edgesRaw, node, label, directed, weighted, arrowId, link, link2, updateStatistics); }),
                    update => update
                        .attr('source-id', d => `${arrowId}${d.source.id}`)
                        .attr('target-id', d => `${arrowId}${d.target.id}`),
                    exit => exit.remove()
                );

            link2 = edgeBufferLayer.selectAll('.link2')
                .data(edges)
                .join(
                    enter => enter.append('path')
                        .attr('class', 'link2')
                        .attr('fill', 'none')
                        .attr('stroke', 'transparent')
                        .attr('stroke-width', 20)
                        .style('pointer-events', 'stroke')
                        .on('mouseover', function (event, d) {
                            d3.select(`.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`).dispatch('mouseover');
                        })
                        .on('mouseout', function (event, d) {
                            d3.select(`.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`).dispatch('mouseout');
                        })
                        .on('contextmenu', function (event, d) {
                            d3.select(`.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`)
                                .node().dispatchEvent(new MouseEvent('contextmenu', { bubbles: false, cancelable: true, clientX: event.clientX, clientY: event.clientY, view: window }));
                        }),
                    update => update,
                    exit => exit.remove()
                );

            if (weighted) {
                edgeLabel = labelLayer.selectAll('.edge-label')
                    .data(edges)
                    .join(
                        enter => enter.append('text').attr('class', 'edge-label').text(d => d.weight),
                        update => update.text(d => d.weight),
                        exit => exit.remove()
                    );
            }

            // Redraw nodes
            let nodeSelection = nodeLayer.selectAll('rect')
                .data(nodes, d => d.id);

            let nodeEnter = nodeSelection.enter()
                .append("rect")
                .attr('class', 'node')
                .attr('fill', nodeColor)
                .attr('stroke', primaryBG)
                .call(sizeNodeRect)
                .call(positionNode)
                .call(
                    d3.drag()
                        .on('start', function (event, d) { dragStarted(event, d, simulation, this); })
                        .on('drag', function (event, d) { dragged(event, d, this); })
                        .on('end', function (event, d) { dragEnded(event, d, simulation, this, convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed)); updateStatistics(); })
                )
                .on('contextmenu', function (event, d) {
                    event.preventDefault();
                    event.stopPropagation();
                });

            nodeSelection.exit().remove();
            node = nodeEnter.merge(nodeSelection);

            let labelSelection = labelLayer.selectAll('.node-label')
                .data(nodes, d => d.id);

            labelSelection.exit().remove();

            let labelEnter = labelSelection.enter()
                .append('text')
                .attr('x', d => d.x)
                .attr('y', d => d.y)
                .attr('dy', 7)
                .attr('text-anchor', 'middle')
                .text(d => d.label !== undefined ? d.label : d.id)
                .attr('class', 'node-label')
                .style('pointer-events', 'none')
                .style('font-weight', 'bold');

            label = labelEnter.merge(labelSelection)
                .text(d => d.label !== undefined ? d.label : d.id);

            // Apply final positioning mapping
            setEdgePositions(link, edgeLabel, node, label, directed, weighted, svg, arrowId);
            setEdgePositions(link2, edgeLabel, node, label, directed, weighted, svg, arrowId);
            adjustViewBox(svg, nodes, grid);
        }

        function balanceAVL() {
            const treeJSON = convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed);

            if (isAVLJSON(treeJSON).valid) {
                return;
            }
            if (!isBSTJSON(treeJSON).valid) {
                alert("This structure is not a BST - AVL balancing is impossible.");
                return;
            }

            if (nodes.length === 0) return;

            function getChildren(nodeId) {
                return edgesRaw.filter(e => String(e.source) === String(nodeId)).map(e => String(e.target));
            }
            function getLeftChild(nodeId) {
                return getChildren(nodeId).find(id => Number(id) < Number(nodeId)) || null;
            }
            function getRightChild(nodeId) {
                return getChildren(nodeId).find(id => Number(id) > Number(nodeId)) || null;
            }

            const targetIds = new Set(edgesRaw.map(e => String(e.target)));
            const rootId = nodes.map(n => String(n.id)).find(id => !targetIds.has(id));
            if (!rootId) return;

            const sortedIds = [];
            function inorder(nodeId) {
                if (!nodeId) return;
                inorder(getLeftChild(nodeId));
                sortedIds.push(nodeId);
                inorder(getRightChild(nodeId));
            }
            inorder(rootId);

            const defaultWeight = 1;
            const newEdges = [];
            function buildBalanced(idsArr) {
                if (idsArr.length === 0) return null;

                const midIndex = Math.floor(idsArr.length / 2);
                const subtreeRootId = idsArr[midIndex];

                const leftRootId = buildBalanced(idsArr.slice(0, midIndex));
                const rightRootId = buildBalanced(idsArr.slice(midIndex + 1));

                if (leftRootId) newEdges.push({ source: subtreeRootId, target: leftRootId, weight: defaultWeight });
                if (rightRootId) newEdges.push({ source: subtreeRootId, target: rightRootId, weight: defaultWeight });

                return subtreeRootId;
            }
            buildBalanced(sortedIds);

            edgesRaw = newEdges;

            edgesRaw.sort((a, b) => {
                if (String(a.source) === String(b.source)) {
                    return Number(a.target) - Number(b.target);
                }
                return 0;
            });

            // Get SVG dimensions dynamically
            const svgRect = svg.node().getBoundingClientRect();
            const width = svgRect.width || 800;
            const height = svgRect.height || 600;

            autoLayoutNodes(nodes, simulation, width, height, edgesRaw, true);
            adjustViewBox(svg, nodes, grid);

            // Rebuild D3 edges to mirror the rebalanced tree
            edges.length = 0;
            edgesRaw.forEach(er => {
                const srcNode = nodes.find(n => String(n.id) === String(er.source));
                const tgtNode = nodes.find(n => String(n.id) === String(er.target));
                if (srcNode && tgtNode) {
                    edges.push({ source: srcNode, target: tgtNode, weight: er.weight });
                }
            });

            // Update Links
            link = edgeLayer.selectAll('.link')
                .data(edges, d => `${d.source.id}-${d.target.id}`)
                .join(
                    enter => enter.append('path')
                        .attr('class', 'link')
                        .attr('source-id', d => `${arrowId}${d.source.id}`)
                        .attr('target-id', d => `${arrowId}${d.target.id}`)
                        .attr('fill', 'none')
                        .attr('stroke', edgeColor)
                        .attr('stroke-width', 4),
                    update => update
                        .attr('source-id', d => `${arrowId}${d.source.id}`)
                        .attr('target-id', d => `${arrowId}${d.target.id}`),
                    exit => exit.remove()
                );

            // Update Link Buffers
            link2 = edgeBufferLayer.selectAll('.link2')
                .data(edges, d => `${d.source.id}-${d.target.id}`)
                .join(
                    enter => enter.append('path')
                        .attr('class', 'link2')
                        .attr('fill', 'none')
                        .attr('stroke', 'transparent')
                        .attr('stroke-width', 20)
                        .style('pointer-events', 'stroke'),
                    update => update,
                    exit => exit.remove()
                );

            if (typeof weighted !== 'undefined' && weighted) {
                edgeLabel = labelLayer.selectAll('.edge-label')
                    .data(edges, d => `${d.source.id}-${d.target.id}`)
                    .join(
                        enter => enter.append('text').attr('class', 'edge-label').text(d => d.weight),
                        update => update.text(d => d.weight),
                        exit => exit.remove()
                    );
            }

            // Update Nodes
            let nodeSelection = nodeLayer.selectAll('rect').data(nodes, d => d.id);
            let nodeEnter = nodeSelection.enter()
                .append('rect')
                .attr('class', 'node')
                .attr('fill', nodeColor)
                .attr('stroke', primaryBG)
                .call(sizeNodeRect)
                .call(d3.drag().on('start', dragStarted).on('drag', dragged).on('end', dragEnded));

            nodeSelection.exit().remove();
            node = nodeEnter.merge(nodeSelection)
                .transition().duration(500)
                .call(positionNode);

            node = nodeLayer.selectAll('rect');

            // Update Node Labels
            let labelSelection = labelLayer.selectAll('.node-label').data(nodes, d => d.id);
            let labelEnter = labelSelection.enter()
                .append('text')
                .attr('dy', 7)
                .attr('text-anchor', 'middle')
                .text(d => d.label !== undefined ? d.label : d.id)
                .attr('class', 'node-label')
                .style('pointer-events', 'none')
                .style('font-weight', 'bold');

            labelSelection.exit().remove();
            label = labelEnter.merge(labelSelection);
            label.transition().duration(500)
                .attr('x', d => d.x)
                .attr('y', d => d.y);

            // After transition, snap edges seamlessly
            setTimeout(() => {
                setEdgePositions(link, edgeLabel, node, label, directed, weighted, svg, arrowId);
                if (link2) setEdgePositions(link2, edgeLabel, node, label, directed, weighted, svg, arrowId);
            }, 500);
            updateStatistics();
        };

        // --- shared helpers: parsing / model construction ------------------------

        // Nodes are labeled/identified exactly as parsed elsewhere in the app:
        // a bracket-notation key list like "[10,20]" (a single-key node like "[5]"
        // or a bare "5" both work too).
        function parseKeyList(idOrLabel) {
            const s = String(idOrLabel).trim();
            const inner = (s.startsWith('[') && s.endsWith(']')) ? s.slice(1, -1) : s;
            if (inner === '') return [];
            return inner.split(',').map(v => Number(v.trim()));
        }

        // Rebuilds the { keys, children, leaf, domNode } model this file operates
        // on from whatever's currently on the canvas, so the real insert-and-split
        // algorithm can run against it. `edgesList` lets callers pass a filtered
        // edge list (see filterTreeEdgesOnly) when the canvas also contains
        // non-hierarchy edges, like a B+-tree's leaf-sibling chain.
        function buildBTreeModel(nodesList, edgesList) {
            if (nodesList.length === 0) return null;

            const targetIds = new Set(edgesList.map(e => String(e.target)));
            const rootDomNode = nodesList.find(n => !targetIds.has(String(n.id))) || nodesList[0];
            const nodeById = new Map(nodesList.map(n => [String(n.id), n]));

            function build(domNode) {
                const keys = parseKeyList(domNode.id);
                const childDomNodes = edgesList
                    .filter(e => String(e.source) === String(domNode.id))
                    .map(e => nodeById.get(String(e.target)))
                    .filter(Boolean)
                    .sort((a, b) => a.x - b.x); // left-to-right by canvas position

                const children = childDomNodes.map(build);
                return { keys, children, leaf: children.length === 0, domNode };
            }

            return build(rootDomNode);
        }

        function modelHasKey(model, key) {
            if (!model) return false;
            if (model.keys.includes(key)) return true;
            return model.children.some(c => modelHasKey(c, key));
        }

        // A B+-tree's leaf-sibling chain shows up on the canvas as plain edges
        // alongside the real parent/child ones, with nothing in the data marking
        // which is which. They're recovered the same way isTree's bPlus mode does
        // it: a branching (internal) node always has >= 2 children in a valid
        // B/B+ tree, so any edge whose source has out-degree >= 2 must be a real
        // hierarchy edge; a leaf can only ever emit its optional "next" pointer,
        // so out-degree <= 1 sources are chain edges.
        function filterTreeEdgesOnly(edgesList) {
            const outDegree = new Map();
            edgesList.forEach(e => {
                const s = String(e.source);
                outDegree.set(s, (outDegree.get(s) || 0) + 1);
            });
            return edgesList.filter(e => (outDegree.get(String(e.source)) || 0) >= 2);
        }

        function insertKeySorted(keys, key) {
            let i = keys.length - 1;
            while (i >= 0 && keys[i] > key) i--;
            keys.splice(i + 1, 0, key);
        }

        // --- B-tree insert-and-split (real data keys, removed on promotion) ------

        function bTreeModelInsert(node, key, order) {
            const maxKeys = order - 1;

            if (node.leaf) {
                insertKeySorted(node.keys, key);
            } else {
                let i = 0;
                while (i < node.keys.length && key > node.keys[i]) i++;
                const result = bTreeModelInsert(node.children[i], key, order);
                if (result) {
                    node.keys.splice(i, 0, result.promotedKey);
                    node.children.splice(i + 1, 0, result.newRightNode);
                }
            }

            if (node.keys.length > maxKeys) {
                return splitBTreeModelNode(node);
            }
            return null;
        }

        function splitBTreeModelNode(node) {
            const mid = Math.floor(node.keys.length / 2);
            const promotedKey = node.keys[mid];

            const leftKeys = node.keys.slice(0, mid);
            const rightKeys = node.keys.slice(mid + 1);

            let leftChildren = [];
            let rightChildren = [];
            if (!node.leaf) {
                leftChildren = node.children.slice(0, mid + 1);
                rightChildren = node.children.slice(mid + 1);
            }

            node.keys = leftKeys;
            node.children = leftChildren;
            // node.domNode (and its x/y) stays with the left half — this keeps
            // whichever original canvas node it was in place instead of jumping.

            const newRightNode = { keys: rightKeys, children: rightChildren, leaf: node.leaf, domNode: null };
            return { promotedKey, newRightNode };
        }

        // --- B+-tree insert-and-split (leaf split promotes a COPY) ---------------

        function bPlusModelInsert(node, key, order) {
            const maxKeys = order - 1;

            if (node.leaf) {
                insertKeySorted(node.keys, key);
                if (node.keys.length > maxKeys) {
                    return splitBPlusModelLeaf(node);
                }
                return null;
            }

            let i = 0;
            while (i < node.keys.length && key >= node.keys[i]) i++;
            const result = bPlusModelInsert(node.children[i], key, order);
            if (result) {
                node.keys.splice(i, 0, result.promotedKey);
                node.children.splice(i + 1, 0, result.newRightNode);
            }

            if (node.keys.length > maxKeys) {
                return splitBTreeModelNode(node); // internal nodes split like a plain B-tree
            }
            return null;
        }

        function splitBPlusModelLeaf(leaf) {
            const mid = Math.floor(leaf.keys.length / 2);
            const rightKeys = leaf.keys.slice(mid);
            leaf.keys = leaf.keys.slice(0, mid);

            const newRightLeaf = { keys: rightKeys, children: [], leaf: true, domNode: null };
            // The leaf-sibling chain is rebuilt from scratch after the whole
            // insert finishes (see insertBPlus), so no .next bookkeeping here.
            return { promotedKey: rightKeys[0], newRightNode: newRightLeaf };
        }

        // --- turning the (possibly restructured) model back into canvas state ----

        // Walks the model left-to-right, relabels/creates the corresponding canvas
        // node for each tree node (mutating an existing node's `.id` in place
        // whenever possible, which keeps its position and D3 binding stable —
        // only genuinely new nodes from a split get a fresh object), and emits the
        // parent/child edges. `leafIdsInOrder`, if passed, collects leaf ids in
        // left-to-right order for the caller to chain into a B+-tree sibling list.
        function finalizeBTreeModel(model, edgesOut, leafIdsInOrder, usedIds) {
            usedIds = usedIds || new Set();
            let label = model.keys.join(',');
            let uniqueId = label;
            let counter = 1;
            while (usedIds.has(uniqueId)) uniqueId = `${label}_${counter++}`;
            usedIds.add(uniqueId);

            let domNode = model.domNode;
            if (domNode) {
                domNode.id = uniqueId; // mutate in place: preserves position + D3 identity
            } else {
                const svgRect = svg.node().getBoundingClientRect();
                domNode = { id: uniqueId, x: (svgRect.width / 2) || 400, y: 50, vx: 0, vy: 0 };
                nodes.push(domNode);
            }

            if (model.children.length === 0) {
                if (leafIdsInOrder) leafIdsInOrder.push(uniqueId);
                return uniqueId;
            }

            for (const child of model.children) {
                const childId = finalizeBTreeModel(child, edgesOut, leafIdsInOrder, usedIds);
                edgesOut.push({ source: uniqueId, target: childId, weight: 1 });
            }

            return uniqueId;
        }

        // --- shared canvas rebuild/rebind, mirroring balanceAVL's tail section ---

        function rebuildGraphAfterTreeEdit() {
            edges.length = 0;
            edgesRaw.forEach(er => {
                const srcNode = nodes.find(n => String(n.id) === String(er.source));
                const tgtNode = nodes.find(n => String(n.id) === String(er.target));
                if (srcNode && tgtNode) {
                    edges.push({ source: srcNode, target: tgtNode, weight: er.weight });
                }
            });

            const svgRect = svg.node().getBoundingClientRect();
            const width = svgRect.width || 800;
            const height = svgRect.height || 600;

            autoLayoutNodes(nodes, simulation, width, height, edgesRaw, true);
            adjustViewBox(svg, nodes, grid);

            link = edgeLayer.selectAll('.link')
                .data(edges, d => `${d.source.id}-${d.target.id}`)
                .join(
                    enter => enter.append('path')
                        .attr('class', 'link')
                        .attr('source-id', d => `${arrowId}${d.source.id}`)
                        .attr('target-id', d => `${arrowId}${d.target.id}`)
                        .attr('fill', 'none')
                        .attr('stroke', edgeColor)
                        .attr('stroke-width', 4)
                        .on('mouseover', function () { handleEdgeMouseOver(this, edgeHoverColor, directed, svgElement); })
                        .on('mouseout', function () { handleEdgeMouseOut(this, edgeColor, directed, svgElement); })
                        .on('contextmenu', function (event, d) { showEdgeContextMenu(event, d, svg, edgeLabel, edges, edgesRaw, node, label, directed, weighted, arrowId, link, link2, updateStatistics); }),
                    update => update
                        .attr('source-id', d => `${arrowId}${d.source.id}`)
                        .attr('target-id', d => `${arrowId}${d.target.id}`),
                    exit => exit.remove()
                );

            link2 = edgeBufferLayer.selectAll('.link2')
                .data(edges, d => `${d.source.id}-${d.target.id}`)
                .join(
                    enter => enter.append('path')
                        .attr('class', 'link2')
                        .attr('fill', 'none')
                        .attr('stroke', 'transparent')
                        .attr('stroke-width', 20)
                        .style('pointer-events', 'stroke')
                        .on('mouseover', function (event, d) {
                            d3.select(`.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`).dispatch('mouseover');
                        })
                        .on('mouseout', function (event, d) {
                            d3.select(`.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`).dispatch('mouseout');
                        })
                        .on('contextmenu', function (event, d) {
                            d3.select(`.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`)
                                .node().dispatchEvent(new MouseEvent('contextmenu', { bubbles: false, cancelable: true, clientX: event.clientX, clientY: event.clientY, view: window }));
                        }),
                    update => update,
                    exit => exit.remove()
                );

            if (typeof weighted !== 'undefined' && weighted) {
                edgeLabel = labelLayer.selectAll('.edge-label')
                    .data(edges, d => `${d.source.id}-${d.target.id}`)
                    .join(
                        enter => enter.append('text').attr('class', 'edge-label').text(d => d.weight),
                        update => update.text(d => d.weight),
                        exit => exit.remove()
                    );
            }

            let nodeSelection = nodeLayer.selectAll('rect').data(nodes, d => d.id);
            let nodeEnter = nodeSelection.enter()
                .append('rect')
                .attr('class', 'node')
                .attr('fill', nodeColor)
                .attr('stroke', primaryBG)
                .call(sizeNodeRect)
                .call(positionNode)
                .call(
                    d3.drag()
                        .on('start', function (event, d) { dragStarted(event, d, simulation, this); })
                        .on('drag', function (event, d) { dragged(event, d, this); })
                        .on('end', function (event, d) { dragEnded(event, d, simulation, this, convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed)); updateStatistics(); })
                )
                .on('contextmenu', function (event, d) {
                    event.preventDefault();
                    event.stopPropagation();
                });

            nodeSelection.exit().remove();
            node = nodeEnter.merge(nodeSelection)
                .transition().duration(500)
                .call(positionNode);

            node = nodeLayer.selectAll('rect');

            let labelSelection = labelLayer.selectAll('.node-label').data(nodes, d => d.id);
            let labelEnter = labelSelection.enter()
                .append('text')
                .attr('dy', 7)
                .attr('text-anchor', 'middle')
                .text(d => d.label !== undefined ? d.label : d.id)
                .attr('class', 'node-label')
                .style('pointer-events', 'none')
                .style('font-weight', 'bold');

            labelSelection.exit().remove();
            label = labelEnter.merge(labelSelection);
            // Existing labels may now show a different key list even though their
            // node object (and D3 binding) stayed the same — refresh the text.
            label.text(d => d.label !== undefined ? d.label : d.id);
            label.transition().duration(500)
                .attr('x', d => d.x)
                .attr('y', d => d.y);

            setTimeout(() => {
                setEdgePositions(link, edgeLabel, node, label, directed, weighted, svg, arrowId);
                if (link2) setEdgePositions(link2, edgeLabel, node, label, directed, weighted, svg, arrowId);
            }, 500);
            updateStatistics();
        }

        function getBTreeOrder() {
            return (typeof bTreeOrderInput !== 'undefined' && bTreeOrderInput.value)
                ? Math.max(2, parseInt(bTreeOrderInput.value) || 4)
                : 4;
        }

        // --- insertB ---------------------------------------------------------------

        function insertB() {
            const order = getBTreeOrder();

            if (!isBJSON(convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed), order).valid) {
                alert("This structure is not a B-tree.");
                return;
            }

            const value = prompt("Enter numeric value to insert:");
            if (!value) return; // User cancelled or entered empty string

            const numericVal = Number(value);
            if (Number.isNaN(numericVal)) {
                alert("B-tree nodes must be numeric.");
                return;
            }

            let root = buildBTreeModel(nodes, edgesRaw);

            if (root && modelHasKey(root, numericVal)) {
                alert("That value is already in the tree.");
                return;
            }

            if (!root) {
                root = { keys: [numericVal], children: [], leaf: true, domNode: null };
            } else {
                const result = bTreeModelInsert(root, numericVal, order);
                if (result) {
                    root = { keys: [result.promotedKey], children: [root, result.newRightNode], leaf: false, domNode: null };
                }
            }

            const newEdgesRaw = [];
            finalizeBTreeModel(root, newEdgesRaw);
            edgesRaw = newEdgesRaw;

            rebuildGraphAfterTreeEdit();
        }

        // --- insertBPlus -------------------------------------------------------------

        function insertBPlus() {
            const order = getBTreeOrder();

            const treeOnlyEdges = filterTreeEdgesOnly(edgesRaw);
            if (!isBPlusJSON(convertToTreeJSON(stringifyEdges(treeOnlyEdges), svg, directed), order).valid) {
                alert("This structure is not a B+-tree.");
                return;
            }

            const value = prompt("Enter numeric value to insert:");
            if (!value) return;

            const numericVal = Number(value);
            if (Number.isNaN(numericVal)) {
                alert("B+-tree nodes must be numeric.");
                return;
            }

            let root = buildBTreeModel(nodes, treeOnlyEdges);

            if (root && modelHasKey(root, numericVal)) {
                alert("That value is already in the tree.");
                return;
            }

            if (!root) {
                root = { keys: [numericVal], children: [], leaf: true, domNode: null };
            } else {
                const result = bPlusModelInsert(root, numericVal, order);
                if (result) {
                    root = { keys: [result.promotedKey], children: [root, result.newRightNode], leaf: false, domNode: null };
                }
            }

            const newEdgesRaw = [];
            const leafIdsInOrder = [];
            finalizeBTreeModel(root, newEdgesRaw, leafIdsInOrder);

            // Re-link the leaves left-to-right — this fully replaces the old
            // sibling chain rather than patching it, since a split can insert a
            // brand-new leaf anywhere in the sequence.
            for (let i = 0; i < leafIdsInOrder.length - 1; i++) {
                newEdgesRaw.push({ source: leafIdsInOrder[i], target: leafIdsInOrder[i + 1], weight: 1 });
            }

            edgesRaw = newEdgesRaw;

            rebuildGraphAfterTreeEdit();
        }

        const optionBSTInsert = document.createElement('option');
        optionBSTInsert.value = 'BSTI';
        optionBSTInsert.textContent = "BST insertion";
        optionBSTInsert.title = "Insert a node in the BST, preserving its structure."
        optionBSTInsert.dataset.algorithm = 'BSTI';
        methodsSelect.appendChild(optionBSTInsert);

        const optionBSTDelete = document.createElement('option');
        optionBSTDelete.value = 'BSTD';
        optionBSTDelete.textContent = "BST deletion";
        optionBSTDelete.title = "Delete a node from the BST, preserving its structure."
        optionBSTDelete.dataset.algorithm = 'BSTD';
        methodsSelect.appendChild(optionBSTDelete);

        const optionAVLBalance = document.createElement('option');
        optionAVLBalance.value = 'AVLB';
        optionAVLBalance.textContent = "AVL rearrangement";
        optionAVLBalance.title = "Balance the current BST into an AVL tree."
        optionAVLBalance.dataset.algorithm = 'AVLB';
        methodsSelect.appendChild(optionAVLBalance);

        const optionAVLInsert = document.createElement('option');
        optionAVLInsert.value = 'AVLI';
        optionAVLInsert.textContent = "AVL insertion";
        optionAVLInsert.title = "Insert a node in the AVL tree, preserving its structure."
        optionAVLInsert.dataset.algorithm = 'AVLI';
        methodsSelect.appendChild(optionAVLInsert);

        const optionAVLDelete = document.createElement('option');
        optionAVLDelete.value = 'AVLD';
        optionAVLDelete.textContent = "AVL deletion";
        optionAVLDelete.title = "Delete a node in the AVL tree, preserving its structure."
        optionAVLDelete.dataset.algorithm = 'AVLD';
        methodsSelect.appendChild(optionAVLDelete);

        const optionBInsert = document.createElement('option');
        optionBInsert.value = 'BI';
        optionBInsert.textContent = "B tree insertion";
        optionBInsert.title = "Insert element into B tree"
        optionBInsert.dataset.algorithm = 'BI';
        methodsSelect.appendChild(optionBInsert);
    }

    headerSpan.appendChild(methodsSelect);

    // Handle selection
    methodsSelect.addEventListener('change', (event) => {
        const selectedAlgorithm = applicableAlgorithms.find(
            algorithm => algorithm.name === event.target.value
        );

        switch (true) { // Handle algorithms
            case !!selectedAlgorithm:
                handleAlgorithmClick(
                    selectedAlgorithm,
                    container,
                    svgElement,
                    svg, // svg is d3.select(svgElement)
                    nodes,
                    edges,
                    arrowId,
                    edgesRaw,
                    directed,
                    weighted,
                    nameInput.value,
                    methodsElement,
                );
                break;

            case event.target.value === "BSTI":
                insertBST();
                break;

            case event.target.value === "BSTD":
                deleteBST();
                break;

            case event.target.value === "AVLB":
                balanceAVL();
                break;

            case event.target.value === "AVLI":
                insertBST();
                balanceAVL();
                break;

            case event.target.value === "AVLD":
                deleteBST();
                balanceAVL();
                break;

            case event.target.value === "BI":
                insertB();
                break;

            case event.target.value === "BPlusI":
                insertBPlus();
                break;
        }

        // Reset back to placeholder after running
        methodsSelect.selectedIndex = 0;
    });
    /* End of Available methods */
    /* End of header span content */

    // Append the headerSpan to the graphHeader
    graphHeader.appendChild(headerSpan);

    // Create the controls div - contains the close button
    // Create the close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&#10005;';
    closeButton.title = 'Close graph';

    // Append the controls div to the graphHeader
    graphHeader.appendChild(closeButton);
    /* End of graph header content */

    // Append the graphHeader to the container
    container.appendChild(graphHeader);

    /* Create the graphContent div - contains the SVG element and the methods called on the graph */
    const graphContent = document.createElement('div');
    graphContent.className = 'graphContent';
    graphContent.style.height = `calc(100% - ${graphHeader.offsetHeight}px)`; // Set the height of the graphContent to fill the remaining space

    // Create the SVG element
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); // This is not a link to fetch data from. It is a namespace for creating elements.
    graphContent.appendChild(svgElement);
    /* End of graphContent div */

    // Create the element that contains called methods
    const methodsElement = document.createElement('div');
    methodsElement.className = 'methodsElem';
    methodsElement.addEventListener('wheel', (event) => {
        event.stopPropagation();
    });
    graphContent.appendChild(methodsElement);

    // Resizing for methodsElement
    const topResizeHandle = document.createElement('div');
    topResizeHandle.className = 'top-resize-handle';
    // Resizing logic
    topResizeHandle.addEventListener('mousedown', (e) => {
        handleTopResizeMouseDown(e, methodsElement, container, svgElement);
    });

    // End of resizing for methodsElement
    methodsElement.appendChild(topResizeHandle);

    const copyr = document.createElement('div');
    copyr.style.display = 'inline-block';
    copyr.style.margin = '15px';
    copyr.innerHTML = '© 2025 arx-net. Your algorithm answers and explanation link will be displayed here. Click on the book icon above to hide.';
    methodsElement.appendChild(copyr);

    const methodsElementToggle = document.createElement('button');
    methodsElementToggle.id = 'methodsElementToggle';
    methodsElementToggle.innerHTML = '<img src=images/log.png />'
    methodsElementToggle.title = 'Toggle visibility for called methods on this graph';
    methodsElementToggle.addEventListener('click', () => {
        if (methodsElement.style.display === 'block') {
            methodsElement.style.display = 'none'
            svgElement.style.height = '100%';
        } else {
            methodsElement.style.display = 'block';
            const meHeight = methodsElement.offsetHeight;
            svgElement.style.height = `calc(100% - ${meHeight}px)`;
        }
    })
    operationPanel.appendChild(methodsElementToggle);

    // Append the graphContent to the container
    container.appendChild(graphContent);
    /* End of content of container */
    focusAndCenterContainer(container); // Focus on the container when it is created

    // Right clicking will display options to reset zoom, focus, hide, and delete graph.
    const menuElement = document.createElement("div");
    menuElement.className = "floating-menu";
    document.body.appendChild(menuElement);

    const menu = new FloatingMenu(menuElement);

    addMenuItem(menuElement, menu, 'Rearrange nodes', 'Rearrange nodes as they first appeared in the generation', () => {
        autoLayoutNodes(nodes, simulation, width, height, edgesRaw, isTreeType);
        // Apply positions to nodes
        positionNode(node);

        // Update link positions
        setEdgePositions(link, edgeLabel, node, label, directed, weighted, svg, arrowId);
        setEdgePositions(link2, edgeLabel, node, label, directed, weighted, svg, arrowId);
        adjustViewBox(svg, nodes, grid);
        drawGrid(svg, grid);

        simulation.alphaDecay(1);
        simulation.alphaTarget(0);
    });

    if (!isMobile) {
        // Maximize
        addMenuItem(menuElement, menu, 'Maximize', 'Maximize window', () => {
            maximizeContainer(container);
        });

        // Focus (center and bring to front)
        addMenuItem(menuElement, menu, 'Center', 'Resize and bring this window to the center of the screen', () => {
            focusAndCenterContainer(container);
        });

        addMenuItem(menuElement, menu, 'Dock left', 'Position this window to the far left and set width to 50%', () => {
            dockLeft(container);
        });

    }

    // Hide container
    addMenuItem(menuElement, menu, 'Hide', 'Hide this graph', () => {
        showHideGraph.click();
    });

    // Create new vertex
    addMenuItem(menuElement, menu, 'Create new vertex', 'Add a new vertex to this graph', () => {
        let newVertex = prompt("Enter new vertex name (e.g., A, B, C):");
        if (!newVertex) return;

        newVertex = newVertex.toUpperCase();
        let uniqueId = newVertex;
        let counter = 1;
        while (nodes.some(node => node.id === uniqueId)) {
            uniqueId = `${newVertex}_${counter++}`;
        }

        // Place the new node at the cursor
        // Calculate the SVG coordinates corresponding to the mouse position
        const pt = svg.node().createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;
        const svgP = pt.matrixTransform(svg.node().getScreenCTM().inverse());
        const centerX = svgP.x;
        const centerY = svgP.y;

        const newNodeObj = { id: uniqueId, label: newVertex, x: centerX, y: centerY, vx: 0, vy: 0 };

        // Wrapper function to finalize adding the vertex and drawing it
        const finalizeVertexCreation = (parentNode = null) => {
            nodes.push(newNodeObj);

            // If a parent node was selected (Tree mode), create the connection
            if (parentNode) {
                let weight = 1;
                edges.push({ source: parentNode, target: newNodeObj, weight });
                edgesRaw.push({ source: parentNode.id, target: uniqueId, weight });

                // Re-bind data and redraw links
                link = edgeLayer.selectAll('.link')
                    .data(edges)
                    .join(
                        enter => enter.append('path')
                            .attr('class', 'link')
                            .attr('source-id', d => `${arrowId}${d.source.id}`)
                            .attr('target-id', d => `${arrowId}${d.target.id}`)
                            .attr('fill', 'none')
                            .attr('stroke', edgeColor)
                            .attr('stroke-width', 4)
                            .on('mouseover', function () { handleEdgeMouseOver(this, edgeHoverColor, directed, svgElement); })
                            .on('mouseout', function () { handleEdgeMouseOut(this, edgeColor, directed, svgElement); })
                            .on('contextmenu', function (event, d) { showEdgeContextMenu(event, d, svg, edgeLabel, edges, edgesRaw, node, label, directed, weighted, arrowId, link, link2, updateStatistics); }),
                        update => update,
                        exit => exit.remove()
                    );

                link2 = edgeBufferLayer.selectAll('.link2')
                    .data(edges)
                    .join(
                        enter => enter.append('path')
                            .attr('class', 'link2')
                            .attr('fill', 'none')
                            .attr('stroke', 'transparent')
                            .attr('stroke-width', 20)
                            .style('pointer-events', 'stroke')
                            .on('mouseover', function (event, d) {
                                const selector = `.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`;
                                d3.select(selector).dispatch('mouseover');
                            })
                            .on('mouseout', function (event, d) {
                                const selector = `.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`;
                                d3.select(selector).dispatch('mouseout');
                            })
                            .on('contextmenu', function (event, d) {
                                const selector = `.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`;
                                d3.select(selector).node().dispatchEvent(new MouseEvent('contextmenu', { bubbles: false, cancelable: true, clientX: event.clientX, clientY: event.clientY, view: window }));
                            }),
                        update => update,
                        exit => exit.remove()
                    );

                if (weighted) {
                    edgeLabel = labelLayer.selectAll('.edge-label')
                        .data(edges)
                        .join(
                            enter => enter.append('text').attr('class', 'edge-label').text(d => d.weight),
                            update => update.text(d => d.weight),
                            exit => exit.remove()
                        );
                }
            }

            // Render nodes
            let nodeSelection = nodeLayer.selectAll('rect')
                .data(nodes, d => d.id);

            let nodeEnter = nodeSelection.enter()
                .append('rect')
                .attr('class', 'node')
                .attr('fill', nodeColor)
                .attr('stroke', primaryBG)
                .call(sizeNodeRect)
                .call(positionNode)
                .call(
                    d3.drag()
                        .on('start', function (event, d) {
                            dragStarted(event, d, simulation, this);
                        })
                        .on('drag', function (event, d) {
                            dragged(event, d, this);
                        })
                        .on('end', function (event, d) {
                            dragEnded(event, d, simulation, this, convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed));
                            updateStatistics();
                        })
                )
                .on('contextmenu', function (event, d) {
                    event.preventDefault();
                    event.stopPropagation();

                    // Create context menu
                    const menuElement = document.createElement('div');
                    menuElement.className = 'floating-menu';
                    document.body.appendChild(menuElement);
                    const menu = new FloatingMenu(menuElement);

                    addMenuItem(menuElement, menu, 'Color this vertex', null, (event) => {
                        const vertex = d3.select(this);

                        showColorPicker(
                            event.clientX,
                            event.clientY,
                            d3.color(vertex.attr("fill") || "#000000").formatHex(),
                            color => vertex.attr("fill", color)
                        );
                    });

                    // Change Node Label Option
                    addMenuItem(menuElement, menu, 'Change node value', null, () => {
                        let newLabel = prompt("Enter new label for this vertex:", d.label !== undefined ? d.label : d.id);
                        if (newLabel) {
                            newLabel = newLabel.toUpperCase();

                            let uniqueId = newLabel;
                            let counter = 1;
                            while (nodes.some(node => node.id === uniqueId)) {
                                uniqueId = `${newLabel}_${counter++}`;
                            }

                            const oldId = d.id;
                            d.id = uniqueId;
                            d.label = newLabel;

                            edgesRaw.forEach(edge => {
                                if (edge.source === oldId) edge.source = uniqueId;
                                if (edge.target === oldId) edge.target = uniqueId;
                            });

                            labelLayer.selectAll('.node-label').text(n => n.label !== undefined ? n.label : n.id);
                            d3.select(this).call(sizeNodeRect);
                            link.attr('source-id', e => `${arrowId}${e.source.id}`)
                                .attr('target-id', e => `${arrowId}${e.target.id}`);
                        }
                        updateStatistics();
                    });

                    // Create new edge
                    addMenuItem(menuElement, menu, 'Create new edge from this vertex', null, () => {
                        let targetId = prompt("Enter target vertex id:").toUpperCase();
                        if (!targetId) return;
                        const targetNode = nodes.find(n => n.id === targetId);
                        if (!targetNode) {
                            alert("Target vertex does not exist.");
                            return;
                        }
                        let weight = 1;
                        if (weighted) {
                            let w = prompt("Enter weight for this edge:", "1");
                            if (w === null) return;
                            weight = parseFloat(w);
                            if (isNaN(weight)) {
                                alert("Invalid weight.");
                                return;
                            }
                        }

                        const reverseEdge = edges.find(e => e.source === targetNode && e.target === d);
                        const isSelfLoop = d.id === targetId;
                        if (isSelfLoop) {
                            edges.push({ source: d, target: targetNode, weight, selfLoop: true });
                        } else if (reverseEdge) {
                            edges.push({ source: d, target: targetNode, weight, bidirectional: true });
                            reverseEdge.bidirectional = true;
                        } else {
                            edges.push({ source: d, target: targetNode, weight });
                        }

                        edgesRaw.push({ source: d.id, target: targetNode.id, weight });

                        link = edgeLayer.selectAll('.link').data(edges)
                            .join(
                                enter => enter.append('path')
                                    .attr('class', 'link')
                                    .attr('source-id', d => `${arrowId}${d.source.id}`)
                                    .attr('target-id', d => `${arrowId}${d.target.id}`)
                                    .attr('fill', 'none')
                                    .attr('stroke', edgeColor)
                                    .attr('stroke-width', 4)
                                    .on('mouseover', function () { handleEdgeMouseOver(this, edgeHoverColor, directed, svgElement); })
                                    .on('mouseout', function () { handleEdgeMouseOut(this, edgeColor, directed, svgElement); })
                                    .on('contextmenu', function (event, d) { showEdgeContextMenu(event, d, svg, edgeLabel, edges, edgesRaw, node, label, directed, weighted, arrowId, link, link2, updateStatistics); }),
                                update => update,
                                exit => exit.remove()
                            );

                        link2 = edgeBufferLayer.selectAll('.link2').data(edges)
                            .join(
                                enter => enter.append('path')
                                    .attr('class', 'link2')
                                    .attr('fill', 'none')
                                    .attr('stroke', 'transparent')
                                    .attr('stroke-width', 20)
                                    .style('pointer-events', 'stroke')
                                    .on('mouseover', function (event, d) {
                                        const selector = `.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`;
                                        d3.select(selector).dispatch('mouseover');
                                    })
                                    .on('mouseout', function (event, d) {
                                        const selector = `.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`;
                                        d3.select(selector).dispatch('mouseout');
                                    })
                                    .on('contextmenu', function (event, d) {
                                        const selector = `.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`;
                                        d3.select(selector).node().dispatchEvent(new MouseEvent('contextmenu', { bubbles: false, cancelable: true, clientX: event.clientX, clientY: event.clientY, view: window }));
                                    }),
                                update => update,
                                exit => exit.remove()
                            );

                        if (weighted) {
                            edgeLabel.exit().remove();
                            edgeLabel = labelLayer.selectAll('.edge-label').data(edges)
                                .join(
                                    enter => enter.append('text').attr('class', 'edge-label').text(d => d.weight),
                                    update => update.text(d => d.weight),
                                    exit => exit.remove()
                                );
                        }

                        setEdgePositions(link, edgeLabel, node, label, directed, weighted, svg, arrowId);
                        setEdgePositions(link2, edgeLabel, node, label, directed, weighted, svg, arrowId);
                        updateStatistics();
                    });

                    if (!isTreeType) {
                        addMenuItem(menuElement, menu, 'Delete this vertex', null, () => {
                            const idx = nodes.indexOf(d);
                            if (idx !== -1) {
                                nodes.splice(idx, 1);
                                edges = edges.filter(edge => edge.source !== d && edge.target !== d);
                                edgesRaw = edgesRaw.filter(edge => edge.source !== d.id && edge.target !== d.id);
                            }
                            d3.select(this).remove();
                            label.filter(l => l === d).remove();
                            if (edgeLabel) {
                                edgeLabel.filter(e => e.source === d || e.target === d).remove();
                            }
                            link.filter(l => l.source === d || l.target === d).remove();
                            edges = edges.filter(edge => edge.source.id !== d.id && edge.target.id !== d.id);
                            edgesRaw = edgesRaw.filter(edge => edge.source !== d.id && edge.target !== d.id);
                            updateStatistics();
                        });
                    } else {
                        addMenuItem(menuElement, menu, 'Delete this vertex and its subtree', null, () => {
                            const idsToDelete = new Set([d.id]);
                            const queue = [d.id];

                            while (queue.length > 0) {
                                const currentId = queue.shift();
                                edgesRaw.forEach(edge => {
                                    if (edge.source === currentId && !idsToDelete.has(edge.target)) {
                                        idsToDelete.add(edge.target);
                                        queue.push(edge.target);
                                    }
                                });
                            }

                            for (let i = nodes.length - 1; i >= 0; i--) {
                                if (idsToDelete.has(nodes[i].id)) {
                                    nodes.splice(i, 1);
                                }
                            }

                            edges = edges.filter(edge => !idsToDelete.has(edge.source.id) && !idsToDelete.has(edge.target.id));
                            edgesRaw = edgesRaw.filter(edge => !idsToDelete.has(edge.source) && !idsToDelete.has(edge.target));

                            node.filter(n => idsToDelete.has(n.id)).remove();
                            label.filter(n => idsToDelete.has(n.id)).remove();
                            link.filter(e => idsToDelete.has(e.source.id) || idsToDelete.has(e.target.id)).remove();

                            if (typeof link2 !== 'undefined' && link2) {
                                link2.filter(e => idsToDelete.has(e.source.id) || idsToDelete.has(e.target.id)).remove();
                            }
                            if (typeof edgeLabel !== 'undefined' && edgeLabel) {
                                edgeLabel.filter(e => idsToDelete.has(e.source.id) || idsToDelete.has(e.target.id)).remove();
                            }

                            node = nodeLayer.selectAll('.node');
                            label = labelLayer.selectAll('.node-label');
                            link = edgeLayer.selectAll('.link');

                            if (typeof link2 !== 'undefined' && link2) link2 = edgeBufferLayer.selectAll('.link2');
                            if (typeof edgeLabel !== 'undefined' && edgeLabel) edgeLabel = labelLayer.selectAll('.edge-label');
                            updateStatistics();
                        });
                    }

                    menu.show(event);
                });

            nodeSelection.exit().remove();
            node = nodeEnter.merge(nodeSelection);

            // Render Labels
            let labelSelection = labelLayer.selectAll('.node-label')
                .data(nodes, d => d.id);

            let labelEnter = labelSelection.enter()
                .append('text')
                .attr('x', d => d.x)
                .attr('y', d => d.y)
                .attr('dy', 7)
                .attr('text-anchor', 'middle')
                .text(d => d.label !== undefined ? d.label : d.id)
                .attr('class', 'node-label')
                .style('pointer-events', 'none')
                .style('font-weight', 'bold');

            label = labelEnter.merge(labelSelection);

            // Final position sync
            label.attr('x', d => d.x).attr('y', d => d.y);
            setEdgePositions(link, edgeLabel, node, label, directed, weighted, svg, arrowId);
            if (typeof link2 !== 'undefined' && link2) setEdgePositions(link2, edgeLabel, node, label, directed, weighted, svg, arrowId);
        };

        if (typeof isTreeType !== 'undefined' && isTreeType && nodes.length > 0) {
            // Change cursor to indicate Selection Mode
            node.style('cursor', 'crosshair');

            // Helper to abort/clean up temporary handlers
            const cleanupSelectionMode = () => {
                node.on('click.parentSelection', null).style('cursor', null);
                d3.select(document).on('contextmenu.cancelVertex', null);
            };

            // Right-click anywhere to cancel vertex creation
            d3.select(document).on('contextmenu.cancelVertex', function (cancelEvent) {
                cancelEvent.preventDefault();
                cleanupSelectionMode();
                console.log("Vertex creation cancelled.");
            });

            // Left-click on a valid parent node to confirm creation
            node.on('click.parentSelection', function (clickEvent, parentNodeData) {
                clickEvent.stopPropagation(); // Stop D3/SVG from registering clicks elsewhere
                cleanupSelectionMode();
                finalizeVertexCreation(parentNodeData);
            });

            alert("Click an existing vertex to set it as the parent.\nRight-click anywhere to cancel.");
        } else {
            // Not a tree (or first node being added), add immediately without parent selection
            finalizeVertexCreation();
        }
        updateStatistics();
    });

    addMenuItem(menuElement, menu, 'Save as PNG', 'Save this graph as a PNG image', () => {
        updateColors();
        saveSvgAsPng(svgElement, `${nameInput.value}.png`);
        revertColors();
    });

    addMenuItem(menuElement, menu, 'Save as transparent PNG', 'Save this graph as a PNG image with a transparent background', () => {
        updateColors();
        saveSvgAsPng(svgElement, `${nameInput.value}.png`, true);
        revertColors();
    });

    // Duplicate graph
    addMenuItem(menuElement, menu, 'Delete', 'Delete this graph', () => {
        deleteThisGraph.click();
    });

    // Delete graph
    addMenuItem(menuElement, menu, 'Duplicate', 'Duplicate this graph with weights and direction determined by the checkboxes', () => {
        duplicateGraph.click();
    });

    container.addEventListener("contextmenu", (event) => {
        event.preventDefault();

        if (
            event.target.closest(".link") ||
            event.target.closest(".link2") ||
            event.target.closest(".methodsDiv")
        ) {
            return;
        }

        menu.show(event);
    });

    /* Function to save printable png */
    function updateColors() {
        document.documentElement.style.setProperty("--node-color", "#ccc");
        document.documentElement.style.setProperty("--grid-line-color", "transparent");
        edgeColor = getComputedStyle(document.documentElement).getPropertyValue('--edge-color').trim();
        nodeColor = getComputedStyle(document.documentElement).getPropertyValue('--node-color').trim();
        edgeWeightColor = getComputedStyle(document.documentElement).getPropertyValue('--edge-weight-color').trim();
        gridLineColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-line-color').trim();

        nodeLayer.selectAll('rect')
            .attr('fill', nodeColor)

        edgeLayer.selectAll('.link')
            .attr('stroke', edgeColor)

        labelLayer.selectAll('.edge-label')
            .attr('fill', edgeWeightColor)

        drawGrid(svg, grid);
    }

    function revertColors() {
        document.documentElement.style.setProperty("--node-color", "#42baff");
        document.documentElement.style.setProperty("--grid-line-color", "#3c3d3c");
        edgeColor = getComputedStyle(document.documentElement).getPropertyValue('--edge-color').trim();
        nodeColor = getComputedStyle(document.documentElement).getPropertyValue('--node-color').trim();
        nodeLabelColor = getComputedStyle(document.documentElement).getPropertyValue('--node-label-color').trim();
        edgeWeightColor = getComputedStyle(document.documentElement).getPropertyValue('--edge-weight-color').trim();
        gridLineColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-line-color').trim();

        nodeLayer.selectAll('rect')
            .attr('fill', nodeColor)

        edgeLayer.selectAll('.link')
            .attr('stroke', edgeColor)

        labelLayer.selectAll('.edge-label')
            .attr('fill', edgeWeightColor)

        drawGrid(svg, grid);
    }

    const resizeHandles = container.querySelectorAll('.resize-handle');

    /* Container elements' functionality */
    /* Drag functionality */
    graphHeader.addEventListener('mousedown', (e) => {
        setContainerPosition(e, container);
    });
    graphHeader.addEventListener('contextmenu', (e) => {
        e.preventDefault();          // Prevent browser context menu
        e.stopPropagation();         // Prevent bubbling
        e.stopImmediatePropagation(); // Prevent other listeners on this element
    });
    /* End of drag functionality */

    /* Resize functionality */
    resizeHandles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            methodsElement.style.display = 'none';
            svgElement.style.height = '100%';
            handleResizeStart(e, handle, container);
        });
    });
    /* End of resize functionality */

    /* Outliner elements */
    // Div for the show/hide graph button and delete button
    const showHideDeleteDiv = document.createElement('div');
    showHideDeleteDiv.className = 'showHideDeleteDiv';
    // Show container on click
    showHideDeleteDiv.addEventListener('click', function (event) {
        if (event.button === 0) { // Only left mouse button
            focusOnThisContainer(container);
        }
    });

    /* Graph name functionality */
    const nameInput = document.createElement('input');
    showHideDeleteDiv.appendChild(nameInput);
    nameInput.type = 'text';
    nameInput.value = displayName;
    nameInput.title = displayName;
    nameInput.id = displayName;
    nameInput.autocomplete = 'off';
    nameInput.spellcheck = false;
    // Initially disable input
    nameInput.setAttribute('readonly', true);

    // Enable editing on double-click and apply styling
    nameInput.addEventListener('dblclick', () => {
        enableGraphNameEditing(nameInput);
    });

    // Disable editing on blur and enter key press
    nameInput.addEventListener('keydown', (event) => {
        handleGraphNameInput(event, nameInput);
    });
    nameInput.addEventListener('blur', () => {
        nameInput.setAttribute('readonly', true);
        nameInput.classList.remove('editable'); // Remove class
    });

    // Update the graph name on input
    nameInput.addEventListener('input', () => {
        graphNameSpan.textContent = nameInput.value.length > 10 ? nameInput.value.substring(0, 7) + '...' : nameInput.value;
        graphNameSpan.title = nameInput.value;
    });

    /* End of graph name functionality */

    /* Outliner graph functionalities */
    // Show/hide graph functionality
    const showHideGraph = document.createElement('button');
    showHideGraph.title = 'Show/hide graph';
    showHideGraph.className = 'showHideCurrentGraph';
    const showHideImg = document.createElement('img');
    showHideImg.src = 'images/show.png';
    showHideGraph.appendChild(showHideImg);
    showHideGraph.addEventListener('click', () => {
        container.style.display === 'none' ? container.style.display = 'block' : container.style.display = 'none';
        showHideImg.src = container.style.display === 'none' ? 'images/hide.png' : 'images/show.png';
    });
    closeButton.addEventListener('click', () => {
        showHideGraph.click();
    }); // Adding it to the close button as well

    // Focus on graph functionality
    const focusButton = document.createElement('button');
    focusButton.className = 'FBbutton'
    focusButton.title = 'Focus on this graph';
    const focusImg = document.createElement('img');
    focusImg.src = 'images/focus.png';
    focusButton.appendChild(focusImg);
    focusButton.addEventListener('click', () => {
        if (container.style.display === 'none') showHideGraph.click();
        focusAndCenterContainer(container);
    });

    /* General graph methods div */
    /* End of general graph methods div */
    /* End of outliner graph functionalities */

    // Span for the buttons
    const showHideSpanButtons = document.createElement('span');
    showHideSpanButtons.className = 'SHSB'
    showHideSpanButtons.appendChild(focusButton);
    showHideSpanButtons.appendChild(showHideGraph);
    showHideDeleteDiv.appendChild(showHideSpanButtons);
    /* End of outliner elements */

    outliner.appendChild(showHideDeleteDiv);

    const deleteThisGraph = document.createElement('button'); // Delete this graph
    deleteThisGraph.className = 'deleteCurrentGraph';
    deleteThisGraph.textContent = 'Delete graph';
    deleteThisGraph.title = 'Delete this graph';

    const dupDelMenuObj = document.createElement('div');
    dupDelMenuObj.id = 'dupDelMenu';
    dupDelMenuObj.className = 'floating-menu';

    const duplicateGraph = document.createElement('button'); // Duplicate graph with weights and directions turned on/off
    duplicateGraph.textContent = 'Duplicate graph';
    duplicateGraph.title = 'Duplicate this graph';

    duplicateGraph.addEventListener('click', () => {
        let edgesRawString = stringifyEdges(edgesRaw);
        addGraph(edgesRawString, nodes, `${nameInput.value} copy`);
        dupDelMenuObj.style.display = 'none';
    });

    dupDelMenuObj.appendChild(duplicateGraph);
    dupDelMenuObj.appendChild(deleteThisGraph);

    deleteThisGraph.addEventListener('click', () => {
        deleteGraph(container, displayName, dupDelMenuObj, showHideDeleteDiv);
    });

    document.body.appendChild(dupDelMenuObj);

    const dupDelMenu = new FloatingMenu(dupDelMenuObj);

    showHideDeleteDiv.addEventListener("contextmenu", (e) => {
        dupDelMenu.show(e);
    });

    // Clear previous graph
    const svg = d3.select(svgElement);
    svg.selectAll('*').remove();
    const grid = svg.append('g') // Append a group element to the SVG for the grid

    /* SVG general functionalities */
    /* Zoom functionality and mousewheel binding */

    // Mouse wheel zoom
    container.addEventListener('wheel', (event) => {
        event.preventDefault();
        if (event.deltaY < 0) {
            zoomIn(svg, grid);
        } else {
            zoomOut(svg, grid);
        }
    });

    // Pinch-to-Zoom functionality
    let initialPinchDistance = null;

    container.addEventListener('touchstart', (event) => {
        if (event.touches.length === 2) {
            initialPinchDistance = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY
            );
        }
    }, { passive: false });

    container.addEventListener('touchmove', (event) => {
        if (event.touches.length === 2) {
            event.preventDefault(); // Prevent default browser zooming/scrolling
            const currentDistance = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY
            );

            if (initialPinchDistance) {
                const diff = currentDistance - initialPinchDistance;
                // Threshold of 15 limits hypersensitivity
                if (diff > 15) {
                    zoomIn(svg, grid);
                    initialPinchDistance = currentDistance;
                } else if (diff < -15) {
                    zoomOut(svg, grid);
                    initialPinchDistance = currentDistance;
                }
            }
        }
    }, { passive: false });

    container.addEventListener('touchend', (event) => {
        if (event.touches.length < 2) {
            initialPinchDistance = null;
        }
    });
    /* End of zoom functionality */

    /* Pan functionality to middle mouse hold or Ctrl + LMB and drag */
    svg.on('pointerdown', (event) => {
        svgPanStart(event);
    });
    svg.on('pointermove', (event) => {
        svgPanMove(event, svg, drawGrid, grid);
    });
    svg.on('pointerup', () => {
        svgPanEnd();
    });
    svg.on('pointerleave', () => {
        svgPanEnd(); // Stops panning if the cursor/finger leaves the SVG
    });
    svg.on('pointercancel', () => {
        svgPanEnd(); // Handles mobile touch interruptions
    });
    /* End of pan functionality */
    /* End of pan functionality */

    svg.on('dblclick', () => {
        if (hasDragged) {
            hasDragged = false; // Reset the flag
            return;             // Abort adjustViewBox
        }
        adjustViewBox(svg, nodes, grid);
    });
    /* End of SVG general functionalities */

    // Get the dimensions of the container of the SVG
    const width = container.offsetWidth;
    const height = container.offsetHeight;

    // Set SVG viewbox - It acts like a camera, and the viewBox attribute defines the position and dimension of the SVG content
    svg.attr('width', width).attr('height', height);
    const SVGwidth = svg.attr('width');
    const SVGheight = svg.attr('height');
    svg.attr('viewBox', `0 0 ${SVGwidth} ${SVGheight}`);

    drawGrid(svg, grid); // Initial grid draw

    // Show/hide grid
    gridCheckbox.addEventListener('change', function () {
        grid.style('display', this.checked ? 'block' : 'none');
    });

    /* Graph elements creation */
    // Mark bidirectional Edges
    const edgeMap = new Set(edges.map(e => `${e.source}-${e.target}`));
    edges.forEach(edge => {
        if (edgeMap.has(`${edge.target}-${edge.source}`)) {
            if (directed) { // Undirected graphs cannot have bidirectional edges
                edge.bidirectional = true;
            }
        }
        if (edge.source === edge.target) {
            edge.selfLoop = true; // Mark self-loops
        }
    });

    // Create nodes from edges
    if (nodes === null) {
        nodes = Array.from(
            new Set(edges.flatMap(edge => [edge.source, edge.target]))
        ).map(id => ({ id }));
    }

    /* End of graph elements creation */

    // Resolve edge source/target ids to actual node object references.
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    edges.forEach(edge => {
        if (typeof edge.source !== 'object') edge.source = nodeById.get(edge.source);
        if (typeof edge.target !== 'object') edge.target = nodeById.get(edge.target);
    });

    /* Simulation values */
    // D3 simulation used only to drive tick updates for dragging; no forces are applied
    const simulation = d3.forceSimulation(nodes);

    /* End of simulation values */

    const edgeLayer = svg.append('g').attr('id', 'edge-layer');
    const edgeBufferLayer = svg.append('g').attr('id', 'edge-buffer-layer');
    const nodeLayer = svg.append('g').attr('id', 'node-layer');
    const labelLayer = svg.append('g').attr('id', 'label-layer');

    /* Drawing the graph */
    // Draw links
    let link = edgeLayer.selectAll('.link')
        .data(edges)
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('source-id', d => `${arrowId}${d.source.id}`)
        .attr('target-id', d => `${arrowId}${d.target.id}`)
        .attr('fill', 'none')
        .attr('stroke', edgeColor)
        .attr('stroke-width', 4)
        .on('mouseover', function () {
            handleEdgeMouseOver(this, edgeHoverColor, directed, svgElement);
        })
        .on('mouseout', function () {
            handleEdgeMouseOut(this, edgeColor, directed, svgElement);
        })
        .on('contextmenu', function (event, d) {
            showEdgeContextMenu(event, d, svg, edgeLabel, edges, edgesRaw, node, label, directed, weighted, arrowId, link, link2, updateStatistics);
        });


    // Buffer size for edge hover
    let link2 = edgeBufferLayer.selectAll('.link2')
        .data(edges)
        .enter()
        .append('path')
        .attr('class', 'link2')
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 20)
        .style('pointer-events', 'stroke')  // Make only the stroke area interactive
        .on('mouseover', function (event, d) {
            // Forward hover to corresponding `.link`
            const selector = `.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`;
            d3.select(selector).dispatch('mouseover');
        })
        .on('mouseout', function (event, d) {
            const selector = `.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`;
            d3.select(selector).dispatch('mouseout');
        })
        .on('contextmenu', function (event, d) {
            const selector = `.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`;
            d3.select(selector).node().dispatchEvent(new MouseEvent('contextmenu', {
                bubbles: false,
                cancelable: true,
                clientX: event.clientX,
                clientY: event.clientY,
                view: window
            }));
        });

    // Draw nodes - Drawing nodes after links so that they appear in front
    let node = nodeLayer.selectAll('rect')
        .data(nodes, d => d.id)
        .enter()
        .append('rect')
        .attr('class', 'node')
        .attr('fill', nodeColor)
        .attr('stroke', primaryBG)
        .call(sizeNodeRect)
        .call(
            d3.drag()
                .on('start', function (event, d) { dragStarted(event, d, simulation, this); })
                .on('drag', function (event, d) { dragged(event, d, this); })
                .on('end', function (event, d) { dragEnded(event, d, simulation, this, convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed)); updateStatistics(); })
        )
        .on('contextmenu', function (event, d) {
            event.preventDefault();
            event.stopPropagation();

            // Create context menu
            const menuElement = document.createElement('div');
            menuElement.className = 'floating-menu';
            document.body.appendChild(menuElement);
            const menu = new FloatingMenu(menuElement);

            addMenuItem(menuElement, menu, 'Color this vertex', null, (event) => {
                const vertex = d3.select(this);

                showColorPicker(
                    event.clientX,
                    event.clientY,
                    d3.color(vertex.attr("fill") || "#000000").formatHex(),
                    color => vertex.attr("fill", color)
                );
            });

            // Change Node Label Option
            addMenuItem(menuElement, menu, 'Change node value', null, () => {
                let newLabel = prompt("Enter new label for this vertex:", d.label !== undefined ? d.label : d.id);
                if (newLabel) {
                    newLabel = newLabel.toUpperCase();

                    let uniqueId = newLabel;
                    let counter = 1;
                    while (nodes.some(node => node.id === uniqueId)) {
                        uniqueId = `${newLabel}_${counter++}`;
                    }

                    const oldId = d.id;

                    // Update both the internal ID and the visual label
                    d.id = uniqueId;
                    d.label = newLabel;

                    // Update edgesRaw to use the unique internal ID, not the visual label
                    edgesRaw.forEach(edge => {
                        if (edge.source === oldId) edge.source = uniqueId;
                        if (edge.target === oldId) edge.target = uniqueId;
                    });

                    // Visually update the labels on screen
                    labelLayer.selectAll('.node-label').text(n => n.label !== undefined ? n.label : n.id);

                    // Resize this node's rect to fit the new label
                    d3.select(this).call(sizeNodeRect);

                    // Update source/target attributes on links if you depend on them for selections
                    link.attr('source-id', e => `${arrowId}${e.source.id}`)
                        .attr('target-id', e => `${arrowId}${e.target.id}`);
                }
                updateStatistics();
            });

            // Create new edge
            addMenuItem(menuElement, menu, 'Create new edge from this vertex', null, () => {
                let targetId = prompt("Enter target vertex id:").toUpperCase();
                if (!targetId) {
                    return;
                }
                const targetNode = nodes.find(n => n.id === targetId);
                if (!targetNode) {
                    alert("Target vertex does not exist.");
                    return;
                }
                let weight = 1;
                if (weighted) {
                    let w = prompt("Enter weight for this edge:", "1");
                    if (w === null) {
                        return;
                    }
                    weight = parseFloat(w);
                    if (isNaN(weight)) {
                        alert("Invalid weight.");
                        return;
                    }
                }
                // Check if the reverse edge exists (i.e., bidirectional)
                const reverseEdge = edges.find(e => e.source === targetNode && e.target === d);
                const isSelfLoop = d.id === targetId;
                if (isSelfLoop) {
                    edges.push({ source: d, target: targetNode, weight, selfLoop: true })
                } else if (reverseEdge) {
                    // Mark both edges as bidirectional
                    edges.push({ source: d, target: targetNode, weight, bidirectional: true });
                    reverseEdge.bidirectional = true;
                } else {
                    edges.push({ source: d, target: targetNode, weight });
                }

                edgesRaw.push({ source: d.id, target: targetNode.id, weight });

                // Re-bind data and redraw links and edge labels
                link = edgeLayer.selectAll('.link')
                    .data(edges)
                    .join(
                        enter => enter.append('path')
                            .attr('class', 'link')
                            .attr('source-id', d => `${arrowId}${d.source.id}`)
                            .attr('target-id', d => `${arrowId}${d.target.id}`)
                            .attr('fill', 'none')
                            .attr('stroke', edgeColor)
                            .attr('stroke-width', 4)
                            .on('mouseover', function () {
                                handleEdgeMouseOver(this, edgeHoverColor, directed, svgElement);
                            })
                            .on('mouseout', function () {
                                handleEdgeMouseOut(this, edgeColor, directed, svgElement);
                            })
                            .on('contextmenu', function (event, d) {
                                showEdgeContextMenu(event, d, svg, edgeLabel, edges, edgesRaw, node, label, directed, weighted, arrowId, link, link2, updateStatistics);
                            }),
                        update => update,
                        exit => exit.remove()
                    );

                // Re-bind data and redraw buffer links for edge hover/click
                link2 = edgeBufferLayer.selectAll('.link2')
                    .data(edges)
                    .join(
                        enter => enter.append('path')
                            .attr('class', 'link2')
                            .attr('fill', 'none')
                            .attr('stroke', 'transparent')
                            .attr('stroke-width', 20)
                            .style('pointer-events', 'stroke')
                            .on('mouseover', function (event, d) {
                                const selector = `.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`;
                                d3.select(selector).dispatch('mouseover');
                            })
                            .on('mouseout', function (event, d) {
                                const selector = `.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`;
                                d3.select(selector).dispatch('mouseout');
                            })
                            .on('contextmenu', function (event, d) {
                                const selector = `.link[source-id='${arrowId}${d.source.id}'][target-id='${arrowId}${d.target.id}']`;
                                d3.select(selector).node().dispatchEvent(new MouseEvent('contextmenu', {
                                    bubbles: false,
                                    cancelable: true,
                                    clientX: event.clientX,
                                    clientY: event.clientY,
                                    view: window
                                }));
                            }),
                        update => update,
                        exit => exit.remove()
                    );

                // If weighted, update edge labels
                if (weighted) {
                    edgeLabel.exit().remove();
                    edgeLabel = labelLayer.selectAll('.edge-label')
                        .data(edges)
                        .join(
                            enter => enter.append('text')
                                .attr('class', 'edge-label')
                                .text(d => d.weight),
                            update => update.text(d => d.weight),
                            exit => exit.remove()
                        );
                }

                // Update positions
                setEdgePositions(link, edgeLabel, node, label, directed, weighted, svg, arrowId);
                setEdgePositions(link2, edgeLabel, node, label, directed, weighted, svg, arrowId);
                updateStatistics();
            });

            // Delete vertex option
            if (!isTreeType) {
                // Delete node option
                addMenuItem(menuElement, menu, 'Delete this vertex', null, () => {
                    // Remove the node from the nodes array
                    const idx = nodes.indexOf(d);
                    if (idx !== -1) {
                        nodes.splice(idx, 1);
                        edges = edges.filter(edge => edge.source !== d && edge.target !== d); // Remove edges connected to this node
                        edgesRaw = edgesRaw.filter(edge => edge.source !== d.id && edge.target !== d.id);
                    }
                    // Remove the node visually
                    d3.select(this).remove();
                    // Remove labels associated with this node
                    label.filter(l => l === d).remove();
                    if (edgeLabel) {
                        edgeLabel.filter(e => e.source === d || e.target === d).remove();
                    }
                    // Remove edges that go to and from this node
                    link.filter(l => l.source === d || l.target === d).remove();
                    // Update edges and edgesRaw
                    edges = edges.filter(edge => edge.source.id !== d.id && edge.target.id !== d.id);
                    edgesRaw = edgesRaw.filter(edge => edge.source !== d.id && edge.target !== d.id);
                    updateStatistics();
                });
            } else {
                // Cascading Delete node option
                addMenuItem(menuElement, menu, 'Delete this vertex and its subtree', null, () => {
                    // Identify all nodes in the subtree rooted at this node (d)
                    const idsToDelete = new Set([d.id]);
                    const queue = [d.id];

                    // Traverse downward to find all descendants
                    while (queue.length > 0) {
                        const currentId = queue.shift();

                        edgesRaw.forEach(edge => {
                            if (edge.source === currentId && !idsToDelete.has(edge.target)) {
                                idsToDelete.add(edge.target);
                                queue.push(edge.target);
                            }
                        });
                    }

                    // Remove the nodes from the data array
                    for (let i = nodes.length - 1; i >= 0; i--) {
                        if (idsToDelete.has(nodes[i].id)) {
                            nodes.splice(i, 1);
                        }
                    }

                    // Remove edges connected to ANY of the deleted nodes from the data arrays
                    edges = edges.filter(edge => !idsToDelete.has(edge.source.id) && !idsToDelete.has(edge.target.id));
                    edgesRaw = edgesRaw.filter(edge => !idsToDelete.has(edge.source) && !idsToDelete.has(edge.target));

                    // Remove the visual elements using D3 filters

                    // Remove node circles
                    node.filter(n => idsToDelete.has(n.id)).remove();

                    // Remove node text labels
                    label.filter(n => idsToDelete.has(n.id)).remove();

                    // Remove links (edges)
                    link.filter(e => idsToDelete.has(e.source.id) || idsToDelete.has(e.target.id)).remove();

                    // Remove buffer links (invisible wider paths for easier clicking/hovering)
                    if (typeof link2 !== 'undefined' && link2) {
                        link2.filter(e => idsToDelete.has(e.source.id) || idsToDelete.has(e.target.id)).remove();
                    }

                    // Remove edge labels if the graph is weighted
                    if (typeof edgeLabel !== 'undefined' && edgeLabel) {
                        edgeLabel.filter(e => idsToDelete.has(e.source.id) || idsToDelete.has(e.target.id)).remove();
                    }

                    // Reassign the active D3 selections so subsequent updates or drag events don't throw errors
                    node = nodeLayer.selectAll('.node');
                    label = labelLayer.selectAll('.node-label');
                    link = edgeLayer.selectAll('.link');

                    if (typeof link2 !== 'undefined' && link2) {
                        link2 = edgeBufferLayer.selectAll('.link2');
                    }
                    if (typeof edgeLabel !== 'undefined' && edgeLabel) {
                        edgeLabel = labelLayer.selectAll('.edge-label');
                    }
                    updateStatistics();
                });
            }

            menu.show(event);
        });

    // Add labels for nodes
    let label = labelLayer.selectAll('text')
        .data(nodes)
        .enter()
        .append('text')
        .attr('dy', 7)
        .attr('text-anchor', 'middle')
        .text(d => d.label !== undefined ? d.label : d.id)
        .attr('class', 'node-label')
        .style('pointer-events', 'none')
        .style('font-weight', 'bold');

    // Add labels for edges (weights) if weighted
    let edgeLabel;
    if (weighted) {
        edgeLabel = labelLayer.selectAll('.edge-label')
            .data(edges)
            .enter()
            .append('text')
            .attr('class', 'edge-label')
            .text(d => d.weight)
            .style('pointer-events', 'none')
    }
    /* End of graph drawing */

    /* Functions to update positions */
    autoLayoutNodes(nodes, simulation, width, height, edgesRaw, isTreeType); // Initial call to generate the graph

    // Apply positions to nodes
    positionNode(node);
    adjustViewBox(svg, nodes, grid); // Initial call to center the graph

    // Update positions on simulation
    simulation.on('tick', () => {
        setEdgePositions(link, edgeLabel, node, label, directed, weighted, svg, arrowId);
        setEdgePositions(link2, edgeLabel, node, label, directed, weighted, svg, arrowId);
    });
    /* End of functions to update positions */

    /* Graph statistics */
    const about = new AboutBox();
    container.appendChild(about.element);

    const aboutContent = document.createElement("span");
    aboutContent.classList.add("about-content");

    const aboutType = document.createElement("b");
    aboutType.textContent = isTreeType ? "Tree" : "Graph";
    aboutContent.append("Type: ", aboutType, document.createElement("br"));

    const aboutVC = document.createElement("b");
    aboutVC.textContent = nodes.length
    aboutContent.append("Vertex count: ", aboutVC, document.createElement("br"));

    const aboutEC = document.createElement("b");
    aboutEC.textContent = edgesRaw.length
    aboutContent.append("Edge count: ", aboutEC, document.createElement("br"));

    const aboutDirected = document.createElement("b");
    aboutDirected.textContent = directed ? "Yes" : "No";
    aboutContent.append("Directed: ", aboutDirected, document.createElement("br"));

    const aboutWeighted = document.createElement("b");
    aboutWeighted.textContent = weighted ? "Yes" : "No";
    aboutContent.append("Weighted: ", aboutWeighted, document.createElement("br"));

    const aboutCycle = document.createElement("b");
    aboutCycle.textContent = hasCycle(edgesRaw) ? "Yes" : "No";
    aboutContent.append("Cycle: ", aboutCycle);

    const aboutBST = document.createElement("b");
    const aboutAVL = document.createElement("b");
    const aboutB = document.createElement("b");
    const aboutBPlus = document.createElement("b");
    if (isTreeType) {
        aboutContent.append(document.createElement("br"), document.createElement("br"));
        aboutContent.append("Tree specific attributes", document.createElement("br"));

        aboutBST.textContent = isBSTJSON(convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed)).valid ? "Yes" : "No";
        aboutContent.append("BST: ", aboutBST, document.createElement("br"));

        aboutAVL.textContent = isAVLJSON(convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed)).valid ? "Yes" : "No";
        aboutContent.append("AVL: ", aboutAVL, document.createElement("br"));

        aboutB.textContent = isBJSON(convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed)).valid ? "Yes" : "No";
        aboutContent.append("B: ", aboutB, document.createElement("br"));

        aboutBPlus.textContent = isBPlusJSON(convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed)).valid ? "Yes" : "No";
        aboutContent.append("B+: ", aboutBPlus);
    }

    about.appendChild(aboutContent);
    updateStatistics();
    /* End of graph statistics */

    /* Dynamically update graph about section and algorithms */
    function updateStatistics() {
        aboutVC.textContent = nodes.length;
        aboutEC.textContent = edgesRaw.length;
        aboutCycle.textContent = hasCycle(edgesRaw) ? "Yes" : "No";
        if (isTreeType) {
            if (isBSTJSON(convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed)).valid) {
                aboutBST.textContent = "Yes";
                for (const option of methodsSelect) {
                    if (option.value === "BSTI" || option.value === "BSTD" || option.value === "AVLB") {
                        option.style.display = "block";
                    }
                }
            } else {
                aboutBST.textContent = "No";
                for (const option of methodsSelect) {
                    if (option.value === "BSTI" || option.value === "BSTD" || option.value === "AVLB") {
                        option.style.display = "none";
                    }
                }
            }

            if (isAVLJSON(convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed)).valid) {
                aboutAVL.textContent = "Yes";
                for (const option of methodsSelect) {
                    if (option.value === "AVLI" || option.value === "AVLD") {
                        option.style.display = "block";
                    }
                }
            } else {
                aboutAVL.textContent = "No";
                for (const option of methodsSelect) {
                    if (option.value === "AVLI" || option.value === "AVLD") {
                        option.style.display = "none";
                    }
                }
            }

            if (isBJSON(convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed)).valid) {
                aboutB.textContent = "Yes";
                for (const option of methodsSelect) {
                    if (option.value === "BI" || option.value === "BD") {
                        option.style.display = "block";
                    }
                }
            } else {
                aboutB.textContent = "No";
                for (const option of methodsSelect) {
                    if (option.value === "BI" || option.value === "BD") {
                        option.style.display = "none";
                    }
                }
            }

            if (isBPlusJSON(convertToTreeJSON(stringifyEdges(edgesRaw), svg, directed)).valid) {
                aboutBPlus.textContent = "Yes";
                for (const option of methodsSelect) {
                    if (option.value === "BPlusI" || option.value === "BPlusD") {
                        option.style.display = "block";
                    }
                }
            } else {
                aboutBPlus.textContent = "No";
                for (const option of methodsSelect) {
                    if (option.value === "BPlusI" || option.value === "BPlusD") {
                        option.style.display = "none";
                    }
                }
            }
        }
    }
    /* End of dynamic stats updation */
};