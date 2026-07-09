import cytoscape from 'cytoscape';

// Global State
let chgData = null;
let loadedFiles = {};
let currentFileName = null;
let currentFrame = 'default';
let VCHG_ELEMENT_SELECTED = null;
let VCHG_KIND_SELECTED = null; // 'NODE', 'EDGE', 'PATH', or null

// History state
window.undoStacks = {};
window.redoStacks = {};

window.updateHistoryUI = function () {
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  if (!btnUndo || !btnRedo) return;

  const canUndo = currentFileName && window.undoStacks[currentFileName] && window.undoStacks[currentFileName].length > 0;
  const canRedo = currentFileName && window.redoStacks[currentFileName] && window.redoStacks[currentFileName].length > 0;

  if (canUndo) btnUndo.classList.remove('disabled');
  else btnUndo.classList.add('disabled');

  if (canRedo) btnRedo.classList.remove('disabled');
  else btnRedo.classList.add('disabled');
}

window.pushHistory = function () {
  if (!currentFileName || !chgData) return;
  if (!window.undoStacks[currentFileName]) window.undoStacks[currentFileName] = [];
  if (!window.redoStacks[currentFileName]) window.redoStacks[currentFileName] = [];

  window.undoStacks[currentFileName].push(JSON.stringify(chgData));
  if (window.undoStacks[currentFileName].length > 50) {
    window.undoStacks[currentFileName].shift();
  }

  window.redoStacks[currentFileName] = [];
  window.updateHistoryUI();
}

window.undoHistory = function () {
  if (!currentFileName || !window.undoStacks[currentFileName] || window.undoStacks[currentFileName].length === 0) return;
  const stack = window.undoStacks[currentFileName];
  if (!window.redoStacks[currentFileName]) window.redoStacks[currentFileName] = [];
  window.redoStacks[currentFileName].push(JSON.stringify(chgData));

  const prevState = stack.pop();
  chgData = JSON.parse(prevState);
  loadedFiles[currentFileName] = chgData;

  window.updateHistoryUI();
  renderGraph();
  buildOutline();
  updatePropertiesPanel();
  updateStatus();
}

window.redoHistory = function () {
  if (!currentFileName || !window.redoStacks[currentFileName] || window.redoStacks[currentFileName].length === 0) return;
  const stack = window.redoStacks[currentFileName];
  if (!window.undoStacks[currentFileName]) window.undoStacks[currentFileName] = [];
  window.undoStacks[currentFileName].push(JSON.stringify(chgData));

  const nextState = stack.pop();
  chgData = JSON.parse(nextState);
  loadedFiles[currentFileName] = chgData;

  window.updateHistoryUI();
  renderGraph();
  buildOutline();
  updatePropertiesPanel();
  updateStatus();
}

// Load CSS Variables for Cytoscape
const rootStyle = getComputedStyle(document.documentElement);
const getCssVar = (name) => rootStyle.getPropertyValue(name).trim();

