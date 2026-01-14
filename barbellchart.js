const request = new XMLHttpRequest();
request.open("GET", "data/allrecords.json", false);
request.send(null)
const rawData = JSON.parse(request.responseText);
request.open("GET", "data/comparisonFilters.json", false);
request.send(null);
const tagValueMap = new Map(Object.entries(JSON.parse(request.responseText)));


// Initial setup
function setupChart() {
  const barBellChartSvg = d3.select("#bar-bell-chart-svg");
  const margin = { top: 30, right: 20, bottom: 100, left: 60 };
  const width = +barBellChartSvg.attr("width") - margin.left - margin.right;
  const height = +barBellChartSvg.attr("height") - margin.top - margin.bottom;

  const g = barBellChartSvg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Create axis groups
  g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height})`);
  g.append("g").attr("class", "y-axis");

  // Legend
  const color = d3.scaleOrdinal()
    .domain(["blue group", "red group"])
    .range(["#7a7aff", "#ff7a7a"]);

  const legend = barBellChartSvg.append("g")
    .attr("transform", `translate(${width - 120},20)`);

  ["blue group", "red group"].forEach((label, i) => {
    legend.append("rect")
      .attr("x", 0)
      .attr("y", i * 20)
      .attr("width", 20)
      .attr("height", 20)
      .attr("fill", color(label));
    legend.append("text")
      .attr("x", 30)
      .attr("y", i * 20 + 10)
      .text(label)
      .attr("font-size", "15px")
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "start");
  });


  return { svg: barBellChartSvg, g, width, height, margin, color };
}

const chart = setupChart();


const blueInput = document.getElementById("tag-input-blue");
const redInput = document.getElementById("tag-input-red");
const suggestionsBlue = document.getElementById("suggestions-blue");
const suggestionsRed = document.getElementById("suggestions-red");
const tagsContainerBlue = document.getElementById("selected-tags-blue");
const tagsContainerRed = document.getElementById("selected-tags-red");

window.selectedTagsBlue = new Set(["male"]);
window.selectedTagsRed = new Set(["female"]);

function inputHandler(inputBox, suggestionBox, selectedTags, tagsContainer) {
  let query = inputBox.value.toLowerCase().trim();

  if (!query) {
    suggestionBox.classList.add("hidden");
    return;
  }

  let matches = tagValueMap.keys().filter(tag =>
    tag.toLowerCase().startsWith(query) &&
    !selectedTags.has(tag)
  );

  suggestionBox.innerHTML = "";
  if (matches.length === 0) {
    suggestionBox.classList.add("hidden");
    return;
  }

  matches.forEach(tag => {
    let li = document.createElement("li");
    li.textContent = tag;
    li.addEventListener("click", () => selectTag(tag, suggestionBox, selectedTags, inputBox, tagsContainer));
    suggestionBox.appendChild(li);
  });

  suggestionBox.classList.remove("hidden");
}

function selectTag(tag, suggestionBox, selectedTags, inputBox, tagsContainer) {
  if (selectedTags.has(tag)) return;

  selectedTags.add(tag);
  inputBox.value = "";
  suggestionBox.classList.add("hidden");
  inputBox.focus();

  renderSelectedTags(selectedTags, inputBox, tagsContainer);
}

function removeTag(tag, selectedTags, inputBox, tagsContainer) {
  if (selectedTags.has(tag)) {
    selectedTags.delete(tag);
  }
  renderSelectedTags(selectedTags, inputBox, tagsContainer);
  inputBox.focus();
}

function renderSelectedTags(tagList, inputBox, tagsContainer) {
  tagsContainer.innerHTML = "";

  tagList.forEach(tag => {
    let chip = document.createElement("div");
    chip.className = "tag-chip";

    chip.innerHTML = `
            ${tag}
            <span data-tag="${tag}">✕</span>
            `;

    chip.querySelector("span").addEventListener("click", () => removeTag(tag, tagList, inputBox, tagsContainer));
    tagsContainer.appendChild(chip);
  });

  handleFilterChange();
}

blueInput.addEventListener("input", () => inputHandler(blueInput, suggestionsBlue, window.selectedTagsBlue, tagsContainerBlue));
redInput.addEventListener("input", () => inputHandler(redInput, suggestionsRed, window.selectedTagsRed, tagsContainerRed));

renderSelectedTags(window.selectedTagsBlue, blueInput, tagsContainerBlue);
renderSelectedTags(window.selectedTagsRed, redInput, tagsContainerRed);


function handleFilterChange() {
  const result = {
    filterGroup: ["blue group", "red group"],
    "Best Bench": [],
    "Best Squat": [],
    "Best Deadlift": []
  }
  let blueFilters = {};
  let redFilters = {};
  for (let tag of window.selectedTagsBlue) {
    let filter = tagValueMap.get(tag);
    blueFilters[filter[0]] = filter[1];
  }

  for (let tag of window.selectedTagsRed) {
    let filter = tagValueMap.get(tag);
    redFilters[filter[0]] = filter[1];
  }

  const blueData = rawData.filter( row => {
    for (const [key, val] of Object.entries(blueFilters)) {
      if (row[key] !== val) return false;
    }

    return true;
  });

  const redData = rawData.filter( row => {
    for (const [key, val] of Object.entries(redFilters)) {
      if (row[key] !== val) return false;
    }

    return true;
  });


  if (blueData.length > 0) {
    result["Best Bench"][0] = blueData.reduce((max, o) =>
      o["Best Bench"] > max ? o["Best Bench"] : max, -Infinity);

    result["Best Squat"][0] = blueData.reduce((max, o) =>
      o["Best Squat"] > max ? o["Best Squat"] : max, -Infinity);

    result["Best Deadlift"][0] = blueData.reduce((max, o) =>
      o["Best Deadlift"] > max ? o["Best Deadlift"] : max, -Infinity);
  } else {
    result["Best Bench"][0] = 0;
    result["Best Squat"][0] = 0;
    result["Best Deadlift"][0] = 0;
  }

  if (redData.length > 0) {
    result["Best Bench"][1] = redData.reduce((max, o) =>
      o["Best Bench"] > max ? o["Best Bench"] : max, -Infinity);

    result["Best Squat"][1] = redData.reduce((max, o) =>
      o["Best Squat"] > max ? o["Best Squat"] : max, -Infinity);

    result["Best Deadlift"][1] = redData.reduce((max, o) =>
      o["Best Deadlift"] > max ? o["Best Deadlift"] : max, -Infinity);
  } else {
    result["Best Bench"][1] = 0;
    result["Best Squat"][1] = 0;
    result["Best Deadlift"][1] = 0;
  }


  updateChart(result, chart);
}


function updateChart(data, chart) {
  const { g, width, height, color } = chart;

  const groups = ["blue group", "red group"];
  const categories = Object.keys(data).filter(key => key.startsWith("Best"));

  // Transform data for grouped bar chart
  const series = [];
  categories.forEach(cat => {
    groups.forEach((group, i) => {
      series.push({ category: cat, filterGroup: group, value: data[cat][i] });
    });
  });

  const x0 = d3.scaleBand()
    .domain(categories)
    .range([0, width])
    .paddingInner(0.2);

  const x1 = d3.scaleBand()
    .domain(groups)
    .range([0, x0.bandwidth()])
    .padding(0.01);

  const y = d3.scaleLinear()
    .domain([0, d3.max(series, s => s.value)]).nice()
    .range([height, 0]);

  const grouped = d3.group(series, s => s.category);

  const categoryGroups = g.selectAll("g.category")
    .data(grouped, ([cat]) => cat);

  // Enter new categories
  const categoryEnter = categoryGroups.enter()
    .append("g")
    .attr("class", "category")
    .attr("transform", ([cat]) => `translate(${x0(cat)},0)`);

  categoryEnter.merge(categoryGroups)
    .transition().duration(750)
    .attr("transform", ([cat]) => `translate(${x0(cat)},0)`);

  //Bind bars
  const bars = categoryEnter.merge(categoryGroups)
    .selectAll("g.barbell")
    .data(([_, values]) => values, d => d.filterGroup);

  const barsEnter = bars.enter()
    .append("g")
    .attr("class", "barbell")
    .attr("transform", d =>
      `translate(${x1(d.filterGroup)}, ${y(0)})`
    );

  // Shaft
  barsEnter.append("rect")
    .attr("class", "shaft")
    .attr("x", x1.bandwidth() *0.75)
    .attr("y", 0)
    .attr("width", 8)
    .attr("height", 0)
    .attr("fill", "#666");

  // Plates container
  barsEnter.append("g")
    .attr("class", "plates");

  // Tooltip
  barsEnter.append("title")
    .text(d => `${d.value} kg`);

  const barsMerged = barsEnter.merge(bars);

  barsMerged.transition().duration(750)
    .attr("transform", d =>
      `translate(${x1(d.filterGroup)}, ${y(d.value)})`
    );

  // Animate shaft height
  barsMerged.select(".shaft")
    .transition().duration(750)
    .attr("y", 0)
    .attr("height", d => height - y(d.value));

  const plateValue = 25;
  const plateHeight = 10;
  const plateGap = 2;

  barsMerged.each(function(d) {
    const plateCount = 2 * Math.round(Math.floor(d.value / plateValue) / 2);
    const diff = d.value - plateCount * plateValue;
    const plates = d3.select(this).select(".plates");

    plates.selectAll("rect").remove();

    d3.range(plateCount).forEach(i => {
      plates.append("rect")
        .attr("x", x1.bandwidth() / 2 - 12)
        .attr("y", i * (plateHeight + plateGap) + (
          (i < plateCount / 2) ? 0 : height - y(d.value) - (plateCount * plateHeight + (plateCount-1) * plateGap)
        ))
        .attr("width", x1.bandwidth() * 0.75)
        .attr("height", plateHeight)
        .attr("rx", 2)
        .attr("fill", d => color(d.filterGroup));
    });
  });


  categoryGroups.exit().remove();

  //Update axes
  g.select(".x-axis")
    .transition().duration(750)
    .call(d3.axisBottom(x0))
    .selectAll("text")
    .attr("transform", "rotate(-30)")
    .attr("font-size", "15px")
    .style("text-anchor", "end");

  g.select(".y-axis")
    .transition().duration(750)
    .call(d3.axisLeft(y));
}


handleFilterChange();

