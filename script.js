const width = 900
const height = 420

// svg for map
const svg = d3.select("#map-svg")
  .attr("viewBox", `0 0 ${width} ${height}`)

const tooltip = d3.select("#tooltip")

// elements for detail panel
const detailCountry = d3.select("#detail-country")
const detailMedianDots = d3.select("#detail-median-dots")
const detailMedianTotal = d3.select("#detail-median-total")
const detailCount = d3.select("#detail-count")
const detailMale = d3.select("#detail-male")
const detailFemale = d3.select("#detail-female")
const detailTested = d3.select("#detail-tested")
const detailUntested = d3.select("#detail-untested")

// elements for the legend
const legendContainer = d3.select("#legend")
const legendLow = d3.select("#legend-low")
const legendMid = d3.select("#legend-mid")
const legendHigh = d3.select("#legend-high")
const legendTitle = d3.select("#legend-title")

// elements for filtering
const sexSelect = d3.select("#sex-filter")
const testedSelect = d3.select("#tested-filter")
const metricSelect = d3.select("#metric-filter")

let worldData
let rawRows

// active metric and selection
let currentMetric = "median_dots"
let selectedCountryName = null

// aggregation map per country
let aggMap = new Map()

// mapping from dataset name to GeoJSON name
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

// parse compressed dataset
function loadCsvGz(url, rowAccessor) {
  return fetch(url)
    .then(res => res.arrayBuffer())
    .then(buffer => {
      const uint8 = new Uint8Array(buffer)
      const decompressedText = pako.ungzip(uint8, { to: "string" })
      return d3.csvParse(decompressedText, rowAccessor)
    })
}

// load data
Promise.all([
  d3.json("data/world.geojson"),
  loadCsvGz("data/openpowerlifting_subset.csv.gz", d => {
    const sex = d.Sex

    let tested
    if (d.Tested === "Yes") tested = "Yes"
    else tested = "Unknown"

    const countryRaw = d.Country || null
    const countryName = countryRaw ? normalizeCountryName(countryRaw) : null

    const dots = d.Dots === "" ? NaN : +d.Dots
    const total = d.TotalKg === "" ? NaN : +d.TotalKg

    // Unique key approximation (since dataset has no athlete id or name)
    // Rounds numbers to reduce floating point noise
    const dotsKey = Number.isFinite(dots) ? dots.toFixed(1) : "na"
    const totalKey = Number.isFinite(total) ? total.toFixed(1) : "na"
    const athleteKey = `${countryName || "na"}|${sex || "na"}|${tested || "na"}|${dotsKey}|${totalKey}`

    return {
      sex,
      tested,
      countryName,
      dots,
      total,
      athleteKey
    }
  })
]).then(([world, rows]) => {
  worldData = world

  // remove Antarctic from data
  worldData.features = worldData.features.filter(
    f => f.properties.name !== "Antarctica"
  )

  rawRows = rows.filter(r => r.countryName)

  // map display config
  projection.fitExtent(
    [[0, 10], [width, height - 10]],
    worldData
  )

  drawMap()
  updateMapColors()
  updateLegend()

  sexSelect.on("change", handleFilterChange)
  testedSelect.on("change", handleFilterChange)
  metricSelect.on("change", handleMetricChange)
}).catch(err => {
  console.error("Error loading data:", err)
})

// update on filter change
function handleFilterChange() {
  updateMapColors()
  clearSelection()
}

// change metric - dots, median total (kg), number of athletes
function handleMetricChange() {
  currentMetric = metricSelect.node().value
  updateMapColors()
  updateLegend()
  updateDetailPanel(selectedCountryName)
}

// filtered Rows
function filteredRows() {
  const sexFilter = sexSelect.node().value
  const testedFilter = testedSelect.node().value

  return rawRows.filter(d => {
    const sexOk = sexFilter === "all" || d.sex === sexFilter
    const testedOk = testedFilter === "all" || d.tested === testedFilter
    return sexOk && testedOk
  })
}

// draw map
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

// normalize country name
function featureCountryName(feature) {
  const props = feature.properties || {}
  const name = props.name
  return normalizeCountryName(name)
}

// Tooltip Events
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

// handle click on country
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
}

// aggregation per country
function getCountryAggregatesMap() {
  const rows = filteredRows()
  const grouped = d3.group(rows, d => d.countryName)
  const map = new Map()

  for (const [name, values] of grouped.entries()) {
    const dotsValues = values.map(v => v.dots).filter(Number.isFinite)
    const totalValues = values.map(v => v.total).filter(Number.isFinite)

    const medianDots = dotsValues.length ? d3.median(dotsValues) : NaN
    const medianTotal = totalValues.length ? d3.median(totalValues) : NaN

    // Count unique profiles (approximation for unique athletes)
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

// update map coloring
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

// update legend
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

// update detail panel
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

  // Unique counts (approximation)
  const count = new Set(rows.map(r => r.athleteKey)).size
  const maleCount = new Set(rows.filter(r => r.sex === "M").map(r => r.athleteKey)).size
  const femaleCount = new Set(rows.filter(r => r.sex === "F").map(r => r.athleteKey)).size
  const testedCount = new Set(rows.filter(r => r.tested === "Yes").map(r => r.athleteKey)).size
  const unknownTestedCount = new Set(rows.filter(r => r.tested === "Unknown").map(r => r.athleteKey)).size

  detailCountry.text(`Country: ${countryName}`)
  detailMedianDots.text(`Median Dots: ${formatMetric(medianDots)}`)
  detailMedianTotal.text(`Median Total Kg: ${formatMetric(medianTotal)}`)
  detailCount.text(`Athlete Count: ${d3.format(",")(count)}`)

  detailMale.text(
    `Male Athletes: ${maleCount} (${formatPercentage(maleCount, count)})`
  )
  detailFemale.text(
    `Female Athletes: ${femaleCount} (${formatPercentage(femaleCount, count)})`
  )
  detailTested.text(
    `Tested Athletes: ${testedCount} (${formatPercentage(testedCount, count)})`
  )
  detailUntested.text(
    `Tested Unknown Athletes: ${unknownTestedCount} (${formatPercentage(unknownTestedCount, count)})`
  )
}

function clearSelection() {
  selectedCountryName = null
  svg.selectAll(".selection-outline").remove()
  updateDetailPanel(null)
}

function labelForMetric(metric) {
  if (metric === "median_dots") return "Median Dots"
  if (metric === "median_total") return "Median Total (kg)"
  if (metric === "lift_count") return "Number of Athletes"
  return metric
}

// format of numbers/metrics
function formatMetric(value) {
  if (!Number.isFinite(value)) return "n/a"
  if (currentMetric === "lift_count") {
    return d3.format(",")(value)
  }
  return d3.format(".1f")(value)
}

function formatPercentage(part, total) {
  if (!total) return "0%"
  return d3.format(".1%")(part / total)
}
