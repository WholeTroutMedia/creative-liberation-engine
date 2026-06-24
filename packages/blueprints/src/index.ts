/**
 * @cle/blueprints
 * 
 * Implements Generative System Design whiteboards.
 * Translates component lists into structured Mermaid topologies and physical coordinates for visual maps.
 * Part of Wave 4 (Spatial OSINT & Media Canvas).
 */

export interface SystemNode {
  id: string;
  name: string;
  type: 'gateway' | 'service' | 'database' | 'queue' | 'cache';
  dependencies: string[];
  metrics: {
    latencyMs: number;
    throughputRps: number;
    health: 'nominal' | 'degraded' | 'offline';
  };
}

export interface DesignBlueprint {
  blueprintId: string;
  projectName: string;
  nodes: SystemNode[];
  mermaidDiagram: string;
  canvasLayout: {
    nodeId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
}

/**
 * Generates a system design blueprint topology from a list of required services.
 * @param projectName Name of the project topology
 * @param services List of services to include
 * @returns DesignBlueprint
 */
export function generateSystemDesignBlueprint(projectName: string, services: string[]): DesignBlueprint {
  const nodes: SystemNode[] = [];
  const blueprintId = `blueprint_${Math.random().toString(36).substring(2, 9)}`;

  // 1. Map requested services to node structures
  services.forEach((svc, index) => {
    const id = `node_${svc.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    let type: SystemNode['type'] = 'service';
    let deps: string[] = [];

    if (svc.includes('gateway') || svc.includes('ingress') || svc.includes('portal')) {
      type = 'gateway';
    } else if (svc.includes('db') || svc.includes('postgres') || svc.includes('sqlite') || svc.includes('qdrant')) {
      type = 'database';
    } else if (svc.includes('redis') || svc.includes('cache')) {
      type = 'cache';
    } else if (svc.includes('queue') || svc.includes('rabbit') || svc.includes('kafka')) {
      type = 'queue';
    }

    // Connect node dependencies logically
    if (type === 'service' && index > 0) {
      // Find gateway node
      const gateway = nodes.find(n => n.type === 'gateway');
      if (gateway) deps.push(gateway.id);
    } else if (type === 'database' || type === 'cache') {
      // Connect to services
      const svcs = nodes.filter(n => n.type === 'service');
      svcs.forEach(s => s.dependencies.push(id));
    }

    nodes.push({
      id,
      name: svc,
      type,
      dependencies: deps,
      metrics: {
        latencyMs: Math.floor(Math.random() * 8) + 1,
        throughputRps: Math.floor(Math.random() * 500) + 50,
        health: 'nominal'
      }
    });
  });

  // 2. Generate Mermaid diagram text
  let mermaid = 'graph TD\n';
  nodes.forEach(node => {
    let shapeStart = '[';
    let shapeEnd = ']';
    if (node.type === 'gateway') {
      shapeStart = '((';
      shapeEnd = '))';
    } else if (node.type === 'database') {
      shapeStart = '[(';
      shapeEnd = ')]';
    } else if (node.type === 'queue') {
      shapeStart = '>';
      shapeEnd = ']';
    }
    mermaid += `  ${node.id}${shapeStart}"${node.name} (${node.type.toUpperCase()})"${shapeEnd}\n`;
  });

  nodes.forEach(node => {
    node.dependencies.forEach(dep => {
      mermaid += `  ${dep} --> ${node.id}\n`;
    });
  });

  // 3. Generate physical coordinates layout for visual HUD
  const canvasLayout = nodes.map((node, i) => {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const col = i % cols;
    const row = Math.floor(i / cols);
    
    return {
      nodeId: node.id,
      x: 100 + col * 250,
      y: 100 + row * 200,
      width: 180,
      height: 90
    };
  });

  return {
    blueprintId,
    projectName,
    nodes,
    mermaidDiagram: mermaid,
    canvasLayout
  };
}
