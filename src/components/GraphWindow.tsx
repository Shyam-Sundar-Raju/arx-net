import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GraphCanvas } from './GraphCanvas';
import type { Node, Edge } from '../types';
import { getSnapPosition } from '../lib/layoutUtils';
import { bfs, dfs, dijkstra, mst, topologicalSort, vertexExists } from '../lib/algorithms';

interface GraphWindowProps {
  id: number;
  title: string;
  initialX: string | number;
  initialY: string | number;
  initialWidth?: string | number;
  initialHeight?: string | number;
  isActive: boolean;
  isSnapped: boolean;
  viewMode: 'default' | 'grid4' | 'grid9';
  nodes: Node[];
  edges: Edge[];
  isDirected: boolean;
  isWeighted: boolean;
  onFocus: (shouldCenter?: boolean) => void;
  onClose: () => void;
  onMinimize: () => void;
  onAddEdge: (source: string, target: string, weight: number) => void;
  onDeleteVertex: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onAddVertex: (nodeId: string, x: number, y: number) => void;
  onUpdateEdgeWeight: (edgeId: string, newWeight: number) => void;
  onCreateNewGraph: (data: {
    name: string;
    nodes: Node[];
    edges: Edge[];
    isDirected: boolean;
    isWeighted: boolean;
  }) => void;
}

