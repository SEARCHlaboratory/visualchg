import cytoscape from 'cytoscape';

// Global State
let chgData = {
  hypergraph: { nodes: [], edges: [] },
  frames: { default: {} }
};
let currentFrame = 'default';
let VCHG_ELEMENT_SELECTED = null;
let VCHG_KIND_SELECTED = null; // 'NODE', 'EDGE', 'PATH', or null

// Cytoscape Instance
let cy = cytoscape({
  container: document.getElementById('cy-container'),
  style: [
    {
      selector: 'node',
      style: {
        'shape': 'ellipse',
        'background-color': 'var(--node-color)',
        'label': 'data(label)',
        'color': 'var(--text-color)',
        'text-valign': 'center',
        'text-halign': 'center',
        'border-width': 2,
        'border-color': 'var(--text-color)',
        'font-size': '12px'
      }
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 4,
        'border-color': 'var(--primary-btn)'
      }
    },
    {
      selector: '.edge-node', // Represents an edge in bipartite graph
      style: {
        'shape': 'rectangle',
        'background-color': 'var(--edge-color)',
        'label': 'data(label)',
        'width': 60,
        'height': 30,
        'text-valign': 'center',
        'text-halign': 'center'
      }
    },
    {
      selector: '.edge-node:selected',
      style: {
        'border-width': 4,
        'border-color': 'var(--primary-btn)'
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': 'var(--arrow-color)',
        'target-arrow-color': 'var(--arrow-color)',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'opacity': 0.6
      }
    },
    {
      selector: '.path-highlight',
      style: {
        'background-color': '#f59e0b',
        'line-color': '#f59e0b',
        'target-arrow-color': '#f59e0b',
        'opacity': 1,
        'border-width': 3,
        'border-color': '#d97706'
      }
    }
  ],
  layout: { name: 'grid' }
});

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupTerminalToggle();
  setupLayoutControls();
  setupFileControls();
  setupSimulateControls();
  setupToggles();
  setupResizers();
  setupEntityOperations();
  
  window.selectEntity = selectEntity; // expose for inline onclick
  
  // Cy events
  cy.on('tap', 'node', (evt) => {
    const node = evt.target;
    selectEntity(node.data('label'), node.hasClass('edge-node') ? 'EDGE' : 'NODE');
  });
  
  cy.on('tap', (evt) => {
    if (evt.target === cy) {
      selectEntity(null, null);
    }
  });
});

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.target.getAttribute('data-target');
      if (targetId) {
        const panel = e.target.closest('.panel');
        if (panel) {
          panel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          panel.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
          e.target.classList.add('active');
          document.getElementById(targetId).classList.add('active');
        }
      }
    });
  });
  
  document.querySelectorAll('.term-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.target.getAttribute('data-target');
      if (targetId) {
        document.querySelectorAll('.term-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.term-pane').forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(targetId).classList.add('active');
      }
    });
  });
}

function setupTerminalToggle() {
  const btn = document.getElementById('btn-toggle-terminal');
  const panel = document.getElementById('terminal-panel');
  btn.addEventListener('click', () => {
    panel.classList.toggle('open');
    btn.classList.remove('flash');
  });
}

function setupToggles() {
  document.getElementById('btn-toggle-primary').addEventListener('click', () => {
    document.getElementById('primary-sidebar').classList.add('collapsed');
    document.getElementById('btn-expand-primary').classList.remove('hidden');
  });
  
  document.getElementById('btn-expand-primary').addEventListener('click', () => {
    document.getElementById('primary-sidebar').classList.remove('collapsed');
    document.getElementById('btn-expand-primary').classList.add('hidden');
  });
  
  document.getElementById('btn-toggle-outline').addEventListener('click', () => {
    document.getElementById('secondary-sidebar').classList.add('collapsed');
    document.getElementById('btn-expand-secondary').classList.remove('hidden');
  });
  
  document.getElementById('btn-expand-secondary').addEventListener('click', () => {
    document.getElementById('secondary-sidebar').classList.remove('collapsed');
    document.getElementById('btn-expand-secondary').classList.add('hidden');
  });
  
  document.getElementById('btn-toggle-view').addEventListener('click', () => {
    document.getElementById('layout-controls').classList.toggle('hidden');
  });
}

