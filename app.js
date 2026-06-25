/**
 * CityMapper Studio Pro Engine Logic Controller Module
 * Production Modular Guarded Architecture System
 */

window.mapInstance = null;
let uiDebounceTimer = null;
let isUpdatingStyles = false; 
let coordsManuallyEdited = false; // true once the person types their own GPS value directly

function formatCoords(lng, lat) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lonDir}`;
}

// Combines the region field and the GPS coordinates field into the single subtitle
// line that actually gets rendered - this is the one place that does that, so the
// live preview and the export are always guaranteed to compose it the same way.
function composeSubtitleText() {
    const region = (document.getElementById('text-sub-input').value || '').trim();
    const coords = (document.getElementById('text-coords-input').value || '').trim();
    if (region && coords) return `${region} | ${coords}`;
    return region || coords;
}

// Keeps the GPS Coordinates field tracking wherever the map is actually centered,
// unless the person has manually typed their own value - a deliberate new search
// (see searchLocation()) resets that and takes over again.
function syncCoordsFromMap() {
    if (coordsManuallyEdited || !window.mapInstance) return;
    const center = window.mapInstance.getCenter();
    const coordsInput = document.getElementById('text-coords-input');
    if (coordsInput) coordsInput.value = formatCoords(center.lng, center.lat);
}

// Updates only the visible subtitle text, with no other side effects - safe to call
// on every map move, including mid-export (unlike renderDOMTypographyUpdates(), which
// also resizes the poster wrapper).
function refreshSubtitleLabelText() {
    const subLabel = document.getElementById('label-sub');
    if (subLabel) subLabel.innerText = composeSubtitleText().toUpperCase();
}

const themePresets = {
    'minimal-gray': { title: 'Charcoal', bg: '#ffffff', highway: '#222222', roads: '#777777', buildings: '#e0e0e0', water: '#f0f0f0', parks: '#ebf2ea', trains: '#bcbcbc', textMain: '#111111', textSub: '#555555' },
    'cyber-neon': { title: 'Cyber Neon', bg: '#08090f', highway: '#00ffcc', roads: '#1a233a', buildings: '#101524', water: '#0d1b2a', parks: '#0a1a15', trains: '#ff0055', textMain: '#00ffcc', textSub: '#8fa0b2' },
    'district-pop': { title: 'District Pop', bg: '#f4f4f2', highway: '#1a1a1a', roads: '#555555', buildings: '#d96b43', water: '#7cb2c4', parks: '#7da35d', trains: '#333333', textMain: '#1a1a1a', textSub: '#555555' },
    'architect-blueprint': { title: 'Blueprint', bg: '#121f35', highway: '#ffffff', roads: '#7791b7', buildings: '#1a2c49', water: '#112d4a', parks: '#121f35', trains: '#5f9aff', textMain: '#ffffff', textSub: '#7791b7' },
    'warm-terracotta': { title: 'Clay', bg: '#f4ebe1', highway: '#b85032', roads: '#d99b77', buildings: '#ebd0be', water: '#e0c3b1', parks: '#e3dfd5', trains: '#823720', textMain: '#612312', textSub: '#9c6f59' },
    'gold-dark': { title: 'Gold Foil', bg: '#000000', highway: '#d4af37', roads: '#b0912d', buildings: '#423712', water: '#1a170b', parks: '#141a0f', trains: '#7a6221', textMain: '#d4af37', textSub: '#888888' },
    'urban-hollywood': { title: 'Hollywood', bg: '#dbb1bc', highway: '#ffffff', roads: '#f7e8df', buildings: '#9e6c7d', water: '#6e959d', parks: '#e6c875', trains: '#826c9d', textMain: '#ffffff', textSub: '#f7e8df' },
    'lavender-light': { title: 'Lavender', bg: '#f3f1f7', highway: '#4a3b63', roads: '#8c829e', buildings: '#b8afc8', water: '#d2cbdc', parks: '#e6f0fa', trains: '#a399b3', textMain: '#36294d', textSub: '#6b617a' },
    'mid-century-navy': { title: 'Navy', bg: '#162b3d', highway: '#fca34d', roads: '#3a5f7d', buildings: '#223f5a', water: '#1d486c', parks: '#1f3a3a', trains: '#8da9c4', textMain: '#fdf2a7', textSub: '#a5c4d4' },
    'emerald-forest': { title: 'Emerald', bg: '#0b1d12', highway: '#c3a35a', roads: '#1b3b22', buildings: '#122918', water: '#08160e', parks: '#1c4228', trains: '#947a43', textMain: '#ebd59b', textSub: '#709377' }
};

// INITIALIZATION PIPELINE
document.addEventListener("DOMContentLoaded", () => {

    window.mapInstance = new maplibregl.Map({
        container: 'map',
        // Change 'dark' to 'liberty' to force the server to send the park polygons
        style: 'https://tiles.openfreemap.org/styles/liberty', 
        center: [9.0908, 48.7297], 
        zoom: 14.1, 
        attributionControl: false, 
        preserveDrawingBuffer: true
    });

    window.mapInstance.on('load', () => { 
        const vignette = document.getElementById('map-vignette');
        const boundingBox = document.getElementById('map-bounding-box');
        if (vignette && boundingBox) boundingBox.appendChild(vignette);

        generateVisualSwatches();
        bindUIControlsProgrammatically(); 
        
        requestAnimationFrame(() => {
            syncCoordsFromMap();
            selectSwatchTheme('cyber-neon');
        });
    });

    // NOTE: a 'styledata' listener used to live here that re-ran the override pipeline
    // every time the style changed internally. But setPaintProperty() itself triggers
    // 'styledata' on the next render tick - by which point isUpdatingStyles had already
    // been reset to false, so the guard didn't catch it. That created a feedback loop
    // that re-applied (and briefly re-flickered) every override right after a theme click.
    // Every UI action already calls executeVectorStyleOverrides()/renderDOMTypographyUpdates()
    // directly, so this listener was redundant - removing it removes the flicker/loop.

    window.mapInstance.on('moveend', () => {
        // Keeps the GPS field tracking the map on every pan/zoom/search flyTo, unless
        // the person has manually typed their own coordinates (see bindUIControlsProgrammatically).
        // Deliberately lightweight: just the input value + visible label text, not the
        // full renderDOMTypographyUpdates() - that function also resizes the poster
        // wrapper, and the export pipeline's zoom-compensation jumpTo() also fires
        // 'moveend' mid-export, which would otherwise stomp on its temporary dimensions.
        syncCoordsFromMap();
        refreshSubtitleLabelText();
        if (!isUpdatingStyles) executeVectorStyleOverrides();
    });
});

function bindUIControlsProgrammatically() {
    const triggerInputs = [
        'poster-aspect-ratio',
        'text-visible-toggle', 'text-main-input', 'text-sub-input', 'text-coords-input', 'font-select',
        'size-font-main', 'letter-spacing-main', 'text-layout-mode', 'width-highways',
        'width-roads', 'opacity-lines', 'opacity-buildings',
        'style-soft-edges', 'vignette-intensity', 'color-bg', 'color-highways',
        'color-roads', 'color-buildings', 'color-water', 'color-parks', 'color-trains',
        'color-text-main', 'color-text-sub'
    ];

    triggerInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', triggerUIDebounce);
            el.addEventListener('change', triggerUIDebounce);
        }
    });

    // Setting .value from code (the map-driven auto-sync) never fires 'input' - only
    // actual keystrokes from the person do. So this only flips on when they actually
    // type a manual tweak, which is exactly when auto-sync should back off.
    const coordsInput = document.getElementById('text-coords-input');
    if (coordsInput) {
        coordsInput.addEventListener('input', () => { coordsManuallyEdited = true; });
    }

    const layerToggles = ['layer-highways', 'layer-roads', 'layer-buildings', 'layer-water', 'layer-water-labels', 'layer-parks', 'layer-trains', 'layer-labels', 'layer-area-labels'];
    layerToggles.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', toggleMapLayers);
    });

    const btnSearch = document.getElementById('btn-search');
    if (btnSearch) btnSearch.addEventListener('click', searchLocation);

    const btnExport = document.getElementById('btn-export');
    if (btnExport) btnExport.addEventListener('click', processExportPipeline);
}

function executeVectorStyleOverrides() {
    const map = window.mapInstance;
    if (!map || !map.isStyleLoaded() || isUpdatingStyles) return;

    isUpdatingStyles = true; 

    const bgStyleVal = document.getElementById('color-bg').value;
    const highwayColorVal = document.getElementById('color-highways').value;
    const roadColorVal = document.getElementById('color-roads').value;
    const buildingColorVal = document.getElementById('color-buildings').value;
    const waterColorVal = document.getElementById('color-water').value;
    const parkColorVal = document.getElementById('color-parks').value;
    const trainColorVal = document.getElementById('color-trains').value;
    
    const highwaySliderWidth = parseFloat(document.getElementById('width-highways').value);
    const roadSliderWidth = parseFloat(document.getElementById('width-roads').value);
    const lineOpacityVal = parseFloat(document.getElementById('opacity-lines').value);
    const buildingOpacityVal = parseFloat(document.getElementById('opacity-buildings').value);
    const showParksVal = document.getElementById('layer-parks').checked;

    const isHighwayRegex = /(motorway|trunk|primary|major|expressway|highway|link)/i;
    const isMinorRoadRegex = /(minor|residential|service|secondary|tertiary|street|road|path|track)/i;
    const isBuildingRegex = /(building|3d|structure|extrusion)/i;
    const isWaterRegex = /(water|stream|river|lake|ocean|sea|marina)/i;
    // Removed the bare "landcover" keyword: it was matching landcover_ice / landcover_sand /
    // landcover_wetland too, forcing them green (and wetland uses a fill-pattern texture, not
    // a flat color, so the park color picker could never actually touch it anyway).
    const isParkRegex = /(park|leisure|forest|green|nature|cemetery|wood|grass)/i;
    // Small land-use accent parcels (sports pitches, running tracks, school/hospital grounds)
    // that OpenStreetMap commonly maps as separate polygons *inside or beside* parks. The old
    // "Background Paint Guard" below painted these as a solid, fully opaque background color,
    // which - since they're drawn on top of the park/forest fill - punched visible holes
    // straight through the green. Hiding them outright fixes that, and keeps the poster clean.
    const isClutterRegex = /(pitch|track|hospital|school|playground|parking)/i;
    const isTrainRegex = /(rail|train|transit|railway|subway)/i;

    const layers = map.getStyle().layers;

    layers.forEach(layer => {
        const layerSrc = layer.source || '';
        const sourceLayerStr = layer['source-layer'] || layer.sourceLayer || '';
        const fullLayerPath = `${layer.id} ${layerSrc} ${sourceLayerStr}`;

        if (layer.type === 'background') {
            map.setPaintProperty(layer.id, 'background-color', bgStyleVal);
        }
        
        // Background Paint Guard - blends stray basemap fills into the background, but
        // never over park/forest layers, and never by painting a solid opaque block over
        // small accent parcels (those get hidden instead, see isClutterRegex above)
        if (layer.type === 'fill' && (layer.id.includes('land') || layer.id.includes('area') || layer.id.includes('background'))) {
            if (isClutterRegex.test(fullLayerPath)) {
                map.setLayoutProperty(layer.id, 'visibility', 'none');
            } else if (!isParkRegex.test(fullLayerPath)) {
                map.setPaintProperty(layer.id, 'fill-color', bgStyleVal);
            }
        }

        if (isBuildingRegex.test(fullLayerPath)) {
            if (layer.type === 'fill') {
                map.setPaintProperty(layer.id, 'fill-color', buildingColorVal);
                map.setPaintProperty(layer.id, 'fill-opacity', buildingOpacityVal);
            } else if (layer.type === 'fill-extrusion') {
                // fill-extrusion layers (3D buildings, active at zoom >= 14) don't have a
                // 'fill-color'/'fill-opacity' paint property - that silently failed validation
                // and never applied, which is why building color never seemed to "take" at
                // the app's default zoom level.
                map.setPaintProperty(layer.id, 'fill-extrusion-color', buildingColorVal);
                map.setPaintProperty(layer.id, 'fill-extrusion-opacity', buildingOpacityVal);
            }
        }
        if (isWaterRegex.test(fullLayerPath)) {
            if (layer.type === 'fill') map.setPaintProperty(layer.id, 'fill-color', waterColorVal);
            if (layer.type === 'line') map.setPaintProperty(layer.id, 'line-color', waterColorVal);
        }
        
        // Hardened Park Pipeline - Forces visibility on dark maps, but respects the
        // "Render Parks & Greenery" checkbox instead of always forcing it back on
        // (it used to fight with toggleMapLayers(), so unchecking that box did nothing)
        if (isParkRegex.test(fullLayerPath)) {
            if (layer.type === 'fill') {
                map.setPaintProperty(layer.id, 'fill-color', parkColorVal);
                map.setPaintProperty(layer.id, 'fill-opacity', 1.0);
                map.setLayoutProperty(layer.id, 'visibility', showParksVal ? 'visible' : 'none');
            } else if (layer.type === 'line') {
                // covers park outlines, so the border matches the chosen park color too
                map.setPaintProperty(layer.id, 'line-color', parkColorVal);
                map.setLayoutProperty(layer.id, 'visibility', showParksVal ? 'visible' : 'none');
            }
        }
        
        if (isTrainRegex.test(fullLayerPath)) {
            if (layer.type === 'line') map.setPaintProperty(layer.id, 'line-color', trainColorVal);
        }
        if (layer.type === 'line' && isHighwayRegex.test(fullLayerPath)) {
            map.setPaintProperty(layer.id, 'line-color', highwayColorVal);
            map.setPaintProperty(layer.id, 'line-width', highwaySliderWidth);
            map.setPaintProperty(layer.id, 'line-opacity', lineOpacityVal);
        }
        if (layer.type === 'line' && isMinorRoadRegex.test(fullLayerPath) && !isHighwayRegex.test(fullLayerPath)) {
            map.setPaintProperty(layer.id, 'line-color', roadColorVal);
            map.setPaintProperty(layer.id, 'line-width', [
                'interpolate', ['linear'], ['zoom'],
                1, 0.1,   
                10, 0.2,  
                14, roadSliderWidth 
            ]);
            map.setPaintProperty(layer.id, 'line-opacity', lineOpacityVal);
        }
    });

    isUpdatingStyles = false; 
}

function triggerUIDebounce() {
    clearTimeout(uiDebounceTimer);
    uiDebounceTimer = setTimeout(() => {
        renderDOMTypographyUpdates();
        executeVectorStyleOverrides();
    }, 30);
}

function hexToRgba(hex, alpha) {
    const sanitized = (hex || '#000000').replace('#', '');
    const full = sanitized.length === 3 ? sanitized.split('').map(c => c + c).join('') : sanitized;
    const intVal = parseInt(full, 16) || 0;
    const r = (intVal >> 16) & 255;
    const g = (intVal >> 8) & 255;
    const b = intVal & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderDOMTypographyUpdates() {
    const bgVal = document.getElementById('color-bg').value;
    const mainTextVal = document.getElementById('color-text-main').value;
    const subTextVal = document.getElementById('color-text-sub').value;
    const fontVal = document.getElementById('font-select').value;
    
    const fontSizeMain = document.getElementById('size-font-main').value;
    const letterSpacingMain = document.getElementById('letter-spacing-main').value;
    
    const textVisible = document.getElementById('text-visible-toggle').checked;
    const textLayoutMode = document.getElementById('text-layout-mode').value; // 'banner' | 'overlay-text' | 'overlay-banner' | 'overlay-compact'
    const labelBlock = document.getElementById('poster-label');
    const mapBox = document.getElementById('map-bounding-box');
    const typographyControls = document.getElementById('typography-controls-wrapper');
    const textColorRow = document.getElementById('text-color-picker-row');

    if (textVisible) {
        if (typographyControls) typographyControls.style.display = "block";
        if (textColorRow) textColorRow.style.display = "flex";
        if (labelBlock) labelBlock.classList.remove('hidden-element');

        if (labelBlock) {
            labelBlock.classList.remove('text-only', 'floating-banner', 'floating-compact');
            if (textLayoutMode === 'overlay-text') {
                labelBlock.classList.add('text-only');
                labelBlock.style.backgroundColor = 'transparent';
            } else if (textLayoutMode === 'overlay-banner') {
                labelBlock.classList.add('floating-banner');
                labelBlock.style.backgroundColor = bgVal;
            } else if (textLayoutMode === 'overlay-compact') {
                labelBlock.classList.add('floating-compact');
                labelBlock.style.backgroundColor = hexToRgba(bgVal, 0.85);
            } else {
                // 'banner' - the original bottom bar, with its own reserved space
                labelBlock.style.backgroundColor = bgVal;
            }
        }

        // Every overlay mode lets the map fill the full poster height behind the label;
        // only the plain bottom banner reserves its own dedicated strip beneath the map.
        if (mapBox) {
            if (textLayoutMode === 'banner') mapBox.classList.remove('full-bleed');
            else mapBox.classList.add('full-bleed');
        }
    } else {
        if (typographyControls) typographyControls.style.display = "none";
        if (textColorRow) textColorRow.style.display = "none";
        if (labelBlock) labelBlock.classList.add('hidden-element');
        if (mapBox) mapBox.classList.add('full-bleed');
    }
    
    const posterFrame = document.getElementById('poster-frame');
    const posterWrapper = document.getElementById('poster-wrapper');
    const aspectRatioMode = document.getElementById('poster-aspect-ratio').value;
    
    if (posterFrame) posterFrame.style.backgroundColor = bgVal;
    
    if (posterWrapper) {
        posterWrapper.style.height = "auto";
        if (posterFrame) posterFrame.style.height = "auto";
        
        // Each mode caps its width the same way Portrait always did (min(100%, Npx)).
        // Before, only Portrait was capped - the other three used a bare "100%", which
        // resolves against the whole map panel (often 800-1000px+), and since
        // #poster-wrapper has flex-shrink:0 it doesn't get squeezed back down - it just
        // ballooned to fill the panel, pushing the label and most of the poster off screen.
        if (aspectRatioMode === 'landscape-4-3') {
            posterWrapper.style.aspectRatio = "4 / 3";
            posterWrapper.style.width = "min(100%, 560px)";
        } else if (aspectRatioMode === 'widescreen-16-9') {
            posterWrapper.style.aspectRatio = "16 / 9";
            posterWrapper.style.width = "min(100%, 746px)";
        } else if (aspectRatioMode === 'square-1-1') {
            posterWrapper.style.aspectRatio = "1 / 1";
            posterWrapper.style.width = "min(100%, 500px)";
        } else {
            posterWrapper.style.aspectRatio = "3 / 4";
            posterWrapper.style.width = "min(100%, 420px)"; 
        }

        if (window.mapInstance) window.mapInstance.resize();
    }
    
    const mainLabel = document.getElementById('label-main');
    if (mainLabel) {
        mainLabel.innerText = document.getElementById('text-main-input').value.toUpperCase(); 
        mainLabel.style.color = mainTextVal;
        mainLabel.style.fontFamily = fontVal;
        mainLabel.style.fontSize = `${fontSizeMain}px`;
        mainLabel.style.letterSpacing = `${letterSpacingMain}px`;
    }

    const subLabel = document.getElementById('label-sub');
    if (subLabel) {
        subLabel.innerText = composeSubtitleText().toUpperCase(); 
        subLabel.style.color = subTextVal;
        subLabel.style.fontFamily = fontVal;
    }

    const vignetteToggle = document.getElementById('style-soft-edges').checked;
    const vignetteMask = document.getElementById('map-vignette');
    const vignetteIntensity = parseInt(document.getElementById('vignette-intensity').value);
    
    if (vignetteToggle && vignetteMask) {
        vignetteMask.style.display = "block";
        vignetteMask.style.pointerEvents = "none";
        // Previously the vignette color was hardcoded black in styles.css, so on light
        // themes (District Pop, Lavender, Clay, etc.) you'd always get a black smudge
        // around the edges no matter what theme you picked, and the intensity slider
        // had no visible effect here at all (it only affected the final exported file).
        vignetteMask.style.boxShadow = `inset 0 0 ${vignetteIntensity}px ${Math.round(vignetteIntensity / 3)}px ${bgVal}`;
    } else if (vignetteMask) {
        vignetteMask.style.display = "none";
    }
}


function generateVisualSwatches() {
    const grid = document.getElementById('palette-container-wrapper');
    if (!grid) return;
    grid.innerHTML = '';

    Object.keys(themePresets).forEach(key => {
        const p = themePresets[key];
        const div = document.createElement('div');
        div.className = `palette-swatch`;
        div.id = `swatch-${key}`;
        div.onclick = () => selectSwatchTheme(key);

        div.innerHTML = `
            <div class="swatch-color-bar">
                <div class="swatch-split" style="background:${p.bg};"></div>
                <div class="swatch-split" style="background:${p.highway};"></div>
                <div class="swatch-split" style="background:${p.roads};"></div>
            </div>
            <div class="swatch-title">${p.title}</div>
        `;
        grid.appendChild(div);
    });
}

function selectSwatchTheme(key) {
    document.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('active'));
    const activeSwatch = document.getElementById(`swatch-${key}`);
    if (activeSwatch) activeSwatch.classList.add('active');

    const preset = themePresets[key];
    document.getElementById('color-bg').value = preset.bg;
    document.getElementById('color-highways').value = preset.highway;
    document.getElementById('color-roads').value = preset.roads;
    document.getElementById('color-buildings').value = preset.buildings;
    document.getElementById('color-water').value = preset.water;
    document.getElementById('color-parks').value = preset.parks;
    document.getElementById('color-trains').value = preset.trains;
    document.getElementById('color-text-main').value = preset.textMain;
    document.getElementById('color-text-sub').value = preset.textSub;

    executeVectorStyleOverrides();
    renderDOMTypographyUpdates();
}

function toggleMapLayers() {
    const map = window.mapInstance;
    if (!map || !map.isStyleLoaded()) return;

    const showHighways = document.getElementById('layer-highways').checked;
    const showRoads = document.getElementById('layer-roads').checked;
    const showBuildings = document.getElementById('layer-buildings').checked;
    const showWater = document.getElementById('layer-water').checked;
    const showParks = document.getElementById('layer-parks').checked;
    const showTrains = document.getElementById('layer-trains').checked;
    const showLabels = document.getElementById('layer-labels').checked;
    const showAreaLabels = document.getElementById('layer-area-labels').checked;
    const showWaterLabels = document.getElementById('layer-water-labels').checked;

    const layers = map.getStyle().layers;
    const isHighwayRegex = /(motorway|trunk|primary|major|expressway|highway|link)/i;
    const isMinorRoadRegex = /(minor|residential|service|secondary|tertiary|street|road|path|track)/i;
    const isBuildingRegex = /(building|3d|structure|extrusion)/i;
    const isWaterRegex = /(water|stream|river|lake|ocean|sea|marina)/i;
    // Kept in sync with executeVectorStyleOverrides()'s isParkRegex (no bare "landcover")
    // so the checkbox toggles the same set of layers the color picker and pipeline target.
    const isParkRegex = /(park|leisure|forest|green|nature|cemetery|wood|grass)/i;
    const isTrainRegex = /(rail|train|transit|railway|subway)/i;
    // label_other is OpenFreeMap Liberty's layer for suburb/neighborhood/quarter/hamlet
    // names (place classes other than city/town/village/state/country) - the bold,
    // letter-spaced "area" text the user noticed, distinct from street names and city labels.
    const isAreaLabelRegex = /^label_other$/i;

    layers.forEach(layer => {
        const layerSrc = layer.source || '';
        const sourceLayerStr = layer['source-layer'] || layer.sourceLayer || '';
        const fullLayerPath = `${layer.id} ${layerSrc} ${sourceLayerStr}`;

        if (layer.type === 'symbol') {
            // Symbol (text/icon) layers are handled exclusively here, in priority order,
            // then we move on - water name labels (lakes/rivers) also contain the word
            // "water" in their ids, so they used to ALSO get caught by the water-polygon
            // check further down, which ran after this block and silently overrode
            // whatever this block decided. Returning here means only one toggle ever
            // controls a given label layer.
            if (isWaterRegex.test(fullLayerPath)) {
                map.setLayoutProperty(layer.id, 'visibility', showWaterLabels ? 'visible' : 'none');
            } else if (isAreaLabelRegex.test(layer.id)) {
                map.setLayoutProperty(layer.id, 'visibility', showAreaLabels ? 'visible' : 'none');
            } else {
                map.setLayoutProperty(layer.id, 'visibility', showLabels ? 'visible' : 'none');
            }
            return;
        }
        if (isBuildingRegex.test(fullLayerPath)) {
            map.setLayoutProperty(layer.id, 'visibility', showBuildings ? 'visible' : 'none');
        }
        if (isWaterRegex.test(fullLayerPath)) {
            map.setLayoutProperty(layer.id, 'visibility', showWater ? 'visible' : 'none');
        }
        if (isParkRegex.test(fullLayerPath)) {
            map.setLayoutProperty(layer.id, 'visibility', showParks ? 'visible' : 'none');
        }
        if (isTrainRegex.test(fullLayerPath)) {
            map.setLayoutProperty(layer.id, 'visibility', showTrains ? 'visible' : 'none');
        }
        if (layer.id.includes('road') || layer.id.includes('transportation') || layer.id.includes('link')) {
            if (isHighwayRegex.test(fullLayerPath)) {
                map.setLayoutProperty(layer.id, 'visibility', showHighways ? 'visible' : 'none');
            } else if (isMinorRoadRegex.test(fullLayerPath)) {
                map.setLayoutProperty(layer.id, 'visibility', showRoads ? 'visible' : 'none');
            }
        }
    });
    
    executeVectorStyleOverrides();
    renderDOMTypographyUpdates();
}

async function searchLocation() {
    const query = document.getElementById('search-input').value;
    if (!query) return;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=4`;
    const resultsBox = document.getElementById('search-results');
    resultsBox.innerHTML = '';

    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'CityMapperStore-StudioApp' } });
        const data = await response.json();

        if (data.length === 0) {
            resultsBox.innerHTML = '<div class="search-item">No results.</div>';
            resultsBox.style.display = 'block';
            return;
        }

        resultsBox.style.display = 'block';
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerText = item.display_name;
            div.onclick = () => {
                if (window.mapInstance) window.mapInstance.flyTo({ center: [parseFloat(item.lon), parseFloat(item.lat)], zoom: 14.1 }); 
                
                const nameArray = item.display_name.split(',');
                document.getElementById('text-main-input').value = nameArray[0].trim();
                document.getElementById('text-sub-input').value = (nameArray[2] || nameArray[1] || '').trim().toUpperCase();

                const lat = parseFloat(item.lat);
                const lon = parseFloat(item.lon);
                // A deliberate new search always wins over a previous manual coordinate
                // tweak - the person picked a new place, so the GPS field should reflect
                // it and auto-sync should resume tracking the map from here on.
                coordsManuallyEdited = false;
                document.getElementById('text-coords-input').value = formatCoords(lon, lat);
                
                resultsBox.style.display = 'none';
                executeVectorStyleOverrides();
                renderDOMTypographyUpdates();
            };
            resultsBox.appendChild(div);
        });
    } catch (err) {
        console.error("Geocoding lookup error: ", err);
    }
}

