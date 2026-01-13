const width = 900
const height = 420
const boxplotHeight = 700

const svg = d3.select("#map-svg")
  .attr("viewBox", `0 0 ${width} ${height}`)

const tooltip = d3.select("#tooltip")

const boxplotSvg = d3.select("#boxplot-svg")
  .attr("viewBox", `0 0 ${width} ${boxplotHeight}`)

const boxplotTooltip = d3.select("#boxplot-tooltip")
const boxplotSubtitle = d3.select("#boxplot-subtitle")

// detail panel elements
const detailCountry = d3.select("#detail-country")
const detailMedianDots = d3.select("#detail-median-dots")
const detailMedianTotal = d3.select("#detail-median-total")
const detailCount = d3.select("#detail-count")
const detailMale = d3.select("#detail-male")
const detailFemale = d3.select("#detail-female")
const detailTested = d3.select("#detail-tested")
const detailUntested = d3.select("#detail-untested")

// legend elements
const legendContainer = d3.select("#legend")
const legendLow = d3.select("#legend-low")
const legendMid = d3.select("#legend-mid")
const legendHigh = d3.select("#legend-high")
const legendTitle = d3.select("#legend-title")

// filters
const sexSelect = d3.select("#sex-filter")
const testedSelect = d3.select("#tested-filter")
const metricSelect = d3.select("#metric-filter")

let worldData
let rawRows

let currentMetric = "median_dots"
let selectedCountryName = null
let aggMap = new Map()

const countryAlias = {
  "Bahamas": "The Bahamas",
  "Czechia": "Czech Republic",
  "Czechoslovakia": "Czech Republic",
  "Eswatini": "Swaziland",
  "Serbia and Montenegro": "Republic of Serbia",
  "Tanzania": "United Republic of Tanzania",
  "The Gambia": "Gambia",
  "UAE": "United Arab Emirates",
  "USSR": "Russia",
  "West Germany": "Germany",
  "North Macedonia": "Macedonia",
  "Guinea-Bissau": "Guinea Bissau",
  "Congo": "Republic of the Congo"
}

function normalizeCountryName(name) {
  if (!name) return null
  const trimmed = name.trim()
  return countryAlias[trimmed] || trimmed
}

const projection = d3.geoMercator()
const path = d3.geoPath().projection(projection)

function loadCsvGz(url, rowAccessor) {
  return fetch(url)
    .then(res => res.arrayBuffer())
    .then(buffer => {
      const uint8 = new Uint8Array(buffer)
      const decompressedText = pako.ungzip(uint8, { to: "string" })
      return d3.csvParse(decompressedText, rowAccessor)
    })
}

Promise.all([
  d3.json("data/world.geojson"),
  loadCsvGz("data/openpowerlifting_subset.csv.gz", d => {
    const sex = d.Sex || "Unknown"

    let tested
    if (d.Tested === "Yes") tested = "Yes"
    else tested = "Unknown"

    const countryRaw = d.Country || null
    const countryName = countryRaw ? normalizeCountryName(countryRaw) : null

    const dots = d.Dots === "" ? NaN : +d.Dots
    const total = d.TotalKg === "" ? NaN : +d.TotalKg

    const equipment = d.Equipment || "Unknown"
    const event = d.Event || "Unknown"

    const dotsKey = Number.isFinite(dots) ? dots.toFixed(1) : "na"
    const totalKey = Number.isFinite(total) ? total.toFixed(1) : "na"
    const athleteKey = `${countryName || "na"}|${sex || "na"}|${tested || "na"}|${dotsKey}|${totalKey}|${equipment}|${event}`

    return {
      sex,
      tested,
      countryName,
      dots,
      total,
      equipment,
      event,
      athleteKey
    }
  })
]).then(([world, rows]) => {
  worldData = world

  worldData.features = worldData.features.filter(
    f => (f.properties && f.properties.name) !== "Antarctica"
  )

  rawRows = rows.filter(r => r.countryName)

  projection.fitExtent(
    [[0, 10], [width, height - 10]],
    worldData
  )

  drawMap()
  updateMapColors()
  updateLegend()

  updateBoxplots(null)

  sexSelect.on("change", handleFilterChange)
  testedSelect.on("change", handleFilterChange)
  metricSelect.on("change", handleMetricChange)
}).catch(err => {
  console.error("Error loading data:", err)
})

function handleFilterChange() {
  updateMapColors()
  updateLegend()
  updateDetailPanel(selectedCountryName)

  updateBoxplots(selectedCountryName)
}

function handleMetricChange() {
  currentMetric = metricSelect.node().value
  updateMapColors()
  updateLegend()
  updateDetailPanel(selectedCountryName)
}

