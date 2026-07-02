import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

// --- 1. CORE THREE.JS SETUP ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#0f172a', 0.004);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 50, 150);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.5, 0.1);

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- 2. PIPELINE GLOBAL STATE ---
let paperData = [];
let instancedMesh;
let baseColors = [];
const dummy = new THREE.Object3D();

let activeFilters = new Set();
let searchQuery = "";
let nexusLinesGroup = new THREE.Group();
scene.add(nexusLinesGroup);

// Chart instances
let chartSatiation, chartTimeline, chartImpact;

// --- UPDATE JUST THIS OBJECT MAP IN YOUR main.js FILE ---
const funderColors = {
  "public_nih": "#0072b2",          // Accessible Deep Blue
  "public_nsf": "#56b4e9",          // Accessible Sky Blue
  "industry_microsoft": "#009e73",  // Accessible Bluish Green
  "industry_google": "#e69f00",     // Accessible Warm Orange
  "industry_apple": "#f0e442",      // Accessible Soft Yellow
  "industry_nvidia": "#cc79a7",     // Accessible Reddish Purple
};

const funderLabels = {
  "public_nih": "NIH",
  "public_nsf": "NSF",
  "industry_microsoft": "Microsoft",
  "industry_google": "Google",
  "industry_apple": "Apple",
  "industry_nvidia": "Nvidia"
};