function setupResizers() {
  const root = document.documentElement;
  const primarySidebar = document.getElementById('primary-sidebar');
  const resizerLeft = document.getElementById('resizer-left');
  
  let isResizingLeft = false;
  resizerLeft.addEventListener('mousedown', () => {
    isResizingLeft = true;
    resizerLeft.classList.add('dragging');
  });
  
  const secondarySidebar = document.getElementById('secondary-sidebar');
  const resizerRight = document.getElementById('resizer-right');
  
  let isResizingRight = false;
  resizerRight.addEventListener('mousedown', () => {
    isResizingRight = true;
    resizerRight.classList.add('dragging');
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isResizingLeft) {
      let newWidth = e.clientX;
      if (newWidth < 100) newWidth = 100;
      if (newWidth > 600) newWidth = 600;
      root.style.setProperty('--primary-sidebar-width', `${newWidth}px`);
      // Ensure it's not collapsed
      primarySidebar.classList.remove('collapsed');
      document.getElementById('btn-expand-primary').classList.add('hidden');
    } else if (isResizingRight) {
      let newWidth = window.innerWidth - e.clientX;
      if (newWidth < 100) newWidth = 100;
      if (newWidth > 600) newWidth = 600;
      root.style.setProperty('--secondary-sidebar-width', `${newWidth}px`);
      // Ensure it's not collapsed
      secondarySidebar.classList.remove('collapsed');
      document.getElementById('btn-expand-secondary').classList.add('hidden');
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizingLeft || isResizingRight) {
      isResizingLeft = false;
      isResizingRight = false;
      resizerLeft.classList.remove('dragging');
      resizerRight.classList.remove('dragging');
      // trigger resize event so cytoscape fits to new window dimensions
      window.dispatchEvent(new Event('resize'));
    }
  });
}

function setupLayoutControls() {
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const layoutName = e.target.getAttribute('data-layout');
      cy.layout({ 
        name: layoutName, 
        animate: true, 
        padding: 50, 
        spacingFactor: 0.75,
        nodeDimensionsIncludeLabels: true,
        avoidOverlap: true
      }).run();
      document.getElementById('layout-controls').classList.add('hidden');
    });
  });
}

function setupFileControls() {
  document.getElementById('select-demo').addEventListener('change', async (e) => {
    const val = e.target.value;
    if (val) {
      try {
        const res = await fetch(val);
        const data = await res.json();
        loadCHG(data);
      } catch (err) {
        logOutput('Failed to load demo: ' + err, true);
      }
    }
  });
  
  document.getElementById('btn-upload').addEventListener('click', () => {
    document.getElementById('file-upload').click();
  });
  
  document.getElementById('file-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          loadCHG(data);
        } catch (err) {
          logOutput('Invalid JSON file.', true);
        }
      };
      reader.readAsText(file);
    }
  });
  
  document.getElementById('btn-download').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(chgData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graph.chg';
    a.click();
  });
}

function loadCHG(data) {
  chgData = data;
  currentFrame = 'default';
  
  if (!chgData.frames) chgData.frames = { default: {} };
  
  // Populate Frame Select
  const frameSelect = document.getElementById('select-frame');
  frameSelect.innerHTML = '';
  Object.keys(chgData.frames).forEach(f => {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    if (f === currentFrame) opt.selected = true;
    frameSelect.appendChild(opt);
  });
  
  frameSelect.onchange = (e) => {
    currentFrame = e.target.value;
    renderGraph();
  };

  renderGraph();
  buildOutline();
  selectEntity(null, null);
  logOutput('Loaded CHG file successfully.');
}