export const GraphWindow: React.FC<GraphWindowProps> = ({
  title, initialX, initialY, initialWidth, initialHeight,
  isActive, isSnapped,
  nodes, edges, isDirected, isWeighted, viewMode,
  onFocus, onClose, onMinimize,
  onAddEdge, onDeleteVertex, onDeleteEdge, onAddVertex, onUpdateEdgeWeight,
  onCreateNewGraph
}) => {

  // --- Local State ---
  const [position, setPosition] = useState({
    x: initialX, y: initialY, width: initialWidth || 600, height: initialHeight || 450
  });
  const [isFullScreen, setIsFullScreen] = useState(false);
  // Pre-full screen position not used, removed to fix lint warning

  // Popup States
  const [isAddingEdge, setIsAddingEdge] = useState(false);
  const [edgeTarget, setEdgeTarget] = useState('');
  const [edgeWeight, setEdgeWeight] = useState(1);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [newNodeId, setNewNodeId] = useState('');
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [editWeightVal, setEditWeightVal] = useState(1);

  // --- ALGORITHM STATE ---
  const [selectedAlgo, setSelectedAlgo] = useState('');
  const [startNodeInput, setStartNodeInput] = useState('');
  const [algoResults, setAlgoResults] = useState<{ content: React.ReactNode; timestamp: string }[]>([]);
  const [showResultBoard, setShowResultBoard] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const graphCanvasRef = useRef<{ resetLayout: () => void }>(null);


  const [useForce, setUseForce] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; type: 'node' | 'edge' | 'canvas'; data: any
  } | null>(null);

  useEffect(() => {
    setPosition({ x: initialX, y: initialY, width: initialWidth || 600, height: initialHeight || 450 });
  }, [initialX, initialY, initialWidth, initialHeight]);

  const [isResizing, setIsResizing] = useState(false);

  // --- Handlers (Drag, Resize, etc.) ---
  const handleDragStart = (e: React.MouseEvent) => {
    if (isFullScreen) return;
    e.preventDefault();
    e.stopPropagation(); // Prevent bubbling to container click
    onFocus(false); // Don't center on drag
    const currentX = containerRef.current?.offsetLeft || 0;
    const currentY = containerRef.current?.offsetTop || 0;
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (rafRef.current) return;
      const moveX = moveEvent.clientX; // Capture values
      const moveY = moveEvent.clientY;
      const target = moveEvent.target as HTMLElement;

      rafRef.current = requestAnimationFrame(() => {
        const dx = moveX - startMouseX;
        const dy = moveY - startMouseY;
        const parent = target.closest('.main-workspace');
        const parentW = parent ? parent.clientWidth : window.innerWidth;
        const parentH = parent ? parent.clientHeight : window.innerHeight;
        const snapped = getSnapPosition(currentX + dx, currentY + dy, isSnapped, viewMode, parentW, parentH);
        setPosition(prev => ({ ...prev, x: snapped.x, y: snapped.y }));
        rafRef.current = null;
      });
    };
    const handleMouseUp = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const toggleFullScreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFullScreen(!isFullScreen);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX; const startY = e.clientY;
    const startW = containerRef.current?.offsetWidth || 600;
    const startH = containerRef.current?.offsetHeight || 450;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (rafRef.current) return;
      const moveX = moveEvent.clientX;
      const moveY = moveEvent.clientY;

      rafRef.current = requestAnimationFrame(() => {
        setPosition(prev => ({ ...prev, width: Math.max(300, startW + (moveX - startX)), height: Math.max(200, startH + (moveY - startY)) }));
        rafRef.current = null;
      });
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  const minimizeWindow = (e: React.MouseEvent) => { e.stopPropagation(); onMinimize(); };


  // --- ALGORITHM LOGIC ---
  const handleRunAlgorithm = () => {
    if (!selectedAlgo) return;

    const addResultToHistory = (result: React.ReactNode) => {
      setAlgoResults(prev => [{
        content: result,
        timestamp: new Date().toLocaleTimeString()
      }, ...prev]);
      setShowResultBoard(true);
    };

    if (nodes.length === 0) {
      addResultToHistory("Graph is empty.");
      return;
    }

    const start = startNodeInput.trim() || nodes[0].id;
    if (['BFS', 'DFS', 'Dijkstra'].includes(selectedAlgo)) {
      if (!vertexExists(nodes, start)) {
        addResultToHistory(<span style={{ color: 'red' }}>Error: Start node "{start}" does not exist.</span>);
        return;
      }
    }

    let resultUI: React.ReactNode = null;
    try {
      switch (selectedAlgo) {
        case 'BFS':
          const bfsRes = bfs(edges, start, isDirected);
          resultUI = (
            <div>
              <strong>BFS Traversal (Start: {start}):</strong><br />
              {bfsRes.join(' → ')}
            </div>
          );
          break;

        case 'DFS':
          const dfsRes = dfs(edges, start, isDirected);
          resultUI = (
            <div>
              <strong>DFS Traversal (Start: {start}):</strong><br />
              {dfsRes.join(' → ')}
            </div>
          );
          break;

        case 'Dijkstra':
          const dijkstraRes = dijkstra(edges, start, nodes, isDirected);
          resultUI = (
            <div>
              <strong>Shortest Paths (Start: {start}):</strong>
              <table style={{ width: '100%', marginTop: '5px', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #555', textAlign: 'left' }}>
                    <th style={{ padding: '4px' }}>Node</th>
                    <th style={{ padding: '4px' }}>Dist</th>
                    <th style={{ padding: '4px' }}>Path</th>
                  </tr>
                </thead>
                <tbody>
                  {dijkstraRes.map(r => (
                    <tr key={r.vertex} style={{ borderBottom: '1px solid #333' }}>
                      <td style={{ padding: '4px', color: 'var(--accent)' }}>{r.vertex}</td>
                      <td style={{ padding: '4px' }}>{r.distance}</td>
                      <td style={{ padding: '4px', color: '#aaa' }}>{r.path.join(' → ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          break;

        case 'MST':
          if (isDirected) {
            resultUI = <span style={{ color: 'orange' }}>Note: MST is usually defined for undirected graphs. Result might be incorrect for directed graphs.</span>;
          }
          const mstRes = mst(edges, nodes);
          const totalWeight = mstRes.reduce((acc, curr) => acc + (curr.weight || 0), 0);

          onCreateNewGraph({
            name: `${title}_MST`,
            nodes: JSON.parse(JSON.stringify(nodes)),
            edges: mstRes,
            isDirected: false,
            isWeighted: true
          });

          resultUI = (
            <div>
              {resultUI}
              <strong>Minimum Spanning Tree (Total Weight: {totalWeight}):</strong>
              <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                {mstRes.map((e, i) => (
                  <li key={i}>
                    {typeof e.source === 'object' ? (e.source as any).id : e.source}
                    —
                    {typeof e.target === 'object' ? (e.target as any).id : e.target}
                    (Weight: {e.weight})
                  </li>
                ))}
              </ul>
            </div>
          );
          // For MST, we don't force show the result board because we opened a new window
          setAlgoResults(prev => [{
            content: resultUI,
            timestamp: new Date().toLocaleTimeString()
          }, ...prev]);
          return;
          break;

        case 'TopologicalSort':
          if (!isDirected) {
            resultUI = <span style={{ color: 'red' }}>Error: Topological Sort requires a Directed Graph.</span>;
          } else {
            try {
              const topoRes = topologicalSort(edges, nodes);
              resultUI = (
                <div>
                  <strong>Topological Sort:</strong><br />
                  {topoRes.join(' → ')}
                </div>
              );
            } catch (err) {
              resultUI = <span style={{ color: 'red' }}>Error: Cycle detected (Graph is not a DAG).</span>;
            }
          }
          break;

        default:
          resultUI = "Algorithm not implemented.";
      }
    } catch (e: any) {
      resultUI = <span style={{ color: 'red' }}>Error: {e.message}</span>;
    }

    if (resultUI) {
      addResultToHistory(resultUI);
    }
  };


  // ... Save Handlers ...
  const handleSaveEdgeList = () => {
    const header = "Source,Target,Weight\n";
    const csvContent = edges.map(e => {
      const s = typeof e.source === 'object' ? (e.source as any).id : e.source;
      const t = typeof e.target === 'object' ? (e.target as any).id : e.target;
      return `${s},${t},${e.weight || 1}`;
    }).join("\n");
    const footer = `\nDirected: ${isDirected}, Weighted: ${isWeighted}`;
    const blob = new Blob([header + csvContent + footer], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_edges.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setContextMenu(null);
  };

  const handleSavePNG = () => {
    if (!containerRef.current) return;
    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;
    const style = getComputedStyle(document.documentElement);
    const nodeColor = style.getPropertyValue('--node-color') || '#ffc66d';
    const edgeColor = style.getPropertyValue('--edge-color') || '#a3bf60';
    const labelColor = style.getPropertyValue('--node-label-color') || '#000';
    const weightColor = style.getPropertyValue('--edge-weight-color') || '#fff';
    const bgColor = style.getPropertyValue('--bg-primary') || '#1d1d1d';

    const styleBlock = `
      <style>
        svg {
          --node-color: ${nodeColor};
          --edge-color: ${edgeColor};
          --node-label-color: ${labelColor};
          --edge-weight-color: ${weightColor};
          font-family: sans-serif;
        }
      </style>
    `;
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svg);
    svgString = svgString.replace('>', `>${styleBlock}`);
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const bbox = svg.getBoundingClientRect();
      canvas.width = bbox.width || 800;
      canvas.height = bbox.height || 600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const a = document.createElement('a');
        a.download = `${title.replace(/\s+/g, '_')}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
    setContextMenu(null);
  };

  // ... Context Menu Handlers ...
  // ... Context Menu Handlers ...
  const handleNodeContextMenu = useCallback((e: React.MouseEvent, n: any) => { e.preventDefault(); setIsAddingEdge(false); setIsEditingWeight(false); setEdgeTarget(''); setEdgeWeight(1); setContextMenu({ x: e.clientX, y: e.clientY, type: 'node', data: n }); }, []);
  const handleEdgeContextMenu = useCallback((e: React.MouseEvent, edge: any) => { e.preventDefault(); setIsAddingEdge(false); setIsAddingNode(false); setIsEditingWeight(false); setEditWeightVal(edge.weight || 1); setContextMenu({ x: e.clientX, y: e.clientY, type: 'edge', data: edge }); }, []);
  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); setIsAddingNode(false); setIsEditingWeight(false); setNewNodeId(''); setContextMenu({ x: e.clientX, y: e.clientY, type: 'canvas', data: null }); }, []);


return (
  <div
    ref={containerRef}
    className={`graphContainer ${isActive ? 'active' : ''}`}
    style={{
      position: isFullScreen ? 'fixed' : 'absolute',
      left: isFullScreen ? 0 : position.x, top: isFullScreen ? 0 : position.y,
      width: isFullScreen ? '100vw' : position.width, height: isFullScreen ? '100vh' : position.height,
      zIndex: isFullScreen ? 1000 : (isActive ? 100 : 10),
      overflow: 'hidden',
      transition: isResizing ? 'none' : 'height 0.2s, width 0.2s',
    }}
    onMouseDown={() => { onFocus(false); setContextMenu(null); }}
  >
    <div
      ref={headerRef}
      className="window-header"
      onMouseDown={handleDragStart}
      onDoubleClick={toggleFullScreen}
      style={{ cursor: 'move' }}
    >
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{title}</span>

        <label style={{ fontSize: '0.8em', display: 'flex', alignItems: 'center' }}>
          <input type="checkbox" checked={useForce} onChange={(e) => setUseForce(e.target.checked)} style={{ marginRight: '3px' }} /> Force
        </label>
        <label style={{ fontSize: '0.8em', display: 'flex', alignItems: 'center' }}>
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} style={{ marginRight: '3px' }} /> Grid
        </label>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            graphCanvasRef.current?.resetLayout();
          }}
          title="Reorder graph"
        >
          ⟳
        </button>

        {/* --- ALGORITHM CONTROLS --- */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '5px', borderLeft: '1px solid #555', paddingLeft: '5px' }}>
  <button
    onClick={(e) => {
      e.stopPropagation();
      graphCanvasRef.current?.resetLayout();
    }}
    title="Reorder graph"
    style={{
      fontSize: '0.8em',
      cursor: 'pointer',
      background: '#444',
      color: '#fff',
      border: 'none',
      padding: '2px 8px',
      borderRadius: '2px'
    }}
  >
    ⟳
  </button>

  <select
              value={selectedAlgo}
              onChange={(e) => setSelectedAlgo(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              style={{ background: '#222', color: '#fff', border: '1px solid #444', fontSize: '0.8em', padding: '2px' }}
            >
              <option value="">Algo...</option>
              <option value="BFS">BFS</option>
              <option value="DFS">DFS</option>
              <option value="Dijkstra">Dijkstra</option>
              <option value="MST">MST</option>
              <option value="TopologicalSort">Topo Sort</option>
            </select>

            {/* Show Start Node input only for relevant algorithms */}
            {(selectedAlgo === 'BFS' || selectedAlgo === 'DFS' || selectedAlgo === 'Dijkstra') && (
              <input
                type="text"
                placeholder="Start Node"
                value={startNodeInput}
                onChange={(e) => setStartNodeInput(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                style={{ width: '60px', background: '#222', color: '#fff', border: '1px solid #444', fontSize: '0.8em', padding: '2px' }}
              />
            )}

            <button
              onClick={(e) => { e.stopPropagation(); handleRunAlgorithm(); }}
              onDoubleClick={(e) => e.stopPropagation()}
              disabled={!selectedAlgo}
              style={{
                fontSize: '0.8em',
                cursor: 'pointer',
                background: selectedAlgo ? 'var(--accent)' : '#444',
                color: selectedAlgo ? '#000' : '#888',
                border: 'none',
                padding: '2px 8px',
                borderRadius: '2px'
              }}
            >
              ▶
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); setShowResultBoard(!showResultBoard); }}
              onDoubleClick={(e) => e.stopPropagation()}
              title={showResultBoard ? "Hide Results History" : "Show Results History"}
              style={{
                fontSize: '0.8em',
                cursor: 'pointer',
                background: showResultBoard ? 'var(--accent)' : '#444',
                color: showResultBoard ? '#000' : '#fff',
                border: 'none',
                padding: '2px 8px',
                borderRadius: '2px',
                marginLeft: '2px',
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
            >
              {showResultBoard ? "Hide" : "Results"}
            </button>
          </div>
        </div>

        <div className="window-controls" style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
          <button onClick={minimizeWindow} title="Minimize">_</button>
          <button onClick={toggleFullScreen} title="Toggle Fullscreen">{isFullScreen ? '↙' : '↗'}</button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} title="Close" className="close-btn">✕</button>
        </div>
      </div>

      <div className="window-content" style={{ height: 'calc(100% - 40px)', position: 'relative', display: 'flex', flexDirection: 'column' }}>

        {/* Graph Area */}
        <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
          <GraphCanvas

           ref={graphCanvasRef}  nodes={nodes} edges={edges} isDirected={isDirected} isWeighted={isWeighted}
            useForce={useForce} showGrid={showGrid}
            onNodeContextMenu={handleNodeContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            onCanvasContextMenu={handleCanvasContextMenu}
          />
        </div>

        {/* --- RESULT BOARD --- */}
        {showResultBoard && (
          <div
            className="result-board"
            style={{
              height: isFullScreen ? '200px' : '120px',
              background: '#1a1a1a',
              borderTop: '2px solid var(--accent)',
              padding: '10px',
              fontFamily: 'monospace',
              fontSize: '0.9em',
              color: '#eee',
              overflowY: 'auto',
              position: 'relative',
              flexShrink: 0
            }}
          >
            <button
              onClick={() => setShowResultBoard(false)}
              style={{ position: 'absolute', top: '5px', right: '5px', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2em', zIndex: 1 }}
            >
              ×
            </button>
            {algoResults.length === 0 ? (
              <div style={{ color: '#666', textAlign: 'center', marginTop: '20px' }}>No results yet. Run an algorithm to see output.</div>
            ) : (
              algoResults.map((res, i) => (
                <div key={i} style={{ borderBottom: i < algoResults.length - 1 ? '1px solid #333' : 'none', paddingBottom: '15px', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', color: 'var(--accent)', marginBottom: '5px' }}>
                    <span>Run #{algoResults.length - i}</span>
                    <span style={{ color: '#888' }}>{res.timestamp}</span>
                  </div>
                  {res.content}
                </div>
              ))
            )}
          </div>
        )}

        {/* Context Menu (Keep Existing) */}
        {contextMenu && (
          <div className="floating-menu" style={{ top: contextMenu.y, left: contextMenu.x, width: '200px' }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ padding: '8px', borderBottom: '1px solid #444', fontWeight: 'bold', color: 'var(--accent)' }}>
              {contextMenu.type === 'node' ? `Node: ${contextMenu.data.id}` : contextMenu.type === 'edge' ? 'Edge Actions' : 'Graph Actions'}
            </div>
            {/* 1. EDGE MENU */}
            {contextMenu.type === 'edge' && (
              !isEditingWeight ? (
                <>
                  <button onClick={() => setIsEditingWeight(true)}>Edit Weight</button>
                  <button onClick={() => { if (contextMenu.data.id) onDeleteEdge(contextMenu.data.id); setContextMenu(null); }}>Delete Edge</button>
                </>
              ) : (
                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input autoFocus type="number" value={editWeightVal} onChange={(e) => setEditWeightVal(Number(e.target.value))} style={{ width: '100%', padding: '5px', background: '#222', border: '1px solid #555', color: '#fff' }} onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateEdgeWeight(contextMenu.data.id, editWeightVal); setContextMenu(null); } }} />
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => { onUpdateEdgeWeight(contextMenu.data.id, editWeightVal); setContextMenu(null); }} style={{ flex: 1, background: 'var(--accent)', color: '#000' }}>Save</button>
                    <button onClick={() => setIsEditingWeight(false)} style={{ flex: 1, background: '#444' }}>Back</button>
                  </div>
                </div>
              )
            )}
            {/* 2. NODE MENU */}
            {contextMenu.type === 'node' && (
              !isAddingEdge ? (
                <>
                  <button onClick={() => setIsAddingEdge(true)}>Add Edge</button>
                  <button onClick={() => { onDeleteVertex(contextMenu.data.id); setContextMenu(null); }}>Delete Vertex</button>
                </>
              ) : (
                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input autoFocus type="text" placeholder="Target" value={edgeTarget} onChange={(e) => setEdgeTarget(e.target.value)} style={{ width: '100%', padding: '5px', background: '#222', border: '1px solid #555', color: '#fff' }} />
                  <input type="number" placeholder="Weight" value={edgeWeight} onChange={(e) => setEdgeWeight(Number(e.target.value))} style={{ width: '100%', padding: '5px', background: '#222', border: '1px solid #555', color: '#fff' }} />
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => { if (edgeTarget.trim()) { onAddEdge(contextMenu.data.id, edgeTarget, edgeWeight); setContextMenu(null); } }} style={{ flex: 1, background: 'var(--accent)', color: '#000' }}>Add</button>
                    <button onClick={() => setIsAddingEdge(false)} style={{ flex: 1, background: '#444' }}>Back</button>
                  </div>
                </div>
              )
            )}
            {/* 3. CANVAS MENU */}
            {contextMenu.type === 'canvas' && (
              !isAddingNode ? (
                <>
                  <button onClick={() => {
                    onFocus();
                    const parent = containerRef.current?.closest('.main-workspace');
                    if (parent) {
                      const pW = parent.clientWidth;
                      const pH = parent.clientHeight;
                      const w = typeof position.width === 'number' ? position.width : 600;
                      const h = typeof position.height === 'number' ? position.height : 450;
                      setPosition({ ...position, x: (pW - w) / 2, y: (pH - h) / 2 });
                    }
                    setContextMenu(null);
                  }}>Focus</button>
                  <button onClick={() => setIsAddingNode(true)}>Add Vertex</button>
                  <hr style={{ border: 'none', borderTop: '1px solid #444', margin: '4px 0' }} />
                  <button onClick={handleSavePNG}>Save as PNG</button>
                  <button onClick={handleSaveEdgeList}>Save as EdgeList</button>
                </>
              ) : (
                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input autoFocus type="text" placeholder="ID" value={newNodeId} onChange={(e) => setNewNodeId(e.target.value)} style={{ width: '100%', padding: '5px', background: '#222', border: '1px solid #555', color: '#fff' }} onKeyDown={(e) => { if (e.key === 'Enter' && newNodeId.trim()) { onAddVertex(newNodeId, Math.random() * 400, Math.random() * 300); setContextMenu(null); } }} />
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => { if (newNodeId.trim()) { onAddVertex(newNodeId, Math.random() * 400, Math.random() * 300); setContextMenu(null); } }} style={{ flex: 1, background: 'var(--accent)', color: '#000' }}>Add</button>
                    <button onClick={() => setIsAddingNode(false)} style={{ flex: 1, background: '#444' }}>Back</button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {!isFullScreen && (
          <div className="resize-handle bottom-right" onMouseDown={handleResizeStart} style={{ position: 'absolute', bottom: 0, right: 0, width: '15px', height: '15px', cursor: 'nwse-resize', zIndex: 20 }} />
        )}
      </div>
    </div>
  );
};