// --- 3. INIT CHART OBJECTS (WITH AXIS LABELS) ---
function initCharts() {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false }, 
      tooltip: { cornerRadius: 4 } 
    },
    scales: {
      x: { 
        grid: { color: 'rgba(255,255,255,0.05)' }, 
        ticks: { color: '#94a3b8', font: { size: 10 } } 
      },
      y: { 
        grid: { color: 'rgba(255,255,255,0.05)' }, 
        ticks: { color: '#94a3b8', font: { size: 10 } } 
      }
    }
  };

  // Bar Chart: Topic Satiation vs Gaps
  chartSatiation = new Chart(document.getElementById('chart-bar-satiation'), {
    type: 'bar',
    data: { 
      labels: [], 
      datasets: [{ 
        label: 'Cumulative Citations', 
        data: [], 
        backgroundColor: [], // Dynamically mapped by color engine
        borderRadius: 4 
      }] 
    },
    options: {
      ...chartOptions,
      scales: {
        x: { 
          ...chartOptions.scales.x,
          title: { display: true, text: 'Semantic Domains', color: '#64748b', font: { size: 10, weight: 'bold' } }
        },
        y: { 
          ...chartOptions.scales.y,
          title: { display: true, text: 'Total Citations', color: '#64748b', font: { size: 10, weight: 'bold' } }
        }
      }
    }
  });

  // Line Chart: Longitudinal Shift
  chartTimeline = new Chart(document.getElementById('chart-line-timeline'), {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      ...chartOptions,
      plugins: { legend: { display: true, labels: { color: '#94a3b8', boxWidth: 10, font: { size: 9 } } } },
      elements: { line: { tension: 0.3, borderWidth: 2 }, point: { radius: 0 } },
      scales: {
        x: { 
          ...chartOptions.scales.x,
          title: { display: true, text: 'Publication Timeline', color: '#64748b', font: { size: 10, weight: 'bold' } }
        },
        y: { 
          ...chartOptions.scales.y,
          title: { display: true, text: 'Paper Count', color: '#64748b', font: { size: 10, weight: 'bold' } }
        }
      }
    }
  });

  // Bubble Chart: Funder Return on Impact (ROI)
  chartImpact = new Chart(document.getElementById('chart-bubble-impact'), {
    type: 'bubble',
    data: { datasets: [] },
    options: {
      ...chartOptions,
      scales: {
        x: { title: { display: true, text: 'Active Paper Volume', color: '#64748b', font: { size: 10, weight: 'bold' } }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        y: { title: { display: true, text: 'Mean Citation Yield', color: '#64748b', font: { size: 10, weight: 'bold' } }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

// --- 4. DATA LOADER & SETUP ENGINE ---
initCharts();

fetch('/dashboard_ready.json')
  .then(res => res.json())
  .then(data => {
    paperData = data;
    const count = data.length;
    
    const geometry = new THREE.SphereGeometry(0.8, 16, 16);
    const material = new THREE.MeshBasicMaterial();
    instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    
    const color = new THREE.Color();
    const publicContainer = document.getElementById('children-public');
    const industryContainer = document.getElementById('children-industry');
    const uniqueFunders = [...new Set(data.map(d => d.funder))];
    
    uniqueFunders.forEach(funder => {
      activeFilters.add(funder); 
      
      const label = document.createElement('label');
      label.className = 'filter-label';
      label.innerHTML = `
        <input type="checkbox" checked class="child-box" data-funder="${funder}" />
        <span style="color: ${funderColors[funder] || '#fff'}">●</span> ${funderLabels[funder] || funder}
      `;
      
      label.querySelector('input').addEventListener('change', (e) => {
        if(e.target.checked) activeFilters.add(funder);
        else activeFilters.delete(funder);
        
        updateParentCheckboxStates();
        updateMeshAndMetricsPipeline();
      });
      
      if(funder.startsWith('public_')) publicContainer.appendChild(label);
      else industryContainer.appendChild(label);
    });

    setupParentToggle('parent-public', 'public_');
    setupParentToggle('parent-industry', 'industry_');

    data.forEach((paper, i) => {
      dummy.position.set(paper.x, paper.y, paper.z);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);

      const hex = funderColors[paper.funder] || "#475569";
      color.set(hex);
      instancedMesh.setColorAt(i, color);
      baseColors.push(hex);
    });

    scene.add(instancedMesh);
    updateMeshAndMetricsPipeline(); 
  });

// --- 5. DATA AGGREGATION & MATRIX COMPUTATIONS ---
function updateMeshAndMetricsPipeline() {
  if (!instancedMesh) return;
  const color = new THREE.Color();
  
  let visiblePapers = [];
  let publicCount = 0, industryCount = 0;
  let totalCitations = 0;

  paperData.forEach((paper, i) => {
    dummy.position.set(paper.x, paper.y, paper.z);
    
    const isVisibleFunder = activeFilters.has(paper.funder);
    const searchMatch = searchQuery === "" || 
      (paper.title && paper.title.toLowerCase().includes(searchQuery)) ||
      (paper.concepts && paper.concepts.some(c => c.toLowerCase().includes(searchQuery)));

    if (!isVisibleFunder) {
      dummy.scale.set(0, 0, 0); 
    } else {
      dummy.scale.set(1, 1, 1);
      
      if (!searchMatch) {
        color.set("#1e293b"); 
        instancedMesh.setColorAt(i, color);
      } else {
        color.set(baseColors[i]); 
        instancedMesh.setColorAt(i, color);
        
        visiblePapers.push(paper);
        if(paper.funder.startsWith('public_')) publicCount++;
        else industryCount++;
        totalCitations += (paper.citations || 0);
      }
    }
    
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(i, dummy.matrix);
  });

  instancedMesh.instanceMatrix.needsUpdate = true;
  instancedMesh.instanceColor.needsUpdate = true;

  updateHealthCard(visiblePapers, publicCount, industryCount, totalCitations);
  calculateChartMetrics(visiblePapers);
  recalculateMacroRelationships(visiblePapers);
}

// --- 6. 2D SUBPLOT ENGINE UPDATE MECHANISMS ---
function updateHealthCard(visible, pubCount, indCount, totalCit) {
  document.getElementById('metric-volume').innerText = visible.length.toLocaleString();
  document.getElementById('metric-citations').innerText = visible.length ? Math.round(totalCit / visible.length).toLocaleString() : 0;
  
  const total = pubCount + indCount;
  const pubPct = total ? Math.round((pubCount / total) * 100) : 50;
  document.getElementById('metric-ratio').innerText = `${pubPct}% Pub / ${100 - pubPct}% Priv`;
}

function calculateChartMetrics(visible) {
  // --- A. BAR CHART AGGREGATION (WITH DYNAMIC COLOR ASSIGNMENT) ---
  let topicCitationMap = {};
  let topicFunderTracker = {}; 

  visible.forEach(p => {
    const topic = p.topic || "Interdisciplinary";
    topicCitationMap[topic] = (topicCitationMap[topic] || 0) + (p.citations || 0);
    
    if(!topicFunderTracker[topic]) topicFunderTracker[topic] = {};
    topicFunderTracker[topic][p.funder] = (topicFunderTracker[topic][p.funder] || 0) + 1;
  });
  
  let sortedTopics = Object.entries(topicCitationMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);

  let dynamicBarColors = sortedTopics.map(t => {
    const topicName = t[0];
    const funderCounts = topicFunderTracker[topicName];
    const dominantFunder = Object.keys(funderCounts).reduce((a, b) => funderCounts[a] > funderCounts[b] ? a : b);
    return funderColors[dominantFunder] || '#38bdf8';
  });

  chartSatiation.data.labels = sortedTopics.map(t => t[0].length > 18 ? t[0].substring(0,15)+'...' : t[0]);
  chartSatiation.data.datasets[0].data = sortedTopics.map(t => t[1]);
  chartSatiation.data.datasets[0].backgroundColor = dynamicBarColors; 
  chartSatiation.update();

  // --- B. LINE CHART AGGREGATION ---
  let timelineMap = {};
  let yearsSet = new Set();
  
  visible.forEach(p => {
    if(!p.year || p.year === "N/A") return;
    yearsSet.add(p.year);
    const sector = p.funder.startsWith('public_') ? 'Public Sector' : 'Industry Sector';
    
    if(!timelineMap[sector]) timelineMap[sector] = {};
    timelineMap[sector][p.year] = (timelineMap[sector][p.year] || 0) + 1;
  });

  let sortedYears = [...yearsSet].sort((a, b) => a - b);
  chartTimeline.data.labels = sortedYears;
  chartTimeline.data.datasets = Object.keys(timelineMap).map((sector, idx) => {
    return {
      label: sector,
      data: sortedYears.map(y => timelineMap[sector][y] || 0),
      borderColor: idx === 0 ? '#3b82f6' : '#10b981',
      backgroundColor: 'transparent'
    };
  });
  chartTimeline.update();

  // --- C. BUBBLE CHART AGGREGATION ---
  let funderMap = {};
  visible.forEach(p => {
    if(!funderMap[p.funder]) funderMap[p.funder] = { volume: 0, citations: 0 };
    funderMap[p.funder].volume++;
    funderMap[p.funder].citations += (p.citations || 0);
  });

  chartImpact.data.datasets = Object.entries(funderMap).map(([funder, stats]) => {
    const avgCit = stats.volume ? Math.round(stats.citations / stats.volume) : 0;
    return {
      label: funderLabels[funder] || funder,
      data: [{ x: stats.volume, y: avgCit, r: Math.min(Math.max(stats.volume * 0.1, 4), 20) }],
      backgroundColor: funderColors[funder] || '#fff'
    };
  });
  chartImpact.update();
}

// --- 7. RELATIONSHIP STRATUM LINES ---
function recalculateMacroRelationships(visible) {
  while(nexusLinesGroup.children.length > 0){ 
    nexusLinesGroup.remove(nexusLinesGroup.children[0]); 
  }

  let coordinatesByFunder = {};
  visible.forEach((paper) => {
    if (!coordinatesByFunder[paper.funder]) {
      coordinatesByFunder[paper.funder] = { x: 0, y: 0, z: 0, count: 0 };
    }
    coordinatesByFunder[paper.funder].x += paper.x;
    coordinatesByFunder[paper.funder].y += paper.y;
    coordinatesByFunder[paper.funder].z += paper.z;
    coordinatesByFunder[paper.funder].count++;
  });

  let activeHubs = [];
  for (const funder in coordinatesByFunder) {
    const data = coordinatesByFunder[funder];
    if (data.count === 0) continue;

    const avgX = data.x / data.count;
    const avgY = data.y / data.count;
    const avgZ = data.z / data.count;
    
    const centerVec = new THREE.Vector3(avgX, avgY, avgZ);
    activeHubs.push({ name: funder, pos: centerVec });

    const waypointGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
    const waypointMat = new THREE.MeshBasicMaterial({ 
      color: funderColors[funder], wireframe: true, transparent: true, opacity: 0.3 
    });
    const waypointMesh = new THREE.Mesh(waypointGeo, waypointMat);
    waypointMesh.position.copy(centerVec);
    nexusLinesGroup.add(waypointMesh);
  }

  const lineMaterial = new THREE.LineBasicMaterial({ color: '#334155', transparent: true, opacity: 0.2 });
  for (let i = 0; i < activeHubs.length; i++) {
    for (let j = i + 1; j < activeHubs.length; j++) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([activeHubs[i].pos, activeHubs[j].pos]);
      nexusLinesGroup.add(new THREE.Line(lineGeo, lineMaterial));
    }
  }
}

// --- UI EVENT LINKING INTERFACES ---
function setupParentToggle(parentId, funderPrefix) {
  document.getElementById(parentId).addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll(`.child-box`).forEach(box => {
      const funder = box.getAttribute('data-funder');
      if(funder.startsWith(funderPrefix)) {
        box.checked = isChecked;
        if(isChecked) activeFilters.add(funder);
        else activeFilters.delete(funder);
      }
    });
    updateMeshAndMetricsPipeline();
  });
}

function updateParentCheckboxStates() {
  const childBoxes = Array.from(document.querySelectorAll('.child-box'));
  ['public_', 'industry_'].forEach(prefix => {
    const parentId = prefix === 'public_' ? 'parent-public' : 'parent-industry';
    const parentBox = document.getElementById(parentId);
    const elements = childBoxes.filter(box => box.getAttribute('data-funder').startsWith(prefix));
    const allChecked = elements.every(box => box.checked);
    const noneChecked = elements.every(box => !box.checked);
    parentBox.checked = allChecked;
    parentBox.indeterminate = !allChecked && !noneChecked; 
  });
}

document.getElementById('search-input').addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase();
  updateMeshAndMetricsPipeline();
});