function renderGraph() {
  cy.elements().remove();
  
  const nodes = chgData.hypergraph.nodes || [];
  const edges = chgData.hypergraph.edges || [];
  
  const cyElements = [];
  
  // Add Nodes
  nodes.forEach(n => {
    cyElements.push({
      group: 'nodes',
      data: { id: `N_${n.label}`, label: n.label, type: 'NODE' }
    });
  });
  
  // Add Edges (as nodes in bipartite graph)
  edges.forEach(e => {
    cyElements.push({
      group: 'nodes',
      data: { id: `E_${e.label}`, label: e.label, type: 'EDGE' },
      classes: 'edge-node'
    });
    
    // Connect sources to edge
    if (e.source_nodes) {
      Object.values(e.source_nodes).forEach(src => {
        cyElements.push({
          group: 'edges',
          data: { id: `L_${src}_${e.label}`, source: `N_${src}`, target: `E_${e.label}` }
        });
      });
    }
    
    // Connect edge to target
    if (e.target) {
      cyElements.push({
        group: 'edges',
        data: { id: `L_${e.label}_${e.target}`, source: `E_${e.label}`, target: `N_${e.target}` }
      });
    }
  });
  
  cy.add(cyElements);
  cy.layout({ 
    name: 'grid', 
    animate: true, 
    padding: 50, 
    spacingFactor: 1.5,
    nodeDimensionsIncludeLabels: true,
    avoidOverlap: true
  }).run();
}

function buildOutline() {
  const nodesTree = document.getElementById('tab-nodes');
  const edgesTree = document.getElementById('tab-edges');
  
  if(nodesTree) nodesTree.innerHTML = '';
  if(edgesTree) edgesTree.innerHTML = '';
  
  const nodes = chgData.hypergraph.nodes || [];
  const edges = chgData.hypergraph.edges || [];
  
  // Nodes Section
  nodes.forEach(n => {
    const itemContainer = document.createElement('div');
    
    const item = document.createElement('div');
    item.className = 'tree-item';
    item.innerHTML = `<span class="tree-icon icon-node"></span> ${n.label}`;
    item.dataset.label = n.label;
    item.dataset.kind = 'NODE';
    
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children hidden';
    
    item.onclick = () => {
      if (VCHG_ELEMENT_SELECTED === n.label && VCHG_KIND_SELECTED === 'NODE') {
        childrenContainer.classList.toggle('hidden');
      } else {
        selectEntity(n.label, 'NODE');
        childrenContainer.classList.remove('hidden');
      }
    };
    
    edges.forEach(e => {
      if (e.target === n.label) {
        childrenContainer.innerHTML += `<div class="tree-item" onclick="window.selectEntity('${e.label}', 'EDGE')"><span class="tree-icon icon-trailing"></span> ${e.label}</div>`;
      }
      if (e.source_nodes && Object.values(e.source_nodes).includes(n.label)) {
        childrenContainer.innerHTML += `<div class="tree-item" onclick="window.selectEntity('${e.label}', 'EDGE')"><span class="tree-icon icon-leading"></span> ${e.label}</div>`;
      }
    });
    
    itemContainer.appendChild(item);
    itemContainer.appendChild(childrenContainer);
    if(nodesTree) nodesTree.appendChild(itemContainer);
  });
  
  // Edges Section
  edges.forEach(e => {
    const itemContainer = document.createElement('div');
    
    const item = document.createElement('div');
    item.className = 'tree-item';
    item.innerHTML = `<span class="tree-icon icon-edge-square"></span> ${e.label}`;
    item.dataset.label = e.label;
    item.dataset.kind = 'EDGE';
    
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children hidden';
    
    item.onclick = () => {
      if (VCHG_ELEMENT_SELECTED === e.label && VCHG_KIND_SELECTED === 'EDGE') {
        childrenContainer.classList.toggle('hidden');
      } else {
        selectEntity(e.label, 'EDGE');
        childrenContainer.classList.remove('hidden');
      }
    };
    
    if (e.source_nodes) {
      Object.values(e.source_nodes).forEach(src => {
        childrenContainer.innerHTML += `<div class="tree-item" onclick="window.selectEntity('${src}', 'NODE')"><span class="tree-icon icon-source-node"></span> ${src}</div>`;
      });
    }
    if (e.target) {
      childrenContainer.innerHTML += `<div class="tree-item" onclick="window.selectEntity('${e.target}', 'NODE')"><span class="tree-icon icon-target-node"></span> ${e.target}</div>`;
    }
    
    itemContainer.appendChild(item);
    itemContainer.appendChild(childrenContainer);
    if(edgesTree) edgesTree.appendChild(itemContainer);
  });
}

