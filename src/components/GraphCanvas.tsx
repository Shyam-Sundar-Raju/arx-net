import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3';
import type { Node, Edge } from '../types';
import { createSimulation, updateForces, setEdgePositions, dragBehavior, updateGraphDimensions } from '../lib/graphRenderer';
import { getGraphExtent } from '../lib/viewUtils';

interface GraphCanvasProps {
  nodes: Node[];
  edges: Edge[];
  isDirected: boolean;
  isWeighted: boolean;
  useForce: boolean;
  showGrid: boolean;
  onNodeContextMenu?: (event: React.MouseEvent, node: Node) => void;
  onEdgeContextMenu?: (event: React.MouseEvent, edge: Edge) => void;
  onCanvasContextMenu?: (event: React.MouseEvent) => void;
}

const GraphCanvasComponent = forwardRef<
  { resetLayout: () => void },
  GraphCanvasProps
>(({ 
  nodes,
  edges,
  isDirected,
  isWeighted,
  useForce,
  showGrid,
  onNodeContextMenu,
  onEdgeContextMenu,
  onCanvasContextMenu
}, ref) => {


  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<Node, undefined> | null>(null);
  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const prevSize = useRef({ width: 0, height: 0 });
  useImperativeHandle(ref, () => ({
  resetLayout() {
    if (!simulationRef.current || !wrapperRef.current) return;
    nodes.forEach((node: any) => {
      node.fx = null;
      node.fy = null;
    });

    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;

    // restart simulation → recompute layout
    
    updateForces(
      simulationRef.current,
      edges,
      useForce,
      width,
      height
    );
    simulationRef.current.alpha(1).restart();
  }
}));


  // --- Initialize D3 Graph ---
  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current || !contentRef.current) return;

    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    const contentGroup = d3.select(contentRef.current);

    // 1. Setup Zoom Behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      // Filter: Middle Mouse OR (Left Mouse + Ctrl) OR Wheel
      .filter((event) => {
        return event.button === 1 || (event.button === 0 && event.ctrlKey) || event.type === 'wheel';
      })
      .on('zoom', (event) => {
        contentGroup.attr('transform', event.transform);
      });

    zoomBehavior.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);

    // 2. Define Grid Pattern
    svg.select('defs').remove();
    const defs = svg.append('defs');

    const pattern = defs.append('pattern')
      .attr('id', 'grid-pattern')
      .attr('width', 40)
      .attr('height', 40)
      .attr('patternUnits', 'userSpaceOnUse');

    pattern.append('path')
      .attr('d', 'M 40 0 L 0 0 0 40')
      .attr('fill', 'none')
      .attr('stroke', 'var(--grid-line-color)')
      .attr('stroke-width', 1);

    // 3. Clear Previous Graph Elements
    contentGroup.selectAll("*").remove();
    const edgeMap = new Set<string>();
    edges.forEach(e => {
      // Handle object references vs string IDs
      const s = typeof e.source === 'object' ? (e.source as any).id : e.source;
      const t = typeof e.target === 'object' ? (e.target as any).id : e.target;
      edgeMap.add(`${s}->${t}`);
    });

    edges.forEach((e: any) => {
      const s = typeof e.source === 'object' ? e.source.id : e.source;
      const t = typeof e.target === 'object' ? e.target.id : e.target;

      // Check if the reverse edge exists
      if (s !== t && edgeMap.has(`${t}->${s}`)) {
        e.bidirectional = true;
      } else {
        e.bidirectional = false;
      }

      e.selfLoop = (s === t);
    });

    // 4. Create Layers 
    const edgeLayer = contentGroup.append('g').attr('class', 'edge-layer');
    const nodeLayer = contentGroup.append('g').attr('class', 'node-layer');
    const labelLayer = contentGroup.append('g').attr('class', 'label-layer');

    // 5. Setup Simulation
    const simulation = createSimulation(nodes, width, height);
    simulationRef.current = simulation;

    // 6. Draw Edges
    const links = edgeLayer.selectAll('.link')
      .data(edges)
      .join('path')
      .attr('class', 'link')
      .attr('stroke', 'var(--edge-color)')
      .attr('stroke-width', 1.5)
      .attr('fill', 'none')
      .attr('marker-end', (d: any) => isDirected ? `url(#arrow-${d.source.id}-${d.target.id})` : null)
      .on('contextmenu', (event, d) => {
        // Stop event so it doesn't trigger the canvas context menu
        event.stopPropagation();
        event.preventDefault();
        onEdgeContextMenu?.(event, d as unknown as Edge);
      });

    // 7. Define Markers (Arrowheads)
    if (isDirected) {
      edges.forEach((e: any) => {
        const sId = typeof e.source === 'object' ? e.source.id : e.source;
        const tId = typeof e.target === 'object' ? e.target.id : e.target;
        const id = `arrow-${sId}-${tId}`;

        if (defs.select(`#${id}`).empty()) {
          defs.append('marker')
            .attr('id', id)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 25)
            .attr('refY', 0)
            .attr('markerWidth', 8)
            .attr('markerHeight', 8)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', 'var(--edge-color)');
        }
      });
    }

    // 8. Draw Nodes
    const circles = nodeLayer
      .selectAll<SVGCircleElement, any>('circle')
      .data(nodes, (d: any) => d.id)
      .join('circle')
      .attr('r', 20)
      .attr('fill', 'var(--node-color)')
      .style('cursor', 'pointer')
      .call(dragBehavior(simulation, useForce))
      .on('contextmenu', (event, d) => {
        // Stop event so it doesn't trigger the canvas context menu
        event.stopPropagation();
        event.preventDefault();
        onNodeContextMenu?.(event, d as unknown as Node);
      });

    // 9. Draw Labels
    const labels = labelLayer.selectAll('text')
      .data(nodes)
      .join('text')
      .text((d: any) => d.id)
      .attr('dy', 3)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--node-label-color)')
      .style('pointer-events', 'none')
      .style('font-weight', 'bold');

    let edgeLabels: any = null;
    if (isWeighted) {
      edgeLabels = labelLayer.selectAll('.edge-label')
        .data(edges)
        .join('text')
        .attr('class', 'edge-label')
        .text((d: any) => d.weight)
        .attr('fill', 'var(--edge-weight-color)')
        .style('font-size', '18px');
    }

    // 10. Tick Function
    simulation.on('tick', () => {
      setEdgePositions(links, edgeLabels, circles, labels, isDirected, isWeighted);
    });

    // 11. Start Forces
    updateForces(simulation, edges, useForce, width, height);
    setEdgePositions(links, edgeLabels, circles, labels, isDirected, isWeighted);

    // 12. Handle "Center Graph" on Double Click
    svg.on("dblclick", (event) => {
      // Only allow centering if clicking background
      if (event.target.tagName !== 'svg' && event.target.tagName !== 'rect') return;

      const { x, y, width: gWidth, height: gHeight } = getGraphExtent(nodes);
      const safeWidth = gWidth || 1;
      const safeHeight = gHeight || 1;

      const scale = 0.9 / Math.max(safeWidth / width, safeHeight / height);

      svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(Math.min(scale, 1))
          .translate(-x, -y)
      );
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, isDirected, isWeighted]);

  // --- Dynamic Updates ---
  useEffect(() => {
    // Force/Mode Updates
    if (simulationRef.current && wrapperRef.current) {
      // ... (existing updateForces call for Mode change)
      updateForces(
        simulationRef.current,
        edges,
        useForce,
        wrapperRef.current.clientWidth,
        wrapperRef.current.clientHeight
      );
    }
  }, [useForce]);

  // --- Resize Observer ---
  useEffect(() => {
    if (!wrapperRef.current || !simulationRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;

        // Initial check or update
        if (prevSize.current.width === 0 && prevSize.current.height === 0) {
          prevSize.current = { width, height };
          // Ensure forces usage has correct initial dimensions
          updateForces(simulationRef.current!, edges, useForce, width, height);
          continue;
        }

        if (width !== prevSize.current.width || height !== prevSize.current.height) {
          updateGraphDimensions(
            simulationRef.current!,
            nodes,
            width,
            height,
            prevSize.current.width,
            prevSize.current.height,
            useForce
          );
          prevSize.current = { width, height };
        }
      }
    });

    resizeObserver.observe(wrapperRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [edges, useForce, nodes]); // removed width/height dependencies

  // --- Zoom Helpers ---
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehavior.current) {
      d3.select(svgRef.current).transition().call(zoomBehavior.current.scaleBy, 1.2);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehavior.current) {
      d3.select(svgRef.current).transition().call(zoomBehavior.current.scaleBy, 0.8);
    }
  };

  return (
    <div ref={wrapperRef} className="graph-content" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ cursor: 'default' }}
        onContextMenu={(e: React.MouseEvent<SVGSVGElement>) => {
          if (onCanvasContextMenu) {
            onCanvasContextMenu(e);
          }
        }}
      >
        {showGrid && (
          <rect width="100%" height="100%" fill="url(#grid-pattern)" style={{ pointerEvents: 'none' }} />
        )}
        <g ref={contentRef} />
      </svg>

      <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: '5px', zIndex: 20 }}>
        <button onClick={handleZoomIn} style={zoomButtonStyle}>+</button>
        <button onClick={handleZoomOut} style={zoomButtonStyle}>-</button>
      </div>
    </div>
  );
});

export const GraphCanvas =
  React.memo(GraphCanvasComponent) as typeof GraphCanvasComponent;


const zoomButtonStyle: React.CSSProperties = {
  width: '30px',
  height: '30px',
  background: '#444',
  color: 'white',
  border: '1px solid #666',
  borderRadius: '4px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px'
};