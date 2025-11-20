// roadmap.js
// Digital Experience @ B – Blob + Logo Cluster Roadmap

(function () {
  // ------------------------------------------------------------
  // DOM references
  // ------------------------------------------------------------
  const vizEl = document.getElementById("viz");
  const quarterLabelEl = document.getElementById("quarterLabel");

  if (!vizEl) {
    console.error("No #viz element found in DOM.");
    return;
  }

  const svg = d3.select(vizEl).append("svg");
  const gRoot = svg.append("g").attr("class", "root");

  // IMPORTANT: background → foreground order
  const gScan      = gRoot.append("g").attr("class", "scanlines");   // Epoch 3 – behind all
  const gArcs      = gRoot.append("g").attr("class", "arcs");        // Epoch 2 – halo
  const gDomains   = gRoot.append("g").attr("class", "domains");     // Blobs + logos + milestones
  const gTheme     = gRoot.append("g").attr("class", "theme-badge"); // FY / theme badge
  const gTriangles = gRoot.append("g").attr("class", "triangles");   // Theme sails (background, mode 2)

  let revealMode = 0;   // 0 = blobs only, 1 = blobs+logos, 2 = milestones
  let arcsDrawn = false;
  let scanlinesDrawn = false;
  let width = 0;
  let height = 0;

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function getVar(name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }

  function quarterOrder(q) {
    const m = /FY(\d+)\s*Q(\d+)/i.exec(q || "");
    if (!m) return Number.MAX_SAFE_INTEGER;
    return parseInt(m[1]) * 10 + parseInt(m[2]);
  }

  function clean(s) {
    return (s || "").replace(/["'\u00A0]/g, "").trim();
  }

  // ------------------------------------------------------------
  // Domain configuration (relative geometry + logos)
  // ------------------------------------------------------------
  const domainConfig = [
    {
      key: "Your Digital Workplace",
      colorVar: "--purple",
      cx: 0.5,
      cy: 0.75,
      rx: 0.32,
      ry: 0.22,
      labelPlacement: "top-left",
      milestoneAnchor: { dx: -0.4, dy: 0.45 },
      logos: [
        {
          href: "assets/logos/workplace/m365.png",
          ox: 0.8,
          oy: 0.3,
          w: 200,
          h: 75,
        },
        {
          href: "assets/logos/workplace/lighthouse.png",
          ox: -0.8,
          oy: 0.3,
          w: 200,
          h: 75,
        },
        {
          href: "assets/logos/workplace/copilot.svg",
          ox: 0.7,
          oy: -0.2,
          w: 175,
          h: 60,
        }
      ]
    },
    {
      key: "BE Assists",
      colorVar: "--green",
      cx: 0.79,
      cy: 0.44,
      rx: 0.20,
      ry: 0.20,
      labelPlacement: "top-center",
      milestoneAnchor: { dx: -0.5, dy: 0.25 },
      logos: [
        {
          href: "assets/logos/enable/servicenow.png",
          ox: 0.1,
          oy: -1.0,
          w: 225,
          h: 100,
        },
        {
          href: "assets/logos/enable/enable.png",
          ox: 0.5,
          oy: -0.6,
          w: 175,
          h: 60,
        }
      ]
    },
    {
      key: "Our Data",
      colorVar: "--lightblue",
      cx: 0.5,
      cy: 0.42,
      rx: 0.33,
      ry: 0.16,
      labelPlacement: "top-center",
      milestoneAnchor: { dx: -0.2, dy: -1.6 },
      logos: [
        {
          href: "assets/logos/data/fabric.png",
          ox: -0.5,
          oy: -0.7,
          w: 250,
          h: 120,
        },
        {
          href: "assets/logos/data/opus.png",
          ox: -0.25,
          oy: 0.7,
          w: 175,
          h: 60,
        },
        {
          href: "assets/logos/data/powerbi.png",
          ox: -0.35,
          oy: -0.3,
          w: 175,
          h: 60,
        }
      ]
    },
    {
      key: "Firm Operations",
      colorVar: "--deepblue",
      cx: 0.25,
      cy: 0.45,
      rx: 0.15,
      ry: 0.30,
      labelPlacement: "top-center",
      milestoneAnchor: { dx: -1.4, dy: 0.25 },
      logos: [
        {
          href: "assets/logos/ops/workday.png",
          ox: -1,
          oy: -0.8,
          w: 175,
          h: 60,
        },
        {
          href: "assets/logos/ops/dynamics365.png",
          ox: -1.0,
          oy: -0.4,
          w: 175,
          h: 60,
        }
      ]
    }
  ];

  const themeConfig = {
    "Foundations": {
      colorVar: "--theme-foundations",
      short: "F",
      label: "Foundations",
    },
    "Integrations": {
      colorVar: "--theme-integrations",
      short: "I",
      label: "Integrations",
    },
    "Automations": {
      colorVar: "--theme-automations",
      short: "A",
      label: "Automations",
    },
  };

  function showBlobsOnly() {
    revealMode = 0;
    layoutDomains();
    renderQuarter(currentQuarterIndex, false);
  }

  function showBlobsAndLogos() {
    revealMode = 1;
    layoutDomains();
    renderQuarter(currentQuarterIndex, false);
  }

  function showMilestones() {
    revealMode = 2;
    layoutDomains();
    renderQuarter(currentQuarterIndex, false);
  }

  // ------------------------------------------------------------
  // State for quarters / data
  // ------------------------------------------------------------
  let quarters = [];
  let dataByQuarter = new Map();
  let currentQuarterIndex = -1;
  let domainSelection = null;
  let introAnimated = false; // ensure intro animation runs only once

  // --- Timeline Controls ---
  let playInterval = null;
  const PLAY_SPEED = 1500; // ms per quarter
  const playBtn = document.getElementById("playBtn");
  const scrub = document.getElementById("scrub");

  // ------------------------------------------------------------
  // Initialise domain groups (blobs + labels + milestones + logos)
  // ------------------------------------------------------------
  function initDomains() {
    domainSelection = gDomains
      .selectAll(".domain")
      .data(domainConfig, d => d.key)
      .enter()
      .append("g")
      .attr("class", "domain");

    // Blob wrapper group (so CSS transforms work on SVG)
    const blobWrapper = domainSelection
      .append("g")
      .attr("class", "blob-wrapper blob-intro");

    // Actual ellipse lives inside the wrapper, centered at (0,0)
    blobWrapper
      .append("ellipse")
      .attr("class", "blob");

    // Domain label
    domainSelection
      .append("text")
      .attr("class", "domain-label");

    // Milestones group (text lives here)
    domainSelection
      .append("g")
      .attr("class", "milestones");

    // Logo cluster
    domainSelection
      .append("g")
      .attr("class", "logo-cluster");
  }

  // ------------------------------------------------------------
  // Layout domains according to current width/height
  // ------------------------------------------------------------
  function layoutDomains() {
    domainSelection.each(function (d) {
      const g = d3.select(this);

      const cx = d.cx * width;
      const cy = d.cy * height;
      const rx = d.rx * width;
      const ry = d.ry * height;
      const fillColor = getVar(d.colorVar) || "#cccccc";

      // Blob wrapper stays at (0,0) but ellipse uses screen coords
      g.select("g.blob-wrapper")
        .attr("transform", `translate(0,0)`);

      g.select("g.blob-wrapper").select("ellipse.blob")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("rx", rx)
        .attr("ry", ry)
        .attr("fill", fillColor);

      // Domain label position
      const label = g.select("text.domain-label");
      let labelX = cx;
      let labelY = cy;

      let lx = 0, ly = 0;

      switch (d.key) {
        case "Your Digital Workplace":
          lx = 0;
          ly = 0.1;
          break;
        case "BE Assists":
          lx = 0.05;
          ly = -0.1;
          break;
        case "Our Data":
          lx = 0;
          ly = 0;
          break;
        case "Firm Operations":
          lx = 0;
          ly = 0;
          break;
      }

      labelX = cx + lx * rx;
      labelY = cy + ly * ry;

      label
        .attr("x", labelX)
        .attr("y", labelY)
        .style("text-anchor", "middle")
        .style("fill", getVar(d.colorVar + "-dark"))
        .text(d.key);

      // Milestones anchor transform
      const mAnchorX = cx + (d.milestoneAnchor?.dx || 0) * rx;
      const mAnchorY = cy + (d.milestoneAnchor?.dy || 0) * ry;

      g.select("g.milestones")
        .attr("transform", `translate(${mAnchorX}, ${mAnchorY})`);

      // Logo cluster positions
      const logoCluster = g.select("g.logo-cluster");

      if (revealMode >= 1) {
        const logos = d.logos || [];
        const logoSel = logoCluster
          .selectAll("image.logo")
          .data(logos, l => l.href);

        const logoEnter = logoSel
          .enter()
          .append("image")
          .attr("class", "logo")
          .attr("preserveAspectRatio", "xMidYMid meet")
          .style("pointer-events", "none");

        logoEnter.merge(logoSel)
          .attr("href", l => l.href)
          .attr("width", l => l.w || 120)
          .attr("height", l => l.h || (l.w || 120))
          .attr("x", l => cx + (l.ox || 0) * rx - (l.w || 120) / 2)
          .attr("y", l => cy + (l.oy || 0) * ry - (l.h || (l.w || 120)) / 2);

        logoSel.exit().remove();
      } else {
        logoCluster.selectAll("*").remove();
      }

    });
  }

  function themeNameFromCurrentQuarter() {
    if (currentQuarterIndex < 0) return null;

    const qKey = quarters[currentQuarterIndex];
    const qData = dataByQuarter.get(qKey);
    if (!qData) return null;

    const firstRow = qData.values().next().value;
    return firstRow ? firstRow.Theme : null;
  }

  // ------------------------------------------------------------
  // Resize handler – keeps everything responsive
  // ------------------------------------------------------------
  function resize() {
    const rect = vizEl.getBoundingClientRect();
    width = rect.width || 800;
    height = rect.height || 600;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // Layout domains
    layoutDomains();

    // Reposition the FY theme panel
    const themeX = width - 300;
    const themeY = 40;
    gTheme.attr("transform", `translate(${themeX}, ${themeY})`);

    // Redraw theme sails for current theme (milestone mode only)
    const activeTheme = themeNameFromCurrentQuarter();
    if (activeTheme) {
      renderThemeTriangles(activeTheme);
    }

    // Rerender milestones (no animation)
    if (currentQuarterIndex >= 0) {
      renderQuarter(currentQuarterIndex, false);
    }

    // One-time intro animation on blobs
    if (!introAnimated && domainSelection) {
      introAnimated = true;

      setTimeout(() => {
        domainSelection.each(function (d, i) {
          d3.select(this)
            .select("g.blob-wrapper")
            .style("transition-delay", `${i * 150}ms`)
            .classed("blob-intro-done", true);
        });
      }, 50);
    }
  }

  window.addEventListener("resize", debounce(resize, 150));

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // ------------------------------------------------------------
  // Load CSV and build quarter maps
  // ------------------------------------------------------------
  d3.csv("data/roadmap.csv").then(raw => {
    raw.forEach(r => {
      r.Quarter = clean(r.Quarter);
      r.Year = clean(r.Year);
      r.Theme = clean(r.Theme);
      r.Q = clean(r.Q);
      r.CompositeLabel = clean(r.CompositeLabel);
      r.Domain = clean(r.Domain);
      r.Headline = clean(r.Headline);
      r.Detail = clean(r.Detail);
      r.ConnectedDomains = clean(r.ConnectedDomains);
    });

    const uniqQuarters = Array.from(new Set(raw.map(r => r.Quarter)));
    quarters = uniqQuarters.sort((a, b) => quarterOrder(a) - quarterOrder(b));

    scrub.max = quarters.length - 1;
    scrub.value = 0;

    // group data by quarter, then by domain
    quarters.forEach(q => {
      const rows = raw.filter(r => r.Quarter === q);
      const byDomain = new Map();
      rows.forEach(r => {
        byDomain.set(r.Domain, r);
      });
      dataByQuarter.set(q, byDomain);
    });

    scrub.addEventListener("input", () => {
      currentQuarterIndex = parseInt(scrub.value, 10);
      renderQuarter(currentQuarterIndex, true);
      scrub.value = currentQuarterIndex;
    });

    // init rendering
    initDomains();
    resize();

    if (quarters.length > 0) {
      currentQuarterIndex = 0;
      renderQuarter(currentQuarterIndex, false);
    }

    // keyboard controls
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", (e) => {
      if (e.key === "b") showBlobsOnly();
      if (e.key === "l") showBlobsAndLogos();
      if (e.key === "m") showMilestones();
    });
  });

  // --- Play / Pause Controls ---------------------------------
  function startPlayback() {
    if (playInterval) return;

    revealMode = 2;
    layoutDomains();
    renderQuarter(currentQuarterIndex, false);

    playBtn.textContent = "⏸ Pause";

    playInterval = setInterval(() => {
      const next = currentQuarterIndex + 1;
      if (next >= quarters.length) {
        currentQuarterIndex = 0;
      } else {
        currentQuarterIndex = next;
      }

      scrub.value = currentQuarterIndex;
      renderQuarter(currentQuarterIndex, true);
    }, PLAY_SPEED);
  }

  function stopPlayback() {
    if (!playInterval) return;

    clearInterval(playInterval);
    playInterval = null;
    playBtn.textContent = "▶ Advance";
  }

  playBtn.addEventListener("click", () => {
    if (playInterval) {
      stopPlayback();
    } else {
      startPlayback();
    }
  });

  // ------------------------------------------------------------
  // Keyboard navigation
  // ------------------------------------------------------------
  function onKeyDown(e) {
    if (e.key === "ArrowRight" || e.key === " ") {
      stepQuarter(1);
    } else if (e.key === "ArrowLeft") {
      stepQuarter(-1);
    }
  }

  function stepQuarter(delta) {
    if (!quarters.length) return;
    const nextIndex = currentQuarterIndex + delta;
    if (nextIndex < 0 || nextIndex >= quarters.length) return;
    currentQuarterIndex = nextIndex;
    renderQuarter(currentQuarterIndex, true);
  }

  // ------------------------------------------------------------
  // Render the theme "sails" in the background (by theme)
  // ------------------------------------------------------------
  function renderThemeTriangles(themeName) {
    gTriangles.selectAll("*").remove();

    if (revealMode < 2) return;

    const subtleOpacity = 0.08;

    let fill;
    switch (themeName) {
      case "Foundations":
        fill = getVar("--theme-foundations");
        break;
      case "Integrations":
        fill = getVar("--theme-integrations");
        break;
      case "Automations":
        fill = getVar("--theme-automations");
        break;
      default:
        return;
    }

    const w = width;
    const h = height;

    const tris = [
      [
        [0.03 * w, 0.08 * h],
        [0.35 * w, 0.04 * h],
        [0.24 * w, 0.32 * h],
      ],
      [
        [0.68 * w, 0.88 * h],
        [0.98 * w, 0.94 * h],
        [0.78 * w, 0.62 * h],
      ],
    ];

    gTriangles
      .selectAll("polygon.sail")
      .data(tris)
      .enter()
      .append("polygon")
      .attr("class", "sail")
      .attr("points", pts => pts.map(p => p.join(",")).join(" "))
      .attr("fill", fill)
      .attr("opacity", subtleOpacity)
      .style("pointer-events", "none");
  }

  // Play / fast-forward / mega-fast-forward motif
  function motifForTheme(themeName, size, color) {
    const s = size;
    const gap = s * 0.4;

    switch (themeName) {
      case "Foundations":
        return [
          { x: 0, y: 0, points: `0,0  ${s},${s/2}  0,${s}` }
        ];
      case "Integrations":
        return [
          { x: 0,      y: 0, points: `0,0  ${s},${s/2}  0,${s}` },
          { x: s+gap,  y: 0, points: `0,0  ${s},${s/2}  0,${s}` },
        ];
      case "Automations":
        return [
          { x: 0,          y: 0, points: `0,0  ${s},${s/2}  0,${s}` },
          { x: s+gap,      y: 0, points: `0,0  ${s},${s/2}  0,${s}` },
          { x: 2*(s+gap),  y: 0, points: `0,0  ${s},${s/2}  0,${s}` },
        ];
      default:
        return [];
    }
  }

  // ------------------------------------------------------------
  // Epoch 3 scanlines (Automations)
  // ------------------------------------------------------------
  function drawEpoch3Scanlines() {
    gScan.selectAll("*").remove();

    const w = width;
    const h = height;

    const strokeColor = getVar("--theme-integrations") || "#3fae4a";
    
    const lines = [
      { x1: -w * 0.3, y1: h * 0.05, x2: w * 1.3, y2: h * 0.55 },
      { x1: -w * 0.25, y1: h * 0.45, x2: w * 1.4, y2: h * 0.95 }
    ];

    const scan = gScan
        .selectAll("line.scan")
        .data(lines)
        .enter()
        .append("line")
        .attr("class", "scan")
        .attr("x1", d => d.x1)
        .attr("y1", d => d.y1)
        .attr("x2", d => d.x2)
        .attr("y2", d => d.y2)
        .attr("stroke", strokeColor)
        .attr("stroke-width", 1.2)
        .style("stroke-opacity", 0.33)
        .style("pointer-events", "none")
        .style("opacity", 0);

    scan.transition()
      .duration(1200)
      .ease(d3.easeCubicOut)
      .style("opacity", 1);
  }

  // ------------------------------------------------------------
  // Epoch 2 arcs (Integrations)
  // ------------------------------------------------------------
  function drawArcs1980s() {
    const arcData = [
      {
        path: "M 1083,129 A 500 500 0 0 0 379,67",
        color: getVar("--green")
      },
      {
        path: "M 230,279 A 500 500 0 0 0 529,920",
        color: getVar("--deepblue")
      },
      {
        path: "M 787,943 A 500 500 0 0 0 1192,363",
        color: getVar("--purple")
      },
    ];

    const arcs = gArcs
      .selectAll("path.arc")
      .data(arcData)
      .enter()
      .append("path")
      .attr("class", "arc")
      .attr("d", d => d.path)
      .attr("stroke", d => d.color)
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.20)
      .attr("fill", "none")
      .style("opacity", 0)
      .style("filter", d => `drop-shadow(0 0 3px ${d.color}33)`)
      .style("pointer-events", "none");

    arcs.transition()
      .duration(1200)
      .ease(d3.easeCubicOut)
      .style("opacity", 1);
  }

  // ------------------------------------------------------------
  // Render a quarter: update label, theme panel, milestones, active styling
  // ------------------------------------------------------------
  function renderQuarter(index, animate = true) {
    if (index < 0 || index >= quarters.length) return;
    const qKey = quarters[index];
    const qData = dataByQuarter.get(qKey) || new Map();

    const firstRow = qData.values().next().value;
    const composite = (firstRow && firstRow.CompositeLabel) || qKey;

    // Epoch visuals based on Theme column
    if (firstRow) {
      const epoch = firstRow.Theme;

      if (epoch === "Integrations" && !arcsDrawn) {
        arcsDrawn = true;
        drawArcs1980s();
      }

      if (epoch === "Automations" && !scanlinesDrawn) {
        scanlinesDrawn = true;
        drawEpoch3Scanlines();
      }
    }

    // Quarter label
    if (quarterLabelEl) {
      if (animate) {
        quarterLabelEl.classList.add("fading");
        setTimeout(() => {
          quarterLabelEl.textContent = composite;
          quarterLabelEl.classList.remove("fading");
        }, 150);
      } else {
        quarterLabelEl.textContent = composite;
      }

      // THEME GEOMETRY (FY + Theme)
      gTheme.selectAll("*").remove();

      const firstRowTheme = qData.values().next().value;
      if (firstRowTheme && revealMode === 2) {
        const themeName = firstRowTheme.Theme;
        const year = firstRowTheme.Year;
        const tCfg = themeConfig[themeName];

        renderThemeTriangles(themeName);

        if (tCfg) {
          const panelWidth = 260;
          const panelHeight = 140;

          const color = getVar(tCfg.colorVar) || "#333";
          const darkColor = getVar(tCfg.colorVar + "-dark") || "#000";

          const triPoints = [
            [panelWidth * 0.10, panelHeight * -0.30],
            [panelWidth * 0.95, panelHeight * 0.10],
            [panelWidth * 0.25, panelHeight * 0.80],
          ];

          gTheme
            .append("polygon")
            .attr("class", "theme-big-triangle")
            .attr("points", triPoints.map(p => p.join(",")).join(" "))
            .attr("fill", color)
            .attr("opacity", 0.10)
            .style("pointer-events", "none");

          gTheme.append("text")
            .attr("class", "theme-fy")
            .attr("x", panelWidth * 0.45)
            .attr("y", panelHeight * 0.13)
            .attr("text-anchor", "middle")
            .style("font-size", "48px")
            .style("font-weight", "700")
            .text(year);
         
          gTheme.append("text")
            .attr("class", "theme-name")
            .attr("x", panelWidth * 0.55)
            .attr("y", panelHeight * 0.45)
            .attr("text-anchor", "middle")
            .style("font-size", "36px")
            .style("font-weight", "400")
            .text(tCfg.label);

          gTheme.append("text")
            .attr("class", "theme-quarter")
            .attr("x", panelWidth * 0.50 + 55)
            .attr("y", panelHeight * 0.23 - 2)
            .style("font-size", "16px")
            .style("font-weight", "900")
            .attr("text-anchor", "start")
            .text(`[Q${firstRow.Q}]`);

          const glyphSize = 32;
          const glyphColor = darkColor;
          const motif = motifForTheme(themeName, glyphSize, glyphColor);

          const gMotif = gTheme
            .append("g")
            .attr("class", "theme-motif")
            .attr(
              "transform",
              `translate(${panelWidth * 0.22}, ${panelHeight * 0.55})`
            );

          motif.forEach(t => {
            gMotif
              .append("polygon")
              .attr("points", t.points)
              .attr("fill", glyphColor)
              .attr("opacity", 0.9)
              .attr("transform", `translate(${t.x}, ${t.y})`);
          });
        }
      }
    }

    // For each domain, update milestones + active state
    domainSelection.each(function (d) {
      const g = d3.select(this);
      const row = qData.get(d.key);

      const hasMilestone = row && (row.Headline || row.Detail);

      if (revealMode < 2) {
        const mGroup = g.select("g.milestones");
        mGroup.selectAll("*").remove();
        mGroup.style("opacity", 0);

        g.select(".blob").style("fill-opacity", 0.30);
        g.selectAll(".logo").style("opacity", 1);
        g.select(".domain-label").style("opacity", 1);

        return;
      }

      g.classed("active", !!hasMilestone);
      g.select(".blob").style("fill-opacity", 0.18);
      g.selectAll(".logo").style("opacity", 0.6);
      g.select(".domain-label").style("opacity", 0.8);

      const mGroup = g.select("g.milestones");

      if (!hasMilestone) {
        if (animate) {
          mGroup
            .transition()
            .duration(200)
            .style("opacity", 0)
            .on("end", function () {
              d3.select(this).selectAll("*").remove();
            });
        } else {
          mGroup.selectAll("*").remove();
          mGroup.style("opacity", 0);
        }
        return;
      }

      const text = row.Detail || row.Headline || "";
      const bullets = text
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

      if (animate) {
        mGroup
          .transition()
          .duration(200)
          .style("opacity", 0)
          .on("end", function () {
            const mg = d3.select(this);
            mg.selectAll("*").remove();

            const lineHeight = 30;
            bullets.forEach((b, i) => {
              mg
                .append("text")
                .attr("class", "milestone-line")
                .attr("x", 0)
                .attr("y", i * lineHeight)
                .style("fill", getVar(d.colorVar))
                .text(`· ${b}`);
            });

            mg
              .transition()
              .duration(250)
              .style("opacity", 1);
          });
      } else {
        mGroup.selectAll("*").remove();
        const lineHeight = 30;
        bullets.forEach((b, i) => {
          mGroup
            .append("text")
            .attr("class", "milestone-line")
            .attr("x", 0)
            .attr("y", i * lineHeight)
            .style("fill", getVar(d.colorVar))
            .text(`· ${b}`);
        });
        mGroup.style("opacity", 1);
      }
    });
  }
})();