function arrangeFocused(centerNode, leftNodes, rightNodes) {
  centerNode.position({x: 0, y: 0});
  const ySpacing = 120;
  
  const positionVertical = (nodes, startX) => {
    const totalHeight = (nodes.length - 1) * ySpacing;
    let startY = -totalHeight / 2;
    nodes.forEach(n => {
      n.position({x: startX, y: startY});
      startY += ySpacing;
    });
  };
  
  positionVertical(leftNodes, -150);
  positionVertical(rightNodes, 150);
}

function selectEntity(label, kind) {
  VCHG_ELEMENT_SELECTED = label;
  VCHG_KIND_SELECTED = kind;
  
  // Update Selection Visuals
  cy.elements().removeClass('selected hidden-node');
  document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
  
  if (label && kind) {
    const cyId = kind === 'NODE' ? `N_${label}` : `E_${label}`;
    const centerNode = cy.getElementById(cyId);
    centerNode.addClass('selected');
    
    const treeEl = document.querySelector(`.tree-item[data-label="${label}"][data-kind="${kind}"]`);
    if (treeEl) {
      treeEl.classList.add('selected');
      // Auto-expand in sidebar if selected from graph
      const childrenContainer = treeEl.nextElementSibling;
      if (childrenContainer && childrenContainer.classList.contains('tree-children')) {
        childrenContainer.classList.remove('hidden');
      }
    }
    
    // Focused Mode layout
    const leftNodes = centerNode.incomers('node');
    const rightNodes = centerNode.outgoers('node');
    const allRelevant = centerNode.neighborhood().union(centerNode);
    
    // Move non-relevant nodes/edges just off-screen in a grid
    let offscreenX = 500;
    let offscreenY = -300;
    cy.elements().difference(allRelevant).forEach(n => {
      n.position({x: offscreenX, y: offscreenY});
      offscreenY += 60;
      if (offscreenY > 300) {
        offscreenY = -300;
        offscreenX += 80;
      }
    });
    
    arrangeFocused(centerNode, leftNodes, rightNodes);
    
    // Animate to center and fixed zoom
    cy.animate({
      center: { eles: centerNode },
      zoom: 1.5
    }, {
      duration: 300
    });
  } else {
    // Reset to Display Mode
    cy.layout({ 
      name: 'grid', 
      animate: true, 
      padding: 50, 
      spacingFactor: 0.75,
      nodeDimensionsIncludeLabels: true,
      avoidOverlap: true
    }).run();
  }
  updatePropertiesPanel();
  updateSimulatePanel();
  updateStatus();
}