function filteredRows() {
  const sexFilter = sexSelect.node().value
  const testedFilter = testedSelect.node().value

  return rawRows.filter(d => {
    const sexOk = sexFilter === "all" || d.sex === sexFilter
    const testedOk = testedFilter === "all" || d.tested === testedFilter
    return sexOk && testedOk
  })
}

function drawMap() {
  svg.append("g")
    .attr("class", "countries")
    .selectAll("path")
    .data(worldData.features)
    .join("path")
    .attr("class", "country")
    .attr("d", path)
    .on("mouseover", handleMouseOver)
    .on("mousemove", handleMouseMove)
    .on("mouseout", handleMouseOut)
    .on("click", handleCountryClick)
}

function featureCountryName(feature) {
  const props = feature.properties || {}
  const name = props.name
  return normalizeCountryName(name)
}

function handleMouseOver(event, feature) {
  const aggregate = getCountryAggregate(feature)
  if (!aggregate) return

  tooltip
    .classed("visible", true)
    .html(`
      <strong>${aggregate.countryName}</strong><br>
      ${labelForMetric(currentMetric)}: ${formatMetric(aggregate[currentMetric])}<br>
      Athletes: ${d3.format(",")(aggregate.lift_count)}
    `)

  const [x, y] = d3.pointer(event)
  tooltip.style("left", `${x + 20}px`).style("top", `${y + 20}px`)
}

function handleMouseMove(event) {
  const [x, y] = d3.pointer(event)
  tooltip.style("left", `${x + 20}px`).style("top", `${y + 20}px`)
}

function handleMouseOut() {
  tooltip.classed("visible", false)
}

function handleCountryClick(event, feature) {
  const aggregate = getCountryAggregate(feature)
  if (!aggregate) return

  selectedCountryName = aggregate.countryName

  svg.selectAll(".selection-outline").remove()
  svg.append("path")
    .datum(feature)
    .attr("class", "selection-outline")
    .attr("d", path)
    .attr("fill", "none")
    .attr("stroke", "#000")
    .attr("stroke-width", 2)
    .attr("pointer-events", "none")

  updateDetailPanel(selectedCountryName)
  updateBoxplots(selectedCountryName)
}

function getCountryAggregatesMap() {
  const rows = filteredRows()
  const grouped = d3.group(rows, d => d.countryName)
  const map = new Map()

  for (const [name, values] of grouped.entries()) {
    const dotsValues = values.map(v => v.dots).filter(Number.isFinite)
    const totalValues = values.map(v => v.total).filter(Number.isFinite)

    const medianDots = dotsValues.length ? d3.median(dotsValues) : NaN
    const medianTotal = totalValues.length ? d3.median(totalValues) : NaN

    const count = new Set(values.map(v => v.athleteKey)).size

    map.set(name, {
      countryName: name,
      median_dots: medianDots,
      median_total: medianTotal,
      lift_count: count
    })
  }

  return map
}

function getCountryAggregate(feature) {
  const name = featureCountryName(feature)
  return aggMap.get(name) || null
}

function updateMapColors() {
  aggMap = getCountryAggregatesMap()

  const values = Array.from(aggMap.values())
    .map(d => d[currentMetric])
    .filter(Number.isFinite)

  const min = d3.min(values)
  const max = d3.max(values)

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    console.warn("No valid values for color scaling")
    return
  }

  let colorScale

  if (currentMetric === "lift_count") {
    const safeMin = Math.max(min, 1)
    colorScale = d3.scaleSequentialLog()
      .domain([safeMin, max])
      .interpolator(d3.interpolateBlues)
  } else {
    colorScale = d3.scaleSequential()
      .domain([min, max])
      .interpolator(d3.interpolateBlues)
  }

  svg.selectAll(".country")
    .transition()
    .duration(500)
    .attr("fill", feature => {
      const name = featureCountryName(feature)
      const data = aggMap.get(name)
      return (!data || !Number.isFinite(data[currentMetric]))
        ? "#e0e0e0"
        : colorScale(data[currentMetric])
    })

  svg.node().__colorScale = colorScale
  svg.node().__scaleDomain = [min, max]
}