const getInfoIcon = (msg) => `<svg class="info-icon" data-info="${msg}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

const getCyStyle = () => [
  {
    selector: 'node',
    style: {
      'shape': 'ellipse',
      'background-color': getCssVar('--node-color') || '#3b82f6',
      'label': 'data(label)',
      'color': getCssVar('--text-color') || '#ffffff',
      'text-valign': 'center',
      'text-halign': 'center',
      'border-width': 2,
      'border-color': getCssVar('--arrow-color') || '#aaaaaa',
      'font-size': '12px',
      'z-index': 10
    }
  },
  {
    selector: 'node:selected',
    style: {
      'underlay-color': getCssVar('--arrow-color') || '#3b82f6',
      'underlay-padding': 4,
      'underlay-opacity': 0.8,
    }
  },
  {
    selector: '.edge-node', // Represents an edge in bipartite graph
    style: {
      'shape': 'round-rectangle',
      'background-color': getCssVar('--edge-color') || '#10b981',
      'label': 'data(label)',
      'width': 60,
      'height': 30,
      'text-valign': 'center',
      'text-halign': 'center',
      'z-index': 10
    }
  },
  {
    selector: '.edge-node:selected',
    style: {
      'underlay-color': getCssVar('--arrow-color') || '#aaaaaa',
      'underlay-padding': 6,
      'underlay-opacity': 0.8,
      'border-color': getCssVar('--arrow-color') || '#aaaaaa'
    }
  },
  {
    selector: '.has-value',
    style: {
      'border-width': 4,
      'border-color': getCssVar('--text-color') || '#ffffff'
    }
  },
  {
    selector: '.invalid-edge',
    style: {
      'border-width': 4,
      'border-color': '#ef4444'
    }
  },
  {
    selector: 'edge',
    style: {
      'width': 2,
      'line-color': getCssVar('--arrow-color') || '#dddddd',
      'target-arrow-color': getCssVar('--arrow-color') || '#dddddd',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'opacity': 0.6,
      'events': 'no',
      'z-index': 1
    }
  },
  {
    selector: '.path-highlight',
    style: {
      'underlay-color': '#f59e0b',
      'underlay-padding': 4,
      'underlay-opacity': 1,
      'border-width': 3,
      'border-color': '#d97706'
    }
  }
];

// Cytoscape Instance
let cy = cytoscape({
  container: document.getElementById('cy-container'),
  style: getCyStyle(),
  layout: { name: 'grid' }
});

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Listen for system theme changes and update cytoscape colors
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    cy.style(getCyStyle());
  });

  setupTabs();
  setupTerminalToggle();
  setupLayoutControls();
  setupFileControls();
  setupSimulateControls();
  setupToggles();
  setupResizers();
  setupEntityOperations();

  const btnClearPath = document.getElementById('btn-clear-path');
  if (btnClearPath) {
    btnClearPath.addEventListener('click', () => {
      cy.elements().removeClass('path-highlight');
      btnClearPath.style.display = 'none';
      VCHG_KIND_SELECTED = null;
      VCHG_ELEMENT_SELECTED = null;
      updateStatus();
    });
  }

  window.selectEntity = selectEntity; // expose for inline onclick

  let lastTap = null;
  let lastTapTarget = null;

  cy.on('tap', 'node', (evt) => {
    const node = evt.target;
    const now = Date.now();

    if (lastTap && lastTapTarget && lastTapTarget.id() === node.id() && (now - lastTap) < 500) {
      // Double tap
      selectEntity(node.data('label'), node.hasClass('edge-node') ? 'EDGE' : 'NODE', true);
      lastTap = null;
      lastTapTarget = null;
    } else {
      // Single tap
      selectEntity(node.data('label'), node.hasClass('edge-node') ? 'EDGE' : 'NODE', false);
      lastTap = now;
      lastTapTarget = node;
    }
  });

  let lastBgTap = null;
  cy.on('tap', (evt) => {
    if (evt.target === cy || evt.target.isEdge()) {
      const now = Date.now();
      if (lastBgTap && (now - lastBgTap) < 500) {
        selectEntity(null, null, false);
        lastBgTap = null;
      } else {
        lastBgTap = now;
      }
    }
  });

  // Generate initial blank file
  createNewFile();

  // Deselect inputs on Enter
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'number')) {
      if (e.target.id === 'sim-debug-nodes' || e.target.id === 'sim-debug-edges') return;
      e.target.blur();
    }
  });

  // Cytoscape Tooltip
  const tooltip = document.createElement('div');
  tooltip.id = 'cy-tooltip';
  tooltip.className = 'hidden';
  tooltip.style.position = 'absolute';
  tooltip.style.background = 'var(--bg-color)';
  tooltip.style.border = '1px solid var(--border-color)';
  tooltip.style.color = 'var(--text-color)';
  tooltip.style.padding = '4px 8px';
  tooltip.style.borderRadius = '4px';
  tooltip.style.fontSize = '12px';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.zIndex = '1000';
  document.body.appendChild(tooltip);

  // Global Tooltip for Info Icons
  const infoTooltip = document.createElement('div');
  infoTooltip.className = 'info-tooltip';
  document.body.appendChild(infoTooltip);

  document.addEventListener('click', (e) => {
    const icon = e.target.closest('.info-icon');
    if (icon) {
      e.preventDefault();
      e.stopPropagation();
      const msg = icon.dataset.info;

      if (infoTooltip.classList.contains('show') && infoTooltip.textContent === msg) {
        infoTooltip.classList.remove('show');
        return;
      }

      infoTooltip.textContent = msg;

      const rect = icon.getBoundingClientRect();
      let left = rect.left + rect.width + 10;
      let top = rect.top - 10;

      infoTooltip.classList.add('show');
      const tooltipRect = infoTooltip.getBoundingClientRect();
      if (left + tooltipRect.width > window.innerWidth) {
        left = rect.left - tooltipRect.width - 10;
      }
      infoTooltip.style.left = `${left}px`;
      infoTooltip.style.top = `${top}px`;
    } else {
      infoTooltip.classList.remove('show');
    }
  });

  cy.on('mouseover', 'node', (e) => {
    const node = e.target;
    if (node.hasClass('invalid-edge')) {
      tooltip.textContent = 'Node not found in hypergraph.';
      tooltip.classList.remove('hidden');
    }
  });

  cy.on('mousemove', (e) => {
    if (!tooltip.classList.contains('hidden') && e.originalEvent) {
      tooltip.style.left = e.originalEvent.pageX + 10 + 'px';
      tooltip.style.top = e.originalEvent.pageY + 10 + 'px';
    }
  });

  cy.on('mouseout', 'node', (e) => {
    tooltip.classList.add('hidden');
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
    if (panel.classList.contains('open')) {
      btn.title = 'Close terminal';
    } else {
      btn.title = 'Open terminal';
    }
  });

  panel.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'transform') {
      window.dispatchEvent(new Event('resize'));
    }
  });
}

function setupToggles() {
  document.getElementById('btn-undo').addEventListener('click', () => {
    window.undoHistory();
  });

  document.getElementById('btn-redo').addEventListener('click', () => {
    window.redoHistory();
  });

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

window.currentLayoutName = 'grid';

window.runCurrentLayout = function() {
  if (!cy) return;
  const spacingSlider = document.getElementById('layout-spacing-slider');
  const spacingVal = spacingSlider ? parseFloat(spacingSlider.value) : (window.currentLayoutName === 'concentric' ? 1.5 : 0.75);
  
  const layoutOptions = {
    name: window.currentLayoutName,
    animate: true,
    padding: 50,
    spacingFactor: spacingVal,
    nodeDimensionsIncludeLabels: true,
    avoidOverlap: true
  };
  cy.layout(layoutOptions).run();
};

function setupLayoutControls() {
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      window.currentLayoutName = e.target.getAttribute('data-layout');
      window.runCurrentLayout();
      document.getElementById('layout-controls').classList.add('hidden');
    });
  });

  const spacingSlider = document.getElementById('layout-spacing-slider');
  const spacingValText = document.getElementById('layout-spacing-val');
  if (spacingSlider) {
    spacingSlider.addEventListener('input', () => {
      if (spacingValText) spacingValText.textContent = parseFloat(spacingSlider.value).toFixed(1);
      window.runCurrentLayout();
    });
  }

  const zoomSlider = document.getElementById('layout-zoom-slider');
  const zoomValText = document.getElementById('layout-zoom-val');
  if (zoomSlider && cy) {
    zoomSlider.value = cy.zoom();
    if (zoomValText) zoomValText.textContent = cy.zoom().toFixed(1);

    zoomSlider.addEventListener('input', () => {
      const z = parseFloat(zoomSlider.value);
      if (zoomValText) zoomValText.textContent = z.toFixed(1);
      cy.zoom({
        level: z,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }
      });
    });

    cy.on('zoom', () => {
      if (document.activeElement !== zoomSlider) {
        const z = cy.zoom();
        zoomSlider.value = z;
        if (zoomValText) zoomValText.textContent = z.toFixed(1);
      }
    });
  }
}

function setupFileControls() {
  const btnNewChg = document.getElementById('btn-new-chg');
  if (btnNewChg) {
    btnNewChg.addEventListener('click', () => {
      createNewFile();
      logOutput(`Created new file: ${currentFileName}`);
    });
  }

  const btnRenameFrame = document.getElementById('btn-rename-frame');
  if (btnRenameFrame) {
    btnRenameFrame.addEventListener('click', () => {
      if (!currentFrame) return;
      promptModal('Rename Frame', 'Enter new frame name...', (newName) => {
        if (!chgData.frames[newName] && newName !== currentFrame) {
          window.pushHistory();
          chgData.frames[newName] = chgData.frames[currentFrame];
          delete chgData.frames[currentFrame];
          const frameSelect = document.getElementById('select-frame');
          if (frameSelect) {
            const opt = Array.from(frameSelect.options).find(o => o.value === currentFrame);
            if (opt) {
              opt.value = newName;
              opt.textContent = newName;
            }
          }
          currentFrame = newName;
          logOutput(`Renamed frame to: ${newName}`);
        } else if (newName !== currentFrame) {
          logOutput(`Frame ${newName} already exists.`, true);
        }
      }, currentFrame);
    });
  }

  const btnAddFrame = document.getElementById('btn-add-frame');
  if (btnAddFrame) {
    btnAddFrame.addEventListener('click', () => {
      promptModal('Add Frame', 'Enter frame name...', (name) => {
        if (!chgData.frames[name]) {
          window.pushHistory();
          chgData.frames[name] = {};
          const frameSelect = document.getElementById('select-frame');
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          if (frameSelect) {
            frameSelect.appendChild(opt);
            frameSelect.value = name;
          }
          currentFrame = name;
          renderGraph();
          updatePropertiesPanel();
          logOutput(`Added new frame: ${name}`);
        } else {
          logOutput(`Frame ${name} already exists.`, true);
        }
      });
    });
  }

  const btnRemoveFrame = document.getElementById('btn-remove-frame');
  if (btnRemoveFrame) {
    btnRemoveFrame.addEventListener('click', () => {
      if (!currentFrame) return;
      if (Object.keys(chgData.frames).length <= 1) {
        logOutput('Cannot remove the only frame in the hypergraph.', true);
        return;
      }
      if (confirm(`Are you sure you want to remove frame '${currentFrame}'? This will permanently delete it from the active graph.`)) {
        window.pushHistory();
        delete chgData.frames[currentFrame];
        currentFrame = Object.keys(chgData.frames)[0];

        const frameSelect = document.getElementById('select-frame');
        if (frameSelect) {
          Array.from(frameSelect.options).forEach(opt => {
            if (!chgData.frames[opt.value]) opt.remove();
          });
          frameSelect.value = currentFrame;
        }
        renderGraph();
        updatePropertiesPanel();
        logOutput(`Frame removed. Switched to ${currentFrame}.`);
      }
    });
  }

  const btnClearFrame = document.getElementById('btnClear-frame');
  if (btnClearFrame) {
    btnClearFrame.addEventListener('click', () => {
      if (!currentFrame) return;
      if (confirm(`Are you sure you want to reset all node values in frame '${currentFrame}'?`)) {
        window.pushHistory();
        chgData.frames[currentFrame] = {};
        renderGraph();
        updatePropertiesPanel();
        logOutput(`Frame ${currentFrame} reset.`);
      }
    });
  }

  const selectDemo = document.getElementById('select-demo');
  if (selectDemo) {
    populateDemos();
    selectDemo.addEventListener('change', async (e) => {
      const val = e.target.value;
      if (val) {
        try {
          const res = await fetch(val);
          const data = await res.json();
          loadCHG(data, val.split('/').pop());
        } catch (err) {
          logOutput('Failed to load demo: ' + err, true);
        }
      }
    });
  }

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
          loadCHG(data, file.name);
        } catch (err) {
          logOutput('Invalid JSON file.', true);
        }
      };
      reader.readAsText(file);
    }
  });

  const btnRenameFile = document.getElementById('btn-rename-file');
  if (btnRenameFile) {
    btnRenameFile.addEventListener('click', () => {
      if (!chgData || !chgData.hypergraph) return;
      promptModal('Rename Hypergraph', 'Enter new hypergraph name...', (newName) => {
        if (newName && newName.trim() !== '') {
          const cleanName = newName.trim();
          chgData.hypergraph.name = cleanName;

          const newFileName = `${cleanName}.chg`;
          if (newFileName !== currentFileName) {
            window.pushHistory(); // push the rename to history

            loadedFiles[newFileName] = loadedFiles[currentFileName];
            delete loadedFiles[currentFileName];

            if (window.undoStacks[currentFileName]) {
              window.undoStacks[newFileName] = window.undoStacks[currentFileName];
              delete window.undoStacks[currentFileName];
            }
            if (window.redoStacks[currentFileName]) {
              window.redoStacks[newFileName] = window.redoStacks[currentFileName];
              delete window.redoStacks[currentFileName];
            }

            currentFileName = newFileName;
            updateFileSelect();
          }

          logOutput(`Renamed hypergraph to: ${cleanName}`);
          updateStatus();
        }
      }, chgData.hypergraph.name || '');
    });
  }

  document.getElementById('btn-download').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(chgData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFileName || 'graph.chg';
    a.click();
  });
}

function createNewFile() {
  let num = 1;
  let fname = 'Untitled.chg';
  let hname = 'Untitled';
  while (loadedFiles[fname]) {
    num++;
    fname = `Untitled${num}.chg`;
    hname = `Untitled${num}`;
  }
  const blankData = {
    hypergraph: { name: hname, nodes: [], edges: [] },
    frames: { default: {} }
  };
  loadCHG(blankData, fname);
}

function updateFileSelect() {
  const fileSelect = document.getElementById('select-file');
  if (!fileSelect) return;
  fileSelect.innerHTML = '';
  Object.keys(loadedFiles).forEach(f => {
    if (f.endsWith('.chg')) {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f.slice(0, -4);
      if (f === currentFileName) opt.selected = true;
      fileSelect.appendChild(opt);
    }
  });

  fileSelect.onchange = (e) => {
    const selectedFile = e.target.value;
    if (loadedFiles[selectedFile] && currentFileName !== selectedFile) {
      loadCHG(loadedFiles[selectedFile], selectedFile);
    }
  };
}

function loadCHG(data, filename) {
  let finalName = filename;
  if (data && data.hypergraph && data.hypergraph.name) {
    finalName = `${data.hypergraph.name}.chg`;
  } else if (data && data.hypergraph) {
    data.hypergraph.name = filename.endsWith('.chg') ? filename.slice(0, -4) : filename;
  }

  loadedFiles[finalName] = data;
  currentFileName = finalName;
  chgData = loadedFiles[currentFileName];
  updateFileSelect();

  if (!chgData.frames || Object.keys(chgData.frames).length === 0) {
    chgData.frames = { default: {} };
  }

  // Set to first available frame
  currentFrame = Object.keys(chgData.frames)[0];
  updateStatus();

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

async function populateDemos() {
  const selectDemo = document.getElementById('select-demo');
  if (!selectDemo) return;

  const demoModules = import.meta.glob('/demos/*.chg', { query: '?raw', import: 'default' });

  for (const path in demoModules) {
    try {
      const rawData = await demoModules[path]();
      const data = JSON.parse(rawData);
      const name = data.hypergraph && data.hypergraph.name ? data.hypergraph.name : path.split('/').pop();
      const opt = document.createElement('option');
      opt.value = path;
      opt.textContent = name;
      selectDemo.appendChild(opt);
    } catch (err) {
      console.error(`Failed to parse demo ${path}`, err);
    }
  }
}

function renderGraph() {
  const positions = {};
  cy.nodes().forEach(n => {
    positions[n.id()] = { ...n.position() };
  });
  const zoom = cy.zoom();
  const pan = { ...cy.pan() };

  cy.elements().remove();

  const nodes = chgData.hypergraph.nodes || [];
  const edges = chgData.hypergraph.edges || [];

  const cyElements = [];

  // Nodes Section
  nodes.forEach(n => {
    let classes = '';
    const val = chgData.frames && chgData.frames[currentFrame] && chgData.frames[currentFrame][n.label];
    if (val !== undefined && val !== null && val !== '') {
      classes += 'has-value ';
    }

    cyElements.push({
      group: 'nodes',
      data: { id: `N_${n.label}`, label: n.label, type: 'NODE' },
      classes: classes.trim()
    });
  });

  const validNodeLabels = new Set(nodes.map(n => n.label));

  // Add Edges (as nodes in bipartite graph)
  edges.forEach(e => {
    let edgeClasses = 'edge-node';
    let isInvalid = false;

    if (e.target && !validNodeLabels.has(e.target)) isInvalid = true;
    if (e.source_nodes) {
      Object.values(e.source_nodes).forEach(src => {
        if (!validNodeLabels.has(src)) isInvalid = true;
      });
    }

    if (isInvalid) {
      edgeClasses += ' invalid-edge';
    }

    cyElements.push({
      group: 'nodes',
      data: { id: `E_${e.label}`, label: e.label, type: 'EDGE' },
      classes: edgeClasses,
    });

    // Connect sources to edge
    if (e.source_nodes) {
      Object.values(e.source_nodes).forEach(src => {
        if (validNodeLabels.has(src)) {
          cyElements.push({
            group: 'edges',
            data: { id: `L_${src}_${e.label}`, source: `N_${src}`, target: `E_${e.label}` }
          });
        }
      });
    }

    // Connect edge to target
    if (e.target && validNodeLabels.has(e.target)) {
      cyElements.push({
        group: 'edges',
        data: { id: `L_${e.label}_${e.target}`, source: `E_${e.label}`, target: `N_${e.target}` }
      });
    }
  });

  cy.add(cyElements);

  let needsLayout = false;
  cy.nodes().forEach(n => {
    if (positions[n.id()]) {
      n.position(positions[n.id()]);
    } else {
      needsLayout = true;
    }
  });

  if (needsLayout || Object.keys(positions).length === 0) {
    renderDefault();
  } else {
    cy.viewport({ zoom: zoom, pan: pan });
  }
}

// Renders the default view for the graph
function renderDefault() {
  window.runCurrentLayout();
}

function buildOutline() {
  const nodesTree = document.getElementById('nodes-tree');
  const edgesTree = document.getElementById('edges-tree');

  if (nodesTree) nodesTree.innerHTML = '';
  if (edgesTree) edgesTree.innerHTML = '';

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
        selectEntity(n.label, 'NODE', false);
        childrenContainer.classList.remove('hidden');
      }
    };

    item.ondblclick = () => {
      selectEntity(n.label, 'NODE', true);
    };

    edges.forEach(e => {
      if (e.target === n.label) {
        childrenContainer.innerHTML += `<div class="tree-item" onclick="window.selectEntity('${e.label}', 'EDGE', false)" ondblclick="window.selectEntity('${e.label}', 'EDGE', true)"><span class="tree-icon icon-trailing"></span> ${e.label}</div>`;
      }
      if (e.source_nodes && Object.values(e.source_nodes).includes(n.label)) {
        childrenContainer.innerHTML += `<div class="tree-item" onclick="window.selectEntity('${e.label}', 'EDGE', false)" ondblclick="window.selectEntity('${e.label}', 'EDGE', true)"><span class="tree-icon icon-leading"></span> ${e.label}</div>`;
      }
    });

    itemContainer.appendChild(item);
    itemContainer.appendChild(childrenContainer);
    if (nodesTree) nodesTree.appendChild(itemContainer);
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
        selectEntity(e.label, 'EDGE', false);
        childrenContainer.classList.remove('hidden');
      }
    };

    item.ondblclick = () => {
      selectEntity(e.label, 'EDGE', true);
    };

    if (e.source_nodes) {
      Object.values(e.source_nodes).forEach(src => {
        childrenContainer.innerHTML += `<div class="tree-item" onclick="window.selectEntity('${src}', 'NODE', false)" ondblclick="window.selectEntity('${src}', 'NODE', true)"><span class="tree-icon icon-source-node"></span> ${src}</div>`;
      });
    }
    if (e.target) {
      childrenContainer.innerHTML += `<div class="tree-item" onclick="window.selectEntity('${e.target}', 'NODE', false)" ondblclick="window.selectEntity('${e.target}', 'NODE', true)"><span class="tree-icon icon-target-node"></span> ${e.target}</div>`;
    }

    itemContainer.appendChild(item);
    itemContainer.appendChild(childrenContainer);
    if (edgesTree) edgesTree.appendChild(itemContainer);
  });
}

function arrangeFocused(centerNode, leftNodes, rightNodes) {
  centerNode.position({ x: 0, y: 0 });
  const ySpacing = 120;

  const positionVertical = (nodes, startX) => {
    const totalHeight = (nodes.length - 1) * ySpacing;
    let startY = -totalHeight / 2;
    nodes.forEach(n => {
      n.position({ x: startX, y: startY });
      startY += ySpacing;
    });
  };

  positionVertical(leftNodes, -150);
  positionVertical(rightNodes, 150);
}

function selectEntity(label, kind, doFocus = false) {
  if (label && kind) {
    VCHG_ELEMENT_SELECTED = label;
    VCHG_KIND_SELECTED = kind;
  } else {
    VCHG_ELEMENT_SELECTED = null;
    VCHG_KIND_SELECTED = null;
  }

  // Update Selection Visuals
  cy.elements().unselect().removeClass('hidden-node');
  document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));

  if (label && kind) {
    const cyId = kind === 'NODE' ? `N_${label}` : `E_${label}`;
    const centerNode = cy.getElementById(cyId);
    if (centerNode) centerNode.select();

    // Auto-open info tab if not collapsed
    const primarySidebar = document.getElementById('primary-sidebar');
    if (primarySidebar && !primarySidebar.classList.contains('collapsed')) {
      const infoTabBtn = document.querySelector('.tab-btn[data-target="tab-properties"]');
      if (infoTabBtn) infoTabBtn.click();
    }

    const treeEl = document.querySelector(`.tree-item[data-label="${label}"][data-kind="${kind}"]`);
    if (treeEl) {
      treeEl.classList.add('selected');
      if (doFocus) {// Auto-expand in sidebar if selected from graph
        const childrenContainer = treeEl.nextElementSibling;
        if (childrenContainer && childrenContainer.classList.contains('tree-children')) {
          childrenContainer.classList.remove('hidden');
        }
      }
    }

    if (doFocus) {
      // Focused Mode layout
      const leftNodes = centerNode.incomers('node');
      const rightNodes = centerNode.outgoers('node');
      const allRelevant = centerNode.neighborhood().union(centerNode);

      // Move non-relevant nodes/edges just off-screen in a grid
      let offscreenX = 500;
      let offscreenY = -300;
      cy.elements().difference(allRelevant).forEach(n => {
        n.position({ x: offscreenX, y: offscreenY });
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
    }
  } else {
    // Reset to Display Mode
    renderDefault();
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
    if (btnDelete) btnDelete.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  content.classList.remove('hidden');
  if (btnDelete) btnDelete.classList.remove('hidden');

  let html = '';

  if (VCHG_KIND_SELECTED === 'NODE') {
    const node = chgData.hypergraph.nodes.find(n => n.label === VCHG_ELEMENT_SELECTED);
    if (!node) return;

    let val = '';
    let valList = null;
    let indexHtml = '';
    let inputBoxHtml = '';

    if (chgData.frames[currentFrame] && chgData.frames[currentFrame][node.label]) {
      valList = chgData.frames[currentFrame][node.label];
      val = valList[valList.length - 1]; // Show last value
      if (valList.length > 1) {
        indexHtml = `<div id="prop-node-index-text" style="text-align: right; font-size: 0.8rem; font-style: italic; margin-top: 4px; margin-right: 22px; opacity: 0.7;">Index: ${valList.length}</div>`;
        const spinnerControls = `
          <div class="spinner-controls">
            <button id="btn-index-up" class="spinner-btn disabled">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
            </button>
            <button id="btn-index-down" class="spinner-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
          </div>
        `;
        inputBoxHtml = `
          <div class="spinner-wrapper">
            <input type="text" id="prop-node-val" value="${val}" style="padding-right: 20px;" />
            ${spinnerControls}
          </div>
        `;
      } else {
        inputBoxHtml = `<input type="text" id="prop-node-val" value="${val}" />`;
      }
    } else {
      inputBoxHtml = `<input type="text" id="prop-node-val" value="${val}" />`;
    }

    const valueTooltip = "The current state of the node. You can set this yourself if the value is known (an input) or simulate it using the button below (an output). For dynamic systems, a node can have multiple values as the system evolves through multiple systems, which you can progress through using the arrows. Warning: Editing a node with multiple history values will overwrite the entire list with a single new value.";

    html = `
      <div class="input-group">
        <label>Label</label>
        <div class="input-with-info">
          <input type="text" id="prop-node-label" value="${node.label}" />
          ${getInfoIcon("A unique identifier (name) for the node.")}
        </div>
      </div>
      <div class="input-group">
        <label>Value <i>(frame: ${currentFrame})</i></label>
        <div class="value-input-wrapper input-with-info">
          ${inputBoxHtml}
          <button id="btn-apply-sim" class="icon-btn hidden" title="Apply simulated value" style="color: #22c55e; flex-shrink: 0;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
          ${getInfoIcon(valueTooltip)}
        </div>
        ${indexHtml}
      </div>
      <div class="input-group mt-2">
        <div class="input-with-info">
          <label class="checkbox-label" style="margin: 0; flex: 1;">
            <input type="checkbox" id="prop-node-const" ${node.is_constant ? 'checked' : ''} /> Constant
          </label>
          ${getInfoIcon("If true, the node's value is fixed and will not be overwritten by the solver.")}
        </div>
      </div>
    `;
    content.innerHTML = html;

    // Setup listeners
    document.getElementById('prop-node-label').onchange = (e) => {
      window.pushHistory();
      const newLabel = e.target.value.trim();
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

    const valInput = document.getElementById('prop-node-val');
    const applyBtn = document.getElementById('btn-apply-sim');

    // Spinner logic for multiple values
    if (valList && valList.length > 1) {
      let currentIndex = valList.length; // 1-based index
      const btnUp = document.getElementById('btn-index-up');
      const btnDown = document.getElementById('btn-index-down');
      const indexText = document.getElementById('prop-node-index-text');

      const updateSpinner = () => {
        valInput.value = valList[currentIndex - 1]; // 0-based
        indexText.textContent = `Index: ${currentIndex}`;

        if (currentIndex >= valList.length) {
          btnUp.classList.add('disabled');
        } else {
          btnUp.classList.remove('disabled');
        }

        if (currentIndex <= 1) {
          btnDown.classList.add('disabled');
        } else {
          btnDown.classList.remove('disabled');
        }

        // Remove simulation state visual logic if navigating history
        valInput.classList.remove('sim-success');
        applyBtn.classList.add('hidden');
      };

      if (btnUp) {
        btnUp.onclick = () => {
          if (currentIndex < valList.length) {
            currentIndex++;
            updateSpinner();
          }
        };
      }

      if (btnDown) {
        btnDown.onclick = () => {
          if (currentIndex > 1) {
            currentIndex--;
            updateSpinner();
          }
        };
      }
    }

    valInput.oninput = () => {
      // Clear simulation visual state if manually edited
      valInput.classList.remove('sim-success');
      applyBtn.classList.add('hidden');
    };

    valInput.onchange = (e) => {
      window.pushHistory();
      const newVal = e.target.value;
      if (!chgData.frames[currentFrame]) chgData.frames[currentFrame] = {};

      if (newVal === '') {
        delete chgData.frames[currentFrame][node.label];
      } else {
        // try parse float
        const parsed = parseFloat(newVal);
        chgData.frames[currentFrame][node.label] = isNaN(parsed) ? [newVal] : [parsed];
      }

      // Hide spinner and index text since the history is now reduced to 1
      const spinnerControls = document.querySelector('.spinner-controls');
      if (spinnerControls) spinnerControls.classList.add('hidden');

      const indexTextNode = document.getElementById('prop-node-index-text');
      if (indexTextNode) indexTextNode.classList.add('hidden');

      valInput.style.paddingRight = '';

      const cyNode = cy.getElementById(`N_${node.label}`);
      if (newVal === '') {
        cyNode.removeClass('has-value');
      } else {
        cyNode.addClass('has-value');
      }

      updateStatus();
    };

    applyBtn.onclick = () => {
      // Fire onchange artificially to save it
      valInput.dispatchEvent(new Event('change'));
      valInput.classList.remove('sim-success');
      applyBtn.classList.add('hidden');
    };

    document.getElementById('prop-node-const').onchange = (e) => {
      window.pushHistory();
      node.is_constant = e.target.checked;
    };

  } else if (VCHG_KIND_SELECTED === 'EDGE') {
    const edge = chgData.hypergraph.edges.find(e => e.label === VCHG_ELEMENT_SELECTED);
    if (!edge) return;

    const validNodeLabels = new Set((chgData.hypergraph.nodes || []).map(n => n.label));

    let sourcesHtml = '';
    if (edge.source_nodes) {
      Object.entries(edge.source_nodes).forEach(([key, val]) => {
        const isInvalid = val && !validNodeLabels.has(val);
        const tooltipStr = isInvalid ? 'Node not found in hypergraph.' : 'Source Node';
        sourcesHtml += `
          <div class="source-grid" data-key="${key}">
            <div class="autocomplete-wrapper">
              <input type="text" class="autocomplete-hint src-val-hint" disabled />
              <input type="text" class="autocomplete-input src-val ${isInvalid ? 'invalid-input' : ''}" value="${val}" title="${tooltipStr}" />
            </div>
            <input type="text" class="src-key" value="${key}" title="Key" />
            <button class="icon-btn danger btn-del-source" style="padding: 0; color: var(--danger-btn); font-size: 1.2rem; display: flex; align-items: center; justify-content: center; height: 100%;" data-key="${key}">✕</button>
          </div>
        `;
      });
    }

    html = `
      <div class="input-group">
        <label>Label</label>
        <div class="input-with-info">
          <input type="text" id="prop-edge-label" value="${edge.label}" />
          ${getInfoIcon("A unique identifier (name) for the edge.")}
        </div>
      </div>
      <div class="input-group">
        <label>Weight</label>
        <div class="input-with-info">
          <input type="number" id="prop-edge-weight" value="${edge.weight || 0}" />
          ${getInfoIcon("The traversal cost associated with evaluating this edge.")}
        </div>
      </div>
      <div class="input-group">
        <label>Target</label>
        <div class="input-with-info">
          <div class="autocomplete-wrapper">
            <input type="text" class="autocomplete-hint" id="prop-edge-target-hint" disabled />
            <input type="text" class="autocomplete-input ${(edge.target && !validNodeLabels.has(edge.target)) ? 'invalid-input' : ''}" id="prop-edge-target" value="${edge.target || ''}" title="${(edge.target && !validNodeLabels.has(edge.target)) ? 'Node not found in hypergraph.' : ''}" />
          </div>
          ${getInfoIcon("The node whose value is resolved by this edge's relationship.")}
        </div>
      </div>
      <div class="input-group">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <label>Sources</label>
          <div style="display: flex; align-items: center;">
            <button id="btn-add-source" class="icon-btn text-btn" style="font-size:1.2rem; margin:0">+</button>
            ${getInfoIcon("The required input nodes for this edge.")}
          </div>
        </div>
        <div class="source-grid" style="font-weight:600; font-size:0.8rem">
          <div>Label</div><div>Key</div><div></div>
        </div>
        ${sourcesHtml}
      </div>
      <div class="input-group">
        <label>Rule</label>
        <div class="input-with-info" style="align-items: flex-start;">
          <textarea class="code-block" id="prop-edge-rule">${edge.rel || ''}</textarea>
          ${getInfoIcon("The relationship that defines how the target node is calculated. This must be written as a Python method following all Python syntax starting with def. The name of the method does not matter, but its parameters should be the keys of the source nodes above.")}
        </div>
      </div>
    `;
    content.innerHTML = html;

    // Listeners
    const ruleInput = document.getElementById('prop-edge-rule');
    if (ruleInput) {
      ruleInput.onchange = (e) => {
        window.pushHistory();
        edge.rel = e.target.value;
      };
    }

    document.getElementById('prop-edge-label').onchange = (e) => {
      const newLabel = e.target.value.trim();
      if (!newLabel || newLabel === edge.label) return;
      window.pushHistory();
      edge.label = newLabel;
      VCHG_ELEMENT_SELECTED = newLabel;
      renderGraph();
      buildOutline();
      selectEntity(newLabel, 'EDGE');
    };

    document.getElementById('prop-edge-weight').onchange = (e) => {
      window.pushHistory();
      edge.weight = parseFloat(e.target.value) || 0;
      updateStatus();
    };

    document.getElementById('prop-edge-target').onchange = (e) => {
      window.pushHistory();
      edge.target = e.target.value;
      renderGraph();
      buildOutline();
    };

    document.getElementById('btn-add-source').onclick = () => {
      window.pushHistory();
      if (!edge.source_nodes) edge.source_nodes = {};
      const newKey = `s${Object.keys(edge.source_nodes).length + 1}`;
      edge.source_nodes[newKey] = "";
      updatePropertiesPanel();
    };

    document.querySelectorAll('.btn-del-source').forEach(btn => {
      btn.onclick = (e) => {
        window.pushHistory();
        const key = e.target.getAttribute('data-key');
        delete edge.source_nodes[key];
        updatePropertiesPanel();
      };
    });

    document.querySelectorAll('.src-val').forEach(input => {
      input.onchange = (e) => {
        window.pushHistory();
        const key = e.target.closest('.source-grid').getAttribute('data-key');
        edge.source_nodes[key] = e.target.value;
        renderGraph();
        buildOutline();
      };
    });

    const targetInput = document.getElementById('prop-edge-target');
    const targetHint = document.getElementById('prop-edge-target-hint');
    if (targetInput && targetHint) attachAutocomplete(targetInput, targetHint, edge);

    const validateEdgeLive = () => {
      const validNodeLabels = new Set(chgData.hypergraph.nodes.map(n => n.label));
      let isEdgeInvalid = false;

      // target
      const tInput = document.getElementById('prop-edge-target');
      if (tInput) {
        const val = tInput.value;
        const isInvalid = val && !validNodeLabels.has(val);
        if (isInvalid) {
          tInput.classList.add('invalid-input');
          tInput.setAttribute('title', 'Node not found in hypergraph.');
          isEdgeInvalid = true;
        } else {
          tInput.classList.remove('invalid-input');
          tInput.removeAttribute('title');
        }
      }

      // sources
      document.querySelectorAll('.src-val').forEach(sInput => {
        const val = sInput.value;
        const isInvalid = val && !validNodeLabels.has(val);
        if (isInvalid) {
          sInput.classList.add('invalid-input');
          sInput.setAttribute('title', 'Node not found in hypergraph.');
          isEdgeInvalid = true;
        } else {
          sInput.classList.remove('invalid-input');
          sInput.removeAttribute('title');
        }
      });

      const cyNode = cy.getElementById(`E_${edge.label}`);
      if (cyNode) {
        if (isEdgeInvalid) cyNode.addClass('invalid-edge');
        else cyNode.removeClass('invalid-edge');
      }
    };

    if (targetInput) {
      targetInput.addEventListener('input', validateEdgeLive);
    }

    document.querySelectorAll('.source-grid').forEach(grid => {
      const srcInput = grid.querySelector('.src-val');
      const srcHint = grid.querySelector('.src-val-hint');
      if (srcInput && srcHint) attachAutocomplete(srcInput, srcHint, edge);
      if (srcInput) {
        srcInput.addEventListener('input', validateEdgeLive);
      }
    });

    document.querySelectorAll('.src-key').forEach(input => {
      input.onchange = (e) => {
        const oldKey = e.target.closest('.source-grid').getAttribute('data-key');
        const newKey = e.target.value;
        if (oldKey !== newKey && newKey) {
          edge.source_nodes[newKey] = edge.source_nodes[oldKey];
          delete edge.source_nodes[oldKey];
        }
        renderGraph();
        buildOutline();
        selectEntity(VCHG_ELEMENT_SELECTED, 'EDGE');
      };
    });
  }
}

function setupEntityOperations() {
  const inputAddNode = document.getElementById('input-add-node');
  const btnInlineAddNode = document.getElementById('btn-inline-add-node');
  const inputAddEdge = document.getElementById('input-add-edge');
  const btnInlineAddEdge = document.getElementById('btn-inline-add-edge');
  const btnDelete = document.getElementById('btn-delete');

  const inputSearchNodeHint = document.getElementById('input-search-node-hint');
  const inputSearchEdgeHint = document.getElementById('input-search-edge-hint');

  if (inputAddNode && inputSearchNodeHint) attachAutocomplete(inputAddNode, inputSearchNodeHint, null, 'NODE');
  if (inputAddEdge && inputSearchEdgeHint) attachAutocomplete(inputAddEdge, inputSearchEdgeHint, null, 'EDGE');

  const handleAddNode = () => {
    const inputAddNode = document.getElementById('input-add-node');
    const inputSearchNodeHint = document.getElementById('input-search-node-hint');
    if (!inputAddNode) return;
    const label = inputAddNode.value.trim();
    if (!label) return;
    if (!chgData.hypergraph.nodes) chgData.hypergraph.nodes = [];

    if (chgData.hypergraph.nodes.find(n => n.label === label)) {
      inputAddNode.value = '';
      if (inputSearchNodeHint) inputSearchNodeHint.value = '';
      selectEntity(label, 'NODE', false);
      const cyNode = cy.getElementById(`N_${label}`);
      if (cyNode) cy.center(cyNode);
      logOutput(`Selected existing node ${label}.`);
    } else {
      window.pushHistory();
      chgData.hypergraph.nodes.push({ label: label, is_constant: false });
      inputAddNode.value = '';
      if (inputSearchNodeHint) inputSearchNodeHint.value = '';
      renderGraph();
      buildOutline();
      selectEntity(label, 'NODE', false);
      logOutput(`Added node ${label}.`);
    }
  };

  if (btnInlineAddNode && inputAddNode) {
    btnInlineAddNode.addEventListener('click', handleAddNode);
    inputAddNode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAddNode();
    });
  }

  const handleAddEdge = () => {
    const inputAddEdge = document.getElementById('input-add-edge');
    const inputSearchEdgeHint = document.getElementById('input-search-edge-hint');
    if (!inputAddEdge) return;
    const label = inputAddEdge.value.trim();
    if (!label) return;
    if (!chgData.hypergraph.edges) chgData.hypergraph.edges = [];

    if (chgData.hypergraph.edges.find(e => e.label === label)) {
      inputAddEdge.value = '';
      if (inputSearchEdgeHint) inputSearchEdgeHint.value = '';
      selectEntity(label, 'EDGE', false);
      const cyNode = cy.getElementById(`E_${label}`);
      if (cyNode) cy.center(cyNode);
      logOutput(`Selected existing edge ${label}.`);
    } else {
      window.pushHistory();
      chgData.hypergraph.edges.push({ label: label, target: "", source_nodes: {} });
      inputAddEdge.value = '';
      if (inputSearchEdgeHint) inputSearchEdgeHint.value = '';
      renderGraph();
      buildOutline();
      selectEntity(label, 'EDGE', false);
      logOutput(`Added edge ${label}.`);
    }
  };

  if (btnInlineAddEdge && inputAddEdge) {
    btnInlineAddEdge.addEventListener('click', handleAddEdge);
    inputAddEdge.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAddEdge();
    });
  }

  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      if (!VCHG_ELEMENT_SELECTED) return;
      if (confirm(`Are you sure you want to remove '${VCHG_ELEMENT_SELECTED}'?`)) {
        window.pushHistory();
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
      }
    });
  }
}

function updateStatus() {
  const statusText = document.getElementById('status-text');

  const displayName = chgData && chgData.hypergraph && chgData.hypergraph.name ? chgData.hypergraph.name : (currentFileName || 'Waiting to Load Hypergraph');
  document.getElementById('status-filename').innerText = displayName;

  if (VCHG_KIND_SELECTED === 'PATH') {
    const edgeNodes = cy.elements('.path-highlight').filter('node.edge-node');
    const edgeCount = edgeNodes.length;
    let cost = 0;
    edgeNodes.forEach(node => {
      const edge = chgData.hypergraph.edges.find(e => e.label === node.data('label'));
      if (edge && edge.weight) cost += (parseFloat(edge.weight) || 0);
    });
    statusText.textContent = `Path with ${edgeCount} edges, cost=${parseFloat(cost.toFixed(4))}`;
  } else if (!VCHG_ELEMENT_SELECTED) {
    statusText.textContent = 'Ready';
  } else if (VCHG_KIND_SELECTED === 'NODE') {
    const val = (chgData.frames[currentFrame] && chgData.frames[currentFrame][VCHG_ELEMENT_SELECTED]) ? chgData.frames[currentFrame][VCHG_ELEMENT_SELECTED][0] : null;
    if (val !== null && val !== undefined && val !== '') {
      statusText.textContent = `Node selected: ${VCHG_ELEMENT_SELECTED} (${val})`;
    } else {
      statusText.textContent = `Node selected: ${VCHG_ELEMENT_SELECTED}`;
    }
  } else if (VCHG_KIND_SELECTED === 'EDGE') {
    const edge = chgData.hypergraph.edges.find(e => e.label === VCHG_ELEMENT_SELECTED);
    if (edge && edge.target) {
      statusText.textContent = `Edge selected: ${VCHG_ELEMENT_SELECTED} -> ${edge.target}`;
    } else {
      statusText.textContent = `Edge selected: ${VCHG_ELEMENT_SELECTED}`;
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
  const simSection = document.getElementById('sim-section');
  if (!simSection) return;

  if (VCHG_ELEMENT_SELECTED && VCHG_KIND_SELECTED === 'NODE') {
    simSection.classList.remove('hidden');
  } else {
    simSection.classList.add('hidden');
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
    const use_relations = document.getElementById('sim-use-relations').checked;

    const dNodes = Array.from(document.getElementById('debug-nodes-tags').children).map(c => c.dataset.val);
    const dEdges = Array.from(document.getElementById('debug-edges-tags').children).map(c => c.dataset.val);

    try {
      if (window.py_run_simulation) {
        const file_data = JSON.stringify(chgData);
        // Pyodide call
        const resStr = await window.py_run_simulation(file_data, VCHG_ELEMENT_SELECTED, currentFrame, min_index, to_print, log_level, dNodes, dEdges, use_relations);
        const res = JSON.parse(resStr);
        if (res.log) {
          const logEl = document.getElementById('output-log');
          logEl.textContent += `\n${res.log}`;
          logEl.scrollTop = logEl.scrollHeight;
        }
        if (res.success) {
          logOutput(`Simulation success. Cost: ${res.cost}, Value: ${res.value}`);
          highlightPath(res.path_nodes, res.path_edges);

          // Update Value box if it exists
          const valInput = document.getElementById('prop-node-val');
          const applyBtn = document.getElementById('btn-apply-sim');
          if (valInput && applyBtn) {
            valInput.value = res.value;
            valInput.classList.add('sim-success');
            applyBtn.classList.remove('hidden');
          }
        } else {
          logOutput(`Simulation failed: ${res.error}`, true);
        }
      } else {
        logOutput('Python bridge not ready.', true);
      }
    } catch (err) {
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

  const btnClearPath = document.getElementById('btn-clear-path');
  if (btnClearPath) {
    btnClearPath.style.display = 'block';
  }
}

function promptModal(title, placeholder, callback, defaultValue = '') {
  const modal = document.getElementById('app-modal');
  const titleEl = document.getElementById('modal-title');
  const inputEl = document.getElementById('modal-input');
  const btnCancel = document.getElementById('modal-btn-cancel');
  const btnConfirm = document.getElementById('modal-btn-confirm');

  if (!modal) {
    const val = prompt(placeholder, defaultValue);
    if (val) callback(val);
    return;
  }

  titleEl.textContent = title;
  inputEl.placeholder = placeholder;
  inputEl.value = defaultValue;
  modal.classList.add('active');
  inputEl.focus();

  const cleanup = () => {
    modal.classList.remove('active');
    btnCancel.onclick = null;
    btnConfirm.onclick = null;
    inputEl.onkeydown = null;
  };

  btnCancel.onclick = cleanup;

  const confirm = () => {
    const val = inputEl.value.trim();
    cleanup();
    if (val) callback(val);
  };

  btnConfirm.onclick = confirm;
  inputEl.onkeydown = (e) => {
    if (e.key === 'Enter') confirm();
    if (e.key === 'Escape') cleanup();
  };
}

function attachAutocomplete(inputEl, hintEl, edgeContext = null) {
  const updateHint = () => {
    const val = inputEl.value;
    if (!val) {
      hintEl.value = '';
      return;
    }
    const nodes = chgData.hypergraph.nodes.map(n => n.label);
    const match = nodes.find(n => n.toLowerCase().startsWith(val.toLowerCase()));
    if (match && match.toLowerCase() !== val.toLowerCase()) {
      hintEl.value = val + match.substring(val.length);
    } else {
      hintEl.value = '';
    }
  };

  inputEl.addEventListener('input', updateHint);
  inputEl.addEventListener('focus', updateHint);
  inputEl.addEventListener('blur', () => hintEl.value = '');

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (hintEl.value && hintEl.value.toLowerCase().startsWith(inputEl.value.toLowerCase())) {
        e.preventDefault();
        inputEl.value = hintEl.value;
        hintEl.value = '';
        inputEl.dispatchEvent(new Event('change'));
      }
    }
  });
}
