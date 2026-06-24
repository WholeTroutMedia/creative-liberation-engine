import React, { useState, useEffect } from 'react';

const BRIDGE_BASE = `http://${window.location.hostname}:3901`;

export function MatrixPanel({ dispatch }) {
  const [layouts, setLayouts] = useState([]);
  const [activeLayout, setActiveLayout] = useState(null);
  const [layoutAst, setLayoutAst] = useState(null);

  const fetchLayouts = async () => {
    try {
      const res = await fetch(`${BRIDGE_BASE}/api/files`);
      const files = await res.json();
      const astFiles = files.filter(f => f.endsWith('.ast.json') && f.includes('runtime/layouts'));
      setLayouts(astFiles);
      if (astFiles.length > 0 && !activeLayout) {
        loadLayout(astFiles[0]);
      }
    } catch (e) {
      console.error('Failed to fetch layouts:', e);
    }
  };

  const loadLayout = async (path) => {
    try {
      const res = await fetch(`${BRIDGE_BASE}/api/files/read?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setActiveLayout(path);
      setLayoutAst(JSON.parse(data.content));
    } catch (e) {
      console.error('Failed to load layout AST:', e);
      setLayoutAst({ error: 'Failed to load AST or invalid JSON' });
    }
  };

  useEffect(() => {
    fetchLayouts();
    const interval = setInterval(fetchLayouts, 5000);
    return () => clearInterval(interval);
  }, []);

  const renderNode = (node, index) => {
    if (!node) return null;
    if (typeof node === 'string') return node;
    
    const { type, props = {}, children = [] } = node;
    
    // Brutalist aesthetic overrides
    const style = {
      ...(props.style || {}),
      border: props.style?.border ? '1px solid var(--cyan)' : undefined,
      background: props.style?.background === 'panel' ? 'rgba(0,0,0,0.5)' : props.style?.background,
      color: props.style?.color === 'accent' ? 'var(--cyan)' : props.style?.color,
    };

    const elementProps = {
      ...props,
      style,
      key: index,
      className: `matrix-node ${props.className || ''}`
    };

    return React.createElement(
      type || 'div',
      elementProps,
      Array.isArray(children) ? children.map((c, i) => renderNode(c, i)) : renderNode(children, 0)
    );
  };

  return (
    <div className="matrix-panel">
      <div className="matrix-sidebar">
        <div className="matrix-sidebar-title">AST LAYOUTS</div>
        {layouts.length === 0 && <div className="empty-state">No .ast.json found in runtime/layouts/</div>}
        {layouts.map(l => (
          <button 
            key={l} 
            className={`matrix-file-btn ${activeLayout === l ? 'active' : ''}`}
            onClick={() => loadLayout(l)}
          >
            {l.split('/').pop()}
          </button>
        ))}
      </div>
      <div className="matrix-viewport">
        {layoutAst ? (
          layoutAst.error ? (
            <div className="matrix-error">{layoutAst.error}</div>
          ) : (
            <div className="matrix-render-root">
              {renderNode(layoutAst, 'root')}
            </div>
          )
        ) : (
          <div className="empty-state">Select a layout AST to render</div>
        )}
      </div>
    </div>
  );
}