function updateLegend() {
  const colorScale = svg.node().__colorScale
  const domain = svg.node().__scaleDomain
  if (!colorScale || !domain) return

  legendTitle.text(labelForMetric(currentMetric))

  const [min, max] = domain

  const values = Array.from(aggMap.values())
    .map(d => d[currentMetric])
    .filter(Number.isFinite)

  const medianValue = d3.median(values)

  legendLow.text(`Min (${formatMetric(min)})`)
  legendMid.text(`Median (${formatMetric(medianValue)})`)
  legendHigh.text(`Max (${formatMetric(max)})`)

  legendContainer.selectAll("*").remove()

  const legendWidth = legendContainer.node().clientWidth || 400
  const legendHeight = legendContainer.node().clientHeight || 18

  const legendSvg = legendContainer.append("svg")
    .attr("width", legendWidth)
    .attr("height", legendHeight)

  const defs = legendSvg.append("defs")
  const gradientId = "legend-gradient"

  const gradient = defs.append("linearGradient")
    .attr("id", gradientId)
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%")

  const stops = d3.range(0, 1.01, 0.1)

  gradient.selectAll("stop")
    .data(stops)
    .join("stop")
    .attr("offset", d => `${d * 100}%`)
    .attr("stop-color", d => {
      const value = min * Math.pow(max / min, d)
      return colorScale(value)
    })

  legendSvg.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", `url(#${gradientId})`)
    .attr("stroke", "#444")
    .attr("stroke-width", 0.7)
}

function updateDetailPanel(countryName) {
  if (!countryName) {
    detailCountry.text("Country: –")
    detailMedianDots.text("Median Dots: –")
    detailMedianTotal.text("Median Total Kg: –")
    detailCount.text("Athlete Count: –")
    detailMale.text("Male Athletes: –")
    detailFemale.text("Female Athletes: –")
    detailTested.text("Tested Athletes: –")
    detailUntested.text("Tested Unknown Athletes: –")
    return
  }

  const rows = filteredRows().filter(d => d.countryName === countryName)

  if (!rows.length) {
    detailCountry.text("Country: –")
    detailMedianDots.text("Median Dots: –")
    detailMedianTotal.text("Median Total Kg: –")
    detailCount.text("Athlete Count: –")
    detailMale.text("Male Athletes: –")
    detailFemale.text("Female Athletes: –")
    detailTested.text("Tested Athletes: –")
    detailUntested.text("Tested Unknown Athletes: –")
    return
  }

  const dotsValues = rows.map(r => r.dots).filter(Number.isFinite)
  const totalValues = rows.map(r => r.total).filter(Number.isFinite)

  const medianDots = dotsValues.length ? d3.median(dotsValues) : NaN
  const medianTotal = totalValues.length ? d3.median(totalValues) : NaN

  const count = new Set(rows.map(r => r.athleteKey)).size
  const maleCount = new Set(rows.filter(r => r.sex === "M").map(r => r.athleteKey)).size
  const femaleCount = new Set(rows.filter(r => r.sex === "F").map(r => r.athleteKey)).size
  const testedCount = new Set(rows.filter(r => r.tested === "Yes").map(r => r.athleteKey)).size
  const unknownTestedCount = new Set(rows.filter(r => r.tested === "Unknown").map(r => r.athleteKey)).size

  detailCountry.text(`Country: ${countryName}`)
  detailMedianDots.text(`Median Dots: ${formatMetric(medianDots)}`)
  detailMedianTotal.text(`Median Total Kg: ${formatMetric(medianTotal)}`)
  detailCount.text(`Athlete Count: ${d3.format(",")(count)}`)

  detailMale.text(`Male Athletes: ${maleCount} (${formatPercentage(maleCount, count)})`)
  detailFemale.text(`Female Athletes: ${femaleCount} (${formatPercentage(femaleCount, count)})`)
  detailTested.text(`Tested Athletes: ${testedCount} (${formatPercentage(testedCount, count)})`)
  detailUntested.text(`Tested Unknown Athletes: ${unknownTestedCount} (${formatPercentage(unknownTestedCount, count)})`)
}

