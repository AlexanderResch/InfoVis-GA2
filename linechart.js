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

const indSvg = d3.select("#ind-chart")
    .attr("viewBox", `0 0 ${indWidth} ${indHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

const indG = indSvg.append("g")
    .attr("transform", `translate(${indMargin.left},${indMargin.top})`);

indG.append("clipPath").attr("id", "ind-clip")
    .append("rect")
    .attr("width", indInnerWidth)
    .attr("height", indInnerHeight);

const indX = d3.scaleTime().range([0, indInnerWidth]);
const indY = d3.scaleLinear().range([indInnerHeight, 0]);

const indXAxisG = indG.append("g")
    .attr("transform", `translate(0,${indInnerHeight})`)
    .attr("class", "x axis");

const indYAxisG = indG.append("g")
    .attr("class", "y axis");

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

const indLineGen = d3.line()
    .x(d => indX(d.yearDate))
    .y(d => indY(d.best))
    .curve(d3.curveMonotoneX);

const indColor = { M: "#1f77b4", F: "#ff6fb3" };

const indGridBg = indG.insert("rect", ":first-child")
    .attr("class", "grid-background")
    .attr("width", indInnerWidth)
    .attr("height", indInnerHeight)
    .attr("fill", "none")
    .attr("stroke", "none");

const indGridLines = indG.insert("g", ":first-child")
    .attr("class", "grid-lines");

const indLinesG = indG.append("g").attr("clip-path", "url(#ind-clip)");
const indDotsG = indG.append("g").attr("clip-path", "url(#ind-clip)");

const indTooltip = d3.select("body")
    .append("div")
    .attr("class", "ind-tooltip");

const indBrushSvg = d3.select("#ind-brush")
    .attr("viewBox", `0 0 ${indWidth} ${indBrushHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

const indBrushG = indBrushSvg.append("g")
    .attr("transform", `translate(${indBrushMargin.left},${indBrushMargin.top})`);

const indBrushX = d3.scaleTime().range([0, indInnerWidth]);
const indBrushXAxisG = indBrushG.append("g")
    .attr("transform", `translate(0,${indBrushInnerHeight})`);

let indBrush;

const indCategorySelect = document.getElementById("ind-categorySelect");
const indFederationSelect = document.getElementById("ind-federationSelect");
const indTestedSelect = document.getElementById("ind-testedSelect");
const indEquipmentSelect = document.getElementById("ind-equipmentSelect");

let indFullData = null;
let indYearsExtent = [new Date(IND_YEARS.min, 0, 1), new Date(IND_YEARS.max, 11, 31)];
let indCurrentCategory = indCategorySelect.value;
let indSelectedCountry = null;

const indMilestones = [
    {
        year: 1977,
        label: "Single-ply Era Begins",
        description: "First supportive gear allowed in powerlifting competitions",
        color: "#9b59b6"
    },
    {
        year: 1992,
        label: "More Equipment Allowed",
        description: "IPF officially allows bench shirts and squat suits",
        color: "#ff6b6b"
    },
    {
        year: 2000,
        label: "Multi-ply Boom",
        description: "Peak of the equipment era, way more interest and bigger increases in records",
        color: "#4ecdc4"
    },
    {
        year: 2014,
        label: "Raw/Classic Official",
        description: "IPF introduces official Raw/Classic categories – transition phase",
        color: "#95e1d3"
    }
];


d3.json(IND_DATA_JSON_PATH).then(json => {
    indFullData = json;

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

        topFeds.forEach(fed => {
            const option = document.createElement('option');
            option.value = fed;
            option.textContent = fed;
            indFederationSelect.appendChild(option);
        });
    }

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

function getIndCurrentFilterKey() {
    const equipment = indEquipmentSelect.value;
    const tested = indTestedSelect.value;
    return `equipment_${equipment}_tested_${tested}`;
}

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

indCategorySelect.addEventListener("change", () => {
    indCurrentCategory = indCategorySelect.value;
    updateIndChart();
});

indFederationSelect.addEventListener("change", () => {
    updateIndChart();
});

indTestedSelect.addEventListener("change", () => {
    updateIndChart();
});

indEquipmentSelect.addEventListener("change", () => {
    updateIndChart();
});

function updateIndChart() {
    const data = getIndCurrentData();
    if (!data) {
        return;
    }

    const dataM = data.M || [];
    const dataF = data.F || [];

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

    indGridLines.selectAll("line").remove();

    updateIndGrid();

    indXAxisG.transition().duration(700).call(xAxis);
    indYAxisG.transition().duration(700).call(yAxis);


    if (indCurrentCategory === "dots") {
        indYLabel.text("Dots points");
    } else {
        indYLabel.text(`${indCategories[indCurrentCategory].label} [kg]`);
    }

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

    if (indSelectedCountry) {
        applyCountryHighlight(indSelectedCountry);
    }

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

    indBrush = d3.brushX()
        .extent([[0, 0], [indInnerWidth, indBrushInnerHeight]])
        .on("end", indBrushed);

    indBrushG.selectAll(".brush").remove();
    indBrushG.append("g").attr("class", "brush").call(indBrush);
    indBrushG.select(".brush").call(indBrush.move, [0, indInnerWidth]);

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

    drawIndMilestones();
    updateIndGrid();
}

function drawIndMilestones() {
    indG.selectAll(".milestone-line").remove();
    indG.selectAll(".milestone-label").remove();

    indMilestones.forEach(milestone => {
        const milestoneDate = new Date(milestone.year, 0, 1);
        const xPos = indX(milestoneDate);

        if (xPos < 0 || xPos > indInnerWidth) return;

        const line = indG.append("line")
            .attr("class", "milestone-line")
            .attr("x1", xPos)
            .attr("x2", xPos)
            .attr("y1", 0)
            .attr("y2", indInnerHeight)
            .attr("stroke", milestone.color)
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5")
            .attr("opacity", 0.6)
            .style("pointer-events", "none");

        const labelG = indG.append("g")
            .attr("class", "milestone-label")
            .attr("transform", `translate(${xPos}, 10)`)
            .style("cursor", "pointer");

        const labelText = labelG.append("text")
            .attr("x", 5)
            .attr("y", 0)
            .attr("font-size", "11px")
            .attr("font-weight", "bold")
            .attr("fill", milestone.color)
            .text(milestone.year);

        labelG.append("rect")
            .attr("x", 0)
            .attr("y", -12)
            .attr("width", 40)
            .attr("height", 16)
            .attr("fill", "transparent")
            .on("mouseover", (event) => {
                indTooltip
                    .style("display", "block")
                    .html(`
            <strong>${milestone.year}: ${milestone.label}</strong><br>
            ${milestone.description}
          `);
                const [mx, my] = d3.pointer(event, document.body);
                indTooltip
                    .style("left", `${mx + 14}px`)
                    .style("top", `${my + 14}px`);
            })
            .on("mousemove", (event) => {
                const [mx, my] = d3.pointer(event, document.body);
                indTooltip
                    .style("left", `${mx + 14}px`)
                    .style("top", `${my + 14}px`);
            })
            .on("mouseout", () => {
                indTooltip.style("display", "none");
            });
    });
}

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

    updateIndGrid();

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

    drawIndMilestones();
}

function updateIndCountryHighlight(countryName) {
    indSelectedCountry = countryName;
    applyCountryHighlight(countryName);
}

function applyCountryHighlight(countryName) {
    if (!countryName) {
        indDotsG.selectAll(".dot-male")
            .transition().duration(300)
            .attr("opacity", 1.0)
            .attr("r", 4);

        indDotsG.selectAll(".dot-female")
            .transition().duration(300)
            .attr("opacity", 1.0)
            .attr("r", 4);

        return;
    }

    indDotsG.selectAll(".dot-male")
        .transition().duration(300)
        .attr("r", d => d.country === countryName ? 6 : 3);

    indDotsG.selectAll(".dot-female")
        .transition().duration(300)
        .attr("r", d => d.country === countryName ? 6 : 3);
}

function updateIndGrid() {
    indGridLines.selectAll("line").remove();

    const yTicks = indY.ticks(8);
    yTicks.forEach(tick => {
        indGridLines.append("line")
            .attr("x1", 0)
            .attr("x2", indInnerWidth)
            .attr("y1", indY(tick))
            .attr("y2", indY(tick));
    });

    const [startDate, endDate] = indX.domain();
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    for (let year = startYear; year <= endYear; year++) {
        const yearDate = new Date(year, 0, 1);
        const xPos = indX(yearDate);

        if (xPos >= 0 && xPos <= indInnerWidth) {
            indGridLines.append("line")
                .attr("x1", xPos)
                .attr("x2", xPos)
                .attr("y1", 0)
                .attr("y2", indInnerHeight);
        }
    }
}

window.updateIndCountryHighlight = updateIndCountryHighlight;