// --- 8. RAYCASTER (HOVER INJECTION) ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tooltip = document.getElementById('tooltip');
const tooltipTitle = document.getElementById('tooltip-title');
const tooltipConcepts = document.getElementById('tooltip-concepts');
const citationFooter = document.getElementById('citation-footer');
const citationText = document.getElementById('citation-text');

let hoveredInstanceId = null;

window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  if (!instancedMesh) return;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(instancedMesh);

  if (intersects.length > 0) {
    const instanceId = intersects[0].instanceId;
    if (hoveredInstanceId !== instanceId) {
      hoveredInstanceId = instanceId;
      const paper = paperData[instanceId];

      const matrix = new THREE.Matrix4();
      instancedMesh.getMatrixAt(instanceId, matrix);
      const pos = new THREE.Vector3().setFromMatrixPosition(matrix);
      if (pos.x === 0 && pos.y === 0 && pos.z === 0 && !activeFilters.has(paper.funder)) return;

      const funderHex = funderColors[paper.funder] || '#94a3b8';
      tooltipTitle.innerHTML = `
        <div style="margin-bottom: 4px;">${paper.title || "Unknown"}</div>
        <div style="display: inline-block; padding: 1px 5px; font-size: 0.7rem; border-radius: 4px; background: rgba(15,23,42,0.6); border: 1px solid ${funderHex}; color: ${funderHex}; margin-bottom: 4px;">
          ${funderLabels[paper.funder] || paper.funder}
        </div>
      `;
      tooltipConcepts.innerText = paper.concepts ? paper.concepts.join(" • ") : "";
      tooltip.style.display = 'block';
      
      const authorText = paper.author_citation && paper.author_citation !== "Unknown" ? `${paper.author_citation} ` : "";
      const doiText = paper.doi ? ` • DOI: ${paper.doi.replace('https://doi.org/', '')}` : '';
      citationText.innerHTML = `<span style="color: #64748b;">${authorText}(${paper.year || "N/A"}).</span> “${paper.title}” <span style="color: #38bdf8;">${doiText}</span>`;
      citationFooter.style.opacity = '1';
    }
    tooltip.style.left = event.clientX + 12 + 'px';
    tooltip.style.top = event.clientY + 12 + 'px';
  } else {
    tooltip.style.display = 'none';
    citationFooter.style.opacity = '0';
    hoveredInstanceId = null;
  }
});

// --- 9. ANIMATION RENDERING MATRIX ---
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  
  nexusLinesGroup.children.forEach(child => {
    if(child.isMesh) {
      child.rotation.x += 0.004;
      child.rotation.y += 0.004;
    }
  });

  composer.render(); 
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});