function updateBoxplots(countryName) {
  const isGlobal = !countryName

  const rowsBase = isGlobal
    ? rawRows
    : rawRows.filter(d => d.countryName === countryName)

  const rowsWithDots = rowsBase.filter(d => Number.isFinite(d.dots))

  if (!rowsWithDots.length) {
    boxplotSvg.selectAll("*").remove()
    boxplotSubtitle.text(isGlobal ? "No Dots data." : `No Dots data for ${countryName}.`)
    return
  }

  boxplotSubtitle.text(isGlobal
    ? "All countries (Dots distributions)"
    : `Country: ${countryName} (Dots distributions)`
  )

  const domain = d3.extent(rowsWithDots.map(d => d.dots))

  const margin = { top: 34, right: 24, bottom: 44, left: 55 }
  const cols = 2
  const rowsCount = 2

  // spacing between boxplot cells
  const cellPadX = 70
  const cellPadY = 10

  const innerW = width - margin.left - margin.right
  const innerH = boxplotHeight - margin.top - margin.bottom

  const cellW = (innerW - cellPadX) / cols
  const cellH = (innerH - cellPadY) / rowsCount

  const cellInner = { top: 10, right: 10, bottom: 60, left: 0 }
  const plotW = cellW - cellInner.left - cellInner.right
  const plotH = cellH - cellInner.top - cellInner.bottom

  const yScale = d3.scaleLinear()
    .domain(domain)
    .nice()
    .range([plotH, 0])

  boxplotSvg.selectAll("*").remove()

  const gRoot = boxplotSvg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)

  const plots = [
    { title: "Dots by Sex", key: "sex", excludeFilterKey: "sex" },
    { title: "Dots by Tested", key: "tested", excludeFilterKey: "tested" },
    { title: "Dots by Equipment", key: "equipment", excludeFilterKey: "equipment" },
    { title: "Dots by Event", key: "event", excludeFilterKey: "event" }
  ]

  plots.forEach((p, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)

    const x0 = col * (cellW + cellPadX)
    const y0 = row * (cellH + cellPadY)

    const cell = gRoot.append("g")
      .attr("transform", `translate(${x0},${y0})`)

    cell.append("text")
      .attr("class", "boxplot-title")
      .attr("x", 0)
      .attr("y", -10)
      .text(p.title)

    const plotG = cell.append("g")
      .attr("transform", `translate(${cellInner.left},${cellInner.top})`)

    const rowsForPlot = getRowsForPlot(countryName, p.excludeFilterKey)
      .filter(d => Number.isFinite(d.dots))

    const grouped = d3.group(rowsForPlot, d => (d[p.key] || "Unknown"))

    const groupNames = Array.from(grouped.keys())
      .filter(k => k !== "Unknown" || grouped.get(k).length > 0)

    if (!groupNames.length) {
      plotG.append("text")
        .attr("x", 0)
        .attr("y", 18)
        .style("font-size", "0.85rem")
        .text("No data")
      return
    }

    const xScale = d3.scaleBand()
      .domain(groupNames)
      .range([0, plotW])
      .paddingInner(0.25)
      .paddingOuter(0.15)

    const yAxis = d3.axisLeft(yScale).ticks(4)
    plotG.append("g")
      .attr("class", "axis")
      .call(yAxis)

    const xAxis = d3.axisBottom(xScale)
    plotG.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${plotH})`)
      .call(xAxis)
      .selectAll("text")
      .attr("transform", "rotate(-15)")
      .style("text-anchor", "end")

    groupNames.forEach(groupName => {
      const vals = grouped.get(groupName)
        .map(d => d.dots)
        .filter(Number.isFinite)
        .sort(d3.ascending)

      if (!vals.length) return

      const stats = boxStats(vals)

      const cx = xScale(groupName)
      const bw = xScale.bandwidth()
      const midX = cx + bw / 2

      plotG.append("line")
        .attr("class", "whisker")
        .attr("x1", midX)
        .attr("x2", midX)
        .attr("y1", yScale(stats.whiskerMin))
        .attr("y2", yScale(stats.whiskerMax))

      plotG.append("line")
        .attr("class", "whisker")
        .attr("x1", midX - bw * 0.25)
        .attr("x2", midX + bw * 0.25)
        .attr("y1", yScale(stats.whiskerMin))
        .attr("y2", yScale(stats.whiskerMin))

      plotG.append("line")
        .attr("class", "whisker")
        .attr("x1", midX - bw * 0.25)
        .attr("x2", midX + bw * 0.25)
        .attr("y1", yScale(stats.whiskerMax))
        .attr("y2", yScale(stats.whiskerMax))

      const box = plotG.append("rect")
        .attr("class", "box")
        .attr("x", cx)
        .attr("y", yScale(stats.q3))
        .attr("width", bw)
        .attr("height", Math.max(0, yScale(stats.q1) - yScale(stats.q3)))

      plotG.append("line")
        .attr("class", "median-line")
        .attr("x1", cx)
        .attr("x2", cx + bw)
        .attr("y1", yScale(stats.median))
        .attr("y2", yScale(stats.median))

      box.on("mousemove", (event) => {
        const wrapper = d3.select("#boxplot-wrapper").node()
        const [mx, my] = d3.pointer(event, wrapper)
        boxplotTooltip
          .classed("visible", true)
          .style("left", `${mx + 16}px`)
          .style("top", `${my + 16}px`)
          .html(`
            <strong>${groupName}</strong><br>
            n: ${vals.length}<br>
            Q1: ${d3.format(".1f")(stats.q1)}<br>
            Median: ${d3.format(".1f")(stats.median)}<br>
            Q3: ${d3.format(".1f")(stats.q3)}
          `)
      })

      box.on("mouseout", () => {
        boxplotTooltip.classed("visible", false)
      })
    })
  })
}

function getRowsForPlot(countryName, excludeFilterKey) {
  const sexFilter = sexSelect.node().value
  const testedFilter = testedSelect.node().value

  return rawRows.filter(d => {
    if (countryName && d.countryName !== countryName) return false

    if (excludeFilterKey !== "sex") {
      if (!(sexFilter === "all" || d.sex === sexFilter)) return false
    }

    if (excludeFilterKey !== "tested") {
      if (!(testedFilter === "all" || d.tested === testedFilter)) return false
    }

    return true
  })
}

function boxStats(sortedVals) {
  const n = sortedVals.length
  const q1 = d3.quantileSorted(sortedVals, 0.25)
  const median = d3.quantileSorted(sortedVals, 0.5)
  const q3 = d3.quantileSorted(sortedVals, 0.75)
  const iqr = q3 - q1

  const lowFence = q1 - 1.5 * iqr
  const highFence = q3 + 1.5 * iqr

  let whiskerMin = sortedVals[0]
  for (let i = 0; i < n; i += 1) {
    if (sortedVals[i] >= lowFence) {
      whiskerMin = sortedVals[i]
      break
    }
  }

  let whiskerMax = sortedVals[n - 1]
  for (let i = n - 1; i >= 0; i -= 1) {
    if (sortedVals[i] <= highFence) {
      whiskerMax = sortedVals[i]
      break
    }
  }

  return { q1, median, q3, whiskerMin, whiskerMax }
}

function labelForMetric(metric) {
  if (metric === "median_dots") return "Median Dots"
  if (metric === "median_total") return "Median Total (kg)"
  if (metric === "lift_count") return "Number of Athletes"
  return metric
}

function formatMetric(value) {
  if (!Number.isFinite(value)) return "n/a"
  if (currentMetric === "lift_count") return d3.format(",")(value)
  return d3.format(".1f")(value)
}

function formatPercentage(part, total) {
  if (!total) return "0%"
  return d3.format(".1%")(part / total)
}

// ... (all your existing GROUP PROJECT code remains here) ...

// ========================================
// INDIVIDUAL ASSIGNMENT: TIME SERIES
// ========================================

const IND_DATA_JSON_PATH = "data/openpowerlifting.json";
const IND_YEARS = { min: 1971, max: 2024 };

const indCategories = {
  totals_all:   { label: "Totals (All)" },
  totals_open:  { label: "Totals (Open)" },
  totals_tested:{ label: "Totals (Tested)" },
  dots:         { label: "Dots" },
  squat:        { label: "Squat" },
  bench:        { label: "Bench" },
  deadlift:     { label: "Deadlift" }
};

const indMargin = { top: 20, right: 40, bottom: 110, left: 70 };
const indWidth = 1000;
const indHeight = 420;
const indInnerWidth = indWidth - indMargin.left - indMargin.right;
const indInnerHeight = indHeight - indMargin.top - indMargin.bottom;

const indBrushMargin = { top: 10, right: 40, bottom: 30, left: 70 };
const indBrushHeight = 100;
const indBrushInnerHeight = indBrushHeight - indBrushMargin.top - indBrushMargin.bottom;

// Main SVG
const indSvg = d3.select("#ind-chart")
  .attr("viewBox", `0 0 ${indWidth} ${indHeight}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