function updatePropertiesPanel() {
  const empty = document.getElementById('prop-empty-state');
  const content = document.getElementById('prop-content');
  const btnDelete = document.getElementById('btn-delete');
  
  if (!VCHG_ELEMENT_SELECTED) {
    empty.classList.remove('hidden');
    content.classList.add('hidden');
    if(btnDelete) btnDelete.classList.add('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  content.classList.remove('hidden');
  if(btnDelete) btnDelete.classList.remove('hidden');
  
  let html = '';
  
  if (VCHG_KIND_SELECTED === 'NODE') {
    const node = chgData.hypergraph.nodes.find(n => n.label === VCHG_ELEMENT_SELECTED);
    if (!node) return;
    
    const val = (chgData.frames[currentFrame] && chgData.frames[currentFrame][node.label]) ? 
                chgData.frames[currentFrame][node.label][0] : '';
    
    html = `
      <div class="input-group">
        <label>Label</label>
        <input type="text" id="prop-node-label" value="${node.label}" />
      </div>
      <div class="input-group">
        <label>Value (Current Frame)</label>
        <input type="text" id="prop-node-val" value="${val}" />
      </div>
      <div class="input-group mt-2">
        <label class="checkbox-label">
          <input type="checkbox" id="prop-node-const" ${node.is_constant ? 'checked' : ''} /> Constant
        </label>
      </div>
    `;
    content.innerHTML = html;
    
    // Setup listeners
    document.getElementById('prop-node-label').onchange = (e) => {
      const newLabel = e.target.value;
      if (newLabel && newLabel !== node.label) {
        // Sync to .chg file
        node.label = newLabel;
        if (chgData.frames[currentFrame] && chgData.frames[currentFrame][VCHG_ELEMENT_SELECTED]) {
          chgData.frames[currentFrame][newLabel] = chgData.frames[currentFrame][VCHG_ELEMENT_SELECTED];
          delete chgData.frames[currentFrame][VCHG_ELEMENT_SELECTED];
        }
        VCHG_ELEMENT_SELECTED = newLabel;
        renderGraph();
        buildOutline();
        selectEntity(newLabel, 'NODE');
      }
    };
    
    document.getElementById('prop-node-val').onchange = (e) => {
      const newVal = e.target.value;
      if (!chgData.frames[currentFrame]) chgData.frames[currentFrame] = {};
      
      if (newVal === '') {
        delete chgData.frames[currentFrame][node.label];
      } else {
        // try parse float
        const parsed = parseFloat(newVal);
        chgData.frames[currentFrame][node.label] = isNaN(parsed) ? [newVal] : [parsed];
      }
      updateStatus();
    };
    
    document.getElementById('prop-node-const').onchange = (e) => {
      node.is_constant = e.target.checked;
    };
    
  } else if (VCHG_KIND_SELECTED === 'EDGE') {
    const edge = chgData.hypergraph.edges.find(e => e.label === VCHG_ELEMENT_SELECTED);
    if (!edge) return;
    
    let sourcesHtml = '';
    if (edge.source_nodes) {
      Object.entries(edge.source_nodes).forEach(([key, val]) => {
        sourcesHtml += `
          <div class="source-grid" data-key="${key}">
            <input type="text" class="src-val" value="${val}" title="Source Node" />
            <input type="text" class="src-key" value="${key}" title="Key" />
            <button class="icon-btn danger btn-del-source" style="padding: 0; color: var(--danger-btn); font-size: 1.2rem; display: flex; align-items: center; justify-content: center; height: 100%;" data-key="${key}">✕</button>
          </div>
        `;
      });
    }
    
    html = `
      <div class="input-group">
        <label>Label</label>
        <input type="text" id="prop-edge-label" value="${edge.label}" />
      </div>
      <div class="input-group">
        <label>Weight</label>
        <input type="number" id="prop-edge-weight" value="${edge.weight || 0}" />
      </div>
      <div class="input-group">
        <label>Target</label>
        <input type="text" id="prop-edge-target" value="${edge.target || ''}" />
      </div>
      <div class="input-group">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <label>Sources</label>
          <button id="btn-add-source" class="icon-btn text-btn" style="font-size:1.2rem; margin:0">+</button>
        </div>
        <div class="source-grid" style="font-weight:600; font-size:0.8rem">
          <div>Label</div><div>Key</div><div></div>
        </div>
        ${sourcesHtml}
      </div>
      <div class="input-group">
        <label>Rule</label>
        <textarea class="code-block" id="prop-edge-rule">${edge.rel || ''}</textarea>
      </div>
    `;
    content.innerHTML = html;
    
    // Listeners
    const ruleInput = document.getElementById('prop-edge-rule');
    if (ruleInput) {
      ruleInput.onchange = (e) => {
        edge.rel = e.target.value;
      };
    }
    
    document.getElementById('prop-edge-label').onchange = (e) => {
      const newLabel = e.target.value;
      if (newLabel && newLabel !== edge.label) {
        edge.label = newLabel;
        VCHG_ELEMENT_SELECTED = newLabel;
        renderGraph();
        buildOutline();
        selectEntity(newLabel, 'EDGE');
      }
    };
    
    document.getElementById('prop-edge-weight').onchange = (e) => {
      edge.weight = parseFloat(e.target.value) || 0;
      updateStatus();
    };
    
    document.getElementById('prop-edge-target').onchange = (e) => {
      edge.target = e.target.value;
      renderGraph();
      buildOutline();
    };
    
    document.getElementById('btn-add-source').onclick = () => {
      if (!edge.source_nodes) edge.source_nodes = {};
      const newKey = `s${Object.keys(edge.source_nodes).length + 1}`;
      edge.source_nodes[newKey] = "";
      updatePropertiesPanel();
    };
    
    document.querySelectorAll('.btn-del-source').forEach(btn => {
      btn.onclick = (e) => {
        const key = e.target.getAttribute('data-key');
        delete edge.source_nodes[key];
        updatePropertiesPanel();
      };
    });
    
    document.querySelectorAll('.src-val').forEach(input => {
      input.onchange = (e) => {
        const key = e.target.closest('.source-grid').getAttribute('data-key');
        edge.source_nodes[key] = e.target.value;
        renderGraph();
        buildOutline();
      };
    });
    
    document.querySelectorAll('.src-key').forEach(input => {
      input.onchange = (e) => {
        const oldKey = e.target.closest('.source-grid').getAttribute('data-key');
        const newKey = e.target.value;
        if (oldKey !== newKey && newKey) {
          edge.source_nodes[newKey] = edge.source_nodes[oldKey];
          delete edge.source_nodes[oldKey];
        }
        edge.source_nodes[newKey] = newVal;
        renderGraph();
        buildOutline();
        selectEntity(VCHG_ELEMENT_SELECTED, 'EDGE');
      };
      
      valInput.onchange = updateSources;
      keyInput.onchange = updateSources;
    });
    
    document.getElementById('prop-edge-rule').onchange = (e) => {
      edge.rel = e.target.value;
    };
  }
}

function setupEntityOperations() {
  const btnAddNode = document.getElementById('btn-add-node');
  const btnAddEdge = document.getElementById('btn-add-edge');
  const btnDelete = document.getElementById('btn-delete');
  
  if (btnAddNode) {
    btnAddNode.addEventListener('click', () => {
      if (!chgData.hypergraph.nodes) chgData.hypergraph.nodes = [];
      const label = 'NewNode_' + Date.now().toString().slice(-4);
      chgData.hypergraph.nodes.push({ label: label, is_constant: false });
      renderGraph();
      buildOutline();
      selectEntity(label, 'NODE');
    });
  }
  
  if (btnAddEdge) {
    btnAddEdge.addEventListener('click', () => {
      if (!chgData.hypergraph.edges) chgData.hypergraph.edges = [];
      const label = 'NewEdge_' + Date.now().toString().slice(-4);
      chgData.hypergraph.edges.push({ label: label, target: "", source_nodes: {} });
      renderGraph();
      buildOutline();
      selectEntity(label, 'EDGE');
    });
  }
  
  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      if (!VCHG_ELEMENT_SELECTED) return;
      
      if (VCHG_KIND_SELECTED === 'NODE') {
        chgData.hypergraph.nodes = chgData.hypergraph.nodes.filter(n => n.label !== VCHG_ELEMENT_SELECTED);
        if (chgData.frames[currentFrame]) {
          delete chgData.frames[currentFrame][VCHG_ELEMENT_SELECTED];
        }
      } else if (VCHG_KIND_SELECTED === 'EDGE') {
        chgData.hypergraph.edges = chgData.hypergraph.edges.filter(e => e.label !== VCHG_ELEMENT_SELECTED);
      }
      
      VCHG_ELEMENT_SELECTED = null;
      VCHG_KIND_SELECTED = null;
      renderGraph();
      buildOutline();
      updatePropertiesPanel();
      updateSimulatePanel();
      updateStatus();
    });
  }
}

