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

  // outer layout
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

  // inner cell padding
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