const indG = indSvg.append("g")
  .attr("transform", `translate(${indMargin.left},${indMargin.top})`);

// Clipping
indG.append("clipPath").attr("id", "ind-clip")
  .append("rect")
  .attr("width", indInnerWidth)
  .attr("height", indInnerHeight);

// Scales
const indX = d3.scaleTime().range([0, indInnerWidth]);
const indY = d3.scaleLinear().range([indInnerHeight, 0]);

// Axes groups
const indXAxisG = indG.append("g")
  .attr("transform", `translate(0,${indInnerHeight})`)
  .attr("class", "x axis");

const indYAxisG = indG.append("g")
  .attr("class", "y axis");

// Axis labels
indG.append("text")
  .attr("class", "axis-label")
  .attr("x", indInnerWidth / 2)
  .attr("y", indInnerHeight + 40)
  .attr("text-anchor", "middle")
  .text("Year");

const indYLabel = indG.append("text")
  .attr("class", "axis-label")
  .attr("transform", "rotate(-90)")
  .attr("x", -indInnerHeight / 2)
  .attr("y", -50)
  .attr("text-anchor", "middle")
  .text("Best result [kg]");

// Line generator
const indLineGen = d3.line()
  .x(d => indX(d.yearDate))
  .y(d => indY(d.best))
  .curve(d3.curveMonotoneX);