function updateStatus() {
  const statusText = document.getElementById('status-text');
  if (!VCHG_ELEMENT_SELECTED) {
    statusText.textContent = 'Ready';
  } else {
    if (VCHG_KIND_SELECTED === 'NODE') {
      const node = chgData.hypergraph.nodes.find(n => n.label === VCHG_ELEMENT_SELECTED);
      const val = (chgData.frames[currentFrame] && chgData.frames[currentFrame][VCHG_ELEMENT_SELECTED]) ? chgData.frames[currentFrame][VCHG_ELEMENT_SELECTED][0] : '';
      statusText.textContent = `${VCHG_ELEMENT_SELECTED}: ${val}`;
    } else if (VCHG_KIND_SELECTED === 'EDGE') {
      const edge = chgData.hypergraph.edges.find(e => e.label === VCHG_ELEMENT_SELECTED);
      statusText.textContent = `${VCHG_ELEMENT_SELECTED}: ${edge ? (edge.weight || 0) : ''}`;
    } else if (VCHG_KIND_SELECTED === 'PATH') {
      const edgeCount = cy.elements('.path-highlight').filter('node.edge-node').length;
      statusText.textContent = `Path with ${edgeCount} edges`;
    }
  }
}

function logOutput(msg, isError = false) {
  const log = document.getElementById('output-log');
  log.textContent += `\n[${new Date().toLocaleTimeString()}] ${isError ? 'ERROR: ' : ''}${msg}`;
  log.scrollTop = log.scrollHeight;
  
  const panel = document.getElementById('terminal-panel');
  if (!panel.classList.contains('open')) {
    const btn = document.getElementById('btn-toggle-terminal');
    btn.classList.add('flash');
    setTimeout(() => btn.classList.remove('flash'), 3000);
  }
}