document.addEventListener('click', (e) => {
    const resultsBox = document.getElementById('search-results');
    if (resultsBox && e.target.id !== 'search-input') {
        resultsBox.style.display = 'none';
    }
});

// FIXED PRODUCTION ENGINE: Mobile iOS Breakout + Dynamic Layout Math
function processExportPipeline() {
    const map = window.mapInstance;
    if (!map) return;

    const exportResMode = document.getElementById('export-resolution').value;
    const exportBtn = document.getElementById('btn-export');
    const originalBtnLabel = "Generate Art File";

    exportBtn.innerText = "Compiling Print File...";
    exportBtn.disabled = true;

    const wrapper = document.getElementById('poster-wrapper');
    const innerWrapper = document.getElementById('map-wrapper-inner');
    const mapDiv = document.getElementById('map');

    // Read the poster's actual current on-screen size rather than a separate, hardcoded
    // set of width/height constants. That guarantees every export tier is a scaled-up
    // match of exactly what's in the preview (including on mobile's smaller breakpoint),
    // instead of a second set of numbers that could quietly drift out of sync with it.
    const wrapperRect = wrapper.getBoundingClientRect();
    const baseWidth = Math.round(wrapperRect.width);
    const baseHeight = Math.round(wrapperRect.height);

    // "Quick Web Preview" uses the screen's own pixel ratio, so that tier is a pixel-faithful
    // copy of the live preview rather than an arbitrarily different size. The two print tiers
    // scale further, because true print sharpness needs the map to actually render more real
    // pixels of detail - that part can't be faked by upscaling a small on-screen canvas.
    const exportResMultiplier = (exportResMode === 'print-high') ? 4
        : (exportResMode === 'print-ultra') ? 6
        : Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const multiplier = exportResMultiplier;

    const targetWidth = Math.round(baseWidth * multiplier);
    const targetHeight = Math.round(baseHeight * multiplier);

    // THE FIELD-OF-VIEW FIX: on a tile-based map, geographic area shown = canvas pixels
    // divided by 2^zoom. The live preview deliberately renders the map at 2x the visible
    // poster size (see #map-wrapper-inner's 200%/scale(0.5) in styles.css - the "Extended
    // Field of View" trick) then shrinks it back down with CSS, which is what gives the
    // preview its richer, slightly-zoomed-out crop. The export was rendering at a literal
    // 1x-to-multiplier canvas with NO such trick and at the SAME zoom level, so a bigger
    // canvas (for print sharpness) was also quietly widening the field of view - e.g. the
    // 6x "ultra" tier showed 3x more width/height (9x more area) than the preview. More
    // export pixels should mean more *detail*, not a different camera. To cancel that out
    // and frame the identical ground area as the preview, just sharper, we zoom IN by
    // log2(multiplier / 2) before rendering, then zoom back out to restore the preview after.
    const liveZoom = map.getZoom();
    const liveCenter = map.getCenter();
    const exportZoom = liveZoom + Math.log2(multiplier / 2);

    const origWrapperStyle = wrapper.style.cssText;
    const origInnerStyle = innerWrapper.style.cssText;
    const origMapStyle = mapDiv.style.cssText;
    const origBodyOverflow = document.body.style.overflow;

    document.body.style.overflow = 'visible';
    wrapper.style.cssText = `position: absolute; top: 0; left: 0; width: ${targetWidth}px; height: ${targetHeight}px; max-width: none !important; max-height: none !important; z-index: -9999; transform: none !important;`;
    innerWrapper.style.cssText = `width: 100% !important; height: 100% !important; transform: none !important; max-width: none !important; max-height: none !important;`;
    mapDiv.style.cssText = `width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important;`;

    map.resize();
    map.jumpTo({ center: liveCenter, zoom: exportZoom });
    executeVectorStyleOverrides();

    let restored = false;
    const restoreLivePreview = () => {
        if (restored) return;
        restored = true;
        wrapper.style.cssText = origWrapperStyle;
        innerWrapper.style.cssText = origInnerStyle;
        mapDiv.style.cssText = origMapStyle;
        document.body.style.overflow = origBodyOverflow;
        map.resize();
        map.jumpTo({ center: liveCenter, zoom: liveZoom });
        executeVectorStyleOverrides();
        renderDOMTypographyUpdates();
    };

    const resetButton = (label, delay) => {
        setTimeout(() => {
            exportBtn.innerText = label;
            exportBtn.disabled = false;
        }, delay);
    };

    map.once('idle', () => {
        try {
            const originalCanvas = map.getCanvas();
            const textVisible = document.getElementById('text-visible-toggle').checked;
            const textLayoutMode = document.getElementById('text-layout-mode').value; // 'banner' | 'overlay-text' | 'overlay-banner' | 'overlay-compact'
            const softEdgeToggle = document.getElementById('style-soft-edges').checked;
            const vignetteIntensity = parseInt(document.getElementById('vignette-intensity').value);
            const labelBlockHeightSrc = textVisible ? 75 : 0;

            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = targetWidth;
            exportCanvas.height = targetHeight;
            const ctx = exportCanvas.getContext('2d');

            const bgStyle = document.getElementById('color-bg').value;
            const mainTextClass = document.getElementById('color-text-main').value;
            const subTextClass = document.getElementById('color-text-sub').value;
            const titleValue = document.getElementById('text-main-input').value.toUpperCase();
            const subtitleValue = composeSubtitleText().toUpperCase();
            const fontSelected = document.getElementById('font-select').value;
            const fontSizeMainSrc = parseInt(document.getElementById('size-font-main').value);
            const letterSpacingSrc = parseInt(document.getElementById('letter-spacing-main').value);

            ctx.fillStyle = bgStyle;
            ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

            let mapDestHeight = exportCanvas.height;
            if (textVisible && textLayoutMode === 'banner') {
                mapDestHeight = exportCanvas.height - (labelBlockHeightSrc * multiplier);
            }

            ctx.drawImage(originalCanvas, 0, 0, exportCanvas.width, mapDestHeight);

            if (softEdgeToggle) {
                // Same blur-to-spread ratio as the live CSS vignette (see
                // renderDOMTypographyUpdates) so the exported file actually looks like
                // what was on screen, just sharper - the old code used a different ratio
                // here, which is why the two could look noticeably different before.
                ctx.globalCompositeOperation = "source-over";
                const shadowBorder = (vignetteIntensity / 3) * multiplier;
                ctx.strokeStyle = bgStyle;
                ctx.lineWidth = shadowBorder;
                ctx.shadowBlur = vignetteIntensity * multiplier;
                ctx.shadowColor = bgStyle;
                ctx.strokeRect(shadowBorder/2, shadowBorder/2, exportCanvas.width - shadowBorder, mapDestHeight - shadowBorder);
            }

            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            if (textVisible) {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const titleFont = `bold ${Math.floor(fontSizeMainSrc * multiplier)}px ${fontSelected}`;
                const subFont = `${Math.floor(9 * multiplier)}px ${fontSelected}`;

                if (textLayoutMode === 'banner') {
                    // Plain bottom bar in its own reserved strip beneath the map.
                    const bannerCenterY = mapDestHeight + ((exportCanvas.height - mapDestHeight) / 2);
                    ctx.fillStyle = bgStyle;
                    ctx.fillRect(0, mapDestHeight, exportCanvas.width, exportCanvas.height - mapDestHeight);

                    ctx.fillStyle = mainTextClass;
                    ctx.font = titleFont;
                    ctx.letterSpacing = `${letterSpacingSrc * multiplier}px`;
                    ctx.fillText(titleValue, exportCanvas.width / 2, bannerCenterY - (8 * multiplier));

                    ctx.fillStyle = subTextClass;
                    ctx.font = subFont;
                    ctx.letterSpacing = `${2 * multiplier}px`;
                    ctx.fillText(subtitleValue, exportCanvas.width / 2, bannerCenterY + (10 * multiplier));
                } else {
                    // All three "overlay" modes share the same vertical placement (shifted
                    // up off the bottom edge, sitting on top of the full-bleed map).
                    // overlay-text draws no box at all - just the text. overlay-banner and
                    // overlay-compact draw a box behind it, matching their CSS classes.
                    const overlayCenterY = exportCanvas.height - (60 * multiplier);
                    const titleY = overlayCenterY - (6 * multiplier);
                    const subtitleY = overlayCenterY + (14 * multiplier);

                    if (textLayoutMode !== 'overlay-text') {
                        const boxTop = overlayCenterY - (32 * multiplier);
                        const boxHeight = 65 * multiplier;
                        const paddingX = 24 * multiplier;
                        const cornerRadius = 8 * multiplier;

                        ctx.font = titleFont;
                        ctx.letterSpacing = `${letterSpacingSrc * multiplier}px`;
                        const titleWidth = ctx.measureText(titleValue).width;
                        ctx.font = subFont;
                        ctx.letterSpacing = `${2 * multiplier}px`;
                        const subtitleWidth = ctx.measureText(subtitleValue).width;
                        const contentWidth = Math.max(titleWidth, subtitleWidth);

                        let boxWidth, boxLeft, useRoundedCorners;
                        if (textLayoutMode === 'overlay-banner') {
                            boxWidth = exportCanvas.width;
                            boxLeft = 0;
                            useRoundedCorners = false;
                        } else {
                            // overlay-compact: fits the text, matches CSS max-width:85%
                            boxWidth = Math.min(contentWidth + paddingX * 2, exportCanvas.width * 0.85);
                            boxLeft = (exportCanvas.width - boxWidth) / 2;
                            useRoundedCorners = true;
                        }

                        ctx.fillStyle = textLayoutMode === 'overlay-banner' ? bgStyle : hexToRgba(bgStyle, 0.85);
                        ctx.beginPath();
                        if (useRoundedCorners && typeof ctx.roundRect === 'function') {
                            ctx.roundRect(boxLeft, boxTop, boxWidth, boxHeight, cornerRadius);
                        } else {
                            ctx.rect(boxLeft, boxTop, boxWidth, boxHeight);
                        }
                        ctx.fill();
                    }

                    ctx.fillStyle = mainTextClass;
                    ctx.font = titleFont;
                    ctx.letterSpacing = `${letterSpacingSrc * multiplier}px`;
                    ctx.fillText(titleValue, exportCanvas.width / 2, titleY);

                    ctx.fillStyle = subTextClass;
                    ctx.font = subFont;
                    ctx.letterSpacing = `${2 * multiplier}px`;
                    ctx.fillText(subtitleValue, exportCanvas.width / 2, subtitleY);
                }
            }

            // The live map can come back to its normal preview size right away - everything
            // we need is already safely copied into exportCanvas above.
            restoreLivePreview();

            // Real, one-click file download - no second "long-press to save" step, and no
            // intermediate modal. toBlob() also avoids inflating a multi-hundred-megapixel
            // 600 DPI image into a giant base64 string in memory the way toDataURL() would,
            // so this tier is noticeably faster/lighter too.
            exportCanvas.toBlob((blob) => {
                if (!blob) {
                    console.error("Canvas export produced an empty blob.");
                    exportBtn.innerText = "Failed - Try Again";
                    resetButton(originalBtnLabel, 2400);
                    return;
                }

                const citySlug = (document.getElementById('text-main-input').value || 'map-poster')
                    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'map-poster';
                const qualitySlug = exportResMode === 'print-ultra' ? 'ultra-600dpi'
                    : exportResMode === 'print-high' ? 'print-300dpi' : 'web';
                const filename = `${citySlug}-poster-${qualitySlug}.png`;

                const blobUrl = URL.createObjectURL(blob);
                const downloadLink = document.createElement('a');
                downloadLink.href = blobUrl;
                downloadLink.download = filename;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(blobUrl);

                exportBtn.innerText = "Downloaded ✓";
                resetButton(originalBtnLabel, 2000);
            }, 'image/png');

        } catch (innerError) {
            console.error("Canvas composite step failure: ", innerError);
            restoreLivePreview();
            exportBtn.innerText = "Failed - Try Again";
            resetButton(originalBtnLabel, 2400);
        }
    });
}