// Colors
const indColor = { M: "#1f77b4", F: "#ff6fb3" };

// Groups
const indLinesG = indG.append("g").attr("clip-path", "url(#ind-clip)");
const indDotsG = indG.append("g").attr("clip-path", "url(#ind-clip)");

// Tooltip
const indTooltip = d3.select("body")
  .append("div")
  .attr("class", "ind-tooltip");

// Brush SVG
const indBrushSvg = d3.select("#ind-brush")
  .attr("viewBox", `0 0 ${indWidth} ${indBrushHeight}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

const indBrushG = indBrushSvg.append("g")
  .attr("transform", `translate(${indBrushMargin.left},${indBrushMargin.top})`);

const indBrushX = d3.scaleTime().range([0, indInnerWidth]);
const indBrushXAxisG = indBrushG.append("g")
  .attr("transform", `translate(0,${indBrushInnerHeight})`);

let indBrush;

// UI
const indCategorySelect = document.getElementById("ind-categorySelect");
const indFederationSelect = document.getElementById("ind-federationSelect");
const indTestedSelect = document.getElementById("ind-testedSelect");
const indEquipmentSelect = document.getElementById("ind-equipmentSelect");

// State
let indFullData = null;
let indYearsExtent = [new Date(IND_YEARS.min, 0, 1), new Date(IND_YEARS.max, 11, 31)];
let indCurrentCategory = indCategorySelect.value;

// Load preprocessed JSON
d3.json(IND_DATA_JSON_PATH).then(json => {
  indFullData = json;
  
  console.log("Individual data loaded successfully");
  
  // Populate federation dropdown with top federations
  if (json.federations && json.federations.length > 0) {
    const fedCounts = {};
    Object.keys(json.data).forEach(cat => {
      Object.keys(json.data[cat]).forEach(filterKey => {
        ["M", "F"].forEach(sex => {
          json.data[cat][filterKey][sex].forEach(d => {
            if (d.federation) {
              fedCounts[d.federation] = (fedCounts[d.federation] || 0) + 1;
            }
          });
        });
      });
    });
    
    const topFeds = Object.entries(fedCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([fed, count]) => fed);
    
    console.log("Top federations:", topFeds);
    
    topFeds.forEach(fed => {
      const option = document.createElement('option');
      option.value = fed;
      option.textContent = fed;
      indFederationSelect.appendChild(option);
    });
  }
  
  // Convert yearDate strings to Date objects
  Object.keys(json.data).forEach(cat => {
    Object.keys(json.data[cat]).forEach(filterKey => {
      ["M", "F"].forEach(sex => {
        json.data[cat][filterKey][sex].forEach(d => {
          d.yearDate = new Date(d.yearDate);
        });
      });
    });
  });
  
  indYearsExtent = [new Date(IND_YEARS.min, 0, 1), new Date(IND_YEARS.max, 11, 31)];
  indX.domain(indYearsExtent);
  indBrushX.domain(indYearsExtent);
  
  updateIndChart();
}).catch(err => {
  console.error("Failed to load individual JSON:", err);
  alert("Failed to load preprocessed data JSON. Check console for details.");
});

// Helper function to get current filter key
function getIndCurrentFilterKey() {
  const equipment = indEquipmentSelect.value;
  const tested = indTestedSelect.value;
  return `equipment_${equipment}_tested_${tested}`;
}

// Helper function to get best per year from records list
function getIndBestPerYear(records) {
  if (!records || records.length === 0) return [];
  
  const yearMap = new Map();
  
  records.forEach(r => {
    if (!yearMap.has(r.year) || r.best > yearMap.get(r.year).best) {
      yearMap.set(r.year, r);
    }
  });
  
  return Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
}

// Helper function to get current data
function getIndCurrentData() {
  if (!indFullData || !indFullData.data) return null;
  
  const cat = indCurrentCategory;
  const filterKey = getIndCurrentFilterKey();
  
  if (indFullData.data[cat] && indFullData.data[cat][filterKey]) {
    let dataM = indFullData.data[cat][filterKey].M || [];
    let dataF = indFullData.data[cat][filterKey].F || [];
    
    const federation = indFederationSelect.value;
    if (federation !== 'all') {
      dataM = dataM.filter(d => d.federation === federation);
      dataF = dataF.filter(d => d.federation === federation);
    }
    
    return {
      M: getIndBestPerYear(dataM),
      F: getIndBestPerYear(dataF)
    };
  }
  
  const fallbackKey = 'equipment_all_tested_all';
  if (indFullData.data[cat] && indFullData.data[cat][fallbackKey]) {
    return {
      M: getIndBestPerYear(indFullData.data[cat][fallbackKey].M),
      F: getIndBestPerYear(indFullData.data[cat][fallbackKey].F)
    };
  }
  
  return { M: [], F: [] };
}

// Events
indCategorySelect.addEventListener("change", () => {
  indCurrentCategory = indCategorySelect.value;
  updateIndChart();
});

indFederationSelect.addEventListener("change", () => {
  console.log("Individual Federation changed to:", indFederationSelect.value);
  updateIndChart();
});

indTestedSelect.addEventListener("change", () => {
  console.log("Individual Tested changed to:", indTestedSelect.value);
  updateIndChart();
});

indEquipmentSelect.addEventListener("change", () => {
  console.log("Individual Equipment changed to:", indEquipmentSelect.value);
  updateIndChart();
});

// Update chart
function updateIndChart() {
  const data = getIndCurrentData();
  if (!data) {
    console.warn("No individual data available");
    return;
  }
  
  const dataM = data.M || [];
  const dataF = data.F || [];
  
  console.log(`Individual Rendering: ${dataM.length} male records, ${dataF.length} female records`);
  
  const lineDataM = dataM.filter(d => d.best != null);
  const lineDataF = dataF.filter(d => d.best != null);
  
  const allBestVals = [...dataM, ...dataF]
    .map(d => d.best)
    .filter(v => v != null);
  
  const yMax = allBestVals.length ? d3.max(allBestVals) * 1.06 : 100;
  
  indY.domain([0, yMax]);
  indX.domain(indYearsExtent);
  indBrushX.domain(indYearsExtent);
  
  const xAxis = d3.axisBottom(indX)
    .ticks(d3.timeYear.every(5))
    .tickFormat(d3.timeFormat("%Y"));
  
  const yAxis = d3.axisLeft(indY).ticks(6);
  
  indXAxisG.transition().duration(700).call(xAxis);
  indYAxisG.transition().duration(700).call(yAxis);
  
  if (indCurrentCategory === "dots") {
    indYLabel.text("Dots points");
  } else {
    indYLabel.text(`${indCategories[indCurrentCategory].label} [kg]`);
  }
  
  // Lines
  indLinesG.selectAll(".line").remove();
  
  if (lineDataM.length > 1) {
    indLinesG.append("path")
      .datum(lineDataM)
      .attr("class", "line male-line")
      .attr("fill", "none")
      .attr("stroke", indColor.M)
      .attr("stroke-width", 2)
      .attr("d", indLineGen)
      .attr("opacity", 0.9);
  }
  
  if (lineDataF.length > 1) {
    indLinesG.append("path")
      .datum(lineDataF)
      .attr("class", "line female-line")
      .attr("fill", "none")
      .attr("stroke", indColor.F)
      .attr("stroke-width", 2)
      .attr("d", indLineGen)
      .attr("opacity", 0.9);
  }
  
  // Dots
  indDotsG.selectAll(".dot-male").remove();
  indDotsG.selectAll(".dot-female").remove();
  
  indDotsG.selectAll(".dot-male")
    .data(dataM.filter(d => d.best != null))
    .enter().append("circle")
    .attr("class", "dot-male")
    .attr("r", 4)
    .attr("cx", d => indX(d.yearDate))
    .attr("cy", d => indY(d.best))
    .attr("fill", indColor.M)
    .attr("stroke", "#fff")
    .on("mouseover", (event, d) => showIndTooltip(event, d))
    .on("mousemove", (event, d) => moveIndTooltip(event))
    .on("mouseout", hideIndTooltip);
  
  indDotsG.selectAll(".dot-female")
    .data(dataF.filter(d => d.best != null))
    .enter().append("circle")
    .attr("class", "dot-female")
    .attr("r", 4)
    .attr("cx", d => indX(d.yearDate))
    .attr("cy", d => indY(d.best))
    .attr("fill", indColor.F)
    .attr("stroke", "#fff")
    .on("mouseover", (event, d) => showIndTooltip(event, d))
    .on("mousemove", (event, d) => moveIndTooltip(event))
    .on("mouseout", hideIndTooltip);
  
  // Brush preview
  const allYears = new Set([...dataM.map(d => d.year), ...dataF.map(d => d.year)]);
  const brushPreview = [];
  
  Array.from(allYears).sort((a, b) => a - b).forEach(year => {
    const mData = dataM.find(d => d.year === year);
    const fData = dataF.find(d => d.year === year);
    const val = d3.max([mData?.best, fData?.best].filter(v => v != null));
    
    if (val != null && !isNaN(val)) {
      brushPreview.push({ 
        yearDate: new Date(year, 0, 1), 
        best: val 
      });
    }
  });
  
  indBrushG.selectAll(".brush-area").remove();
  
  if (brushPreview.length > 0) {
    const brushArea = d3.area()
      .x(d => indBrushX(d.yearDate))
      .y0(indBrushInnerHeight)
      .y1(d => indBrushInnerHeight - (d.best ? (d.best / yMax) * indBrushInnerHeight : 0));
    
    indBrushG.append("path")
      .datum(brushPreview)
      .attr("class", "brush-area")
      .attr("fill", "#4a90e2")
      .attr("opacity", 0.2)
      .attr("d", brushArea);
  }
  
  const brushTicks = [
    new Date(indYearsExtent[0].getFullYear(), 0, 1),
    new Date(indYearsExtent[1].getFullYear(), 0, 1)
  ];
  
  indBrushXAxisG.call(
    d3.axisBottom(indBrushX)
      .tickValues(brushTicks)
      .tickFormat(d3.timeFormat("%Y"))
  );
  
  // Brush
  indBrush = d3.brushX()
    .extent([[0, 0], [indInnerWidth, indBrushInnerHeight]])
    .on("end", indBrushed);
  
  indBrushG.selectAll(".brush").remove();
  indBrushG.append("g").attr("class", "brush").call(indBrush);
  indBrushG.select(".brush").call(indBrush.move, [0, indInnerWidth]);
  
  // Double click reset
  indBrushG.on("dblclick", () => {
    indX.domain(indYearsExtent);
    indXAxisG.transition().duration(600).call(xAxis);
    updateIndPositions();
  });
  
  function updateIndPositions() {
    indSvg.selectAll(".male-line").attr("d", indLineGen);
    indSvg.selectAll(".female-line").attr("d", indLineGen);
    indDotsG.selectAll(".dot-male")
      .attr("cx", d => indX(d.yearDate))
      .attr("cy", d => indY(d.best));
    indDotsG.selectAll(".dot-female")
      .attr("cx", d => indX(d.yearDate))
      .attr("cy", d => indY(d.best));
  }
}

// Tooltip
function showIndTooltip(event, d) {
  if (!d) return;
  const bw = d.bodyweight ? `${(+d.bodyweight).toFixed(1)} kg` : "n/a";
  const tested = d.tested || "n/a";
  const division = d.division || "n/a";
  const equipment = d.equipment || "n/a";
  const html = `
    <strong>${d.name || "(unknown athlete)"}</strong><br>
    Sex: ${d.sex} • ${d.category}<br>
    Year: ${d.year} • ${d.best ? d.best.toFixed(1) + " kg" : "n/a"}<br>
    BW: ${bw} • Equipment: ${equipment}<br>
    ${d.country ? d.country + " • " : ""}${d.federation || ""}<br>
    Division: ${division} • Tested: ${tested}<br>
    Meet: ${d.meet || ""}
  `;
  indTooltip.style("display", "block").html(html);
  moveIndTooltip(event);
}

function moveIndTooltip(event) {
  indTooltip
    .style("left", (event.pageX + 14) + "px")
    .style("top", (event.pageY + 14) + "px");
}

function hideIndTooltip() {
  indTooltip.style("display", "none");
}

// Brushed
function indBrushed(event) {
  const s = event.selection;
  if (!s) return;
  
  const [x0, x1] = s;
  const start = indBrushX.invert(x0);
  const end = indBrushX.invert(x1);
  
  indX.domain([start, end]);
  
  indXAxisG.transition().duration(500).call(
    d3.axisBottom(indX)
      .ticks(d3.timeYear.every(2))
      .tickFormat(d3.timeFormat("%Y"))
  );
  
  indDotsG.selectAll(".dot-male")
    .transition().duration(500)
    .attr("cx", d => indX(d.yearDate))
    .attr("cy", d => indY(d.best));
  
  indDotsG.selectAll(".dot-female")
    .transition().duration(500)
    .attr("cx", d => indX(d.yearDate))
    .attr("cy", d => indY(d.best));
  
  indLinesG.selectAll(".male-line")
    .transition().duration(500)
    .attr("d", indLineGen);
  
  indLinesG.selectAll(".female-line")
    .transition().duration(500)
    .attr("d", indLineGen);
}