function updateSimulatePanel() {
  const empty = document.getElementById('sim-empty-state');
  const content = document.getElementById('sim-content');
  
  if (VCHG_ELEMENT_SELECTED && (VCHG_KIND_SELECTED === 'NODE' || VCHG_KIND_SELECTED === 'PATH')) {
    empty.classList.add('hidden');
    content.classList.remove('hidden');
  } else {
    empty.classList.remove('hidden');
    content.classList.add('hidden');
  }
}

// Simulate
function setupSimulateControls() {
  document.getElementById('sim-debug-nodes').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value) {
      addTag('debug-nodes-tags', e.target.value);
      e.target.value = '';
    }
  });
  document.getElementById('sim-debug-edges').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value) {
      addTag('debug-edges-tags', e.target.value);
      e.target.value = '';
    }
  });
  
  document.getElementById('btn-run-sim').addEventListener('click', async () => {
    if (!VCHG_ELEMENT_SELECTED || VCHG_KIND_SELECTED !== 'NODE') {
      logOutput('Please select a Node to simulate as the target.', true);
      return;
    }
    
    logOutput(`Starting simulation for target node: ${VCHG_ELEMENT_SELECTED}...`);
    
    // Gather params
    const min_index = parseInt(document.getElementById('sim-min-index').value) || 0;
    const to_print = document.getElementById('sim-show-steps').checked;
    const log_level = parseInt(document.getElementById('sim-log-level').value) || 0;
    
    const dNodes = Array.from(document.getElementById('debug-nodes-tags').children).map(c => c.dataset.val);
    const dEdges = Array.from(document.getElementById('debug-edges-tags').children).map(c => c.dataset.val);
    
    try {
      if (window.py_run_simulation) {
        const file_data = JSON.stringify(chgData);
        // Pyodide call
        const resStr = await window.py_run_simulation(file_data, VCHG_ELEMENT_SELECTED, currentFrame, min_index, to_print, log_level, dNodes, dEdges);
        const res = JSON.parse(resStr);
        if (res.success) {
          logOutput(`Simulation success. Cost: ${res.cost}, Value: ${res.value}`);
          highlightPath(res.path_nodes, res.path_edges);
        } else {
          logOutput(`Simulation failed: ${res.error}`, true);
        }
      } else {
        logOutput('Python bridge not ready.', true);
      }
    } catch(err) {
      logOutput(`Error executing simulation: ${err}`, true);
    }
  });
}

function addTag(containerId, val) {
  const container = document.getElementById(containerId);
  const tag = document.createElement('div');
  tag.className = 'tag';
  tag.dataset.val = val;
  tag.innerHTML = `${val} <span class="tag-close">X</span>`;
  tag.querySelector('.tag-close').onclick = () => tag.remove();
  container.appendChild(tag);
}

function highlightPath(nodes, edges) {
  cy.elements().removeClass('path-highlight');
  
  const pathEles = [];
  nodes.forEach(n => pathEles.push(cy.getElementById(`N_${n}`)));
  edges.forEach(e => pathEles.push(cy.getElementById(`E_${e}`)));
  
  const collection = cy.collection(pathEles.filter(e => e.length > 0));
  collection.addClass('path-highlight');
  
  // Highlight connecting edges between path elements
  collection.edgesWith(collection).addClass('path-highlight');
  
  cy.fit(collection, 50);
  VCHG_KIND_SELECTED = 'PATH';
  updateStatus();
}
